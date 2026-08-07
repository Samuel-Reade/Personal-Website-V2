import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat, seeded } from "./materials";
import { HILL_HEIGHT, HILL_RADIUS, HILL_SKIRT, groundHeight } from "./layout";

/**
 * The hilltop the balloons are staked to.
 *
 * A crown, a slope falling away from it, and a ring of conifers standing where
 * the flight boundary is — so the edge of the world is a treeline rather than an
 * invisible wall the helicopter bumps into in open air.
 */

/** Radial segments. Low enough that the crown is visibly a polygon, which is the point. */
const HILL_SEGMENTS = 14;
const TREE_COUNT = 46;
const ROCK_COUNT = 14;

/**
 * The hill, as one lathe-turned solid.
 *
 * A profile revolved rather than a cone stack: the silhouette wants a flat crown
 * easing into a slope and then flattening again into the surrounding ground, and
 * that is three changes of gradient which no single primitive has.
 */
function useHillGeometry() {
  return useMemo(() => {
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(0, HILL_HEIGHT),
      new THREE.Vector2(HILL_RADIUS * 0.55, HILL_HEIGHT),
      new THREE.Vector2(HILL_RADIUS * 0.86, HILL_HEIGHT * 0.82),
      new THREE.Vector2(HILL_RADIUS, HILL_HEIGHT * 0.52),
      new THREE.Vector2(HILL_SKIRT * 0.82, HILL_HEIGHT * 0.12),
      new THREE.Vector2(HILL_SKIRT, 0),
      // Closes the solid underneath, so the rim is never seen as a paper edge
      // from a helicopter looking down at the slope from outside it.
      new THREE.Vector2(HILL_SKIRT, -3),
      new THREE.Vector2(0, -3),
    ];
    const geometry = new THREE.LatheGeometry(profile, HILL_SEGMENTS);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
}

/** One conifer: two stacked cones on a trunk. */
function Conifer({ height, dark }: { height: number; dark: boolean }) {
  const needles = flatMat(dark ? PALETTE.pineDark : PALETTE.pine);
  return (
    <group>
      <mesh material={flatMat(PALETTE.trunk)} position={[0, height * 0.12, 0]}>
        <cylinderGeometry args={[height * 0.045, height * 0.06, height * 0.24, 5]} />
      </mesh>
      <mesh material={needles} position={[0, height * 0.46, 0]}>
        <coneGeometry args={[height * 0.27, height * 0.56, 6]} />
      </mesh>
      <mesh material={needles} position={[0, height * 0.78, 0]}>
        <coneGeometry args={[height * 0.19, height * 0.42, 6]} />
      </mesh>
    </group>
  );
}

export function Clearing() {
  const hill = useHillGeometry();

  /**
   * The treeline, on a ring just past the flight boundary.
   *
   * Placed by angle with a jittered radius rather than scattered freely: the job
   * is to close the horizon in every direction, and a free scatter leaves gaps
   * that read as a way out of a world that has none.
   */
  const trees = useMemo(() => {
    return Array.from({ length: TREE_COUNT }, (_, i) => {
      const angle = (i / TREE_COUNT) * Math.PI * 2 + (seeded(i * 3.1) - 0.5) * 0.09;
      const radius = HILL_SKIRT * 0.9 + seeded(i * 7.7) * 14;
      const height = 6 + seeded(i * 5.3) * 5.5;
      return {
        position: [
          Math.sin(angle) * radius,
          groundHeight(radius),
          Math.cos(angle) * radius,
        ] as [number, number, number],
        rotationY: seeded(i * 11.9) * Math.PI * 2,
        height,
        dark: seeded(i * 2.3) > 0.55,
      };
    });
  }, []);

  const rocks = useMemo(() => {
    return Array.from({ length: ROCK_COUNT }, (_, i) => {
      const angle = seeded(i * 13.7) * Math.PI * 2;
      // Kept off the crown's middle, which is where the helicopter spawns and
      // where the balloons are staked.
      const radius = HILL_RADIUS * (0.45 + seeded(i * 4.9) * 0.7);
      const size = 0.5 + seeded(i * 8.1) * 1.1;
      return {
        position: [
          Math.sin(angle) * radius,
          groundHeight(radius) - size * 0.25,
          Math.cos(angle) * radius,
        ] as [number, number, number],
        rotationY: seeded(i * 6.7) * Math.PI * 2,
        size,
        dark: i % 3 === 0,
      };
    });
  }, []);

  return (
    <>
      <mesh geometry={hill} material={flatMat(PALETTE.grass)} receiveShadow />

      {/* A darker crown laid just over the flat top, so the hill has a lit face
          and a shaded one from every angle rather than one even wash. */}
      <mesh
        material={flatMat(PALETTE.grassPale)}
        position={[0, HILL_HEIGHT + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[HILL_RADIUS * 0.54, HILL_SEGMENTS]} />
      </mesh>

      {/* Ground beyond the hill, reaching past the fog so the world has no rim. */}
      <mesh material={flatMat(PALETTE.grassDark)} position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[190, 24]} />
      </mesh>

      {trees.map((tree, i) => (
        <group key={i} position={tree.position} rotation={[0, tree.rotationY, 0]}>
          <Conifer height={tree.height} dark={tree.dark} />
        </group>
      ))}

      {rocks.map((rock, i) => (
        <mesh
          key={i}
          material={flatMat(rock.dark ? PALETTE.rockDark : PALETTE.rock)}
          position={rock.position}
          rotation={[seeded(i) * 0.5, rock.rotationY, seeded(i * 2) * 0.4]}
        >
          <icosahedronGeometry args={[rock.size, 0]} />
        </mesh>
      ))}
    </>
  );
}
