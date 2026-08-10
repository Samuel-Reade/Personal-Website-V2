import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { COAST_X, SEA_LEVEL, TERRAIN_EXTENT, downhill, terrainHeight } from "./terrain";

/**
 * Everything wet: the sea off the east coast, the streams coming down off the
 * range, and the fall where one of them goes over a cliff.
 */

/** How far a stream steps between samples, and how many steps before it gives up.
    Five rather than seven: the coastal courses run barely fifty units from
    spring to sea, and at seven a river could reach the water in too few points
    to clear the keep-it threshold below — discarded for succeeding quickly. */
const STREAM_STEP = 5;
const STREAM_MAX_STEPS = 120;
/** Half-width of a stream ribbon, and how far it floats above the ground so it never z-fights. */
const STREAM_HALF_WIDTH = 2.6;
const STREAM_LIFT = 0.6;

/**
 * Where each stream is born. Four high on the interior range, whose courses end
 * in the basins between the peaks — a stream with no outlet pools, and the
 * interior of this range genuinely has no outlet. And two on the eastern flanks
 * of the coastal peaks, started already on the seaward slope, whose whole
 * descent runs down the shore fade and into the sea: the coast needs rivers
 * actually reaching it, or the water and the land read as two unrelated maps.
 */
const SPRINGS: [number, number][] = [
  // The interior springs sit just off their peaks' summits, so they moved when
  // the inner scenery ring slid outward with the wider flight boundary — a
  // spring left behind would now rise from a valley floor and pool at once.
  [-150, -138],
  [-209, -22],
  [53, -179],
  [-65, 177],
  [104, -78],
  [104, 62],
];

interface Course {
  /** Centre-line points, already lifted clear of the ground. */
  points: THREE.Vector3[];
  /** The steepest single drop along it, and where — this is where a fall belongs. */
  dropIndex: number;
  drop: number;
}

/**
 * Traces one stream by walking downhill.
 *
 * Steepest descent rather than a drawn path: it is the only way a ribbon laid on
 * a procedural surface is guaranteed to follow it, and it means the streams
 * rearrange themselves for free if the range is ever retuned. The walk stops at
 * the sea, at the edge of the world, or when the ground stops falling — which is
 * a basin, and a real stream would pool there too.
 */
function traceCourse(startX: number, startZ: number): Course | null {
  const points: THREE.Vector3[] = [];
  let x = startX;
  let z = startZ;
  let previous = terrainHeight(x, z);
  let dropIndex = 0;
  let drop = 0;
  /**
   * The direction of travel, carried between steps.
   *
   * Pure steepest descent was tried first and every one of the six streams ran
   * the full step budget without reaching the sea: on a surface made of smooth
   * peaks the gradient curls around a flank, so the course spirals a contour
   * instead of coming down it. Water has momentum, and giving the walk some too
   * is both the physical answer and the one that gets it to the coast.
   */
  let dirX = 0;
  let dirZ = 0;
  /** Height when the current pool began, for spotting one it cannot get out of. */
  let stalledFrom = previous;
  let stalledFor = 0;

  for (let i = 0; i < STREAM_MAX_STEPS; i++) {
    const height = terrainHeight(x, z);
    if (height <= SEA_LEVEL + 0.6) break;
    if (Math.abs(x) > TERRAIN_EXTENT - 20 || Math.abs(z) > TERRAIN_EXTENT - 20) break;

    points.push(new THREE.Vector3(x, height + STREAM_LIFT, z));

    const fall = previous - height;
    if (i > 0 && fall > drop) {
      drop = fall;
      dropIndex = points.length - 1;
    }
    previous = height;

    // Twelve steps without losing three units of height is a basin, and a real
    // stream would pool there rather than keep going.
    if (stalledFrom - height > 3) {
      stalledFrom = height;
      stalledFor = 0;
    } else if (++stalledFor > 12) {
      break;
    }

    const [gx, gz] = downhill(x, z);
    if (gx === 0 && gz === 0) break;
    dirX = dirX * 0.55 + gx * 0.45;
    dirZ = dirZ * 0.55 + gz * 0.45;
    const length = Math.hypot(dirX, dirZ) || 1;
    x += (dirX / length) * STREAM_STEP;
    z += (dirZ / length) * STREAM_STEP;
  }

  return points.length > 6 ? { points, dropIndex, drop } : null;
}

/**
 * Skins a centre-line into a flat ribbon.
 *
 * Widened as it descends, because a stream gathers water on the way down and a
 * constant-width one reads as a painted line. The ribbon is built from the
 * horizontal normal at each point, so it lies across the slope rather than
 * banking with it.
 */
function buildRibbon(points: THREE.Vector3[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[Math.min(i + 1, points.length - 1)];
    const previous = points[Math.max(i - 1, 0)];
    const dirX = next.x - previous.x;
    const dirZ = next.z - previous.z;
    const length = Math.hypot(dirX, dirZ) || 1;
    // Perpendicular in the ground plane.
    const nx = -dirZ / length;
    const nz = dirX / length;
    const width = STREAM_HALF_WIDTH * (0.45 + 0.55 * (i / (points.length - 1)));

    positions.push(current.x + nx * width, current.y, current.z + nz * width);
    positions.push(current.x - nx * width, current.y, current.z - nz * width);

    if (i < points.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The fall: a curtain hung at the steepest step of a course, with slabs of foam
 * sliding down it.
 *
 * No texture and no particle system — the motion is three flat quads that
 * descend on a loop and reset at the lip, which is enough to read as falling
 * water at the distance this is seen from and costs three matrix updates a
 * frame. The curtain itself is still, as a sheet of falling water very nearly is.
 */
function Waterfall({ at, height }: { at: THREE.Vector3; height: number }) {
  const foam = useRef<THREE.Group>(null!);
  const slabs = useMemo(() => [0, 0.33, 0.66], []);

  useFrame((state) => {
    if (!foam.current) return;
    const t = state.clock.elapsedTime;
    foam.current.children.forEach((slab, i) => {
      // Each slab runs the same loop, offset — so one is always near the lip.
      const progress = (t * 0.45 + slabs[i]) % 1;
      slab.position.y = -progress * height;
      // Fades out toward the plunge pool rather than vanishing at a hard edge.
      const material = (slab as THREE.Mesh).material as THREE.MeshLambertMaterial;
      material.opacity = 0.75 * (1 - progress * 0.7);
    });
  });

  const foamMats = useMemo(
    () =>
      slabs.map(
        () =>
          new THREE.MeshLambertMaterial({
            color: PALETTE.foam,
            flatShading: true,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
          })
      ),
    [slabs]
  );
  useEffect(() => () => foamMats.forEach((m) => m.dispose()), [foamMats]);

  return (
    <group position={[at.x, at.y, at.z]}>
      {/* The sheet. Double-sided, because from the air it is seen from both the
          upstream and the downstream side as the helicopter circles. */}
      <mesh position={[0, -height / 2, 0]}>
        <planeGeometry args={[STREAM_HALF_WIDTH * 2.1, height]} />
        <meshLambertMaterial color={PALETTE.waterfall} flatShading side={THREE.DoubleSide} />
      </mesh>
      <group ref={foam}>
        {slabs.map((_, i) => (
          <mesh key={i} material={foamMats[i]} position={[0, 0, 0.35]}>
            <planeGeometry args={[STREAM_HALF_WIDTH * 2.6, height * 0.16]} />
          </mesh>
        ))}
      </group>
      {/* Plunge pool, so the fall lands on something. */}
      <mesh position={[0, -height, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[STREAM_HALF_WIDTH * 2.2, 10]} />
        <meshLambertMaterial color={PALETTE.foam} flatShading transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export function Streams() {
  const courses = useMemo(
    () => SPRINGS.map(([x, z]) => traceCourse(x, z)).filter((c): c is Course => c !== null),
    []
  );
  const ribbons = useMemo(() => courses.map((c) => buildRibbon(c.points)), [courses]);
  useEffect(() => () => ribbons.forEach((r) => r.dispose()), [ribbons]);

  /**
   * Only the steepest few courses get a fall, and only where the drop is worth
   * one. Hanging a curtain on every stream would put six of them on a range
   * where one is a landmark.
   */
  const falls = useMemo(
    () =>
      courses
        .map((course, i) => ({ course, i }))
        .filter(({ course }) => course.drop > 9)
        .sort((a, b) => b.course.drop - a.course.drop)
        .slice(0, 2),
    [courses]
  );

  return (
    <>
      {ribbons.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={flatMat(PALETTE.stream)} />
      ))}
      {falls.map(({ course, i }) => (
        <Waterfall
          key={i}
          at={course.points[course.dropIndex]}
          height={Math.max(10, course.drop * 1.6)}
        />
      ))}
    </>
  );
}

/**
 * The shoreline, traced off the terrain itself.
 *
 * For each z, bisect across the shore band for where the ground crosses just
 * above sea level. The coast meanders now, so nothing short of asking the
 * terrain can know where the waterline actually runs — and having asked, the
 * foam follows every bay and headland for free.
 */
function traceShoreline(offshore = 0): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let z = -TERRAIN_EXTENT + 30; z <= TERRAIN_EXTENT - 30; z += 12) {
    let lo = COAST_X - 96;
    let hi = COAST_X + 96;
    if (terrainHeight(lo, z) <= 0.3 || terrainHeight(hi, z) >= 0.3) continue;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (terrainHeight(mid, z) > 0.3) lo = mid;
      else hi = mid;
    }
    // +0.34 clears the swell's highest rise, so the foam never dips under.
    points.push(new THREE.Vector3((lo + hi) / 2 + offshore, SEA_LEVEL + 0.34, z));
  }
  return points;
}

/** A constant-width ribbon along a line of points — the foam's geometry. */
function buildFoamRibbon(points: THREE.Vector3[], halfWidth: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[Math.min(i + 1, points.length - 1)];
    const previous = points[Math.max(i - 1, 0)];
    const dirX = next.x - previous.x;
    const dirZ = next.z - previous.z;
    const length = Math.hypot(dirX, dirZ) || 1;
    const nx = -dirZ / length;
    const nz = dirX / length;
    positions.push(current.x + nx * halfWidth, current.y, current.z + nz * halfWidth);
    positions.push(current.x - nx * halfWidth, current.y, current.z - nz * halfWidth);
    if (i < points.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The sea east of the coast.
 *
 * A plane at sea level with a slow swell rolling through it, driven by moving
 * the whole plane a few centimetres rather than by displacing vertices: from the
 * altitude this is seen at, a per-vertex swell is invisible and a gentle rise
 * and fall of the whole surface against a fixed shoreline is what actually reads
 * as water. Because the beach slopes, that rise and fall also walks the
 * waterline up and down the sand — the tide, at 1/100th scale.
 *
 * Two lines of foam ride the shoreline, breathing in and out of phase — the one
 * detail that reads as *surf* from any altitude. Unlit white on purpose: foam is
 * brighter than any lit surface around it.
 */
export function Ocean() {
  const surface = useRef<THREE.Mesh>(null!);
  const foamRefs = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)];

  const foamLines = useMemo(
    () => [
      { geometry: buildFoamRibbon(traceShoreline(0), 1.6), phase: 0 },
      { geometry: buildFoamRibbon(traceShoreline(3.6), 1.1), phase: 2.4 },
    ],
    []
  );
  const foamMats = useMemo(
    () =>
      foamLines.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: PALETTE.foam,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
          })
      ),
    [foamLines]
  );
  useEffect(
    () => () => {
      foamLines.forEach((f) => f.geometry.dispose());
      foamMats.forEach((m) => m.dispose());
    },
    [foamLines, foamMats]
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (surface.current) surface.current.position.y = SEA_LEVEL + Math.sin(t * 0.35) * 0.22;
    // The foam creeps shoreward and fades as the swell falls back — a wave
    // arriving, spending itself on the sand, and draining away.
    foamLines.forEach((line, i) => {
      const mesh = foamRefs[i].current;
      if (!mesh) return;
      const cycle = t * 0.5 + line.phase;
      mesh.position.x = Math.sin(cycle) * 1.3;
      foamMats[i].opacity = 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(cycle + 1.1));
    });
  });

  return (
    <>
      <mesh
        ref={surface}
        position={[COAST_X + TERRAIN_EXTENT * 0.75, SEA_LEVEL, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {/* Reaches all the way to the fogged horizon in every direction, so the
            sea's own edge can never show — past FOG_FAR it is pure fog colour,
            and it ends inside the camera's far plane. */}
        <planeGeometry args={[24000, 24000]} />
        <meshLambertMaterial color={PALETTE.sea} flatShading transparent opacity={0.92} />
      </mesh>
      {foamLines.map((line, i) => (
        <mesh key={i} ref={foamRefs[i]} geometry={line.geometry} material={foamMats[i]} />
      ))}
    </>
  );
}
