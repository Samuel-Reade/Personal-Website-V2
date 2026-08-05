import { useMemo } from "react";
import * as THREE from "three";
import { getSharedGradient } from "../utils/toon";
import { FAR_GROUND_RADIUS } from "./world";

/** The grass-colored ground plane underneath the field (grass itself is instanced on top — see Grass.tsx). */
export function Ground() {
  const fieldMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#7a9a5a", gradientMap: getSharedGradient() }),
    []
  );

  return (
    <mesh material={fieldMat} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[FAR_GROUND_RADIUS, 64]} />
    </mesh>
  );
}
