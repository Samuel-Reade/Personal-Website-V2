import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useKeyboardState } from "../hooks/useKeyboard";
import { createRimToonMaterial } from "../utils/toon";
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

  // The suit covers most of the character's visible surface, so its rim
  // is kept modest — at steep viewing angles a strong rim on that much
  // surface area washes the black suit out toward gray/tan.
  const suitMat = useMemo(() => createRimToonMaterial("#181a1f", { strength: 0.22 }), []);
  const shirtMat = useMemo(() => createRimToonMaterial("#e8e2d4", { strength: 0.2 }), []);
  const skinMat = useMemo(() => createRimToonMaterial("#caa07a", { strength: 0.22 }), []);
  const hairMat = useMemo(() => createRimToonMaterial("#241d17"), []);
  const shoeMat = useMemo(() => createRimToonMaterial("#0d0d0f", { strength: 0.25 }), []);
  /**
   * The tie is black like the suit, but not the *same* black — against an
   * identical tone it disappears entirely, since both sit in the same toon band
   * under every light angle. A few steps darker is enough to read as a separate
   * garment while still looking black.
   */
  const tieMat = useMemo(() => createRimToonMaterial("#0a0b0e", { strength: 0.3 }), []);
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
      {/* Legs. Hip pivot at 1.06, knee at 0.60, sole at 0.02 — so thigh and shin
          are near enough the same length, which is what separates a real leg
          from the single tapering post this used to be. */}
      {[
        { hip: legL, knee: kneeL, x: -0.105 },
        { hip: legR, knee: kneeR, x: 0.105 },
      ].map(({ hip, knee, x }) => (
        <group key={x} ref={hip} position={[x, 1.06, 0]}>
          <RoundedBox
            args={[0.185, 0.46, 0.2]}
            radius={0.06}
            smoothness={CORNER_SMOOTHNESS}
            material={suitMat}
            position={[0, -0.23, 0]}
            castShadow
          >
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </RoundedBox>
          <group ref={knee} position={[0, -0.46, 0]}>
            <RoundedBox
              args={[0.16, 0.465, 0.18]}
              radius={0.055}
              smoothness={CORNER_SMOOTHNESS}
              material={suitMat}
              position={[0, -0.2325, 0]}
              castShadow
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>
            {/* Offset forward so the shoe reads as a foot pointing somewhere
                rather than a block centred under the ankle. */}
            <RoundedBox
              args={[0.185, 0.115, 0.3]}
              radius={0.045}
              smoothness={CORNER_SMOOTHNESS}
              material={shoeMat}
              position={[0, -0.5225, 0.055]}
              castShadow
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>
          </group>
        </group>
      ))}

      {/* Hips, narrower than the chest — the taper from shoulder to waist is
          most of what makes a suited figure read as a body rather than a slab. */}
      <RoundedBox
        args={[0.34, 0.18, 0.23]}
        radius={0.07}
        smoothness={CORNER_SMOOTHNESS}
        material={suitMat}
        position={[0, 1.11, 0]}
        castShadow
      >
        <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
      </RoundedBox>
      <RoundedBox
        args={[0.4, 0.42, 0.24]}
        radius={0.075}
        smoothness={CORNER_SMOOTHNESS}
        material={suitMat}
        position={[0, 1.41, 0]}
        castShadow
      >
        <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
      </RoundedBox>
      {/* Deltoid caps: they round the shoulder line off where the sleeve meets
          the jacket, which a bare box join leaves as a hard step. */}
      {[-0.215, 0.215].map((x) => (
        <mesh key={x} material={suitMat} position={[x, 1.56, 0]} scale={[1, 0.92, 1]} castShadow>
          <sphereGeometry args={[0.082, 14, 12]} />
        </mesh>
      ))}

      {/* Shirt, lapels, collar and tie. */}
      <mesh material={shirtMat} position={[0, 1.49, 0.122]} castShadow>
        <boxGeometry args={[0.11, 0.24, 0.02]} />
      </mesh>
      {[-0.082, 0.082].map((x) => (
        <mesh
          key={x}
          material={suitMat}
          position={[x, 1.5, 0.123]}
          rotation={[0, 0, x < 0 ? 0.16 : -0.16]}
          castShadow
        >
          <boxGeometry args={[0.09, 0.26, 0.022]} />
        </mesh>
      ))}
      <mesh material={shirtMat} position={[0, 1.605, 0.1]} castShadow>
        <boxGeometry args={[0.185, 0.045, 0.05]} />
      </mesh>
      <RoundedBox
        args={[0.058, 0.055, 0.035]}
        radius={0.014}
        smoothness={2}
        material={tieMat}
        position={[0, 1.575, 0.132]}
        castShadow
      />
      <RoundedBox
        args={[0.048, 0.2, 0.03]}
        radius={0.013}
        smoothness={2}
        material={tieMat}
        position={[0, 1.445, 0.13]}
        castShadow
      />

      {/* Arms. Shoulder at 1.555, elbow 0.30 below it, fingertips landing around
          mid-thigh the way a real arm hangs. */}
      {[
        { shoulder: armL, elbow: elbowL, x: -0.225 },
        { shoulder: armR, elbow: elbowR, x: 0.225 },
      ].map(({ shoulder, elbow, x }) => (
        <group key={x} ref={shoulder} position={[x, 1.555, 0]}>
          <RoundedBox
            args={[0.145, 0.3, 0.165]}
            radius={0.058}
            smoothness={CORNER_SMOOTHNESS}
            material={suitMat}
            position={[0, -0.15, 0]}
            castShadow
          >
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </RoundedBox>
          <group ref={elbow} position={[0, -0.3, 0]}>
            <RoundedBox
              args={[0.125, 0.28, 0.145]}
              radius={0.05}
              smoothness={CORNER_SMOOTHNESS}
              material={suitMat}
              position={[0, -0.14, 0]}
              castShadow
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>
            <mesh material={skinMat} position={[0, -0.32, 0]} castShadow>
              <sphereGeometry args={[0.068, 12, 10]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* A capsule rather than a cylinder — its domed ends tuck into the collar
          and the jaw instead of meeting them at a hard rim. */}
      <mesh material={skinMat} position={[0, 1.65, 0]} castShadow>
        <capsuleGeometry args={[0.072, 0.06, 4, 14]} />
      </mesh>

      {/* Head, face and hair on a pivot at the base of the skull, so the look
          keys can tilt them without moving the body. The pivot is a pair of
          groups — one translating up to the joint, one translating straight
          back down — so every coordinate below stays measured from the
          character's feet exactly as before, rather than a dozen numbers
          having to be rewritten against a new origin. */}
      <group ref={head} position={[0, HEAD_PIVOT_Y, 0]}>
        <group position={[0, -HEAD_PIVOT_Y, 0]}>
          {/* Head. At 0.28 tall against the 1.97 from sole to crown the figure now
              stands close to 7 heads — the realistic range, where it used to sit
              just under 6 for a deliberately stylized look. Shrinking it any
              further starts to read as a caricature in the other direction. */}
          <mesh material={skinMat} position={[0, 1.845, 0]} scale={[1, 1.07, 0.97]} castShadow>
            <sphereGeometry args={[0.133, 22, 20]} />
            <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
          </mesh>
          <mesh material={hairMat} position={[0, 1.855, -0.012]} castShadow>
            <sphereGeometry args={[0.14, 22, 20, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>

          {/* Face. Deliberately minimal — brows, eyes, nose, mouth and nothing else.
              No outlines on any of it: a 4.5cm screen-space stroke around a 2cm eye
              swallows the feature whole. Local +Z is forward, so all of it sits on
              the +Z face of the head. */}
          {[-0.05, 0.05].map((x) => (
            <group key={x}>
              <mesh material={featureMat} position={[x, 1.868, 0.112]} scale={[1, 0.82, 0.55]}>
                <sphereGeometry args={[0.023, 14, 12]} />
              </mesh>
              {/* Brows are squashed spheres, not bars — a box here puts four hard
                  corners on the most-looked-at part of the figure. */}
              <mesh
                material={featureMat}
                position={[x, 1.9, 0.108]}
                rotation={[0, 0, x < 0 ? 0.14 : -0.14]}
                scale={[1, 0.24, 0.34]}
              >
                <sphereGeometry args={[0.032, 14, 10]} />
              </mesh>
            </group>
          ))}
          <mesh material={skinMat} position={[0, 1.845, 0.118]} scale={[0.62, 1, 0.78]} castShadow>
            <sphereGeometry args={[0.028, 12, 10]} />
          </mesh>
          <mesh material={featureMat} position={[0, 1.795, 0.113]} scale={[1, 0.26, 0.36]}>
            <sphereGeometry args={[0.034, 14, 10]} />
          </mesh>
        </group>
      </group>
</group>
  );
}
