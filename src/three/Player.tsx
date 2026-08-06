import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines } from "@react-three/drei";
import * as THREE from "three";
import { useKeyboardState } from "../hooks/useKeyboard";
import { createRimToonMaterial } from "../utils/toon";
import { OBSTACLES, WORLD_RADIUS } from "./world";

const SPEED = 4.2;
const PLAYER_RADIUS = 0.32;
/** Radians per second the character pivots when steering. */
const TURN_RATE = 2.6;
/**
 * Spawn facing -Z, toward the two standalone signs (see world.ts). The camera
 * sits behind that, at +Z, so the character is seen from the back.
 */
const SPAWN_FACING = Math.PI;
const OUTLINE_COLOR = "#1c140d";
const OUTLINE_THICKNESS = 0.045;
/** Crease threshold (radians): creases the character's box-corner edges (90°) while keeping the head sphere smooth. */
const OUTLINE_ANGLE = 1;

interface PlayerProps {
  /** Mutated in place every frame with the player's current world position. */
  positionRef: React.MutableRefObject<THREE.Vector3>;
  /** Mutated in place every frame with the character's facing, so the camera can sit behind it. */
  facingRef: React.MutableRefObject<number>;
}

/**
 * Third-person character: a man in a black suit. Steering is character-relative
 * — left/right pivot him on the spot, up/down drive along whatever direction he
 * currently faces. It has to work this way now that the camera is locked behind
 * him: with camera-relative movement, a sideways input would turn the character,
 * which would swing the camera, which would redefine "sideways" — so holding one
 * arrow key would spiral instead of walking in a straight line.
 */
export function Player({ positionRef, facingRef }: PlayerProps) {
  const group = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);

  const keys = useKeyboardState();
  const facing = useRef(SPAWN_FACING);
  const walkT = useRef(0);
  const front = useRef(new THREE.Vector3());

  // The suit covers most of the character's visible surface, so its rim
  // is kept modest — at steep viewing angles a strong rim on that much
  // surface area washes the black suit out toward gray/tan.
  const suitMat = useMemo(() => createRimToonMaterial("#181a1f", { strength: 0.22 }), []);
  const shirtMat = useMemo(() => createRimToonMaterial("#e8e2d4", { strength: 0.2 }), []);
  const skinMat = useMemo(() => createRimToonMaterial("#caa07a", { strength: 0.22 }), []);
  const hairMat = useMemo(() => createRimToonMaterial("#241d17"), []);
  const shoeMat = useMemo(() => createRimToonMaterial("#0d0d0f", { strength: 0.25 }), []);

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

      position.copy(next);
      // Signed, so the legs cycle backwards when reversing.
      walkT.current += delta * 8 * drive;
    } else {
      walkT.current += delta * 2;
    }

    facingRef.current = facing.current;

    if (group.current) {
      group.current.position.copy(position);
      group.current.rotation.y = facing.current;
    }

    const swing = drive !== 0 ? Math.sin(walkT.current) * 0.5 : Math.sin(walkT.current) * 0.04;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing;
    if (armR.current) armR.current.rotation.x = swing;
  });

  return (
    <group ref={group}>
      <group ref={legL} position={[-0.155, 0.95, 0]}>
        <mesh material={suitMat} position={[0, -0.31, 0]} castShadow>
          <boxGeometry args={[0.21, 0.78, 0.25]} />
          <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
        </mesh>
        <mesh material={shoeMat} position={[0, -0.72, 0.04]} castShadow>
          <boxGeometry args={[0.23, 0.13, 0.3]} />
        </mesh>
      </group>
      <group ref={legR} position={[0.155, 0.95, 0]}>
        <mesh material={suitMat} position={[0, -0.31, 0]} castShadow>
          <boxGeometry args={[0.21, 0.78, 0.25]} />
          <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
        </mesh>
        <mesh material={shoeMat} position={[0, -0.72, 0.04]} castShadow>
          <boxGeometry args={[0.23, 0.13, 0.3]} />
        </mesh>
      </group>

      {/* Torso width is the whole heroic silhouette — but it is 0.62 tall, so
          pushing much past this reads as a square slab and shrinks the head's
          relative presence. At 0.53 the head is ~60% of shoulder width. */}
      <mesh material={suitMat} position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.53, 0.62, 0.32]} />
        <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
      </mesh>
      <mesh material={shirtMat} position={[0, 1.35, 0.165]} castShadow>
        <boxGeometry args={[0.16, 0.4, 0.02]} />
      </mesh>

      <group ref={armL} position={[-0.325, 1.6, 0]}>
        <mesh material={suitMat} position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.19, 0.56, 0.21]} />
          <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
        </mesh>
        {/* Few segments on purpose: a coarse faceted nub matches the blocky
            limbs better than a smooth ball would. */}
        <mesh material={skinMat} position={[0, -0.58, 0]} castShadow>
          <sphereGeometry args={[0.1, 6, 4]} />
        </mesh>
      </group>
      <group ref={armR} position={[0.325, 1.6, 0]}>
        <mesh material={suitMat} position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.19, 0.56, 0.21]} />
          <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
        </mesh>
        <mesh material={skinMat} position={[0, -0.58, 0]} castShadow>
          <sphereGeometry args={[0.1, 6, 4]} />
        </mesh>
      </group>

      {/* Head size is load-bearing for the stylization: at a 0.32 diameter
          against the 1.885 from sole (y 0.18) to crown (y 2.065), the figure
          stands just under 6 heads tall — already inside the stylized 6–7
          range rather than the ~7.5 of a realistic build. Enlarging it from
          here reads as chibi, not heroic. The heroic silhouette comes from the
          torso width instead, which is why the head is 55% of shoulder width. */}
      <mesh material={skinMat} position={[0, 1.82, 0]} castShadow>
        <sphereGeometry args={[0.16, 12, 12]} />
        <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
      </mesh>
      <mesh material={hairMat} position={[0, 1.9, -0.02]} castShadow>
        <sphereGeometry args={[0.165, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      </mesh>
    </group>
  );
}
