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
  onEnterPortal,
}: PlayerProps) {
  const group = useRef<THREE.Group>(null!);
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
  const front = useRef(new THREE.Vector3());
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

    if (drive !== 0) {
      // rotation.y = f points the character's local +Z along (sin f, cos f).
      front.current.set(Math.sin(facing.current), 0, Math.cos(facing.current));
      const next = position.clone().addScaledVector(front.current, drive * SPEED * delta);

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
      // Signed, so the legs cycle backwards when reversing.
      walkT.current += delta * WALK_CYCLE_RATE * drive;
    } else {
      walkT.current += delta * 2;
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

    const walking = drive !== 0;
    const swing = Math.sin(walkT.current) * (walking ? 0.46 : 0.035);

    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    // A knee only folds one way. Positive rotation carries the shin backwards,
    // so each leg bends exactly while its thigh is swinging forward (negative
    // swing) and stays straight through the planted half of the stride.
    if (kneeL.current) kneeL.current.rotation.x = Math.max(0, -swing) * 0.95;
    if (kneeR.current) kneeR.current.rotation.x = Math.max(0, swing) * 0.95;

    // Arms counter the legs, and a shade shorter — a full-amplitude arm swing on
    // a suited figure reads as marching.
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) armR.current.rotation.x = swing * 0.8;
    // Elbows keep a constant slight bend and tighten with the swing. Perfectly
    // straight arms are most of what made the old figure read as a mannequin.
    const elbow = -(0.22 + Math.abs(swing) * 0.5);
    if (elbowL.current) elbowL.current.rotation.x = elbow;
    if (elbowR.current) elbowR.current.rotation.x = elbow;

    if (group.current) {
      // Rise onto the ball of each foot at mid-stride. Applied to the rendered
      // group only — positionRef stays flat, so grass bending and portal
      // triggers keep testing against ground position.
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
  );
}
