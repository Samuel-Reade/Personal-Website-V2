import * as THREE from "three";
import { PORTAL_ARRIVAL_DISTANCE } from "../../three/world";

/**
 * The entry hall's dimensions and fixed positions, plus its collision pass.
 * Everything the room is built from reads its numbers here, so moving a wall
 * moves the windows, the pilasters and the walk boundary with it.
 */

export const HALL_MIN_X = -15;
export const HALL_MAX_X = 15;
/**
 * -Z is deeper into the hall; the visitor spawns near HALL_MAX_Z and faces -Z.
 *
 * The entry wall sits a good way behind the spawn point on purpose. The chase
 * camera rides ~6.5 units back from the character and `CAMERA_BOUNDS` stops it
 * passing through a wall, so a spawn any closer to that wall doesn't push the
 * camera through it — it jams the camera against it, and the arrival shot
 * becomes the back of the character's head filling the frame.
 */
export const HALL_MIN_Z = -22;
export const HALL_MAX_Z = 14;
export const CEILING_HEIGHT = 15;
export const WALL_THICKNESS = 1;

export const HALL_WIDTH = HALL_MAX_X - HALL_MIN_X;
export const HALL_DEPTH = HALL_MAX_Z - HALL_MIN_Z;
export const HALL_CENTER_Z = (HALL_MAX_Z + HALL_MIN_Z) / 2;

/** Just inside the door, with the whole room ahead. */
export const SPAWN_POSITION = new THREE.Vector3(0, 0, 5.5);
/** Faces -Z, into the hall — the same heading convention the library spawns on. */
export const SPAWN_FACING = Math.PI;

/* -------------------------------------------------------------------------
   Centrepiece
   ---------------------------------------------------------------------- */

export const TABLE_CENTER: [number, number] = [0, -3];
export const TABLE_RADIUS = 1.75;
export const TABLE_HEIGHT = 1.02;
/** Top face of the table, i.e. what the book rests on. */
export const TABLE_SURFACE_Y = TABLE_HEIGHT;

/** Cap height of the floating label over the book, in world units — see `displaySize`. */
export const LABEL_CAP_HEIGHT = 0.42;
/**
 * High enough to clear the portal's own floating label from the spawn point.
 * The two sit on the same sightline down the middle of the room — this one 15
 * units from the camera, the portal's 31 — so at any lower height the near one
 * lands square on top of the far one and neither can be read.
 */
export const LABEL_Y = TABLE_SURFACE_Y + 3;

/* -------------------------------------------------------------------------
   The portal home
   ---------------------------------------------------------------------- */

/**
 * Dead centre of the gap between the two staircases, at the same height the
 * meadow's ring portals float at. Facing +Z (rotationY 0) so it is square to
 * the visitor the moment they spawn — the one thing in the room that should be
 * unmissable from the door.
 */
export const PORTAL_POSITION: [number, number, number] = [0, 1.9, -19];
export const PORTAL_SCALE = 0.95;
/**
 * Wider than the meadow's 1-unit trigger for the same reason the library's is:
 * walking in at full stride from open floor, a tight circle can be stepped over
 * inside a single frame.
 */
export const PORTAL_TRIGGER = 1.4;

/**
 * Where a visitor coming back from the meadow appears: out in the room with the
 * portal behind them, at the shared arrival distance every portal on the site
 * uses.
 *
 * The landing spawns by the door because that arrival is composed for the walk
 * down the hall. Coming back through is the opposite trip — dropping in at the
 * door would put the whole room between the visitor and the disc they just
 * stepped out of.
 *
 * The eight and a half units matter as much as the direction. The chase camera
 * rides ~6.4 behind, so this lands it two units clear of the portal and leaves
 * the shot looking down the length of the hall past the table, rather than
 * through a swirl at the back of a head. Well inside the rear wall too, so
 * `CameraRig` never has to shorten its boom.
 */
export const PORTAL_ARRIVAL_POSITION = new THREE.Vector3(
  PORTAL_POSITION[0],
  0,
  PORTAL_POSITION[2] + PORTAL_ARRIVAL_DISTANCE
);
/** Faces +Z, away from the portal and back down the hall toward the door. */
export const PORTAL_ARRIVAL_FACING = 0;

/* -------------------------------------------------------------------------
   Staircases
   ---------------------------------------------------------------------- */

export const LANDING_Y = 5.4;
export const STEP_COUNT = 15;
/**
 * One more riser than there are steps: the last step lands one riser *below*
 * the balcony rather than flush with it, so the two slabs never end up coplanar
 * and z-fighting along the join.
 */
export const RISER = LANDING_Y / (STEP_COUNT + 1);
export const STAIR_WIDTH = 3.4;

/**
 * Each stair is a quarter turn: it starts mid-hall against a side wall facing
 * into the room, and sweeps 90° inward and upward to arrive at the back wall
 * facing the centre. Both are generated from the right-hand one by mirroring x,
 * rather than by scaling a group by -1 — a negative scale flips triangle winding,
 * which flat shading shows up immediately as a stair lit from inside.
 */
const STAIR_PIVOT: [number, number] = [5.5, -12];
const STAIR_RADIUS = 7;

export interface StairStep {
  /** Centre of the tread. */
  position: [number, number, number];
  /** Y rotation aligning the tread across the direction of travel. */
  rotationY: number;
  /** Height of the tread's top face above the floor. */
  top: number;
}

/**
 * `side` is +1 for the right-hand stair and -1 for the left. Angle 0 puts the
 * step at the foot, facing down the hall; 90° puts it at the head, facing the
 * centre.
 */
export function stairSteps(side: 1 | -1): StairStep[] {
  return Array.from({ length: STEP_COUNT }, (_, i) => {
    // Half-step offsets keep the first and last treads clear of the very ends
    // of the arc, where they would overhang the floor and the balcony.
    const angle = ((i + 0.5) / STEP_COUNT) * (Math.PI / 2);
    const x = STAIR_PIVOT[0] + STAIR_RADIUS * Math.cos(angle);
    const z = STAIR_PIVOT[1] - STAIR_RADIUS * Math.sin(angle);
    return {
      position: [side * x, 0, z],
      // Mirroring x reverses the sweep, so the facing has to reverse with it.
      rotationY: side * angle,
      top: (i + 1) * RISER,
    };
  });
}

/** Inner and outer radius of the tread, measured from the pivot. */
export const STAIR_INNER_RADIUS = STAIR_RADIUS - STAIR_WIDTH / 2;
export const STAIR_OUTER_RADIUS = STAIR_RADIUS + STAIR_WIDTH / 2;
export const STAIR_PIVOT_X = STAIR_PIVOT[0];
export const STAIR_PIVOT_Z = STAIR_PIVOT[1];

/**
 * The balcony each stair arrives on, running from the gap over the portal out
 * to the side wall. Its inner end at |x| = 3.5 is what leaves the portal a
 * clear opening to stand in, framed by the two runs.
 */
export const BALCONY_INNER_X = 3.5;
export const BALCONY_OUTER_X = HALL_MAX_X - WALL_THICKNESS / 2;
export const BALCONY_FRONT_Z = -18.4;
export const BALCONY_BACK_Z = HALL_MIN_Z + WALL_THICKNESS / 2;
export const BALCONY_THICKNESS = 0.4;

/* -------------------------------------------------------------------------
   Windows, pilasters, sconces
   ---------------------------------------------------------------------- */

/** Window centres down each side wall — all in the open front half of the room. */
export const WINDOW_Z = [10, 4.5, -1, -6.5];
export const WINDOW_WIDTH = 3.2;
export const WINDOW_SILL = 4.2;
/** Where the straight jambs stop and the semicircular head begins. */
export const WINDOW_SPRING = 9.6;

/** The single tall window on the back wall, centred over the portal. */
export const BACK_WINDOW_WIDTH = 5.4;
export const BACK_WINDOW_SILL = 7.4;
export const BACK_WINDOW_SPRING = 11.4;

export const PILASTER_Z = [12.4, 7.2, 1.8, -3.6, -9];
export const SCONCE_Z = [7, 0, -7];
export const SCONCE_Y = 5.6;

/* -------------------------------------------------------------------------
   Collision
   ---------------------------------------------------------------------- */

/**
 * Inner faces of the hall, given to `CameraRig` so the chase camera pulls in
 * instead of backing through a wall when the visitor turns to face one.
 */
export const CAMERA_BOUNDS = {
  minX: HALL_MIN_X + WALL_THICKNESS + 0.4,
  maxX: HALL_MAX_X - WALL_THICKNESS - 0.4,
  minZ: HALL_MIN_Z + WALL_THICKNESS + 0.4,
  maxZ: HALL_MAX_Z - WALL_THICKNESS - 0.4,
};

const PLAYER_RADIUS = 0.32;
/** Held back far enough from the wall planes to clear the pilasters standing on them. */
const WALL_PAD = 1.9;

interface Circle {
  x: number;
  z: number;
  radius: number;
}

/**
 * Solid things to walk around, as circles.
 *
 * The staircases are in here as one circle per tread rather than as a shape to
 * climb: the shared character controller walks a single ground plane and has no
 * notion of standing on something, so a stair it could enter would be a stair it
 * walked through. They are scenery framing the portal, and this is what makes
 * them read as solid.
 */
const OBSTACLES: Circle[] = [
  { x: TABLE_CENTER[0], z: TABLE_CENTER[1], radius: TABLE_RADIUS + 0.15 },
  ...([1, -1] as const).flatMap((side) =>
    stairSteps(side).map(({ position }) => ({
      x: position[0],
      z: position[2],
      radius: STAIR_WIDTH / 2,
    }))
  ),
];

/**
 * Replacement for `Player`'s default circular field boundary: clamps to the
 * rectangular room, then pushes out of each obstacle along the line from its
 * centre. Circles rather than the library's boxes because everything solid in
 * here is either round (the table) or a short arc segment (a stair tread), and
 * a radial push-out slides around both without the axis-picking that squared-off
 * furniture needs.
 */
export function resolveMansionMove(next: THREE.Vector3): void {
  next.x = THREE.MathUtils.clamp(next.x, HALL_MIN_X + WALL_PAD, HALL_MAX_X - WALL_PAD);
  next.z = THREE.MathUtils.clamp(next.z, HALL_MIN_Z + WALL_PAD, HALL_MAX_Z - WALL_PAD);

  for (const circle of OBSTACLES) {
    const dx = next.x - circle.x;
    const dz = next.z - circle.z;
    const minimum = circle.radius + PLAYER_RADIUS;
    const distance = Math.hypot(dx, dz);
    if (distance >= minimum) continue;

    // Dead centre gives no direction to push along; shove down -Z, back the way
    // most approaches come from, rather than dividing by zero.
    if (distance < 1e-4) {
      next.z = circle.z - minimum;
      continue;
    }
    next.x = circle.x + (dx / distance) * minimum;
    next.z = circle.z + (dz / distance) * minimum;
  }
}
