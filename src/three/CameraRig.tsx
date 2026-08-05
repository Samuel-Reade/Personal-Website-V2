import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

interface CameraRigProps {
  targetRef: React.MutableRefObject<THREE.Vector3>;
  /** Written every frame with the camera's current azimuthal angle, read by Player. */
  yawRef: React.MutableRefObject<number>;
}

/**
 * Third-person orbit camera: drag to look around the player, scroll to zoom.
 * The orbit target continuously tracks the player's position.
 */
export function CameraRig({ targetRef, yawRef }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 2.4, 6.5);
  }, [camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const t = targetRef.current;
    controls.target.set(t.x, t.y + 1.35, t.z);
    controls.update();
    yawRef.current = controls.getAzimuthalAngle();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      minDistance={3}
      maxDistance={9}
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.58}
      rotateSpeed={0.6}
    />
  );
}
