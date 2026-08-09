import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The coastline the telescope looks along: a faceted cliff wall running from
 * the near-left of the view back to the haze, with grass on top, strata down
 * the face, surf at the foot, and gulls working the updraft above it.
 *
 * The first pass drew the coast as three squashed cones and it read as
 * exactly that. A cliff is not a lump — it is a *wall* with a lip, built here
 * the way the associations range is built: real geometry, flat-shaded, one
 * colour per facet, jittered everywhere a machine would be regular.
 */

/** Deterministic hash, so the crags land the same way on every visit. */
function rand(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The cliff top's course, near to far, with the wall height at each turn.
 * It recedes diagonally so the telescope sees the faces obliquely — a wall
 * seen dead-on is a stripe, seen along its length it is a coastline.
 */
const CLIFF_PATH: [number, number, number][] = [
  [-13, -14, 8.5],
  [-17, -30, 11],
  [-25, -48, 9.5],
  [-36, -68, 13],
  [-50, -90, 11.5],
  [-66, -112, 14],
  [-84, -134, 12],
  [-102, -154, 13.5],
  [-120, -170, 12.5],
];

/** Columns per path segment. Three puts a crag between every stated corner. */
const SUBDIV = 3;
/** How far below the waterline the face continues, so surf never shows its hem. */
const BASE_Y = -1.8;
/** How far the grass runs inland from the lip before the haze takes it. */
const CAP_DEPTH = 7.5;
/** The pale eroded edge right at the lip, before the grass starts. */
const RIM_WIDTH = 0.6;

/** Face tones, lip to waterline: sunlit rock, banded midface, wet base. */
const TONE_UPPER: [number, number, number] = [0.62, 0.58, 0.52];
const TONE_MID: [number, number, number] = [0.52, 0.48, 0.43];
const TONE_BASE: [number, number, number] = [0.3, 0.34, 0.38];
const TONE_RIM: [number, number, number] = [0.66, 0.61, 0.53];
const TONE_GRASS: [number, number, number] = [0.4, 0.5, 0.31];

interface Column {
  x: number;
  z: number;
  top: number;
  /** Unit normal pointing out to sea. */
  nx: number;
  nz: number;
}

/** The jittered columns the wall and cap are both built over. */
function buildColumns(): Column[] {
  const columns: Column[] = [];
  for (let s = 0; s < CLIFF_PATH.length - 1; s++) {
    const [ax, az, ah] = CLIFF_PATH[s];
    const [bx, bz, bh] = CLIFF_PATH[s + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    // Seaward is the +x side of a path running away to the far left.
    const nx = -dz / length;
    const nz = dx / length;

    const steps = s === CLIFF_PATH.length - 2 ? SUBDIV + 1 : SUBDIV;
    for (let c = 0; c < steps; c++) {
      const t = c / SUBDIV;
      const seed = s * 17.3 + c * 5.1;
      // Crags: the lip wanders in and out of the sea, and up and down.
      const jut = (rand(seed) - 0.5) * 2.4;
      columns.push({
        x: ax + dx * t + nx * jut,
        z: az + dz * t + nz * jut,
        top: ah + (bh - ah) * t + (rand(seed + 2) - 0.5) * 2.6,
        nx,
        nz,
      });
    }
  }
  return columns;
}

function buildCliffGeometry(): THREE.BufferGeometry {
  const columns = buildColumns();
  const positions: number[] = [];
  const colors: number[] = [];

  const push = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    tone: readonly [number, number, number],
    jitter: number
  ) => {
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let i = 0; i < 3; i++) colors.push(tone[0] * jitter, tone[1] * jitter, tone[2] * jitter);
  };

  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    tone: readonly [number, number, number],
    jitter: number
  ) => {
    push(...a, ...b, ...c, tone, jitter);
    push(...a, ...c, ...d, tone, jitter);
  };

  for (let i = 0; i < columns.length - 1; i++) {
    const p = columns[i];
    const q = columns[i + 1];

    // The face, in three strata: wet base, banded midface, sunlit upper. The
    // boundaries ride each column's own height, so the bands follow the lip
    // the way real bedding follows a coastline rather than a spirit level.
    const bands: [number, number, readonly [number, number, number]][] = [
      [0, 0.16, TONE_BASE],
      [0.16, 0.58, TONE_MID],
      [0.58, 1, TONE_UPPER],
    ];
    for (const [f0, f1, tone] of bands) {
      const jitter = 0.9 + rand(i * 3.7 + f0 * 11) * 0.2;
      const py0 = BASE_Y + (p.top - BASE_Y) * f0;
      const py1 = BASE_Y + (p.top - BASE_Y) * f1;
      const qy0 = BASE_Y + (q.top - BASE_Y) * f0;
      const qy1 = BASE_Y + (q.top - BASE_Y) * f1;
      quad(
        [p.x, py1, p.z],
        [p.x, py0, p.z],
        [q.x, qy0, q.z],
        [q.x, qy1, q.z],
        tone,
        jitter
      );
    }

    // The lip: a pale eroded rim, then grass falling gently inland.
    const rim = 0.92 + rand(i * 7.7) * 0.16;
    const grass = 0.88 + rand(i * 9.3) * 0.24;
    const pr: [number, number, number] = [p.x - p.nx * RIM_WIDTH, p.top + 0.08, p.z - p.nz * RIM_WIDTH];
    const qr: [number, number, number] = [q.x - q.nx * RIM_WIDTH, q.top + 0.08, q.z - q.nz * RIM_WIDTH];
    quad([p.x, p.top, p.z], [q.x, q.top, q.z], qr, pr, TONE_RIM, rim);

    const pg: [number, number, number] = [
      p.x - p.nx * CAP_DEPTH,
      p.top + 0.9 + rand(i * 4.9) * 0.8,
      p.z - p.nz * CAP_DEPTH,
    ];
    const qg: [number, number, number] = [
      q.x - q.nx * CAP_DEPTH,
      q.top + 0.9 + rand(i * 6.1) * 0.8,
      q.z - q.nz * CAP_DEPTH,
    ];
    quad(pr, qr, qg, pg, TONE_GRASS, grass);
  }

  // The near end of the wall is cut toward the camera; close it with a dark
  // return face so the cliff reads as solid headland rather than stage flat.
  const first = columns[0];
  quad(
    [first.x, first.top, first.z],
    [first.x, BASE_Y, first.z],
    [first.x - first.nx * CAP_DEPTH, BASE_Y, first.z - first.nz * CAP_DEPTH],
    [first.x - first.nx * CAP_DEPTH, first.top + 0.9, first.z - first.nz * CAP_DEPTH],
    TONE_MID,
    0.72
  );

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A jagged silhouette ridge for the haze line — aerial perspective in one mesh. */
function buildRidge(peaks: [number, number][], baseY = -1): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < peaks.length - 1; i++) {
    const [ax, ay] = peaks[i];
    const [bx, by] = peaks[i + 1];
    positions.push(ax, ay, 0, ax, baseY, 0, bx, by, 0);
    positions.push(bx, by, 0, ax, baseY, 0, bx, baseY, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

const NEAR_RIDGE: [number, number][] = [
  [-150, 2], [-128, 9], [-112, 5], [-96, 12], [-78, 6], [-58, 10], [-40, 4], [-24, 7], [-10, 2],
];
const FAR_RIDGE: [number, number][] = [
  [-160, 3], [-134, 7], [-110, 4], [-88, 9], [-62, 5], [-38, 8], [-16, 3], [4, 5], [20, 1],
];

/** Surf at the cliff foot: two foam lines that breathe out of phase. */
function CliffFoam({ columns }: { columns: Column[] }) {
  const mats = useMemo(
    () =>
      [0, 1].map(
        () =>
          new THREE.MeshBasicMaterial({
            color: "#f2f7f8",
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
          })
      ),
    []
  );
  const groups = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)];

  const geometries = useMemo(
    () =>
      [0.7, 1.7].map((offshore, line) => {
        const positions: number[] = [];
        const indices: number[] = [];
        const width = line === 0 ? 0.9 : 0.55;
        columns.forEach((c, i) => {
          const cx = c.x + c.nx * offshore;
          const cz = c.z + c.nz * offshore;
          positions.push(cx + c.nx * width, 0.24, cz + c.nz * width);
          positions.push(cx - c.nx * width, 0.24, cz - c.nz * width);
          if (i < columns.length - 1) {
            const a = i * 2;
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        return geometry;
      }),
    [columns]
  );
  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
    [geometries, mats]
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    groups.forEach((ref, i) => {
      if (!ref.current) return;
      const cycle = t * 0.55 + i * 2.2;
      // Waves arrive, spend themselves on the rock, and drain back.
      ref.current.position.x = Math.sin(cycle) * 0.5;
      mats[i].opacity = 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(cycle + 0.9));
    });
  });

  return (
    <>
      {geometries.map((geometry, i) => (
        <mesh key={i} ref={groups[i]} geometry={geometry} material={mats[i]} />
      ))}
    </>
  );
}

/**
 * Gulls working the cliff. Three, each on its own circle at its own rate, each
 * flapping at its own beat — birds are what say a coast is alive, and from a
 * telescope they are honestly just two beating wings.
 */
function Gulls() {
  const birds = useRef<(THREE.Group | null)[]>([]);
  const wings = useRef<(THREE.Group | null)[]>([]);

  const FLIGHTS = useMemo(
    () => [
      { cx: -30, cy: 13, cz: -58, r: 9, speed: 0.2, phase: 0, flap: 3.4 },
      { cx: -48, cy: 17, cz: -92, r: 13, speed: -0.15, phase: 2.1, flap: 2.8 },
      { cx: -22, cy: 10, cz: -40, r: 6.5, speed: 0.26, phase: 4.4, flap: 3.9 },
    ],
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    FLIGHTS.forEach((f, i) => {
      const bird = birds.current[i];
      if (!bird) return;
      const a = t * f.speed + f.phase;
      bird.position.set(
        f.cx + Math.cos(a) * f.r,
        f.cy + Math.sin(t * 0.7 + f.phase) * 0.8,
        f.cz + Math.sin(a) * f.r
      );
      // Nose along the tangent of the circle it is flying.
      bird.rotation.y = -a + (f.speed > 0 ? 0 : Math.PI);
      // Glide-and-flap: bursts of beating with stretches of holding the wind,
      // which is how a gull actually gets around a cliff. Each wing hinges its
      // own way — mirrored, so the tips beat together instead of see-sawing.
      const wing = wings.current[i];
      if (wing) {
        const beat = Math.sin(t * f.flap + f.phase);
        const gliding = Math.sin(t * 0.31 + f.phase * 1.7) > 0.15;
        const raise = gliding ? 0.06 : beat * 0.5;
        wing.children.forEach((mesh, w) => {
          const side = w === 0 ? -1 : 1;
          mesh.rotation.x = side * (0.18 - raise);
        });
      }
    });
  });

  return (
    <>
      {FLIGHTS.map((_, i) => (
        <group
          key={i}
          ref={(node) => {
            birds.current[i] = node;
          }}
        >
          {/* Body: a sliver. The read is all in the wings. */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <coneGeometry args={[0.09, 0.5, 4]} />
            <meshBasicMaterial color="#3f4854" />
          </mesh>
          <group
            ref={(node) => {
              wings.current[i] = node;
            }}
          >
            {[-1, 1].map((side) => (
              <mesh key={side} position={[0, 0, side * 0.5]} rotation={[side * 0.18, 0, 0]}>
                <boxGeometry args={[0.16, 0.03, 1.0]} />
                <meshBasicMaterial color="#3f4854" />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </>
  );
}

/** The whole coastline: wall, surf, hazed ridges behind, and the gulls. */
export function Cliffs() {
  const columns = useMemo(() => buildColumns(), []);
  const cliff = useMemo(() => buildCliffGeometry(), []);
  const nearRidge = useMemo(() => buildRidge(NEAR_RIDGE), []);
  const farRidge = useMemo(() => buildRidge(FAR_RIDGE), []);

  const cliffMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    []
  );
  // Unlit, because these are haze: distance rendered as flat colour.
  const nearRidgeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#93a9b8" }), []);
  const farRidgeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#a6b9c5" }), []);

  useEffect(
    () => () => {
      cliff.dispose();
      nearRidge.dispose();
      farRidge.dispose();
      cliffMaterial.dispose();
      nearRidgeMaterial.dispose();
      farRidgeMaterial.dispose();
    },
    [cliff, nearRidge, farRidge, cliffMaterial, nearRidgeMaterial, farRidgeMaterial]
  );

  return (
    <group>
      <mesh geometry={cliff} material={cliffMaterial} />
      <CliffFoam columns={columns} />
      <mesh geometry={nearRidge} material={nearRidgeMaterial} position={[-30, 0, -171]} />
      <mesh geometry={farRidge} material={farRidgeMaterial} position={[10, 0, -175]} />
      <Gulls />
    </group>
  );
}
