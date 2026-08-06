import { useRef, useState, type ReactNode } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { PALETTE } from "./palette";
import { flatMat, glowMat } from "./materials";

/**
 * A soft radial falloff used for the hover halo. A hard-edged disc reads as a
 * decal sitting on the desk; this reads as light pooling under the object.
 */
let haloTexture: THREE.CanvasTexture | null = null;
function getHaloTexture(): THREE.CanvasTexture {
  if (haloTexture) return haloTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.28)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  haloTexture = new THREE.CanvasTexture(canvas);
  return haloTexture;
}

/** Pointer travel past this (in px) counts as a look-drag, not a click. */
const DRAG_SLOP = 6;

interface ClickableProps {
  /** The EXPERIENCE entry this object opens, matched on `org`. */
  org: string;
  position: [number, number, number];
  /** Radius of the hover halo pooled on the desk beneath. */
  haloRadius?: number;
  onHover: (org: string | null) => void;
  children: ReactNode;
}

/**
 * Wraps a figurine with its hover feedback and click target. The scale-up is
 * applied to an inner group so the halo underneath stays put rather than
 * growing with it.
 */
function Clickable({ org, position, haloRadius = 0.11, onHover, children }: ClickableProps) {
  const openEntry = useStore((s) => s.openEntry);
  const { gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const inner = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Mesh>(null!);
  const scale = useRef(1);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  useFrame((_state, delta) => {
    const t = 1 - Math.exp(-14 * delta);
    scale.current = THREE.MathUtils.lerp(scale.current, hovered ? 1.16 : 1, t);
    if (inner.current) {
      inner.current.scale.setScalar(scale.current);
      // Lifts fractionally off the desk as it grows, so the grow reads as the
      // object rising to meet the cursor rather than inflating in place.
      inner.current.position.y = (scale.current - 1) * 0.14;
    }
    if (halo.current) {
      const material = halo.current.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.lerp(material.opacity, hovered ? 0.7 : 0, t);
    }
  });

  return (
    <group
      position={position}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        onHover(org);
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(false);
        onHover(null);
        gl.domElement.style.cursor = "grab";
      }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        pressOrigin.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const origin = pressOrigin.current;
        pressOrigin.current = null;
        // Releasing here after dragging the view across the object is a look,
        // not a click on it.
        if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > DRAG_SLOP) return;
        openEntry("experience", org);
      }}
    >
      <mesh ref={halo} position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[haloRadius, 20]} />
        <meshBasicMaterial
          map={getHaloTexture()}
          color={PALETTE.hoverHalo}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <group ref={inner}>{children}</group>
    </group>
  );
}

/** Popcorn.co — a striped tub with a few kernels heaped over the rim. */
function PopcornBucket() {
  const stripes = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2);
  const kernels: [number, number, number, number][] = [
    [0, 0.125, 0, 0.019],
    [0.028, 0.132, 0.012, 0.016],
    [-0.025, 0.129, 0.018, 0.017],
    [0.012, 0.138, -0.026, 0.015],
    [-0.014, 0.134, -0.022, 0.016],
  ];
  return (
    <group>
      <mesh material={flatMat(PALETTE.popcornBucketCream)} position={[0, 0.058, 0]}>
        <cylinderGeometry args={[0.052, 0.038, 0.115, 8]} />
      </mesh>
      {stripes.map((angle, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.popcornBucketRed)}
          position={[Math.sin(angle) * 0.047, 0.058, Math.cos(angle) * 0.047]}
          rotation={[0, angle, 0.055]}
        >
          <boxGeometry args={[0.022, 0.113, 0.006]} />
        </mesh>
      ))}
      {kernels.map(([x, y, z, r], i) => (
        <mesh key={i} material={flatMat(PALETTE.popcornKernel)} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * DTEX Systems — cybersecurity, so a padlock. Scaled up as a whole rather than
 * by retuning each part: at parity with the others it was the smallest
 * silhouette on the desk, and it now has to hold the far right on its own.
 */
function Padlock() {
  return (
    <group scale={1.45}>
      <mesh material={flatMat(PALETTE.padlockBody)} position={[0, 0.042, 0]}>
        <boxGeometry args={[0.075, 0.075, 0.04]} />
      </mesh>
      <mesh
        material={flatMat(PALETTE.padlockShackle)}
        position={[0, 0.082, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.026, 0.008, 4, 8, Math.PI]} />
      </mesh>
      <mesh material={flatMat(PALETTE.padlockKeyhole)} position={[0, 0.044, 0.021]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.006, 6]} />
      </mesh>
    </group>
  );
}

/** Associated Students, UCLA — the Bruin. */
function BearFigurine() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.bearFur)} position={[0, 0.045, 0]} scale={[1, 0.95, 0.85]}>
        <icosahedronGeometry args={[0.045, 1]} />
      </mesh>
      <mesh material={flatMat(PALETTE.bearFur)} position={[0, 0.104, 0.008]}>
        <icosahedronGeometry args={[0.032, 1]} />
      </mesh>
      <mesh material={flatMat(PALETTE.bearMuzzle)} position={[0, 0.098, 0.032]}>
        <icosahedronGeometry args={[0.015, 0]} />
      </mesh>
      {[-0.026, 0.026].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.bearFurDark)} position={[x, 0.128, 0]}>
          <icosahedronGeometry args={[0.013, 0]} />
        </mesh>
      ))}
      {[-0.026, 0.026].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.bearFurDark)} position={[x, 0.018, 0.03]}>
          <icosahedronGeometry args={[0.016, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** Innovius Capital — a banded stack of notes. */
function CashStack() {
  const notes = [0, 1, 2, 3, 4];
  return (
    <group>
      {notes.map((i) => (
        <mesh
          key={i}
          material={flatMat(i % 2 === 0 ? PALETTE.cashNote : PALETTE.cashNoteAlt)}
          position={[(i - 2) * 0.004, 0.007 + i * 0.011, (i - 2) * 0.003]}
          rotation={[0, (i - 2) * 0.07, 0]}
        >
          <boxGeometry args={[0.115, 0.011, 0.058]} />
        </mesh>
      ))}
      <mesh material={flatMat(PALETTE.cashBand)} position={[0, 0.032, 0]}>
        <boxGeometry args={[0.026, 0.062, 0.066]} />
      </mesh>
    </group>
  );
}

/** Turner & Townsend — a model tower. */
function Skyscraper() {
  const bands = [0.055, 0.1, 0.145];
  return (
    <group>
      <mesh material={flatMat(PALETTE.towerBody)} position={[0, 0.09, 0]}>
        <boxGeometry args={[0.058, 0.18, 0.058]} />
      </mesh>
      <mesh material={flatMat(PALETTE.towerBodyAlt)} position={[0, 0.212, 0]}>
        <boxGeometry args={[0.04, 0.065, 0.04]} />
      </mesh>
      <mesh material={flatMat(PALETTE.towerBodyAlt)} position={[0, 0.262, 0]}>
        <coneGeometry args={[0.014, 0.036, 5]} />
      </mesh>
      {/* Emissive, so the window bands read as lit floors rather than darker
          stripes cut into the tower — the whole point of it being brighter. */}
      {bands.map((y, i) => (
        <mesh key={i} material={glowMat(PALETTE.towerWindow, 0.55)} position={[0, y, 0]}>
          <boxGeometry args={[0.061, 0.016, 0.061]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Where each figurine sits on the desk, listed in the left-to-right order they
 * appear in. Spread between the keyboard and the monitor: far enough apart that
 * none crowds another, close enough to the centre that all five sit inside the
 * seated view without the player having to look around to find them.
 *
 * The z values alternate rather than curving, which is what buys the spacing —
 * neighbours are offset in depth as well as across, so they read as separate
 * even where their silhouettes overlap from the seated angle.
 */
const LAYOUT: {
  org: string;
  position: [number, number, number];
  haloRadius: number;
  Figurine: () => JSX.Element;
}[] = [
  { org: "Associated Students, UCLA", position: [-0.57, 0, -0.05], haloRadius: 0.1, Figurine: BearFigurine },
  { org: "Popcorn.co", position: [-0.29, 0, -0.13], haloRadius: 0.1, Figurine: PopcornBucket },
  { org: "Turner & Townsend", position: [0, 0, -0.05], haloRadius: 0.1, Figurine: Skyscraper },
  { org: "Innovius Capital", position: [0.29, 0, -0.13], haloRadius: 0.1, Figurine: CashStack },
  { org: "DTEX Systems", position: [0.57, 0, -0.05], haloRadius: 0.13, Figurine: Padlock },
];

interface FigurinesProps {
  onHover: (org: string | null) => void;
}

/** The five clickable objects on the player's own desk. */
export function Figurines({ onHover }: FigurinesProps) {
  return (
    <>
      {LAYOUT.map(({ org, position, haloRadius, Figurine }) => (
        <Clickable key={org} org={org} position={position} haloRadius={haloRadius} onHover={onHover}>
          <Figurine />
        </Clickable>
      ))}
    </>
  );
}
