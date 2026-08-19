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
 * standing in while you read the shelf. It is a house on the range: the same
 * mountains the helicopter flies over in the Extracurriculars world, seen from
 * a room near the top of one of them. The palette is imported from that world
 * rather than matched by eye, so the rock, the pines and the balloon silks are
 * literally its colours.
 *
 * The left window is aimed: the association balloons are placed on its own
 * sightline (see `sightline` below), so turning to look out of it finds them
 * over the trees. The right window looks along the range the other way, out to
 * the coast, and has no balloons in it — one window that rewards a look and one
 * that establishes the place reads better than two of the same.
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
 * Where the middle of a window's view lands at a given depth.
 *
 * The camera never moves, so a window is a fixed cone through the room and
 * every part of the view can be put exactly where it will be seen. The
 * balloons are placed on the left window's line at the depth they float at
 * rather than positioned by eye — which is the difference between "there are
 * balloons out there somewhere" and "look out of the left window and they are
 * in it".
 */
function sightline(windowX: number, z: number): [number, number] {
  const centreY = (WINDOW_SILL + WINDOW_HEAD) / 2;
  const t = (EYE[2] - z) / (EYE[2] - WALL_Z);
  return [EYE[0] + (windowX - EYE[0]) * t, EYE[1] + (centreY - EYE[1]) * t];
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

/** Depths the three ranges sit at. Named so the balloons and trees can be put
 *  in front of or behind them deliberately rather than by trial. */
const FAR_Z = -34;
const SEA_Z = -30;
const MID_Z = -22;
const NEAR_Z = -14;

/**
 * Where the water's edge sits.
 *
 * On the eye line at the sea's own depth, which is what a horizon is: the line
 * level with the viewer, however high the viewer is standing. Derived rather
 * than chosen, so the balloons — also placed on that line — sit on the horizon
 * the way they do from the helicopter.
 */
const SEA_TOP = EYE[1] + ((WINDOW_SILL + WINDOW_HEAD) / 2 - EYE[1]) * ((EYE[2] - SEA_Z) / (EYE[2] - WALL_Z));

/** Deterministic pseudo-random in [0, 1) — the view is the same on every visit. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A ridge of mountains as one flat silhouette: a jagged top edge dropped to a
 * base. Flat rather than modelled because every one of these is between twelve
 * and thirty units away through a two-metre hole — what carries at that
 * distance is the skyline, and a heightfield would cost a great deal to say
 * the same thing.
 */
interface Ridge {
  seed: number;
  span: number;
  baseY: number;
  peak: number;
  roughness: number;
}

/** The skyline of a ridge at a given x — shared by its silhouette, its snow and its trees. */
function ridgeHeight(r: Ridge, x: number): number {
  const t = (x + r.span / 2) / r.span;
  // Two octaves: a few big summits with smaller shoulders on them.
  const big = Math.sin(t * Math.PI * 2.1 + seeded(r.seed) * 6.3);
  const small = Math.sin(t * Math.PI * 7.3 + seeded(r.seed + 4) * 6.3);
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
  const steps = 96;
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
      // The two forested ranges. Green, because this is that world's country —
      // they were grey, which read as a different set of mountains entirely.
      mid: flatMat(day("#7f9a72", "#16241d")),
      near: flatMat(day(RANGE.grass, "#182a1e")),
      rock: flatMat(day(RANGE.rock, "#232733")),
      pineMid: flatMat(day(RANGE.pineDark, "#101c14")),
      pineNear: flatMat(day(RANGE.pine, "#13231a")),
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

  /** The three ranges, nearest last, each at its own depth below. */
  const spec = useMemo(
    () => ({
      // The far range has to break the horizon to be seen at all: the sea's
      // edge sits at eye level, so anything lower than that is behind water.
      far: { seed: 1, span: 150, baseY: 4.2, peak: 5.4, roughness: 0.8 },
      mid: { seed: 7, span: 120, baseY: 0.9, peak: 2.8, roughness: 0.6 },
      near: { seed: 13, span: 90, baseY: 0.2, peak: 2.0, roughness: 0.4 },
    }),
    []
  );

  const ridges = useMemo(
    () => ({
      far: ridgeGeometry(spec.far, -14),
      farSnow: ridgeGeometry(spec.far, 7.6),
      mid: ridgeGeometry(spec.mid, -14),
      near: ridgeGeometry(spec.near, -14),
    }),
    [spec]
  );

  const gores = useMemo(() => goreGeometry(1), []);

  /** Stars, scattered across the upper sky and only mounted after dark. */
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        x: (seeded(i * 3.1) - 0.5) * 130,
        y: 8 + seeded(i * 5.7 + 2) * 26,
        size: 0.1 + seeded(i * 9.3 + 5) * 0.16,
      })),
    []
  );

  /**
   * Conifers on the two forested crests, in the two places the windows
   * actually look. Scattered across the whole span they would be thousands of
   * cones, almost none of them ever seen.
   */
  const trees = useMemo(() => {
    const out: { x: number; y: number; z: number; h: number; far: boolean }[] = [];
    for (const side of [-1, 1] as const) {
      for (const [ridge, z, count, size, far] of [
        [spec.near, NEAR_Z, 120, 0.6, false],
        [spec.mid, MID_Z, 90, 0.85, true],
      ] as const) {
        const [cx] = sightline(side * WINDOW_X, z);
        for (let i = 0; i < count; i++) {
          const salt = i * 2.7 + side * 40 + (far ? 500 : 0);
          const x = cx + (seeded(salt) - 0.5) * (far ? 34 : 24);
          const h = size * (0.7 + seeded(salt + 3) * 0.7);
          // Standing on the crest the ridge actually has at that x, so the
          // treeline follows the skyline instead of cutting across it.
          out.push({
            x,
            y: ridgeHeight(ridge, x) - h * 0.35 - seeded(salt + 7) * 0.4,
            z: z + 0.3 + seeded(salt + 11) * 1.1,
            h,
            far,
          });
        }
      }
    }
    return out;
  }, [spec]);

  /**
   * The four balloons, one per club, in the colours their envelopes are cut
   * from in the range itself.
   *
   * Level with the window rather than above it: the house is on a summit at
   * the height they fly at, so they sit on the eye line — `sightline` returns
   * exactly that, and the offsets below only spread them around it. And far
   * enough out that they read as balloons over a valley rather than as
   * balloons at the glass.
   */
  const balloons = useMemo(() => {
    const specs = [
      { depth: -23.5, dx: -4.6, dy: 0.55, radius: 1.05, a: "olyA", b: "olyB" },
      { depth: -26.0, dx: -1.3, dy: -0.4, radius: 1.15, a: "uclaA", b: "uclaB" },
      { depth: -28.5, dx: 2.4, dy: 0.95, radius: 1.2, a: "lamA", b: "lamB" },
      // Kept inside the cone: at +8 this one sat within a hand's breadth of
      // the edge of a view 8.3 wide and was cropped away by the jamb.
      { depth: -25.0, dx: 5.6, dy: -0.2, radius: 1.1, a: "staA", b: "staB" },
    ] as const;
    return specs.map((spec) => {
      const [cx, cy] = sightline(-WINDOW_X, spec.depth);
      return { ...spec, x: cx + spec.dx, y: cy + spec.dy };
    });
  }, []);

  return (
    <group>
      {/* Sky. A plane rather than a dome: it is only ever seen through two
          small openings, and a dome would be geometry nobody looks at. */}
      <mesh material={materials.sky} position={[0, 12, -40]}>
        <planeGeometry args={[200, 80]} />
      </mesh>
      {!isDay &&
        stars.map((s, i) => (
          <mesh key={i} material={materials.star} position={[s.x, s.y, -39.5]}>
            <planeGeometry args={[s.size, s.size]} />
          </mesh>
        ))}

      {/* The far range, and the snow on the tops of it. */}
      <mesh geometry={ridges.far} material={materials.far} position={[0, 0, FAR_Z]} />
      <mesh geometry={ridges.farSnow} material={materials.farSnow} position={[0, 0, FAR_Z + 0.1]} />

      {/* The water. Its edge is put on the eye line, which is where a horizon
          is from any height — so the sea reads as far below and a long way
          out, rather than as a blue wall standing behind the hills. */}
      <mesh material={materials.sea} position={[0, SEA_TOP - 14, SEA_Z]}>
        <planeGeometry args={[200, 28]} />
      </mesh>

      <mesh geometry={ridges.mid} material={materials.mid} position={[0, 0, MID_Z]} />
      <mesh geometry={ridges.near} material={materials.near} position={[0, 0, NEAR_Z]} />
      {/* Rock breaking through the turf on the nearest crest. */}
      {[-1, 1].map((side) => {
        const [cx] = sightline(side * WINDOW_X, NEAR_Z);
        return [0, 1, 2].map((i) => {
          const x = cx + (seeded(i * 13 + side * 3) - 0.5) * 18;
          return (
            <mesh
              key={`${side}-${i}`}
              material={materials.rock}
              position={[x, ridgeHeight(spec.near, x) - 0.1, NEAR_Z + 0.4]}
              rotation={[0, 0, seeded(i * 5 + side) * 0.6]}
            >
              <coneGeometry args={[0.5 + seeded(i * 7) * 0.4, 0.7, 5]} />
            </mesh>
          );
        });
      })}

      {trees.map((t, i) => (
        <mesh
          key={i}
          material={t.far ? materials.pineMid : materials.pineNear}
          position={[t.x, t.y + t.h / 2, t.z]}
        >
          <coneGeometry args={[t.h * 0.3, t.h, 6]} />
        </mesh>
      ))}

      {balloons.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.depth]} scale={b.radius}>
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
