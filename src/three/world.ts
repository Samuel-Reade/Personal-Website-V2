import type { PanelId } from "../state/useStore";

/** Radius of the small dirt clearing the player spawns on. */
export const PLAZA_RADIUS = 4;
/** Radius of the ring the trees are arranged on. */
export const TREE_RADIUS = 17;
/** Invisible walk boundary — the player can't cross this. */
export const WORLD_RADIUS = 23;
/** Width of the worn trails radiating from the clearing to each tree. */
export const PATH_WIDTH = 1.6;
/** Where the horizon fog starts/finishes blending — shared by the ground, fog, and mountain backdrop. */
export const FOG_NEAR = 35;
export const FOG_FAR = 260;
/** Radius of the (fog-hidden) far edge of the ground plane — keeps grass under the mountains. */
export const FAR_GROUND_RADIUS = 260;

/**
 * Angle -> world position on the ground plane, angle 0 = straight ahead of
 * spawn (-Z), increasing clockwise when viewed from above.
 */
export function angleToPosition(angle: number, radius: number): [number, number, number] {
  return [Math.sin(angle) * radius, 0, -Math.cos(angle) * radius];
}

/** Y-rotation that orients a box (length along local +Z) to point along `angle`. */
export function pathRotationY(angle: number): number {
  return Math.PI - angle;
}

export interface TreeSpot {
  id: PanelId;
  label: string;
  angle: number;
}

const TREE_SECTIONS: { id: PanelId; label: string }[] = [
  { id: "education", label: "Education" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "techstack", label: "Tech Stack" },
  { id: "extracurriculars", label: "Extracurriculars" },
  { id: "interests", label: "Interests" },
];

// Offset by half a slice so no tree sits directly on the spawn-facing axis,
// which is reserved for the two standalone signs.
export const TREE_SPOTS: TreeSpot[] = TREE_SECTIONS.map((s, i) => ({
  ...s,
  angle: (i / TREE_SECTIONS.length) * Math.PI * 2 + Math.PI / TREE_SECTIONS.length,
}));

export interface StandaloneSignSpot {
  id: PanelId;
  label: string;
  position: [number, number, number];
  rotationY: number;
}

// Directly in front of spawn, flanking the central path (spawn faces -Z).
// rotationY: 0 makes a sign's local +Z face point back toward +Z (the spawn).
export const STANDALONE_SIGNS: StandaloneSignSpot[] = [
  { id: "rundown", label: "Rundown", position: [-2.2, 0, -3.6], rotationY: 0 },
  { id: "connect", label: "Connect", position: [2.2, 0, -3.6], rotationY: 0 },
];

export interface Obstacle {
  position: [number, number];
  radius: number;
}

/** Collision circles used by the player controller (tree trunks + sign posts). */
export const OBSTACLES: Obstacle[] = [
  ...TREE_SPOTS.map((s) => {
    const [x, , z] = angleToPosition(s.angle, TREE_RADIUS);
    return { position: [x, z] as [number, number], radius: 0.55 };
  }),
  ...STANDALONE_SIGNS.map((s) => ({
    position: [s.position[0], s.position[2]] as [number, number],
    radius: 0.3,
  })),
];

export interface PathTransform {
  position: [number, number, number];
  rotationY: number;
  length: number;
}

/** World transform of the worn trail leading from the clearing to a given tree angle. */
export function getPathTransform(angle: number): PathTransform {
  const length = TREE_RADIUS - PLAZA_RADIUS + 2;
  const midR = PLAZA_RADIUS + length / 2 - 1;
  const position = angleToPosition(angle, midR);
  return { position, rotationY: pathRotationY(angle), length };
}

/**
 * True if (x, z) falls within (or close to) one of the trail corridors —
 * used to keep tall field grass from growing over the trails.
 */
export function isNearAnyPath(x: number, z: number, margin = 0): boolean {
  for (const spot of TREE_SPOTS) {
    const dirX = Math.sin(spot.angle);
    const dirZ = -Math.cos(spot.angle);
    const t = x * dirX + z * dirZ;
    if (t < PLAZA_RADIUS - 1 || t > TREE_RADIUS + 1) continue;
    const perpX = x - t * dirX;
    const perpZ = z - t * dirZ;
    const perp = Math.hypot(perpX, perpZ);
    if (perp < PATH_WIDTH / 2 + margin) return true;
  }
  return false;
}
