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
 * These used to be anthropometric: every joint was the standard fraction of
 * stature, which gave a correctly proportioned seven-head man. He was the only
 * realistically drawn thing on a site built out of blocks, and read as a visitor
 * from another project. He is now drawn at four and a half heads — the head
 * roughly doubled, everything below the jaw scaled to make room for it — which
 * is the same trick every other object here plays: state the idea of a thing at
 * low resolution and let the silhouette carry it.
 */

/**
 * Sole to crown, unchanged at 1.97.
 *
 * The redistribution happens entirely inside this height rather than around it.
 * A unit is a metre and the jump arc is integrated against real gravity, the
 * camera's boom and aim heights are set against his shoulders, and the walk
 * boundary and portal triggers are circles sized to him — grow the total and all
 * of that quietly needs re-tuning. Grow only the head and nothing outside this
 * file has to know.
 */
export const STATURE = 1.97;

/**
 * The head, and the ratio the whole figure is built around.
 *
 * At 0.44 tall against 1.97 he stands 4.5 heads. Real adults run to about 7.5,
 * and the previous figure was drawn at 7 — the difference is most of why he
 * clashed. Four to five is the stylized band: below four reads as an infant,
 * above five and the exaggeration stops being legible as a choice.
 */
export const HEAD_RADIUS = 0.22;
export const HEAD_CENTER_Y = STATURE - HEAD_RADIUS;
/** Base of the skull, where the head nods from — and the top of the neck. */
export const HEAD_PIVOT_Y = HEAD_CENTER_Y - HEAD_RADIUS;

/**
 * Near enough a ball. The old head was squashed to 0.66 of its height across,
 * because that is what a real skull measures; a head drawn at this size wants
 * the opposite treatment, and only comes in far enough at the back and front to
 * avoid reading as a perfect sphere.
 */
export const HEAD_SCALE: [number, number, number] = [1, 1, 0.94];
export const HEAD_CAP_SCALE: [number, number, number] = [1, 1, 0.94];
/** What a face inset is multiplied by, so features stay on the surface. */
export const HEAD_DEPTH_SCALE = 0.94;

/**
 * Where the eyes sit, which is the whole face now — the brows, nose and mouth
 * every version of him used to carry are gone. They were expression on a figure
 * seen from behind at six metres for nearly all of his screen time, and
 * expression is exactly what the rest of the site does without.
 *
 * Solved rather than nudged into place: the head is a sphere of HEAD_RADIUS
 * squashed by HEAD_DEPTH_SCALE through the depth axis, so for a given x and a
 * given rise above centre there is exactly one z on its surface. The 4mm of
 * sink is for the faceting — on a ten-segment sphere the flat between two
 * longitudes falls up to 5% inside the true radius, which is enough for a dot
 * placed on the ideal surface to float off the actual one.
 */
export const EYE_X = 0.082;
export const EYE_RISE = 0.03;
export const EYE_Y = HEAD_CENTER_Y + EYE_RISE;
export const EYE_Z =
  HEAD_DEPTH_SCALE * Math.sqrt(HEAD_RADIUS ** 2 - EYE_X ** 2 - EYE_RISE ** 2) - 0.004;

/**
 * The skeleton below the jaw.
 *
 * Every joint is the old anthropometric height scaled by HEAD_PIVOT_Y / 1.71 —
 * one factor, applied uniformly. That matters for the animation rather than the
 * look: the walk cycle's swing amplitudes, the knee's fold and the jump tuck were
 * all tuned against the ratio of thigh to shin and of arm to leg, and a uniform
 * scale is the one change that leaves every one of those ratios alone.
 */
export const HIP_Y = 0.94;
/** Hip to knee. */
export const KNEE_DROP = 0.43;
/** Knee to ankle — still near enough equal to the thigh, as a real leg is. */
export const ANKLE_DROP = 0.42;
export const SHOULDER_Y = 1.39;
export const ELBOW_DROP = 0.28;
export const WRIST_DROP = 0.24;
/** Sole to instep. */
export const SHOE_HEIGHT = 0.103;

/**
 * Half the distance between the leg centres, and between the shoulder pivots.
 *
 * The legs sit just inside the torso's hem and the shoulders just outside its
 * flanks, so the arms overlap the block rather than butting against it. That
 * overlap is deliberate and invisible — jacket, sleeve and trouser are all one
 * colour — and it is what removes the need for the deltoid caps that used to
 * paper over the join.
 */
export const LEG_X = 0.095;
export const SHOULDER_X = 0.2;

/**
 * How far the arms hang away from the body, in radians about Z. Without it they
 * swing through the hips: the hand's inner edge tracks about 0.14 from centre
 * and the thigh's surface is out at 0.18.
 *
 * Only the standing figure needs it. The rower's arms are already reaching out
 * to the oars and the astronaut's are drifting in free fall.
 */
export const ARM_SPLAY = 0.09;

/**
 * A limb: a plain capsule, constant through its length with a domed end at each
 * joint.
 *
 * Constant is the point. These were tapered profiles before — a thigh full at
 * the hip and drawn in by a third at the knee, a calf swelling behind the
 * shin — which is what a leg does and exactly the anatomical read the low-poly
 * style doesn't want. A tube states "limb" and stops.
 *
 * The domes are not joint detail; they are what a capsule is. They also happen
 * to solve the problem the old knee and elbow balls were added for: two flat-cut
 * tubes on a pivot open a wedge at the back of the joint as it folds, worst in
 * the jump tuck where the knee bends a full radian, and a rounded end fills that
 * on its own without a third mesh sitting in the joint.
 */
export function capsuleRings(radius: number, length: number, capRings = 2): BodyRing[] {
  const rings: BodyRing[] = [];
  const push = (y: number, r: number) => rings.push({ y, rx: r, rz: r });

  // Top dome, from just below the pole down to the shoulder of the barrel. The
  // pole itself is left to createBodyGeometry's end cap.
  for (let i = 1; i <= capRings; i++) {
    const phi = (i / (capRings + 1)) * (Math.PI / 2);
    push(-radius * (1 - Math.cos(phi)), radius * Math.sin(phi));
  }
  push(-radius, radius);
  push(-(length - radius), radius);
  for (let i = capRings; i >= 1; i--) {
    const phi = (i / (capRings + 1)) * (Math.PI / 2);
    push(-(length - radius * (1 - Math.cos(phi))), radius * Math.sin(phi));
  }
  return rings;
}

/**
 * The limbs. Local y, so 0 is the joint each part hangs from and the rings run
 * down from there — each one exactly as long as the bone it covers, so a limb
 * and its skeleton cannot disagree.
 */
export const THIGH_RINGS: BodyRing[] = capsuleRings(0.088, KNEE_DROP);
export const SHIN_RINGS: BodyRing[] = capsuleRings(0.078, ANKLE_DROP);
export const UPPER_ARM_RINGS: BodyRing[] = capsuleRings(0.072, ELBOW_DROP);
export const FOREARM_RINGS: BodyRing[] = capsuleRings(0.065, WRIST_DROP);

/**
 * The hand: a stub capsule, and nothing more.
 *
 * It was a four-ring profile before, broader across the knuckles than through
 * the palm and turned so the breadth pointed fore-and-aft the way a hand hangs.
 * At the size the camera actually sits at, none of that survived being three
 * pixels wide, and modelling it put anatomy on a figure that has none anywhere
 * else.
 */
export const HAND_RINGS: BodyRing[] = capsuleRings(0.058, 0.13, 1);

/**
 * The torso: one rounded rectangular block, constant from collar to hem.
 *
 * The waist is gone on purpose. There used to be a narrowing at 1.22 whose whole
 * job was to say there is a ribcage above and a pelvis below — good tailoring,
 * and precisely the anatomical detail that made him the odd one out. A block
 * says "body" at this resolution, and the shirt panel and lapels laid over the
 * front say "suit" without the shape underneath having to.
 *
 * Only the top and bottom rings pull in, which rolls the ends over instead of
 * finishing the block on a flat disc.
 */
const TORSO_HALF_WIDTH = 0.19;
const TORSO_HALF_DEPTH = 0.12;
export const TORSO_TOP_Y = 1.47;
export const TORSO_HEM_Y = 0.9;

export const TORSO_RINGS: BodyRing[] = [
  { y: TORSO_TOP_Y, rx: TORSO_HALF_WIDTH * 0.86, rz: TORSO_HALF_DEPTH * 0.86 },
  { y: TORSO_TOP_Y - 0.045, rx: TORSO_HALF_WIDTH, rz: TORSO_HALF_DEPTH },
  { y: TORSO_HEM_Y + 0.045, rx: TORSO_HALF_WIDTH, rz: TORSO_HALF_DEPTH },
  { y: TORSO_HEM_Y, rx: TORSO_HALF_WIDTH * 0.86, rz: TORSO_HALF_DEPTH * 0.86 },
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

/**
 * Builds every part at one segment count, for a world that wants one look.
 *
 * Segment counts run low now — eight around a limb, not twenty. The facets are
 * the point rather than a budget: a tube smooth enough to hide its own polygons
 * is the wrong object on a site where the trees, the shelves and the islands all
 * show theirs.
 */
export function buildFigureGeometry({ segments, pad = 0 }: { segments: number; pad?: number }) {
  const limb = (rings: BodyRing[]) => createBodyGeometry(padRings(rings, pad), { segments });
  return {
    thigh: limb(THIGH_RINGS),
    shin: limb(SHIN_RINGS),
    upperArm: limb(UPPER_ARM_RINGS),
    forearm: limb(FOREARM_RINGS),
    hand: limb(HAND_RINGS),
    // The one part that isn't a tube: squared off toward a rounded rectangle so
    // the shirt panel, lapels and tie lie on something flat.
    torso: createBodyGeometry(padRings(TORSO_RINGS, pad), { segments, squareness: 3.2 }),
  };
}
