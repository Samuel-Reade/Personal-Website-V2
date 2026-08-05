import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createGrassMaterial } from "../utils/toon";
import { buildClumpGeometry } from "./grassGeometry";
import { PLAZA_RADIUS } from "./world";

// 5/8 the height of the tall field grass — thin and trampled-down.
const HEIGHT_SCALE = 5 / 8;
const COUNT = 700;

/**
 * Thin, patchy, trampled-down grass covering the small worn clearing at
 * spawn — the dirt shows through between the shorter blades.
 */
export function ClearingGrass() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const geometry = useMemo(() => buildClumpGeometry(HEIGHT_SCALE), []);
  const material = useMemo(() => createGrassMaterial("#8a9163", { swayStrength: 0.12 }), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const phases = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const base = new THREE.Color("#8a9163");
    const dry = new THREE.Color("#ad9c5f");

    for (let i = 0; i < COUNT; i++) {
      const r = Math.sqrt(Math.random()) * PLAZA_RADIUS;
      const a = Math.random() * Math.PI * 2;
      dummy.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      dummy.scale.setScalar(0.55 + Math.random() * 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      phases[i] = Math.random() * Math.PI * 2;
      const c = base.clone().lerp(dry, Math.random() * 0.6);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute("instancePhase", new THREE.InstancedBufferAttribute(phases, 1));
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.needsUpdate = true;
  }, [geometry]);

  useFrame((state) => {
    const shader = material.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, COUNT]} frustumCulled={false} />;
}
