import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createGrassMaterial } from "../utils/toon";
import { buildClumpGeometry } from "./grassGeometry";
import { WORLD_RADIUS } from "./world";

/** Clumps per square unit inside the walkable field. */
const FIELD_DENSITY = 70;
/**
 * The meadow keeps going past the walk boundary at a much lower density (with
 * bigger clumps, which still read fine that far out) so the field dissolves
 * into the fog instead of stopping at a visible circular edge.
 */
const SKIRT_DENSITY = 14;
const SKIRT_RADIUS = 34;
/**
 * The meadow is split into square chunks, each its own InstancedMesh, so grass
 * outside the camera frustum is skipped entirely. Culling is all-or-nothing per
 * mesh, so a single mesh for all ~135k clumps would run the vertex shader over
 * every blade in the world — including everything behind the camera — every
 * frame. At this size roughly half the clumps survive culling in a typical
 * view; going smaller barely culls more and just multiplies draw calls.
 */
const CHUNK_SIZE = 4;

const FIELD_RADIUS = WORLD_RADIUS - 1;
const BASE_COLOR = "#6d8f4b";
const TIP_COLOR = "#9cb56a";

interface Chunk {
  key: string;
  matrices: Float32Array;
  colors: Float32Array;
  phases: Float32Array;
  count: number;
}

/**
 * Scatters one chunk's worth of clumps by sampling uniformly across the chunk
 * square and discarding samples that fall outside the field, which gives an
 * even density and a correctly circular boundary without any per-chunk math.
 */
function buildChunk(centerX: number, centerZ: number): Chunk | null {
  const dummy = new THREE.Object3D();
  const base = new THREE.Color(BASE_COLOR);
  const tip = new THREE.Color(TIP_COLOR);
  const color = new THREE.Color();
  const matrices: number[] = [];
  const colors: number[] = [];
  const phases: number[] = [];

  const samples = Math.round(FIELD_DENSITY * CHUNK_SIZE * CHUNK_SIZE);
  const skirtKeep = SKIRT_DENSITY / FIELD_DENSITY;

  for (let i = 0; i < samples; i++) {
    const x = centerX + (Math.random() - 0.5) * CHUNK_SIZE;
    const z = centerZ + (Math.random() - 0.5) * CHUNK_SIZE;
    const r = Math.hypot(x, z);

    let scale: number;
    if (r < FIELD_RADIUS) {
      scale = 0.6 + Math.random() * 0.85;
    } else if (r < SKIRT_RADIUS && Math.random() < skirtKeep) {
      scale = 1.3 + Math.random() * 1.1;
    } else {
      continue;
    }

    dummy.position.set(x, 0, z);
    dummy.scale.setScalar(scale);
    // Yaw jitter only, and only a little: the clump geometry bakes in a shared
    // lean so the whole field reads as blown one way, and a full random spin
    // would average that direction out to nothing.
    dummy.rotation.set(0, (Math.random() - 0.5) * 0.9, 0);
    dummy.updateMatrix();
    for (let e = 0; e < 16; e++) matrices.push(dummy.matrix.elements[e]);

    phases.push(Math.random() * Math.PI * 2);
    color.copy(base).lerp(tip, Math.random() * 0.55);
    colors.push(color.r, color.g, color.b);
  }

  if (phases.length === 0) return null;
  return {
    key: `${centerX},${centerZ}`,
    matrices: new Float32Array(matrices),
    colors: new Float32Array(colors),
    phases: new Float32Array(phases),
    count: phases.length,
  };
}

function buildChunks(): Chunk[] {
  const chunks: Chunk[] = [];
  const half = CHUNK_SIZE / 2;
  const span = Math.ceil(SKIRT_RADIUS / CHUNK_SIZE);

  for (let ix = -span; ix <= span; ix++) {
    for (let iz = -span; iz <= span; iz++) {
      const centerX = ix * CHUNK_SIZE;
      const centerZ = iz * CHUNK_SIZE;
      // Skip chunks whose nearest corner is already outside the meadow rather
      // than paying for thousands of samples that would all be discarded.
      const nearestX = Math.max(0, Math.abs(centerX) - half);
      const nearestZ = Math.max(0, Math.abs(centerZ) - half);
      if (Math.hypot(nearestX, nearestZ) > SKIRT_RADIUS) continue;

      const chunk = buildChunk(centerX, centerZ);
      if (chunk) chunks.push(chunk);
    }
  }
  return chunks;
}

function GrassChunk({ chunk, material }: { chunk: Chunk; material: THREE.Material }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  // Every chunk needs its own geometry, because `instancePhase` is an instanced
  // attribute and instanced attributes live on the geometry — a shared one
  // would end up holding whichever chunk wrote to it last. Rebuilding it also
  // varies the blade layout from chunk to chunk for free.
  const geometry = useMemo(() => buildClumpGeometry(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.instanceMatrix.set(chunk.matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(chunk.colors, 3);
    mesh.instanceColor.needsUpdate = true;
    geometry.setAttribute("instancePhase", new THREE.InstancedBufferAttribute(chunk.phases, 1));

    mesh.computeBoundingSphere();
    // Padded because the bounding sphere is derived from the instance matrices
    // alone, which know nothing about how far the shader's wind sway and
    // player-parting bend push the blades sideways.
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 2;
  }, [chunk, geometry]);

  return <instancedMesh ref={meshRef} args={[geometry, material, chunk.count]} />;
}

/**
 * Tall grass covering the whole meadow, spawn included: instanced clumps with
 * GPU-side wind sway and a bend-away-from-player effect (see utils/toon.ts) so
 * it visibly parts as the character walks through.
 */
export function Grass({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const chunks = useMemo(() => buildChunks(), []);
  // Rim light is disabled here: it's a Fresnel term meant for silhouette edges
  // on solid volumetric shapes, but grass blades are thin, mostly double-sided
  // cards — from most camera angles a large fraction of the blades are near
  // edge-on, so the "edge glow" saturates across nearly the whole field
  // instead of just outlines, washing the green out toward a flat warm tan
  // (this is what was reported as "yellow grass").
  const material = useMemo(() => createGrassMaterial(BASE_COLOR, { rim: false }), []);

  useFrame((state) => {
    const shader = material.userData.shader as
      | { uniforms: { uTime: { value: number }; uPlayerPos: { value: THREE.Vector3 } } }
      | undefined;
    if (shader) {
      shader.uniforms.uTime.value = state.clock.elapsedTime;
      shader.uniforms.uPlayerPos.value.copy(playerPosRef.current);
    }
  });

  return (
    <>
      {chunks.map((chunk) => (
        <GrassChunk key={chunk.key} chunk={chunk} material={material} />
      ))}
    </>
  );
}
