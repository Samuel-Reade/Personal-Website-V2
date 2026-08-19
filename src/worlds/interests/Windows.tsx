import { useMemo } from "react";
import * as THREE from "three";
import { flatMat } from "./materials";
import { PALETTE } from "./palette";
import { PALETTE as RANGE } from "../associations/palette";
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
const FAR_Z = -27;
const MID_Z = -19;
const NEAR_Z = -12.4;

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

/** One balloon, at the size it reads from a dozen or so units away. */
function Balloon({
  silk,
  band,
  radius,
}: {
  silk: THREE.Material;
  band: THREE.Material;
  radius: number;
}) {
  /** Where the load tapes sit, as a fraction of the envelope's radius. */
  const tapes = [-0.45, 0.05, 0.5];
  return (
    <group>
      {/* Envelope: a sphere drawn a little taller than wide, which is the whole
          difference between a balloon and a ball at this size. */}
      <mesh material={silk} scale={[1, 1.16, 1]}>
        <sphereGeometry args={[radius, 14, 12]} />
      </mesh>
      {/* Load tapes round it. A ring at height h on a sphere has radius
          R·sqrt(1 − h²) — got wrong first time as R·(1 − h²), which pinched
          them in and left them floating inside the silk instead of on it. */}
      {tapes.map((h, i) => (
        <mesh
          key={i}
          material={band}
          position={[0, radius * 1.16 * h, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[radius * Math.sqrt(1 - h * h), radius * 0.055, 5, 16]} />
        </mesh>
      ))}
      {/* Throat, narrowing downward — a cone's apex is up by default, so this
          is the rotation that stops the balloon reading as a mushroom. */}
      <mesh material={band} position={[0, -radius * 1.24, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius * 0.34, radius * 0.42, 8]} />
      </mesh>
      <mesh material={band} position={[0, -radius * 1.62, 0]}>
        <boxGeometry args={[radius * 0.34, radius * 0.28, radius * 0.34]} />
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
    const sky = isDay ? "#b9cdd6" : `#${NIGHT_SKY.getHexString()}`;
    return {
      sky: new THREE.MeshBasicMaterial({ color: sky }),
      snow: flatMat(isDay ? "#dfe7ec" : "#39424f"),
      snowNear: flatMat(isDay ? "#cfd9e0" : "#2c343f"),
      // Each ridge is hazed toward the sky colour by distance, which is the
      // whole of the depth cue at this scale.
      far: flatMat(isDay ? "#9fb2bd" : "#1b2431"),
      mid: flatMat(isDay ? "#8d9aa2" : "#18202c"),
      near: flatMat(isDay ? RANGE.rockDark : "#131a24"),
      slope: flatMat(isDay ? RANGE.grassDark : "#141d1a"),
      pine: flatMat(isDay ? RANGE.pineDark : "#0f1712"),
      star: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      silkA: flatMat(RANGE.statsB),
      silkB: flatMat(RANGE.rugbyB),
      silkC: flatMat(RANGE.olympicB),
      bandA: flatMat(RANGE.statsA),
      bandB: flatMat(RANGE.rugbyA),
      bandC: flatMat(RANGE.olympicA),
    };
  }, [isDay]);

  /** The three ranges, nearest last, each at its own depth below. */
  const spec = useMemo(
    () => ({
      far: { seed: 1, span: 120, baseY: 1.6, peak: 7.0, roughness: 0.9 },
      mid: { seed: 7, span: 100, baseY: 0.4, peak: 4.6, roughness: 0.7 },
      // The near crest is kept in a band that both windows can see. Its
      // skyline varies with x, and at -1.4 the stretch in front of the right
      // window fell below that window's lower edge — so the right window
      // looked out on bare ranges while the left had a forest along the
      // bottom of it. A shallower ridge on a higher base never drops out.
      near: { seed: 13, span: 80, baseY: 0.2, peak: 2.0, roughness: 0.4 },
    }),
    []
  );

  const ridges = useMemo(
    () => ({
      far: ridgeGeometry(spec.far, -12),
      // Snow on the far tops only, which is where it lies in the world these
      // mountains are borrowed from.
      farSnow: ridgeGeometry(spec.far, 6.4),
      mid: ridgeGeometry(spec.mid, -12),
      midSnow: ridgeGeometry(spec.mid, 4.3),
      near: ridgeGeometry(spec.near, -12),
    }),
    [spec]
  );

  /** Stars, scattered across the upper sky and only mounted after dark. */
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        x: (seeded(i * 3.1) - 0.5) * 110,
        y: 6 + seeded(i * 5.7 + 2) * 26,
        size: 0.1 + seeded(i * 9.3 + 5) * 0.16,
      })),
    []
  );

  /**
   * Conifers along the near ridge, in the two places the windows actually look.
   * Scattered across the whole span they would be thousands of cones, almost
   * none of them ever seen.
   */
  const trees = useMemo(() => {
    const out: { x: number; y: number; z: number; h: number }[] = [];
    for (const side of [-1, 1] as const) {
      const [cx] = sightline(side * WINDOW_X, NEAR_Z);
      for (let i = 0; i < 130; i++) {
        const x = cx + (seeded(i * 2.7 + side * 40) - 0.5) * 24;
        const h = 0.5 + seeded(i * 8.9 + side * 31) * 0.55;
        // Standing on the near ridge's own skyline rather than at a height
        // guessed for them. Placed below it they were under the window's cone
        // entirely — a forest nobody could see from either window.
        const crest = ridgeHeight(spec.near, x);
        out.push({
          x,
          y: crest - 0.25 - seeded(i * 6.1 + side * 23) * 0.5,
          // Just in front of the silhouette they stand on.
          z: NEAR_Z + 0.25 + seeded(i * 4.3 + side * 17) * 0.9,
          h,
        });
      }
    }
    return out;
  }, [spec]);

  /**
   * The balloons, on the left window's line at the depth they float at — the
   * one thing in the view that is aimed rather than scattered.
   */
  const balloons = useMemo(() => {
    // All three nearer than the mid range. Set behind it, two of them vanished
    // into the ridge and left a basket showing over the skyline like a bar of
    // gold floating in the sky — which is exactly what it looked like.
    const specs = [
      { depth: -14.6, dx: -1.6, dy: 0.5, radius: 0.72, silk: "silkA", band: "bandA" },
      // Lifted clear of the near crest: at -0.9 this one sat half behind the
      // ridge and read as a sunset rather than as a balloon.
      { depth: -16.4, dx: 2.6, dy: 0.55, radius: 0.8, silk: "silkB", band: "bandB" },
      { depth: -18.2, dx: -3.9, dy: 1.6, radius: 0.86, silk: "silkC", band: "bandC" },
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
      <mesh material={materials.sky} position={[0, 10, -33]}>
        <planeGeometry args={[150, 70]} />
      </mesh>
      {!isDay &&
        stars.map((s, i) => (
          <mesh key={i} material={materials.star} position={[s.x, s.y, -32.5]}>
            <planeGeometry args={[s.size, s.size]} />
          </mesh>
        ))}

      <mesh geometry={ridges.far} material={materials.far} position={[0, 0, FAR_Z]} />
      <mesh geometry={ridges.farSnow} material={materials.snow} position={[0, 0, FAR_Z + 0.1]} />
      <mesh geometry={ridges.mid} material={materials.mid} position={[0, 0, MID_Z]} />
      <mesh geometry={ridges.midSnow} material={materials.snowNear} position={[0, 0, MID_Z + 0.1]} />
      <mesh geometry={ridges.near} material={materials.near} position={[0, 0, NEAR_Z]} />
      {/* The shoulder of our own mountain, falling away below the windows. */}
      <mesh material={materials.slope} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, -7]}>
        <planeGeometry args={[120, 14]} />
      </mesh>

      {trees.map((t, i) => (
        <mesh key={i} material={materials.pine} position={[t.x, t.y + t.h / 2, t.z]}>
          <coneGeometry args={[t.h * 0.3, t.h, 6]} />
        </mesh>
      ))}

      {balloons.map((b, i) => (
        <group key={i} position={[b.x, b.y, b.depth]}>
          <Balloon
            silk={materials[b.silk]}
            band={materials[b.band]}
            radius={b.radius}
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
