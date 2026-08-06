import * as THREE from "three";

/**
 * Layout constants for the library hall. The player walks down a central aisle
 * running along -Z, flanked by table rows; the first two rows carry the
 * clickable books and everything past them is background.
 */

export const HALL_MIN_X = -13;
export const HALL_MAX_X = 13;
export const HALL_MIN_Z = -66;
/**
 * The hall runs well past the spawn point, giving an empty entrance bay behind
 * the player. Without it the chase camera — which sits ~6.5 units back — would
 * start already inside the end wall.
 */
export const HALL_MAX_Z = 16;
export const CEILING_HEIGHT = 16;
export const WALL_THICKNESS = 1;

/** Spawn sits just inside the near wall, facing down the aisle (-Z). */
export const SPAWN_POSITION = new THREE.Vector3(0, 0, 5);

export const TABLE_WIDTH = 3.2;
export const TABLE_DEPTH = 6.5;
export const TABLE_HEIGHT = 1.05;
/** Distance from the aisle centerline to a table's center. */
export const TABLE_X = 6.6;

/** Half-width of the clear walking aisle between the two table rows. */
export const AISLE_HALF_WIDTH = TABLE_X - TABLE_WIDTH / 2;

export type EducationId = "tamalpais" | "ucla" | "uc3m";

export interface TableSpot {
  key: string;
  /** Center of the table top, in world XZ. */
  position: [number, number];
  /** Deterministic seed so each table's book piles differ but stay stable across renders. */
  seed: number;
}

/**
 * Z positions of each table row. The first two rows hold content; the rest fill
 * the hall so it reads as a working library rather than a corridor with two
 * props in it.
 */
const CONTENT_ROW_Z = [-5, -16];
const BACKGROUND_ROW_Z = [-27, -35.5, -44, -52.5, -61];
const ALL_ROW_Z = [...CONTENT_ROW_Z, ...BACKGROUND_ROW_Z];

export const TABLES: TableSpot[] = ALL_ROW_Z.flatMap((z, row) =>
  [-TABLE_X, TABLE_X].map((x, side) => ({
    key: `${row}-${side}`,
    position: [x, z] as [number, number],
    // Any cheap mix works here; this one just has to decorrelate neighbouring
    // tables so adjacent piles don't come out identical.
    seed: row * 37 + side * 101 + 13,
  }))
);

export interface BookSpot {
  id: EducationId;
  label: string;
  /**
   * The `school` field of the matching entry in `data/content.ts`. Passed
   * straight to `openEntry` so the panel filters on one key space rather than
   * needing a slug-to-school translation table.
   */
  entryKey: string;
  /** Pre-wrapped label lines — TextGeometry has no wrapping of its own. */
  labelLines: string[];
  labelSize: number;
  /** Where the book rests in its pile before the player gets close. */
  restPosition: [number, number, number];
}

/** Top face of a table, i.e. what things sitting on it rest against. */
export const TABLE_SURFACE_Y = TABLE_HEIGHT + 0.06;
/** Height of the ordinary-book stack a content book rests on before it lifts. */
export const PEDESTAL_HEIGHT = 0.36;

export const BOOK_WIDTH = 1.7;
export const BOOK_HEIGHT = 2.3;
export const BOOK_THICKNESS = 0.32;

/**
 * Resting height of a content book: lying flat on its pedestal stack rather than
 * directly on the wood, so it reads as part of the pile before it lifts out.
 */
const REST_Y = TABLE_SURFACE_Y + PEDESTAL_HEIGHT + BOOK_THICKNESS / 2;

export const BOOK_SPOTS: BookSpot[] = [
  {
    id: "tamalpais",
    label: "Tamalpais High School",
    // No EDUCATION entry yet, so this resolves to the panel's placeholder.
    entryKey: "Tamalpais High School",
    labelLines: ["Tamalpais", "High School"],
    labelSize: 0.185,
    restPosition: [-TABLE_X, REST_Y, CONTENT_ROW_Z[0]],
  },
  {
    id: "ucla",
    label: "UCLA",
    entryKey: "University of California, Los Angeles",
    labelLines: ["UCLA"],
    labelSize: 0.34,
    restPosition: [-TABLE_X, REST_Y, CONTENT_ROW_Z[1]],
  },
  {
    id: "uc3m",
    label: "Universidad Carlos III de Madrid",
    entryKey: "Universidad Carlos III de Madrid",
    labelLines: ["Universidad", "Carlos III", "de Madrid"],
    labelSize: 0.175,
    restPosition: [TABLE_X, REST_Y, CONTENT_ROW_Z[1]],
  },
];

/** Rows that carry a content book get fewer background piles, so the floating book stays the focal point. */
export const CONTENT_TABLE_KEYS = new Set(
  BOOK_SPOTS.map((spot) => {
    const row = ALL_ROW_Z.indexOf(spot.restPosition[2]);
    const side = spot.restPosition[0] > 0 ? 1 : 0;
    return `${row}-${side}`;
  })
);

/** Window centers along each side wall — used by both the glass and the light shafts. */
export const WINDOW_Z = [0, -12, -24, -36, -48, -60];
export const WINDOW_WIDTH = 5;
export const WINDOW_BOTTOM = 4.2;
export const WINDOW_TOP = 13;

/**
 * The way back to the meadow, standing in the entrance bay behind spawn — you
 * leave the hall by the end you came in at. Deliberately behind the camera at
 * spawn (which sits ~6.5 back, at z 11.5) so the first thing on screen is the
 * aisle rather than a portal filling the frame.
 *
 * Sits just past the walk limit (HALL_MAX_Z - WALL_PAD = 13.5) so the trigger is
 * comfortably reachable without the player having to touch the wall.
 */
export const RETURN_PORTAL_POSITION: [number, number, number] = [0, 1.9, 13.6];
export const RETURN_PORTAL_SCALE = 0.85;
export const RETURN_PORTAL_TRIGGER = 1.3;

/**
 * Inner faces of the hall, given to `CameraRig` so the chase camera pulls in
 * instead of backing through a wall when the player turns to face one.
 */
export const CAMERA_BOUNDS = {
  minX: HALL_MIN_X + WALL_THICKNESS + 0.4,
  maxX: HALL_MAX_X - WALL_THICKNESS - 0.4,
  minZ: HALL_MIN_Z + WALL_THICKNESS + 0.4,
  maxZ: HALL_MAX_Z - WALL_THICKNESS - 0.4,
};

interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const TABLE_BOXES: Box2[] = TABLES.map(({ position }) => ({
  minX: position[0] - TABLE_WIDTH / 2,
  maxX: position[0] + TABLE_WIDTH / 2,
  minZ: position[1] - TABLE_DEPTH / 2,
  maxZ: position[1] + TABLE_DEPTH / 2,
}));

const PLAYER_RADIUS = 0.32;
/**
 * Distance held back from the wall planes. Large enough to clear the wall
 * shelving and the column bases (which stand ~1.5 wide at x = ±11.5) as well as
 * the wall itself, so the side aisles stay walkable without the character
 * clipping into any of it.
 */
const WALL_PAD = 2.5;

/**
 * Replacement for `Player`'s default circular boundary + circular obstacles: the
 * hall is rectangular and so are the tables, so this clamps to the room and then
 * pushes out of each table along whichever axis it is least deep into. Solving
 * the shallowest axis is what makes sliding along a table edge feel right —
 * pushing along the deepest one would eject the player across the table instead.
 */
export function resolveLibraryMove(next: THREE.Vector3): void {
  next.x = THREE.MathUtils.clamp(next.x, HALL_MIN_X + WALL_PAD, HALL_MAX_X - WALL_PAD);
  next.z = THREE.MathUtils.clamp(next.z, HALL_MIN_Z + WALL_PAD, HALL_MAX_Z - WALL_PAD);

  for (const box of TABLE_BOXES) {
    const minX = box.minX - PLAYER_RADIUS;
    const maxX = box.maxX + PLAYER_RADIUS;
    const minZ = box.minZ - PLAYER_RADIUS;
    const maxZ = box.maxZ + PLAYER_RADIUS;

    if (next.x <= minX || next.x >= maxX || next.z <= minZ || next.z >= maxZ) continue;

    const outLeft = next.x - minX;
    const outRight = maxX - next.x;
    const outBack = next.z - minZ;
    const outFront = maxZ - next.z;
    const shallowest = Math.min(outLeft, outRight, outBack, outFront);

    if (shallowest === outLeft) next.x = minX;
    else if (shallowest === outRight) next.x = maxX;
    else if (shallowest === outBack) next.z = minZ;
    else next.z = maxZ;
  }
}
