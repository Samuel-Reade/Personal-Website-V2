import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { seeded } from "./materials";
import {
  BEACH_TOP,
  canopy,
  TERRAIN_EXTENT,
  terrainHeight,
  terrainSlope,
  TREE_LINE,
  treeLineAt,
  VEGETATION_MAX_SLOPE,
} from "./terrain";

/**
 * What lies between the trees: scrub on the green ground and boulders on the
 * grey. Both instanced, both static, both there for the same reason — from the
 * flight band a hillside of two colours reads as a painted model, and a hillside
 * with things standing on it reads as ground. The trees carry the woods; these
 * carry the clearings and the rock.
 */

/** Scrub: low dodecahedra in two greens, thickest in the open ground the stands leave. */
const SHRUB_CLUSTERS = 1400;
const SHRUBS_PER_CLUSTER = 24;
const SHRUB_SPREAD = 26;

/** Boulders: on the steep and the high ground, where the range is stone anyway. */
const BOULDER_CLUSTERS = 900;
const BOULDERS_PER_CLUSTER = 10;
const BOULDER_SPREAD = 22;
/** Above this the ground is bare enough for stone to show; below it a boulder needs a steep face. */
const BOULDER_FLOOR = 24;

interface Placement {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  dark: boolean;
}

/** One clustered scatter across the field, kept by whatever `keep` says of the ground. */
function scatter(
  clusters: number,
  perCluster: number,
  spread: number,
  salt: number,
  keep: (height: number, slope: number, x: number, z: number, roll: number) => Placement | null
): Placement[] {
  const out: Placement[] = [];
  for (let c = 0; c < clusters; c++) {
    const cx = (seeded(c * 3.7 + salt) - 0.5) * 2 * (TERRAIN_EXTENT - 40);
    const cz = (seeded(c * 9.1 + 4 + salt) - 0.5) * 2 * (TERRAIN_EXTENT - 40);
    for (let i = 0; i < perCluster; i++) {
      const angle = seeded(c * 31 + i * 2.9 + salt) * Math.PI * 2;
      const radius = Math.sqrt(seeded(c * 17 + i * 4.1 + salt)) * spread;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      const height = terrainHeight(x, z);
      if (height < BEACH_TOP + 1) continue;
      const placement = keep(height, terrainSlope(x, z, 4), x, z, seeded(c * 100 + i * 1.7 + salt));
      if (placement) out.push(placement);
    }
  }
  return out;
}

function shrubs(): Placement[] {
  return scatter(SHRUB_CLUSTERS, SHRUBS_PER_CLUSTER, SHRUB_SPREAD, 0.37, (height, slope, x, z, roll) => {
    if (height > treeLineAt(x, z) + 4 || slope > VEGETATION_MAX_SLOPE - 0.5) return null;
    // Scrub fills the open ground the trees leave, thinning under the canopy.
    if (roll > 0.85 - 0.5 * canopy(x, z)) return null;
    const size = 1.4 + seeded(x * 0.13 + z * 0.71) * 2.2;
    return {
      position: [x, height + size * 0.15, z],
      scale: [size, size * 0.7, size],
      rotation: [0, seeded(x * 0.31 + z) * Math.PI, 0],
      dark: seeded(x + z * 0.17) > 0.5,
    };
  });
}

function boulders(): Placement[] {
  return scatter(BOULDER_CLUSTERS, BOULDERS_PER_CLUSTER, BOULDER_SPREAD, 0.61, (height, slope, x, z, roll) => {
    // Stone shows where the ground is steep, or high enough to be bare — the
    // grassy valley floors get only the odd stray.
    const rocky = slope > VEGETATION_MAX_SLOPE - 1.1 || height > TREE_LINE - 12;
    if (height < BOULDER_FLOOR && !rocky) return null;
    if (!rocky && roll > 0.12) return null;
    if (roll > 0.7) return null;
    const size = 1.6 + seeded(x * 0.23 + z * 0.41) * 3.8;
    return {
      // Sunk a third in, so it sits in the slope rather than on a point of it.
      position: [x, height + size * 0.2, z],
      scale: [size, size * (0.7 + seeded(x + z) * 0.5), size],
      rotation: [seeded(x * 0.7) * 0.6, seeded(z * 0.9) * Math.PI, seeded(x + z * 0.3) * 0.6],
      dark: seeded(x * 0.9 + z * 0.13) > 0.5,
    };
  });
}

/** One instanced mesh of low-poly balls, tinted per instance in two tones. */
function Scatter({
  placements,
  light,
  dark,
  geometry,
}: {
  placements: Placement[];
  light: string;
  dark: string;
  /** Icosahedra for scrub (cheap, blobby); dodecahedra for stone (a few more facets to catch the light). */
  geometry: "icosahedron" | "dodecahedron";
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  // White, so the per-instance colour is the colour — see the note in Forest.tsx.
  const material = useMemo(() => new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true }), []);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const a = new THREE.Color(light);
    const b = new THREE.Color(dark);
    const colors = new Float32Array(placements.length * 3);
    placements.forEach((p, i) => {
      dummy.position.set(...p.position);
      dummy.rotation.set(...p.rotation);
      dummy.scale.set(...p.scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      const shade = p.dark ? b : a;
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [placements, light, dark]);

  return (
    <instancedMesh ref={mesh} args={[undefined, material, placements.length]}>
      {geometry === "icosahedron" ? <icosahedronGeometry args={[0.5, 0]} /> : <dodecahedronGeometry args={[0.5, 0]} />}
    </instancedMesh>
  );
}

export function Groundcover() {
  const scrub = useMemo(() => shrubs(), []);
  const stones = useMemo(() => boulders(), []);
  return (
    <>
      <Scatter placements={scrub} light={PALETTE.shrub} dark={PALETTE.shrubDark} geometry="icosahedron" />
      <Scatter placements={stones} light={PALETTE.boulder} dark={PALETTE.boulderDark} geometry="dodecahedron" />
    </>
  );
}
