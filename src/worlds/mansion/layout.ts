import * as THREE from "three";
import { PLAYER_RADIUS, STATURE } from "../../three/figure";
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
/**
 * Raised from 15 to give the back wall room to be read as a composition.
 *
 * Everything on that wall stacks: the doorway out, its doorcase, the "Connect"
 * label over it, and the tall window over that — and at 15 the stack ran out
 * of wall. The window's arch crowned within a hand's breadth of the cornice
 * and its sill sat almost on the label, so the one wall the room is arranged
 * around read as three things crushed together rather than three things
 * arranged. The chandelier's chain is derived from this, so it simply hangs
 * longer.
 */
export const CEILING_HEIGHT = 18.5;
export const WALL_THICKNESS = 1;

export const HALL_WIDTH = HALL_MAX_X - HALL_MIN_X;
export const HALL_DEPTH = HALL_MAX_Z - HALL_MIN_Z;
export const HALL_CENTER_Z = (HALL_MAX_Z + HALL_MIN_Z) / 2;
/**
 * The side walls' inner faces. Each slab is centred on ±HALL_MAX_X, so a metre
 * of masonry runs from ±14 out to ±15 — half a unit further in than
 * `BALCONY_OUTER_X`, the gallery slab having always been carried into the wall
 * so no seam opens along it. Collision reads this rather than the slab's own
 * width: the floor may run into the masonry, the visitor may not.
 */
export const WALL_INNER_X = HALL_MAX_X - WALL_THICKNESS;

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
 * How far short of the disc the trigger counts as contact. Zero: the walker has
 * to touch it, exactly as every other portal on the site is touched.
 *
 * It stood at 1.1 for as long as this disc could not be reached. It hangs 0.6
 * behind BALCONY_FRONT_Z, where the gallery slab's footprint begins, and
 * `mansionGroundHeight` used to report the landing five units up for any point
 * past that line — so a ground-floor step across it read as a climb, and the
 * visitor was held at the edge with the disc a hand's breadth away. Reaching
 * the trigger out to meet him was the workaround.
 *
 * The ground floor runs under the gallery now, right up to the back wall, so
 * the workaround has become the problem: at 1.1 the portal fired a stride and a
 * half out from the plane, which is before the visitor is even under the slab —
 * it would have swallowed him on his way to the space the fix opened up.
 */
export const PORTAL_TRIGGER_REACH = 0;
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

/**
 * How far below the line of the nosings the underside of the flight runs. The
 * flight is a ribbon of stone this thick swept up the quarter turn, rather than
 * a solid block down to the floor — which is what makes it read as a staircase
 * you could stand under, and not as a wall with steps cut in it.
 *
 * Collision reads it as well as the geometry does: standing under the flight is
 * only allowed where this leaves a man's height of headroom, so the number that
 * draws the soffit is the number that decides where he may walk beneath it.
 */
export const SOFFIT_DROP = 0.62;

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
/**
 * Clear of the doorcase's cornice, and short of the window sill above it.
 *
 * It used to sit at +0.62, which was clear of a bare lintel and is no longer
 * clear of anything: the doorcase's cornice tops out at +0.44 and stands a
 * third of a unit proud of the wall, so the word — hung flush on the wall,
 * bobbing down to +0.36 — was inside the moulding rather than above it, and
 * from the gallery the shelf simply covered it.
 *
 * At +0.88 the glyphs run from +0.51 to +1.03 at the bottom of the bob, which
 * clears the cornice by a quarter of a unit and leaves the same again under
 * BACK_WINDOW_SILL. That is the whole of the space there is: the doorcase
 * spends its height below this and the window begins above it.
 */
export const DOOR_LABEL_Y = DOOR_HEAD + 0.88;

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
   Balustrades
   ---------------------------------------------------------------------- */

/**
 * The lines every rail in the hall runs along.
 *
 * They live here rather than in `Staircases.tsx` for the same reason the treads'
 * sweep does: collision has to fence the visitor in along exactly the line the
 * balusters are drawn on, and two copies of these numbers would drift apart the
 * first time one of them was tuned. A rail he can walk through is not a rail,
 * and a rail standing where nothing is drawn is a wall in mid-air.
 */

/** Balusters stand this far in from each edge of a tread, one per tread. */
export const BALUSTER_INSET = 0.2;
export const STAIR_RAIL_INNER_RADIUS = STAIR_INNER_RADIUS + BALUSTER_INSET;
export const STAIR_RAIL_OUTER_RADIUS = STAIR_OUTER_RADIUS - BALUSTER_INSET;

/** How far in from a slab's edge its rail line runs. */
export const RAIL_INSET = 0.18;
export const GALLERY_RAIL_Z = BALCONY_FRONT_Z - RAIL_INSET;
export const WING_RAIL_Z = WING_FRONT_Z - RAIL_INSET;
/** The wings' inner rail line, just inside their walkable edge. */
export const WING_RAIL_X = WING_INNER_X + 0.2;
/** Where the gallery's outer runs stop, a post's width short of the wall. */
export const GALLERY_RAIL_END_X = BALCONY_OUTER_X - 0.2;

/**
 * The head newels: the inner one on the top tread just inside the head line
 * (the landing's front rail dies into it), the outer one on the gallery slab
 * itself, on the gallery's rail line — it is the post the gallery's front rail
 * starts from, and the flight's outer rail sweeps up into the same post, so the
 * balustrade reads as one run from the hall floor to the wall.
 *
 * The outer one stands just past the top tread's outer corner, which is what
 * leaves the half-metre of unfenced edge between it and the wing: the mouth the
 * flight opens onto the gallery through.
 */
export const HEAD_NEWEL_X = STAIR_PIVOT_X + 0.15;
export const OUTER_HEAD_NEWEL_X = STAIR_PIVOT_X + 0.5;

/** The balcony outside, railed on its three open sides. */
export const OUTSIDE_RAIL_Z = OUTSIDE_FRONT_Z + RAIL_INSET;
export const OUTSIDE_RAIL_X = OUTSIDE_HALF_WIDTH - RAIL_INSET;

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
 * through, and then 9.8, which cleared the head but left the glass sitting on
 * top of the label — a sixth of a unit between the two — with the arch crowding
 * the cornice above it.
 *
 * At 11.3 it stands clear of the label by a unit and a half and finishes a unit
 * and a half under the cornice, which is what lets the whole window be seen as
 * a window. The shaft keeps its 1.8, so the arch is the same arch, just carried
 * up; the extra room comes from the ceiling above rather than from stretching
 * the opening.
 */
export const BACK_WINDOW_WIDTH = 4.6;
export const BACK_WINDOW_SILL = 11.3;
export const BACK_WINDOW_SPRING = 13.1;

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

/** Held back far enough from the wall planes to clear the pilasters standing on them. */
const WALL_PAD = 1.9;

/**
 * Headroom the flight has to leave before the visitor may walk under it: his
 * full height, plus a little so his hair clears rather than grazes.
 *
 * This is what makes the space under a flight a place rather than a solid. The
 * soffit meets the floor a few steps up from the foot, so the near end of each
 * sweep is stone all the way down and the far end is a vaulted corner of the
 * room — and the line between them is exactly where this much clearance appears.
 */
const HEADROOM = STATURE + 0.12;

/**
 * How far above his feet a surface may be and still count as the one he is
 * standing on.
 *
 * This answers "which floor is he on", which is a different question from "may
 * he take this step" — MAX_STEP below is that one, and it is five times
 * tighter. They have to be separate numbers. A reach strict enough to be a step
 * limit would lose him the floor under a flight the moment a fast frame carried
 * him up two risers at once; a reach loose enough to survive that would let the
 * ground floor claim the gallery five units overhead. One unit sits in the gap:
 * a riser is a fifth of it, and the lowest tread he can ever stand *under* is
 * two and a half times it, because anything lower has no headroom to stand in.
 *
 * `resolveMansionMove` holds itself to this as well — a frame never changes his
 * level by more than one reach — so the surface he ends a frame on is always a
 * surface this rule can still recognise on the next one.
 */
const LEVEL_REACH = 1;

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
 * How far the walk is advanced between collision tests.
 *
 * The pass used to resolve a frame's whole stride in one go, and that made
 * climbing a race between the stride and the tread. At the top of the speed
 * slider a stride is 0.39 units, while the treads along the inner balustrade
 * are 0.28 deep — so a single frame crossed two nosings, the rise came to two
 * risers, MAX_STEP refused it, and the flight simply stopped taking the
 * visitor: worse the faster he walked, worse again on a slow frame, and worst
 * where the turn is tightest. Walking the stride in pieces no larger than this
 * makes the climb come out the same at any frame rate, and it is also what
 * stops a fast stride stepping clean over a balustrade before anything has had
 * a chance to push back on it.
 */
const SUBSTEP = 0.09;
/**
 * Never more than this many tests in one frame, however long the frame ran.
 * Twenty-four covers a 2.1-unit stride at full precision — three times the
 * longest a 60 Hz frame can produce at the top of the slider.
 */
const MAX_SUBSTEPS = 24;

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

/* --- The flights, in their own polar frame ------------------------------- */

/**
 * Where a point falls on one flight: which step, how far round the sweep, and
 * how far out from the pivot.
 *
 * Filled into a shared record rather than returned as a fresh one — this runs a
 * few dozen times a frame and allocating for it would be litter. The record is
 * only valid until the next call, which is all any caller here needs.
 */
const stairPoint = {
  /** +1 for the right-hand flight, -1 for the left. */
  side: 1 as 1 | -1,
  /** Distance from the flight's pivot. */
  radius: 0,
  /** Sweep from the foot: 0 at the first riser, π/2 at the head. */
  angle: 0,
  /** Which step the point falls on, counting from 0 at the foot. */
  index: 0,
};

/**
 * Whether a point lies within a flight's footprint — on a tread, or on the
 * floor under one — and if so, where. `side` mirrors x back onto the right-hand
 * flight, so one piece of arithmetic serves both, the same trick the geometry
 * uses to build them.
 */
function flightAt(x: number, z: number): typeof stairPoint | null {
  for (const side of [1, -1] as const) {
    const dx = side * x - STAIR_PIVOT_X;
    const dz = z - STAIR_PIVOT_Z;
    const radius = Math.hypot(dx, dz);
    if (radius < STAIR_INNER_RADIUS || radius > STAIR_OUTER_RADIUS) continue;

    // A step sits at (pivot.x + R·cos a, pivot.z − R·sin a), so this inverts
    // that: the sweep runs from a = 0 at the foot to a = π/2 at the head.
    const angle = Math.atan2(-dz, dx);
    if (angle < 0 || angle > Math.PI / 2) continue;

    stairPoint.side = side;
    stairPoint.radius = radius;
    stairPoint.angle = angle;
    stairPoint.index = Math.min(STEP_COUNT - 1, Math.floor(angle / STEP_ANGLE));
    return stairPoint;
  }
  return null;
}

/**
 * Top face of a step. The same rule the geometry is built from, so the surface
 * walked on is the surface drawn rather than a ramp approximating it.
 */
const treadTop = (index: number): number => (index + 1) * RISER;

/**
 * The underside of the flight partway up the sweep: the line through the
 * nosings, less the thickness of the ribbon of stone carrying them, and never
 * below the floor it runs down to meet. Again the rule `Staircases.tsx` builds
 * the soffit from, so the headroom tested is the headroom drawn.
 */
const soffitHeight = (angle: number): number =>
  Math.max(0, RISER * (angle / STEP_ANGLE + 1) - SOFFIT_DROP);

/* --- What is underfoot --------------------------------------------------- */

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
 * The structure standing over a point, if any: a tread where a flight passes,
 * a landing where the gallery, the wings, the doorway or the balcony do.
 *
 * The flights are tested first because they overlap the gallery at the one
 * corner where they arrive on it.
 */
function upperSurfaceAt(x: number, z: number): number | null {
  const flight = flightAt(x, z);
  if (flight) return treadTop(flight.index);
  return onUpperFloor(x, z) ? LANDING_Y : null;
}

/**
 * The hall floor at a point, or null where there is no floor to stand on: out
 * past the back wall, where the balcony hangs over a cliff, and under the low
 * end of a flight, where the soffit comes down to meet the tiles.
 */
function groundFloorAt(x: number, z: number): number | null {
  if (isOutside(z)) return null;
  const flight = flightAt(x, z);
  if (flight && soffitHeight(flight.angle) < HEADROOM) return null;
  return 0;
}

/**
 * The height of the walkable surface under a character whose feet are at
 * `fromY`: the floor, a stair tread, or a balcony slab.
 *
 * The height alone is what makes this answerable. A point in this hall has two
 * surfaces over much of its plan — the gallery runs over the portal, each
 * flight runs over a corner of the room — and which one is underfoot depends
 * entirely on which level the character is already on. Reporting the topmost
 * one regardless, as this used to, is what walled off the whole of the ground
 * floor beneath the stairs and the gallery: from down there a step in any of
 * those directions read as a five-unit climb, and `resolveMansionMove` refused
 * it. So the rule is the highest surface within one LEVEL_REACH of his feet,
 * and where nothing is within reach, whatever is there — which will be a rise
 * or a drop the move rule then refuses.
 *
 * `fromY` defaults to unbounded, which reproduces the old topmost-surface
 * answer for any caller that has no character to ask about.
 */
export function mansionGroundHeight(
  x: number,
  z: number,
  fromY = Number.POSITIVE_INFINITY
): number {
  const upper = upperSurfaceAt(x, z);
  if (upper !== null && upper <= fromY + LEVEL_REACH) return upper;
  const floor = groundFloorAt(x, z);
  if (floor !== null) return floor;
  return upper ?? 0;
}

/* --- The rails ----------------------------------------------------------- */

/** A rail run in plan: the line its posts stand along. */
interface Rail {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/** A run and its mirror image on the other side of the hall. */
const bothSides = (rail: Rail): Rail[] => [
  rail,
  { x1: -rail.x1, z1: rail.z1, x2: -rail.x2, z2: rail.z2 },
];

/**
 * Everything at gallery height that the visitor cannot pass through.
 *
 * The rise rule on its own is not a balustrade. It measures at the character's
 * centre, so it let him stand with his centre on the very lip of the slab and
 * the rest of him hanging through the rail — and where two walkable levels meet
 * flush, as the wings and the gallery do, it says nothing at all. These are the
 * rails themselves, as the segments they are drawn along, and he is held a body
 * clear of every one.
 *
 * What is *not* here matters as much as what is. There is no run across the
 * wings' outer sides, because one riser below them is the flight and that is
 * the way down; and the gallery's own front rail stops short on either side of
 * each stair mouth for the same reason. Those two gaps are the route between
 * the levels, and fencing them would fence off the staircase.
 */
const UPPER_RAILS: Rail[] = [
  // The gallery's front balustrade: the run across the middle, and one from
  // each flight's outer head newel out to the wall.
  { x1: -WING_RAIL_X, z1: GALLERY_RAIL_Z, x2: WING_RAIL_X, z2: GALLERY_RAIL_Z },
  ...bothSides({
    x1: OUTER_HEAD_NEWEL_X,
    z1: GALLERY_RAIL_Z,
    x2: GALLERY_RAIL_END_X,
    z2: GALLERY_RAIL_Z,
  }),

  // Each wing landing: the stub across its front, dying into the flight's inner
  // head newel, and the return down its inner side to the gallery's rail.
  ...bothSides({ x1: WING_RAIL_X, z1: WING_RAIL_Z, x2: HEAD_NEWEL_X, z2: WING_RAIL_Z }),
  ...bothSides({ x1: WING_RAIL_X, z1: WING_RAIL_Z, x2: WING_RAIL_X, z2: GALLERY_RAIL_Z }),

  // The masonry the gallery runs into, which stops him as surely as any rail:
  // the side walls' inner faces, the back wall either side of the doorway, and
  // the doorway's own reveals, which carry through the metre of wall and out
  // onto the balcony. The gallery slab is built half a unit into the side walls
  // and the rise rule cannot see that, so without these he walks into the stone.
  ...bothSides({ x1: WALL_INNER_X, z1: BALCONY_BACK_Z, x2: WALL_INNER_X, z2: BALCONY_FRONT_Z }),
  ...bothSides({ x1: DOOR_HALF_WIDTH, z1: BALCONY_BACK_Z, x2: WALL_INNER_X, z2: BALCONY_BACK_Z }),
  ...bothSides({ x1: DOOR_HALF_WIDTH, z1: BALCONY_BACK_Z, x2: DOOR_HALF_WIDTH, z2: HALL_MIN_Z }),
  ...bothSides({ x1: DOOR_HALF_WIDTH, z1: HALL_MIN_Z, x2: OUTSIDE_HALF_WIDTH, z2: HALL_MIN_Z }),

  // And the balcony's own three runs.
  { x1: -OUTSIDE_HALF_WIDTH, z1: OUTSIDE_RAIL_Z, x2: OUTSIDE_HALF_WIDTH, z2: OUTSIDE_RAIL_Z },
  ...bothSides({ x1: OUTSIDE_RAIL_X, z1: OUTSIDE_FRONT_Z, x2: OUTSIDE_RAIL_X, z2: HALL_MIN_Z }),
];

/**
 * The position under test, shared by the whole pass rather than allocated per
 * sub-step.
 */
const point = { x: 0, z: 0 };

/** Pushes `point` back out of a rail it has walked into. */
function pushOffRail(rail: Rail): void {
  const ax = rail.x2 - rail.x1;
  const az = rail.z2 - rail.z1;
  const length = Math.hypot(ax, az);
  // Nearest point on the run, clamped to its ends so a corner post pushes him
  // round it instead of past it.
  const t = Math.min(1, Math.max(0, ((point.x - rail.x1) * ax + (point.z - rail.z1) * az) / (length * length)));
  const nearX = rail.x1 + ax * t;
  const nearZ = rail.z1 + az * t;
  const dx = point.x - nearX;
  const dz = point.z - nearZ;
  const distance = Math.hypot(dx, dz);
  if (distance >= PLAYER_RADIUS) return;

  if (distance < 1e-4) {
    // Dead on the line, with no side to be pushed towards. Step out along the
    // rail's normal; a sub-step is far shorter than his radius, so the side he
    // has to be on is the side he was on a moment ago.
    point.x = nearX - (az / length) * PLAYER_RADIUS;
    point.z = nearZ + (ax / length) * PLAYER_RADIUS;
    return;
  }
  point.x = nearX + (dx / distance) * PLAYER_RADIUS;
  point.z = nearZ + (dz / distance) * PLAYER_RADIUS;
}

/**
 * Holds `point` inside whatever fences the level it is on: the room's rectangle
 * downstairs, the balustrades and masonry upstairs, the flight's own two rails
 * while he is on a flight, and the furniture wherever it stands.
 */
function constrain(level: number): void {
  if (level < LANDING_Y - LEVEL_REACH) {
    // The rectangular clamp is the boundary for everything below the gallery —
    // the floor and both flights, which stand well inside it. Up on the gallery
    // it would hold the visitor a wall's thickness short of the doorway and
    // there would be no way out, so up there the rails are the boundary.
    point.x = THREE.MathUtils.clamp(point.x, HALL_MIN_X + WALL_PAD, HALL_MAX_X - WALL_PAD);
    point.z = THREE.MathUtils.clamp(point.z, HALL_MIN_Z + WALL_PAD, HALL_MAX_Z - WALL_PAD);
  } else {
    for (const rail of UPPER_RAILS) pushOffRail(rail);
  }

  // The flights' balustrades, worked in the flight's own polar frame: one rail
  // a fixed distance out from the pivot, the other a fixed distance in, so the
  // walkable band is an annulus and stepping toward either edge slides him
  // along it rather than through it.
  //
  // The test is on the tread being within reach of his feet, which is what
  // keeps the fence on the stair where the balusters actually stand. Walking
  // the floor *under* a flight puts him inside the same footprint with the
  // treads metres over his head, and there is nothing down there to fence.
  const flight = flightAt(point.x, point.z);
  if (flight && treadTop(flight.index) <= level + LEVEL_REACH) {
    const held = THREE.MathUtils.clamp(
      flight.radius,
      STAIR_RAIL_INNER_RADIUS + PLAYER_RADIUS,
      STAIR_RAIL_OUTER_RADIUS - PLAYER_RADIUS
    );
    if (held !== flight.radius) {
      point.x = flight.side * (STAIR_PIVOT_X + held * Math.cos(flight.angle));
      point.z = STAIR_PIVOT_Z - held * Math.sin(flight.angle);
    }
  }

  for (const circle of OBSTACLES) {
    const dx = point.x - circle.x;
    const dz = point.z - circle.z;
    const minimum = circle.radius + PLAYER_RADIUS;
    const distance = Math.hypot(dx, dz);
    if (distance >= minimum) continue;

    // Dead centre gives no direction to push along; shove down -Z, back the way
    // most approaches come from, rather than dividing by zero.
    if (distance < 1e-4) {
      point.z = circle.z - minimum;
      continue;
    }
    point.x = circle.x + (dx / distance) * minimum;
    point.z = circle.z + (dz / distance) * minimum;
  }
}

/**
 * Replacement for `Player`'s default circular field boundary: walks the frame's
 * stride in short pieces, fencing each one in and refusing any that would climb
 * or drop more than a single riser.
 *
 * `current` is where the character is standing this frame and `fromSurface` is
 * what he is standing *on*. The height rules need both — a candidate position
 * alone says how high the ground there is, but not whether getting to it means
 * stepping up a stair, ducking under one, or walking off a balcony.
 *
 * The stride is resolved in pieces rather than whole because a stair is only
 * climbable one riser at a time and a stride can be longer than a tread; see
 * SUBSTEP. Where a piece is refused the walk simply ends there, keeping
 * everything it managed before: a stringer and a balustrade are what this is
 * standing in for, and you stop against those rather than slide along them.
 */
export function resolveMansionMove(
  next: THREE.Vector3,
  current: THREE.Vector3,
  fromSurface = mansionGroundHeight(current.x, current.z)
): void {
  const dx = next.x - current.x;
  const dz = next.z - current.z;
  const pieces = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(Math.hypot(dx, dz) / SUBSTEP)));

  let x = current.x;
  let z = current.z;
  let level = fromSurface;

  for (let i = 0; i < pieces; i++) {
    point.x = x + dx / pieces;
    point.z = z + dz / pieces;
    constrain(level);

    const to = mansionGroundHeight(point.x, point.z, level);
    if (Math.abs(to - level) > MAX_STEP) break;
    // And the frame as a whole stays inside one reach of where it started, so
    // the level `Player` reads back afterwards is one this ground rule can
    // still recognise. Only a frame long enough to carry him up six risers at
    // once ever meets it, and there it costs him the tail of one stride.
    if (Math.abs(to - fromSurface) > LEVEL_REACH) break;

    x = point.x;
    z = point.z;
    level = to;
  }

  next.x = x;
  next.z = z;
}
