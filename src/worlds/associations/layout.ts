import * as THREE from "three";

/**
 * Layout for the associations clearing: a hilltop with four tethered balloons,
 * flown between in a helicopter.
 *
 * The balloons are the content. Everything here — the size of the clearing, the
 * altitude ceiling, where the four are anchored — is set so that all four are
 * reachable in a few seconds of flight and none of them can be lost behind the
 * player.
 */

/** Radius of the hilltop's flat top, and of the slope that falls away from it. */
export const HILL_RADIUS = 30;
export const HILL_SKIRT = 46;
/** How far the crown stands above the surrounding ground. */
export const HILL_HEIGHT = 2.2;

/**
 * How far from the centre the helicopter may fly.
 *
 * Comfortably outside the balloon ring so nothing is pinned against the
 * boundary, and inside the treeline so the edge of the world is a wall of
 * conifers rather than an invisible stop in open air.
 */
export const FLIGHT_RADIUS = 38;

/**
 * The altitude band.
 *
 * The floor is a hover height rather than the ground: this is a helicopter, and
 * setting it down is not something the world has any use for. The ceiling clears
 * the tallest balloon's crown by a couple of metres — high enough to look down
 * on all four, low enough that the clearing never becomes a distant patch below.
 */
export const MIN_ALTITUDE = HILL_HEIGHT + 1.8;
export const MAX_ALTITUDE = 26;
export const SPAWN_ALTITUDE = 7;

/**
 * The height of the hill's surface at a given radius.
 *
 * Shared rather than kept inside `Clearing.tsx`, because it is not only the
 * terrain that needs it: the balloons are staked to the ground, and the ground
 * is 2.2 units up in the middle of the clearing. Anchoring them at y = 0 — which
 * is what the first pass did — buries every stake and leaves four tethers rising
 * out of the grass from nothing.
 *
 * It mirrors the lathe profile in `Clearing.tsx` segment for segment. The two
 * have to be read together, which is the cost of not evaluating the geometry on
 * the CPU; the alternative is raycasting the hill once per balloon at mount, for
 * four numbers that are known at build time.
 */
export function groundHeight(radius: number): number {
  if (radius <= HILL_RADIUS * 0.55) return HILL_HEIGHT;
  if (radius <= HILL_RADIUS * 0.86) {
    const t = (radius - HILL_RADIUS * 0.55) / (HILL_RADIUS * 0.31);
    return THREE.MathUtils.lerp(HILL_HEIGHT, HILL_HEIGHT * 0.82, t);
  }
  if (radius <= HILL_RADIUS) {
    const t = (radius - HILL_RADIUS * 0.86) / (HILL_RADIUS * 0.14);
    return THREE.MathUtils.lerp(HILL_HEIGHT * 0.82, HILL_HEIGHT * 0.52, t);
  }
  if (radius <= HILL_SKIRT * 0.82) {
    const t = (radius - HILL_RADIUS) / (HILL_SKIRT * 0.82 - HILL_RADIUS);
    return THREE.MathUtils.lerp(HILL_HEIGHT * 0.52, HILL_HEIGHT * 0.12, t);
  }
  const t = THREE.MathUtils.clamp((radius - HILL_SKIRT * 0.82) / (HILL_SKIRT * 0.18), 0, 1);
  return THREE.MathUtils.lerp(HILL_HEIGHT * 0.12, 0, t);
}

/** Facing -Z, the heading every world spawns on. */
export const SPAWN_FACING = Math.PI;
export const SPAWN_POSITION = new THREE.Vector3(0, SPAWN_ALTITUDE, 26);

/** Fog, pitched so the treeline softens without hazing the balloons. */
export const FOG_NEAR = 48;
export const FOG_FAR = 132;

export type AssociationId = "ucla-rugby" | "olympic-rugby" | "lambda-chi" | "stats-club";

export interface BalloonSpot {
  id: AssociationId;
  /**
   * Matches an EXTRACURRICULARS entry's `org` exactly — this is the key the
   * content panel narrows on, so a typo here silently opens an empty panel.
   */
  org: string;
  /** Short name for the hover label; the full org names are long to float over a balloon. */
  label: string;
  /** Where the tether is staked, in world XZ. */
  anchor: [number, number];
  /** The hill's surface at that stake — everything on this balloon hangs off it. */
  groundY: number;
  /**
   * Height of the envelope's centre above its own patch of ground. Staggered on
   * purpose — four balloons at one altitude read as a row of lamps, and the
   * whole reason the player has a vertical control is that there is somewhere to
   * use it.
   */
  height: number;
  /** The envelope's centre in world space, which is what proximity is measured to. */
  centerY: number;
  /** Envelope radius. Varied a little so the four don't look stamped. */
  radius: number;
  /** Turns the decorated face back toward the middle of the clearing. */
  rotationY: number;
  /** Decorrelates this balloon's bob and sway from its neighbours'. */
  phase: number;
}

/**
 * Four balloons, spread around the crown at four bearings and four heights.
 *
 * Bearings are deliberately not at even quarters and the distances differ, so no
 * two line up from the spawn point and the ring never reads as laid out on a
 * compass. Each is turned to face the centre, which is where the helicopter
 * spends its time.
 */
const PLACEMENTS: {
  id: AssociationId;
  org: string;
  label: string;
  /** Bearing from the centre, 0 = straight ahead (-Z), increasing clockwise from above. */
  angle: number;
  distance: number;
  height: number;
  radius: number;
}[] = [
  {
    id: "ucla-rugby",
    org: "UCLA Rugby",
    label: "UCLA Rugby",
    angle: -0.5,
    distance: 15,
    height: 12.5,
    radius: 3.5,
  },
  {
    id: "olympic-rugby",
    org: "Olympic Club Rugby",
    label: "Olympic Club Rugby",
    angle: 0.85,
    distance: 20,
    height: 8.5,
    radius: 3.2,
  },
  {
    id: "lambda-chi",
    org: "Lambda Chi Alpha Fraternity",
    label: "Lambda Chi Alpha",
    angle: 2.5,
    distance: 16.5,
    height: 15.5,
    radius: 3.7,
  },
  {
    id: "stats-club",
    org: "Statistics & Data Science Club",
    label: "Statistics & Data Science Club",
    angle: 4.15,
    distance: 19,
    height: 10.5,
    radius: 3.4,
  },
];

export const BALLOONS: BalloonSpot[] = PLACEMENTS.map((p, i) => {
  const x = Math.sin(p.angle) * p.distance;
  const z = -Math.cos(p.angle) * p.distance;
  const groundY = groundHeight(p.distance);
  return {
    id: p.id,
    org: p.org,
    label: p.label,
    anchor: [x, z],
    groundY,
    height: p.height,
    centerY: groundY + p.height,
    radius: p.radius,
    // Face back toward the middle, which is where the helicopter flies.
    rotationY: Math.atan2(-x, -z),
    phase: i * 1.7,
  };
});

/**
 * How close the helicopter has to be to a balloon for it to light up, and how
 * close before the interact key will open it.
 *
 * The glow band is generous because it is an invitation — it should come on
 * while the balloon is still something you are flying toward. The interact range
 * is tight enough that with four balloons in the air there is never a question
 * of which one Space would open.
 */
export const PROXIMITY_NEAR = 7;
export const PROXIMITY_FAR = 22;
export const INTERACT_RANGE = 11;

/** The nearest balloon within interact range, or null. Measured in 3D — altitude is half the game here. */
export function nearestBalloon(position: THREE.Vector3): BalloonSpot | null {
  let best: BalloonSpot | null = null;
  let bestDistance = INTERACT_RANGE;
  for (const spot of BALLOONS) {
    const distance = Math.hypot(
      position.x - spot.anchor[0],
      position.y - spot.centerY,
      position.z - spot.anchor[1]
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = spot;
    }
  }
  return best;
}

/**
 * Keeps the helicopter inside the clearing and inside its altitude band,
 * mutating in place — the same shape of resolver the meadow and the space world
 * use, so the controller stays a controller and the world owns its own limits.
 */
export function resolveFlight(next: THREE.Vector3): void {
  const radius = Math.hypot(next.x, next.z);
  if (radius > FLIGHT_RADIUS) {
    const scale = FLIGHT_RADIUS / radius;
    next.x *= scale;
    next.z *= scale;
  }
  next.y = THREE.MathUtils.clamp(next.y, MIN_ALTITUDE, MAX_ALTITUDE);
}
