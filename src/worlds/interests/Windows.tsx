import { useMemo } from "react";
import * as THREE from "three";
import { flatMat } from "./materials";
import { PALETTE } from "./palette";
import { PALETTE as RANGE } from "../associations/palette";
import { PROFILE } from "../associations/envelope";
import { NIGHT_SKY } from "../../three/celestial";
import { getSunState } from "../../utils/time";
import { BACK_PANEL_Z, EYE } from "./layout";

/**
 * Two windows either side of the shelf, and the country outside them.
 *
 * The room had no outside. It is a wall, a floor and a bookcase, and the one
 * thing it never said was *where* it is — which of the site's places you are
 * standing in while you read the shelf. It is a house high on the side of a
 * steep valley in the range the helicopter flies over in the Extracurriculars
 * world, and the windows look down it. The palette is imported from that world
 * rather than matched by eye, so the rock, the pines and the balloon silks are
 * literally its colours.
 *
 * The left window is aimed: the association balloons are placed on its own
 * sightline (see `cone` below), so turning to look out of it finds them out
 * over the drop. The right window looks down the other flank, and has no
 * balloons in it — one window that rewards a look and one that establishes the
 * place reads better than two of the same.
 *
 * Built here rather than borrowed from `worlds/associations` outright. That
 * world's mountains are a sampled heightfield and its forest is thousands of
 * instanced trees, which is the right cost for a world you fly across and the
 * wrong one for something glimpsed through two two-metre openings. This is the
 * same call the mansion's telescope makes with its ocean.
 */

/* -------------------------------------------------------------------------
   Where the openings are
   ---------------------------------------------------------------------- */

/** The back wall's plane and extents, as `Shelf.tsx`'s Room builds them. */
export const WALL_Z = BACK_PANEL_Z - 0.16;
export const WALL_DEPTH = 0.1;
const WALL_HALF_WIDTH = 5.5;
const WALL_BOTTOM = -0.9;
const WALL_TOP = 4.7;

/**
 * Centres of the two openings, and their size.
 *
 * Set between the room's own two horizontals rather than across them: the dado
 * runs at 0.95 and the picture rail at 2.62, both the full width of the wall,
 * and a window crossing either would have the trim running over its glass. A
 * sill at 1.02 and a head at 2.52 drops the opening into the field between
 * them, which is where a window in a room like this would actually go.
 *
 * Wide enough to be worth turning your head for: two metres across, on a wall
 * whose bookcase is three and a half.
 */
export const WINDOW_X = 3.05;
export const WINDOW_HALF_WIDTH = 1.0;
export const WINDOW_SILL = 1.02;
export const WINDOW_HEAD = 2.52;

/**
 * The cone a window cuts through the room, at a given depth.
 *
 * The camera never moves — the look controls rotate about a fixed eye, they
 * never translate — so the set of directions that pass through an opening is
 * fixed too, and every part of the view can be built into the frame it will be
 * seen in rather than positioned by eye. Turning your head only chooses which
 * part of that cone is on screen.
 *
 * Everything outside is written in these terms. `halfWidth` and `halfHeight`
 * are the opening's own units at that depth, so "half a frame above the middle"
 * means the same thing twelve units out and seventy — and, more usefully, two
 * silhouettes at different depths can be compared by their cone-relative
 * heights, because that is exactly where they land on the glass. The valley
 * below is laid out entirely that way.
 */
function cone(windowX: number, z: number) {
  const centreY = (WINDOW_SILL + WINDOW_HEAD) / 2;
  const t = (EYE[2] - z) / (EYE[2] - WALL_Z);
  return {
    x: EYE[0] + (windowX - EYE[0]) * t,
    y: EYE[1] + (centreY - EYE[1]) * t,
    halfWidth: WINDOW_HALF_WIDTH * t,
    halfHeight: ((WINDOW_HEAD - WINDOW_SILL) / 2) * t,
  };
}

/* -------------------------------------------------------------------------
   The wall, with the openings in it
   ---------------------------------------------------------------------- */

/**
 * The room's walls: the back one built as seven pieces around the two openings
 * instead of one slab — the same way the mansion's back wall is built around
 * its doorway, because a window drawn on a solid wall is a picture of a window
 * — and a return wall down each side.
 *
 * The returns are not decoration. The look controls swing 54° either way and
 * the lens adds 40 more, so from the fixed eye the view reaches round past
 * where a single back wall ends: before they were here, turning to the left
 * window showed the mountains *beside* the wall as well as through it, with
 * the room's corner cut off in mid-air. A room with a hole in it needs to be a
 * room on every heading it can be seen from.
 */
export function RoomShell() {
  const wall = useMemo(() => flatMat(PALETTE.wall), []);
  const outer = WALL_HALF_WIDTH;
  const left = WINDOW_X - WINDOW_HALF_WIDTH;
  const right = WINDOW_X + WINDOW_HALF_WIDTH;
  /** Far enough toward the eye to close the corners at full yaw. */
  const returnFront = 4.6;

  /** Full-height piers: outside each window, and the broad one between them. */
  const piers: [number, number][] = [
    [-outer, -right],
    [-left, left],
    [right, outer],
  ];

  return (
    <group>
      {piers.map(([x1, x2], i) => (
        <mesh key={i} material={wall} position={[(x1 + x2) / 2, (WALL_BOTTOM + WALL_TOP) / 2, WALL_Z]}>
          <boxGeometry args={[x2 - x1, WALL_TOP - WALL_BOTTOM, WALL_DEPTH]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* Under the sill, and over the head. */}
          <mesh
            material={wall}
            position={[s * WINDOW_X, (WALL_BOTTOM + WINDOW_SILL) / 2, WALL_Z]}
          >
            <boxGeometry args={[WINDOW_HALF_WIDTH * 2, WINDOW_SILL - WALL_BOTTOM, WALL_DEPTH]} />
          </mesh>
          <mesh material={wall} position={[s * WINDOW_X, (WINDOW_HEAD + WALL_TOP) / 2, WALL_Z]}>
            <boxGeometry args={[WINDOW_HALF_WIDTH * 2, WALL_TOP - WINDOW_HEAD, WALL_DEPTH]} />
          </mesh>
        </group>
      ))}

      {/* The returns, running from the back wall toward the eye. */}
      {[-1, 1].map((s) => (
        <mesh
          key={`return-${s}`}
          material={wall}
          position={[s * outer, (WALL_BOTTOM + WALL_TOP) / 2, (WALL_Z + returnFront) / 2]}
        >
          <boxGeometry args={[WALL_DEPTH, WALL_TOP - WALL_BOTTOM, returnFront - WALL_Z]} />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------
   The view
   ---------------------------------------------------------------------- */

/**
 * Depths of everything beyond the valley's mouth.
 *
 * All three sit far further out than the country did when it was a set of
 * level ranges, because the balloons had to go somewhere: they hang in the air
 * *between* the valley's flanks now, and the flanks needed room behind them to
 * recede into before that could be true.
 */
const SKY_Z = -78;
const RANGE_Z = -66;
const SEA_Z = -58;

/**
 * Where the water's edge sits.
 *
 * On the eye line at the sea's own depth, which is what a horizon is: the line
 * level with the viewer, however high the viewer is standing. Derived rather
 * than chosen, so the balloons — also placed on that line — sit on the horizon
 * the way they do from the helicopter.
 */
const SEA_TOP = cone(WINDOW_X, SEA_Z).y;

/** Deterministic pseudo-random in [0, 1) — the view is the same on every visit. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The range on the horizon, as one flat silhouette: a jagged top edge dropped
 * to a base. Flat rather than modelled because it stands seventy units off
 * through a two-metre hole — what carries at that distance is the skyline, and
 * a heightfield would cost a great deal to say the same thing.
 *
 * This is now the only level range out there. The valley's own flanks are a
 * different shape and have their own section below.
 */
interface Ridge {
  seed: number;
  span: number;
  baseY: number;
  peak: number;
  /**
   * Wavelength of the summits, as 2π/wave in world units. Kept in world units
   * rather than as a fraction of the span so that widening the range puts more
   * mountains in it instead of stretching the ones it has — which matters here,
   * because the two windows look at parts of it forty units apart.
   */
  wave: number;
  roughness: number;
}

/** The skyline of a ridge at a given x — shared by its silhouette and its snow. */
function ridgeHeight(r: Ridge, x: number): number {
  // Two octaves: a few big summits with smaller shoulders on them.
  const big = Math.sin(x * r.wave + seeded(r.seed) * 6.3);
  const small = Math.sin(x * r.wave * 3.3 + seeded(r.seed + 4) * 6.3);
  return r.baseY + r.peak * (0.55 + 0.45 * big) + r.roughness * small;
}

/**
 * A ridge as one flat silhouette, filled from its skyline down to `floorY`.
 *
 * Passing a floor high up the slope instead of far below it is what draws the
 * snow: the same skyline, filled only where it rises above the snowline, so
 * the caps sit exactly on the peaks they belong to rather than being separate
 * shapes placed near them.
 */
function ridgeGeometry(r: Ridge, floorY: number) {
  const steps = 320;
  const positions: number[] = [];
  for (let i = 0; i < steps; i++) {
    const x0 = -r.span / 2 + (r.span * i) / steps;
    const x1 = -r.span / 2 + (r.span * (i + 1)) / steps;
    const y0 = ridgeHeight(r, x0);
    const y1 = ridgeHeight(r, x1);
    // Nothing to fill where the whole segment is under the floor.
    if (y0 <= floorY && y1 <= floorY) continue;
    positions.push(x0, floorY, 0, x1, floorY, 0, x1, Math.max(y1, floorY), 0);
    positions.push(x0, floorY, 0, x1, Math.max(y1, floorY), 0, x0, Math.max(y0, floorY), 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The range past the valley's mouth, sized against the frame it shows up in. */
const RANGE_CONE = cone(WINDOW_X, RANGE_Z);
const FAR_RANGE: Ridge = {
  seed: 1,
  span: 220,
  // Its feet are on the horizon, so what is below that is behind the water.
  baseY: RANGE_CONE.y - 0.6,
  peak: RANGE_CONE.halfHeight * 0.6,
  wave: 0.32,
  roughness: RANGE_CONE.halfHeight * 0.06,
};
const RANGE_SNOWLINE = RANGE_CONE.y + RANGE_CONE.halfHeight * 0.34;

/* -------------------------------------------------------------------------
   The valley
   ---------------------------------------------------------------------- */

/**
 * The house stands high on the side of a steep valley, and the windows look
 * down it.
 *
 * Four silhouettes at four depths rather than a modelled landform, and what
 * makes them read as one valley is where their troughs sit. The nearest
 * bottoms out well below the sill and never shows you its floor; each one
 * further off bottoms out higher than the last, climbing toward the eye line
 * until the furthest is barely a notch under the horizon. That is what falling
 * ground does seen from a window — you cannot see the bottom of a drop that
 * starts beneath you, only the flanks of it running away and the air in
 * between. The steepness is in what is *missing* from the frame.
 *
 * The crests go the other way, the nearest reaching highest, so the flanks
 * close in at the jambs and leave a wedge of distance up the middle. The sea at
 * the valley's mouth shows through that wedge and nowhere else.
 *
 * Every number below is in cone units — crests and troughs in half-heights
 * above and below the middle of the frame, spans in half-widths — so they can
 * be read against each other directly. A span over 2 runs out past both jambs;
 * a trough under -1 has gone out of the bottom of the window.
 */
interface FlankSpec {
  seed: number;
  z: number;
  crest: number;
  trough: number;
  span: number;
  roughness: number;
}

const FLANKS: FlankSpec[] = [
  // The ground the house itself stands on, falling away at either hand.
  { seed: 31, z: -7.5, crest: 1.55, trough: -1.95, span: 2.45, roughness: 0.12 },
  { seed: 13, z: -16, crest: 1.1, trough: -1.25, span: 2.8, roughness: 0.15 },
  { seed: 7, z: -28, crest: 0.72, trough: -0.66, span: 3.0, roughness: 0.12 },
  // Far enough back to be mostly air; its trough is the last of the valley
  // before the water.
  { seed: 3, z: -44, crest: 0.34, trough: -0.34, span: 3.2, roughness: 0.07 },
];

interface Flank {
  seed: number;
  layer: number;
  side: number;
  /** Centre of the window's cone at this depth: the flank is hung on it. */
  x: number;
  z: number;
  span: number;
  crest: number;
  trough: number;
  /** How far off the middle of the frame the trough runs. See `resolveFlank`. */
  lean: number;
  roughness: number;
  halfWidth: number;
  halfHeight: number;
  /** Bottom edge of the window's view at this depth. Under it is unseeable. */
  frameBottom: number;
  floor: number;
}

/** Hang a flank on the cone of the window it will be seen through. */
function resolveFlank(spec: FlankSpec, layer: number, side: number): Flank {
  const c = cone(side * WINDOW_X, spec.z);
  const seed = spec.seed + side * 17;
  return {
    seed,
    layer,
    side,
    x: c.x,
    z: spec.z,
    span: c.halfWidth * spec.span,
    crest: c.y + c.halfHeight * spec.crest,
    trough: c.y + c.halfHeight * spec.trough,
    // Each layer's trough wanders off the middle by its own amount, and by a
    // different one out of each window. Held dead centre they stack into a
    // chevron — four perfect V's nested inside each other, which is a funnel
    // rather than a valley. A valley bends.
    lean: (seeded(seed) - 0.5) * 0.7 * c.halfWidth,
    roughness: c.halfHeight * spec.roughness,
    halfWidth: c.halfWidth,
    halfHeight: c.halfHeight,
    frameBottom: c.y - c.halfHeight,
    floor: c.y - c.halfHeight * 3,
  };
}

/**
 * How fast a flank climbs out of its trough. Under 1 it leaves the bottom
 * steeply and eases off up top, which is the section water cuts — and steep is
 * the whole point of this one.
 */
const FLANK_CURVE = 0.8;

/** The skyline of a flank at a local x — its silhouette, its trees and its rock all read it. */
function flankHeight(f: Flank, x: number): number {
  const climb = Math.pow(Math.min(1, Math.abs(x - f.lean) / (f.span / 2)), FLANK_CURVE);
  const t = x / f.span;
  const wobble =
    Math.sin(t * 13.1 + seeded(f.seed) * 6.3) * 0.62 +
    Math.sin(t * 31.7 + seeded(f.seed + 4) * 6.3) * 0.38;
  // The wobble is scaled by the climb as well, so the trough stays a trough: a
  // bump in the bottom of it would read as a valley floor you can see.
  return f.trough + (f.crest - f.trough) * climb + f.roughness * wobble * climb;
}

function flankGeometry(f: Flank): THREE.BufferGeometry {
  const steps = 140;
  const positions: number[] = [];
  for (let i = 0; i < steps; i++) {
    const x0 = -f.span / 2 + (f.span * i) / steps;
    const x1 = -f.span / 2 + (f.span * (i + 1)) / steps;
    const y0 = flankHeight(f, x0);
    const y1 = flankHeight(f, x1);
    positions.push(x0, f.floor, 0, x1, f.floor, 0, x1, y1, 0);
    positions.push(x0, f.floor, 0, x1, y1, 0, x0, y0, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Height of a conifer on each flank, as a fraction of that flank's
 * half-frame — see `trees` below for why it is measured that way. Nothing on
 * the fourth: at forty-four units down the valley that flank is air.
 */
const FLANK_TREES = [0.11, 0.095, 0.07, 0];
const TREES_PER_FLANK = 130;

/**
 * How high the ground in front of a point in the view stands, on the glass, at
 * a given place across the frame.
 *
 * Cone units are what make this answerable at all: a flank's skyline written in
 * its own cone units *is* where it lands on the window, so a slope sixteen
 * units out and a balloon thirty-six units out can be compared directly. Used
 * to lift the balloons clear of whatever is in front of them rather than
 * placing them by eye — which is how one of them ended up with its basket down
 * among the pines the moment the flanks were given their lean.
 */
function screenSkyline(dx: number, z: number): number {
  let top = -Infinity;
  FLANKS.forEach((spec, layer) => {
    // Only what is nearer than the point can hide it.
    if (spec.z <= z) return;
    const flank = resolveFlank(spec, layer, -1);
    const treeline =
      flankHeight(flank, dx * flank.halfWidth) + FLANK_TREES[layer] * flank.halfHeight;
    top = Math.max(top, (treeline - (flank.frameBottom + flank.halfHeight)) / flank.halfHeight);
  });
  return top;
}

/** How far below its own origin a balloon hangs, in radii: skirt, lines, basket. */
const BALLOON_DROP = 1.55;

/**
 * How many gores a distant balloon is cut into.
 *
 * The range's own carry fourteen. Ten is enough here: at twenty-five units
 * through a two-metre opening a gore is a couple of pixels across, and what
 * has to survive is that the envelope is *striped in two colours* — which is
 * the thing that tells one club's balloon from another's.
 */
const WINDOW_GORES = 10;

/**
 * One gore, cut to the same profile the range's balloons are cut to.
 *
 * `PROFILE` is imported rather than approximated: it is what makes an envelope
 * read as a hot-air balloon instead of a bauble — widest a third of the way
 * down, drawing in hard to a narrow mouth — and these are meant to be those
 * balloons seen from a window, not lookalikes of them.
 */
function goreGeometry(radius: number): THREE.BufferGeometry {
  const phi = (Math.PI * 2) / WINDOW_GORES;
  const positions: number[] = [];
  const indices: number[] = [];
  const columns = 2;

  for (const [y, w] of PROFILE) {
    for (let c = 0; c <= columns; c++) {
      const angle = (c / columns) * phi;
      positions.push(Math.cos(angle) * w * radius, y * radius, Math.sin(angle) * w * radius);
    }
  }
  for (let r = 0; r < PROFILE.length - 1; r++) {
    for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c;
      indices.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** One balloon: alternating gores, a crown ring, suspension lines and a basket. */
function Balloon({
  gore,
  silkA,
  silkB,
  rigging,
  basket,
  radius,
}: {
  gore: THREE.BufferGeometry;
  silkA: THREE.Material;
  silkB: THREE.Material;
  rigging: THREE.Material;
  basket: THREE.Material;
  radius: number;
}) {
  const mouth = radius * PROFILE[PROFILE.length - 1][0];
  const basketY = mouth - radius * 0.5;

  return (
    <group>
      {Array.from({ length: WINDOW_GORES }, (_, i) => (
        <mesh
          key={i}
          geometry={gore}
          material={i % 2 === 0 ? silkA : silkB}
          rotation={[0, (i / WINDOW_GORES) * Math.PI * 2, 0]}
        />
      ))}
      {/* Suspension lines from the skirt down to the basket, and the basket. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={rigging}
          position={[s * radius * 0.18, (mouth + basketY) / 2, 0]}
        >
          <boxGeometry args={[0.012, mouth - basketY, 0.012]} />
        </mesh>
      ))}
      <mesh material={basket} position={[0, basketY - radius * 0.07, 0]}>
        <boxGeometry args={[radius * 0.2, radius * 0.16, radius * 0.2]} />
      </mesh>
    </group>
  );
}

function Vista() {
  /**
   * Read once. The shelf is a room you stand in for a minute — nobody is here
   * across a sunset, and the alternative is a poll running for the life of a
   * scene that never otherwise re-renders.
   */
  const isDay = useMemo(() => getSunState().isDay, []);

  const materials = useMemo(() => {
    const day = <T,>(a: T, b: T) => (isDay ? a : b);
    return {
      sky: new THREE.MeshBasicMaterial({ color: day("#c3d3dc", `#${NIGHT_SKY.getHexString()}`) }),
      star: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      // The far range is mostly haze: at this distance the air is doing more to
      // its colour than the rock is.
      far: flatMat(day("#9fb0ba", "#1a2330")),
      farSnow: flatMat(day("#dde6ec", "#39414f")),
      // Water, hazed toward the sky the way distance takes it.
      sea: new THREE.MeshBasicMaterial({ color: day("#6d92a8", "#141d2a") }),
      /**
       * The valley's four flanks, near to far, and the pines on the three that
       * carry them. Each one is a shade paler and bluer than the one in front
       * of it: at forty-odd units the air is already doing more to a hillside's
       * colour than the grass on it is, and that fade is most of what says the
       * far one is far. The nearest is the darkest because it is the flank you
       * are standing on, turned away from the light.
       */
      flank: [
        flatMat(day(RANGE.grassDark, "#131f16")),
        flatMat(day(RANGE.grass, "#18261b")),
        flatMat(day("#8ca386", "#1a2620")),
        flatMat(day("#9db2ad", "#1d2530")),
      ],
      pine: [
        flatMat(day(RANGE.pineDark, "#0d1710")),
        flatMat(day(RANGE.pine, "#111d15")),
        flatMat(day("#5f8064", "#14211a")),
      ],
      rock: flatMat(day(RANGE.rockDark, "#232733")),
      rigging: flatMat(day("#5a5348", "#1b1b1c")),
      basket: flatMat(day(RANGE.basket, "#2a1f14")),
      uclaA: flatMat(RANGE.rugbyA),
      uclaB: flatMat(RANGE.rugbyB),
      olyA: flatMat(RANGE.olympicA),
      olyB: flatMat(RANGE.olympicB),
      lamA: flatMat(RANGE.lambdaA),
      lamB: flatMat(RANGE.lambdaB),
      staA: flatMat(RANGE.statsA),
      staB: flatMat(RANGE.statsB),
    };
  }, [isDay]);

  const ridges = useMemo(
    () => ({
      far: ridgeGeometry(FAR_RANGE, RANGE_CONE.y - RANGE_CONE.halfHeight - 2),
      farSnow: ridgeGeometry(FAR_RANGE, RANGE_SNOWLINE),
    }),
    []
  );

  /** Both flanks of the valley, at all four depths, for both windows. */
  const flanks = useMemo(
    () =>
      ([-1, 1] as const).flatMap((side) =>
        FLANKS.map((spec, layer) => {
          const flank = resolveFlank(spec, layer, side);
          return { flank, geometry: flankGeometry(flank) };
        })
      ),
    []
  );

  const gores = useMemo(() => goreGeometry(1), []);

  /** Stars, scattered across the upper sky and only mounted after dark. */
  const stars = useMemo(
    () =>
      Array.from({ length: 140 }, (_, i) => ({
        x: (seeded(i * 3.1) - 0.5) * 240,
        y: 6 + seeded(i * 5.7 + 2) * 28,
        size: 0.19 + seeded(i * 9.3 + 5) * 0.3,
      })),
    []
  );

  /**
   * Conifers down the three nearest flanks.
   *
   * Sized as a fraction of the frame each flank fills rather than in world
   * units, which is a cheat: a stand forty units down the valley would be a
   * few pixels of fuzz if it were drawn at the height it really is. The
   * gradient is kept — a far tree is still smaller on the glass than a near
   * one — it is just compressed enough that the far flank reads as forested
   * instead of as felt.
   *
   * Anything whose top falls below the bottom of the window is dropped. The
   * troughs run a long way past the sill, and trees down in them are cones
   * nobody can ever see.
   */
  const trees = useMemo(() => {
    const out: { x: number; y: number; z: number; h: number; layer: number }[] = [];
    for (const { flank } of flanks) {
      const size = FLANK_TREES[flank.layer];
      if (!size) continue;
      for (let i = 0; i < TREES_PER_FLANK; i++) {
        const salt = i * 2.7 + flank.seed * 31 + flank.side * 40 + flank.layer * 500;
        const x = (seeded(salt) - 0.5) * flank.halfWidth * 2.6;
        const h = size * flank.halfHeight * (0.7 + seeded(salt + 3) * 0.7);
        // Standing on the skyline the flank actually has at that x, so the
        // treeline follows the slope instead of cutting across it — and then
        // scattered down the face below it, thinning as it goes. Trees on the
        // skyline alone read as a hedge somebody planted along the ridge.
        const skyline = flankHeight(flank, x);
        const face = Math.max(0, skyline - flank.frameBottom);
        const y = skyline - h * 0.3 - seeded(salt + 7) ** 2 * face * 0.85;
        if (y + h < flank.frameBottom) continue;
        out.push({
          x: flank.x + x,
          y: y + h / 2,
          // Clear of the flank's own plane by half a tree, and no further: the
          // silhouette is flat, and anything set well in front of it slides off
          // the skyline it is supposed to be standing on.
          z: flank.z + h * 0.4,
          h,
          layer: flank.layer,
        });
      }
    }
    return out;
  }, [flanks]);

  /** Rock breaking through the turf, high on the two nearest flanks. */
  const rocks = useMemo(() => {
    const out: { x: number; y: number; z: number; r: number; h: number; tilt: number }[] = [];
    for (const { flank } of flanks) {
      if (flank.layer > 1) continue;
      for (let i = 0; i < 4; i++) {
        const salt = i * 11 + flank.seed * 7 + flank.side * 3;
        // Out on the shoulders, where the flank is still in frame — the middle
        // of it is below the sill.
        const x = (seeded(salt) < 0.5 ? -1 : 1) * (0.55 + seeded(salt + 2) * 0.65) * flank.halfWidth;
        // Small, and half buried in the slope. Larger and standing proud they
        // read as tents pitched on the hillside rather than as rock in it.
        const h = flank.halfHeight * 0.075;
        const y = flankHeight(flank, x) - h * 0.5;
        if (y + h < flank.frameBottom) continue;
        out.push({
          x: flank.x + x,
          y,
          z: flank.z + h * 0.4,
          r: flank.halfHeight * (0.035 + seeded(salt + 5) * 0.03),
          h,
          tilt: (seeded(salt + 9) - 0.5) * 0.7,
        });
      }
    }
    return out;
  }, [flanks]);

  /**
   * The four balloons, one per club, in the colours their envelopes are cut
   * from in the range itself.
   *
   * Out over the valley, between its third flank and its fourth — thirty to
   * forty units down it, where there is nothing under them for a long way.
   * Placed in cone units like everything else out there: `dy` is measured from
   * the eye line, so keeping it near zero is what makes the house level with
   * them, and `dx` under about 0.7 is what keeps them clear of the jambs.
   *
   * `dy` is a floor rather than a position, though. Whatever it asks for, a
   * balloon is lifted until its basket clears the treeline of every slope
   * standing in front of it — see `screenSkyline`.
   */
  const balloons = useMemo(() => {
    const specs = [
      { z: -31, dx: -0.6, dy: 0.34, radius: 1.05, a: "olyA", b: "olyB" },
      { z: -36, dx: -0.1, dy: 0.1, radius: 1.2, a: "uclaA", b: "uclaB" },
      { z: -41, dx: 0.34, dy: 0.4, radius: 1.3, a: "lamA", b: "lamB" },
      // Kept in off the jamb and up off the flank: at 0.64 out and level with
      // the eye its basket was down among the pines on the near slope.
      { z: -33, dx: 0.5, dy: 0.34, radius: 1.05, a: "staA", b: "staB" },
    ] as const;
    return specs.map((spec) => {
      const c = cone(-WINDOW_X, spec.z);
      const clear =
        screenSkyline(spec.dx, spec.z) + (BALLOON_DROP * spec.radius) / c.halfHeight + 0.06;
      const dy = Math.max(spec.dy, clear);
      return { ...spec, x: c.x + spec.dx * c.halfWidth, y: c.y + dy * c.halfHeight };
    });
  }, []);

  return (
    <group>
      {/* Sky. A plane rather than a dome: it is only ever seen through two
          small openings, and a dome would be geometry nobody looks at. */}
      <mesh material={materials.sky} position={[0, 13, SKY_Z]}>
        <planeGeometry args={[280, 120]} />
      </mesh>
      {!isDay &&
        stars.map((s, i) => (
          <mesh key={i} material={materials.star} position={[s.x, s.y, SKY_Z + 0.5]}>
            <planeGeometry args={[s.size, s.size]} />
          </mesh>
        ))}

      {/* The far range past the valley's mouth, and the snow on the tops of it. */}
      <mesh geometry={ridges.far} material={materials.far} position={[0, 0, RANGE_Z]} />
      <mesh geometry={ridges.farSnow} material={materials.farSnow} position={[0, 0, RANGE_Z + 0.1]} />

      {/* The water the valley runs down to. Its edge is put on the eye line,
          which is where a horizon is from any height — so the sea reads as far
          below and a long way out, rather than as a blue wall behind the
          hills. Only the wedge between the flanks ever shows any of it. */}
      <mesh material={materials.sea} position={[0, SEA_TOP - 20, SEA_Z]}>
        <planeGeometry args={[240, 40]} />
      </mesh>

      {/* The valley: four flanks per window, the nearest last. */}
      {flanks.map(({ flank, geometry }, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={materials.flank[flank.layer]}
          position={[flank.x, 0, flank.z]}
        />
      ))}

      {rocks.map((r, i) => (
        <mesh
          key={i}
          material={materials.rock}
          position={[r.x, r.y, r.z]}
          rotation={[0, 0, r.tilt]}
        >
          <coneGeometry args={[r.r, r.h, 5]} />
        </mesh>
      ))}

      {trees.map((t, i) => (
        <mesh key={i} material={materials.pine[t.layer]} position={[t.x, t.y, t.z]}>
          <coneGeometry args={[t.h * 0.3, t.h, 6]} />
        </mesh>
      ))}

      {balloons.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.z]} scale={b.radius}>
          <Balloon
            gore={gores}
            silkA={materials[b.a]}
            silkB={materials[b.b]}
            rigging={materials.rigging}
            basket={materials.basket}
            radius={1}
          />
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------
   The windows themselves
   ---------------------------------------------------------------------- */

/** One window: a reveal, a frame, a mullion and transom, a sill and a stay. */
function Window({ x }: { x: number }) {
  const frame = useMemo(() => flatMat(PALETTE.wood), []);
  const frameDark = useMemo(() => flatMat(PALETTE.woodDark), []);
  const trim = useMemo(() => flatMat(PALETTE.wallTrim), []);
  const brass = useMemo(() => flatMat(PALETTE.candleFlame), []);

  const halfW = WINDOW_HALF_WIDTH;
  const midY = (WINDOW_SILL + WINDOW_HEAD) / 2;
  const height = WINDOW_HEAD - WINDOW_SILL;
  const front = WALL_Z + WALL_DEPTH / 2;

  return (
    <group position={[x, 0, 0]}>
      {/* Reveal: the wall is a tenth of a unit thick and lining it is what
          stops the opening reading as a hole cut in card. */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={trim} position={[s * (halfW - 0.02), midY, WALL_Z]}>
          <boxGeometry args={[0.04, height, WALL_DEPTH]} />
        </mesh>
      ))}
      <mesh material={trim} position={[0, WINDOW_HEAD - 0.02, WALL_Z]}>
        <boxGeometry args={[halfW * 2, 0.04, WALL_DEPTH]} />
      </mesh>

      {/* Casing round the opening, and an architrave over it. */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={frame} position={[s * (halfW + 0.055), midY + 0.05, front + 0.02]}>
          <boxGeometry args={[0.11, height + 0.22, 0.05]} />
        </mesh>
      ))}
      <mesh material={frame} position={[0, WINDOW_HEAD + 0.055, front + 0.02]}>
        <boxGeometry args={[halfW * 2 + 0.22, 0.11, 0.05]} />
      </mesh>
      <mesh material={frameDark} position={[0, WINDOW_HEAD + 0.14, front + 0.03]}>
        <boxGeometry args={[halfW * 2 + 0.36, 0.07, 0.07]} />
      </mesh>

      {/* Sill and apron. */}
      <mesh material={frame} position={[0, WINDOW_SILL - 0.04, front + 0.05]}>
        <boxGeometry args={[halfW * 2 + 0.34, 0.08, 0.16]} />
      </mesh>
      <mesh material={frameDark} position={[0, WINDOW_SILL - 0.13, front + 0.01]}>
        <boxGeometry args={[halfW * 2 + 0.16, 0.1, 0.05]} />
      </mesh>

      {/* Sashes: one mullion up the middle, one transom across, and a slim
          surround — enough to read as glazing without cutting the view up. */}
      <mesh material={frameDark} position={[0, midY, front - 0.01]}>
        <boxGeometry args={[0.05, height, 0.04]} />
      </mesh>
      <mesh material={frameDark} position={[0, midY + 0.24, front - 0.01]}>
        <boxGeometry args={[halfW * 2, 0.045, 0.04]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={frameDark} position={[s * (halfW - 0.03), midY, front - 0.01]}>
          <boxGeometry args={[0.05, height, 0.04]} />
        </mesh>
      ))}

      {/* A catch where the mullion meets the transom, and nothing else. There
          was a stay out on the glass beside it, which had nothing to be fixed
          to and read as a bar of gold hanging in the view. */}
      <mesh material={brass} position={[0, midY + 0.24, front + 0.02]}>
        <cylinderGeometry args={[0.035, 0.035, 0.05, 8]} />
      </mesh>
    </group>
  );
}

export function Windows() {
  return (
    <group>
      <Vista />
      <Window x={-WINDOW_X} />
      <Window x={WINDOW_X} />
    </group>
  );
}
