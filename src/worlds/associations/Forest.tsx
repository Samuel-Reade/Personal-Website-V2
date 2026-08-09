import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { seeded } from "./materials";
import { BEACH_TOP, TERRAIN_EXTENT, terrainHeight, terrainSlope } from "./terrain";

/**
 * Trees across the range, in clusters.
 *
 * Instanced in two meshes — one for every trunk, one for every crown — rather
 * than a component per tree. At three thousand trees the difference is two draw
 * calls against six thousand, and the scatter is static, so there is nothing an
 * object-per-tree would buy.
 *
 * They are placed in clumps rather than sprinkled evenly, which is the whole
 * difference between a forest and a lawn with sticks in it: a uniform scatter at
 * any density reads as texture, while a few dozen stands with bare ground
 * between them reads as woodland.
 */

const CLUSTERS = 120;
const PER_CLUSTER = 26;
const CLUSTER_SPREAD = 26;

/**
 * Where trees will grow.
 *
 * Above the beach, below the treeline, and off anything too steep to hold soil —
 * the same slope test the terrain colouring uses to decide where bare rock
 * shows, so trees never appear growing out of a cliff face.
 */
const TREE_LINE = 74;
const MAX_SLOPE = 0.5;

interface Placement {
  position: [number, number, number];
  height: number;
  rotationY: number;
  dark: boolean;
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
      if (height < BEACH_TOP + 1.5 || height > TREE_LINE) continue;
      if (terrainSlope(x, z, 6) > MAX_SLOPE) continue;

      out.push({
        position: [x, height, z],
        // Smaller with altitude, which is what real treelines do and what stops
        // the highest stands looking pasted on.
        height: (7 + seeded(c * 13 + i) * 5) * (1 - (height / TREE_LINE) * 0.35),
        rotationY: seeded(c * 7 + i * 3.3) * Math.PI * 2,
        dark: seeded(c * 23 + i * 5.9) > 0.5,
      });
    }
  }
  return out;
}

export function Forest() {
  const trees = useMemo(() => scatter(), []);
  const trunks = useRef<THREE.InstancedMesh>(null!);
  const crowns = useRef<THREE.InstancedMesh>(null!);

  const trunkMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: PALETTE.trunk, flatShading: true }),
    []
  );
  const crownMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: PALETTE.pine, flatShading: true }),
    []
  );
  useEffect(
    () => () => {
      trunkMat.dispose();
      crownMat.dispose();
    },
    [trunkMat, crownMat]
  );

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const light = new THREE.Color(PALETTE.pine);
    const dark = new THREE.Color(PALETTE.pineDark);
    const crownColors = new Float32Array(trees.length * 3);

    trees.forEach((tree, i) => {
      const [x, y, z] = tree.position;

      dummy.position.set(x, y + tree.height * 0.14, z);
      dummy.rotation.set(0, tree.rotationY, 0);
      dummy.scale.set(tree.height * 0.055, tree.height * 0.28, tree.height * 0.055);
      dummy.updateMatrix();
      trunks.current.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, y + tree.height * 0.56, z);
      dummy.scale.set(tree.height * 0.3, tree.height * 0.78, tree.height * 0.3);
      dummy.updateMatrix();
      crowns.current.setMatrixAt(i, dummy.matrix);

      // Two tones, chosen per tree rather than per material, so a stand has
      // depth in it without a second draw call.
      const shade = tree.dark ? dark : light;
      crownColors[i * 3] = shade.r;
      crownColors[i * 3 + 1] = shade.g;
      crownColors[i * 3 + 2] = shade.b;
    });

    trunks.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceColor = new THREE.InstancedBufferAttribute(crownColors, 3);
    crowns.current.instanceColor.needsUpdate = true;
    trunks.current.computeBoundingSphere();
    crowns.current.computeBoundingSphere();
  }, [trees]);

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, trunkMat, trees.length]}>
        <cylinderGeometry args={[0.7, 1, 1, 5]} />
      </instancedMesh>
      {/* Five sides, so a crown is unmistakably a faceted cone rather than a
          smooth one — the same call the rest of the site makes everywhere. */}
      <instancedMesh ref={crowns} args={[undefined, crownMat, trees.length]}>
        <coneGeometry args={[1, 1, 5]} />
      </instancedMesh>
    </>
  );
}
