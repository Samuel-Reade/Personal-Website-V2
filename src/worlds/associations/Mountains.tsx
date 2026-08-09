import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  SEA_DEPTH,
  TERRAIN_EXTENT,
  terrainColor,
  terrainHeight,
  terrainSlope,
} from "./terrain";

/**
 * The range itself: one heightfield, flat-shaded, coloured per face.
 *
 * Vertex colours rather than materials-per-band. Splitting the mesh by band
 * would mean a draw call per colour and a seam wherever two bands meet; a single
 * buffer with a colour written at every vertex gives the same banding in one
 * draw, and because the geometry is unindexed and flat-shaded, each triangle
 * takes the colour of its own corners rather than blending across the boundary.
 * That hard edge between rock and snow is the look, not an artefact.
 */

/**
 * Cells across the field.
 *
 * 156 over 760 units puts a vertex every five metres. Coarse enough that the
 * facets are still the surface — the same decision as the character's eight
 * segments per limb — and fine enough to carry the fourth octave of ridging,
 * which at 108 fell below the mesh's own resolution and simply aliased into
 * noise. It costs ~49k triangles, built once at mount.
 */
const CELLS = 156;

function buildRange(): THREE.BufferGeometry {
  const span = TERRAIN_EXTENT * 2;
  const cell = span / CELLS;
  const positions: number[] = [];
  const colors: number[] = [];

  /** Corner heights are shared between neighbouring cells, so sample once. */
  const heights: number[] = [];
  const slopes: number[] = [];
  for (let iz = 0; iz <= CELLS; iz++) {
    for (let ix = 0; ix <= CELLS; ix++) {
      const x = -TERRAIN_EXTENT + ix * cell;
      const z = -TERRAIN_EXTENT + iz * cell;
      heights.push(terrainHeight(x, z));
      slopes.push(terrainSlope(x, z, cell));
    }
  }
  const at = (ix: number, iz: number) => iz * (CELLS + 1) + ix;

  for (let iz = 0; iz < CELLS; iz++) {
    for (let ix = 0; ix < CELLS; ix++) {
      const x0 = -TERRAIN_EXTENT + ix * cell;
      const z0 = -TERRAIN_EXTENT + iz * cell;
      const x1 = x0 + cell;
      const z1 = z0 + cell;

      const h00 = heights[at(ix, iz)];
      const h10 = heights[at(ix + 1, iz)];
      const h01 = heights[at(ix, iz + 1)];
      const h11 = heights[at(ix + 1, iz + 1)];

      // Two triangles, each taking one colour from the mean of its own corners —
      // which is what makes a facet a facet rather than a smooth ramp.
      const tri = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number,
        slope: number
      ) => {
        positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        const color = terrainColor((ay + by + cy) / 3, slope, (ax + bx + cx) / 3, (az + bz + cz) / 3);
        for (let i = 0; i < 3; i++) colors.push(color[0], color[1], color[2]);
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

/**
 * A skirt dropped from the field's rim to below the sea floor.
 *
 * From the air the range is seen from above and outside, and without this its
 * edge reads as a cut sheet of paper hanging in the haze. It is a plain wall in
 * the darkest rock colour, and the fog swallows most of it.
 */
function buildRim(): THREE.BufferGeometry {
  const span = TERRAIN_EXTENT * 2;
  const cell = span / CELLS;
  const positions: number[] = [];
  const floor = -SEA_DEPTH - 40;

  const edge = (x: number, z: number) => terrainHeight(x, z);
  const wall = (ax: number, az: number, bx: number, bz: number) => {
    const ha = edge(ax, az);
    const hb = edge(bx, bz);
    positions.push(ax, ha, az, ax, floor, az, bx, hb, bz);
    positions.push(bx, hb, bz, ax, floor, az, bx, floor, bz);
  };

  for (let i = 0; i < CELLS; i++) {
    const a = -TERRAIN_EXTENT + i * cell;
    const b = a + cell;
    wall(a, -TERRAIN_EXTENT, b, -TERRAIN_EXTENT);
    wall(b, TERRAIN_EXTENT, a, TERRAIN_EXTENT);
    wall(-TERRAIN_EXTENT, b, -TERRAIN_EXTENT, a);
    wall(TERRAIN_EXTENT, a, TERRAIN_EXTENT, b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function Mountains() {
  const range = useMemo(() => buildRange(), []);
  const rim = useMemo(() => buildRim(), []);

  const surface = useMemo(
    () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    []
  );
  const rimMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: "#33322f", flatShading: true }),
    []
  );

  useEffect(
    () => () => {
      range.dispose();
      rim.dispose();
      surface.dispose();
      rimMaterial.dispose();
    },
    [range, rim, surface, rimMaterial]
  );

  return (
    <>
      <mesh geometry={range} material={surface} />
      <mesh geometry={rim} material={rimMaterial} />
    </>
  );
}
