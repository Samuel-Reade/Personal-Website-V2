import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createGrassMaterial } from "../utils/toon";
import { PLAZA_RADIUS, WORLD_RADIUS } from "./world";

const COUNT = 5000;

/** A small clump of a few crossed blades, used as the instanced geometry. */
function buildClumpGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const bladeCount = 3;
  for (let i = 0; i < bladeCount; i++) {
    const height = 0.42 + Math.random() * 0.16;
    const width = 0.05;
    const blade = new THREE.PlaneGeometry(width, height, 1, 3);
    blade.translate(0, height / 2, 0);
    const pos = blade.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v);
      const t = y / height;
      pos.setX(v, pos.getX(v) + t * t * 0.06);
    }
    blade.computeVertexNormals();
    blade.rotateY((i / bladeCount) * Math.PI + Math.random() * 0.3);
    blades.push(blade);
  }
  return mergeGeometries(blades);
}

/**
 * Tall grass covering the field: instanced clumps with GPU-side wind sway and
 * a bend-away-from-player effect (see utils/toon.ts) so it visibly parts as
 * the character walks through.
 */
export function Grass({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const geometry = useMemo(() => buildClumpGeometry(), []);
  const material = useMemo(() => createGrassMaterial("#6d8f4b"), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const phases = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const base = new THREE.Color("#6d8f4b");
    const tip = new THREE.Color("#9cb56a");

    for (let i = 0; i < COUNT; i++) {
      const r = PLAZA_RADIUS + 1.5 + Math.random() * (WORLD_RADIUS - PLAZA_RADIUS - 2.5);
      const a = Math.random() * Math.PI * 2;
      dummy.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      dummy.scale.setScalar(0.75 + Math.random() * 0.6);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      phases[i] = Math.random() * Math.PI * 2;
      const c = base.clone().lerp(tip, Math.random() * 0.5);
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
    const shader = material.userData.shader as
      | { uniforms: { uTime: { value: number }; uPlayerPos: { value: THREE.Vector3 } } }
      | undefined;
    if (shader) {
      shader.uniforms.uTime.value = state.clock.elapsedTime;
      shader.uniforms.uPlayerPos.value.copy(playerPosRef.current);
    }
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, COUNT]} frustumCulled={false} />;
}
