import { createBodyGeometry, type BodyRing } from "./bodyGeometry";

/**
 * One man's proportions, shared by every world he appears in.
 *
 * He is built three times over — walking the meadow and the library
 * (`three/Player.tsx`), rowing the bay (`worlds/projects/Boat.tsx`) and floating
 * the system in a pressure suit (`worlds/techstack/Astronaut.tsx`) — because the
 * three need different poses, different materials and different levels of
 * faceting, and one component cannot be all of that. What they must not have is
 * different *bodies*: the whole conceit is that this is the person who walked
 * into the portal. Each of those files used to carry its own copy of the
 * numbers, with comments promising they matched, and they did not.
 *
 * So the skeleton and the profiles live here and the three consume them. Nothing
 * in this module renders anything — it is a set of measurements.
 *
 * The measurements are not eyeballed. The world is metric and he stands 1.97, so
 * each joint below is the standard anthropometric fraction of stature multiplied
 * out. Working from the fractions is what gets thigh and shin within a
 * centimetre of each other and puts his fingertips at mid-thigh, both of which
 * the eye reads instantly and neither of which is obvious to guess.
 */

/** Greater trochanter, at 0.53 of stature. */
export const HIP_Y = 1.05;
/** Hip to knee, landing the joint at 0.29 of stature. */
export const KNEE_DROP = 0.48;
/** Knee to ankle, landing it at 0.05. */
export const ANKLE_DROP = 0.47;
export const SHOULDER_Y = 1.558;
/** Shoulder to elbow, at 0.63 of stature. */
export const ELBOW_DROP = 0.313;
/** Elbow to the end of the jacket sleeve, at the wrist — 0.49 of stature. */
export const WRIST_DROP = 0.27;
/** Base of the skull, where the head nods from. */
export const HEAD_PIVOT_Y = 1.71;
/** Sole to instep. */
export const SHOE_HEIGHT = 0.115;

/**
 * Half the distance between the leg centres, and between the shoulder pivots.
 *
 * Hip breadth is measured across the tops of the thighs, so the legs have to sit
 * close enough together that two thigh-widths span it. Over the deltoids he
 * spans 0.52, or 0.26 of stature, which is a broad-shouldered man.
 */
export const LEG_X = 0.088;
export const SHOULDER_X = 0.183;

/**
 * How far the arms hang away from the body, in radians about Z.
 *
 * Not decoration — without it they intersect him. A shoulder joint sits inboard
 * of the widest part of the deltoid, so an arm dropped straight down from it
 * puts the hand's inner edge at 0.155 against a thigh whose surface is out at
 * 0.186, and the hands spend the whole walk cycle buried in the trousers. Four
 * degrees of abduction carries the wrist clear by about a centimetre, and is
 * roughly where a real arm hangs anyway.
 *
 * Only the standing figure needs it. The rower's arms are already reaching out
 * to the oars and the astronaut's are drifting in free fall.
 */
export const ARM_SPLAY = 0.07;

/**
 * Narrows the head from the near-sphere it was.
 *
 * Its height is right — at 0.28 against 1.97 he stands close to 7 heads, the
 * realistic range. The plan view was not: a real head is about 0.66 as broad as
 * it is tall and this was 0.93, so from the front it read as a ball on
 * shoulders. At 0.79 it is still stylized but is recognisably a skull. Anything
 * mounted on the head — hair, a cap, a skullcap — takes the same narrowing so it
 * still fits; a helmet does not, being a sphere in its own right.
 */
export const HEAD_SCALE: [number, number, number] = [0.85, 1.07, 0.89];
export const HEAD_CAP_SCALE: [number, number, number] = [0.85, 1, 0.89];
/** What the face's z insets were multiplied by, so features stay on the surface. */
export const HEAD_DEPTH_SCALE = 0.92;

/**
 * The limb profiles — see `bodyGeometry.ts` for why parts are lofted from rings
 * rather than built from primitives. Local y, so 0 is the joint each part hangs
 * from and the rings run down from there.
 *
 * The numbers are a tailored suit's, not a nude figure's: a trouser is fullest
 * just below the seat and breaks over the shoe at roughly half that width, and a
 * jacket sleeve runs from a full bicep to a cuff narrow enough to show a shirt.
 * Every part is a touch deeper than it is wide, which is true of a real limb and
 * is what stops them reading as flat when he turns side-on.
 */
export const THIGH_RINGS: BodyRing[] = [
  // Buried in the jacket, and drawn in so it doesn't bulge out through the hip.
  { y: 0.02, rx: 0.082, rz: 0.09 },
  { y: -0.06, rx: 0.099, rz: 0.105 },
  { y: -0.14, rx: 0.098, rz: 0.104 },
  { y: -0.28, rx: 0.088, rz: 0.093 },
  { y: -0.4, rx: 0.08, rz: 0.085 },
  { y: -KNEE_DROP, rx: 0.076, rz: 0.081 },
];

export const SHIN_RINGS: BodyRing[] = [
  // Picks the thigh's knee ring back up, so the trouser runs on through the joint.
  { y: 0.02, rx: 0.076, rz: 0.081 },
  // The calf, which swells behind the leg rather than beside it.
  { y: -0.09, rx: 0.073, rz: 0.084 },
  { y: -0.18, rx: 0.071, rz: 0.079 },
  { y: -0.32, rx: 0.066, rz: 0.07 },
  { y: -0.43, rx: 0.063, rz: 0.066 },
  { y: -ANKLE_DROP, rx: 0.062, rz: 0.068 },
];

export const UPPER_ARM_RINGS: BodyRing[] = [
  { y: 0.03, rx: 0.076, rz: 0.079 },
  { y: -0.05, rx: 0.079, rz: 0.082 },
  { y: -0.16, rx: 0.073, rz: 0.076 },
  { y: -0.26, rx: 0.067, rz: 0.07 },
  { y: -ELBOW_DROP, rx: 0.064, rz: 0.067 },
];

export const FOREARM_RINGS: BodyRing[] = [
  { y: 0.02, rx: 0.065, rz: 0.068 },
  { y: -0.08, rx: 0.062, rz: 0.065 },
  { y: -0.19, rx: 0.054, rz: 0.056 },
  { y: -WRIST_DROP, rx: 0.049, rz: 0.051 },
];

/**
 * The hand, hanging from the wrist. Wider than it is thick, and the wide axis is
 * Z rather than X on purpose: an arm at rest turns the palm in toward the thigh,
 * so the breadth across the knuckles points fore-and-aft.
 */
export const HAND_RINGS: BodyRing[] = [
  { y: 0, rx: 0.026, rz: 0.036 },
  { y: -0.05, rx: 0.028, rz: 0.047 },
  { y: -0.11, rx: 0.024, rz: 0.045 },
  { y: -0.162, rx: 0.015, rz: 0.029 },
];

/**
 * The torso, in feet-measured coordinates rather than local ones — it hangs off
 * nothing, so its rings are simply heights above the ground.
 *
 * A jacket suppresses the waist rather than hiding it, and that single narrowing
 * at 1.22 is what tells the eye there is a ribcage above and a pelvis below
 * instead of one slab.
 */
export const TORSO_RINGS: BodyRing[] = [
  { y: 1.615, rx: 0.15, rz: 0.089 },
  { y: 1.575, rx: 0.184, rz: 0.11 },
  { y: 1.48, rx: 0.19, rz: 0.118 },
  { y: 1.36, rx: 0.179, rz: 0.115 },
  { y: 1.22, rx: 0.161, rz: 0.107 },
  { y: 1.1, rx: 0.172, rz: 0.113 },
  { y: 1.01, rx: 0.17, rz: 0.111 },
  // Rolled under, so the hem closes rather than ending on a flat disc.
  { y: 0.968, rx: 0.14, rz: 0.092 },
];

/**
 * The same profile with a constant thickness added all round — the astronaut's
 * pressure suit over the identical frame.
 *
 * Padding rather than scaling on purpose: a suit is a layer of roughly even
 * thickness worn over a body, so it adds the same couple of centimetres at the
 * wrist as at the bicep. Scaling would make the thick parts thicker and the thin
 * parts barely change, which is how a suit is not built.
 */
export function padRings(rings: BodyRing[], pad: number): BodyRing[] {
  return rings.map((ring) => ({ y: ring.y, rx: ring.rx + pad, rz: ring.rz + pad }));
}

/** Builds every part at one segment count, for a world that wants one look. */
export function buildFigureGeometry(
  { segments, pad = 0 }: { segments: number; pad?: number }
) {
  const limb = (rings: BodyRing[]) => createBodyGeometry(padRings(rings, pad), { segments });
  return {
    thigh: limb(THIGH_RINGS),
    shin: limb(SHIN_RINGS),
    upperArm: limb(UPPER_ARM_RINGS),
    forearm: limb(FOREARM_RINGS),
    hand: createBodyGeometry(padRings(HAND_RINGS, pad), { segments, squareness: 3 }),
    torso: createBodyGeometry(padRings(TORSO_RINGS, pad), { segments, squareness: 3.4 }),
  };
}
