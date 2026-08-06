import { useMemo } from "react";
import { flatMaterial, PALETTE } from "./materials";
import {
  CEILING_HEIGHT,
  HALL_MAX_X,
  HALL_MAX_Z,
  HALL_MIN_X,
  HALL_MIN_Z,
  WALL_THICKNESS,
  WINDOW_BOTTOM,
  WINDOW_TOP,
  WINDOW_WIDTH,
  WINDOW_Z,
} from "./layout";

const HALL_WIDTH = HALL_MAX_X - HALL_MIN_X;
const HALL_LENGTH = HALL_MAX_Z - HALL_MIN_Z;
const HALL_CENTER_Z = (HALL_MAX_Z + HALL_MIN_Z) / 2;

const PLANK_WIDTH = 1.08;
const RUNNER_WIDTH = 5.2;
/** Spacing of the ceiling cross-beams. Close enough to read as a rhythm down the hall. */
const BEAM_SPACING = 6;
const COLUMN_INSET = 1.5;

interface Segment {
  center: number;
  length: number;
}

/**
 * The stretches of solid wall left over once the window openings are removed.
 * Building the side walls as piers between openings — rather than one solid slab
 * with the glass pasted on — is what lets light actually read as coming *through*
 * a hole in the wall.
 */
function wallPiers(): Segment[] {
  const spans = [...WINDOW_Z]
    .sort((a, b) => a - b)
    .map((z) => [z - WINDOW_WIDTH / 2, z + WINDOW_WIDTH / 2] as const);

  const segments: Segment[] = [];
  let cursor = HALL_MIN_Z;
  for (const [start, end] of spans) {
    if (start > cursor) segments.push({ center: (cursor + start) / 2, length: start - cursor });
    cursor = Math.max(cursor, end);
  }
  if (cursor < HALL_MAX_Z) {
    segments.push({ center: (cursor + HALL_MAX_Z) / 2, length: HALL_MAX_Z - cursor });
  }
  return segments;
}

function Floor() {
  const materials = useMemo(
    () => [PALETTE.floorPlankA, PALETTE.floorPlankB, PALETTE.floorPlankC].map((c) => flatMaterial(c)),
    []
  );
  const baseMaterial = useMemo(() => flatMaterial(PALETTE.floorPlankB), []);
  const runnerMaterial = useMemo(() => flatMaterial(PALETTE.runner), []);

  const plankCount = Math.ceil(HALL_WIDTH / PLANK_WIDTH);

  return (
    <group>
      {/* Solid slab under the planks so the seams between them never show gaps.
          Kept below the plank underside rather than flush with their top face,
          which would put two coplanar surfaces in every seam and z-fight. */}
      <mesh material={baseMaterial} position={[0, -0.35, HALL_CENTER_Z]} receiveShadow>
        <boxGeometry args={[HALL_WIDTH, 0.6, HALL_LENGTH]} />
      </mesh>

      {/* The walking surface is y = 0, matching the meadow's ground plane — the
          shared character controller puts the character's soles just above it. */}
      {Array.from({ length: plankCount }, (_, i) => {
        const x = HALL_MIN_X + PLANK_WIDTH * (i + 0.5);
        return (
          <mesh
            key={i}
            material={materials[i % materials.length]}
            position={[x, -0.05, HALL_CENTER_Z]}
            receiveShadow
          >
            {/* Slightly narrower than the pitch, so a thin dark seam reads between planks. */}
            <boxGeometry args={[PLANK_WIDTH * 0.94, 0.1, HALL_LENGTH]} />
          </mesh>
        );
      })}

      {/* Sits a centimetre proud of the boards, the way a runner actually lies. */}
      <mesh material={runnerMaterial} position={[0, -0.015, HALL_CENTER_Z]} receiveShadow>
        <boxGeometry args={[RUNNER_WIDTH, 0.05, HALL_LENGTH - 4]} />
      </mesh>
    </group>
  );
}

function Walls() {
  const wallMaterial = useMemo(() => flatMaterial(PALETTE.wall), []);
  const trimMaterial = useMemo(() => flatMaterial(PALETTE.wallTrim), []);
  const piers = useMemo(() => wallPiers(), []);

  const sills = [HALL_MIN_X + WALL_THICKNESS / 2, HALL_MAX_X - WALL_THICKNESS / 2];

  return (
    <group>
      {sills.map((x, side) => (
        <group key={side}>
          {/* Below the windows. */}
          <mesh material={wallMaterial} position={[x, WINDOW_BOTTOM / 2, HALL_CENTER_Z]} receiveShadow>
            <boxGeometry args={[WALL_THICKNESS, WINDOW_BOTTOM, HALL_LENGTH]} />
          </mesh>
          {/* Above the windows. */}
          <mesh
            material={wallMaterial}
            position={[x, (WINDOW_TOP + CEILING_HEIGHT) / 2, HALL_CENTER_Z]}
            receiveShadow
          >
            <boxGeometry args={[WALL_THICKNESS, CEILING_HEIGHT - WINDOW_TOP, HALL_LENGTH]} />
          </mesh>
          {/* Piers between openings. */}
          {piers.map((pier, i) => (
            <mesh
              key={i}
              material={wallMaterial}
              position={[x, (WINDOW_BOTTOM + WINDOW_TOP) / 2, pier.center]}
              receiveShadow
            >
              <boxGeometry args={[WALL_THICKNESS, WINDOW_TOP - WINDOW_BOTTOM, pier.length]} />
            </mesh>
          ))}
          {/* Sill course, purely to break the flat wall band under the glass. */}
          <mesh material={trimMaterial} position={[x, WINDOW_BOTTOM - 0.15, HALL_CENTER_Z]}>
            <boxGeometry args={[WALL_THICKNESS + 0.35, 0.3, HALL_LENGTH]} />
          </mesh>
        </group>
      ))}

      {/* End walls. */}
      {[HALL_MAX_Z - WALL_THICKNESS / 2, HALL_MIN_Z + WALL_THICKNESS / 2].map((z, i) => (
        <mesh key={i} material={wallMaterial} position={[0, CEILING_HEIGHT / 2, z]} receiveShadow>
          <boxGeometry args={[HALL_WIDTH, CEILING_HEIGHT, WALL_THICKNESS]} />
        </mesh>
      ))}
    </group>
  );
}

function Ceiling() {
  const ceilingMaterial = useMemo(() => flatMaterial(PALETTE.ceiling), []);
  const beamMaterial = useMemo(() => flatMaterial(PALETTE.beam), []);

  const beamCount = Math.floor(HALL_LENGTH / BEAM_SPACING);

  return (
    <group>
      <mesh material={ceilingMaterial} position={[0, CEILING_HEIGHT + 0.3, HALL_CENTER_Z]}>
        <boxGeometry args={[HALL_WIDTH, 0.6, HALL_LENGTH]} />
      </mesh>

      {Array.from({ length: beamCount }, (_, i) => {
        const z = HALL_MIN_Z + BEAM_SPACING * (i + 0.5);
        return (
          <mesh key={i} material={beamMaterial} position={[0, CEILING_HEIGHT - 0.45, z]} castShadow>
            <boxGeometry args={[HALL_WIDTH, 0.75, 0.6]} />
          </mesh>
        );
      })}

      {/* Two runs along the hall, so the ceiling reads as a coffered grid rather than ribs. */}
      {[-5, 5].map((x) => (
        <mesh key={x} material={beamMaterial} position={[x, CEILING_HEIGHT - 0.3, HALL_CENTER_Z]}>
          <boxGeometry args={[0.5, 0.5, HALL_LENGTH]} />
        </mesh>
      ))}
    </group>
  );
}

function Columns() {
  const columnMaterial = useMemo(() => flatMaterial(PALETTE.column), []);
  const piers = useMemo(() => wallPiers(), []);
  const xs = [HALL_MIN_X + COLUMN_INSET, HALL_MAX_X - COLUMN_INSET];

  return (
    <group>
      {xs.map((x) =>
        piers.map((pier, i) => (
          <group key={`${x}-${i}`} position={[x, 0, pier.center]}>
            <mesh material={columnMaterial} position={[0, 0.35, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.5, 0.7, 1.5]} />
            </mesh>
            {/* 8 sides, flat shaded — a faceted shaft rather than a smooth cylinder. */}
            <mesh material={columnMaterial} position={[0, CEILING_HEIGHT / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.52, 0.6, CEILING_HEIGHT, 8]} />
            </mesh>
            <mesh material={columnMaterial} position={[0, CEILING_HEIGHT - 0.5, 0]} castShadow>
              <boxGeometry args={[1.35, 1, 1.35]} />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

/** Floor, walls with window openings, coffered ceiling, and the column arcade. */
export function Hall() {
  return (
    <group>
      <Floor />
      <Walls />
      <Ceiling />
      <Columns />
    </group>
  );
}
