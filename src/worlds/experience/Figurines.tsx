import { useRef, useState, type ReactNode } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { PALETTE } from "./palette";
import { flatMat, glowMat, haloTexture, texturedMat } from "./materials";
import { getScreenTarget, isScreenCursorHeld } from "./screenTexture";

/**
 * Figurine-local canvas textures, built lazily like the halo above. Two places
 * where paint beats geometry: the bucket's stripes (boxes tangent to a cylinder
 * always show their seams) and the cash stack's note edges (forty real notes
 * would be forty boxes for a detail one stripe pattern carries).
 */
let stripeTexture: THREE.CanvasTexture | null = null;
function getStripeTexture(): THREE.CanvasTexture {
  if (stripeTexture) return stripeTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 8;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = PALETTE.popcornBucketCream;
  ctx.fillRect(0, 0, 160, 8);
  ctx.fillStyle = PALETTE.popcornBucketRed;
  // Ten stripes over the wrap: even red/cream, drawn once around the seam.
  for (let i = 0; i < 10; i += 2) ctx.fillRect(i * 16, 0, 16, 8);
  stripeTexture = new THREE.CanvasTexture(canvas);
  stripeTexture.colorSpace = THREE.SRGBColorSpace;
  return stripeTexture;
}

let cashEdgeTexture: THREE.CanvasTexture | null = null;
function getCashEdgeTexture(): THREE.CanvasTexture {
  if (cashEdgeTexture) return cashEdgeTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = PALETTE.cashNote;
  ctx.fillRect(0, 0, 64, 64);
  // The ruled edges of a wad of notes, with a little waver so the pile reads
  // as counted out rather than machined.
  for (let y = 2; y < 64; y += 4) {
    ctx.strokeStyle = y % 8 === 2 ? "rgba(60, 84, 56, 0.5)" : "rgba(240, 246, 236, 0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 3.1) * 0.8);
    ctx.lineTo(64, y + Math.cos(y * 2.3) * 0.8);
    ctx.stroke();
  }
  cashEdgeTexture = new THREE.CanvasTexture(canvas);
  cashEdgeTexture.colorSpace = THREE.SRGBColorSpace;
  return cashEdgeTexture;
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
    // Lit two ways, to the same effect: the pointer resting on the object, or
    // the monitor's own cursor resting on that object's row. The second is the
    // index read backwards — pick a name on screen and the thing it stands for
    // answers on the desk.
    const lit = hovered || getScreenTarget() === org;
    const t = 1 - Math.exp(-14 * delta);
    scale.current = THREE.MathUtils.lerp(scale.current, lit ? 1.16 : 1, t);
    if (inner.current) {
      inner.current.scale.setScalar(scale.current);
      // Lifts fractionally off the desk as it grows, so the grow reads as the
      // object rising to meet the cursor rather than inflating in place.
      inner.current.position.y = (scale.current - 1) * 0.14;
    }
    if (halo.current) {
      const material = halo.current.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.lerp(material.opacity, lit ? 0.7 : 0, t);
    }
  });

  return (
    <group
      position={position}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        // While the desk mouse is held the pointer is driving the screen, and
        // the ray sweeping over a figurine on the way is not a hover — letting
        // it through would swap the index for a record mid-drag.
        if (isScreenCursorHeld()) return;
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
        if (isScreenCursorHeld()) return;
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
          map={haloTexture()}
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

/** Popcorn.co — a striped tub heaped over the rim, with a couple of strays. */
function PopcornBucket() {
  // Two courses of kernels: a packed ring at the rim and a looser crown on
  // top, so the fill reads as a mound rather than as balls on a plate.
  const ring = Array.from({ length: 7 }, (_, i) => {
    const angle = (i / 7) * Math.PI * 2 + 0.4;
    return [Math.sin(angle) * 0.034, 0.124 + (i % 3) * 0.004, Math.cos(angle) * 0.034, 0.017 + (i % 2) * 0.003] as const;
  });
  const crown: readonly [number, number, number, number][] = [
    [0, 0.148, 0, 0.019],
    [0.02, 0.142, -0.014, 0.015],
    [-0.019, 0.14, 0.012, 0.016],
    [0.004, 0.138, 0.022, 0.014],
  ];
  return (
    <group>
      {/* Stripes are paint, not tangent boxes — a wrapped texture keeps them
          true to the taper with no seams at the facets. */}
      <mesh material={texturedMat("popcorn-stripes", getStripeTexture())} position={[0, 0.058, 0]}>
        <cylinderGeometry args={[0.054, 0.038, 0.115, 12, 1, true]} />
      </mesh>
      {/* Solid liner inside the open-ended stripe wall: its top cap is the
          cream fill line a look into the mouth lands on, and without it the
          single-sided wall would be see-through from above. */}
      <mesh material={flatMat(PALETTE.popcornBucketCream)} position={[0, 0.057, 0]}>
        <cylinderGeometry args={[0.05, 0.037, 0.108, 12]} />
      </mesh>
      {/* Rolled rim. */}
      <mesh material={flatMat(PALETTE.popcornBucketCream)} position={[0, 0.115, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.054, 0.0055, 5, 12]} />
      </mesh>
      {[...ring, ...crown].map(([x, y, z, r], i) => (
        <mesh
          key={i}
          material={flatMat(i % 3 === 2 ? PALETTE.paperAlt : PALETTE.popcornKernel)}
          position={[x, y, z]}
          rotation={[i * 1.1, i * 0.7, 0]}
        >
          <icosahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
      {/* Two that didn't make it to the mouth. */}
      <mesh material={flatMat(PALETTE.popcornKernel)} position={[0.075, 0.012, 0.03]} rotation={[0.8, 0.3, 0]}>
        <icosahedronGeometry args={[0.013, 0]} />
      </mesh>
      <mesh material={flatMat(PALETTE.paperAlt)} position={[-0.068, 0.011, -0.02]} rotation={[0.2, 1.4, 0]}>
        <icosahedronGeometry args={[0.011, 0]} />
      </mesh>
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
      {/* Body with softened shoulders: a main slab plus a slightly narrower
          crown, so the top edge steps the way a cast lock body does. */}
      <mesh material={flatMat(PALETTE.padlockBody)} position={[0, 0.038, 0]}>
        <boxGeometry args={[0.082, 0.068, 0.042]} />
      </mesh>
      <mesh material={flatMat(PALETTE.padlockBody)} position={[0, 0.075, 0]}>
        <boxGeometry args={[0.07, 0.012, 0.036]} />
      </mesh>
      {/* Face plate, a shade off the body, carrying the keyway. */}
      <mesh material={flatMat(PALETTE.padlockShackle)} position={[0, 0.038, 0.0215]}>
        <boxGeometry args={[0.06, 0.048, 0.004]} />
      </mesh>
      {/* Shackle: a true U — the arc, two straight legs, and the collars where
          they enter the body. The old half-torus floated with no way in.
          Left in the torus's own XY plane, which stands the arc up over the
          body: turned a quarter into XZ, as it was, the arc lay flat across the
          top and the lock read from the front as a slab with two studs. */}
      <mesh material={flatMat(PALETTE.padlockShackle)} position={[0, 0.106, 0]}>
        <torusGeometry args={[0.027, 0.0085, 5, 12, Math.PI]} />
      </mesh>
      {[-0.027, 0.027].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.padlockShackle)} position={[x, 0.093, 0]}>
          <cylinderGeometry args={[0.0085, 0.0085, 0.026, 6]} />
        </mesh>
      ))}
      {[-0.027, 0.027].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.padlockKeyhole)} position={[x, 0.0815, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.008, 6]} />
        </mesh>
      ))}
      {/* Keyhole: the round head and the slot dropping out of it. */}
      <mesh material={flatMat(PALETTE.padlockKeyhole)} position={[0, 0.046, 0.0245]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0075, 0.0075, 0.005, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.padlockKeyhole)} position={[0, 0.033, 0.0245]}>
        <boxGeometry args={[0.006, 0.018, 0.005]} />
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

/** One banded wad: striped edges, a clean top note with its centre mark, a band. */
function CashWad({ height }: { height: number }) {
  return (
    <group>
      {/* The pile itself wears the note-edge texture — forty notes of detail
          on one box. */}
      <mesh material={texturedMat("cash-edges", getCashEdgeTexture())} position={[0, height / 2, 0]}>
        <boxGeometry args={[0.115, height, 0.058]} />
      </mesh>
      {/* The top note lies flat and printed rather than striped. */}
      <mesh material={flatMat(PALETTE.cashNoteAlt)} position={[0, height + 0.0015, 0]}>
        <boxGeometry args={[0.115, 0.003, 0.058]} />
      </mesh>
      <mesh material={flatMat(PALETTE.cashNote)} position={[0, height + 0.0035, 0]}>
        <boxGeometry args={[0.036, 0.002, 0.026]} />
      </mesh>
      <mesh material={flatMat(PALETTE.cashBand)} position={[0, height / 2, 0]}>
        <boxGeometry args={[0.024, height + 0.007, 0.062]} />
      </mesh>
    </group>
  );
}

/** Innovius Capital — banded wads crossed the way counted money is stacked. */
function CashStack() {
  return (
    <group>
      <CashWad height={0.042} />
      <group position={[0.004, 0.045, -0.002]} rotation={[0, Math.PI / 2 - 0.16, 0]}>
        <CashWad height={0.03} />
      </group>
      {/* Two loose notes slid off the pile. */}
      <mesh material={flatMat(PALETTE.cashNoteAlt)} position={[0.082, 0.001, 0.032]} rotation={[0, -0.5, 0]}>
        <boxGeometry args={[0.115, 0.002, 0.058]} />
      </mesh>
      <mesh material={flatMat(PALETTE.cashNote)} position={[-0.072, 0.001, -0.024]} rotation={[0, 0.35, 0]}>
        <boxGeometry args={[0.115, 0.002, 0.058]} />
      </mesh>
    </group>
  );
}

/**
 * Turner & Townsend — a model tower in three setback tiers, each stepped in
 * from the one below with a cornice at the shoulder, corner piers up the
 * shaft, and lit floors banding every tier. A construction consultancy's
 * paperweight, not a chess piece.
 */
function Skyscraper() {
  return (
    // Scaled so the mast tops out where the old cone did — the tiers bought
    // height, and unscaled the beacon stood in front of the monitor's copy.
    <group scale={0.82}>
      {/* Plinth and entrance. */}
      <mesh material={flatMat(PALETTE.towerBodyAlt)} position={[0, 0.007, 0]}>
        <boxGeometry args={[0.092, 0.014, 0.092]} />
      </mesh>
      <mesh material={glowMat(PALETTE.towerWindow, 0.55)} position={[0, 0.026, 0.0335]}>
        <boxGeometry args={[0.024, 0.026, 0.004]} />
      </mesh>
      <mesh material={flatMat(PALETTE.towerBodyAlt)} position={[0, 0.042, 0.037]}>
        <boxGeometry args={[0.036, 0.005, 0.012]} />
      </mesh>

      {/* Tier one, with piers up its corners. */}
      <mesh material={flatMat(PALETTE.towerBody)} position={[0, 0.089, 0]}>
        <boxGeometry args={[0.064, 0.15, 0.064]} />
      </mesh>
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} material={flatMat(PALETTE.towerBodyAlt)} position={[sx * 0.031, 0.089, sz * 0.031]}>
          <boxGeometry args={[0.008, 0.15, 0.008]} />
        </mesh>
      ))}
      {[0.045, 0.082, 0.119].map((y, i) => (
        <mesh key={i} material={glowMat(PALETTE.towerWindow, 0.55)} position={[0, y, 0]}>
          <boxGeometry args={[0.066, 0.013, 0.066]} />
        </mesh>
      ))}
      {/* Cornice at the first shoulder. */}
      <mesh material={flatMat(PALETTE.towerBodyAlt)} position={[0, 0.167, 0]}>
        <boxGeometry args={[0.07, 0.006, 0.07]} />
      </mesh>

      {/* Tier two. */}
      <mesh material={flatMat(PALETTE.towerBody)} position={[0, 0.208, 0]}>
        <boxGeometry args={[0.048, 0.076, 0.048]} />
      </mesh>
      {[0.192, 0.224].map((y, i) => (
        <mesh key={i} material={glowMat(PALETTE.towerWindow, 0.55)} position={[0, y, 0]}>
          <boxGeometry args={[0.05, 0.011, 0.05]} />
        </mesh>
      ))}
      <mesh material={flatMat(PALETTE.towerBodyAlt)} position={[0, 0.249, 0]}>
        <boxGeometry args={[0.054, 0.005, 0.054]} />
      </mesh>

      {/* Tier three and the crown: cap, spire, and a mast with its beacon. */}
      <mesh material={flatMat(PALETTE.towerBody)} position={[0, 0.276, 0]}>
        <boxGeometry args={[0.034, 0.05, 0.034]} />
      </mesh>
      <mesh material={glowMat(PALETTE.towerWindow, 0.55)} position={[0, 0.276, 0]}>
        <boxGeometry args={[0.036, 0.01, 0.036]} />
      </mesh>
      <mesh material={flatMat(PALETTE.towerBodyAlt)} position={[0, 0.305, 0]}>
        <boxGeometry args={[0.024, 0.01, 0.024]} />
      </mesh>
      <mesh material={flatMat(PALETTE.towerBodyAlt)} position={[0, 0.322, 0]}>
        <coneGeometry args={[0.011, 0.026, 4]} />
      </mesh>
      <mesh material={flatMat(PALETTE.padlockKeyhole)} position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.0022, 0.0022, 0.032, 4]} />
      </mesh>
      <mesh material={glowMat(PALETTE.popcornBucketRed, 0.8)} position={[0, 0.368, 0]}>
        <sphereGeometry args={[0.0045, 5, 4]} />
      </mesh>
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
