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

/** How far a stream steps between samples, and how many steps before it gives up. */
const STREAM_STEP = 7;
const STREAM_MAX_STEPS = 90;
/** Half-width of a stream ribbon, and how far it floats above the ground so it never z-fights. */
const STREAM_HALF_WIDTH = 2.6;
const STREAM_LIFT = 0.6;

/** Where each stream is born. High on the range, away from the flight arena. */
const SPRINGS: [number, number][] = [
  [-92, -84],
  [-30, -126],
  [-142, -14],
  [-114, 70],
  [42, -142],
  [-44, 122],
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
 * The sea east of the coast.
 *
 * A plane at sea level with a slow swell rolling through it, driven by moving
 * the whole plane a few centimetres rather than by displacing vertices: from the
 * altitude this is seen at, a per-vertex swell is invisible and a gentle rise
 * and fall of the whole surface against a fixed shoreline is what actually reads
 * as water.
 */
export function Ocean() {
  const surface = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!surface.current) return;
    const t = state.clock.elapsedTime;
    surface.current.position.y = SEA_LEVEL + Math.sin(t * 0.35) * 0.22;
  });

  return (
    <mesh
      ref={surface}
      position={[COAST_X + TERRAIN_EXTENT * 0.75, SEA_LEVEL, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      {/* Reaches far past the land in every direction, so the horizon is water
          rather than the plane's own edge. */}
      <planeGeometry args={[TERRAIN_EXTENT * 3, TERRAIN_EXTENT * 4]} />
      <meshLambertMaterial color={PALETTE.sea} flatShading transparent opacity={0.9} />
    </mesh>
  );
}
