import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BOOK_COLORS, flatMaterial, PALETTE } from "./materials";
import {
  CONTENT_TABLE_KEYS,
  PEDESTAL_HEIGHT,
  TABLE_DEPTH,
  TABLE_HEIGHT,
  TABLE_SURFACE_Y,
  TABLE_WIDTH,
  TABLES,
  type TableSpot,
} from "./layout";

/** Deterministic 0..1 hash — the piles must look scattered but stay put across renders. */
function hash(n: number): number {
  return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
}

interface BookInstance {
  matrix: THREE.Matrix4;
  color: THREE.Color;
}

/**
 * One stack of ordinary books at a point on a table.
 *
 * Each book gets its own footprint, a small XZ offset and a yaw jitter that
 * accumulates up the stack, so a pile leans and splays instead of reading as one
 * extruded block. `fixedHeight` is used for the pedestal under a content book:
 * that stack has to finish at an exact height for the floating book to sit on it
 * convincingly, so its thicknesses are uniform rather than random.
 */
function buildPile(
  out: BookInstance[],
  dummy: THREE.Object3D,
  color: THREE.Color,
  worldX: number,
  worldZ: number,
  seed: number,
  options: { fixedHeight?: number } = {}
): void {
  const count = options.fixedHeight
    ? 3
    : 2 + Math.floor(hash(seed) * 5);
  const thickness = options.fixedHeight ? options.fixedHeight / 3 : 0;

  let y = TABLE_SURFACE_Y;
  for (let i = 0; i < count; i++) {
    const s = seed + i * 3.7;
    const height = options.fixedHeight ? thickness : 0.07 + hash(s) * 0.09;
    const width = 0.52 + hash(s + 0.3) * 0.3;
    const depth = 0.38 + hash(s + 0.6) * 0.2;

    // Drift grows with height so the top of a tall pile sits noticeably off
    // centre — a perfectly aligned stack reads as machine-placed.
    const drift = (i / Math.max(count - 1, 1)) * 0.12;
    dummy.position.set(
      worldX + (hash(s + 0.9) - 0.5) * drift,
      y + height / 2,
      worldZ + (hash(s + 1.2) - 0.5) * drift
    );
    dummy.rotation.set(0, (hash(s + 1.5) - 0.5) * (options.fixedHeight ? 0.25 : 0.9), 0);
    dummy.scale.set(width, height, depth);
    dummy.updateMatrix();

    color.set(BOOK_COLORS[Math.floor(hash(s + 2.1) * BOOK_COLORS.length)]);
    out.push({ matrix: dummy.matrix.clone(), color: color.clone() });

    y += height;
  }
}

/**
 * Every static book on every table. Content tables get a deliberately sparse
 * layout — one exact-height pedestal at the centre for the floating book to lift
 * out of, and piles pushed to the ends — so the interactive book is never lost
 * in clutter. Background tables are packed at random.
 */
function buildTableBooks(): BookInstance[] {
  const books: BookInstance[] = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (const table of TABLES) {
    const [x, z] = table.position;
    const isContent = CONTENT_TABLE_KEYS.has(table.key);

    if (isContent) {
      buildPile(books, dummy, color, x, z, table.seed, { fixedHeight: PEDESTAL_HEIGHT });
      for (const end of [-1, 1]) {
        buildPile(books, dummy, color, x + (hash(table.seed + end) - 0.5) * 1.2, z + end * 2.3, table.seed + end * 11);
      }
    } else {
      const pileCount = 3 + Math.floor(hash(table.seed) * 3);
      for (let p = 0; p < pileCount; p++) {
        const s = table.seed + p * 17.3;
        buildPile(
          books,
          dummy,
          color,
          x + (hash(s) - 0.5) * (TABLE_WIDTH - 1.1),
          z + (hash(s + 0.4) - 0.5) * (TABLE_DEPTH - 1.1),
          s
        );
      }
    }
  }
  return books;
}

function Table({ table }: { table: TableSpot }) {
  const topMaterial = useMemo(() => flatMaterial(PALETTE.tableTop), []);
  const legMaterial = useMemo(() => flatMaterial(PALETTE.tableLeg), []);
  const [x, z] = table.position;
  // Chairs tuck against the aisle-facing edge, so they read from the walkway.
  const chairSide = x < 0 ? 1 : -1;

  return (
    <group position={[x, 0, z]}>
      <mesh material={topMaterial} position={[0, TABLE_HEIGHT, 0]} castShadow receiveShadow>
        <boxGeometry args={[TABLE_WIDTH, 0.12, TABLE_DEPTH]} />
      </mesh>
      <mesh material={legMaterial} position={[0, TABLE_HEIGHT - 0.16, 0]} castShadow>
        <boxGeometry args={[TABLE_WIDTH - 0.5, 0.2, TABLE_DEPTH - 0.5]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            material={legMaterial}
            position={[sx * (TABLE_WIDTH / 2 - 0.28), (TABLE_HEIGHT - 0.26) / 2, sz * (TABLE_DEPTH / 2 - 0.35)]}
            castShadow
          >
            <boxGeometry args={[0.24, TABLE_HEIGHT - 0.26, 0.24]} />
          </mesh>
        ))
      )}

      {[-1.7, 1.7].map((cz) => (
        <group key={cz} position={[chairSide * 1.45, 0, cz]} rotation={[0, chairSide * -Math.PI / 2, 0]}>
          <mesh material={legMaterial} position={[0, 0.62, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.1, 0.85]} />
          </mesh>
          <mesh material={legMaterial} position={[0, 1.05, -0.38]} castShadow>
            <boxGeometry args={[0.9, 0.85, 0.1]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} material={legMaterial} position={[sx * 0.4, 0.3, 0]} castShadow>
              <boxGeometry args={[0.1, 0.6, 0.8]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** The table rows flanking the aisle, plus every static book piled on them. */
export function Tables() {
  const books = useMemo(() => buildTableBooks(), []);
  const bookMaterial = useMemo(() => flatMaterial("#ffffff"), []);
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const colors = new Float32Array(books.length * 3);
    books.forEach((book, i) => {
      mesh.setMatrixAt(i, book.matrix);
      colors[i * 3] = book.color.r;
      colors[i * 3 + 1] = book.color.g;
      colors[i * 3 + 2] = book.color.b;
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [books]);

  return (
    <group>
      {TABLES.map((table) => (
        <Table key={table.key} table={table} />
      ))}
      <instancedMesh ref={meshRef} args={[undefined, undefined, books.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={bookMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}
