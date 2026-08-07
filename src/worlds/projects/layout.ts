import * as THREE from "three";

/**
 * Layout for the archipelago. The player spawns in open water at the origin and
 * rows outward; the islands ring that spawn point at varying bearings and
 * distances so the sea reads as scattered rather than as a evenly-spaced dial.
 */

/** How far from the origin the boat may travel before an invisible boundary holds it. */
export const SEA_RADIUS = 62;
/**
 * Extent of the rendered water plane. The plane is recentred on the boat every
 * frame (see Water.tsx), so this is not the size of the sea — it is the radius
 * of water carried around with the player, and its only job is to reach past
 * FOG_FAR in every direction so the rim is always fully dissolved into haze.
 */
export const SEA_SIZE = 300;
/** Collision radius of the boat's hull. */
export const BOAT_RADIUS = 1.15;

/**
 * Fog start/end. FOG_FAR has to stay under the plane's half-extent (150) or the
 * water's own edge becomes a visible hard line against the sky — the reason the
 * plane follows the boat at all. FOG_NEAR is then set as far out as that allows,
 * so islands across the bay still read as islands rather than as grey smudges.
 */
export const FOG_NEAR = 55;
export const FOG_FAR = 145;

/** Spawn facing -Z, the same heading the meadow and the library spawn on. */
export const SPAWN_FACING = Math.PI;
export const SPAWN_POSITION = new THREE.Vector3(0, 0, 0);

export type CenterpieceId = "factory" | "barchart" | "phone" | "bench" | "television" | "ballot";

export interface IslandSpot {
  id: CenterpieceId;
  /**
   * Matches a PROJECTS entry's `name` exactly — this is the key the content
   * panel narrows on, so a typo here silently opens an empty panel.
   */
  project: string;
  /** Short name for the hover label; the full project titles are far too long to float over an island. */
  label: string;
  /** Center of the island in world XZ. */
  position: [number, number];
  /** Waterline radius. Doubles as the collision circle the boat is pushed out of. */
  radius: number;
  /** Height of the plateau the centerpiece stands on. */
  height: number;
  /** Decorrelates the jitter in this island's coastline from its neighbours'. */
  seed: number;
  /**
   * How much of the island is flat plateau, as a fraction of its radius. The
   * working islands — an airstrip, a film set, a gym floor — need most of their
   * area usable; the ones carrying a single object keep more slope.
   */
  plateauFraction: number;
  /** Turns the centerpiece to face roughly back toward spawn, so it is never seen edge-on first. */
  rotationY: number;
}

interface IslandPlacement {
  id: CenterpieceId;
  project: string;
  label: string;
  /** Bearing from spawn, 0 = straight ahead (-Z), increasing clockwise from above. */
  angle: number;
  distance: number;
  radius: number;
  height: number;
  seed: number;
  plateauFraction: number;
}

/**
 * Bearings are spread around the full circle but deliberately not at even
 * sixths, and distances alternate near/far, so no two islands line up behind
 * each other from spawn and the horizon never looks laid out on a grid.
 */
const PLACEMENTS: IslandPlacement[] = [
  {
    id: "factory",
    project: "Predicting Extreme Durability of Rolled-Formed Aluminum",
    label: "Rolled-Formed Aluminum Durability",
    angle: 0.38,
    distance: 34,
    // The largest island by a distance: it carries a works, a mountain range and
    // a runway long enough for the aircraft parked on it.
    radius: 14,
    height: 2.4,
    seed: 11,
    plateauFraction: 0.66,
  },
  {
    id: "barchart",
    project: "ASA DataFest 2025",
    label: "ASA DataFest 2025",
    angle: 1.46,
    distance: 41,
    // Grown from 9 to carry the chart, which is now a single row of four bars
    // nearly 10 wide rather than a compact grid. At a 0.6 plateau fraction and
    // the ±16% per-side jitter the coastline carries, 11 is what puts the whole
    // plinth on flat ground on every bearing. It still clears its neighbours by
    // a wide margin — the nearest, the factory island, is 39 away and the two
    // radii come to 26.
    radius: 11,
    height: 2.0,
    seed: 27,
    plateauFraction: 0.6,
  },
  {
    id: "phone",
    project: "A Case Study of COVID-19 Social Media Posts",
    label: "COVID-19 Misinformation",
    angle: 2.52,
    distance: 31,
    radius: 7.4,
    height: 2.1,
    seed: 43,
    plateauFraction: 0.5,
  },
  {
    id: "bench",
    project: "How Exercise Affects Cortisol Experiment",
    label: "Exercise & Cortisol",
    angle: 3.56,
    distance: 43,
    radius: 10.5,
    height: 1.9,
    seed: 59,
    plateauFraction: 0.66,
  },
  {
    id: "television",
    project: "Predicting Success of Netflix Movies",
    label: "Netflix Movie Success",
    angle: 4.6,
    distance: 33,
    radius: 10.5,
    height: 2.2,
    seed: 71,
    plateauFraction: 0.66,
  },
  {
    id: "ballot",
    project: "Voting Project",
    label: "Voting Project",
    angle: 5.62,
    distance: 39,
    radius: 7.6,
    height: 2.0,
    seed: 89,
    plateauFraction: 0.52,
  },
];

export const ISLANDS: IslandSpot[] = PLACEMENTS.map((p) => {
  // Same convention as the meadow's world.ts: angle 0 is straight ahead of
  // spawn (-Z), increasing clockwise viewed from above.
  const x = Math.sin(p.angle) * p.distance;
  const z = -Math.cos(p.angle) * p.distance;
  return {
    id: p.id,
    project: p.project,
    label: p.label,
    position: [x, z],
    radius: p.radius,
    height: p.height,
    seed: p.seed,
    plateauFraction: p.plateauFraction,
    rotationY: Math.atan2(-x, -z),
  };
});

/**
 * Replacement for `Player`'s default circular boundary + `OBSTACLES` pass, in
 * the same shape the library supplies: clamp to the sailable circle, then push
 * out of any island the hull has entered. Islands are round, so unlike the
 * library's rectangular tables a single radial push is the correct resolution
 * and sliding around a coastline falls out of it for free.
 */
export function resolveBoatMove(next: THREE.Vector3): void {
  const fromCenter = Math.hypot(next.x, next.z);
  const limit = SEA_RADIUS - BOAT_RADIUS;
  if (fromCenter > limit) {
    const scale = limit / fromCenter;
    next.x *= scale;
    next.z *= scale;
  }

  for (const island of ISLANDS) {
    const dx = next.x - island.position[0];
    const dz = next.z - island.position[1];
    const dist = Math.hypot(dx, dz);
    const minDist = island.radius + BOAT_RADIUS;
    if (dist < minDist && dist > 0.0001) {
      const push = minDist - dist;
      next.x += (dx / dist) * push;
      next.z += (dz / dist) * push;
    }
  }
}
