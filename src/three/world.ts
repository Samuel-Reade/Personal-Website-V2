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

/**
 * How far from a portal's centre the player stands when they come back out of
 * it, in world units.
 *
 * They arrive facing away, so the chase camera lands between them and the disc.
 * That is what sets this number: the boom is 6.5 units, ~6.4 of it horizontal,
 * so anything shorter than that parks the camera *behind* an opaque 1.6-radius
 * disc, which then subtends more of the frame than the character does and hides
 * them completely. At 8.5 the camera clears the portal by about two units.
 *
 * The worlds that were built with a return portal behind spawn already stand
 * this far off it for the same reason — the library at 8.6, the space world at
 * 10 — so this is the existing convention written down rather than a new one.
 */
export const PORTAL_ARRIVAL_DISTANCE = 8.5;

/** True when `position` is inside `spot`'s trigger cylinder. */
export function isInsidePortal(spot: PortalSpot, x: number, z: number): boolean {
  const dx = x - spot.position[0];
  const dz = z - spot.position[2];
  return Math.hypot(dx, dz) < PORTAL_TRIGGER_RADIUS * spot.scale;
}

/**
 * Where to put the player when they come back from a portal they *clicked*.
 *
 * Walking in has an approach direction to step back out along (see `Player`); a
 * click has none, and could have come from anywhere in the meadow. So this sends
 * them out across the ring's inside, where anyone looking at the portal is
 * standing anyway.
 */
/**
 * How close a return spot may come to another portal's centre before it is
 * rejected — a shade over the 1.6-unit visible surface, so nobody is ever set
 * down standing inside someone else's disc.
 */
const RETURN_PORTAL_CLEARANCE = 2.2;

/**
 * Where to put the player when they come back from a portal they *walked* into:
 * out along the line from the portal to wherever they were standing when the
 * trigger fired, so they reappear on the side they approached from.
 *
 * That line needs a guard at this distance. Brush a portal tangentially and the
 * direction out of it runs along the ring, where the next portal is only 8.68
 * units away — close enough to set someone down 0.18 from its centre, inside its
 * disc. `Player`'s arm-on-exit guard stops that teleporting them, but it still
 * reads as a glitch, so a crowded spot falls back to the straight-across-the-ring
 * placement a click would have given.
 */
export function walkReturnState(
  spot: PortalSpot,
  x: number,
  z: number,
  facing: number
): ReturnState {
  const dx = x - spot.position[0];
  const dz = z - spot.position[2];
  const dist = Math.hypot(dx, dz);
  // Walking in dead-on leaves no direction to back out along, so fall back to
  // the character's own facing and step them backwards from it.
  const outX = dist > 0.0001 ? dx / dist : -Math.sin(facing);
  const outZ = dist > 0.0001 ? dz / dist : -Math.cos(facing);

  const px = spot.position[0] + outX * PORTAL_ARRIVAL_DISTANCE;
  const pz = spot.position[2] + outZ * PORTAL_ARRIVAL_DISTANCE;
  const crowded = ALL_PORTALS.some(
    (other) =>
      Math.hypot(px - other.position[0], pz - other.position[2]) <
      RETURN_PORTAL_CLEARANCE * other.scale
  );
  if (crowded) return clickReturnState(spot);

  // Facing out along the same line: you come out of a portal with it at your
  // back, and the chase camera has to be the thing between you and the disc.
  return { position: [px, 0, pz], facing: Math.atan2(outX, outZ) };
}

export function clickReturnState(spot: PortalSpot): ReturnState {
  // A portal's face points at the origin, so its own rotation is both the
  // direction out of it and the heading to walk away on.
  const outX = Math.sin(spot.rotationY);
  const outZ = Math.cos(spot.rotationY);
  return {
    position: [
      spot.position[0] + outX * PORTAL_ARRIVAL_DISTANCE,
      0,
      spot.position[2] + outZ * PORTAL_ARRIVAL_DISTANCE,
    ],
    facing: spot.rotationY,
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
