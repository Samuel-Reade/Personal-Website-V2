import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createRimToonMaterial, setFlatShading } from "../utils/toon";
import { elevationFraction, getSunState } from "../utils/time";

/**
 * How much sky the cover fills, and where it sits.
 *
 * All of this was drawn much smaller and much further up before, which is why
 * the sky read as empty even though the clouds were mounted the whole time:
 * fourteen clusters of nine-unit puffs, scattered as high as eighty units and as
 * far out as a hundred and ninety, are a handful of pale smudges near the top of
 * frame that a bright sky swallows whole. Brought down and out, they cross the
 * part of the sky the camera actually looks at.
 */
const CLUSTER_COUNT = 24;
const DRIFT_RANGE = 260;
/**
 * The nearest and lowest a bank may sit came up a little with the change to
 * geometry: a soft sprite passing thirty units overhead was a smudge, a
 * faceted lump that close is a boulder. From here the closest bank is still
 * plainly a cloud.
 */
const MIN_DIST = 56;
const DIST_SPREAD = 110;
const MIN_HEIGHT = 36;
const HEIGHT_SPREAD = 28;
/** Radius of a puff, before it is squashed and pulled about. */
const MIN_PUFF = 6.5;
const PUFF_SPREAD = 6.5;

/**
 * The shape of a puff.
 *
 * These were soft radial-gradient sprites: fine as haze, but next to a field
 * of hard-edged blades and a hall of flat facets they were the one thing on
 * screen with no surface. A cloud here is now built the way the grass is —
 * as geometry whose facets are the drawing. Each puff is an icosahedron pulled
 * about by low-frequency noise so no two lumps match, squashed to two thirds
 * of its height, and cut off flat a way below its centre, which is what makes
 * a lump read as cumulus rather than as a boulder in the sky. Flat-shaded, so
 * every facet takes one tone from the toon ramp: white tops, grey undersides,
 * a warm rim where the sun catches an edge.
 */
/** Subdivisions of the icosahedron: 2 gives 320 facets — fine enough to read as texture, coarse enough to stay facets. */
const PUFF_DETAIL = 2;
/** How far the noise pushes the surface in and out, as a fraction of the radius. */
const LUMP = 0.22;
/** Height as a fraction of width. */
const SQUASH = 0.62;
/** Where the flat base is cut, as a fraction of the radius below the centre. */
const BASE = 0.3;

/**
 * Deterministic 3D value noise, so a puff's lumps are decided by where its
 * vertices are rather than redrawn each mount. Same construction as the hair's.
 */
function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c00 = lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), ux);
  const c10 = lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), ux);
  const c01 = lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), ux);
  const c11 = lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), ux);
  return lerp(lerp(c00, c10, uy), lerp(c01, c11, uy), uz);
}

function buildPuff(radius: number, seed: number, offset: [number, number, number]): THREE.BufferGeometry {
  // PolyhedronGeometry is non-indexed already: every facet owns its vertices,
  // which is exactly what flat shading wants.
  const geometry = new THREE.IcosahedronGeometry(radius, PUFF_DETAIL);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    // Two octaves: broad lobes, and a finer ripple across them.
    const s = 1.4 / radius;
    const n =
      (noise3(v.x * s + seed, v.y * s + seed * 1.7, v.z * s - seed) - 0.5) * 2 +
      (noise3(v.x * s * 2.6 - seed, v.y * s * 2.6 + seed, v.z * s * 2.6 + seed * 0.4) - 0.5) * 0.7;
    v.multiplyScalar(1 + LUMP * n);
    v.y *= SQUASH;
    // The flat base, with a little of the noise left in it so it isn't a plane.
    const floor = -BASE * radius * SQUASH;
    if (v.y < floor) v.y = floor + (v.y - floor) * 0.12;
    position.setXYZ(i, v.x + offset[0], v.y + offset[1], v.z + offset[2]);
  }
  position.needsUpdate = true;
  return geometry;
}

interface Cluster {
  basePos: [number, number, number];
  geometry: THREE.BufferGeometry;
  driftSpeed: number;
  driftPhase: number;
}

function buildClusters(): Cluster[] {
  const clusters: Cluster[] = [];
  for (let i = 0; i < CLUSTER_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = MIN_DIST + Math.random() * DIST_SPREAD;
    const height = MIN_HEIGHT + Math.random() * HEIGHT_SPREAD;
    const puffCount = 4 + Math.floor(Math.random() * 3);
    const puffs: THREE.BufferGeometry[] = [];
    for (let p = 0; p < puffCount; p++) {
      const radius = MIN_PUFF + Math.random() * PUFF_SPREAD;
      // Spread so the lumps overlap into one bank rather than sitting apart
      // or collapsing into a single ball; the biggest lumps ride highest, the
      // way a cumulus tower builds.
      puffs.push(
        buildPuff(radius, i * 7.3 + p * 1.9, [
          (Math.random() - 0.5) * 30,
          (Math.random() - 0.5) * 4 + (radius - MIN_PUFF) * 0.4,
          (Math.random() - 0.5) * 14,
        ])
      );
    }
    const geometry = mergeGeometries(puffs, false)!;
    puffs.forEach((g) => g.dispose());
    clusters.push({
      basePos: [Math.sin(angle) * dist, height, Math.cos(angle) * dist],
      geometry,
      driftSpeed: 0.4 + Math.random() * 0.6,
      driftPhase: i * 37,
    });
  }
  return clusters;
}

/**
 * Cloud colour through the day. Hoisted out of the frame loop: these are four
 * fixed colours and a scratch to mix them into, and rebuilding all five every
 * frame in two mounted scenes is exactly the steady garbage `celestial.ts` calls
 * out for the body vectors.
 */
const DAY_TINT = new THREE.Color("#ffffff");
const EVENING_TINT = new THREE.Color("#f2c9a0");
/**
 * Darker than the sprites' #3c4560: that was the whole colour of an unlit
 * puff, and this is a base the moon still lights, so the lit facets land
 * about where the old flat blue did.
 */
const NIGHT_TINT = new THREE.Color("#2b3249");
const scratchTint = new THREE.Color();

/**
 * Faceted cloud banks drifting slowly overhead, lit by the same sun and moon
 * as the field and tinted by time of day.
 */
export function Clouds() {
  const clusters = useMemo(() => buildClusters(), []);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  /**
   * One toon material for every bank, the field's own ramp and rim on it:
   * under the daytime sun the ramp lands as white tops and grey undersides,
   * and the rim warms the edges the sun catches. A little emissive lifts the
   * shadow band — a cloud's underside is grey, not the near-black the ramp's
   * lowest step would make of it. Unfogged, as the sprites were: the far banks
   * stand past FOG_FAR and would otherwise dissolve to horizon colour.
   */
  const material = useMemo(() => {
    // The rim is kept near-neutral and gentle: it is on at night too, when a
    // warm sunlit edge would be wrong on a moonlit cloud.
    const m = createRimToonMaterial("#ffffff", { strength: 0.22, power: 3.5, color: "#fff2dc" });
    setFlatShading(m);
    m.fog = false;
    m.emissive = new THREE.Color("#ffffff");
    m.emissiveIntensity = 0.12;
    return m;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const sun = getSunState();
    const height = elevationFraction(sun.elevation);
    const dayStrength = THREE.MathUtils.clamp(height + 0.15, 0, 1);
    const eveningStrength = THREE.MathUtils.clamp(1 - Math.abs(height) * 2.2, 0, 1);

    const tint = scratchTint
      .copy(NIGHT_TINT)
      .lerp(DAY_TINT, dayStrength)
      .lerp(EVENING_TINT, eveningStrength * 0.5);
    material.color.copy(tint);
    // The lift follows the tint, so a night cloud glows blue-grey rather than
    // carrying a daylight white in its shadows.
    material.emissive.copy(tint);

    clusters.forEach((cluster, i) => {
      const group = groupRefs.current[i];
      if (group) {
        const x = cluster.basePos[0] + (((t * cluster.driftSpeed * 3 + cluster.driftPhase) % DRIFT_RANGE) - DRIFT_RANGE / 2);
        group.position.set(x, cluster.basePos[1], cluster.basePos[2]);
      }
    });
  });

  return (
    <>
      {clusters.map((cluster, i) => (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)} position={cluster.basePos}>
          <mesh geometry={cluster.geometry} material={material} />
        </group>
      ))}
    </>
  );
}
