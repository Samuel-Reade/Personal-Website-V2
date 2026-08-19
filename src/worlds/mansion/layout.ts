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
 * How far short of the disc the trigger already counts as contact.
 *
 * Everywhere else a portal fires when the walker touches it. This disc cannot
 * be touched: it stands 0.6 behind BALCONY_FRONT_Z, and the gallery slab's
 * footprint begins there — `mansionGroundHeight` reports the landing five units
 * up for any point past it, so a ground-floor step across that line reads as a
 * climb and `resolveMansionMove` refuses it. The visitor is held at the edge,
 * 0.6 from the plane at best and a stride further on a slow frame, with the
 * disc a hand's breadth out of reach.
 *
 * So the touch surface is brought out to meet them. 1.1 plus the walker's 0.32
 * footprint fires at 1.42 from the plane — the same head-on distance the old
 * 1.4-unit trigger circle gave, so nothing about walking straight in has
 * changed — but now across the disc's full width rather than only its middle,
 * and with slack for a stride of up to 0.8 before the edge stops them.
 */
export const PORTAL_TRIGGER_REACH = 1.1;
/**
 * Vertical half-height of the trigger. The portal fires on contact with its
 * disc, and the hall is the one ground world where that needs a vertical bound:
 * the gallery runs directly over the portal, and with the default unlimited
 * column, crossing the balcony overhead — feet at 5.4, a rise of 3.5 from the
 * disc's centre — walked the visitor into the meadow through the floor. 2.6
 * keeps the ground approach (a rise of 1.9) comfortably inside and everything
 * upstairs out.
 */
export const PORTAL_TRIGGER_HEIGHT = 2.6;

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
/**
 * Thirty, up from fifteen. A unit is a metre, and fifteen risers to a 5.4
 * landing made each one 34cm tall and every tread most of a metre deep — a
 * flight of blocks, not of stairs. Thirty puts the riser at 17cm and the tread
 * at about 37cm along the centre line, which is what a stair you would actually
 * walk up measures, and it is the single number most of the flight's realism
 * comes off. Everything else — the walkable height under the character, the
 * limit on how much he may step up at once, the geometry — derives from it.
 */
export const STEP_COUNT = 30;
/**
 * One more riser than there are steps: the last step lands one riser *below*
 * the balcony rather than flush with it, so the two slabs never end up coplanar
 * and z-fighting along the join.
 */
export const RISER = LANDING_Y / (STEP_COUNT + 1);
/**
 * Widened from 3.4 now that these are climbed rather than looked at. A flight
 * you walk needs to read as generous under the character — at the old width the
 * balustrade and the stringer between them left barely a body's clearance, and
 * a visitor hugging either edge looked like they were squeezing past furniture.
 */
export const STAIR_WIDTH = 4.4;

/**
 * Each stair is a quarter turn: it starts mid-hall against a side wall facing
 * into the room, and sweeps 90° inward and upward to arrive at the back wall
 * facing the centre. Both are generated from the right-hand one by mirroring x,
 * rather than by scaling a group by -1 — a negative scale flips triangle winding,
 * which flat shading shows up immediately as a stair lit from inside.
 *
 * The pivot has moved in twice: from 5.5 to 5.0 when the flights widened, and
 * from 5.0 to 4.3 when they grew a balustrade on the outer edge. The outer
 * edge of a tread sits at pivot + radius + half the width; the side wall's
 * inner face is at 14.0 and its dado a little proud of that, so at 5.0 the
 * outer edge (14.2) ran inside the masonry and anything on it — the rail, the
 * newel at the foot — stood in the wall. At 4.3 the edge is at 13.5 and the
 * balustrade line at 13.3, clear of the dado, which is what lets the outer
 * rail run the whole way down to a newel on the floor beside the inner one.
 *
 * It then moved forward from -12 to -9.2, which pulled the whole flight out
 * from under the gallery. At -12 the head's tread strip ran to z = -21.2 —
 * nearly three units past the slab's front edge — so the top of every climb
 * disappeared into the balcony and came out clipping through its underside.
 * At -9.2 the strip's deep corner lands at pivot − outer radius = -18.4,
 * which is exactly the slab front: the last stair and the balcony line up,
 * and no tread anywhere sits under the floor above it.
 */
const STAIR_PIVOT: [number, number] = [4.3, -9.2];
const STAIR_RADIUS = 7;

/**
 * The angle each step sweeps through. Step i occupies angles [i, i+1] × this,
 * measured from the foot (0, facing down the hall) to the head (90°, facing the
 * centre), and its tread's top face is (i + 1) risers up. `Staircases.tsx`
 * builds the geometry from exactly this rule and `treadHeightAt` below reads
 * the walkable height from it, so the surface walked on is the surface drawn.
 */
export const STEP_ANGLE = Math.PI / 2 / STEP_COUNT;

/** Inner and outer radius of the tread, measured from the pivot. */
export const STAIR_INNER_RADIUS = STAIR_RADIUS - STAIR_WIDTH / 2;
export const STAIR_OUTER_RADIUS = STAIR_RADIUS + STAIR_WIDTH / 2;
export const STAIR_PIVOT_X = STAIR_PIVOT[0];
export const STAIR_PIVOT_Z = STAIR_PIVOT[1];

/**
 * The gallery the two flights arrive on: one continuous run along the back wall,
 * wall to wall.
 *
 * It used to be two balconies with a gap over the portal between them, which
 * made the head of each flight a dead end. Carrying it across the middle joins
 * them into one landing you can walk the whole width of — which is what a double
 * stair is for — and puts the doorway at its centre, reachable from either side.
 *
 * The portal below is untouched. The slab passes three and a half units over the
 * top of its disc, so the gap it used to stand in is now a soffit above it
 * rather than open air, and it still reads as framed by the two flights from the
 * floor of the hall.
 */
export const BALCONY_OUTER_X = HALL_MAX_X - WALL_THICKNESS / 2;
/**
 * The gallery's main front edge. It stops one bay short of the portal below on
 * purpose: the walk to the portal ends against this line's invisible wall, and
 * from here that is 0.6 units from the portal's centre — inside its 1.4
 * trigger. The slab was once carried out to -16.6 to catch the stair heads,
 * and that was how the portal got blocked: the wall moved to 2.4 out and
 * nobody could walk close enough to leave. The heads are caught by the wings
 * below instead, which project only where the stairs are.
 */
export const BALCONY_FRONT_Z = -18.4;

/**
 * The wing landings: a platform running forward from the gallery along each
 * stair head, so stepping off the top tread toward the centre lands on floor.
 * The head is the radial line at x = ±STAIR_PIVOT_X, spanning z ≈ -14.0 to
 * -18.4 now that the flights stand clear of the slab.
 *
 * The outer edge is not a taste choice — it *is* the head line, x = ±pivot. A
 * tread is walkable only up to 90° of sweep, which is that plane, so the
 * landing's side face sits exactly where the walkable stair ends: the top
 * tread runs flat against it and the landing reads as the final riser, one
 * riser-height above the tread, with nothing roofing any part of the flight.
 *
 * The landing is 2.4 deep. It was an 0.8 shelf: from the top of the flight
 * its own rail stood right across your path and the way to the gallery was a
 * sidestep along a ledge. Now it is a landing you arrive on and walk across,
 * and the flight visibly joins the gallery.
 */
export const WING_OUTER_X = STAIR_PIVOT_X;
export const WING_INNER_X = WING_OUTER_X - 2.4;
export const WING_FRONT_Z = -13.8;
/**
 * Stops at the wall's inner face rather than at its centre line. The wall is a
 * metre thick and the doorway is the only way through it — a gallery running
 * into the middle of the masonry would be a gallery you could walk into the wall
 * from, anywhere along its length.
 */
export const BALCONY_BACK_Z = HALL_MIN_Z + WALL_THICKNESS;
export const BALCONY_THICKNESS = 0.4;

/* -------------------------------------------------------------------------
   The doorway out, and the balcony beyond it
   ---------------------------------------------------------------------- */

/**
 * The opening cut through the back wall at gallery level, dead centre.
 *
 * This is the one place in the hall where the outside is genuinely seen. Every
 * window is a flat panel drawn on the wall — there was no exterior to look at —
 * so this doorway is what the cliff and the sea beyond it exist for.
 */
export const DOOR_HALF_WIDTH = 1.7;
export const DOOR_SILL = LANDING_Y;
export const DOOR_HEIGHT = 3.1;
export const DOOR_HEAD = DOOR_SILL + DOOR_HEIGHT;

/** Cap height of the "Connect" label riding over the doorway — see `displaySize`. */
export const DOOR_LABEL_CAP_HEIGHT = 0.38;
/** Clear of the head, and short of the window sill above it. */
export const DOOR_LABEL_Y = DOOR_HEAD + 0.62;

/**
 * The open balcony outside, cantilevered off the back of the house over the
 * cliff. Walkable at gallery height, so stepping through the doorway is a step
 * onto the same level rather than a drop.
 */
export const OUTSIDE_HALF_WIDTH = 4.6;
export const OUTSIDE_FRONT_Z = HALL_MIN_Z - 5.6;
export const OUTSIDE_BACK_Z = HALL_MIN_Z;

/**
 * Where the telescope stands: near the front rail, right of centre so the walk
 * out of the doorway isn't straight into it. Both the model and its collision
 * circle read these, so moving the telescope moves what you bump into.
 */
export const TELESCOPE_X = 1.9;
export const TELESCOPE_Z = OUTSIDE_FRONT_Z + 1.5;

/** The bench along the balcony's left rail — again shared with its collision. */
export const BENCH_X = -OUTSIDE_HALF_WIDTH + 0.85;
export const BENCH_Z = OUTSIDE_FRONT_Z + 3.2;

/* -------------------------------------------------------------------------
   Windows, pilasters, sconces
   ---------------------------------------------------------------------- */

/** Window centres down each side wall — all in the open front half of the room. */
export const WINDOW_Z = [10, 4.5, -1, -6.5];
export const WINDOW_WIDTH = 3.2;
export const WINDOW_SILL = 4.2;
/** Where the straight jambs stop and the semicircular head begins. */
export const WINDOW_SPRING = 9.6;

/**
 * The single tall window on the back wall, centred over the portal — and now
 * over the doorway out as well, which is what moved it.
 *
 * Its sill was at 7.4, which the doorway's head at 8.5 would have run straight
 * through. Lifting it to 9.8 leaves room for the head, the label riding above
 * it, and a band of masonry between the two. It narrowed by the same stroke: at
 * the old width its arch crowned at 14.1, exactly where the cornice runs, and
 * the shorter shaft left by a higher sill wants a narrower opening anyway.
 */
export const BACK_WINDOW_WIDTH = 4.6;
export const BACK_WINDOW_SILL = 9.8;
export const BACK_WINDOW_SPRING = 11.6;

export const PILASTER_Z = [12.4, 7.2, 1.8, -3.6, -9];
/**
 * The sconces hang on the middle three pilasters — the piers *between* the
 * windows, which is where a wall light goes. They used to sit at 7, 0 and -7,
 * and two of those were on the glass.
 */
export const SCONCE_Z = [7.2, 1.8, -3.6];
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

/**
 * The camera's box while the visitor is out on the balcony.
 *
 * Swapped in rather than merged with the interior one, because the constraint
 * reverses the moment you step outside. Indoors the job is to stop the boom
 * backing out through the rear wall; outdoors it is to stop it backing *in*
 * through the same wall, which is what would happen the instant you turned to
 * face the house. One box cannot say both, so the hall carries two and hands the
 * rig whichever side of the wall the visitor is on.
 */
export const OUTSIDE_CAMERA_BOUNDS = {
  minX: -OUTSIDE_HALF_WIDTH + 0.4,
  maxX: OUTSIDE_HALF_WIDTH - 0.4,
  minZ: OUTSIDE_FRONT_Z + 0.4,
  maxZ: HALL_MIN_Z - 0.2,
};

/** Whether the visitor is past the back wall, i.e. out on the balcony. */
export function isOutside(z: number): boolean {
  return z < HALL_MIN_Z;
}

const PLAYER_RADIUS = 0.32;
/** Held back far enough from the wall planes to clear the pilasters standing on them. */
const WALL_PAD = 1.9;
/**
 * How far the walkable balcony stops short of the slab edge. The balustrade
 * stands 0.18 in from it, and the rise rule alone lets the character's centre
 * reach the very edge — which put half his body through the rail. Rail line
 * plus his radius plus a small clearance keeps him inside it.
 */
const RAIL_INSET = 0.6;

interface Circle {
  x: number;
  z: number;
  radius: number;
}

/**
 * Solid things to walk around, as circles.
 *
 * Only the table now. The staircases used to be in here as one collision circle
 * per tread — not as something to climb but as something to keep the visitor
 * out of, because the shared controller walked a single ground plane and a stair
 * it could enter was a stair it walked through. `mansionGroundHeight` below
 * replaces that: the flights are a surface now, so fencing them off would be
 * fencing off the way upstairs.
 */
const OBSTACLES: Circle[] = [
  { x: TABLE_CENTER[0], z: TABLE_CENTER[1], radius: TABLE_RADIUS + 0.15 },
  // The balcony furniture. Small circles, but without them the visitor walks
  // straight through the one object out there they are meant to reach for.
  { x: TELESCOPE_X, z: TELESCOPE_Z, radius: 0.65 },
  { x: BENCH_X, z: BENCH_Z, radius: 0.75 },
];

/**
 * Height of the tread under a point, or null if the point is off the flight.
 *
 * Works in the stair's own polar frame. `side` mirrors x back onto the
 * right-hand flight, so one piece of arithmetic serves both — the same trick
 * the geometry uses to build them.
 */
function treadHeightAt(side: 1 | -1, x: number, z: number): number | null {
  const dx = side * x - STAIR_PIVOT_X;
  const dz = z - STAIR_PIVOT_Z;
  const radius = Math.hypot(dx, dz);
  if (radius < STAIR_INNER_RADIUS || radius > STAIR_OUTER_RADIUS) return null;

  // A step sits at (pivot.x + R·cos a, pivot.z − R·sin a), so this inverts
  // that: the sweep runs from a = 0 at the foot to a = π/2 at the head.
  const angle = Math.atan2(-dz, dx);
  if (angle < 0 || angle > Math.PI / 2) return null;

  const index = Math.min(STEP_COUNT - 1, Math.floor(angle / STEP_ANGLE));
  // The same rule the geometry is built from, so the surface walked on is the
  // surface drawn rather than a ramp approximating it.
  return (index + 1) * RISER;
}

/**
 * Whether a point is on the upper level: the gallery inside, the wing landing
 * at either stair mouth, the threshold of the doorway, or the balcony beyond.
 *
 * The four are deliberately separate boxes rather than one. The wall between
 * the gallery and the outside is a metre of masonry, and only the doorway's own
 * width crosses it — which is what makes the opening the way out rather than the
 * whole back of the room being one. The wings are the same idea at the front:
 * the slab reaches past its own edge only where a flight arrives on it.
 */
function onUpperFloor(x: number, z: number): boolean {
  const lx = Math.abs(x);
  const gallery = lx <= BALCONY_OUTER_X && z >= BALCONY_BACK_Z && z <= BALCONY_FRONT_Z;
  const wing =
    lx >= WING_INNER_X && lx <= WING_OUTER_X && z >= BALCONY_FRONT_Z && z <= WING_FRONT_Z;
  const threshold = lx <= DOOR_HALF_WIDTH && z >= HALL_MIN_Z && z <= BALCONY_BACK_Z;
  const outside = lx <= OUTSIDE_HALF_WIDTH && z >= OUTSIDE_FRONT_Z && z <= OUTSIDE_BACK_Z;
  return gallery || wing || threshold || outside;
}

/**
 * The height of the walkable surface under any point in the hall: the floor, a
 * stair tread, or a balcony slab.
 *
 * Handed to `Player` so the character stands on what is under him instead of on
 * y = 0. The two flights are tested before the balcony because they overlap it
 * where they arrive — a tread at the head of the sweep sits inside the slab's
 * footprint, and taking the tread there is what makes the last step onto the
 * balcony a single riser rather than a jump of one.
 */
export function mansionGroundHeight(x: number, z: number): number {
  for (const side of [1, -1] as const) {
    const tread = treadHeightAt(side, x, z);
    if (tread !== null) return tread;
  }
  return onUpperFloor(x, z) ? LANDING_Y : 0;
}

/**
 * The tallest rise the character will walk up or down in one step.
 *
 * A shade over one riser, which is the whole point: climbing a flight is a
 * sequence of single-riser rises and passes, while stepping from the floor
 * straight onto a balcony five units up does not — so the stairs become the only
 * way to the top, without anything having to be fenced off. The same limit going
 * down stops him strolling off a balcony edge into thin air, which the
 * balustrade already says he cannot do.
 */
const MAX_STEP = RISER + 0.16;

/**
 * Replacement for `Player`'s default circular field boundary: clamps to the
 * rectangular room, pushes out of the table, and then refuses any move that
 * would climb or drop more than a single riser.
 *
 * `current` is where the character is standing this frame. The height rules need
 * it — a candidate position alone says how high the ground *there* is, but not
 * whether getting to it means stepping up a stair or off a balcony.
 */
export function resolveMansionMove(next: THREE.Vector3, current: THREE.Vector3): void {
  const from = mansionGroundHeight(current.x, current.z);

  // The rectangular clamp is the ground floor's boundary and only the ground
  // floor's: upstairs it would hold the visitor a wall's thickness short of the
  // doorway and there would be no way out. Up there the ground height is the
  // boundary — step off the gallery and the surface drops five units, which the
  // rise limit below refuses — so no second cage is needed.
  if (from < 0.05) {
    next.x = THREE.MathUtils.clamp(next.x, HALL_MIN_X + WALL_PAD, HALL_MAX_X - WALL_PAD);
    next.z = THREE.MathUtils.clamp(next.z, HALL_MIN_Z + WALL_PAD, HALL_MAX_Z - WALL_PAD);
  }

  // The balustrade, as a boundary rather than a height rule. The rise limit
  // below already refuses the step off the slab, but it measures at the
  // character's centre — which let him stand with his centre on the very edge
  // and his body through the rail. Out here the rails are the cage.
  if (isOutside(next.z)) {
    next.x = THREE.MathUtils.clamp(
      next.x,
      -(OUTSIDE_HALF_WIDTH - RAIL_INSET),
      OUTSIDE_HALF_WIDTH - RAIL_INSET
    );
    next.z = Math.max(next.z, OUTSIDE_FRONT_Z + RAIL_INSET);
  }

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

  const to = mansionGroundHeight(next.x, next.z);
  if (Math.abs(to - from) > MAX_STEP) {
    // Hold position rather than sliding along the obstruction. A stringer and a
    // balustrade are what this is standing in for, and neither is something you
    // slide along — you stop against them.
    next.x = current.x;
    next.z = current.z;
  }
}
