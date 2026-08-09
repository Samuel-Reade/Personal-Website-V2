import type { AssociationId } from "./layout";

/**
 * The land under the associations world: a mountain range running down to a
 * coast, seen from the air.
 *
 * Everything that needs to know where the ground is reads `terrainHeight` — the
 * mesh that draws it, the balloons staked to the summits, the forest scattered
 * across the slopes, and the streams that trace their way down it. One function
 * rather than a mesh queried by raycast, because three of those four need the
 * answer at build time and a raycast needs geometry that does not exist yet.
 */

/** Sea level. The ocean plane sits here and anything below it is underwater. */
export const SEA_LEVEL = 0;
/** How far the land reaches in each direction from the origin. */
export const TERRAIN_EXTENT = 380;
/** East of this line the land gives way to water, across a shore band either side. */
export const COAST_X = 150;
export const SHORE_WIDTH = 52;
/** How deep the sea floor drops offshore, so the water has a bed rather than a void. */
export const SEA_DEPTH = 26;
/** Beach: land standing between sea level and this. */
export const BEACH_TOP = 3.4;

export interface Peak {
  x: number;
  z: number;
  /** Summit height above sea level. */
  height: number;
  /** How far its influence reaches. */
  radius: number;
}

/**
 * The four summits the balloons are staked to.
 *
 * These are peaks like any other as far as the height function is concerned —
 * which is the point. Placing a balloon's anchor at a summit only works if the
 * terrain genuinely rises to meet it, so the anchor and the mountain are the
 * same number rather than two that have to be kept in agreement.
 *
 * Their bearings and distances are the ones the clearing's balloons already
 * stood on, so the ring the player flies is unchanged; only the ground beneath
 * it dropped away. Kept low relative to the scenery peaks further out, because
 * the helicopter's floor has to clear the tallest of them and a very tall host
 * would push the whole flight band up away from the range it is meant to
 * overlook.
 */
export const HOST_PEAKS: Record<AssociationId, Peak> = {
  "ucla-rugby": { x: Math.sin(-0.5) * 15, z: -Math.cos(-0.5) * 15, height: 58, radius: 30 },
  "olympic-rugby": { x: Math.sin(0.85) * 20, z: -Math.cos(0.85) * 20, height: 52, radius: 27 },
  "lambda-chi": { x: Math.sin(2.5) * 16.5, z: -Math.cos(2.5) * 16.5, height: 66, radius: 32 },
  "stats-club": { x: Math.sin(4.15) * 19, z: -Math.cos(4.15) * 19, height: 55, radius: 28 },
};

/**
 * The rest of the range.
 *
 * Deliberately taller than the hosts and all of them well outside the flight
 * boundary, so the horizon has real mountains in it without any of them standing
 * where the helicopter can fly. The ones nearest the coast are lower, which is
 * what makes the range read as running down to the sea rather than as being
 * sliced off at the shoreline.
 */
export const SCENERY_PEAKS: Peak[] = [
  { x: -96, z: -88, height: 118, radius: 74 },
  { x: -34, z: -132, height: 104, radius: 62 },
  { x: 46, z: -148, height: 92, radius: 58 },
  { x: -148, z: -18, height: 126, radius: 80 },
  { x: -118, z: 74, height: 98, radius: 66 },
  { x: -48, z: 128, height: 86, radius: 60 },
  { x: 38, z: 142, height: 74, radius: 54 },
  { x: -196, z: -110, height: 134, radius: 88 },
  { x: -212, z: 62, height: 112, radius: 76 },
  { x: 96, z: -78, height: 62, radius: 48 },
  { x: 88, z: 66, height: 54, radius: 44 },
  { x: -6, z: -206, height: 96, radius: 70 },
  { x: -122, z: -196, height: 108, radius: 72 },
  { x: 132, z: -158, height: 58, radius: 50 },
];

/** Smooth 0→1, the same shape three.js's smoothstep uses. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * A peak's contribution: full height at the summit, easing to nothing at its
 * radius. Squared falloff rather than linear, which is the difference between a
 * mountain and a tent.
 */
function peakAt(peak: Peak, x: number, z: number): number {
  const d = Math.hypot(x - peak.x, z - peak.z);
  if (d >= peak.radius) return 0;
  const t = 1 - d / peak.radius;
  return peak.height * t * t * (3 - 2 * t) * 0.5 + peak.height * t * t * 0.5;
}

/**
 * Ridging laid over the peaks, at three scales.
 *
 * Products of sines rather than real noise: it is deterministic without a seed
 * table, it is cheap enough to call a hundred thousand times while building the
 * mesh, and at these frequencies the regularity it would show on a flat plain is
 * entirely hidden by the peaks it is riding on.
 */
function ridges(x: number, z: number): number {
  return (
    7.5 * Math.sin(x * 0.0165) * Math.cos(z * 0.0142) +
    3.8 * Math.sin(x * 0.0362 + 1.3) * Math.cos(z * 0.0331 - 0.7) +
    1.6 * Math.sin(x * 0.0784 - 2.1) * Math.cos(z * 0.0712 + 0.4) +
    // A fourth, finer octave. Below the mesh's own resolution it would only
    // alias, so it is pitched at roughly two cells per wave — which is where it
    // stops being height and starts being surface.
    0.7 * Math.sin(x * 0.163 + 0.9) * Math.cos(z * 0.148 - 1.6)
  );
}

/**
 * Sharpens the low ground into valleys.
 *
 * Sums of smooth peaks give smooth basins between them, and a real range does
 * not have those — water cuts them. Folding the height toward a V below the
 * ridge tops costs one multiply and does most of what an erosion pass would,
 * which is to make the low ground read as carved rather than as the gap left
 * over between two hills.
 */
function carve(height: number): number {
  const VALLEY_TOP = 34;
  if (height >= VALLEY_TOP || height <= SEA_LEVEL) return height;
  const t = height / VALLEY_TOP;
  return VALLEY_TOP * t * t;
}

/**
 * How much land there is at a point: 1 well inland, 0 well out to sea, easing
 * across the shore band. Everything above sea level is multiplied by it, so the
 * range doesn't march into the water — it subsides into it.
 */
export function landMask(x: number): number {
  return 1 - smoothstep(COAST_X - SHORE_WIDTH, COAST_X + SHORE_WIDTH, x);
}

/** Height of the ground at a point, above or below sea level. */
export function terrainHeight(x: number, z: number): number {
  const mask = landMask(x);

  let height = 0;
  for (const id in HOST_PEAKS) height += peakAt(HOST_PEAKS[id as AssociationId], x, z);
  for (const peak of SCENERY_PEAKS) height += peakAt(peak, x, z);

  // A shallow inland rise, so the low ground between peaks is a valley floor
  // rather than a plain at exactly sea level.
  height += 14 * mask;
  height += ridges(x, z) * mask;
  height = carve(height);

  // Offshore the bed falls away. Multiplying rather than switching keeps the
  // shoreline continuous — there is no step anywhere along it.
  return height * mask - SEA_DEPTH * (1 - mask);
}

/** Steepness at a point, 0 flat to 1 cliff. Sampled rather than differentiated, which needs no calculus and no second function to keep in step. */
export function terrainSlope(x: number, z: number, sample = 4): number {
  const h = terrainHeight(x, z);
  const dx = terrainHeight(x + sample, z) - h;
  const dz = terrainHeight(x, z + sample) - h;
  return Math.min(1, Math.hypot(dx, dz) / sample);
}

/** Downhill direction at a point, normalised. Used to trace the streams. */
export function downhill(x: number, z: number, sample = 6): [number, number] {
  const h = terrainHeight(x, z);
  const dx = terrainHeight(x + sample, z) - h;
  const dz = terrainHeight(x, z + sample) - h;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return [0, 0];
  return [-dx / length, -dz / length];
}

/**
 * The colour of the ground at a point.
 *
 * Banded by altitude, with slope overriding it: rock shows wherever the ground
 * is too steep to hold anything, which is what keeps the cliffs from being
 * grassy and gives the range its structure. Returned as a plain triple so the
 * mesh can write it straight into a vertex-colour buffer — one material for the
 * whole range, and no textures, as everywhere else on the site.
 */
export const TERRAIN_COLORS = {
  seabed: [0.19, 0.27, 0.33],
  shallow: [0.35, 0.48, 0.5],
  sand: [0.86, 0.79, 0.6],
  /** Lush at the valley floor, drying out as it climbs. */
  meadow: [0.36, 0.52, 0.26],
  grass: [0.42, 0.55, 0.3],
  grassHigh: [0.46, 0.5, 0.31],
  /** Loose stone above the treeline and below the snow. */
  scree: [0.52, 0.49, 0.44],
  rock: [0.44, 0.42, 0.4],
  rockDark: [0.31, 0.3, 0.3],
  snow: [0.94, 0.95, 0.97],
  snowShade: [0.78, 0.82, 0.88],
} as const;

/**
 * A wandering snow line.
 *
 * A single altitude cutoff draws a perfect contour ring around every peak,
 * which is the one thing that gives a procedural range away instantly. Moving
 * the threshold about with the same cheap trigonometry the height itself uses
 * breaks that ring into something that looks like it fell there.
 */
function snowLine(x: number, z: number): number {
  return 88 + 9 * Math.sin(x * 0.021 + 1.7) * Math.cos(z * 0.019 - 0.6);
}

export function terrainColor(
  height: number,
  slope: number,
  x = 0,
  z = 0
): readonly [number, number, number] {
  if (height < -8) return TERRAIN_COLORS.seabed;
  if (height < SEA_LEVEL) return TERRAIN_COLORS.shallow;
  if (height < BEACH_TOP) return TERRAIN_COLORS.sand;

  const snow = snowLine(x, z);
  // Above the line, only the shallower faces hold snow — the steep ones shed it,
  // which is what puts dark rock stripes down a white peak instead of icing it.
  if (height > snow) return slope > 0.62 ? TERRAIN_COLORS.rockDark : TERRAIN_COLORS.snow;
  if (height > snow - 9) return slope > 0.62 ? TERRAIN_COLORS.rock : TERRAIN_COLORS.snowShade;

  // Below it, steep ground sheds everything at any altitude.
  if (slope > 0.74) return TERRAIN_COLORS.rockDark;
  if (slope > 0.54) return TERRAIN_COLORS.rock;
  if (height > 66) return TERRAIN_COLORS.scree;
  if (height > 44) return TERRAIN_COLORS.grassHigh;
  if (height > 16) return TERRAIN_COLORS.grass;
  return TERRAIN_COLORS.meadow;
}
