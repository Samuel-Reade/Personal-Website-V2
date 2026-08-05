import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getSharedGradient } from "../utils/toon";
import { PLAZA_RADIUS, WORLD_RADIUS } from "./world";

const COUNT = 500;
const PALETTE = ["#f6f1e3", "#f2d675", "#e8a0c4", "#ffffff"];

/** Sparse little wildflower dots poking up through the grass — cheap painterly detail. */
export function Flowers() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const material = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: getSharedGradient() }),
    []
  );
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(0.06, 0), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const colors = new Float32Array(COUNT * 3);
    const palette = PALETTE.map((c) => new THREE.Color(c));

    for (let i = 0; i < COUNT; i++) {
      const r = PLAZA_RADIUS + 2 + Math.random() * (WORLD_RADIUS - PLAZA_RADIUS - 3);
      const a = Math.random() * Math.PI * 2;
      dummy.position.set(Math.sin(a) * r, 0.32, Math.cos(a) * r);
      dummy.scale.setScalar(0.7 + Math.random() * 0.8);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.needsUpdate = true;
  }, []);

  return <instancedMesh ref={meshRef} args={[geometry, material, COUNT]} frustumCulled={false} />;
}
