import { useMemo } from "react";
import * as THREE from "three";
import { getSharedGradient } from "../utils/toon";
import { FAR_GROUND_RADIUS } from "./world";

/** The grass-colored ground plane underneath the field (grass itself is instanced on top — see Grass.tsx). */
export function Ground() {
  // Much darker than the grass it sits under, because it is lit very
  // differently: this plane faces straight up and lands in the toon ramp's
  // highlight band, while the near-vertical blades sit in shadow/midtone. Given
  // the same color it renders far brighter than the grass and reads as a pale
  // strip at the horizon — which the mountains used to hide.
  const fieldMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#3a4d28", gradientMap: getSharedGradient() }),
    []
  );

  return (
    <mesh material={fieldMat} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[FAR_GROUND_RADIUS, 64]} />
    </mesh>
  );
}
