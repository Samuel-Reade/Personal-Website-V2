import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import {
  contactShadowTexture,
  flatMat,
  paperTexture,
  seeded,
  texturedMat,
  woodTexture,
} from "./materials";
import { getScreenTexture } from "./screenTexture";
import { Coworker } from "./Coworkers";

/**
 * Non-interactive set dressing. Everything here is built from primitives with
 * deliberately low segment counts — cylinders at 5-8 sides, cones at 5 — so the
 * facets stay visible. Nothing uses smoothed normals; see materials.ts.
 */

export const DESK_WIDTH = 1.9;
export const DESK_DEPTH = 0.85;
export const DESK_HEIGHT = 0.74;
const TOP_THICKNESS = 0.05;

/**
 * The flat-shaded stand-in for a shadow map: a soft dark patch on the carpet
 * under anything with weight. Without these every desk and chair floats a hair
 * above the floor — the patch is most of what "sitting on the ground" looks
 * like once real occlusion is off the table.
 */
export function ContactShadow({
  width,
  depth,
  opacity = 1,
}: {
  width: number;
  depth: number;
  opacity?: number;
}) {
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
    });
    return m;
  }, [opacity]);
  return (
    <mesh material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <planeGeometry args={[width, depth]} />
    </mesh>
  );
}

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
      {/* Grained rather than flat — the top is the closest surface to the
          camera in the whole world, and it was the flattest. */}
      <mesh
        material={texturedMat(`desk:${topColor}`, woodTexture(topColor))}
        position={[0, DESK_HEIGHT - TOP_THICKNESS / 2, 0]}
      >
        <boxGeometry args={[width, TOP_THICKNESS, depth]} />
      </mesh>
      {/* A darker edge band under the slab: the profile every real desktop has,
          and what stops the top reading as a single extruded block. */}
      <mesh material={flatMat(PALETTE.deskEdge)} position={[0, DESK_HEIGHT - TOP_THICKNESS - 0.008, 0]}>
        <boxGeometry args={[width - 0.02, 0.016, depth - 0.02]} />
      </mesh>
      {legs.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={flatMat(PALETTE.deskLeg)} position={[0, legHeight / 2, 0]}>
            <boxGeometry args={[0.055, legHeight, 0.055]} />
          </mesh>
          {/* Levelling foot. */}
          <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.012, 0]}>
            <cylinderGeometry args={[0.038, 0.045, 0.024, 6]} />
          </mesh>
        </group>
      ))}
      {/* Modesty panel — reads as a desk rather than a table from across the floor. */}
      <mesh material={flatMat(topColor)} position={[0, DESK_HEIGHT - 0.28, -depth / 2 + 0.06]}>
        <boxGeometry args={[width - 0.24, 0.34, 0.03]} />
      </mesh>
      {/* Cable tray slung under the back edge, with a drop to the floor. */}
      <mesh material={flatMat(PALETTE.deskLeg)} position={[0.2, DESK_HEIGHT - 0.12, -depth / 2 + 0.12]}>
        <boxGeometry args={[0.7, 0.07, 0.09]} />
      </mesh>
      <mesh material={flatMat(PALETTE.cable)} position={[0.5, (DESK_HEIGHT - 0.14) / 2, -depth / 2 + 0.1]} rotation={[0.14, 0, 0.1]}>
        <cylinderGeometry args={[0.011, 0.011, DESK_HEIGHT - 0.14, 5]} />
      </mesh>
    </group>
  );
}

/** Soft mat under keyboard and mouse — anchors the input cluster as one zone. */
export function DeskMat() {
  return (
    <mesh material={flatMat(PALETTE.deskMat)} position={[0.1, 0.004, 0.22]}>
      <boxGeometry args={[0.98, 0.008, 0.34]} />
    </mesh>
  );
}

interface MonitorProps {
  /** Screens are dark set dressing by default; the player's own carries the copy. */
  lit?: boolean;
  scale?: number;
}

export function Monitor({ lit = false, scale = 1 }: MonitorProps) {
  return (
    <group scale={scale}>
      {/* Slim bezel: the screen fills almost the whole slab, with a chin bar
          below it the way current panels wear one. */}
      <mesh material={flatMat(PALETTE.monitorBody)} position={[0, 0.34, 0]}>
        <boxGeometry args={[0.62, 0.365, 0.028]} />
      </mesh>
      {lit ? (
        // A plane, so the texture maps once across the face instead of onto all
        // six sides of a box. Unlit and untonemapped so the copy stays readable
        // at every time of day rather than dimming with the room.
        <mesh position={[0, 0.345, 0.0165]}>
          <planeGeometry args={[0.58, 0.32]} />
          <meshBasicMaterial map={getScreenTexture()} toneMapped={false} />
        </mesh>
      ) : (
        <mesh material={flatMat(PALETTE.monitorScreen)} position={[0, 0.345, 0.0155]}>
          <boxGeometry args={[0.58, 0.32, 0.004]} />
        </mesh>
      )}
      {/* Webcam nub on the top bezel, and a standby LED on the chin. */}
      <mesh material={flatMat(PALETTE.monitorScreen)} position={[0, 0.516, 0.017]}>
        <cylinderGeometry args={[0.006, 0.006, 0.006, 6]} />
      </mesh>
      <mesh material={flatMat(lit ? PALETTE.ledLit : PALETTE.ledDark)} position={[0.26, 0.172, 0.017]}>
        <boxGeometry args={[0.014, 0.005, 0.004]} />
      </mesh>
      {/* Stand: neck, foot, and the cable falling out of the back. */}
      <mesh material={flatMat(PALETTE.monitorBody)} position={[0, 0.12, -0.01]}>
        <boxGeometry args={[0.05, 0.16, 0.045]} />
      </mesh>
      <mesh material={flatMat(PALETTE.monitorBody)} position={[0, 0.025, 0.02]}>
        <boxGeometry args={[0.28, 0.02, 0.17]} />
      </mesh>
      <mesh material={flatMat(PALETTE.cable)} position={[0.02, 0.15, -0.028]} rotation={[0.25, 0, 0.06]}>
        <cylinderGeometry args={[0.008, 0.008, 0.3, 5]} />
      </mesh>
    </group>
  );
}

export function Keyboard() {
  /** Row depths front-to-back; a spacebar row breaks the front one. */
  const rows = [
    { z: -0.055, depth: 0.026 },
    { z: -0.025, depth: 0.026 },
    { z: 0.005, depth: 0.026 },
    { z: 0.035, depth: 0.026 },
  ];
  return (
    <group>
      <mesh material={flatMat(PALETTE.keyboard)} position={[0, 0.011, 0]} rotation={[-0.045, 0, 0]}>
        <boxGeometry args={[0.46, 0.022, 0.17]} />
      </mesh>
      {/* Keys as row bars rather than 60 caps — the ridged silhouette is what
          reads at arm's length, at four draw calls instead of sixty. */}
      {rows.map((row, i) => (
        <mesh key={i} material={flatMat(PALETTE.keycap)} position={[0, 0.0265 - i * 0.0016, row.z]} rotation={[-0.045, 0, 0]}>
          <boxGeometry args={[0.42, 0.009, row.depth]} />
        </mesh>
      ))}
      <mesh material={flatMat(PALETTE.keycap)} position={[-0.02, 0.0245, 0.066]} rotation={[-0.045, 0, 0]}>
        <boxGeometry args={[0.19, 0.009, 0.024]} />
      </mesh>
      {[-0.15, 0.12].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.keycap)} position={[x + (i ? 0.06 : -0.04), 0.0245, 0.066]} rotation={[-0.045, 0, 0]}>
          <boxGeometry args={[0.08, 0.009, 0.024]} />
        </mesh>
      ))}
    </group>
  );
}

export function Mouse() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.mouse)} position={[0, 0.016, 0]} scale={[1, 0.55, 1.45]}>
        <sphereGeometry args={[0.032, 8, 5]} />
      </mesh>
      {/* Scroll wheel proud of the shell — the one detail that says mouse
          rather than pebble. */}
      <mesh material={flatMat(PALETTE.monitorScreen)} position={[0, 0.03, -0.018]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.006, 8]} />
      </mesh>
    </group>
  );
}

export function Mug() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.mug)} position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.043, 0.037, 0.09, 10]} />
      </mesh>
      {/* The coffee stands a couple of millimetres proud of the rim instead of
          flush with it: its old top face was exactly coplanar with the mug's
          cap, and the two flickered against each other whenever the camera
          moved. Proud, every face is its own surface — and from any angle a
          person actually sees it from, it still reads as a full mug. */}
      <mesh material={flatMat(PALETTE.coffee)} position={[0, 0.0885, 0]}>
        <cylinderGeometry args={[0.036, 0.036, 0.008, 10]} />
      </mesh>
      <mesh material={flatMat(PALETTE.mugBand)} position={[0, 0.022, 0]}>
        <cylinderGeometry args={[0.0405, 0.0385, 0.018, 10]} />
      </mesh>
      <mesh
        material={flatMat(PALETTE.mug)}
        position={[0.052, 0.048, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.024, 0.007, 5, 8]} />
      </mesh>
    </group>
  );
}

export function PottedPlant() {
  const blades: [number, number, number, number][] = [
    // x, z, tilt, height
    [0, 0, 0, 0.16],
    [0.028, 0.012, 0.42, 0.13],
    [-0.026, 0.018, -0.38, 0.12],
    [0.008, -0.03, 0.3, 0.11],
    [-0.014, -0.02, -0.22, 0.14],
    [0.024, -0.014, 0.5, 0.095],
  ];
  return (
    <group>
      <mesh material={flatMat(PALETTE.potTerracotta)} position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.055, 0.042, 0.09, 7]} />
      </mesh>
      {/* Soil proud of the rim, same reasoning as the mug's coffee. */}
      <mesh material={flatMat(PALETTE.soil)} position={[0, 0.0875, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.009, 7]} />
      </mesh>
      {blades.map(([x, z, tilt, h], i) => (
        <mesh
          key={i}
          material={flatMat(i % 2 === 0 ? PALETTE.leafSage : PALETTE.leafSageDark)}
          position={[x, 0.09 + h / 2, z]}
          rotation={[0, i * 1.3, tilt]}
        >
          <coneGeometry args={[0.026, h, 5]} />
        </mesh>
      ))}
    </group>
  );
}

export function Notebook() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.notebookCover)} position={[0, 0.008, 0]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[0.2, 0.016, 0.27]} />
      </mesh>
      <mesh
        material={texturedMat("paper-sheet", paperTexture(PALETTE.paper))}
        position={[0.012, 0.021, 0.01]}
        rotation={[0, -0.18, 0]}
      >
        <boxGeometry args={[0.19, 0.01, 0.26]} />
      </mesh>
      {/* Elastic band holding the cover closed. */}
      <mesh material={flatMat(PALETTE.monitorScreen)} position={[0.055, 0.009, 0]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[0.012, 0.018, 0.272]} />
      </mesh>
    </group>
  );
}

export function Pen() {
  return (
    <group rotation={[0, 0.7, 0]}>
      <mesh material={flatMat(PALETTE.penBody)} position={[0, 0.006, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0045, 0.0045, 0.13, 6]} />
      </mesh>
      <mesh material={flatMat(PALETTE.monitorScreen)} position={[0.072, 0.006, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.0045, 0.016, 6]} />
      </mesh>
    </group>
  );
}

/** A fan of loose printed sheets, each a touch rotated off the pile. */
export function LooseSheets({ seed = 1 }: { seed?: number }) {
  const sheets = [0, 1, 2];
  return (
    <group>
      {sheets.map((i) => (
        <mesh
          key={i}
          material={texturedMat("paper-sheet", paperTexture(PALETTE.paper))}
          position={[(seeded(seed + i * 3) - 0.5) * 0.03, 0.002 + i * 0.0022, (seeded(seed + i * 7) - 0.5) * 0.03]}
          rotation={[0, (seeded(seed + i * 11) - 0.5) * 0.6, 0]}
        >
          <boxGeometry args={[0.19, 0.002, 0.26]} />
        </mesh>
      ))}
    </group>
  );
}

/** Sticky notes for the monitor's chin and the desk — the office's true filing system. */
export function StickyNotes() {
  const notes: { x: number; y: number; z: number; color: string; turn: number }[] = [
    { x: -0.26, y: 0.24, z: 0.02, color: PALETTE.stickyYellow, turn: 0.1 },
    { x: -0.315, y: 0.185, z: 0.02, color: PALETTE.stickyBlue, turn: -0.14 },
  ];
  return (
    <group>
      {notes.map((n, i) => (
        <mesh key={i} material={flatMat(n.color)} position={[n.x, n.y, n.z]} rotation={[0, 0, n.turn]}>
          <planeGeometry args={[0.045, 0.045]} />
        </mesh>
      ))}
    </group>
  );
}

/** Headphones hung on a small stand — the desk of someone who takes calls. */
export function HeadphoneStand() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.004, 0]}>
        <cylinderGeometry args={[0.05, 0.058, 0.008, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.2, 6]} />
      </mesh>
      <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.03, 8]} />
      </mesh>
      {/* Band and cups draped over the rest. */}
      <mesh material={flatMat(PALETTE.headphone)} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.055, 0.009, 5, 10, Math.PI]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={flatMat(PALETTE.headphoneCup)} position={[side * 0.055, 0.152, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.026, 0.024, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/** A phone face-down by the keyboard, the way one actually sits at a desk. */
export function Phone() {
  return (
    <group rotation={[0, -0.3, 0]}>
      <mesh material={flatMat(PALETTE.phoneBody)} position={[0, 0.005, 0]}>
        <boxGeometry args={[0.07, 0.01, 0.145]} />
      </mesh>
      <mesh material={flatMat(PALETTE.monitorScreen)} position={[0, 0.011, -0.045]}>
        <boxGeometry args={[0.032, 0.002, 0.032]} />
      </mesh>
    </group>
  );
}

export function DeskLamp() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.lampArm)} position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.06, 0.068, 0.024, 7]} />
      </mesh>
      {/* Two-segment arm with a visible elbow — an anglepoise rather than a stick. */}
      <mesh material={flatMat(PALETTE.lampArm)} position={[0.028, 0.09, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.009, 0.009, 0.17, 5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.chairFrame)} position={[0.068, 0.163, 0]}>
        <sphereGeometry args={[0.016, 6, 5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.lampArm)} position={[0.1, 0.235, 0]} rotation={[0, 0, 0.42]}>
        <cylinderGeometry args={[0.009, 0.009, 0.16, 5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.lampShade)} position={[0.128, 0.3, 0]} rotation={[0, 0, -1.05]}>
        <coneGeometry args={[0.065, 0.1, 7, 1, true]} />
      </mesh>
      {/* The bulb inside the shade, softly lit at all hours — a lamp that is
          plainly off reads as clutter, and one hard-glowing would fight the
          monitor for the eye. */}
      <mesh position={[0.145, 0.275, 0]}>
        <sphereGeometry args={[0.025, 6, 5]} />
        <meshLambertMaterial
          color={PALETTE.lampBulb}
          emissive={new THREE.Color(PALETTE.lampBulb)}
          emissiveIntensity={0.55}
          flatShading
        />
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
      {/* Waterfall front edge on the seat pad — the front is -Z, the side the
          desk is on. The whole chair is built facing -Z: backrest behind the
          sitter at +Z, leaning away from the desk. It stood reversed for a
          while, backrest between sitter and keyboard, which put every chair on
          the floor with its back to its own desk. */}
      <mesh material={flatMat(PALETTE.chairSeat)} position={[0, 0.435, -0.2]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, 0.42, 6]} />
      </mesh>
      <mesh material={flatMat(PALETTE.chairSeat)} position={[0, 0.7, 0.19]} rotation={[-0.16, 0, 0]}>
        <boxGeometry args={[0.4, 0.44, 0.055]} />
      </mesh>
      {/* Lumbar bar joining back to seat. */}
      <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.52, 0.185]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.06, 0.14, 0.03]} />
      </mesh>
      {/* Armrests. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.235, 0, 0]}>
          <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.53, 0.02]}>
            <boxGeometry args={[0.03, 0.1, 0.03]} />
          </mesh>
          <mesh material={flatMat(PALETTE.chairSeat)} position={[0, 0.59, 0.02]}>
            <boxGeometry args={[0.06, 0.025, 0.22]} />
          </mesh>
        </group>
      ))}
      <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.42, 6]} />
      </mesh>
      {/* Five-star base with casters, in place of the old solid cone. */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh material={flatMat(PALETTE.chairFrame)} position={[0, 0.035, 0.13]} rotation={[-0.12, 0, 0]}>
              <boxGeometry args={[0.035, 0.03, 0.26]} />
            </mesh>
            <mesh material={flatMat(PALETTE.monitorScreen)} position={[0, 0.022, 0.24]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.02, 0.025, 7]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

interface WorkstationProps {
  /** Index into the deterministic jitter, so no two seats look posed alike. */
  seed: number;
  /** Radians the whole workstation is turned by. */
  rotation?: number;
  /** Someone is at this desk — squares the chair up and seats a figure in it. */
  occupied?: boolean;
}

/** A background desk: monitor, keyboard, chair, and a little random clutter. */
export function Workstation({ seed, rotation = 0, occupied = false }: WorkstationProps) {
  const r = (n: number) => {
    const x = Math.sin((seed * 12.9898 + n * 78.233) * 43758.5453);
    return x - Math.floor(x);
  };
  const hasMug = r(1) > 0.45;
  const hasPlant = r(2) > 0.7;
  const hasPapers = r(3) > 0.55;
  const hasHeadphones = r(11) > 0.72;
  const hasPhone = r(12) > 0.5;
  const chairTurn = (r(4) - 0.5) * 1.4;
  const chairSlide = (r(5) - 0.5) * 0.3;

  return (
    <group rotation={[0, rotation, 0]}>
      {/* One grounding patch for the whole station — desk, chair and sitter. */}
      <group position={[0, 0, 0.16]}>
        <ContactShadow width={2.5} depth={2} opacity={0.55} />
      </group>
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
          <LooseSheets seed={seed} />
        </group>
      )}
      {hasHeadphones && (
        <group position={[0.72, DESK_HEIGHT, -0.22]}>
          <HeadphoneStand />
        </group>
      )}
      {hasPhone && (
        <group position={[0.3 + r(13) * 0.1, DESK_HEIGHT, 0.3]} rotation={[0, r(14) * 0.8, 0]}>
          <Phone />
        </group>
      )}
      {/* An empty chair can sit pushed back and turned away; an occupied one is
          squared up and drawn in, because someone is working at it. */}
      {occupied ? (
        <group position={[0, 0, 0.7]}>
          <OfficeChair />
          <Coworker seed={seed} />
        </group>
      ) : (
        <group position={[chairSlide, 0, 0.78]} rotation={[0, chairTurn, 0]}>
          <OfficeChair />
        </group>
      )}
    </group>
  );
}
