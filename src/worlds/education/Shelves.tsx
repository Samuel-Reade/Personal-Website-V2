import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BOOK_COLORS, flatMaterial, PALETTE } from "./materials";
import { HALL_MAX_X, HALL_MIN_X, WALL_THICKNESS, WINDOW_Z } from "./layout";

const UNIT_WIDTH = 4.6;
const UNIT_DEPTH = 0.75;
const UNIT_HEIGHT = 3.5;
const SHELF_LEVELS = 3;
const SPINE_HEIGHT = 0.68;

/** Deterministic 0..1 hash, so shelves look randomly packed but never reshuffle between renders. */
function hash(n: number): number {
  return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
}

interface Spine {
  matrix: THREE.Matrix4;
  color: THREE.Color;
}

/**
 * Every book spine in the hall's wall shelving, as one InstancedMesh. There are
 * around a thousand of them and they never move, so one instanced draw is the
 * whole cost — the alternative (a mesh per spine) would put a four-figure object
 * count into the render list for pure background dressing.
 */
function buildSpines(): Spine[] {
  const spines: Spine[] = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const units = [
    { x: HALL_MIN_X + WALL_THICKNESS + UNIT_DEPTH / 2, rotationY: Math.PI / 2 },
    { x: HALL_MAX_X - WALL_THICKNESS - UNIT_DEPTH / 2, rotationY: -Math.PI / 2 },
  ];

  let seed = 0;
  for (const unit of units) {
    for (const z of WINDOW_Z) {
      for (let level = 0; level < SHELF_LEVELS; level++) {
        const shelfY = 0.35 + level * ((UNIT_HEIGHT - 0.5) / SHELF_LEVELS);
        let cursor = -UNIT_WIDTH / 2 + 0.2;

        while (cursor < UNIT_WIDTH / 2 - 0.2) {
          seed += 1;
          const thickness = 0.1 + hash(seed) * 0.16;
          const height = SPINE_HEIGHT * (0.82 + hash(seed + 0.5) * 0.18);
          if (cursor + thickness > UNIT_WIDTH / 2 - 0.2) break;

          // Local offsets along the shelf, then rotated onto whichever wall this
          // unit sits against.
          const localX = cursor + thickness / 2;
          const sin = Math.sin(unit.rotationY);
          const cos = Math.cos(unit.rotationY);

          dummy.position.set(unit.x + localX * cos, shelfY + height / 2, z - localX * sin);
          dummy.rotation.set(0, unit.rotationY, (hash(seed + 1.5) - 0.5) * 0.12);
          dummy.scale.set(thickness, height, UNIT_DEPTH * 0.72);
          dummy.updateMatrix();

          color.set(BOOK_COLORS[Math.floor(hash(seed + 2.5) * BOOK_COLORS.length)]);
          spines.push({ matrix: dummy.matrix.clone(), color: color.clone() });

          cursor += thickness + 0.015;
        }
      }
    }
  }
  return spines;
}

/** Wall bookcases under the windows, packed with instanced spines. */
export function Shelves() {
  const caseMaterial = useMemo(() => flatMaterial(PALETTE.shelf), []);
  const spineMaterial = useMemo(() => flatMaterial("#ffffff"), []);
  const spines = useMemo(() => buildSpines(), []);
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const colors = new Float32Array(spines.length * 3);
    spines.forEach((spine, i) => {
      mesh.setMatrixAt(i, spine.matrix);
      colors[i * 3] = spine.color.r;
      colors[i * 3 + 1] = spine.color.g;
      colors[i * 3 + 2] = spine.color.b;
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spines]);

  const units = [
    { x: HALL_MIN_X + WALL_THICKNESS + UNIT_DEPTH / 2, rotationY: Math.PI / 2 },
    { x: HALL_MAX_X - WALL_THICKNESS - UNIT_DEPTH / 2, rotationY: -Math.PI / 2 },
  ];

  return (
    <group>
      {units.map((unit, unitIndex) =>
        WINDOW_Z.map((z) => (
          <group key={`${unitIndex}-${z}`} position={[unit.x, 0, z]} rotation={[0, unit.rotationY, 0]}>
            {Array.from({ length: SHELF_LEVELS + 1 }, (_, level) => (
              <mesh
                key={level}
                material={caseMaterial}
                position={[0, 0.3 + level * ((UNIT_HEIGHT - 0.5) / SHELF_LEVELS), 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[UNIT_WIDTH, 0.1, UNIT_DEPTH]} />
              </mesh>
            ))}
            {[-UNIT_WIDTH / 2, UNIT_WIDTH / 2].map((x) => (
              <mesh key={x} material={caseMaterial} position={[x, UNIT_HEIGHT / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.16, UNIT_HEIGHT, UNIT_DEPTH]} />
              </mesh>
            ))}
          </group>
        ))
      )}

      <instancedMesh ref={meshRef} args={[undefined, undefined, spines.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={spineMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}
