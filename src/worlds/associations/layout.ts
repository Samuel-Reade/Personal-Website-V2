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
 * The four host summits stand well inside this — the balloons are the content,
 * but they are no longer the cage. At 38 the wall stood a few seconds' flight
 * from the spawn and the arena read as a paddock; at 110 the flyable air takes
 * in the nearer scenery peaks and, on the east, reaches out over the beach and
 * the first water of the bay. Past it the range keeps going for hundreds of
 * units as scenery — the boundary is where the *flying* stops, not where the
 * world does, and TERRAIN_EXTENT grew with this radius so the rim of the world
 * stays a full fog-depth beyond the wall (the arithmetic is on FOG_FAR below).
 */
export const FLIGHT_RADIUS = 110;

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
 * eighty. Around forty thousand samples, once, at module load.
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
/**
 * How far the flight floor stands over the highest summit in range.
 *
 * Four was the bare clearance a collision needs and it read as skimming the
 * rock; twenty-four put the peaks below the player but still felt like flying
 * *at* the range. At seventy the flight is properly aerial — the summits sit far
 * beneath the skids, the whole range lays itself out as a map, and the tethers
 * run long the way a balloon moored on a mountaintop actually rides. Everything
 * hangs off this floor — balloons, spawn, the portal home — so they all rise
 * together.
 */
const FLIGHT_CLEARANCE = 70;

export const MIN_ALTITUDE = ARENA_SUMMIT + FLIGHT_CLEARANCE;

/** Facing -Z, the heading every world spawns on. */
export const SPAWN_FACING = Math.PI;

/**
 * Fog, pitched for the view from up here.
 *
 * Far enough out that the balloons and the nearest peaks are untouched, close
 * enough that the range stacks into paler and paler ridges toward the horizon —
 * the layered haze the meadow uses for depth, which is the only thing that makes
 * a distant mountain read as distant rather than as small.
 */
export const FOG_NEAR = 165;
/**
 * The fog has to finish before the ground does — that was wrong the first
 * time, when at 620 the rim was only 82% hazed and the field's cut edge showed
 * faintly on the diagonals — and the check has to be made from the *worst*
 * vantage, not the centre. That vantage is the arena's edge: FLIGHT_RADIUS 110
 * toward a rim at TERRAIN_EXTENT 600 leaves 490 in plan, and altitude only
 * adds slant — at the flight floor the rim sits ~515 away (97% hazed, past
 * noticing) and from anywhere higher or deeper in the arena it crosses 525
 * into pure fog. The far corners sit at 849, long gone. This is why the extent
 * grew with the radius: the two numbers hold the horizon up between them.
 */
export const FOG_FAR = 525;

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
  // Radii up a fifth from the first pass, and the ladder opened out to match. A
  // real envelope dwarfs a helicopter, and at the old sizes the two read as the
  // same order of thing.
  { id: "stats-club", org: "Statistics & Data Science Club", label: "Statistics & Data Science Club", aboveFloor: 5, radius: 4.1 },
  { id: "ucla-rugby", org: "UCLA Rugby", label: "UCLA Rugby", aboveFloor: 10, radius: 4.2 },
  { id: "olympic-rugby", org: "Olympic Club Rugby", label: "Olympic Club Rugby", aboveFloor: 15, radius: 3.9 },
  { id: "lambda-chi", org: "Lambda Chi Alpha Fraternity", label: "Lambda Chi Alpha", aboveFloor: 20, radius: 4.5 },
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
 * Where the way home hangs: level with the balloons, at the middle of their
 * ladder, so it reads as one more thing moored in the same air rather than
 * something sunk below them at the flight floor — which is where it sat when
 * its height came off the floor alone. Derived from the balloons themselves,
 * so it rides with the ladder if the placements are ever retuned.
 */
export const PORTAL_ALTITUDE =
  BALLOONS.reduce((sum, b) => sum + b.centerY, 0) / BALLOONS.length;

/**
 * The helicopter spawns at the portal's height, a few units in front of it:
 * level with the way home and with the middle of the balloons' ladder, so
 * turning round on arrival looks straight at the portal rather than up at it,
 * and the first balloons are as much below as above.
 */
export const SPAWN_ALTITUDE = PORTAL_ALTITUDE;
export const SPAWN_POSITION = new THREE.Vector3(0, SPAWN_ALTITUDE, 26);

/**
 * Headroom above the tallest crown.
 *
 * The old 4.5 pinned the ceiling to the balloon tops, which made the altitude
 * band a slot barely thirty units tall — the one place the helicopter did not
 * fly like the astronaut, whose sky is open in every direction. Sixty puts the
 * ceiling far enough up that the whole arena lays itself out as a map below,
 * and the climb is a journey rather than a bump against glass. The horizon
 * survives the view from up there: the fog arithmetic on FOG_FAR below is
 * checked from this ceiling at the arena's edge, the worst vantage there is.
 */
const CEILING_HEADROOM = 60;

/**
 * The ceiling: above the tallest crown by CEILING_HEADROOM, so the player can
 * always rise far over every balloon and look down on the range.
 */
export const MAX_ALTITUDE =
  Math.max(...BALLOONS.map((b) => b.centerY + b.radius)) + CEILING_HEADROOM;

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
