import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import type { OfficeSky } from "./officeSky";
import { Workstation } from "./DeskProps";

/** Interior extents. The player's desk sits at the origin, facing -Z. */
export const ROOM = {
  minX: -14,
  maxX: 14,
  minZ: -16,
  maxZ: 10,
  ceiling: 3.2,
} as const;

const WIDTH = ROOM.maxX - ROOM.minX;
const DEPTH = ROOM.maxZ - ROOM.minZ;
const CENTER_X = (ROOM.minX + ROOM.maxX) / 2;
const CENTER_Z = (ROOM.minZ + ROOM.maxZ) / 2;

const SILL_HEIGHT = 0.35;
const HEAD_HEIGHT = 3;

interface WindowWallProps {
  /** Extent along the wall's local X. */
  width: number;
  texture: THREE.Texture;
}

/**
 * A floor-to-ceiling glazed wall, built in its own local XY plane so the two
 * instances can just be positioned and rotated into place. The glass is
 * unlit — it stands in for the sky outside, which shouldn't dim with the room.
 */
function WindowWall({ width, texture }: WindowWallProps) {
  const glassHeight = HEAD_HEIGHT - SILL_HEIGHT;
  const mullionCount = Math.max(2, Math.round(width / 2.4));
  const mullions = Array.from(
    { length: mullionCount + 1 },
    (_, i) => -width / 2 + (i / mullionCount) * width
  );

  return (
    <group>
      <mesh position={[0, SILL_HEIGHT + glassHeight / 2, 0]}>
        <planeGeometry args={[width, glassHeight]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      <mesh material={flatMat(PALETTE.wall)} position={[0, SILL_HEIGHT / 2, 0.06]}>
        <boxGeometry args={[width, SILL_HEIGHT, 0.14]} />
      </mesh>
      <mesh
        material={flatMat(PALETTE.wall)}
        position={[0, HEAD_HEIGHT + (ROOM.ceiling - HEAD_HEIGHT) / 2, 0.06]}
      >
        <boxGeometry args={[width, ROOM.ceiling - HEAD_HEIGHT, 0.14]} />
      </mesh>

      {mullions.map((x, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.mullion)}
          position={[x, SILL_HEIGHT + glassHeight / 2, 0.05]}
        >
          <boxGeometry args={[0.09, glassHeight, 0.1]} />
        </mesh>
      ))}
      <mesh
        material={flatMat(PALETTE.mullion)}
        position={[0, SILL_HEIGHT + glassHeight * 0.62, 0.05]}
      >
        <boxGeometry args={[width, 0.07, 0.1]} />
      </mesh>
    </group>
  );
}

/**
 * Desk grid for the rest of the floor. The origin cell is skipped — that seat
 * is the player's, and it is dressed separately with the interactive objects.
 */
const BULLPEN_X = [-7.2, -3.6, 0, 3.6, 7.2];
const BULLPEN_Z = [-8, -4, 0, 4];

interface OfficeFloorProps {
  sky: OfficeSky;
  windowTexture: THREE.Texture;
}

export function OfficeFloor({ sky, windowTexture }: OfficeFloorProps) {
  // One material for the life of the room, retuned in place — rebuilding it on
  // every sky tick would orphan the old one on the GPU every 30 seconds.
  const ceilingLightMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: PALETTE.ceilingLight,
        emissive: new THREE.Color(PALETTE.ceilingLight),
        flatShading: true,
      }),
    []
  );
  useEffect(() => {
    ceilingLightMat.emissiveIntensity = sky.interiorIntensity;
  }, [ceilingLightMat, sky.interiorIntensity]);
  useEffect(() => () => ceilingLightMat.dispose(), [ceilingLightMat]);

  const ceilingLights = useMemo(() => {
    const spots: [number, number][] = [];
    for (let x = -9; x <= 9; x += 6) {
      for (let z = -13; z <= 7; z += 5) spots.push([x, z]);
    }
    return spots;
  }, []);

  const desks = useMemo(() => {
    const out: { key: string; x: number; z: number; seed: number }[] = [];
    let seed = 1;
    for (const x of BULLPEN_X) {
      for (const z of BULLPEN_Z) {
        seed += 1;
        if (x === 0 && z === 0) continue;
        out.push({ key: `${x}:${z}`, x, z, seed });
      }
    }
    return out;
  }, []);

  return (
    <group>
      <mesh material={flatMat(PALETTE.carpet)} rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, 0, CENTER_Z]}>
        <planeGeometry args={[WIDTH, DEPTH]} />
      </mesh>
      {/* A single off-tone band down the floor breaks up what would otherwise
          be an unbroken sheet of one color across the whole room. */}
      <mesh
        material={flatMat(PALETTE.carpetAlt)}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[CENTER_X, 0.002, CENTER_Z]}
      >
        <planeGeometry args={[3.4, DEPTH]} />
      </mesh>

      <mesh
        material={flatMat(PALETTE.ceiling)}
        rotation={[Math.PI / 2, 0, 0]}
        position={[CENTER_X, ROOM.ceiling, CENTER_Z]}
      >
        <planeGeometry args={[WIDTH, DEPTH]} />
      </mesh>
      {ceilingLights.map(([x, z], i) => (
        <mesh key={i} material={ceilingLightMat} rotation={[Math.PI / 2, 0, 0]} position={[x, ROOM.ceiling - 0.01, z]}>
          <planeGeometry args={[1.8, 0.5]} />
        </mesh>
      ))}

      {/* Glazing ahead of the player and down the right-hand side. */}
      <group position={[CENTER_X, 0, ROOM.minZ]}>
        <WindowWall width={WIDTH} texture={windowTexture} />
      </group>
      <group position={[ROOM.maxX, 0, CENTER_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <WindowWall width={DEPTH} texture={windowTexture} />
      </group>

      <mesh material={flatMat(PALETTE.wall)} position={[ROOM.minX, ROOM.ceiling / 2, CENTER_Z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[DEPTH, ROOM.ceiling]} />
      </mesh>
      <mesh material={flatMat(PALETTE.wall)} position={[CENTER_X, ROOM.ceiling / 2, ROOM.maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[WIDTH, ROOM.ceiling]} />
      </mesh>

      {[
        [-10.5, -10],
        [-10.5, 2],
        [10.5, -10],
        [10.5, 2],
      ].map(([x, z], i) => (
        <mesh key={i} material={flatMat(PALETTE.column)} position={[x, ROOM.ceiling / 2, z]}>
          <boxGeometry args={[0.55, ROOM.ceiling, 0.55]} />
        </mesh>
      ))}

      {desks.map(({ key, x, z, seed }) => (
        <group key={key} position={[x, 0, z]}>
          <Workstation seed={seed} rotation={(Math.sin(seed * 4.7) - 0.5) * 0.08} />
        </group>
      ))}
    </group>
  );
}
