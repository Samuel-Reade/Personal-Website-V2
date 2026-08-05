import { useMemo } from "react";
import * as THREE from "three";
import { getSharedGradient } from "../utils/toon";
import { PLAZA_RADIUS, FAR_GROUND_RADIUS } from "./world";

/** A worn, slightly lumpy circle instead of a perfect one — reads as trodden dirt, not a paved plaza. */
function buildWornClearing(radius: number): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(radius, 40);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 1; i < pos.count; i++) {
    // Skip vertex 0 (the center). Low-frequency wobble keeps the edge smooth
    // but irregular rather than jagged.
    const x = pos.getX(i);
    const y = pos.getY(i);
    const angle = Math.atan2(y, x);
    const wobble = 1 + 0.1 * Math.sin(angle * 3 + 1.3) + 0.06 * Math.sin(angle * 7 + 0.4);
    pos.setXY(i, x * wobble, y * wobble);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Grass field and the small worn dirt clearing at spawn. */
export function Ground() {
  const fieldMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#7a9a5a", gradientMap: getSharedGradient() }),
    []
  );
  const clearingMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#8c7a5c", gradientMap: getSharedGradient() }),
    []
  );
  const clearingGeometry = useMemo(() => buildWornClearing(PLAZA_RADIUS), []);

  return (
    <group>
      <mesh material={fieldMat} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[FAR_GROUND_RADIUS, 64]} />
      </mesh>
      <mesh
        material={clearingMat}
        geometry={clearingGeometry}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />
    </group>
  );
}
