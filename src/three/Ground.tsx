import { useMemo } from "react";
import * as THREE from "three";
import { getSharedGradient } from "../utils/toon";
import { PLAZA_RADIUS, TREE_RADIUS, WORLD_RADIUS, TREE_SPOTS, angleToPosition, pathRotationY } from "./world";

/** Grass field, central cobblestone plaza, and the paths radiating out to each tree. */
export function Ground() {
  const fieldMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#7a9a5a", gradientMap: getSharedGradient() }),
    []
  );
  const plazaMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#8d8a83", gradientMap: getSharedGradient() }),
    []
  );
  const pathMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#928f87", gradientMap: getSharedGradient() }),
    []
  );

  return (
    <group>
      <mesh material={fieldMat} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[WORLD_RADIUS + 40, 48]} />
      </mesh>
      <mesh material={plazaMat} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[PLAZA_RADIUS, 40]} />
      </mesh>
      {TREE_SPOTS.map((spot) => {
        const length = TREE_RADIUS - PLAZA_RADIUS + 2;
        const midR = PLAZA_RADIUS + length / 2 - 1;
        const [x, , z] = angleToPosition(spot.angle, midR);
        return (
          <mesh
            key={spot.id}
            material={pathMat}
            position={[x, 0.015, z]}
            rotation={[0, pathRotationY(spot.angle), 0]}
            receiveShadow
          >
            <boxGeometry args={[1.6, 0.03, length]} />
          </mesh>
        );
      })}
    </group>
  );
}
