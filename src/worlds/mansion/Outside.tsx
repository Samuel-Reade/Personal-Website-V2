import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flatMaterial, PALETTE } from "./materials";
import { Telescope } from "./Telescope";
import { Overlook } from "./Overlook";
import {
  BALCONY_THICKNESS,
  BENCH_X,
  BENCH_Z,
  HALL_MIN_Z,
  LANDING_Y,
  OUTSIDE_FRONT_Z,
  OUTSIDE_HALF_WIDTH,
  OUTSIDE_RAIL_X,
  OUTSIDE_RAIL_Z,
} from "./layout";

/**
 * Everything past the back wall: the balcony itself, the cliff it stands on, the
 * sea below and the sky behind.
 *
 * This is the first exterior the hall has ever had. Every window in the room is
 * a flat panel drawn on the masonry — `Windows.tsx` says so plainly, that
 * nothing outside is ever seen — so until the doorway was cut there was
 * genuinely nothing out there.
 *
 * What is built *here* is now only the balcony itself and what stands on it.
 * Everything past the rail moved to `Overlook.tsx`, which draws the real
 * associations range this balcony hangs over rather than the cliff and open
 * water that used to be invented for it — see that file on why the old view
 * was a lie the telescope beside it had already stopped telling.
 */

/**
 * The balcony slab and its balustrade, cantilevered off the back of the house.
 *
 * Railed on three sides and open on the fourth, which is the doorway — the one
 * edge you are meant to cross.
 */
function Terrace() {
  const slabMaterial = useMemo(() => flatMaterial(PALETTE.balcony), []);
  const balusterMaterial = useMemo(() => flatMaterial(PALETTE.baluster), []);
  const railMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);

  const depth = HALL_MIN_Z - OUTSIDE_FRONT_Z;
  const centerZ = (HALL_MIN_Z + OUTSIDE_FRONT_Z) / 2;
  const width = OUTSIDE_HALF_WIDTH * 2;

  /** Post positions along the front edge, and down each side. */
  const frontPosts = useMemo(() => {
    const count = Math.round(width / 0.9);
    return Array.from(
      { length: count + 1 },
      (_, i) => -OUTSIDE_HALF_WIDTH + (width * i) / count
    );
  }, [width]);
  const sidePosts = useMemo(() => {
    const count = Math.round(depth / 0.9);
    return Array.from(
      { length: count },
      (_, i) => OUTSIDE_FRONT_Z + (depth * (i + 0.5)) / count
    );
  }, [depth]);

  return (
    <group>
      <mesh
        material={slabMaterial}
        position={[0, LANDING_Y - BALCONY_THICKNESS / 2, centerZ]}
        receiveShadow
      >
        <boxGeometry args={[width, BALCONY_THICKNESS, depth]} />
      </mesh>

      {/* Corbels, carrying the slab back into the cliff face. */}
      {[-0.62, 0, 0.62].map((t) => (
        <mesh
          key={t}
          material={slabMaterial}
          position={[t * OUTSIDE_HALF_WIDTH, LANDING_Y - 0.95, OUTSIDE_FRONT_Z + 0.4]}
        >
          <boxGeometry args={[0.55, 1.1, 0.55]} />
        </mesh>
      ))}

      {frontPosts.map((x) => (
        <mesh
          key={`f${x}`}
          material={balusterMaterial}
          position={[x, LANDING_Y + 0.5, OUTSIDE_RAIL_Z]}
        >
          <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
        </mesh>
      ))}
      <mesh
        material={railMaterial}
        position={[0, LANDING_Y + 1.05, OUTSIDE_RAIL_Z]}
      >
        <boxGeometry args={[width, 0.14, 0.2]} />
      </mesh>

      {([1, -1] as const).map((side) => (
        <group key={side}>
          {sidePosts.map((z) => (
            <mesh
              key={`s${side}${z}`}
              material={balusterMaterial}
              position={[side * OUTSIDE_RAIL_X, LANDING_Y + 0.5, z]}
            >
              <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
            </mesh>
          ))}
          <mesh
            material={railMaterial}
            position={[side * OUTSIDE_RAIL_X, LANDING_Y + 1.05, centerZ]}
          >
            <boxGeometry args={[0.2, 0.14, depth]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * What furnishes the terrace: a bench against the left rail, planted urns
 * flanking the doorway, and a lantern on each front corner of the rail.
 *
 * This is the balcony being a place rather than a platform. Before these it was
 * bare slab and balustrade — somewhere you stood, looked once, and left. A seat
 * and two pools of warm lanternlight are what say you were meant to stay a
 * moment, which is the mood the telescope wants around it.
 */
function Furnishings() {
  const seatMaterial = useMemo(() => flatMaterial(PALETTE.tableTop), []);
  const frameMaterial = useMemo(() => flatMaterial(PALETTE.tableBase), []);
  const urnMaterial = useMemo(() => flatMaterial(PALETTE.wainscot), []);
  const shrubMaterial = useMemo(() => flatMaterial(PALETTE.shrub), []);
  const shrubDarkMaterial = useMemo(() => flatMaterial(PALETTE.shrubDark), []);
  const lanternMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);
  const flameMaterial = useMemo(
    () => flatMaterial(PALETTE.candle, { emissive: PALETTE.candle, emissiveIntensity: 1 }),
    []
  );

  return (
    <group>
      {/* The bench, back to the rail, facing the telescope across the deck. */}
      <group position={[BENCH_X, LANDING_Y, BENCH_Z]}>
        <mesh material={seatMaterial} position={[0, 0.46, 0]}>
          <boxGeometry args={[0.52, 0.09, 1.85]} />
        </mesh>
        {([1, -1] as const).flatMap((fz) =>
          ([1, -1] as const).map((fx) => (
            <mesh
              key={`${fz}${fx}`}
              material={frameMaterial}
              position={[fx * 0.2, 0.21, fz * 0.8]}
            >
              <boxGeometry args={[0.09, 0.42, 0.09]} />
            </mesh>
          ))
        )}
        {/* Backrest: a top rail and three slats, leant a few degrees. */}
        <group position={[-0.26, 0.5, 0]} rotation={[0, 0, 0.14]}>
          <mesh material={seatMaterial} position={[0, 0.62, 0]}>
            <boxGeometry args={[0.07, 0.1, 1.85]} />
          </mesh>
          {[-0.55, 0, 0.55].map((z) => (
            <mesh key={z} material={frameMaterial} position={[0, 0.3, z]}>
              <boxGeometry args={[0.05, 0.56, 0.16]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Urns either side of the doorway, softening the masonry with the one
          green out here. */}
      {([1, -1] as const).map((side) => (
        <group key={side} position={[side * 3.5, LANDING_Y, HALL_MIN_Z - 0.6]}>
          <mesh material={urnMaterial} position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.34, 0.24, 0.52, 6]} />
          </mesh>
          <mesh material={urnMaterial} position={[0, 0.54, 0]}>
            <cylinderGeometry args={[0.4, 0.34, 0.08, 6]} />
          </mesh>
          <mesh material={shrubMaterial} position={[0, 0.86, 0]}>
            <icosahedronGeometry args={[0.36, 0]} />
          </mesh>
          <mesh material={shrubDarkMaterial} position={[side * 0.16, 0.7, 0.12]}>
            <icosahedronGeometry args={[0.24, 0]} />
          </mesh>
          <mesh material={shrubDarkMaterial} position={[-side * 0.12, 1.06, -0.06]}>
            <icosahedronGeometry args={[0.18, 0]} />
          </mesh>
        </group>
      ))}

      {/* Lanterns on the front corners of the rail: a caged flame and the pool
          of light it throws. The two of them are what keep the balcony from
          going to true black at night — every other light is indoors. */}
      {([1, -1] as const).map((side) => (
        <group
          key={side}
          position={[side * (OUTSIDE_HALF_WIDTH - 0.55), LANDING_Y + 1.12, OUTSIDE_RAIL_Z]}
        >
          <mesh material={lanternMaterial} position={[0, 0.03, 0]}>
            <boxGeometry args={[0.24, 0.06, 0.24]} />
          </mesh>
          <mesh material={flameMaterial} position={[0, 0.19, 0]}>
            <boxGeometry args={[0.13, 0.24, 0.13]} />
          </mesh>
          {/* Corner posts of the cage. */}
          {([1, -1] as const).flatMap((cx) =>
            ([1, -1] as const).map((cz) => (
              <mesh
                key={`${cx}${cz}`}
                material={lanternMaterial}
                position={[cx * 0.1, 0.19, cz * 0.1]}
              >
                <boxGeometry args={[0.03, 0.26, 0.03]} />
              </mesh>
            ))
          )}
          <mesh material={lanternMaterial} position={[0, 0.38, 0]}>
            <coneGeometry args={[0.19, 0.14, 4]} />
          </mesh>
          <pointLight position={[0, 0.2, 0]} color="#ffc98a" intensity={3.2} distance={6.5} decay={2} />
        </group>
      ))}
    </group>
  );
}

/**
 * Gulls turning slow circles out over the drop.
 *
 * Unlit and tinted by the clock, like everything else past the wall. They are
 * what make the air out there read as air — three specks moving slowly against
 * a still range — and they matter more now than they did over the old flat
 * sea, because what they circle over is a mountainside falling away a hundred
 * units under the rail, and a bird below your feet is the thing that says so.
 *
 * A sail used to cross the water with them. It has gone with the water: the
 * sea this balcony really overlooks is five hundred units out and some two
 * hundred below, where a boat is not a boat but a pixel, and the one drawn
 * here was crossing a bay that turned out not to exist.
 */
function SeaLife({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  const gullMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#dfe3e8" }), []);
  const gullBase = useMemo(() => new THREE.Color("#dfe3e8"), []);
  const lastTint = useRef(new THREE.Color());

  /** [centre x, y, z, radius, angular speed, phase] per bird. */
  const gulls = useMemo<[number, number, number, number, number, number][]>(
    () => [
      [-10, 1.5, -40, 7, 0.16, 0],
      [8, -2.5, -48, 10, -0.12, 2.1],
      [-2, -7, -58, 13, 0.09, 4.4],
    ],
    []
  );
  const gullRefs = useRef<(THREE.Group | null)[]>([]);
  const wingRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (!lastTint.current.equals(tintRef.current)) {
      lastTint.current.copy(tintRef.current);
      gullMaterial.color.copy(gullBase).multiply(tintRef.current).multiplyScalar(2.2);
    }

    gulls.forEach(([cx, cy, cz, radius, speed, phase], i) => {
      const group = gullRefs.current[i];
      if (!group) return;
      const a = t * speed + phase;
      group.position.set(cx + Math.cos(a) * radius, cy + Math.sin(t * 0.5 + phase) * 0.6, cz + Math.sin(a) * radius);
      // Tangent of the circle, so each bird flies its arc rather than sliding
      // around it sideways. The sign folds in the direction of travel.
      group.rotation.y = -a - Math.sign(speed) * (Math.PI / 2);
    });
    wingRefs.current.forEach((wings, i) => {
      if (!wings) return;
      // A slow beat with a long glide in it — gulls soar far more than they flap.
      wings.rotation.x = Math.sin(t * 2.1 + i * 1.7) * 0.32;
    });

  });

  return (
    <group>
      {gulls.map((_, i) => (
        <group key={i} ref={(el) => (gullRefs.current[i] = el)}>
          <mesh material={gullMaterial}>
            <boxGeometry args={[0.4, 0.07, 0.12]} />
          </mesh>
          {/* Both wings on one mesh, hinged at the body, beating together. */}
          <mesh material={gullMaterial} ref={(el) => (wingRefs.current[i] = el)}>
            <boxGeometry args={[0.14, 0.03, 1.0]} />
          </mesh>
        </group>
      ))}

    </group>
  );
}

/** The balcony, what furnishes it, and the range it looks out over. */
export function Outside({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  return (
    <group>
      <Terrace />
      <Furnishings />
      <Telescope />
      <Overlook tintRef={tintRef} />
      <SeaLife tintRef={tintRef} />
    </group>
  );
}
