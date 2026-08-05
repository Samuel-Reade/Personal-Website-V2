import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboardState } from "../hooks/useKeyboard";
import { getSharedGradient } from "../utils/toon";
import { OBSTACLES, WORLD_RADIUS } from "./world";

const SPEED = 4.2;
const PLAYER_RADIUS = 0.32;
const TURN_RATE = 10;

interface PlayerProps {
  /** Mutated in place every frame with the player's current world position. */
  positionRef: React.MutableRefObject<THREE.Vector3>;
  /** Read by the player controller to move relative to the camera's current yaw. */
  cameraYawRef: React.MutableRefObject<number>;
}

/** Third-person character: a man in a black suit, arrow-key movement, camera-relative. */
export function Player({ positionRef, cameraYawRef }: PlayerProps) {
  const group = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);

  const keys = useKeyboardState();
  const facing = useRef(0);
  const walkT = useRef(0);

  const suitMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#181a1f", gradientMap: getSharedGradient() }), []);
  const shirtMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#e8e2d4", gradientMap: getSharedGradient() }), []);
  const skinMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#caa07a", gradientMap: getSharedGradient() }), []);
  const hairMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#241d17", gradientMap: getSharedGradient() }), []);
  const shoeMat = useMemo(() => new THREE.MeshToonMaterial({ color: "#0d0d0f", gradientMap: getSharedGradient() }), []);

  useFrame((_state, delta) => {
    const position = positionRef.current;
    const k = keys.current;
    const yaw = cameraYawRef.current;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const move = new THREE.Vector3();
    if (k.forward) move.sub(forward);
    if (k.backward) move.add(forward);
    if (k.right) move.add(right);
    if (k.left) move.sub(right);

    const moving = move.lengthSq() > 0.0001;

    if (moving) {
      move.normalize().multiplyScalar(SPEED * delta);
      const next = position.clone().add(move);

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

      const targetFacing = Math.atan2(move.x, move.z);
      let diff = targetFacing - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += diff * Math.min(1, delta * TURN_RATE);
      walkT.current += delta * 8;
    } else {
      walkT.current += delta * 2;
    }

    if (group.current) {
      group.current.position.copy(position);
      group.current.rotation.y = facing.current;
    }

    const swing = moving ? Math.sin(walkT.current) * 0.5 : Math.sin(walkT.current) * 0.04;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing;
    if (armR.current) armR.current.rotation.x = swing;
  });

  return (
    <group ref={group}>
      <group ref={legL} position={[-0.13, 0.95, 0]}>
        <mesh material={suitMat} position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.16, 0.7, 0.2]} />
        </mesh>
        <mesh material={shoeMat} position={[0, -0.72, 0.04]} castShadow>
          <boxGeometry args={[0.17, 0.1, 0.26]} />
        </mesh>
      </group>
      <group ref={legR} position={[0.13, 0.95, 0]}>
        <mesh material={suitMat} position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.16, 0.7, 0.2]} />
        </mesh>
        <mesh material={shoeMat} position={[0, -0.72, 0.04]} castShadow>
          <boxGeometry args={[0.17, 0.1, 0.26]} />
        </mesh>
      </group>

      <mesh material={suitMat} position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.46, 0.62, 0.28]} />
      </mesh>
      <mesh material={shirtMat} position={[0, 1.35, 0.145]} castShadow>
        <boxGeometry args={[0.14, 0.4, 0.02]} />
      </mesh>

      <group ref={armL} position={[-0.29, 1.58, 0]}>
        <mesh material={suitMat} position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.14, 0.56, 0.16]} />
        </mesh>
        <mesh material={skinMat} position={[0, -0.58, 0]} castShadow>
          <sphereGeometry args={[0.075, 8, 8]} />
        </mesh>
      </group>
      <group ref={armR} position={[0.29, 1.58, 0]}>
        <mesh material={suitMat} position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.14, 0.56, 0.16]} />
        </mesh>
        <mesh material={skinMat} position={[0, -0.58, 0]} castShadow>
          <sphereGeometry args={[0.075, 8, 8]} />
        </mesh>
      </group>

      <mesh material={skinMat} position={[0, 1.82, 0]} castShadow>
        <sphereGeometry args={[0.16, 12, 12]} />
      </mesh>
      <mesh material={hairMat} position={[0, 1.9, -0.02]} castShadow>
        <sphereGeometry args={[0.165, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      </mesh>
    </group>
  );
}
