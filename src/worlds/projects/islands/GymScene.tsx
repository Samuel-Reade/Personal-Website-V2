import { PALETTE } from "../palette";
import { flatMat } from "../materials";

/**
 * Exercise & cortisol: an open-air gym. The bench press is still the subject and
 * keeps the middle; everything else — squat rack, dumbbell rack, plate tree,
 * kettlebells, mats — is arranged around it so the island reads as a floor
 * rather than as one machine on grass.
 */

/** A loaded bar: shaft plus plates, mirrored about the middle. */
function Barbell({ length = 2.9, plates = [0.95, 1.15] }: { length?: number; plates?: number[] }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh material={flatMat(PALETTE.barbell)}>
        <cylinderGeometry args={[0.055, 0.055, length, 6]} />
      </mesh>
      {plates.flatMap((offset, i) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${i}-${side}`}
            material={flatMat(i === 0 ? PALETTE.plate : PALETTE.plateAccent)}
            position={[0, side * offset, 0]}
          >
            <cylinderGeometry args={[i === 0 ? 0.36 : 0.3, i === 0 ? 0.36 : 0.3, 0.11, 8]} />
          </mesh>
        ))
      )}
    </group>
  );
}

function BenchPress() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.benchPad)} position={[0, 0.68, 0.1]}>
        <boxGeometry args={[0.52, 0.16, 2.1]} />
      </mesh>
      {[-0.85, 0.85].map((z, i) => (
        <mesh key={i} material={flatMat(PALETTE.benchFrame)} position={[0, 0.3, z + 0.1]}>
          <boxGeometry args={[0.42, 0.6, 0.12]} />
        </mesh>
      ))}
      <mesh material={flatMat(PALETTE.benchFrame)} position={[0, 0.06, 0.1]}>
        <boxGeometry args={[0.5, 0.12, 2.0]} />
      </mesh>
      {[-0.46, 0.46].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.benchFrame)} position={[x, 0.7, -0.82]}>
          <boxGeometry args={[0.12, 1.4, 0.12]} />
        </mesh>
      ))}
      <group position={[0, 1.42, -0.82]}>
        <Barbell />
      </group>
    </group>
  );
}

/** Squat rack: two uprights, a crossmember, and a bar sitting in the hooks. */
function SquatRack() {
  return (
    <group>
      {[-0.62, 0.62].map((x, i) => (
        <group key={i}>
          <mesh material={flatMat(PALETTE.rackFrame)} position={[x, 1.1, 0]}>
            <boxGeometry args={[0.16, 2.2, 0.16]} />
          </mesh>
          <mesh material={flatMat(PALETTE.rackFrame)} position={[x, 0.06, 0.12]}>
            <boxGeometry args={[0.2, 0.12, 1.0]} />
          </mesh>
          {/* J-hook holding the bar */}
          <mesh material={flatMat(PALETTE.kettlebell)} position={[x, 1.62, 0.16]}>
            <boxGeometry args={[0.14, 0.16, 0.22]} />
          </mesh>
        </group>
      ))}
      <mesh material={flatMat(PALETTE.rackFrame)} position={[0, 2.14, 0]}>
        <boxGeometry args={[1.4, 0.14, 0.14]} />
      </mesh>
      <group position={[0, 1.72, 0.16]}>
        <Barbell length={2.4} plates={[0.82, 1.0]} />
      </group>
    </group>
  );
}

/** Two-tier dumbbell rack. */
function DumbbellRack() {
  const sizes = [0.15, 0.17, 0.19, 0.21];
  return (
    <group>
      <mesh material={flatMat(PALETTE.rackFrame)} position={[0, 0.28, 0]}>
        <boxGeometry args={[2.2, 0.1, 0.62]} />
      </mesh>
      <mesh material={flatMat(PALETTE.rackFrame)} position={[0, 0.68, -0.16]}>
        <boxGeometry args={[2.2, 0.1, 0.42]} />
      </mesh>
      {[-1.0, 1.0].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.rackFrame)} position={[x, 0.38, 0]}>
          <boxGeometry args={[0.12, 0.76, 0.58]} />
        </mesh>
      ))}
      {sizes.map((r, i) => (
        <group key={i} position={[-0.75 + i * 0.5, 0.4, 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={flatMat(PALETTE.dumbbell)}>
            <cylinderGeometry args={[0.05, 0.05, 0.46, 5]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} material={flatMat(PALETTE.plate)} position={[0, side * 0.18, 0]}>
              <cylinderGeometry args={[r, r, 0.12, 7]} />
            </mesh>
          ))}
        </group>
      ))}
      {sizes.slice(0, 3).map((r, i) => (
        <group key={`t${i}`} position={[-0.55 + i * 0.55, 0.8, -0.16]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={flatMat(PALETTE.dumbbell)}>
            <cylinderGeometry args={[0.045, 0.045, 0.4, 5]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} material={flatMat(PALETTE.plate)} position={[0, side * 0.16, 0]}>
              <cylinderGeometry args={[r * 0.85, r * 0.85, 0.1, 7]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Vertical post stacked with spare plates. */
function PlateTree() {
  const radii = [0.42, 0.42, 0.36, 0.3, 0.26];
  return (
    <group>
      <mesh material={flatMat(PALETTE.rackFrame)} position={[0, 0.06, 0]}>
        <boxGeometry args={[0.7, 0.12, 0.7]} />
      </mesh>
      <mesh material={flatMat(PALETTE.rackFrame)} position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.5, 6]} />
      </mesh>
      {radii.map((r, i) => (
        <mesh
          key={i}
          material={flatMat(i % 2 === 0 ? PALETTE.plate : PALETTE.plateAccent)}
          position={[0, 0.2 + i * 0.26, 0]}
        >
          <cylinderGeometry args={[r, r, 0.13, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function Kettlebell({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh material={flatMat(PALETTE.kettlebell)} position={[0, 0.16, 0]} scale={[1, 0.88, 1]}>
        <icosahedronGeometry args={[0.19, 1]} />
      </mesh>
      <mesh material={flatMat(PALETTE.kettlebell)} position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.035, 4, 8, Math.PI]} />
      </mesh>
    </group>
  );
}

/** Floor mats, which is what turns bare ground into a gym floor. */
function Mats() {
  return (
    <group>
      {[
        [0, 0, 3.0, 2.4],
        [-2.9, 1.6, 1.9, 1.5],
        [2.8, -1.5, 1.7, 1.4],
      ].map(([x, z, w, d], i) => (
        <mesh
          key={i}
          material={flatMat(i % 2 === 0 ? PALETTE.gymMat : PALETTE.gymMatAlt)}
          position={[x, 0.03, z]}
        >
          <boxGeometry args={[w, 0.06, d]} />
        </mesh>
      ))}
    </group>
  );
}

export function GymScene() {
  return (
    <group>
      <Mats />

      <BenchPress />

      <group position={[-3.0, 0, -2.3]} rotation={[0, 0.5, 0]}>
        <SquatRack />
      </group>
      <group position={[3.1, 0, -1.4]} rotation={[0, -0.7, 0]}>
        <DumbbellRack />
      </group>
      <group position={[-3.2, 0, 1.9]} rotation={[0, 0.3, 0]}>
        <PlateTree />
      </group>

      <group position={[2.6, 0, 1.7]}>
        <Kettlebell scale={1.15} />
      </group>
      <group position={[3.15, 0, 2.15]}>
        <Kettlebell scale={0.9} />
      </group>
      <group position={[2.2, 0, 2.35]}>
        <Kettlebell />
      </group>

      {/* A bar left on the floor by the plate tree, so the space looks used. */}
      <group position={[-1.9, 0.11, 2.6]} rotation={[0, 0.4, 0]}>
        <Barbell length={2.5} plates={[0.86, 1.04]} />
      </group>
    </group>
  );
}
