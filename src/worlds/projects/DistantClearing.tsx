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

/**
 * Where it stands: on the empty bearing between the factory and ballot islands.
 *
 * Exported, with the three constants under it, because the associations world
 * draws the archipelago in *its* sky by inverting exactly this transform — see
 * `associations/DistantArchipelago`. The four numbers here are the whole of
 * what the two worlds agree about each other's position and size, so they are
 * stated once and read from both sides rather than restated over there.
 */
export const BEARING = -0.14;
/**
 * Nearly three times as far as the bay's own fog can see. The sea's haze
 * finishes at 145 so the archipelago's islands dissolve properly — but this
 * landmass is meant to stand *beyond* that, the way a real coast shows through
 * its own hundred kilometres of air. So it runs on its own fog curve (below)
 * instead of the scene's, in the scene's own fog colour so day and night still
 * tint it: the sea fades out at 145, and the island stands in the haze past it.
 *
 * Moved out from 310. At that range the range spanned about half the view and
 * read as the far side of a lake rather than as a coast across a sea; it also
 * put its near shore inside the water plane's own 150-unit reach, so the
 * shoreline arrived over water instead of out of the haze. Out here the whole
 * island stands past the water's rim, ~277 to ~563 from the middle of the bay.
 *
 * That far figure is the number the sky is sized off: `SeaLighting` puts its
 * stars, its bodies and its horizon dome outside it, and `ProjectsWorld`'s far
 * plane outside those. Move this and those four have to move with it, or the
 * night sky ends up drawn *inside* the mountains.
 */
export const DISTANCE = 420;
/**
 * Two-fifths of true size: ~56-unit summits over a ~280-unit footprint. At
 * this range that is a skyline that towers over every island in the bay while
 * its shores stay a strait away from any of them.
 */
export const SCALE = 0.42;
/**
 * The island's private haze: a four-hundred-unit curve, where the scene's own
 * closes in ninety. The near shore arrives already half-dissolved, the summits
 * are mostly silhouette, and the far slopes never resolve at all — an island
 * bigger than the eye can finish.
 *
 * The curve starts 110 out rather than at the camera because that is how far
 * the island moved: shifting both ends with it lands every point of the range
 * at exactly the dissolution it had at 310 (the summits at 0.87, the near
 * shore at 0.38), so the move reads as distance rather than as weather. There
 * is nothing of this island nearer than 277 for the first 110 units to have
 * applied to anyway.
 */
const FOG_NEAR = 110;
const FOG_FAR = 510;
/**
 * Turned so the clearing's east coast — its one true shoreline — faces the
 * archipelago, with the tall western range rising behind it as the skyline.
 */
export const ROTATION_Y = -1.35;

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
/**
 * Cells wholly below the waterline are skipped. Tighter than a seabed cutoff:
 * the island stands past the water plane's own reach, so there is no sea out
 * there to hide a submerged skirt behind — the shore has to end at the shore.
 */
const SKIP_BELOW = -1;

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
  const material = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    // The private fog curve: the stock linear-fog line with this island's own
    // near/far in place of the scene's. `fogColor` stays the scene uniform,
    // which is how SeaLighting's day/night tint keeps reaching it.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <fog_fragment>",
        `#ifdef USE_FOG
          float islandFog = smoothstep(float(${FOG_NEAR}), float(${FOG_FAR}), vFogDepth);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, islandFog);
        #endif`
      );
    };
    mat.customProgramCacheKey = () => "distant-clearing-fog";
    return mat;
  }, []);

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
