import { PALETTE } from "./palette";
import { flatMat, glowMat } from "./materials";

/**
 * Non-interactive set dressing. Everything here is built from primitives with
 * deliberately low segment counts — cylinders at 5-8 sides, cones at 5 — so the
 * facets stay visible. Nothing uses smoothed normals; see materials.ts.
 */

export const DESK_WIDTH = 1.9;
export const DESK_DEPTH = 0.85;
export const DESK_HEIGHT = 0.74;
const TOP_THICKNESS = 0.05;

interface DeskProps {
  topColor?: string;
  width?: number;
  depth?: number;
}

export function Desk({ topColor = PALETTE.deskTop, width = DESK_WIDTH, depth = DESK_DEPTH }: DeskProps) {
  const legInset = 0.08;
  const legHeight = DESK_HEIGHT - TOP_THICKNESS;
  const legs: [number, number][] = [
    [-width / 2 + legInset, -depth / 2 + legInset],
    [width / 2 - legInset, -depth / 2 + legInset],
    [-width / 2 + legInset, depth / 2 - legInset],
    [width / 2 - legInset, depth / 2 - legInset],
  ];

  return (
    <group>
      <mesh material={flatMat(topColor)} position={[0, DESK_HEIGHT - TOP_THICKNESS / 2, 0]}>
        <boxGeometry args={[width, TOP_THICKNESS, depth]} />
      </mesh>
      {legs.map(([x, z], i) => (
        <mesh key={i} material={flatMat(PALETTE.deskLeg)} position={[x, legHeight / 2, z]}>
          <boxGeometry args={[0.055, legHeight, 0.055]} />
        </mesh>
      ))}
      {/* Modesty panel — reads as a desk rather than a table from across the floor. */}
      <mesh material={flatMat(topColor)} position={[0, DESK_HEIGHT - 0.28, -depth / 2 + 0.06]}>
        <boxGeometry args={[width - 0.24, 0.34, 0.03]} />
      </mesh>
    </group>
  );
}

interface MonitorProps {
  /** Screens are dark set dressing by default; the player's own has a faint glow. */
  lit?: boolean;
  scale?: number;
}

export function Monitor({ lit = false, scale = 1 }: MonitorProps) {
  return (
    <group scale={scale}>
      <mesh material={flatMat(PALETTE.monitorBody)} position={[0, 0.34, 0]}>
        <boxGeometry args={[0.64, 0.38, 0.035]} />
      </mesh>
      <mesh
        material={lit ? glowMat(PALETTE.monitorGlow, 0.5) : flatMat(PALETTE.monitorScreen)}
        position={[0, 0.34, 0.021]}
      >
        <boxGeometry args={[0.58, 0.32, 0.006]} />
      </mesh>
      <mesh material={flatMat(PALETTE.monitorBody)} position={[0, 0.12, 0]}>
        <boxGeometry args={[0.05, 0.16, 0.05]} />
      </mesh>
      <mesh material={flatMat(PALETTE.monitorBody)} position={[0, 0.025, 0.02]}>
        <boxGeometry args={[0.28, 0.02, 0.17]} />
      </mesh>
    </group>
  );
}

export function Keyboard() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.keyboard)} position={[0, 0.011, 0]}>
        <boxGeometry args={[0.46, 0.022, 0.16]} />
      </mesh>
      {/* Two coarse key blocks rather than individual keys: at this scale the
          silhouette is all that reads, and 60 keycaps would be 60 draw calls. */}
      <mesh material={flatMat(PALETTE.keycap)} position={[0, 0.026, -0.028]}>
        <boxGeometry args={[0.42, 0.008, 0.07]} />
      </mesh>
      <mesh material={flatMat(PALETTE.keycap)} position={[0, 0.026, 0.048]}>
        <boxGeometry args={[0.42, 0.008, 0.05]} />
      </mesh>
    </group>
  );
}

export function Mouse() {
  return (
    <mesh material={flatMat(PALETTE.mouse)} position={[0, 0.016, 0]} scale={[1, 0.55, 1.45]}>
      <sphereGeometry args={[0.032, 6, 4]} />
    </mesh>
  );
}

export function Mug() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.mug)} position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.043, 0.037, 0.09, 8]} />
      </mesh>
      {/* Sunk just below the rim so the mug reads as full, not as a hollow tube. */}
      <mesh material={flatMat(PALETTE.mugInner)} position={[0, 0.086, 0]}>
        <cylinderGeometry args={[0.036, 0.036, 0.008, 8]} />
      </mesh>
      <mesh
        material={flatMat(PALETTE.mug)}
        position={[0.052, 0.048, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.024, 0.007, 4, 7]} />
      </mesh>
    </group>
  );
}

export function PottedPlant() {
  const blades: [number, number, number, number][] = [
    // x, z, tilt, height
    [0, 0, 0, 0.15],
    [0.028, 0.012, 0.42, 0.12],
    [-0.026, 0.018, -0.38, 0.115],
    [0.008, -0.03, 0.3, 0.1],
  ];
  return (
    <group>
      <mesh material={flatMat(PALETTE.potTerracotta)} position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.055, 0.042, 0.09, 6]} />
      </mesh>
      {blades.map(([x, z, tilt, h], i) => (
        <mesh
          key={i}
          material={flatMat(i % 2 === 0 ? PALETTE.leafSage : PALETTE.leafSageDark)}
          position={[x, 0.09 + h / 2, z]}
          rotation={[0, i * 1.3, tilt]}
        >
          <coneGeometry args={[0.032, h, 5]} />
        </mesh>
      ))}
    </group>
  );
}

export function Notebook() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.paper)} position={[0, 0.008, 0]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[0.2, 0.016, 0.27]} />
      </mesh>
      <mesh material={flatMat(PALETTE.paperAlt)} position={[0.012, 0.021, 0.01]} rotation={[0, -0.18, 0]}>
        <boxGeometry args={[0.19, 0.01, 0.26]} />
      </mesh>
    </group>
  );
}

export function DeskLamp() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.lampArm)} position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.06, 0.068, 0.024, 6]} />
      </mesh>
      <mesh material={flatMat(PALETTE.lampArm)} position={[0.05, 0.16, 0]} rotation={[0, 0, -0.34]}>
        <cylinderGeometry args={[0.009, 0.009, 0.3, 5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.lampShade)} position={[0.115, 0.29, 0]} rotation={[0, 0, -1.05]}>
        <coneGeometry args={[0.065, 0.1, 6, 1, true]} />
      </mesh>
    </group>
  );
}

export function OfficeChair() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.chairSeat)} position={[0, 0.45, 0]}>
        <boxGeometry args={[0.42, 0.06, 0.4]} />
      </mesh>
      <mesh material={flatMat(PALETTE.chairSeat)} position={[0, 0.7, -0.19]} rotation={[0.16, 0, 0]}>
        <boxGeometry args={[0.4, 0.44, 0.055]} />
      </mesh>
      <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.42, 6]} />
      </mesh>
      <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.055, 0.22, 0.05, 5]} />
      </mesh>
    </group>
  );
}

interface WorkstationProps {
  /** Index into the deterministic jitter, so no two seats look posed alike. */
  seed: number;
  /** Radians the whole workstation is turned by. */
  rotation?: number;
}

/** A background desk: monitor, keyboard, chair, and a little random clutter. */
export function Workstation({ seed, rotation = 0 }: WorkstationProps) {
  const r = (n: number) => {
    const x = Math.sin((seed * 12.9898 + n * 78.233) * 43758.5453);
    return x - Math.floor(x);
  };
  const hasMug = r(1) > 0.45;
  const hasPlant = r(2) > 0.7;
  const hasPapers = r(3) > 0.55;
  const chairTurn = (r(4) - 0.5) * 1.4;
  const chairSlide = (r(5) - 0.5) * 0.3;

  return (
    <group rotation={[0, rotation, 0]}>
      <Desk topColor={r(6) > 0.5 ? PALETTE.deskTop : PALETTE.deskTopAlt} />
      <group position={[(r(7) - 0.5) * 0.2, DESK_HEIGHT, -0.22]}>
        <Monitor scale={0.94} />
      </group>
      <group position={[(r(8) - 0.5) * 0.16, DESK_HEIGHT, 0.2]}>
        <Keyboard />
      </group>
      {hasMug && (
        <group position={[0.52 + r(9) * 0.15, DESK_HEIGHT, 0.16]}>
          <Mug />
        </group>
      )}
      {hasPlant && (
        <group position={[-0.68, DESK_HEIGHT, -0.2]}>
          <PottedPlant />
        </group>
      )}
      {hasPapers && (
        <group position={[-0.55 - r(10) * 0.12, DESK_HEIGHT, 0.18]}>
          <Notebook />
        </group>
      )}
      <group position={[chairSlide, 0, 0.78]} rotation={[0, chairTurn, 0]}>
        <OfficeChair />
      </group>
    </group>
  );
}
