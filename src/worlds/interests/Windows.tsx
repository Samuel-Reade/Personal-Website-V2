import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flatMat } from "./materials";
import { PALETTE } from "./palette";
import { PALETTE as RANGE } from "../associations/palette";
import { PROFILE } from "../associations/envelope";
import { NIGHT_SKY } from "../../three/celestial";
import { elevationFraction, getSunState } from "../../utils/time";
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
 * The sill is the number that matters, and it is low. A window can only look
 * as far down as the line from the eye over its sill, and at 1.02 — which is
 * where these sills were, tucked above the dado — that line was four degrees
 * below horizontal. Four degrees is nothing. It is enough to see the sea's
 * edge and not one thing below it, which is a poor window for a house on a
 * summit: everything the house is *above* was under the sill and could not be
 * shown. At 0.4 the same line is fifteen degrees down, and the country falls
 * away inside the frame instead of behind it.
 *
 * That costs the dado, which ran the full width of the wall at 0.95 and now
 * has to die into the two casings and pick up again between them — which is
 * what a dado does when it meets a window anyway (see `Room` in `Shelf.tsx`).
 *
 * Wide enough to be worth turning your head for: two metres across, on a wall
 * whose bookcase is three and a half.
 */
export const WINDOW_X = 3.05;
export const WINDOW_HALF_WIDTH = 1.0;
export const WINDOW_SILL = 0.4;
export const WINDOW_HEAD = 2.52;

/**
 * Where the horizon falls in the window, in cone units — see `cone` below.
 *
 * Not the middle of the frame. The horizon is the line level with the eye,
 * and the middle of this window is above the eye: the sill is a little below
 * it, the head a long way above. So the water's edge lands four tenths of the
 * way up the glass, and everything on land lands below that. Everything
 * outside is placed against this rather than against the centre of the frame,
 * because it is the one line in the view whose height is not a choice.
 */
export const HORIZON =
  -((WINDOW_SILL + WINDOW_HEAD) / 2 - EYE[1]) / ((WINDOW_HEAD - WINDOW_SILL) / 2);

/**
 * Where a horizontal running along the back wall still has wall to run on.
 *
 * The openings reach below the dado now, so it goes in three pieces: out to
 * the outside of each casing, and the stretch between the two windows. Kept
 * here rather than in `Shelf.tsx`, which draws it, because the numbers it has
 * to miss are these ones.
 */
const CASING_OUT = WINDOW_X + WINDOW_HALF_WIDTH + 0.11;
const CASING_IN = WINDOW_X - WINDOW_HALF_WIDTH - 0.11;
export const DADO_RUNS: [number, number][] = [
  [-WALL_HALF_WIDTH, -CASING_OUT],
  [-CASING_IN, CASING_IN],
  [CASING_OUT, WALL_HALF_WIDTH],
];

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
/** A band of haze along the water, in front of the range and behind the land. */
const HAZE_Z = -62;

/**
 * Where the water's edge sits: at the height of the eye, full stop.
 *
 * That is what a horizon is — the line level with the viewer, however high the
 * viewer is standing — and because these are flat billboards facing the eye,
 * putting the top of the water at the eye's own height is all it takes. It
 * lands on `HORIZON` in every window and at every depth, which is what makes
 * the whole view hang together: the sea's edge, the tops of the far range and
 * the balloons all agree about where level is.
 */
const SEA_TOP = EYE[1];

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

/**
 * Land on the far side of the water, sized against the frame it shows up in.
 *
 * Its feet are at the horizon — anything lower is behind the sea — and it only
 * just breaks that line. It is the far shore of a bay seen from a summit, not
 * a range you are standing among: what carries at sixty-six units through a
 * two-metre hole is a pale, low, hazy edge to the water, and peaks any taller
 * would close in a view whose whole subject is how much air is in it.
 */
const RANGE_CONE = cone(WINDOW_X, RANGE_Z);
const FAR_RANGE: Ridge = {
  seed: 1,
  span: 220,
  baseY: SEA_TOP - 0.5,
  peak: RANGE_CONE.halfHeight * 0.16,
  wave: 0.32,
  roughness: RANGE_CONE.halfHeight * 0.03,
};
// High: at this size a snowline any lower puts a pale cap across the whole top
// of each hill, and a low hill that is a third white reads as a flying saucer
// rather than as a mountain.
const RANGE_SNOWLINE = SEA_TOP + RANGE_CONE.halfHeight * 0.145;
/**
 * How far each step of haze stands above the water, palest and lowest first.
 * The shore's tops clear all three; its feet clear none of them.
 */
const HAZE_RISE = [0.4, 0.7, 1.0].map((f) => RANGE_CONE.halfHeight * 0.085 * f);

/* -------------------------------------------------------------------------
   The land below
   ---------------------------------------------------------------------- */

/**
 * The house is on the summit of the range's middle mountain — the right-hand
 * peak of it — and the windows look out over the drop and the water beyond.
 *
 * Four silhouettes at four depths rather than a modelled landform. What makes
 * them read as ground falling away from under you is that every one of them is
 * *below the horizon*, and that they climb toward it with distance: the
 * nearest bottoms out far under the sill and never shows you where it ends,
 * and each ridge further off bottoms out higher than the last, until the
 * furthest is a thin dark edge just under the water's line. That is what a
 * drop does seen from above it — you cannot see the floor of one that begins
 * beneath you, only the shoulders of it running away and the air in between.
 *
 * The crests go the other way, the nearest reaching highest, so the near
 * ground closes in at the jambs and the bay opens up the middle.
 *
 * Every number below is in cone units — see `cone` — and, unlike the rest of
 * the view, crests and troughs are measured from `HORIZON` rather than from
 * the middle of the frame, so the sign says the thing that matters: land is
 * negative, because land seen from a summit is under the horizon. Spans are in
 * half-widths; over 2 runs out past both jambs.
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
  // The summit's own rock, falling away at either hand from directly under the
  // window. Its crest all but touches the horizon, because it is the only
  // ground out there as high as the house is.
  { seed: 31, z: -9, crest: -0.02, trough: -2.2, span: 2.3, roughness: 0.08 },
  { seed: 13, z: -18, crest: -0.14, trough: -1.3, span: 2.9, roughness: 0.12 },
  { seed: 7, z: -30, crest: -0.17, trough: -0.78, span: 3.1, roughness: 0.1 },
  // The last headland before the water, and mostly haze by the time it gets
  // here.
  { seed: 3, z: -46, crest: -0.25, trough: -0.44, span: 3.3, roughness: 0.05 },
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
    crest: c.y + c.halfHeight * (HORIZON + spec.crest),
    trough: c.y + c.halfHeight * (HORIZON + spec.trough),
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
 * Height of a conifer on each flank, and how many of them, as a fraction of
 * that flank's half-frame *across* — see `trees` below for why it is measured
 * against the frame at all, and half-widths rather than half-heights because
 * the width of the opening is the one dimension of it that is not up for
 * discussion.
 *
 * A fringe of small ones on the first: that flank is the summit's own scrub and
 * is nearly all above the treeline. A fuzz of them on the last, where a tree is
 * three pixels across and all they do is keep the far shore from reading as
 * bare ground.
 */
const FLANK_TREES = [0.045, 0.075, 0.05, 0.032];
const FLANK_TREE_COUNT = [55, 190, 150, 110];

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
      flankHeight(flank, dx * flank.halfWidth) + FLANK_TREES[layer] * flank.halfWidth;
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

/**
 * Every colour outside, as the pair it is lerped between: what it is at noon
 * and what it is at midnight.
 *
 * The country through these windows used to be painted from one boolean read
 * at mount — `getSunState().isDay` — which meant it could only ever be full
 * day or full night, and whichever it was when the room mounted it stayed. The
 * rest of the site does not work that way: the meadow, the range and the sea
 * all drive their colours off the sun's height every frame, so they have a
 * dusk and a dawn. This is that, for a view that happens to be built out of
 * flat planes: hold both ends and mix them by the same fraction the other
 * worlds use.
 */
const VISTA_TONES = {
  sky: ["#c3d3dc", `#${NIGHT_SKY.getHexString()}`],
  // The far range is mostly haze: at this distance the air is doing more to
  // its colour than the rock is.
  far: ["#b0bec4", "#1a2330"],
  farSnow: ["#e2e9ee", "#39414f"],
  // Water. Muted and a little grey: it is a bay seen from a long way up, and
  // open water at that distance is nearer the sky's colour than it is to any
  // blue you would call blue.
  sea: ["#6a8b9e", "#141d2a"],
  rock: [RANGE.boulderDark, "#232733"],
  rigging: ["#5a5348", "#1b1b1c"],
  basket: [RANGE.basket, "#2a1f14"],
} as const;

/**
 * Haze lying on the water, where the far shore comes down to it.
 *
 * Three steps rather than one band. A plane has a hard top edge, and a single
 * one of these — however close to the sky's colour — draws a line clean across
 * the view that reads as a seam in the glass. Three thin ones, each nearer the
 * sky than the last, step out of the horizon instead, which is near enough to
 * a gradient at this size.
 */
const HAZE_TONES: [string, string][] = [
  ["#d2dce1", "#111827"],
  ["#cbd8dd", "#0e1420"],
  ["#c6d5db", "#0c111b"],
];

/**
 * The four steps of ground, near to far, and the pines on the ones that carry
 * them.
 *
 * The nearest is the dark scrub of high ground — the house is on a summit, and
 * what is directly under its windows is above the treeline, which is why the
 * boulders are all on that one. The rest is that world's own forest, each step
 * a shade paler and bluer than the one in front of it — at forty units the air
 * is already doing more to a hillside's colour than the trees on it are, and
 * that fade is most of what says the far one is far.
 */
const FLANK_TONES: [string, string][] = [
  [RANGE.grassDark, "#131f16"],
  [RANGE.grass, "#18261b"],
  ["#87a07d", "#1a2620"],
  ["#94a898", "#1d2530"],
];
const PINE_TONES: [string, string][] = [
  [RANGE.pineDark, "#0d1710"],
  [RANGE.pine, "#111d15"],
  ["#5f8064", "#14211a"],
  ["#79907e", "#161f22"],
];

function Vista() {
  /**
   * Built once and then repainted every frame, which is why these are their
   * own instances rather than `flatMat`'s. That cache hands the same material
   * to everything asking for a colour, so driving one of these through a
   * sunset would drive the shelf's own woodwork through it too.
   */
  const materials = useMemo(() => {
    const lambert = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const basic = (c: string) => new THREE.MeshBasicMaterial({ color: c });
    return {
      sky: basic(VISTA_TONES.sky[0]),
      star: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0 }),
      far: lambert(VISTA_TONES.far[0]),
      farSnow: lambert(VISTA_TONES.farSnow[0]),
      sea: basic(VISTA_TONES.sea[0]),
      rock: lambert(VISTA_TONES.rock[0]),
      rigging: lambert(VISTA_TONES.rigging[0]),
      basket: lambert(VISTA_TONES.basket[0]),
      haze: HAZE_TONES.map(([d]) => basic(d)),
      flank: FLANK_TONES.map(([d]) => lambert(d)),
      pine: PINE_TONES.map(([d]) => lambert(d)),
      // The silks keep their colours: a club's balloon is its colours at any
      // hour, and the range's own four are lit the same way after dark.
      uclaA: flatMat(RANGE.rugbyA),
      uclaB: flatMat(RANGE.rugbyB),
      olyA: flatMat(RANGE.olympicA),
      olyB: flatMat(RANGE.olympicB),
      lamA: flatMat(RANGE.lambdaA),
      lamB: flatMat(RANGE.lambdaB),
      staA: flatMat(RANGE.statsA),
      staB: flatMat(RANGE.statsB),
    };
  }, []);

  /** The day and night ends of each animated material, as three.js colours. */
  const ramps = useMemo(() => {
    const pair = (m: THREE.Material & { color: THREE.Color }, tones: readonly [string, string]) =>
      ({ material: m, day: new THREE.Color(tones[0]), night: new THREE.Color(tones[1]) });
    return [
      pair(materials.sky, VISTA_TONES.sky),
      pair(materials.far, VISTA_TONES.far),
      pair(materials.farSnow, VISTA_TONES.farSnow),
      pair(materials.sea, VISTA_TONES.sea),
      pair(materials.rock, VISTA_TONES.rock),
      pair(materials.rigging, VISTA_TONES.rigging),
      pair(materials.basket, VISTA_TONES.basket),
      ...materials.haze.map((m, i) => pair(m, HAZE_TONES[i])),
      ...materials.flank.map((m, i) => pair(m, FLANK_TONES[i])),
      ...materials.pine.map((m, i) => pair(m, PINE_TONES[i])),
    ];
  }, [materials]);

  useEffect(
    () => () => {
      for (const { material } of ramps) material.dispose();
      materials.star.dispose();
    },
    [ramps, materials]
  );

  /**
   * Repaint on the visitor's own clock.
   *
   * `elevationFraction(...) + 0.15` is the same curve the range's own lighting
   * uses, so a sunset seen through this window happens at the moment the
   * meadow's does. The stars come up on a smoothstep just under the horizon,
   * which is what keeps them out of a blue sky and still lets them arrive
   * before it is fully dark.
   */
  const starGroup = useRef<THREE.Group>(null!);
  useFrame(() => {
    const sun = getSunState();
    const day = THREE.MathUtils.clamp(elevationFraction(sun.elevation) + 0.15, 0, 1);
    for (const { material, day: lit, night } of ramps) material.color.copy(night).lerp(lit, day);
    const dark = 1 - THREE.MathUtils.smoothstep(day, 0.0, 0.32);
    materials.star.opacity = dark;
    starGroup.current.visible = dark > 0.01;
  });

  const ridges = useMemo(
    () => ({
      // Filled only to a little under the water's line: everything below that
      // is behind the sea.
      far: ridgeGeometry(FAR_RANGE, SEA_TOP - 4),
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
        // Above the horizon only: below it is water, and a star in the sea is
        // a hole in the world.
        y: SEA_TOP + 1 + seeded(i * 5.7 + 2) * 29,
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
      for (let i = 0; i < FLANK_TREE_COUNT[flank.layer]; i++) {
        const salt = i * 2.7 + flank.seed * 31 + flank.side * 40 + flank.layer * 500;
        const x = (seeded(salt) - 0.5) * flank.halfWidth * 2.6;
        const h = size * flank.halfWidth * (0.7 + seeded(salt + 3) * 0.7);
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

  /**
   * Boulders strewn over the summit's rock and the shoulder below it, which is
   * how the range carries its own high ground — see the peaks in the
   * Extracurriculars world. Small, and half buried: standing proud of the slope
   * they read as tents pitched on the hillside rather than as stone in it.
   */
  const rocks = useMemo(() => {
    const out: { x: number; y: number; z: number; r: number; h: number; tilt: number }[] = [];
    for (const { flank } of flanks) {
      if (flank.layer > 1) continue;
      for (let i = 0; i < 9; i++) {
        const salt = i * 11 + flank.seed * 7 + flank.side * 3;
        const x = (seeded(salt) - 0.5) * flank.halfWidth * 2.2;
        const h = flank.halfWidth * (0.028 + seeded(salt + 5) * 0.024);
        const skyline = flankHeight(flank, x);
        const face = Math.max(0, skyline - flank.frameBottom);
        const y = skyline - h * 0.5 - seeded(salt + 13) ** 2 * face * 0.8;
        if (y + h < flank.frameBottom) continue;
        out.push({
          x: flank.x + x,
          y,
          z: flank.z + h * 0.4,
          r: h * (0.6 + seeded(salt + 17) * 0.35),
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
   * Out past the last of the land, forty to fifty units off, over open water.
   * They fly tethered over the range's northern ridges, and from a summit that
   * far back they are a tight group of four out on the horizon rather than
   * four balloons at the glass — which is what they look like from the
   * helicopter, and the helicopter is a long way in front of this window.
   *
   * `dy` is measured from `HORIZON` here, not from the middle of the frame, so
   * a zero puts a balloon exactly level with the house — which is what it is,
   * the summit and the tether-tops being at much the same height. It is a
   * floor rather than a position, though: whatever it asks for, a balloon is
   * lifted until its basket clears the treeline of every slope standing in
   * front of it — see `screenSkyline`.
   *
   * The radii are all near seven hundredths of a half-width, which is the size
   * they come out at in the photograph from the cockpit. Big enough that the
   * two silks of a club still read; small enough to be out there.
   */
  const balloons = useMemo(() => {
    const specs = [
      { z: -38, dx: -0.34, dy: 0.06, radius: 0.9, a: "olyA", b: "olyB" },
      { z: -42, dx: -0.12, dy: 0.2, radius: 1.0, a: "uclaA", b: "uclaB" },
      { z: -46, dx: 0.14, dy: -0.02, radius: 0.95, a: "lamA", b: "lamB" },
      { z: -50, dx: 0.36, dy: 0.14, radius: 1.15, a: "staA", b: "staB" },
    ] as const;
    return specs.map((spec) => {
      const c = cone(-WINDOW_X, spec.z);
      const clear =
        screenSkyline(spec.dx, spec.z) + (BALLOON_DROP * spec.radius) / c.halfHeight + 0.04;
      const dy = Math.max(HORIZON + spec.dy, clear);
      return { ...spec, x: c.x + spec.dx * c.halfWidth, y: c.y + dy * c.halfHeight };
    });
  }, []);

  return (
    <group>
      {/* Sky. A plane rather than a dome: it is only ever seen through two
          small openings, and a dome would be geometry nobody looks at. */}
      <mesh material={materials.sky} position={[0, 6, SKY_Z]}>
        <planeGeometry args={[280, 130]} />
      </mesh>
      {/* The stars stay mounted and fade, rather than being switched in when
          `isDay` goes false — a hard cut is what gives a simulated sky away,
          and the group is hidden outright once they are invisible so a clear
          afternoon costs nothing to draw. */}
      <group ref={starGroup} visible={false}>
        {stars.map((s, i) => (
          <mesh key={i} material={materials.star} position={[s.x, s.y, SKY_Z + 0.5]}>
            <planeGeometry args={[s.size, s.size]} />
          </mesh>
        ))}
      </group>

      {/* The far shore, and the snow on the tops of it. */}
      <mesh geometry={ridges.far} material={materials.far} position={[0, 0, RANGE_Z]} />
      <mesh geometry={ridges.farSnow} material={materials.farSnow} position={[0, 0, RANGE_Z + 0.1]} />

      {/* Haze lying along the water, standing in front of that shore and
          taking the foot of it — so what is left of it is a line of pale peaks
          with nothing holding them up, which is what distance does to land
          across a bay. The palest step goes in front, and each one behind it
          stands a little higher, so they read as one band fading upward.
          Everything below the horizon is behind the water, so none of this is
          ever seen under it. */}
      {HAZE_RISE.map((rise, i) => (
        <mesh
          key={i}
          material={materials.haze[i]}
          position={[0, SEA_TOP + rise - 5, HAZE_Z - i * 0.6]}
        >
          <planeGeometry args={[240, 10]} />
        </mesh>
      ))}

      {/* The water. Its edge is at the height of the eye, which is where a
          horizon is from any height — so the bay reads as far below and a long
          way out rather than as a blue wall standing behind the hills. */}
      <mesh material={materials.sea} position={[0, SEA_TOP - 20, SEA_Z]}>
        <planeGeometry args={[240, 40]} />
      </mesh>

      {/* The land: four steps per window, the nearest last. */}
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

/**
 * One arch to the opening, springing at 1.52 and crowning on the head.
 *
 * Its radius is the window's own half-width, so at the middle of the glass the
 * arc reaches the top of the opening and takes nothing at all; what it masks
 * is the two top corners, and it masks more of them the further out you look.
 * That costs the view nothing. At the widest balloon's place across the frame
 * the arc still stands at +0.94 in the frame's own units, and the highest
 * thing the window was built to show is a balloon crown at +0.10, over the far
 * shore's peaks at +0.04 and the horizon at -0.17. Only sky is above the line
 * anywhere the arch comes down.
 */
const LIGHT_R = WINDOW_HALF_WIDTH;
const SPRING_Y = WINDOW_HEAD - LIGHT_R;

/**
 * The wall left between the arch and the square top of the hole it is cut into
 * — the two spandrels over its haunches.
 *
 * Without this the opening stays rectangular and the arch is a picture painted
 * on it: you would see the country through the very corners the arch is
 * supposed to have filled. Built as columns rather than as a fan so the arc
 * stays piecewise-linear across its whole width, and it carries its own soffit
 * through the wall's thickness, which is the surface the head's reveal used to
 * be.
 */
function spandrelGeometry(): THREE.BufferGeometry {
  const hw = WINDOW_HALF_WIDTH;
  const back = WALL_Z - WALL_DEPTH / 2;
  const front = WALL_Z + WALL_DEPTH / 2;
  const steps = 44;
  const positions: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => positions.push(...a, ...b, ...c);
  /** The arc, centred on the opening's middle at the springing. */
  const archTop = (x: number) =>
    SPRING_Y + Math.sqrt(Math.max(0, LIGHT_R * LIGHT_R - x * x));

  for (let i = 0; i < steps; i++) {
    const x0 = -hw + (2 * hw * i) / steps;
    const x1 = -hw + (2 * hw * (i + 1)) / steps;
    const y0 = archTop(x0);
    const y1 = archTop(x1);

    // The room's face, and the outside one wound the other way.
    tri([x0, y0, front], [x1, y1, front], [x1, WINDOW_HEAD, front]);
    tri([x0, y0, front], [x1, WINDOW_HEAD, front], [x0, WINDOW_HEAD, front]);
    tri([x1, y1, back], [x0, y0, back], [x1, WINDOW_HEAD, back]);
    tri([x1, WINDOW_HEAD, back], [x0, y0, back], [x0, WINDOW_HEAD, back]);

    // The soffit: the curved underside of the arch through the wall.
    tri([x0, y0, back], [x1, y1, back], [x1, y1, front]);
    tri([x0, y0, back], [x1, y1, front], [x0, y0, front]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** One window: a reveal, two arched lights in a wood frame, a sill and an apron. */
function Window({ x }: { x: number }) {
  const frame = useMemo(() => flatMat(PALETTE.wood), []);
  const frameDark = useMemo(() => flatMat(PALETTE.woodDark), []);
  const trim = useMemo(() => flatMat(PALETTE.wallTrim), []);
  const wall = useMemo(() => flatMat(PALETTE.wall), []);
  const brass = useMemo(() => flatMat(PALETTE.candleFlame), []);

  const halfW = WINDOW_HALF_WIDTH;
  const midY = (WINDOW_SILL + WINDOW_HEAD) / 2;
  const height = WINDOW_HEAD - WINDOW_SILL;
  const lower = SPRING_Y - WINDOW_SILL;
  const front = WALL_Z + WALL_DEPTH / 2;

  const spandrel = useMemo(spandrelGeometry, []);
  useEffect(() => () => spandrel.dispose(), [spandrel]);

  /** The rectangular light under each arch, in three panes across and four up. */
  /** One arch, so one fanlight — five spokes across it rather than three. */
  const spokes = [Math.PI / 6, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3, (5 * Math.PI) / 6];
  /** Glazing bars: three lights across the rectangular part, four rows up it. */
  const mullions = [-1, 1].map((s) => (s * WINDOW_HALF_WIDTH) / 3);
  const transoms = [0.25, 0.5, 0.75];

  return (
    <group position={[x, 0, 0]}>
      {/* Reveal down the jambs. The head's reveal is the spandrel's own
          soffit now — the arch is cut in the wall, not drawn on it. */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={trim} position={[s * (halfW - 0.02), (WINDOW_SILL + SPRING_Y) / 2, WALL_Z]}>
          <boxGeometry args={[0.04, lower, WALL_DEPTH]} />
        </mesh>
      ))}
      <mesh geometry={spandrel} material={wall} />

      {/* Casing: jambs to the springing, the arch over them, and a keystone at
          the crown. */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={frame} position={[s * (halfW + 0.055), (WINDOW_SILL + SPRING_Y) / 2, front + 0.02]}>
          <boxGeometry args={[0.11, lower, 0.05]} />
        </mesh>
      ))}
      <mesh material={frame} position={[0, SPRING_Y, front + 0.02]}>
        <torusGeometry args={[LIGHT_R + 0.055, 0.055, 6, 24, Math.PI]} />
      </mesh>
      <mesh material={frameDark} position={[0, WINDOW_HEAD + 0.11, front + 0.03]}>
        <boxGeometry args={[0.24, 0.3, 0.07]} />
      </mesh>

      {/* Sill and apron. */}
      <mesh material={frame} position={[0, WINDOW_SILL - 0.04, front + 0.05]}>
        <boxGeometry args={[halfW * 2 + 0.34, 0.08, 0.16]} />
      </mesh>
      <mesh material={frameDark} position={[0, WINDOW_SILL - 0.13, front + 0.01]}>
        <boxGeometry args={[halfW * 2 + 0.16, 0.1, 0.05]} />
      </mesh>

      {/* The joinery: jamb stiles, the bar on the springing, and a grid of
          three lights across the rectangular part by four rows up it. */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={frameDark} position={[s * (halfW - 0.03), (WINDOW_SILL + SPRING_Y) / 2, front - 0.01]}>
          <boxGeometry args={[0.05, lower, 0.04]} />
        </mesh>
      ))}
      <mesh material={frameDark} position={[0, SPRING_Y, front - 0.01]}>
        <boxGeometry args={[halfW * 2, 0.05, 0.04]} />
      </mesh>
      {mullions.map((mx) => (
        <mesh key={`m${mx}`} material={frameDark} position={[mx, (WINDOW_SILL + SPRING_Y) / 2, front - 0.01]}>
          <boxGeometry args={[0.04, lower, 0.038]} />
        </mesh>
      ))}
      {transoms.map((f) => (
        <mesh key={f} material={frameDark} position={[0, WINDOW_SILL + lower * f, front - 0.01]}>
          <boxGeometry args={[halfW * 2, 0.04, 0.038]} />
        </mesh>
      ))}

      {/* And the fanlight: a ring on the springing and five spokes off its
          centre, which is the head Reade Hall's own windows carry. */}
      <group position={[0, SPRING_Y, front - 0.01]}>
        <mesh material={frameDark}>
          <torusGeometry args={[LIGHT_R - 0.02, 0.024, 6, 24, Math.PI]} />
        </mesh>
        {spokes.map((a) => (
          <mesh
            key={a}
            material={frameDark}
            position={[Math.cos(a) * LIGHT_R * 0.5, Math.sin(a) * LIGHT_R * 0.5, 0]}
            rotation={[0, 0, a - Math.PI / 2]}
          >
            <boxGeometry args={[0.03, LIGHT_R, 0.032]} />
          </mesh>
        ))}
      </group>

      {/* A catch where the middle glazing bar crosses the second transom. */}
      <mesh material={brass} position={[mullions[1], WINDOW_SILL + lower * 0.5, front + 0.02]}>
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
