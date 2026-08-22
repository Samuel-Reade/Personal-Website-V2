import * as THREE from "three";

/**
 * Layout for the archipelago. The player spawns in open water at the origin and
 * rows outward; the islands ring that spawn point at one distance and equal
 * bearings, so every one of them is the same row away and no two crowd.
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

export type CenterpieceId =
  | "factory"
  | "barchart"
  | "phone"
  | "bench"
  | "television"
  | "ballot"
  | "ribbon";

export interface IslandSpot {
  id: CenterpieceId;
  /**
   * Matches a PROJECTS entry's `name` exactly — this is the key the content
   * panel narrows on, so a typo here silently opens an empty panel.
   *
   * It is also what the hover label and the interact prompt print. There used
   * to be a shorter `label` beside this for those two, on the grounds that the
   * full titles are long to float over an island; the cost was that an island
   * answered to one name out on the water and a different one the moment its
   * card opened, which reads as two things rather than one.
   */
  project: string;
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
  radius: number;
  height: number;
  seed: number;
  plateauFraction: number;
}

/**
 * Distance from spawn to every island's centre. At seven islands this leaves
 * 34.7 between neighbouring centres; the tightest pair by far is the works
 * (14 across the waterline) beside the chart (11), and even those two keep
 * nearly ten units of open water between their beaches. It also puts the
 * outermost shore at 54, inside SEA_RADIUS with enough water left to row
 * around the back of an island rather than into the boundary.
 */
const RING_DISTANCE = 40;
/** Bearing of the first island. The rest follow at equal steps around from it. */
const FIRST_BEARING = 0.38;

/**
 * One ring, evenly divided. No island carries a bearing of its own — each one
 * takes its index's share of the full circle, so adding this seventh spread
 * the other six apart instead of wedging it into whichever gap happened to be
 * widest, and an eighth would do the same again.
 *
 * The old layout set bearings by hand at uneven sixths with alternating
 * near/far distances, on the theory that a scatter reads as a bay and a ring
 * reads as a dial. What keeps it from reading as a dial now is the land rather
 * than the placement: coastlines are jittered per seed and the radii run from
 * 7.4 to 14, so no two islands are the same size or the same shape even at
 * matched spacing.
 */
const PLACEMENTS: IslandPlacement[] = [
  {
    id: "factory",
    project: "Predicting Extreme Durability of Rolled-Formed Aluminum",
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
    // Grown from 9 to carry the chart, which is now a single row of four bars
    // nearly 10 wide rather than a compact grid. At a 0.6 plateau fraction and
    // the ±16% per-side jitter the coastline carries, 11 is what puts the whole
    // plinth on flat ground on every bearing.
    radius: 11,
    height: 2.0,
    seed: 27,
    plateauFraction: 0.6,
  },
  {
    id: "phone",
    project: "A Case Study of COVID-19 Social Media Posts",
    radius: 7.4,
    height: 2.1,
    seed: 43,
    plateauFraction: 0.5,
  },
  {
    id: "bench",
    project: "How Exercise Affects Cortisol Experiment",
    radius: 10.5,
    height: 1.9,
    seed: 59,
    plateauFraction: 0.66,
  },
  {
    id: "television",
    project: "Predicting Success of Netflix Movies",
    radius: 10.5,
    height: 2.2,
    seed: 71,
    plateauFraction: 0.66,
  },
  {
    id: "ballot",
    project: "Predicting Municipal Voter Turnout in Quincy, MA",
    radius: 7.6,
    height: 2.0,
    seed: 89,
    plateauFraction: 0.52,
  },
  {
    id: "ribbon",
    project: "Prancer, a macOS Prompt Enhancer",
    // The machine runs 7.8 end to end with a conveyor out either side, so what
    // it needs is a long flat run rather than a wide one. At 9.5 and a 0.62
    // plateau fraction, seed 103's tightest side still comes in at 4.95 against
    // the machine's half-diagonal of 4.11 — both belts end on level ground
    // rather than overhanging the slope, on every bearing.
    radius: 9.5,
    height: 2.1,
    seed: 103,
    plateauFraction: 0.62,
  },
];

export const ISLANDS: IslandSpot[] = PLACEMENTS.map((p, i) => {
  // Same convention as the meadow's world.ts: angle 0 is straight ahead of
  // spawn (-Z), increasing clockwise viewed from above.
  const angle = FIRST_BEARING + (i * Math.PI * 2) / PLACEMENTS.length;
  const x = Math.sin(angle) * RING_DISTANCE;
  const z = -Math.cos(angle) * RING_DISTANCE;
  return {
    id: p.id,
    project: p.project,
    position: [x, z],
    radius: p.radius,
    height: p.height,
    seed: p.seed,
    plateauFraction: p.plateauFraction,
    rotationY: Math.atan2(-x, -z),
  };
});

/**
 * How close the boat has to be for the interact key to open an island.
 *
 * Measured from the shoreline rather than from the centre, which is the whole
 * point: the islands run from 7.4 to 14 across, and a centre-measured range
 * tight enough to be unambiguous on the smallest of them would put the factory
 * island out of reach from a boat already aground on its beach.
 *
 * Five past the waterline is also the band at which `Island.tsx` has the island
 * fully lit, so the key goes live exactly as the island finishes lighting up.
 * The glow is the prompt, and the two agreeing is what makes it read as one
 * thing rather than two.
 */
export const INTERACT_RANGE = 5;

/**
 * The nearest island within interact range, or null. Measured in XZ alone: the
 * boat sits on the water and the islands rise out of it, so height here is a
 * property of the terrain rather than of the distance between the two — unlike
 * the balloons, where altitude is half the game.
 */
export function nearestIsland(position: THREE.Vector3): IslandSpot | null {
  let best: IslandSpot | null = null;
  let bestDistance = INTERACT_RANGE;
  for (const spot of ISLANDS) {
    const fromShore =
      Math.hypot(position.x - spot.position[0], position.z - spot.position[1]) - spot.radius;
    if (fromShore < bestDistance) {
      bestDistance = fromShore;
      best = spot;
    }
  }
  return best;
}

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
