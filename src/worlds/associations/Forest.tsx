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
 * Trees across the range, in clusters.
 *
 * Instanced in three meshes — every trunk, every conifer crown, every
 * broadleaf crown — rather than a component per tree. At twenty-odd thousand
 * trees the difference is three draw calls against sixty thousand, and the
 * scatter is static, so there is nothing an object-per-tree would buy.
 *
 * They are placed in clumps rather than sprinkled evenly, which is the whole
 * difference between a forest and a lawn with sticks in it: a uniform scatter at
 * any density reads as texture, while stands with bare ground between them read
 * as woodland. The clumps are then thinned against `canopy` — the same patches
 * that darken the ground in `terrain.ts` — so the trees stand where the ground
 * under them says they do.
 */

/**
 * Cluster count and size. Scaled up with the range going green: at 700 the
 * woodland was a scattering over a grey range, which was mostly the range being
 * grey (see VEGETATION_MAX_SLOPE in terrain.ts); with the flanks vegetated the
 * stands have to be dense enough to read as forest from the flight band, and
 * that takes roughly three times the trees.
 */
const CLUSTERS = 1900;
const PER_CLUSTER = 44;
const CLUSTER_SPREAD = 34;

/**
 * Where trees will grow: above the beach, below the treeline, and off anything
 * too steep — the treeline shared with the ground colouring, so trees never
 * stand on scree, and a slope limit a step *inside* the ground's own
 * (VEGETATION_MAX_SLOPE): the ground stays green to seventy-four degrees, but
 * a tree is a cone stood on its point, and past about sixty-nine the point is
 * in the hill and the crown hangs out over air. So the steepest green faces are
 * cliff — grassed, treeless — which is what a real crag's face is.
 */
const TREE_MAX_SLOPE = VEGETATION_MAX_SLOPE - 0.9;
/** Below this the valleys carry broadleaves among the conifers; above it the woods are all pine. */
const BROADLEAF_TOP = 42;

interface Placement {
  position: [number, number, number];
  height: number;
  rotationY: number;
  dark: boolean;
  broad: boolean;
}

function scatter(): Placement[] {
  const out: Placement[] = [];

  for (let c = 0; c < CLUSTERS; c++) {
    // Cluster centres are spread across the whole field, including out over the
    // water — those simply fail the height test below and cost nothing.
    const cx = (seeded(c * 3.7) - 0.5) * 2 * (TERRAIN_EXTENT - 40);
    const cz = (seeded(c * 9.1 + 4) - 0.5) * 2 * (TERRAIN_EXTENT - 40);
    const density = 0.45 + seeded(c * 5.3) * 0.55;

    for (let i = 0; i < PER_CLUSTER; i++) {
      if (seeded(c * 100 + i * 1.7) > density) continue;

      const angle = seeded(c * 31 + i * 2.9) * Math.PI * 2;
      const radius = Math.sqrt(seeded(c * 17 + i * 4.1)) * CLUSTER_SPREAD;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;

      const height = terrainHeight(x, z);
      if (height < BEACH_TOP + 1.5 || height > treeLineAt(x, z)) continue;
      if (terrainSlope(x, z, 6) > TREE_MAX_SLOPE) continue;
      // Thick under the canopy patches, sparse between them — never empty, so
      // the open hillsides still carry the odd tree.
      if (seeded(c * 41 + i * 6.1) > 0.4 + 0.6 * canopy(x, z)) continue;

      const broad = height < BROADLEAF_TOP && seeded(c * 53 + i * 7.3) > 0.55;
      out.push({
        position: [x, height, z],
        // Smaller with altitude, which is what real treelines do and what stops
        // the highest stands looking pasted on.
        height: (broad ? 6 + seeded(c * 13 + i) * 3.5 : 7 + seeded(c * 13 + i) * 5) * (1 - (height / TREE_LINE) * 0.35),
        rotationY: seeded(c * 7 + i * 3.3) * Math.PI * 2,
        dark: seeded(c * 23 + i * 5.9) > 0.5,
        broad,
      });
    }
  }
  return out;
}

/** Writes one colour into a per-instance buffer. */
function tint(buffer: Float32Array, index: number, color: THREE.Color): void {
  buffer[index * 3] = color.r;
  buffer[index * 3 + 1] = color.g;
  buffer[index * 3 + 2] = color.b;
}

export function Forest() {
  const trees = useMemo(() => scatter(), []);
  const pines = useMemo(() => trees.filter((tree) => !tree.broad), [trees]);
  const broadleaves = useMemo(() => trees.filter((tree) => tree.broad), [trees]);
  const trunks = useRef<THREE.InstancedMesh>(null!);
  const pineCrowns = useRef<THREE.InstancedMesh>(null!);
  const broadCrowns = useRef<THREE.InstancedMesh>(null!);

  const trunkMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: PALETTE.trunk, flatShading: true }),
    []
  );
  // White, because the crowns are coloured per instance and three multiplies
  // the two: a material already in pine green under a pine-green instance
  // colour drew every crown at pine squared, which is very nearly black — the
  // range wore a forest of dark spikes for as long as it had trees.
  const crownMat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true }), []);
  useEffect(
    () => () => {
      trunkMat.dispose();
      crownMat.dispose();
    },
    [trunkMat, crownMat]
  );

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const pine = new THREE.Color(PALETTE.pine);
    const pineDark = new THREE.Color(PALETTE.pineDark);
    const leaf = new THREE.Color(PALETTE.leaf);
    const leafDark = new THREE.Color(PALETTE.leafDark);
    const pineColors = new Float32Array(pines.length * 3);
    const leafColors = new Float32Array(broadleaves.length * 3);

    trees.forEach((tree, i) => {
      const [x, y, z] = tree.position;
      dummy.position.set(x, y + tree.height * 0.14, z);
      dummy.rotation.set(0, tree.rotationY, 0);
      dummy.scale.set(tree.height * 0.055, tree.height * 0.28, tree.height * 0.055);
      dummy.updateMatrix();
      trunks.current.setMatrixAt(i, dummy.matrix);
    });

    pines.forEach((tree, i) => {
      const [x, y, z] = tree.position;
      dummy.position.set(x, y + tree.height * 0.56, z);
      dummy.rotation.set(0, tree.rotationY, 0);
      dummy.scale.set(tree.height * 0.3, tree.height * 0.78, tree.height * 0.3);
      dummy.updateMatrix();
      pineCrowns.current.setMatrixAt(i, dummy.matrix);
      // Two tones, chosen per tree rather than per material, so a stand has
      // depth in it without a second draw call.
      tint(pineColors, i, tree.dark ? pineDark : pine);
    });

    broadleaves.forEach((tree, i) => {
      const [x, y, z] = tree.position;
      // A rounder, wider head sitting a little lower on its trunk.
      dummy.position.set(x, y + tree.height * 0.62, z);
      dummy.rotation.set(seeded(i * 1.3) * 0.5, tree.rotationY, seeded(i * 2.1) * 0.5);
      dummy.scale.set(tree.height * 0.42, tree.height * 0.4, tree.height * 0.42);
      dummy.updateMatrix();
      broadCrowns.current.setMatrixAt(i, dummy.matrix);
      tint(leafColors, i, tree.dark ? leafDark : leaf);
    });

    trunks.current.instanceMatrix.needsUpdate = true;
    pineCrowns.current.instanceMatrix.needsUpdate = true;
    broadCrowns.current.instanceMatrix.needsUpdate = true;
    pineCrowns.current.instanceColor = new THREE.InstancedBufferAttribute(pineColors, 3);
    pineCrowns.current.instanceColor.needsUpdate = true;
    broadCrowns.current.instanceColor = new THREE.InstancedBufferAttribute(leafColors, 3);
    broadCrowns.current.instanceColor.needsUpdate = true;
    trunks.current.computeBoundingSphere();
    pineCrowns.current.computeBoundingSphere();
    broadCrowns.current.computeBoundingSphere();
  }, [trees, pines, broadleaves]);

  return (
    <>
      {/* Open-ended: the foot is in the ground and the top is inside the crown,
          so the caps were twenty thousand invisible triangles. */}
      <instancedMesh ref={trunks} args={[undefined, trunkMat, trees.length]}>
        <cylinderGeometry args={[0.7, 1, 1, 5, 1, true]} />
      </instancedMesh>
      {/* Five sides, so a crown is unmistakably a faceted cone rather than a
          smooth one — the same call the rest of the site makes everywhere. */}
      <instancedMesh ref={pineCrowns} args={[undefined, crownMat, pines.length]}>
        <coneGeometry args={[1, 1, 5]} />
      </instancedMesh>
      {/* Broadleaves are a low-poly ball — twenty facets read as foliage from
          the air, where a sphere would read as a balloon, and at seven thousand
          crowns the twenty is what keeps the forest cheap. */}
      <instancedMesh ref={broadCrowns} args={[undefined, crownMat, broadleaves.length]}>
        <icosahedronGeometry args={[0.55, 0]} />
      </instancedMesh>
    </>
  );
}
