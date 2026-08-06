import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../palette";
import { flatMat, flatMatUnique, seeded } from "../materials";

/**
 * Rolled-formed aluminum durability: a works with two smoking stacks, a ridge of
 * mountains behind it, and an airstrip with a freighter parked on it.
 *
 * The island is laid out along its local X — mountains at the back (-Z), the
 * works to one side, the runway running the full length of the plateau — so that
 * approaching from the sea shows all three at once rather than one hiding the
 * others.
 */

const PUFFS_PER_STACK = 6;
const PUFF_RISE = 4.2;
const PUFF_LIFETIME = 4.6;

/** Stack positions as [x, height, z], in the works' local space. */
const STACKS: [number, number, number][] = [
  [-0.72, 2.6, -0.5],
  [0.14, 2.1, -0.55],
];

interface Puff {
  age: number;
  stack: number;
  drift: number;
  spin: number;
}

/**
 * A fixed pool of puffs cycled on a phase offset rather than spawned and
 * destroyed: the stream is continuous and never reacts to anything, so
 * allocating for it would be pure churn.
 */
function Smoke() {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  const puffs = useMemo<Puff[]>(() => {
    const out: Puff[] = [];
    for (let s = 0; s < STACKS.length; s++) {
      for (let i = 0; i < PUFFS_PER_STACK; i++) {
        out.push({
          // Evenly spread through the cycle so the stream is continuous from the
          // first frame rather than puffing all at once.
          age: (i / PUFFS_PER_STACK) * PUFF_LIFETIME,
          stack: s,
          drift: (seeded(s * 31 + i * 7) - 0.5) * 1.8,
          spin: seeded(s * 53 + i * 11) * Math.PI,
        });
      }
    }
    return out;
  }, []);

  const materials = useMemo(
    () => puffs.map(() => flatMatUnique(PALETTE.smoke, { transparent: true, opacity: 0 })),
    [puffs]
  );
  useEffect(() => {
    return () => {
      for (const material of materials) material.dispose();
    };
  }, [materials]);

  useFrame((_state, delta) => {
    for (let i = 0; i < puffs.length; i++) {
      const puff = puffs[i];
      const mesh = meshes.current[i];
      if (!mesh) continue;

      puff.age = (puff.age + delta) % PUFF_LIFETIME;
      const t = puff.age / PUFF_LIFETIME;
      const [sx, sy, sz] = STACKS[puff.stack];

      mesh.position.set(sx + puff.drift * t, sy + 0.25 + t * PUFF_RISE, sz + puff.drift * 0.4 * t);
      mesh.scale.setScalar(0.24 + t * 0.62);
      mesh.rotation.y = puff.spin + t * 0.9;
      // Fades in off the stack lip and out at the top, so neither end pops.
      materials[i].opacity = Math.min(t * 6, 1) * (1 - t) * 0.72;
    }
  });

  return (
    <>
      {puffs.map((_, i) => (
        <mesh key={i} ref={(el) => (meshes.current[i] = el)} material={materials[i]}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </>
  );
}

function Works() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.factoryWall)} position={[0, 0.75, 0]}>
        <boxGeometry args={[2.5, 1.5, 1.7]} />
      </mesh>
      <mesh material={flatMat(PALETTE.factoryRoof)} position={[0, 1.55, 0]}>
        <boxGeometry args={[2.62, 0.12, 1.82]} />
      </mesh>
      <mesh material={flatMat(PALETTE.factoryWall)} position={[1.72, 0.45, 0.2]}>
        <boxGeometry args={[1.0, 0.9, 1.2]} />
      </mesh>
      <mesh material={flatMat(PALETTE.factoryRoof)} position={[1.72, 0.95, 0.2]}>
        <boxGeometry args={[1.1, 0.1, 1.3]} />
      </mesh>

      {[-0.8, 0, 0.8].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.factoryWindow)} position={[x, 0.85, 0.86]}>
          <boxGeometry args={[0.5, 0.42, 0.04]} />
        </mesh>
      ))}

      {STACKS.map(([x, y, z], i) => (
        <group key={i}>
          <mesh material={flatMat(PALETTE.stack)} position={[x, y / 2, z]}>
            <cylinderGeometry args={[0.17, 0.21, y, 7]} />
          </mesh>
          <mesh material={flatMat(PALETTE.stackBand)} position={[x, y - 0.22, z]}>
            <cylinderGeometry args={[0.19, 0.19, 0.14, 7]} />
          </mesh>
        </group>
      ))}

      <Smoke />
    </group>
  );
}

interface PeakSpec {
  x: number;
  z: number;
  radius: number;
  height: number;
  /** Snow only above a certain size — a small hill with a white cap reads as a mistake. */
  snow: boolean;
}

/**
 * The whole island's layout in one place, so the pieces can be checked against
 * the ground they stand on rather than eyeballed. Everything here is sized for
 * this island's plateau radius (14 * 0.66 ≈ 9.2) — see the verification note on
 * FACTORY_EXTENT below.
 *
 * The range sits across the back (-Z), the works to port (-X) and the airstrip
 * to starboard (+X), so approaching from the sea shows all three at once and
 * none of them overlaps another.
 */
const PEAKS: PeakSpec[] = [
  { x: -1.6, z: -5.8, radius: 2.7, height: 6.2, snow: true },
  { x: -4.2, z: -5.0, radius: 2.3, height: 5.0, snow: true },
  { x: -6.0, z: -3.4, radius: 1.9, height: 3.4, snow: false },
  { x: 0.0, z: -6.6, radius: 1.9, height: 3.8, snow: false },
];

const WORKS = { x: -5.0, z: 1.2 };
const RUNWAY = { x: 3.6, z: 0.6, length: 11.5, width: 2.2 };
/** Where the aircraft parks, and how much room it takes once its wings are out. */
const PLANE = { x: RUNWAY.x, z: 1.0, halfSpan: 3.2, halfLength: 2.9 };

/**
 * Farthest any part of the scene reaches from the island's centre. Checked
 * against the plateau radius in the verification pass — the runway in
 * particular is long enough that a careless offset hangs its end out over the
 * slope and into the sea.
 */
export const FACTORY_EXTENT = Math.max(
  // Mountains. Their bases are circles, so the farthest point is the centre
  // distance plus the radius — not the bounding box's corner, which would
  // overstate a cone's reach by up to 40%.
  ...PEAKS.map((p) => Math.hypot(p.x, p.z) + p.radius),
  // Runway corners.
  Math.hypot(RUNWAY.x + RUNWAY.width / 2 + 0.25, RUNWAY.z + RUNWAY.length / 2),
  Math.hypot(RUNWAY.x + RUNWAY.width / 2 + 0.25, Math.abs(RUNWAY.z - RUNWAY.length / 2)),
  // Wing tips.
  Math.hypot(PLANE.x + PLANE.halfSpan, PLANE.z + PLANE.halfLength),
  // The works, with its annex reaching +1.72 in local X.
  Math.hypot(Math.abs(WORKS.x) + 1.3, Math.abs(WORKS.z) + 1.1)
);

/**
 * The ridge behind the works. Cones with a low segment count read as mountains
 * at this scale, and overlapping them into a range hides the fact that each is
 * a single primitive — a row of separate cones would read as traffic cones.
 */
function Mountains() {
  return (
    <group>
      {PEAKS.map((peak, i) => (
        <group key={i} position={[peak.x, 0, peak.z]} rotation={[0, seeded(i * 17.3) * Math.PI, 0]}>
          <mesh material={flatMat(i % 2 === 0 ? PALETTE.mountain : PALETTE.mountainDark)} position={[0, peak.height / 2, 0]}>
            <coneGeometry args={[peak.radius, peak.height, 6]} />
          </mesh>
          {peak.snow && (
            // A second, shorter cone sharing the apex. Its base sits where the
            // snow line should be, so the white band follows the slope exactly
            // instead of floating as a separate hat.
            <mesh material={flatMat(PALETTE.mountainSnow)} position={[0, peak.height * 0.78, 0]}>
              <coneGeometry args={[peak.radius * 0.3, peak.height * 0.44, 6]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** The freighter parked on the strip. */
function Airplane() {
  return (
    <group>
      {/* Fuselage, built from three tapering sections so it has a nose and a
          tail cone rather than being a flying tube. */}
      <mesh material={flatMat(PALETTE.planeBody)} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 3.4, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.planeBody)} position={[0, 0, 1.95]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.42, 0.6, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.planeBody)} position={[0, 0.16, -2.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.1, 1.0, 8]} />
      </mesh>
      {/* Cheat line down the side, which is what makes a white tube read as an
          aircraft rather than a pipe. */}
      <mesh material={flatMat(PALETTE.planeBodyAlt)} position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.425, 0.425, 3.3, 8, 1, true, Math.PI * 0.15, Math.PI * 0.7]} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            material={flatMat(PALETTE.planeWing)}
            position={[side * 1.7, -0.08, -0.15]}
            rotation={[0, side * -0.16, 0]}
          >
            <boxGeometry args={[3.0, 0.1, 1.1]} />
          </mesh>
          <mesh material={flatMat(PALETTE.planeEngine)} position={[side * 1.5, -0.34, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.7, 7]} />
          </mesh>
          {/* Tailplane */}
          <mesh material={flatMat(PALETTE.planeWing)} position={[side * 0.62, 0.24, -2.3]} rotation={[0, side * -0.2, 0]}>
            <boxGeometry args={[1.1, 0.07, 0.5]} />
          </mesh>
          {/* Main gear */}
          <mesh material={flatMat(PALETTE.planeEngine)} position={[side * 0.5, -0.62, -0.1]}>
            <cylinderGeometry args={[0.05, 0.05, 0.42, 5]} />
          </mesh>
          <mesh material={flatMat(PALETTE.cameraLens)} position={[side * 0.5, -0.83, -0.1]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.15, 0.15, 0.1, 7]} />
          </mesh>
        </group>
      ))}

      {/* Fin */}
      <mesh material={flatMat(PALETTE.planeFin)} position={[0, 0.95, -2.25]}>
        <boxGeometry args={[0.09, 1.3, 0.95]} />
      </mesh>

      {/* Nose gear */}
      <mesh material={flatMat(PALETTE.planeEngine)} position={[0, -0.62, 1.5]}>
        <cylinderGeometry args={[0.045, 0.045, 0.42, 5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.cameraLens)} position={[0, -0.83, 1.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 0.09, 7]} />
      </mesh>

      {/* Cabin windows, as one dashed strip rather than individual panes */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} material={flatMat(PALETTE.planeWindow)} position={[0.4, 0.16, 1.25 - i * 0.33]}>
          <boxGeometry args={[0.06, 0.1, 0.14]} />
        </mesh>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={`p${i}`} material={flatMat(PALETTE.planeWindow)} position={[-0.4, 0.16, 1.25 - i * 0.33]}>
          <boxGeometry args={[0.06, 0.1, 0.14]} />
        </mesh>
      ))}
    </group>
  );
}

interface RunwayProps {
  length: number;
  width: number;
}

function Runway({ length, width }: RunwayProps) {
  const dashes = Math.max(3, Math.floor(length / 1.6));
  return (
    <group>
      <mesh material={flatMat(PALETTE.tarmacEdge)} position={[0, 0.02, 0]}>
        <boxGeometry args={[width + 0.5, 0.06, length + 0.5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.tarmac)} position={[0, 0.06, 0]}>
        <boxGeometry args={[width, 0.06, length]} />
      </mesh>
      {Array.from({ length: dashes }, (_, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.tarmacLine)}
          position={[0, 0.1, -length / 2 + (length / dashes) * (i + 0.5)]}
        >
          <boxGeometry args={[0.14, 0.02, length / dashes / 2]} />
        </mesh>
      ))}
      {/* Threshold bars at both ends */}
      {[-1, 1].map((end) => (
        <group key={end}>
          {[-0.3, -0.1, 0.1, 0.3].map((offset, i) => (
            <mesh
              key={i}
              material={flatMat(PALETTE.tarmacLine)}
              position={[offset * width, 0.1, end * (length / 2 - 0.55)]}
            >
              <boxGeometry args={[width * 0.11, 0.02, 0.75]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function FactoryScene() {
  return (
    <group>
      <group position={[WORKS.x, 0, WORKS.z]} rotation={[0, 0.34, 0]}>
        <Works />
      </group>

      <Mountains />

      <group position={[RUNWAY.x, 0, RUNWAY.z]}>
        <Runway length={RUNWAY.length} width={RUNWAY.width} />
      </group>
      {/* Sat on the strip rather than parented to it, so the wings can overhang
          the tarmac the way a real aircraft's do without widening the runway. */}
      <group position={[PLANE.x, 0.94, PLANE.z]}>
        <Airplane />
      </group>
    </group>
  );
}
