import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useKeyboardState } from "../hooks/useKeyboard";
import { createRimToonMaterial } from "../utils/toon";
import { createBodyGeometry } from "./bodyGeometry";
import type { ReturnState } from "../state/useStore";
import {
  ALL_PORTALS,
  OBSTACLES,
  PORTAL_EXIT_CLEARANCE,
  PORTAL_TRIGGER_RADIUS,
  WORLD_RADIUS,
  isInsidePortal,
  type PortalSpot,
} from "./world";

const SPEED = 7.8;
const PLAYER_RADIUS = 0.32;
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
/** Facets across each rounded corner. 4 is enough to lose the hard edge without tripling the vertex count. */
const CORNER_SMOOTHNESS = 4;

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
 * Where his joints are, measured up from the soles.
 *
 * These are not eyeballed. The world is metric and he stands 1.97, so each one
 * is the standard anthropometric fraction of stature multiplied out: the hip
 * (greater trochanter) at 0.53, the knee at 0.29, the ankle at 0.05, the elbow
 * at 0.63 and the wrist at 0.49. Working from the fractions rather than by eye
 * is what gets thigh and shin out within a centimetre of each other and puts his
 * fingertips at mid-thigh, both of which the eye reads instantly and neither of
 * which is obvious to guess.
 */
const HIP_Y = 1.05;
const KNEE_DROP = 0.48;
const ANKLE_DROP = 0.47;
const SHOULDER_Y = 1.558;
const ELBOW_DROP = 0.313;
/** Shoulder to the end of the jacket sleeve; the shirt cuff and hand carry on below. */
const WRIST_DROP = 0.27;

/**
 * Half the distance between the leg centres, and between the shoulder pivots.
 *
 * Hip breadth is measured across the tops of the thighs, so the legs have to sit
 * close enough together that two thigh-widths span it — at the old 0.105 they
 * were planted wider than his own hips. The shoulders came down too: over the
 * deltoids he now spans 0.52, or 0.26 of stature, which is a broad-shouldered
 * man. He was at 0.30, which is nobody.
 */
const LEG_X = 0.088;
const SHOULDER_X = 0.183;

/**
 * How far the arms hang away from the body, in radians about Z.
 *
 * Not decoration — without it they intersect him. A shoulder joint sits inboard
 * of the widest part of the deltoid, so an arm dropped straight down from it
 * puts the hand's inner edge at 0.155 against a thigh whose surface is out at
 * 0.186, and the hands spend the whole walk cycle buried in the trousers. Four
 * degrees of abduction carries the wrist clear by about a centimetre, and is
 * roughly where a real arm hangs anyway — nobody stands with their arms pinned
 * to their sides.
 */
const ARM_SPLAY = 0.07;

/** Sole to instep. Placed so the sole sits on the ground rather than in it. */
const SHOE_HEIGHT = 0.115;

/**
 * The limb profiles — see `bodyGeometry.ts` for why parts are lofted from rings
 * rather than built from primitives. Local y, so 0 is the joint each part hangs
 * from and the rings run down from there.
 *
 * The numbers are a tailored suit's, not a nude figure's: a trouser is fullest
 * just below the seat and breaks over the shoe at roughly half that width, and a
 * jacket sleeve runs from a full bicep to a cuff narrow enough to show a shirt.
 * Every part is a touch deeper than it is wide, which is true of a real limb and
 * is what stops them reading as flat when he turns side-on.
 */
const THIGH = createBodyGeometry([
  // Buried in the jacket, and drawn in so it doesn't bulge out through the hip.
  { y: 0.02, rx: 0.082, rz: 0.09 },
  { y: -0.06, rx: 0.099, rz: 0.105 },
  { y: -0.14, rx: 0.098, rz: 0.104 },
  { y: -0.28, rx: 0.088, rz: 0.093 },
  { y: -0.4, rx: 0.08, rz: 0.085 },
  { y: -KNEE_DROP, rx: 0.076, rz: 0.081 },
]);

const SHIN = createBodyGeometry([
  // Picks the thigh's knee ring back up, so the trouser runs on through the joint.
  { y: 0.02, rx: 0.076, rz: 0.081 },
  // The calf, which swells behind the leg rather than beside it.
  { y: -0.09, rx: 0.073, rz: 0.084 },
  { y: -0.18, rx: 0.071, rz: 0.079 },
  { y: -0.32, rx: 0.066, rz: 0.07 },
  { y: -0.43, rx: 0.063, rz: 0.066 },
  { y: -ANKLE_DROP, rx: 0.062, rz: 0.068 },
]);

const UPPER_ARM = createBodyGeometry([
  { y: 0.03, rx: 0.076, rz: 0.079 },
  { y: -0.05, rx: 0.079, rz: 0.082 },
  { y: -0.16, rx: 0.073, rz: 0.076 },
  { y: -0.26, rx: 0.067, rz: 0.07 },
  { y: -ELBOW_DROP, rx: 0.064, rz: 0.067 },
]);

const FOREARM = createBodyGeometry([
  { y: 0.02, rx: 0.065, rz: 0.068 },
  { y: -0.08, rx: 0.062, rz: 0.065 },
  { y: -0.19, rx: 0.054, rz: 0.056 },
  { y: -WRIST_DROP, rx: 0.049, rz: 0.051 },
]);

/**
 * The hand, hanging from the wrist. Wider than it is thick, and the wide axis is
 * Z rather than X on purpose: an arm at rest turns the palm in toward the thigh,
 * so the breadth across the knuckles points fore-and-aft. Squared off, because a
 * hand is a slab with fingers, not a tube.
 */
const HAND = createBodyGeometry(
  [
    { y: 0, rx: 0.026, rz: 0.036 },
    { y: -0.05, rx: 0.028, rz: 0.047 },
    { y: -0.11, rx: 0.024, rz: 0.045 },
    { y: -0.162, rx: 0.015, rz: 0.029 },
  ],
  { segments: 16, squareness: 3 }
);

/**
 * The torso, in feet-measured coordinates rather than local ones — it hangs off
 * nothing, so its rings are simply heights above the ground like every other
 * number in this file.
 *
 * It replaces two stacked blocks that stepped straight from a 0.34-wide hip to a
 * 0.40-wide chest with no waist between them. A jacket suppresses the waist
 * rather than hiding it, and that single narrowing at 1.22 is what tells the eye
 * there is a ribcage above and a pelvis below instead of one slab.
 */
const TORSO = createBodyGeometry(
  [
    { y: 1.615, rx: 0.15, rz: 0.089 },
    { y: 1.575, rx: 0.184, rz: 0.11 },
    { y: 1.48, rx: 0.19, rz: 0.118 },
    { y: 1.36, rx: 0.179, rz: 0.115 },
    { y: 1.22, rx: 0.161, rz: 0.107 },
    { y: 1.1, rx: 0.172, rz: 0.113 },
    { y: 1.01, rx: 0.17, rz: 0.111 },
    // Rolled under, so the hem closes rather than ending on a flat disc.
    { y: 0.968, rx: 0.14, rz: 0.092 },
  ],
  { squareness: 3.4 }
);

/** Base of the skull, where the head nods from. */
const HEAD_PIVOT_Y = 1.71;
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
   */
  resolveMove?: (next: THREE.Vector3) => void;
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
}: PlayerProps) {
  const group = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const kneeL = useRef<THREE.Group>(null!);
  const kneeR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const elbowL = useRef<THREE.Group>(null!);
  const elbowR = useRef<THREE.Group>(null!);

  const keys = useKeyboardState();
  const facing = useRef(initialFacing ?? SPAWN_FACING);
  const walkT = useRef(0);
  const pitch = useRef(0);
  const front = useRef(new THREE.Vector3());
  /** Height above the ground, and the vertical velocity carrying him there. */
  const height = useRef(0);
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

  // The suit covers most of the character's visible surface, so its rim
  // is kept modest — at steep viewing angles a strong rim on that much
  // surface area washes the black suit out toward gray/tan.
  const suitMat = useMemo(() => createRimToonMaterial(dress.body, { strength: 0.22 }), [dress.body]);
  /**
   * The gown panel is open-ended, so it needs both faces drawn — a single-sided
   * cone reads as a hole from any angle that catches its inside.
   */
  const gownMat = useMemo(() => {
    const material = createRimToonMaterial(dress.body, { strength: 0.22 });
    material.side = THREE.DoubleSide;
    return material;
  }, [dress.body]);
  const trimMat = useMemo(() => createRimToonMaterial(dress.trim, { strength: 0.3 }), [dress.trim]);
  const shirtMat = useMemo(() => createRimToonMaterial(dress.shirt, { strength: 0.2 }), [dress.shirt]);
  const skinMat = useMemo(() => createRimToonMaterial("#caa07a", { strength: 0.22 }), []);
  const hairMat = useMemo(() => createRimToonMaterial("#241d17"), []);
  const shoeMat = useMemo(() => createRimToonMaterial(dress.shoe, { strength: 0.25 }), [dress.shoe]);
  /**
   * The tie is black like the suit, but not the *same* black — against an
   * identical tone it disappears entirely, since both sit in the same toon band
   * under every light angle. A few steps darker is enough to read as a separate
   * garment while still looking black.
   */
  const tieMat = useMemo(() => createRimToonMaterial(dress.tie, { strength: 0.3 }), [dress.tie]);
  /** Brows, eyes and mouth. Rim is off — a warm edge glow on 2cm features just muddies them. */
  const featureMat = useMemo(() => createRimToonMaterial("#1a1410", { strength: 0 }), []);

  useFrame((_state, delta) => {
    const position = positionRef.current;
    const k = keys.current;

    if (k.left) facing.current += TURN_RATE * delta;
    if (k.right) facing.current -= TURN_RATE * delta;

    const drive = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);

    // Takeoff: only from the ground, and only on a fresh press.
    if (k.jump && !airborne.current && jumpArmed.current) {
      airborne.current = true;
      jumpArmed.current = false;
      vertical.current = JUMP_VELOCITY;
      const takeoffSpeed = drive !== 0 ? drive * SPEED : 0;
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
      stepX = front.current.x * drive * SPEED * delta;
      stepZ = front.current.z * drive * SPEED * delta;
    }

    if (stepX !== 0 || stepZ !== 0) {
      const next = position.clone();
      next.x += stepX;
      next.z += stepZ;

      if (resolveMove) {
        resolveMove(next);
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
    position.y = height.current;

    // The walk cycle only advances while there is ground to push against.
    if (!airborne.current) {
      // Signed, so the legs cycle backwards when reversing.
      walkT.current += drive !== 0 ? delta * WALK_CYCLE_RATE * drive : delta * 2;
    }

    facingRef.current = facing.current;

    // Only the outdoor field has portals; other worlds reuse this controller with
    // their own geometry, where these trigger circles are meaningless.
    const entered = onEnterPortal
      ? ALL_PORTALS.find((spot) => isInsidePortal(spot, position.x, position.z))
      : undefined;
    if (!entered) {
      portalArmed.current = true;
    } else if (portalArmed.current) {
      portalArmed.current = false;
      // Back the return point out along the portal-to-player direction, so they
      // reappear clear of the trigger rather than inside it.
      const dx = position.x - entered.position[0];
      const dz = position.z - entered.position[2];
      const dist = Math.hypot(dx, dz);
      const clearance = PORTAL_TRIGGER_RADIUS * entered.scale + PORTAL_EXIT_CLEARANCE;
      // Approaching dead-on leaves no direction to back out along, so fall back
      // to the character's own facing and step them backwards from it.
      const outX = dist > 0.0001 ? dx / dist : -Math.sin(facing.current);
      const outZ = dist > 0.0001 ? dz / dist : -Math.cos(facing.current);
      onEnterPortal?.(entered, {
        position: [entered.position[0] + outX * clearance, 0, entered.position[2] + outZ * clearance],
        facing: facing.current,
      });
    }

    if (group.current) {
      group.current.position.copy(position);
      group.current.rotation.y = facing.current;
    }

    const walking = drive !== 0 && !airborne.current;
    const swing = Math.sin(walkT.current) * (walking ? 0.46 : 0.035);

    // Blend toward a tuck while off the ground: knees drawn up, arms lifted.
    airPose.current = THREE.MathUtils.lerp(
      airPose.current,
      airborne.current ? 1 : 0,
      1 - Math.exp(-11 * delta)
    );
    const air = airPose.current;
    const blend = (grounded: number, tucked: number) => THREE.MathUtils.lerp(grounded, tucked, air);

    if (legL.current) legL.current.rotation.x = blend(swing, -0.62);
    if (legR.current) legR.current.rotation.x = blend(-swing, -0.34);
    // A knee only folds one way. Positive rotation carries the shin backwards,
    // so each leg bends exactly while its thigh is swinging forward (negative
    // swing) and stays straight through the planted half of the stride.
    if (kneeL.current) kneeL.current.rotation.x = blend(Math.max(0, -swing) * 0.95, 1.05);
    if (kneeR.current) kneeR.current.rotation.x = blend(Math.max(0, swing) * 0.95, 0.7);

    // Arms counter the legs, and a shade shorter — a full-amplitude arm swing on
    // a suited figure reads as marching.
    if (armL.current) armL.current.rotation.x = blend(-swing * 0.8, -1.15);
    if (armR.current) armR.current.rotation.x = blend(swing * 0.8, -0.95);
    // Elbows keep a constant slight bend and tighten with the swing. Perfectly
    // straight arms are most of what made the old figure read as a mannequin.
    const elbow = -(0.22 + Math.abs(swing) * 0.5);
    if (elbowL.current) elbowL.current.rotation.x = elbow;
    if (elbowR.current) elbowR.current.rotation.x = elbow;

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
      {/* Legs. Thigh and shin come out 0.48 and 0.47 from the joint fractions
          above — near enough equal, as a real leg is. Both taper, which is the
          whole point: a trouser that is the same width at the ankle as at the
          hip is a pipe, and two pipes on a hinge is what this used to be. */}
      {[
        { hip: legL, knee: kneeL, x: -LEG_X },
        { hip: legR, knee: kneeR, x: LEG_X },
      ].map(({ hip, knee, x }) => (
        <group key={x} ref={hip} position={[x, HIP_Y, 0]}>
          <mesh geometry={THIGH} material={suitMat} castShadow>
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </mesh>
          <group ref={knee} position={[0, -KNEE_DROP, 0]}>
            {/* The knee. Two tapered shafts meeting at a pivot open a wedge at
                the back of the joint as it folds — most visible in the jump
                tuck, where the knee bends a full radian — and this fills it.
                A knee is a ball on a real leg in any case. */}
            <mesh material={suitMat} scale={[1, 0.92, 1.02]} castShadow>
              <sphereGeometry args={[0.077, 14, 12]} />
            </mesh>
            <mesh geometry={SHIN} material={suitMat} castShadow>
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </mesh>
            {/* Offset forward so the shoe reads as a foot pointing somewhere
                rather than a block centred under the ankle, and placed off the
                knee's own height so the sole meets the ground exactly. It lost
                4cm of width with the legs: at 0.185 it was wider than his shin,
                which is a clown shoe. A real foot is about 0.055 of stature. */}
            <RoundedBox
              args={[0.113, SHOE_HEIGHT, 0.285]}
              radius={0.032}
              smoothness={CORNER_SMOOTHNESS}
              material={shoeMat}
              position={[0, -(HIP_Y - KNEE_DROP) + SHOE_HEIGHT / 2, 0.055]}
              castShadow
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>
          </group>
        </group>
      ))}

      {/* Torso — one lofted form from collar to jacket hem, in feet-measured
          coordinates, so it needs no offset of its own. */}
      <mesh geometry={TORSO} material={suitMat} castShadow>
        <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
      </mesh>
      {/* Deltoid caps: they round the shoulder line off where the sleeve meets
          the jacket, which a bare join leaves as a hard step. Outside the arm
          groups on purpose — a deltoid belongs to the shoulder and stays put
          while the arm swings under it. */}
      {[-0.176, 0.176].map((x) => (
        <mesh key={x} material={suitMat} position={[x, 1.552, 0]} scale={[1, 0.95, 1.03]} castShadow>
          <sphereGeometry args={[0.079, 16, 12]} />
        </mesh>
      ))}

      {outfit === "graduate" && (
        <>
          {/* Gown, flaring from the waist to mid-thigh. It deliberately stops
              above the knee: the thigh swings about 0.14 forward at full stride,
              and a hem any lower than this is one the leg walks straight
              through. The legs already carry the gown's colour, so what hangs
              below reads as more of the same garment. */}
          <mesh material={gownMat} position={[0, 0.97, 0]} castShadow>
            <cylinderGeometry args={[0.21, 0.31, 0.42, 16, 1, true]} />
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </mesh>
          {/* Stole, proud of the lapels so it lies over them rather than
              fighting them for the same plane, and split wide enough to leave
              the tie showing between. */}
          {[-0.105, 0.105].map((x) => (
            <mesh key={x} material={trimMat} position={[x, 1.42, 0.12]} castShadow>
              <boxGeometry args={[0.062, 0.4, 0.018]} />
            </mesh>
          ))}
        </>
      )}

      {/* Shirt, lapels, collar and tie. Every z here is set against the torso's
          own front surface rather than a flat face, since it now has a slight
          curve across it: the shirt panel sits a couple of millimetres proud so
          it reads as flush, the lapels are sunk far enough that only their inner
          edge lifts off — which is the way a lapel actually rolls — and the tie
          knot stands clear of both. */}
      <mesh material={shirtMat} position={[0, 1.487, 0.11]} castShadow>
        <boxGeometry args={[0.1, 0.235, 0.02]} />
      </mesh>
      {[-0.082, 0.082].map((x) => (
        <mesh
          key={x}
          material={suitMat}
          position={[x, 1.5, 0.107]}
          rotation={[0, 0, x < 0 ? 0.16 : -0.16]}
          castShadow
        >
          <boxGeometry args={[0.09, 0.26, 0.024]} />
        </mesh>
      ))}
      <mesh material={shirtMat} position={[0, 1.598, 0.072]} castShadow>
        <boxGeometry args={[0.155, 0.045, 0.05]} />
      </mesh>
      <RoundedBox
        args={[0.056, 0.052, 0.034]}
        radius={0.014}
        smoothness={2}
        material={tieMat}
        position={[0, 1.568, 0.112]}
        castShadow
      />
      <RoundedBox
        args={[0.046, 0.19, 0.028]}
        radius={0.013}
        smoothness={2}
        material={tieMat}
        position={[0, 1.44, 0.111]}
        castShadow
      />

      {/* Arms. Shoulder at 1.558, elbow at 1.245 and wrist at 0.975 — 0.63 and
          0.49 of stature, where they belong — which lands his fingertips at
          0.79, mid-thigh, the way a real arm hangs. They were stopping a good
          8cm short of that, which is most of why the figure read as stubby. */}
      {[
        { shoulder: armL, elbow: elbowL, x: -SHOULDER_X },
        { shoulder: armR, elbow: elbowR, x: SHOULDER_X },
      ].map(({ shoulder, elbow, x }) => (
        // The splay is its own group, outside the animated one: the walk cycle
        // owns rotation.x on the group below, and a static tilt sharing that
        // object would be at the mercy of whichever wrote last.
        <group key={x} position={[x, SHOULDER_Y, 0]} rotation={[0, 0, Math.sign(x) * ARM_SPLAY]}>
          <group ref={shoulder}>
            <mesh geometry={UPPER_ARM} material={suitMat} castShadow>
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </mesh>
            <group ref={elbow} position={[0, -ELBOW_DROP, 0]}>
              {/* Fills the joint as it folds, exactly as the knee ball does. */}
              <mesh material={suitMat} scale={[1, 0.95, 1.05]} castShadow>
                <sphereGeometry args={[0.065, 14, 12]} />
              </mesh>
              <mesh geometry={FOREARM} material={suitMat} castShadow>
                <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
              </mesh>
              {/* A band of shirt cuff showing past the jacket sleeve. Half a
                  centimetre of it is the whole tell that he is wearing two
                  garments rather than a single black sheath from neck to hand. */}
              <mesh material={shirtMat} position={[0, -WRIST_DROP - 0.012, 0]} castShadow>
                <cylinderGeometry args={[0.047, 0.045, 0.028, 16]} />
              </mesh>
              {/* The hand, replacing the sphere that used to stand in for one.
                  A ball on the end of a sleeve reads as a mitten at any distance
                  the camera actually sits at. */}
              <mesh
                geometry={HAND}
                material={skinMat}
                position={[0, -WRIST_DROP - 0.025, 0]}
                castShadow
              >
                <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
              </mesh>
            </group>
          </group>
        </group>
      ))}

      {/* A capsule rather than a cylinder — its domed ends tuck into the collar
          and the jaw instead of meeting them at a hard rim. */}
      <mesh material={skinMat} position={[0, 1.648, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.09, 4, 14]} />
      </mesh>

      {/* Head, face and hair on a pivot at the base of the skull, so the look
          keys can tilt them without moving the body. The pivot is a pair of
          groups — one translating up to the joint, one translating straight
          back down — so every coordinate below stays measured from the
          character's feet exactly as before, rather than a dozen numbers
          having to be rewritten against a new origin. */}
      <group ref={head} position={[0, HEAD_PIVOT_Y, 0]}>
        <group position={[0, -HEAD_PIVOT_Y, 0]}>
          {/* Head. Its height is unchanged — at 0.28 against the 1.97 from sole
              to crown he stands close to 7 heads, the realistic range, and
              shrinking that starts to read as a caricature in the other
              direction. What changed is the plan view. A head is far taller
              than it is wide (a real one is about 0.66 as broad as it is tall);
              this was a near-sphere at 0.93, so from the front it read as a ball
              on shoulders. Narrowed to 0.79, which is still stylized but is
              recognisably a skull. The face below is inset by the same factors,
              so its layout on the surface is exactly the one that was tuned. */}
          <mesh material={skinMat} position={[0, 1.845, 0]} scale={[0.85, 1.07, 0.89]} castShadow>
            <sphereGeometry args={[0.133, 22, 20]} />
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </mesh>
          <mesh material={hairMat} position={[0, 1.855, -0.011]} scale={[0.85, 1, 0.89]} castShadow>
            <sphereGeometry args={[0.14, 22, 20, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>

          {/* Face. Deliberately minimal — brows, eyes, nose, mouth and nothing else.
              No outlines on any of it: a 4.5cm screen-space stroke around a 2cm eye
              swallows the feature whole. Local +Z is forward, so all of it sits on
              the +Z face of the head. */}
          {[-0.0425, 0.0425].map((x) => (
            <group key={x}>
              <mesh material={featureMat} position={[x, 1.868, 0.103]} scale={[1, 0.82, 0.55]}>
                <sphereGeometry args={[0.023, 14, 12]} />
              </mesh>
              {/* Brows are squashed spheres, not bars — a box here puts four hard
                  corners on the most-looked-at part of the figure. */}
              <mesh
                material={featureMat}
                position={[x, 1.9, 0.099]}
                rotation={[0, 0, x < 0 ? 0.14 : -0.14]}
                scale={[1, 0.24, 0.34]}
              >
                <sphereGeometry args={[0.032, 14, 10]} />
              </mesh>
            </group>
          ))}
          <mesh material={skinMat} position={[0, 1.845, 0.108]} scale={[0.62, 1, 0.78]} castShadow>
            <sphereGeometry args={[0.028, 12, 10]} />
          </mesh>
          <mesh material={featureMat} position={[0, 1.795, 0.104]} scale={[1, 0.26, 0.36]}>
            <sphereGeometry args={[0.034, 14, 10]} />
          </mesh>

          {/* Mortarboard. Inside the head pivot, so it nods with him rather
              than hovering in place while he looks up. */}
          {outfit === "graduate" && (
            <group>
              {/* Skullcap first — without it the board floats off the crown.
                  Narrowed with the head it sits on. */}
              <mesh
                material={suitMat}
                position={[0, 1.858, -0.007]}
                scale={[0.85, 1, 0.89]}
                castShadow
              >
                <sphereGeometry args={[0.144, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.44]} />
              </mesh>
              {/* Corner forward, which is the silhouette the shape is known by —
                  edge-on it just reads as a flat slab. The board itself stays
                  square: a mortarboard overhangs the skull it sits on by design,
                  so it does not follow the head in. */}
              <mesh
                material={suitMat}
                position={[0, 1.996, 0]}
                rotation={[0.04, Math.PI / 4, 0]}
                castShadow
              >
                <boxGeometry args={[0.3, 0.017, 0.3]} />
                <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
              </mesh>
              <mesh material={trimMat} position={[0, 2.014, 0]}>
                <sphereGeometry args={[0.019, 10, 8]} />
              </mesh>
              {/* Tassel, hung just inside the right-hand corner. */}
              <mesh material={trimMat} position={[0.18, 1.932, 0]}>
                <cylinderGeometry args={[0.005, 0.005, 0.125, 6]} />
              </mesh>
              <mesh material={trimMat} position={[0.18, 1.845, 0]}>
                <cylinderGeometry args={[0.013, 0.023, 0.07, 8]} />
              </mesh>
            </group>
          )}
        </group>
      </group>
</group>
  );
}
