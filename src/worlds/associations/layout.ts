import * as THREE from "three";

/**
 * Layout for the associations world: four tethered balloons on the summits of a
 * mountain range, flown between in a helicopter, high above a coast.
 *
 * The balloons are the content. Everything here — how far the helicopter may
 * range, the altitude band it flies in, which summit each balloon is staked to —
 * is set so that all four are reachable in a few seconds of flight and none can
 * be lost behind the player.
 */

import { HOST_PEAKS, terrainHeight } from "./terrain";

/**
 * How far from the centre the helicopter may fly.
 *
 * The four host summits stand inside this, so the ring the player circles is the
 * one the balloons are on. Past it the range keeps going for hundreds of units
 * as scenery — the boundary is where the *flying* stops, not where the world
 * does, and from this altitude that reads as choosing not to leave rather than
 * as being stopped.
 */
export const FLIGHT_RADIUS = 38;

/**
 * The highest ground anywhere the helicopter can reach.
 *
 * Sampled rather than assumed, and this is the whole reason: a host peak's
 * `height` is not the height of the ground above it. `terrainHeight` adds an
 * inland rise and three octaves of ridging on top of every peak, so the real
 * summit runs some twenty units above the number written in `terrain.ts`.
 * Reading the peak's own height and calling it the summit — which is the obvious
 * thing to do — would put the flight floor twenty units inside the mountain.
 *
 * A square grid at one unit, and both of those matter. A polar sweep was tried
 * first and it under-read the true maximum by nearly three units, because its
 * samples fan out with radius and it simply stepped over the ridge that carries
 * the highest ground; a square grid is uniformly dense everywhere. One unit is
 * comfortably finer than the shortest wavelength in the ridging, which is about
 * eighty. Around four thousand samples, once, at module load.
 */
const ARENA_SUMMIT = (() => {
  let highest = -Infinity;
  for (let x = -FLIGHT_RADIUS; x <= FLIGHT_RADIUS; x += 1) {
    for (let z = -FLIGHT_RADIUS; z <= FLIGHT_RADIUS; z += 1) {
      if (Math.hypot(x, z) > FLIGHT_RADIUS) continue;
      highest = Math.max(highest, terrainHeight(x, z));
    }
  }
  return highest;
})();

/**
 * The altitude band, both ends derived from what is actually under and above the
 * player rather than chosen.
 *
 * The floor clears the highest ground in range — there is no terrain collision
 * in this world, so the floor *is* the collision. The ceiling is set once the
 * balloons are placed, below, to clear the tallest crown by the same margin the
 * clearing version used.
 *
 * The band comes out around the two dozen units the clearing had, so the
 * vertical control feels as it did; what changed is where the band sits, which
 * is now most of a mountain up.
 */
export const MIN_ALTITUDE = ARENA_SUMMIT + 4;
export const SPAWN_ALTITUDE = MIN_ALTITUDE + 6;

/** Facing -Z, the heading every world spawns on. */
export const SPAWN_FACING = Math.PI;
export const SPAWN_POSITION = new THREE.Vector3(0, SPAWN_ALTITUDE, 26);

/**
 * Fog, pitched for the view from up here.
 *
 * Far enough out that the balloons and the nearest peaks are untouched, close
 * enough that the range stacks into paler and paler ridges toward the horizon —
 * the layered haze the meadow uses for depth, which is the only thing that makes
 * a distant mountain read as distant rather than as small.
 */
export const FOG_NEAR = 150;
export const FOG_FAR = 620;

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
 * Four balloons, one on each host summit.
 *
 * Where they stand is no longer written here — it comes from `HOST_PEAKS`, so
 * the mountain and the thing staked to it cannot disagree. What is written here
 * is how far above its own summit each one floats, staggered so the four sit at
 * four different altitudes: level with each other they would read as a row of
 * lamps, and the whole reason the player has a vertical control is that there is
 * somewhere to use it.
 *
 * Each is placed by how far it floats above the *flight floor*, not above its own
 * summit, and the tether length is whatever that works out to.
 *
 * That way round because the four summits are nine units apart in height, so
 * equal tethers would scatter the balloons across the sky and a band tight
 * enough to reach them all would not exist. Pinning the envelopes to the floor
 * instead puts them in a deliberate ladder four units apart, and lets each rope
 * be whatever length its own mountain demands — which is what a tether is for.
 * It also means the whole ladder rides up or down with the terrain if the range
 * is ever retuned, instead of four ropes needing to be re-measured by hand.
 */
const PLACEMENTS: {
  id: AssociationId;
  org: string;
  label: string;
  /** Height of the envelope's centre above MIN_ALTITUDE. */
  aboveFloor: number;
  radius: number;
}[] = [
  { id: "stats-club", org: "Statistics & Data Science Club", label: "Statistics & Data Science Club", aboveFloor: 4, radius: 3.4 },
  { id: "ucla-rugby", org: "UCLA Rugby", label: "UCLA Rugby", aboveFloor: 8, radius: 3.5 },
  { id: "olympic-rugby", org: "Olympic Club Rugby", label: "Olympic Club Rugby", aboveFloor: 12, radius: 3.2 },
  { id: "lambda-chi", org: "Lambda Chi Alpha Fraternity", label: "Lambda Chi Alpha", aboveFloor: 16, radius: 3.7 },
];

export const BALLOONS: BalloonSpot[] = PLACEMENTS.map((p, i) => {
  const peak = HOST_PEAKS[p.id];
  // The real summit, sampled off the same function that draws the mountain —
  // not `peak.height`, which is only that peak's contribution to it.
  const groundY = terrainHeight(peak.x, peak.z);
  const centerY = MIN_ALTITUDE + p.aboveFloor;
  return {
    id: p.id,
    org: p.org,
    label: p.label,
    anchor: [peak.x, peak.z],
    groundY,
    // Balloon.tsx works in coordinates local to the stake, so what it needs is
    // the rise from the summit — the rope length, in other words.
    height: centerY - groundY,
    centerY,
    radius: p.radius,
    // Face back toward the middle, which is where the helicopter flies.
    rotationY: Math.atan2(-peak.x, -peak.z),
    phase: i * 1.7,
  };
});

/**
 * The ceiling: above the tallest crown by the same margin the clearing kept, so
 * the player can always rise over every balloon and look down on the range.
 */
export const MAX_ALTITUDE = Math.max(...BALLOONS.map((b) => b.centerY + b.radius)) + 4.5;

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
