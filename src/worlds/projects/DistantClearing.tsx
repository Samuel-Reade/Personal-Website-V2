import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { terrainColor, terrainHeight } from "../associations/terrain";

/**
 * The associations world's landmass, standing far across the bay.
 *
 * The third time the site reaches across worlds, and the same rule as the
 * other two: this is not a painting of that island, it is the island — the
 * same `terrainHeight` the clearing builds its range from, the same
 * `terrainColor` bands with their wandering snow line and canopy shade,
 * sampled coarser because it stands a hundred units off in the haze, and
 * scaled down the way a real coast shrinks a real mountain range.
 *
 * The one liberty is the shoreline: the clearing's field runs six hundred
 * units to every horizon because its player flies over it, and a mainland
 * cannot stand in a bay. A radial fade eases the outer reaches under the sea,
 * which closes the range into the big island the archipelago sees — the peaks
 * that make its skyline all stand inside the fade untouched.
 */

/** Where it stands: on the empty bearing between the factory and ballot islands. */
const BEARING = -0.14;
/**
 * Almost at the fog's far edge. The near islands sit fully lit at 31-43 and
 * the haze finishes at 145, so standing the landmass here keeps open water and
 * a deep band of fog between it and anything the boat can reach — which is
 * what makes it read as across the strait rather than as the next island over.
 */
const DISTANCE = 138;
/**
 * An eighth of true size. Taller relative to its footprint than the last cut:
 * a big island far off shows as high ground over a low shore, not as a long
 * flat strip, and the ratio is what carries that at this range.
 */
const SCALE = 0.12;
/**
 * Turned so the clearing's east coast — its one true shoreline — faces the
 * archipelago, with the tall western range rising behind it as the skyline.
 */
const ROTATION_Y = -1.35;

/** Cells across the sampled field. Coarser than the clearing's 256: it is far away. */
const CELLS = 96;
/**
 * Half-extent sampled, in the clearing's own units. Reaches the inner scenery
 * range but not the outer monsters — those exist to fill a flying player's
 * horizon, and keeping them here is what made the island sprawl toward the
 * archipelago instead of standing off across the strait.
 */
const EXTENT = 400;
/** The radial shoreline: land untouched inside, eased below the sea beyond. */
const SHORE_IN = 250;
const SHORE_OUT = 350;
/** What the fade eases the far field down to — comfortably under the waves. */
const FADE_FLOOR = -14;
/** Cells whose every corner sits at seabed are skipped; the bay's water hides them. */
const SKIP_BELOW = -10;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** The clearing's ground, closed into an island by the radial shoreline. */
function islandHeight(x: number, z: number): number {
  const t = smoothstep(SHORE_IN, SHORE_OUT, Math.hypot(x, z));
  return terrainHeight(x, z) * (1 - t) + FADE_FLOOR * t;
}

/** Rise over run on the islandised field — `terrainSlope`, pointed at the fade. */
function islandSlope(x: number, z: number, sample = 4): number {
  const h = islandHeight(x, z);
  const dx = islandHeight(x + sample, z) - h;
  const dz = islandHeight(x, z + sample) - h;
  return Math.hypot(dx, dz) / sample;
}

/** The clearing's per-face brightness jitter, hash and all — same ground, same grain. */
function faceJitter(x: number, z: number): number {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return 1 + (h - Math.floor(h) - 0.5) * 0.08;
}

/**
 * The clearing's own faceted heightfield build — shared corner samples, two
 * triangles a cell, one colour per face — minus the cells the sea will hide.
 */
function buildIsland(): THREE.BufferGeometry {
  const span = EXTENT * 2;
  const cell = span / CELLS;
  const positions: number[] = [];
  const colors: number[] = [];

  const heights: number[] = [];
  const slopes: number[] = [];
  for (let iz = 0; iz <= CELLS; iz++) {
    for (let ix = 0; ix <= CELLS; ix++) {
      const x = -EXTENT + ix * cell;
      const z = -EXTENT + iz * cell;
      heights.push(islandHeight(x, z));
      slopes.push(islandSlope(x, z));
    }
  }
  const at = (ix: number, iz: number) => iz * (CELLS + 1) + ix;

  for (let iz = 0; iz < CELLS; iz++) {
    for (let ix = 0; ix < CELLS; ix++) {
      const h00 = heights[at(ix, iz)];
      const h10 = heights[at(ix + 1, iz)];
      const h01 = heights[at(ix, iz + 1)];
      const h11 = heights[at(ix + 1, iz + 1)];
      if (h00 < SKIP_BELOW && h10 < SKIP_BELOW && h01 < SKIP_BELOW && h11 < SKIP_BELOW) continue;

      const x0 = -EXTENT + ix * cell;
      const z0 = -EXTENT + iz * cell;
      const x1 = x0 + cell;
      const z1 = z0 + cell;

      const tri = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number,
        slope: number
      ) => {
        positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        const mx = (ax + bx + cx) / 3;
        const mz = (az + bz + cz) / 3;
        const color = terrainColor((ay + by + cy) / 3, slope, mx, mz);
        const jitter = faceJitter(mx, mz);
        for (let i = 0; i < 3; i++)
          colors.push(color[0] * jitter, color[1] * jitter, color[2] * jitter);
      };

      const s = (slopes[at(ix, iz)] + slopes[at(ix + 1, iz + 1)]) / 2;
      tri(x0, h00, z0, x0, h01, z1, x1, h11, z1, s);
      tri(x0, h00, z0, x1, h11, z1, x1, h10, z0, s);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function DistantClearing() {
  const geometry = useMemo(() => buildIsland(), []);
  const material = useMemo(
    () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    []
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  return (
    <group
      position={[Math.sin(BEARING) * DISTANCE, 0, -Math.cos(BEARING) * DISTANCE]}
      rotation={[0, ROTATION_Y, 0]}
      scale={SCALE}
    >
      <mesh geometry={geometry} material={material} />
    </group>
  );
}
