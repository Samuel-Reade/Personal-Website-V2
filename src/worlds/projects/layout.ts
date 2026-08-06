import * as THREE from "three";

/**
 * Layout for the archipelago. The player spawns in open water at the origin and
 * rows outward; the islands ring that spawn point at varying bearings and
 * distances so the sea reads as scattered rather than as a evenly-spaced dial.
 */

/** How far from the origin the boat may travel before an invisible boundary holds it. */
export const SEA_RADIUS = 62;
/** Extent of the rendered water plane. Comfortably past FOG_FAR so its own edge is never visible. */
export const SEA_SIZE = 280;
/** Collision radius of the boat's hull. */
export const BOAT_RADIUS = 1.15;

/**
 * Fog start/end. FOG_NEAR sits outside the island ring so nothing the player can
 * sail up to is ever hazed, and FOG_FAR dissolves the sea into the horizon well
 * inside the water plane's own rim.
 */
export const FOG_NEAR = 46;
export const FOG_FAR = 140;

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
    distance: 26,
    radius: 7.4,
    height: 2.1,
    seed: 11,
  },
  {
    id: "barchart",
    project: "ASA DataFest 2025",
    label: "ASA DataFest 2025",
    angle: 1.44,
    distance: 34,
    radius: 6.8,
    height: 1.9,
    seed: 27,
  },
  {
    id: "phone",
    project: "A Case Study of COVID-19 Social Media Posts",
    label: "COVID-19 Misinformation",
    angle: 2.48,
    distance: 24,
    radius: 6.4,
    height: 2.0,
    seed: 43,
  },
  {
    id: "bench",
    project: "How Exercise Affects Cortisol Experiment",
    label: "Exercise & Cortisol",
    angle: 3.52,
    distance: 35,
    radius: 6.9,
    height: 1.8,
    seed: 59,
  },
  {
    id: "television",
    project: "Predicting Success of Netflix Movies",
    label: "Netflix Movie Success",
    angle: 4.56,
    distance: 25,
    radius: 7.0,
    height: 2.1,
    seed: 71,
  },
  {
    id: "ballot",
    project: "Voting Project",
    label: "Voting Project",
    angle: 5.6,
    distance: 33,
    radius: 6.6,
    height: 1.95,
    seed: 89,
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
