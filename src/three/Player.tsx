import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useKeyboardState } from "../hooks/useKeyboard";
import { createRimToonMaterial, setFlatShading } from "../utils/toon";
import {
  ARM_LENGTH,
  ARM_SPLAY,
  EYE_X,
  EYE_Y,
  EYE_Z,
  HEAD_CAP_SCALE,
  HEAD_CENTER_Y,
  HEAD_PIVOT_Y,
  HEAD_RADIUS,
  HEAD_SCALE,
  HIP_Y,
  LEG_X,
  PLAYER_RADIUS,
  SHOE_HEIGHT,
  SHOULDER_X,
  SHOULDER_Y,
  TORSO_TOP_Y,
  buildFigureGeometry,
} from "./figure";
import { useStore, type ReturnState } from "../state/useStore";
import { getHairGeometry } from "./hair";
import { touchesPortalDisc } from "./portalTrigger";
import { ALL_PORTALS, OBSTACLES, WORLD_RADIUS, walkReturnState, type PortalSpot } from "./world";

const SPEED = 7.8;
/**
 * Strides per second, kept in step with SPEED — raising the walk speed without
 * this makes the feet skate, because the legs keep cycling at the old rate while
 * the body covers more ground.
 */
const WALK_CYCLE_RATE = 14.4;
/** Radians per second the character pivots when steering. */
const TURN_RATE = 2.6;
/**
 * Spawn facing -Z, toward the two standalone signs (see world.ts). The camera
 * sits behind that, at +Z, so the character is seen from the back.
 */
const SPAWN_FACING = Math.PI;
/**
 * A softened outline: thinner than before and a warm dark brown rather than a
 * near-black, so it reads as a drawn edge instead of a hard cut against the
 * scene. Paired with the rounded geometry below, which no longer has 90° corners
 * for a heavy stroke to catch on.
 */
const OUTLINE_COLOR = "#3a2e20";
const OUTLINE_THICKNESS = 0.028;
/** Crease threshold (radians). The rounded bodies carry few creases this sharp, so it now mostly traces silhouette. */
const OUTLINE_ANGLE = 1;
/**
 * Facets across each rounded corner on the shoe, the only box left on him.
 * Dropped from 4 to 1: at 4 the corner is a smooth quarter-round, which is the
 * one thing the rest of this figure no longer does.
 */
const CORNER_SMOOTHNESS = 1;

/**
 * Segments around each limb.
 *
 * Eight, where the meadow used twenty. This is the whole faceting decision: at
 * twenty a limb is a smooth tube and no amount of flat shading rescues it,
 * because the angle between neighbouring faces is too small to see. At eight
 * each face turns 45° from the last and the tube reads as a drawn solid, which
 * is how the trees, the bookshelves and the islands are all built.
 */
const LIMB_SEGMENTS = 8;
/** Longitude / latitude bands on the head and the other round parts, chosen the same way. */
const ROUND_SEGMENTS: [number, number] = [10, 7];

/**
 * Standard gravity, in metres per second squared. The world is metric: the
 * character stands 1.97 units from sole to crown, so a unit is a metre and this
 * is simply the real value rather than a number tuned until the arc looked nice.
 */
const GRAVITY = 9.81;
/**
 * Apex of a standing jump. 0.55 m is a fit adult — the world record is a little
 * over 1.2, and an average person manages nearer 0.4.
 */
const JUMP_APEX = 0.55;
/**
 * Takeoff speed, derived rather than dialled in. Rearranging v² = 2gh gives the
 * speed that *just* reaches JUMP_APEX and no higher, so the stated height and the
 * actual height cannot drift apart the way two hand-picked constants would.
 *
 * At these values the hop lasts 2v/g ≈ 0.67 s, rising and falling in equal time.
 */
const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_APEX);

/**
 * Every part of him, at the meadow's smoothness. The proportions themselves live
 * in `figure.ts`, shared with the rower and the astronaut so the three cannot
 * drift apart again.
 */
const { leg: LEG, arm: ARM, hand: HAND, torso: TORSO } = buildFigureGeometry({
  segments: LIMB_SEGMENTS,
});

/** The mortarboard, sized and seated off the head rather than fixed. */
const BOARD_SPAN = HEAD_RADIUS * 2.1;
/**
 * The cap under the board clears the hair, which stands up to ~0.24 of a
 * head-radius proud of the skull at the back of the crown — body plus the
 * clump ridges (`hair.ts`); the board sits on top of that cap.
 */
const BOARD_CAP_RADIUS = HEAD_RADIUS * 1.27;
const BOARD_Y = HEAD_CENTER_Y + HEAD_RADIUS * 1.28;

/** Radians per second W and S tilt the view. */
const LOOK_RATE = 1.3;
/** How far the view may tilt, up and down. */
const MAX_LOOK_PITCH = 0.62;
/**
 * How far the head itself will follow. Short of the view's full range on
 * purpose: a neck runs out of travel before the camera does, so past this the
 * head holds at its limit and only the view keeps going. Letting it track all
 * the way would snap the chin through the collar.
 */
const MAX_HEAD_PITCH = 0.42;

/**
 * What the character is wearing. The figure underneath is the same person in
 * every world — only the clothes change, so this swaps a colour set and, for
 * the gown, adds a few pieces on top rather than rebuilding the body.
 */
export type Outfit = "suit" | "graduate";

interface OutfitPalette {
  /** Jacket, trousers and sleeves — most of the visible surface. */
  body: string;
  shirt: string;
  tie: string;
  shoe: string;
  /** Stole and tassel on the gown; unused by the suit. */
  trim: string;
}

const OUTFITS: Record<Outfit, OutfitPalette> = {
  suit: { body: "#181a1f", shirt: "#e8e2d4", tie: "#0a0b0e", shoe: "#0d0d0f", trim: "#e3c66b" },
  /**
   * Academic blue, kept well clear of the suit's near-black: a dark navy would
   * read as the same figure under this world's lighting, and the point is that
   * he has visibly changed for the occasion.
   */
  graduate: { body: "#2b47a0", shirt: "#e8e2d4", tie: "#1b2d63", shoe: "#0d0d0f", trim: "#e3c66b" },
};

interface PlayerProps {
  /** Mutated in place every frame with the player's current world position. */
  positionRef: React.MutableRefObject<THREE.Vector3>;
  /** Mutated in place every frame with the character's facing, so the camera can sit behind it. */
  facingRef: React.MutableRefObject<number>;
  /** Overrides SPAWN_FACING — used to restore heading when returning from a world. */
  initialFacing?: number;
  /**
   * Optional replacement for the default collision pass, which is specific to
   * the outdoor field's circular boundary and circular obstacles. A world built
   * from different geometry (rectangular rooms, tables) supplies its own
   * resolver, mutating the candidate position in place.
   *
   * `current` is where the character stands this frame and `fromSurface` what he
   * is standing on. Most resolvers ignore both and take only the candidate; the
   * hall needs them, because whether a move is legal there depends on how far it
   * climbs, which a destination alone cannot say.
   */
  resolveMove?: (
    next: THREE.Vector3,
    current: THREE.Vector3,
    fromSurface: number
  ) => void;
  /**
   * Height of the walkable surface under a given point, for worlds with more
   * than one level to stand on. Defaults to the flat y = 0 every other world
   * walks, so only the hall — which has stairs and balconies — supplies one.
   *
   * `fromSurface` is the surface he was on last frame. A world with one level
   * over another cannot answer without it: the point under the hall's gallery
   * is the floor to a visitor walking the tiles and the gallery to one walking
   * the slab, and only the level he is coming from tells the two apart.
   */
  groundHeight?: (x: number, z: number, fromSurface: number) => number;
  /**
   * Written each frame with the view pitch driven by the look keys, so
   * CameraRig can tilt with the character's head.
   */
  pitchRef?: React.MutableRefObject<number>;
  /**
   * Fired once when the character walks into a portal. `from` is where to put
   * them back when they return: just outside that portal, still facing it.
   */
  onEnterPortal?: (spot: PortalSpot, from: ReturnState) => void;
  /** Defaults to the suit he walks the meadow in. */
  outfit?: Outfit;
  /**
   * Whether Space jumps. Off in the library, where Space opens the book he is
   * standing at instead: one key cannot do both, and a hall of reading tables
   * has nothing to jump over anyway. Defaults on, so the meadow is unaffected.
   */
  canJump?: boolean;
}

/**
 * Third-person character: a man in a black suit. Steering is character-relative
 * — left/right pivot him on the spot, up/down drive along whatever direction he
 * currently faces. It has to work this way now that the camera is locked behind
 * him: with camera-relative movement, a sideways input would turn the character,
 * which would swing the camera, which would redefine "sideways" — so holding one
 * arrow key would spiral instead of walking in a straight line.
 */
export function Player({
  positionRef,
  facingRef,
  initialFacing,
  resolveMove,
  pitchRef,
  onEnterPortal,
  outfit = "suit",
  canJump = true,
  groundHeight,
}: PlayerProps) {
  const group = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);

  const keys = useKeyboardState();
  const facing = useRef(initialFacing ?? SPAWN_FACING);
  const walkT = useRef(0);
  const pitch = useRef(0);
  const front = useRef(new THREE.Vector3());
  /** Height above the ground, and the vertical velocity carrying him there. */
  const height = useRef(0);
  /**
   * The surface he is standing on, eased rather than taken raw.
   *
   * `groundHeight` reports a stair tread, which changes by a whole riser the
   * instant he crosses a nosing. Snapping to that reads as a lift rather than a
   * climb, so this chases the true value fast enough to stay under his feet and
   * slow enough that each riser is a step. Jump height is added on top, which is
   * what keeps the arc a jump *from* wherever he is standing.
   */
  const standingOn = useRef(0);
  /**
   * The same surface unsmoothed — what `groundHeight` last actually reported,
   * rather than what his feet have eased their way to. This is the one handed
   * back as the level he is on, because a world with two floors needs to know
   * which of them he is standing on and not how far through the ease he is.
   */
  const surfaceY = useRef(0);
  const vertical = useRef(0);
  const airborne = useRef(false);
  /** Requires the key to be released between jumps, so holding space doesn't pogo. */
  const jumpArmed = useRef(true);
  /**
   * Horizontal velocity at the moment of takeoff. Nothing pushes him sideways in
   * mid-air, so by Newton's first law this is what he keeps until he lands —
   * which is why the arrow keys do nothing to his path once his feet are off the
   * ground.
   */
  const airVelocity = useRef(new THREE.Vector2());
  /** Eases the tuck in and out rather than snapping between poses. */
  const airPose = useRef(0);
  /**
   * Starts disarmed and only arms once the character stands clear of every
   * portal. Returning from a world puts them right beside the one they came
   * out of, and without this they would be transported straight back in.
   */
  const portalArmed = useRef(false);

  const dress = OUTFITS[outfit];

  /**
   * Every surface on him is flat-shaded.
   *
   * `createBodyGeometry` shares its seam vertices and runs `computeVertexNormals`,
   * which averages a smooth normal across each facet — right for the figure this
   * used to be, wrong for this one. Rather than rebuild the geometry unindexed,
   * the material carries `flatShading`, which makes three derive a true face
   * normal per fragment: same buffers, faceted result, and it works on the
   * imported sphere and box primitives here too, which have no such option of
   * their own.
   *
   * The rim term survives it. `utils/toon.ts` deliberately reads the local
   * `normal` set up by `normal_fragment_begin` rather than the `vNormal` varying,
   * and `vNormal` is the one that isn't declared once flat shading is on.
   */
  const flat = <T extends THREE.Material>(material: T): T => {
    setFlatShading(material);
    return material;
  };

  // The suit covers most of the character's visible surface, so its rim
  // is kept modest — at steep viewing angles a strong rim on that much
  // surface area washes the black suit out toward gray/tan.
  const suitMat = useMemo(
    () => flat(createRimToonMaterial(dress.body, { strength: 0.22 })),
    [dress.body]
  );
  /**
   * The gown panel is open-ended, so it needs both faces drawn — a single-sided
   * cone reads as a hole from any angle that catches its inside.
   */
  const gownMat = useMemo(() => {
    const material = flat(createRimToonMaterial(dress.body, { strength: 0.22 }));
    material.side = THREE.DoubleSide;
    return material;
  }, [dress.body]);
  const trimMat = useMemo(
    () => flat(createRimToonMaterial(dress.trim, { strength: 0.3 })),
    [dress.trim]
  );
  const shirtMat = useMemo(
    () => flat(createRimToonMaterial(dress.shirt, { strength: 0.2 })),
    [dress.shirt]
  );
  const skinMat = useMemo(() => flat(createRimToonMaterial("#caa07a", { strength: 0.22 })), []);
  /**
   * The colour is in the geometry — one of five solid browns per facet, see
   * `hair.ts` — so the material's own tint is white, which leaves the vertex
   * colours to come through as they were cut. Nothing is sampled: the locks
   * read as locks because each facet takes one tone and the toon ramp bands
   * them, the same way the grass and the clouds are drawn.
   *
   * Double-sided, alone among his materials. The hair is an open shell whose
   * lock tips stand off the skull rather than settling onto it, so the
   * underside of a spike is a surface the camera can get round to — culled, a
   * lock seen from below is a hole in his head.
   */
  const hairMat = useMemo(() => {
    const material = flat(createRimToonMaterial("#ffffff"));
    material.vertexColors = true;
    material.side = THREE.DoubleSide;
    return material;
  }, []);
  const shoeMat = useMemo(
    () => flat(createRimToonMaterial(dress.shoe, { strength: 0.25 })),
    [dress.shoe]
  );
  /**
   * The tie is black like the suit, but not the *same* black — against an
   * identical tone it disappears entirely, since both sit in the same toon band
   * under every light angle. A few steps darker is enough to read as a separate
   * garment while still looking black.
   */
  const tieMat = useMemo(
    () => flat(createRimToonMaterial(dress.tie, { strength: 0.3 })),
    [dress.tie]
  );
  /**
   * The eyes, and nothing else now. Rim is off — a warm edge glow on a feature
   * this small just muddies it — and so is flat shading, which is the one
   * exception on the figure: these are meant to read as flat painted dots rather
   * than as faceted beads, and smooth normals on a squashed sphere is what gets
   * that.
   */
  const featureMat = useMemo(() => createRimToonMaterial("#1a1410", { strength: 0 }), []);

  useFrame((_state, delta) => {
    const position = positionRef.current;
    const k = keys.current;
    // Where the frame started, so the portal test below can sweep the whole
    // step rather than sample its end.
    const fromX = position.x;
    const fromZ = position.z;

    if (k.left) facing.current += TURN_RATE * delta;
    if (k.right) facing.current -= TURN_RATE * delta;

    const drive = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);

    // Takeoff: only from the ground, only on a fresh press, and only where the
    // world has a use for the key.
    // The slider's multiplier, read non-reactively so a drag never re-renders
    // the scene. It scales the stride, the takeoff carry and the walk cycle
    // together — legs that don't keep up with the ground read as skating.
    const speedScale = useStore.getState().speedScale;

    if (canJump && k.jump && !airborne.current && jumpArmed.current) {
      airborne.current = true;
      jumpArmed.current = false;
      vertical.current = JUMP_VELOCITY;
      const takeoffSpeed = drive !== 0 ? drive * SPEED * speedScale : 0;
      airVelocity.current.set(
        Math.sin(facing.current) * takeoffSpeed,
        Math.cos(facing.current) * takeoffSpeed
      );
    }
    if (!k.jump) jumpArmed.current = true;

    // Horizontal step: driven by the keys on the ground, by conserved momentum
    // in the air.
    let stepX = 0;
    let stepZ = 0;
    if (airborne.current) {
      stepX = airVelocity.current.x * delta;
      stepZ = airVelocity.current.y * delta;
    } else if (drive !== 0) {
      // rotation.y = f points the character's local +Z along (sin f, cos f).
      front.current.set(Math.sin(facing.current), 0, Math.cos(facing.current));
      stepX = front.current.x * drive * SPEED * speedScale * delta;
      stepZ = front.current.z * drive * SPEED * speedScale * delta;
    }

    if (stepX !== 0 || stepZ !== 0) {
      const next = position.clone();
      next.x += stepX;
      next.z += stepZ;

      if (resolveMove) {
        resolveMove(next, position, surfaceY.current);
      } else {
        const distFromCenter = Math.hypot(next.x, next.z);
        if (distFromCenter > WORLD_RADIUS - PLAYER_RADIUS) {
          const scale = (WORLD_RADIUS - PLAYER_RADIUS) / distFromCenter;
          next.x *= scale;
          next.z *= scale;
        }

        for (const ob of OBSTACLES) {
          const dx = next.x - ob.position[0];
          const dz = next.z - ob.position[1];
          const dist = Math.hypot(dx, dz);
          const minDist = ob.radius + PLAYER_RADIUS;
          if (dist < minDist && dist > 0.0001) {
            const push = minDist - dist;
            next.x += (dx / dist) * push;
            next.z += (dz / dist) * push;
          }
        }
      }

      position.copy(next);
    }

    // Vertical: constant downward acceleration, integrated exactly.
    // Δy = v·Δt + ½aΔt² and v += aΔt is the closed-form solution for constant
    // acceleration over the step, not an approximation of it, so the arc is
    // identical whatever the frame rate — a plain v·Δt would undershoot the apex
    // and undershoot it differently on a 144 Hz display than a 60 Hz one.
    if (airborne.current) {
      const nextHeight = height.current + vertical.current * delta - 0.5 * GRAVITY * delta * delta;

      if (nextHeight > 0) {
        height.current = nextHeight;
        vertical.current -= GRAVITY * delta;
      } else {
        // He reaches the ground partway through this step, not at the end of it.
        // Solving ½gt² − v₀t − h₀ = 0 for the positive root gives the exact
        // instant, and with it the exact impact speed √(v₀² + 2gh₀) — which comes
        // out equal to the takeoff speed, as conservation of energy requires.
        // Simply clamping a negative height instead would let him dip below the
        // floor for a frame and land fractionally faster than he left.
        const impactSpeed = Math.sqrt(
          vertical.current * vertical.current + 2 * GRAVITY * height.current
        );
        const timeToGround = (vertical.current + impactSpeed) / GRAVITY;
        // Carry the horizontal step only as far as he was actually still flying.
        const overshoot = Math.max(0, delta - timeToGround);
        position.x -= airVelocity.current.x * overshoot;
        position.z -= airVelocity.current.y * overshoot;

        height.current = 0;
        vertical.current = 0;
        airborne.current = false;
        airVelocity.current.set(0, 0);
      }
    }
    // Whatever he is standing on, plus however far off it he currently is. A
    // world without a `groundHeight` reports 0 everywhere, which collapses this
    // back to the single ground plane the meadow has always walked.
    const surface = groundHeight ? groundHeight(position.x, position.z, surfaceY.current) : 0;
    surfaceY.current = surface;
    standingOn.current = THREE.MathUtils.lerp(
      standingOn.current,
      surface,
      1 - Math.exp(-18 * delta)
    );
    position.y = standingOn.current + height.current;

    // The walk cycle only advances while there is ground to push against.
    if (!airborne.current) {
      // Signed, so the legs cycle backwards when reversing.
      walkT.current += drive !== 0 ? delta * WALK_CYCLE_RATE * drive * speedScale : delta * 2;
    }

    facingRef.current = facing.current;

    // Only the outdoor field has portals; other worlds reuse this controller with
    // their own geometry, where these discs are meaningless. A portal fires the
    // moment any part of him touches any part of its disc — see `portalTrigger`.
    const entered = onEnterPortal
      ? ALL_PORTALS.find((spot) =>
          touchesPortalDisc(spot, fromX, fromZ, position.x, position.z, PLAYER_RADIUS)
        )
      : undefined;
    if (!entered) {
      portalArmed.current = true;
    } else if (portalArmed.current) {
      portalArmed.current = false;
      // The return spot is worked out from where the step *began*: that point
      // was clear of the disc (or the trigger would already have fired), so it
      // is always on the side he came from. The step's end can be a hair past
      // the plane on a fast frame, and would put him out the far side.
      onEnterPortal?.(entered, walkReturnState(entered, fromX, fromZ, facing.current));
    }

    if (group.current) {
      group.current.position.copy(position);
      group.current.rotation.y = facing.current;
    }

    const walking = drive !== 0 && !airborne.current;
    const swing = Math.sin(walkT.current) * (walking ? 0.46 : 0.035);

    // Blend toward a tuck while off the ground: legs drawn up, arms lifted.
    airPose.current = THREE.MathUtils.lerp(
      airPose.current,
      airborne.current ? 1 : 0,
      1 - Math.exp(-11 * delta)
    );
    const air = airPose.current;
    const blend = (grounded: number, tucked: number) => THREE.MathUtils.lerp(grounded, tucked, air);

    /**
     * Whole limbs now, swinging from hip and shoulder alone — there is no knee
     * or elbow left to fold.
     *
     * The tuck angles are steeper than they were because of it. The old airborne
     * pose got most of its shape from the knees coming up a full radian under a
     * thigh at -0.62; with the knee gone, that same -0.62 reads as a figure
     * hanging stiffly rather than one drawing its legs up, so the leg carries
     * the whole gesture itself.
     */
    if (legL.current) legL.current.rotation.x = blend(swing, -1.0);
    if (legR.current) legR.current.rotation.x = blend(-swing, -0.62);

    // Arms counter the legs, and a shade shorter — a full-amplitude arm swing on
    // a suited figure reads as marching.
    if (armL.current) armL.current.rotation.x = blend(-swing * 0.8, -1.15);
    if (armR.current) armR.current.rotation.x = blend(swing * 0.8, -0.95);

    // W and S tilt the view. The pitch is integrated and held rather than
    // sprung back to level: it is the only vertical control there is, so a
    // spring would fight anyone trying to hold a view of the sky. Press the
    // opposite key to come back level.
    if (k.lookUp) pitch.current += LOOK_RATE * delta;
    if (k.lookDown) pitch.current -= LOOK_RATE * delta;
    pitch.current = THREE.MathUtils.clamp(pitch.current, -MAX_LOOK_PITCH, MAX_LOOK_PITCH);
    if (pitchRef) pitchRef.current = pitch.current;

    // Positive rotation.x tips the head's +Z face downward, so looking up is a
    // negative rotation.
    if (head.current) {
      head.current.rotation.x = -THREE.MathUtils.clamp(
        pitch.current,
        -MAX_HEAD_PITCH,
        MAX_HEAD_PITCH
      );
    }

    if (group.current) {
      // Rise onto the ball of each foot at mid-stride. This scuff is rendered
      // only, unlike the jump height in position.y, which is real and which the
      // camera follows. Neither affects grass bending or portal triggers — both
      // test x and z alone.
      group.current.position.y = position.y + (walking ? Math.abs(Math.sin(walkT.current)) * 0.022 : 0);
    }
  });

  return (
    <group ref={group}>
      {/* Legs: one capsule each, hip to ankle, with no knee in it. The joint is
          gone rather than merely straightened — a figure whose torso is a plain
          block and whose hands are stubs had no business carrying the one
          articulated hinge left on the site. */}
      {[
        { hip: legL, x: -LEG_X },
        { hip: legR, x: LEG_X },
      ].map(({ hip, x }) => (
        <group key={x} ref={hip} position={[x, HIP_Y, 0]}>
          <mesh geometry={LEG} material={suitMat} castShadow>
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </mesh>
          {/* Offset forward so the shoe reads as a foot pointing somewhere
              rather than a block centred under the ankle, and hung off the hip's
              own height so the sole meets the ground exactly whatever the leg
              length becomes. A near-square corner radius, so it reads as a wedge
              rather than a pebble. */}
          <RoundedBox
            args={[0.116, SHOE_HEIGHT, 0.26]}
            radius={0.022}
            smoothness={CORNER_SMOOTHNESS}
            material={shoeMat}
            position={[0, -HIP_Y + SHOE_HEIGHT / 2, 0.05]}
            castShadow
          >
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </RoundedBox>
        </group>
      ))}

      {/* Torso — one rounded rectangular block from collar to hem, in
          feet-measured coordinates, so it needs no offset of its own. The
          deltoid caps that used to round off the shoulder join are gone: the
          arms now hang from pivots outboard of the block and overlap it, which
          leaves no step for a cap to hide. */}
      <mesh geometry={TORSO} material={suitMat} castShadow>
        <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
      </mesh>

      {outfit === "graduate" && (
        <>
          {/* Gown, flaring from the hem of the jacket to mid-thigh. It stops
              above the knee on purpose: the thigh swings about 0.13 forward at
              full stride, and a hem lower than this is one the leg walks
              straight through. The legs already carry the gown's colour, so what
              hangs below reads as more of the same garment. Ten sides, so the
              flare shows its facets like everything else. */}
          <mesh material={gownMat} position={[0, 0.85, 0]} castShadow>
            <cylinderGeometry args={[0.196, 0.272, 0.36, 10, 1, true]} />
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </mesh>
          {/* Stole, proud of the lapels so it lies over them rather than
              fighting them for the same plane, and split wide enough to leave
              the tie showing between. */}
          {[-0.088, 0.088].map((x) => (
            <mesh key={x} material={trimMat} position={[x, 1.32, 0.13]} castShadow>
              <boxGeometry args={[0.055, 0.3, 0.018]} />
            </mesh>
          ))}
        </>
      )}

      {/* Shirt, lapels, collar and tie — flat slabs laid on the front of the
          block. This is the only detail he carries now, and it is all clothing
          rather than anatomy, which is the distinction that matters: the body
          underneath states nothing, and these say "suit" on top of it.
          Everything sits a couple of millimetres proud of the torso's front
          face, which the block's squared section keeps genuinely flat. */}
      <mesh material={shirtMat} position={[0, 1.35, 0.116]} castShadow>
        <boxGeometry args={[0.105, 0.22, 0.02]} />
      </mesh>
      {[-0.08, 0.08].map((x) => (
        <mesh
          key={x}
          material={suitMat}
          position={[x, 1.36, 0.113]}
          rotation={[0, 0, x < 0 ? 0.16 : -0.16]}
          castShadow
        >
          <boxGeometry args={[0.085, 0.24, 0.024]} />
        </mesh>
      ))}
      <mesh material={shirtMat} position={[0, 1.452, 0.088]} castShadow>
        <boxGeometry args={[0.15, 0.045, 0.05]} />
      </mesh>
      <RoundedBox
        args={[0.05, 0.05, 0.032]}
        radius={0.012}
        smoothness={1}
        material={tieMat}
        position={[0, 1.423, 0.119]}
        castShadow
      />
      <RoundedBox
        args={[0.042, 0.185, 0.026]}
        radius={0.011}
        smoothness={1}
        material={tieMat}
        position={[0, 1.305, 0.118]}
        castShadow
      />

      {/* Arms: one capsule each, shoulder to wrist, no elbow. Shoulder at 1.39,
          wrist at 0.87, hand ending at 0.74 — still mid-thigh, because the reach
          is unchanged; only the joint in the middle of it is gone. */}
      {[
        { shoulder: armL, x: -SHOULDER_X },
        { shoulder: armR, x: SHOULDER_X },
      ].map(({ shoulder, x }) => (
        // The splay is its own group, outside the animated one: the walk cycle
        // owns rotation.x on the group below, and a static tilt sharing that
        // object would be at the mercy of whichever wrote last.
        <group key={x} position={[x, SHOULDER_Y, 0]} rotation={[0, 0, Math.sign(x) * ARM_SPLAY]}>
          <group ref={shoulder}>
            <mesh geometry={ARM} material={suitMat} castShadow>
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </mesh>
            {/* A band of shirt cuff showing past the jacket sleeve. Half a
                centimetre of it is the whole tell that he is wearing two
                garments rather than a single black sheath from neck to hand. */}
            <mesh material={shirtMat} position={[0, -ARM_LENGTH - 0.008, 0]} castShadow>
              <cylinderGeometry args={[0.062, 0.06, 0.026, LIMB_SEGMENTS]} />
            </mesh>
            {/* The hand: a stub capsule. It was a modelled palm with knuckle
                breadth before, which is more hand than a figure with no other
                anatomy has any business carrying — and none of it survived being
                a few pixels across at the distance the camera sits. */}
            <mesh geometry={HAND} material={skinMat} position={[0, -ARM_LENGTH - 0.018, 0]} castShadow>
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Neck. Short and thick, and mostly buried: it spans the 6cm between the
          top of the torso block and the underside of the head, and exists only
          so the two don't appear to touch. A head this size doesn't want a
          visible neck holding it up. */}
      <mesh
        material={skinMat}
        position={[0, (TORSO_TOP_Y + HEAD_PIVOT_Y) / 2, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.072, 0.078, HEAD_PIVOT_Y - TORSO_TOP_Y + 0.09, LIMB_SEGMENTS]} />
      </mesh>

      {/* Head, face and hair on a pivot at the base of the skull, so the look
          keys can tilt them without moving the body. The pivot is a pair of
          groups — one translating up to the joint, one translating straight
          back down — so every coordinate below stays measured from the
          character's feet exactly as before, rather than a dozen numbers
          having to be rewritten against a new origin. */}
      <group ref={head} position={[0, HEAD_PIVOT_Y, 0]}>
        <group position={[0, -HEAD_PIVOT_Y, 0]}>
          {/* Head. 0.44 across against the 1.97 from sole to crown, so he reads
              at four and a half heads where he used to be drawn at seven — this
              single number is most of the redesign. Ten longitudes and seven
              latitudes: coarse enough that the facets are the surface rather
              than an artefact of it. */}
          <mesh material={skinMat} position={[0, HEAD_CENTER_Y, 0]} scale={HEAD_SCALE} castShadow>
            <sphereGeometry args={[HEAD_RADIUS, ROUND_SEGMENTS[0], ROUND_SEGMENTS[1]]} />
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </mesh>
          {/* Hair: a sculpted mass over the skull with a real hairline, a
              little volume and strand ridges, rather than the skullcap it was —
              see `hair.ts`. Centred on the head and squashed through the depth
              axis with it, so it sits on the skull it was drawn for. */}
          <mesh
            geometry={getHairGeometry()}
            material={hairMat}
            position={[0, HEAD_CENTER_Y, 0]}
            scale={HEAD_CAP_SCALE}
            castShadow
          />

          {/* Face: two eyes, and nothing else at all.

              The brows, the nose and the mouth are gone. They were four extra
              meshes carrying expression on a figure seen from behind at six
              metres for almost all of its screen time, and expression is exactly
              the kind of detail the rest of the site does without — the
              coworkers, the shelf pieces and the island props all state
              themselves with silhouette alone.

              No outlines here either: a 2.8cm screen-space stroke around a 3cm
              eye swallows the feature whole. Local +Z is forward. */}
          {[-EYE_X, EYE_X].map((x) => (
            <mesh
              key={x}
              material={featureMat}
              position={[x, EYE_Y, EYE_Z]}
              scale={[1, 1.2, 0.38]}
            >
              <sphereGeometry args={[0.034, 12, 10]} />
            </mesh>
          ))}

          {/* Mortarboard. Inside the head pivot, so it nods with him rather
              than hovering in place while he looks up. */}
          {outfit === "graduate" && (
            <group>
              {/* Skullcap first — without it the board floats off the crown.
                  Sized to sit over the hair, and cut off at 0.42π so it stops a
                  few centimetres above the brow rather than on it, with the
                  hair showing beneath its edge at the sides and back. */}
              <mesh
                material={suitMat}
                position={[0, HEAD_CENTER_Y + 0.008, -0.008]}
                scale={HEAD_CAP_SCALE}
                castShadow
              >
                <sphereGeometry
                  args={[BOARD_CAP_RADIUS, ROUND_SEGMENTS[0], ROUND_SEGMENTS[1], 0, Math.PI * 2, 0, Math.PI * 0.42]}
                />
              </mesh>
              {/* Corner forward, which is the silhouette the shape is known by —
                  edge-on it just reads as a flat slab. Sized off the head rather
                  than fixed: a mortarboard overhangs the skull it sits on, and
                  the skull just doubled. */}
              <mesh
                material={suitMat}
                position={[0, BOARD_Y, 0]}
                rotation={[0.04, Math.PI / 4, 0]}
                castShadow
              >
                <boxGeometry args={[BOARD_SPAN, 0.02, BOARD_SPAN]} />
                <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
              </mesh>
              <mesh material={trimMat} position={[0, BOARD_Y + 0.022, 0]}>
                <sphereGeometry args={[0.022, 8, 6]} />
              </mesh>
              {/* Tassel, hung just inside one corner of the board. */}
              <mesh material={trimMat} position={[BOARD_SPAN * 0.42, BOARD_Y - 0.07, 0]}>
                <cylinderGeometry args={[0.006, 0.006, 0.14, 5]} />
              </mesh>
              <mesh material={trimMat} position={[BOARD_SPAN * 0.42, BOARD_Y - 0.164, 0]}>
                <cylinderGeometry args={[0.015, 0.026, 0.08, 6]} />
              </mesh>
            </group>
          )}
        </group>
      </group>
</group>
  );
}
