import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { carpetTexture, ceilingTexture, flatMat, texturedMat } from "./materials";
import type { OfficeSky } from "./officeSky";
import { ContactShadow, Workstation } from "./DeskProps";
import { isOccupied, StandingCoworker } from "./Coworkers";

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
      {/* A ledge on the sill — deep enough to read as one, and it throws the
          only strong horizontal the glazed wall has. */}
      <mesh material={flatMat(PALETTE.mullion)} position={[0, SILL_HEIGHT + 0.015, 0.12]}>
        <boxGeometry args={[width, 0.03, 0.22]} />
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

/** A framed abstract on the wall — two soft color fields, which is all office art is. */
function WallArt({ a, b }: { a: string; b: string }) {
  return (
    <group>
      <mesh material={flatMat(PALETTE.artFrame)}>
        <boxGeometry args={[0.86, 0.62, 0.03]} />
      </mesh>
      <mesh material={flatMat(a)} position={[0, 0.06, 0.017]}>
        <planeGeometry args={[0.74, 0.38]} />
      </mesh>
      <mesh material={flatMat(b)} position={[0, -0.19, 0.017]}>
        <planeGeometry args={[0.74, 0.12]} />
      </mesh>
    </group>
  );
}

/** Whiteboard with the residue of a meeting drawn on a canvas texture. */
function Whiteboard() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = PALETTE.whiteboard;
    ctx.fillRect(0, 0, 256, 128);
    // The residue of a sprint: a graph, a list, two boxes and an arrow. Drawn
    // faint — a fresh diagram would upstage the room.
    ctx.strokeStyle = "rgba(90, 110, 160, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 22, 58, 36);
    ctx.strokeRect(150, 20, 62, 30);
    ctx.beginPath();
    ctx.moveTo(82, 40);
    ctx.lineTo(150, 35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(28, 104);
    ctx.lineTo(60, 78);
    ctx.lineTo(96, 92);
    ctx.lineTo(132, 66);
    ctx.stroke();
    ctx.strokeStyle = "rgba(170, 90, 90, 0.45)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(168, 68 + i * 13);
      ctx.lineTo(168 + 30 + (i % 2) * 14, 68 + i * 13);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <group>
      <mesh material={flatMat(PALETTE.whiteboardFrame)}>
        <boxGeometry args={[1.7, 1.02, 0.04]} />
      </mesh>
      <mesh position={[0, 0.02, 0.022]}>
        <planeGeometry args={[1.58, 0.86]} />
        <meshLambertMaterial map={texture} flatShading />
      </mesh>
      {/* Marker tray, with two markers left on it. */}
      <mesh material={flatMat(PALETTE.whiteboardFrame)} position={[0, -0.52, 0.05]}>
        <boxGeometry args={[0.7, 0.03, 0.08]} />
      </mesh>
      {[
        { x: -0.12, color: PALETTE.headphone },
        { x: 0.1, color: PALETTE.artRustB },
      ].map((m, i) => (
        <mesh key={i} material={flatMat(m.color)} position={[m.x, -0.5, 0.05]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.011, 0.011, 0.11, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/** Wall clock reading the real minute it was mounted — the world runs on the clock anyway. */
function WallClock() {
  const { hourAngle, minuteAngle } = useMemo(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    const hours = (now.getHours() % 12) + minutes / 60;
    return {
      hourAngle: -hours * (Math.PI / 6),
      minuteAngle: -minutes * (Math.PI / 30),
    };
  }, []);

  return (
    <group>
      <mesh material={flatMat(PALETTE.clockRim)} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.035, 16]} />
      </mesh>
      <mesh material={flatMat(PALETTE.clockFace)} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]}>
        <cylinderGeometry args={[0.145, 0.145, 0.02, 16]} />
      </mesh>
      <group position={[0, 0, 0.026]}>
        <mesh material={flatMat(PALETTE.headphone)} rotation={[0, 0, hourAngle]}>
          <boxGeometry args={[0.014, 0.08, 0.006]} />
        </mesh>
        <mesh material={flatMat(PALETTE.headphone)} rotation={[0, 0, minuteAngle]} position={[0, 0, 0.004]}>
          <boxGeometry args={[0.009, 0.12, 0.004]} />
        </mesh>
      </group>
    </group>
  );
}

/** The way out: door, frame, and the exit sign above it. */
function Door() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.doorFrame)} position={[0, 1.06, 0]}>
        <boxGeometry args={[1.06, 2.12, 0.1]} />
      </mesh>
      <mesh material={flatMat(PALETTE.door)} position={[0, 1.04, 0.03]}>
        <boxGeometry args={[0.92, 2.02, 0.06]} />
      </mesh>
      {/* Kickplate and handle. */}
      <mesh material={flatMat(PALETTE.doorHandle)} position={[0, 0.18, 0.065]}>
        <boxGeometry args={[0.92, 0.2, 0.01]} />
      </mesh>
      <mesh material={flatMat(PALETTE.doorHandle)} position={[-0.34, 1.02, 0.08]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 0.14, 6]} />
      </mesh>
      <mesh material={flatMat(PALETTE.exitSign)} position={[0, 2.3, 0.04]}>
        <boxGeometry args={[0.34, 0.12, 0.05]} />
      </mesh>
    </group>
  );
}

/** Low storage credenza with a printer on top — every office has this island. */
function PrinterStation() {
  return (
    <group>
      <ContactShadow width={1.9} depth={1.1} opacity={0.5} />
      <mesh material={flatMat(PALETTE.cabinet)} position={[0, 0.36, 0]}>
        <boxGeometry args={[1.5, 0.72, 0.55]} />
      </mesh>
      {/* Door seams and handles. */}
      {[-0.375, 0.375].map((x, i) => (
        <group key={i}>
          <mesh material={flatMat(PALETTE.cabinetDark)} position={[x, 0.36, 0.278]}>
            <boxGeometry args={[0.68, 0.62, 0.008]} />
          </mesh>
          <mesh material={flatMat(PALETTE.doorHandle)} position={[x + (i === 0 ? 0.26 : -0.26), 0.5, 0.29]}>
            <boxGeometry args={[0.02, 0.12, 0.02]} />
          </mesh>
        </group>
      ))}
      <group position={[-0.3, 0.72, 0]}>
        <mesh material={flatMat(PALETTE.printer)} position={[0, 0.13, 0]}>
          <boxGeometry args={[0.52, 0.26, 0.42]} />
        </mesh>
        {/* Output tray with a few sheets sitting in it, and the control strip. */}
        <mesh material={flatMat(PALETTE.printerDark)} position={[0, 0.2, 0.24]}>
          <boxGeometry args={[0.34, 0.02, 0.14]} />
        </mesh>
        <mesh material={flatMat(PALETTE.paper)} position={[0, 0.215, 0.23]}>
          <boxGeometry args={[0.28, 0.008, 0.12]} />
        </mesh>
        <mesh material={flatMat(PALETTE.ledLit)} position={[0.18, 0.22, 0.16]}>
          <boxGeometry args={[0.05, 0.012, 0.03]} />
        </mesh>
      </group>
      {/* Paper stack waiting on the other end. */}
      <mesh material={flatMat(PALETTE.paper)} position={[0.45, 0.77, 0.02]}>
        <boxGeometry args={[0.24, 0.1, 0.3]} />
      </mesh>
    </group>
  );
}

/** Water cooler — the floor's one piece of social architecture. */
function WaterCooler() {
  return (
    <group>
      <ContactShadow width={0.8} depth={0.8} opacity={0.5} />
      <mesh material={flatMat(PALETTE.coolerBody)} position={[0, 0.5, 0]}>
        <boxGeometry args={[0.34, 1, 0.34]} />
      </mesh>
      <mesh material={flatMat(PALETTE.coolerBottle)} position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.36, 9]} />
      </mesh>
      <mesh material={flatMat(PALETTE.coolerBottle)} position={[0, 1.38, 0]}>
        <cylinderGeometry args={[0.05, 0.11, 0.08, 9]} />
      </mesh>
      {/* Taps and the cup sleeve on the side. */}
      {[-0.06, 0.06].map((x, i) => (
        <mesh key={i} material={flatMat(i === 0 ? PALETTE.artRustB : PALETTE.coolerBottle)} position={[x, 0.88, 0.19]}>
          <boxGeometry args={[0.045, 0.05, 0.06]} />
        </mesh>
      ))}
      <mesh material={flatMat(PALETTE.paper)} position={[0.21, 0.78, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.28, 7]} />
      </mesh>
    </group>
  );
}

/** A tall floor plant for the dead corners the desks don't reach. */
function FloorPlant({ seed = 0 }: { seed?: number }) {
  const fronds = [0, 1, 2, 3, 4, 5, 6];
  return (
    <group>
      <ContactShadow width={0.9} depth={0.9} opacity={0.45} />
      <mesh material={flatMat(PALETTE.plantTub)} position={[0, 0.19, 0]}>
        <cylinderGeometry args={[0.2, 0.16, 0.38, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.soil)} position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 8]} />
      </mesh>
      {fronds.map((i) => {
        const angle = (i / fronds.length) * Math.PI * 2 + seed;
        const tilt = 0.5 + ((i * 37 + seed * 11) % 10) / 28;
        const h = 0.75 + ((i * 53) % 10) / 22;
        return (
          <mesh
            key={i}
            material={flatMat(i % 2 === 0 ? PALETTE.leafSage : PALETTE.leafSageDark)}
            position={[Math.sin(angle) * 0.1, 0.38 + h / 2, Math.cos(angle) * 0.1]}
            rotation={[Math.cos(angle) * tilt * 0.45, 0, -Math.sin(angle) * tilt * 0.45]}
          >
            <coneGeometry args={[0.05, h, 5]} />
          </mesh>
        );
      })}
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
  /** Office hours — the floor has people at it. Outside them every desk is empty. */
  staffed: boolean;
}

export function OfficeFloor({ sky, windowTexture, staffed }: OfficeFloorProps) {
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

  // Repeats set so a carpet tile lands at half a metre and a ceiling tile at
  // 0.6 — the sizes those products actually come in.
  const carpetMat = useMemo(() => {
    const material = texturedMat("floor-carpet", carpetTexture(PALETTE.carpet));
    material.map!.repeat.set(WIDTH / 2, DEPTH / 2);
    return material;
  }, []);
  const ceilingMat = useMemo(() => {
    const material = texturedMat("ceiling-grid", ceilingTexture(PALETTE.ceiling));
    material.map!.repeat.set(WIDTH / 1.2, DEPTH / 1.2);
    return material;
  }, []);

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
      <mesh material={carpetMat} rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, 0, CENTER_Z]}>
        <planeGeometry args={[WIDTH, DEPTH]} />
      </mesh>

      <mesh material={ceilingMat} rotation={[Math.PI / 2, 0, 0]} position={[CENTER_X, ROOM.ceiling, CENTER_Z]}>
        <planeGeometry args={[WIDTH, DEPTH]} />
      </mesh>
      {/* Light panels sit in slim housings dropped just under the grid, so they
          read as fittings rather than glowing decals. */}
      {ceilingLights.map(([x, z], i) => (
        <group key={i} position={[x, ROOM.ceiling, z]}>
          <mesh material={flatMat(PALETTE.mullion)} position={[0, -0.02, 0]}>
            <boxGeometry args={[1.9, 0.05, 0.6]} />
          </mesh>
          <mesh material={ceilingLightMat} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.047, 0]}>
            <planeGeometry args={[1.8, 0.5]} />
          </mesh>
        </group>
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
      {/* Baseboards ground the two solid walls the way the sills ground the glass. */}
      <mesh material={flatMat(PALETTE.baseboard)} position={[ROOM.minX + 0.03, 0.06, CENTER_Z]}>
        <boxGeometry args={[0.06, 0.12, DEPTH]} />
      </mesh>
      <mesh material={flatMat(PALETTE.baseboard)} position={[CENTER_X, 0.06, ROOM.maxZ - 0.03]}>
        <boxGeometry args={[WIDTH, 0.12, 0.06]} />
      </mesh>

      {/* Dressing on the solid walls: art and a clock behind the player, the
          whiteboard down the left where a glance from the desk lands on it. */}
      <group position={[CENTER_X - 4, 1.9, ROOM.maxZ - 0.06]} rotation={[0, Math.PI, 0]}>
        <WallArt a={PALETTE.artTealA} b={PALETTE.artTealB} />
      </group>
      <group position={[CENTER_X + 4.4, 1.9, ROOM.maxZ - 0.06]} rotation={[0, Math.PI, 0]}>
        <WallArt a={PALETTE.artRustA} b={PALETTE.artRustB} />
      </group>
      <group position={[CENTER_X + 1.1, 2.35, ROOM.maxZ - 0.06]} rotation={[0, Math.PI, 0]}>
        <WallClock />
      </group>
      <group position={[CENTER_X - 1.2, 1.06, ROOM.maxZ - 0.05]} rotation={[0, Math.PI, 0]}>
        <Door />
      </group>
      <group position={[ROOM.minX + 0.05, 1.62, -6]} rotation={[0, Math.PI / 2, 0]}>
        <Whiteboard />
      </group>

      {/* The left wall's working spine: printer island and the cooler. */}
      <group position={[ROOM.minX + 0.42, 0, -1.6]} rotation={[0, Math.PI / 2, 0]}>
        <PrinterStation />
      </group>
      <group position={[ROOM.minX + 0.4, 0, 2.6]}>
        <WaterCooler />
      </group>
      {/* Two people talking at it while the floor is staffed — a bullpen where
          nobody ever gets up reads as a diorama. */}
      {staffed && (
        <>
          <group position={[ROOM.minX + 1.2, 0, 2.3]} rotation={[0, 1.9, 0]}>
            <ContactShadow width={0.8} depth={0.8} opacity={0.5} />
            <StandingCoworker seed={101} holdsCup />
          </group>
          <group position={[ROOM.minX + 1.35, 0, 3.15]} rotation={[0, 2.7, 0]}>
            <ContactShadow width={0.8} depth={0.8} opacity={0.5} />
            <StandingCoworker seed={102} />
          </group>
        </>
      )}

      {[
        [-10.5, -10],
        [-10.5, 2],
        [10.5, -10],
        [10.5, 2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <ContactShadow width={1.3} depth={1.3} opacity={0.45} />
          <mesh material={flatMat(PALETTE.column)} position={[0, ROOM.ceiling / 2, 0]}>
            <boxGeometry args={[0.55, ROOM.ceiling, 0.55]} />
          </mesh>
          {/* Base trim, so the columns meet the carpet the way the walls do. */}
          <mesh material={flatMat(PALETTE.baseboard)} position={[0, 0.07, 0]}>
            <boxGeometry args={[0.62, 0.14, 0.62]} />
          </mesh>
        </group>
      ))}

      {/* Green in the corners the desk grid leaves dead. */}
      <group position={[ROOM.maxX - 1.4, 0, 8.6]}>
        <FloorPlant seed={1} />
      </group>
      <group position={[ROOM.minX + 1.3, 0, -14.6]}>
        <FloorPlant seed={4} />
      </group>

      {desks.map(({ key, x, z, seed }) => (
        <group key={key} position={[x, 0, z]}>
          <Workstation
            seed={seed}
            rotation={(Math.sin(seed * 4.7) - 0.5) * 0.08}
            occupied={staffed && isOccupied(seed)}
          />
        </group>
      ))}
    </group>
  );
}
