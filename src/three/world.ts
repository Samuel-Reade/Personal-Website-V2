import type { PanelId, PortalId, ReturnState } from "../state/useStore";

/** Radius of the ring the meadow's portals are arranged on. */
export const PORTAL_RING_RADIUS = 10;
/** Invisible walk boundary — the player can't cross this. */
export const WORLD_RADIUS = 23;
/**
 * Where the horizon fog starts/finishes blending. FOG_NEAR sits outside the
 * walkable area so nothing the player can reach is ever hazed. FOG_FAR is
 * deliberately close: with no mountains left to stand in front of it, the far
 * ground has to be fully dissolved into haze before its own edge arrives.
 */
export const FOG_NEAR = 35;
export const FOG_FAR = 95;
/**
 * Radius of the far edge of the ground plane. Kept just past FOG_FAR so the
 * disc's rim is already pure fog by the time it is reached, and low enough
 * that the grass silhouette covers it from the camera's eye height.
 */
export const FAR_GROUND_RADIUS = 90;

/**
 * Angle -> world position on the ground plane, angle 0 = straight ahead of
 * spawn (-Z), increasing clockwise when viewed from above.
 */
export function angleToPosition(angle: number, radius: number): [number, number, number] {
  return [Math.sin(angle) * radius, 0, -Math.cos(angle) * radius];
}

export interface PortalSpot {
  id: PortalId;
  label: string;
  /**
   * Content panel this portal opens when it is clicked rather than walked into,
   * and the fallback if its world is ever taken away. The hall portal has none:
   * it leads somewhere rather than standing for something to read.
   */
  panel?: PanelId;
  /** World position of the portal's center. */
  position: [number, number, number];
  /** Y rotation that turns the portal's face toward the spawn point. */
  rotationY: number;
  /** Multiplier on the base portal size. */
  scale: number;
}

/**
 * Horizontal distance from a full-size portal's center at which walking into it
 * transports the player, scaled per portal. Comfortably inside the 1.6-unit
 * surface radius: the trigger should fire once the character is visibly within
 * the disc, not the moment they brush its outer glow.
 */
export const PORTAL_TRIGGER_RADIUS = 1;

/** How far outside the trigger the player is placed when they come back out. */
export const PORTAL_EXIT_CLEARANCE = 0.9;

/** True when `position` is inside `spot`'s trigger cylinder. */
export function isInsidePortal(spot: PortalSpot, x: number, z: number): boolean {
  const dx = x - spot.position[0];
  const dz = z - spot.position[2];
  return Math.hypot(dx, dz) < PORTAL_TRIGGER_RADIUS * spot.scale;
}

/**
 * Where to put the player when they come back from a portal they *clicked*.
 *
 * Walking in has an approach direction to back out along (see `Player`); a click
 * has none, and could have come from anywhere in the meadow. So this stands them
 * in front of the portal's face — which is to say on the ring's inside, where
 * anyone looking at it is — and turns them around to face it, so returning reads
 * as stepping back out of the disc they went in through.
 */
export function clickReturnState(spot: PortalSpot): ReturnState {
  // A portal's face points at the origin, so its own rotation is the direction
  // to step out along; the player then looks back down it.
  const outX = Math.sin(spot.rotationY);
  const outZ = Math.cos(spot.rotationY);
  const clearance = PORTAL_TRIGGER_RADIUS * spot.scale + PORTAL_EXIT_CLEARANCE;
  return {
    position: [spot.position[0] + outX * clearance, 0, spot.position[2] + outZ * clearance],
    facing: spot.rotationY + Math.PI,
  };
}

/**
 * The portals on the ring, in order around it starting a half-slice clockwise
 * of the spawn sightline.
 *
 * Six of them are résumé sections. The seventh is Reade Hall, the room the site
 * opens in, and its slot is not arbitrary: seven evenly spaced portals with the
 * half-slice offset below put index 3 exactly 180° from spawn, so the way home
 * sits dead behind the visitor. That is the same arrangement every world past
 * this one uses — return portal behind spawn, turn around to leave — and it
 * keeps the six sections in their original order across the front of the ring.
 */
const RING_PORTALS: { id: PortalId; panel?: PanelId; label: string }[] = [
  { id: "education", panel: "education", label: "Education" },
  { id: "experience", panel: "experience", label: "Experience" },
  { id: "projects", panel: "projects", label: "Projects" },
  { id: "hall", label: "Reade Hall" },
  { id: "techstack", panel: "techstack", label: "Tech Stack" },
  // Labelled for the world behind it rather than for the résumé section it
  // opens. The section is still "Extracurriculars" in `data/content.ts` and in
  // the panel header; the portal says what the place is called.
  { id: "extracurriculars", panel: "extracurriculars", label: "Associations" },
  { id: "interests", panel: "interests", label: "Interests" },
];

/** How high off the ground a ring portal's center floats. */
const RING_PORTAL_HEIGHT = 1.9;

/**
 * The ring portals, evenly spaced and all equidistant from spawn. The half-slice
 * offset dates from when two smaller portals stood on the spawn-facing axis and
 * this ring had to clear them. Those are gone, so the offset now means the
 * player spawns looking between two portals rather than straight at one — and,
 * at seven portals, that it is Reade Hall rather than a gap that sits directly
 * behind them.
 */
export const PORTAL_SPOTS: PortalSpot[] = RING_PORTALS.map((section, i) => {
  const angle = (i / RING_PORTALS.length) * Math.PI * 2 + Math.PI / RING_PORTALS.length;
  const [x, , z] = angleToPosition(angle, PORTAL_RING_RADIUS);
  return {
    ...section,
    position: [x, RING_PORTAL_HEIGHT, z],
    // Face back toward the origin.
    rotationY: Math.atan2(-x, -z),
    scale: 1,
  };
});

/**
 * Every portal in the meadow. The ring is currently all of them — the Rundown
 * and Connect portals that used to flank the spawn axis are gone — but this
 * stays a distinct export so the walk-through trigger and the renderer keep one
 * list to read rather than assuming the ring is the whole world.
 */
export const ALL_PORTALS: PortalSpot[] = [...PORTAL_SPOTS];

export interface Obstacle {
  position: [number, number];
  radius: number;
}

/**
 * Collision circles used by the player controller. Empty now that portals are
 * walked into rather than clicked — they used to be blockers here, inherited
 * from the trees and sign posts that stood in the same spots, and a blocker is
 * exactly what stops the walk-through from ever firing. Kept as an export so
 * the controller keeps its collision pass for whatever solid props come next.
 */
export const OBSTACLES: Obstacle[] = [];
