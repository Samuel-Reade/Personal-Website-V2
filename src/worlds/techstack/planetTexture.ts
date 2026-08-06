import * as THREE from "three";

/**
 * The main planet's surface, drawn to a canvas.
 *
 * A canvas rather than modelled landmasses: the planet is a 6-unit sphere the
 * player orbits at close range, and getting continents onto it as geometry would
 * mean either a displaced high-poly sphere or dozens of patch meshes, both of
 * which cost far more than a 1024x512 texture that the toon material can take as
 * its `map` — the same seam the office's monitor uses for its screen.
 *
 * Deterministic rather than `Math.random()`: the planet should look the same on
 * every visit, and a texture that reshuffles on each mount reads as a different
 * world each time you come back through the portal.
 */

const WIDTH = 1024;
/** 2:1, the aspect an equirectangular sphere map needs to wrap without stretch. */
const HEIGHT = 512;

/** Royal blue ocean, with a lighter band toward the equator. */
const OCEAN_DEEP = "#1e3a8a";
const OCEAN_MID = "#2b56c8";
const OCEAN_LIGHT = "#4b82e8";
/** Landmasses — kept close to the ocean in value so the toon ramp still bands cleanly. */
const LAND = "#6ba3d6";
const LAND_HIGH = "#9ec9ea";
const ICE = "#eaf4ff";

/** Deterministic pseudo-random in [0, 1), matching the archipelago's `seeded`. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A blobby landmass: an irregular closed curve around a centre, built from a
 * ring of radii jittered by the seed. Cheaper and more organic-looking than
 * unioning circles, and it closes cleanly so the fill never leaks.
 */
function blob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  wobble = 0.45
): void {
  const steps = 22;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    // Two octaves of jitter: the low one gives the overall shape, the high one
    // roughens the coastline.
    const r =
      radius *
      (1 +
        (seeded(seed + i * 0.7) - 0.5) * wobble +
        (seeded(seed * 3.1 + i * 2.3) - 0.5) * wobble * 0.4);
    const x = cx + Math.cos(angle) * r * 1.35;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

let cached: THREE.CanvasTexture | null = null;

export function getPlanetTexture(): THREE.CanvasTexture {
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Ocean: banded vertically so the poles read cooler and deeper than the
  // equator, which is most of what makes a flat blue ball look lit.
  const ocean = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  ocean.addColorStop(0, OCEAN_DEEP);
  ocean.addColorStop(0.32, OCEAN_MID);
  ocean.addColorStop(0.5, OCEAN_LIGHT);
  ocean.addColorStop(0.68, OCEAN_MID);
  ocean.addColorStop(1, OCEAN_DEEP);
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Landmasses, kept off the poles where the equirectangular projection smears
  // anything into a pinwheel.
  ctx.fillStyle = LAND;
  const continents: [number, number, number][] = [
    [0.14, 0.36, 74],
    [0.3, 0.62, 58],
    [0.48, 0.3, 66],
    [0.62, 0.58, 82],
    [0.8, 0.4, 54],
    [0.92, 0.66, 46],
  ];
  continents.forEach(([fx, fy, r], i) => {
    blob(ctx, fx * WIDTH, fy * HEIGHT, r, i * 17.3);
    // A few outlying islands trailing each continent.
    for (let j = 0; j < 3; j++) {
      const ox = (seeded(i * 5.1 + j) - 0.5) * r * 4;
      const oy = (seeded(i * 7.7 + j * 2.2) - 0.5) * r * 2.2;
      blob(ctx, fx * WIDTH + ox, fy * HEIGHT + oy, r * 0.24, i * 31.7 + j * 3.3, 0.6);
    }
  });

  // Highlands: a smaller, paler blob inside each continent, so the land isn't
  // one flat tone.
  ctx.fillStyle = LAND_HIGH;
  continents.forEach(([fx, fy, r], i) => {
    blob(ctx, fx * WIDTH + r * 0.3, fy * HEIGHT - r * 0.15, r * 0.42, i * 23.9 + 4.4, 0.55);
  });

  // Polar caps. Drawn as plain bands with a soft inner edge — at the top and
  // bottom of an equirectangular map these wrap to the poles correctly.
  const cap = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.12);
  cap.addColorStop(0, ICE);
  cap.addColorStop(1, "rgba(234,244,255,0)");
  ctx.fillStyle = cap;
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.12);

  const capSouth = ctx.createLinearGradient(0, HEIGHT, 0, HEIGHT * 0.88);
  capSouth.addColorStop(0, ICE);
  capSouth.addColorStop(1, "rgba(234,244,255,0)");
  ctx.fillStyle = capSouth;
  ctx.fillRect(0, HEIGHT * 0.88, WIDTH, HEIGHT * 0.12);

  cached = new THREE.CanvasTexture(canvas);
  cached.colorSpace = THREE.SRGBColorSpace;
  // The map wraps all the way round, so the seam has to tile horizontally.
  cached.wrapS = THREE.RepeatWrapping;
  return cached;
}

export function disposePlanetTexture(): void {
  cached?.dispose();
  cached = null;
}
