import { useRef, useState, type ReactNode } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { OBJECTS, TIER_Y, type InterestId } from "./layout";

/**
 * The ten clickable objects, one per interest. Each is a handful of primitives
 * with deliberately low segment counts — cylinders at 6-8 sides, cones at 5 — so
 * the facets stay visible at the distance the fixed camera sits from them.
 *
 * Everything is modelled standing on y = 0 and placed onto its tier by the
 * layout, so each piece can be reasoned about on its own.
 */

/**
 * A soft radial falloff for the hover halo. A hard-edged disc reads as a decal
 * stuck to the board; this reads as light pooling under the object.
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
  /** The INTERESTS entry this object opens, matched on `label`. */
  label: string;
  haloRadius: number;
  onHover: (label: string | null) => void;
  children: ReactNode;
}

/**
 * Wraps an object with its hover feedback and click target — the same treatment
 * the office desk's figurines get, so the two scenes behave identically. The
 * scale-up is applied to an inner group so the halo underneath stays put rather
 * than growing with it.
 */
function Clickable({ label, haloRadius, onHover, children }: ClickableProps) {
  const openEntry = useStore((s) => s.openEntry);
  const { gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const inner = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Mesh>(null!);
  const scale = useRef(1);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  useFrame((_state, delta) => {
    const t = 1 - Math.exp(-14 * delta);
    scale.current = THREE.MathUtils.lerp(scale.current, hovered ? 1.14 : 1, t);
    if (inner.current) {
      inner.current.scale.setScalar(scale.current);
      // Lifts fractionally off the board as it grows, so the grow reads as the
      // object rising to meet the cursor rather than inflating in place.
      inner.current.position.y = (scale.current - 1) * 0.16;
    }
    if (halo.current) {
      const material = halo.current.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.lerp(material.opacity, hovered ? 0.7 : 0, t);
    }
  });

  return (
    <group
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        onHover(label);
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
        openEntry("interests", label);
      }}
    >
      <mesh ref={halo} position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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

/** Travel — a globe on a stand, tilted on its axis the way a real one is. */
function Globe() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.globeStand)} position={[0, 0.014, 0]}>
        <cylinderGeometry args={[0.072, 0.085, 0.028, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.globeStand)} position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.09, 6]} />
      </mesh>
      <group position={[0, 0.185, 0]} rotation={[0, 0, 0.41]}>
        {/* Meridian ring, open at the top so the sphere reads as held in it. */}
        <mesh material={flatMat(PALETTE.globeStand)} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.108, 0.008, 4, 14, Math.PI * 1.45]} />
        </mesh>
        <mesh material={flatMat(PALETTE.globeSea)}>
          <icosahedronGeometry args={[0.095, 1]} />
        </mesh>
        {/* Landmasses as flattened patches rather than painted detail. */}
        {[
          [0.05, 0.03, 0.075, 1.1],
          [-0.06, -0.02, 0.062, 0.8],
          [0.01, 0.075, 0.05, 0.7],
        ].map(([x, y, z, s], i) => (
          <mesh
            key={i}
            material={flatMat(PALETTE.globeLand)}
            position={[x, y, z]}
            scale={[s, s * 0.8, 0.35]}
          >
            <icosahedronGeometry args={[0.05, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Skiing — a pair of skis and poles, leaning back against the shelf. */
function Skis() {
  return (
    <group rotation={[0.16, 0, 0]}>
      {[-0.035, 0.035].map((x, i) => (
        <group key={i} position={[x, 0, 0]} rotation={[0, 0, i === 0 ? 0.05 : -0.03]}>
          <mesh material={flatMat(PALETTE.skiTop)} position={[0, 0.24, 0]}>
            <boxGeometry args={[0.045, 0.48, 0.014]} />
          </mesh>
          {/* Upturned tip: a short section kicked forward at the top. */}
          <mesh material={flatMat(PALETTE.skiTop)} position={[0, 0.5, 0.018]} rotation={[0.6, 0, 0]}>
            <boxGeometry args={[0.045, 0.075, 0.014]} />
          </mesh>
          <mesh material={flatMat(PALETTE.skiBase)} position={[0, 0.2, 0.012]}>
            <boxGeometry args={[0.048, 0.06, 0.012]} />
          </mesh>
        </group>
      ))}
      {[-0.1, 0.1].map((x, i) => (
        <group key={i} position={[x, 0, -0.02]} rotation={[0, 0, i === 0 ? 0.08 : -0.06]}>
          <mesh material={flatMat(PALETTE.poleShaft)} position={[0, 0.23, 0]}>
            <cylinderGeometry args={[0.007, 0.005, 0.46, 5]} />
          </mesh>
          <mesh material={flatMat(PALETTE.poleGrip)} position={[0, 0.475, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.06, 6]} />
          </mesh>
          {/* Basket near the tip */}
          <mesh material={flatMat(PALETTE.poleGrip)} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.026, 0.026, 0.008, 7]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Ancient History — a fluted column with a fallen fragment beside it. */
function Column() {
  const flutes = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
  return (
    <group>
      <mesh material={flatMat(PALETTE.stoneShadow)} position={[0, 0.018, 0]}>
        <boxGeometry args={[0.13, 0.036, 0.13]} />
      </mesh>
      <mesh material={flatMat(PALETTE.stone)} position={[0, 0.046, 0]}>
        <cylinderGeometry args={[0.052, 0.056, 0.022, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.stone)} position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.043, 0.048, 0.29, 8]} />
      </mesh>
      {/* Fluting: shallow ribs standing off the shaft. */}
      {flutes.map((angle, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.stoneShadow)}
          position={[Math.cos(angle) * 0.045, 0.2, Math.sin(angle) * 0.045]}
          rotation={[0, -angle, 0]}
        >
          <boxGeometry args={[0.008, 0.28, 0.014]} />
        </mesh>
      ))}
      {/* Capital, broken off square — an intact column reads as a candlestick. */}
      <mesh material={flatMat(PALETTE.stone)} position={[0, 0.356, 0]}>
        <cylinderGeometry args={[0.056, 0.046, 0.026, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.stone)} position={[0, 0.376, 0]} rotation={[0, 0.2, 0.05]}>
        <boxGeometry args={[0.115, 0.02, 0.115]} />
      </mesh>
      {/* Fragment on the board */}
      <mesh
        material={flatMat(PALETTE.stoneShadow)}
        position={[0.1, 0.022, 0.05]}
        rotation={[0.3, 0.6, 1.5]}
      >
        <cylinderGeometry args={[0.028, 0.03, 0.06, 7]} />
      </mesh>
    </group>
  );
}

/**
 * One Piece — a straw hat beside a small treasure chest. A generic
 * pirate-adventure motif on purpose: no character, insignia or logo.
 */
function StrawHatAndChest() {
  return (
    <group>
      {/* Hat, resting on its brim and tipped slightly. */}
      <group position={[-0.09, 0, 0.02]} rotation={[0.1, 0.3, -0.06]}>
        <mesh material={flatMat(PALETTE.straw)} position={[0, 0.018, 0]}>
          <cylinderGeometry args={[0.115, 0.125, 0.012, 12]} />
        </mesh>
        <mesh material={flatMat(PALETTE.straw)} position={[0, 0.052, 0]}>
          <cylinderGeometry args={[0.058, 0.07, 0.062, 10]} />
        </mesh>
        <mesh material={flatMat(PALETTE.strawBand)} position={[0, 0.034, 0]}>
          <cylinderGeometry args={[0.072, 0.072, 0.016, 10]} />
        </mesh>
        <mesh material={flatMat(PALETTE.straw)} position={[0, 0.082, 0]}>
          <cylinderGeometry args={[0.056, 0.058, 0.006, 10]} />
        </mesh>
      </group>

      {/* Chest, lid ajar. */}
      <group position={[0.1, 0, -0.01]} rotation={[0, -0.24, 0]}>
        <mesh material={flatMat(PALETTE.chestWood)} position={[0, 0.048, 0]}>
          <boxGeometry args={[0.17, 0.096, 0.115]} />
        </mesh>
        {[-0.05, 0.05].map((x, i) => (
          <mesh key={i} material={flatMat(PALETTE.chestIron)} position={[x, 0.048, 0]}>
            <boxGeometry args={[0.014, 0.1, 0.119]} />
          </mesh>
        ))}
        {/* Barrel lid, hinged open at the back. */}
        <group position={[0, 0.096, -0.057]} rotation={[-0.75, 0, 0]}>
          <mesh material={flatMat(PALETTE.chestWood)} position={[0, 0, 0.057]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.058, 0.058, 0.17, 8, 1, false, 0, Math.PI]} />
          </mesh>
        </group>
        <mesh material={flatMat(PALETTE.chestGold)} position={[0, 0.086, 0.06]}>
          <boxGeometry args={[0.03, 0.026, 0.008]} />
        </mesh>
        {/* A little of what is inside, showing over the rim. */}
        {[
          [-0.03, 0.1, 0.01],
          [0.02, 0.104, -0.01],
          [0.05, 0.098, 0.02],
        ].map(([x, y, z], i) => (
          <mesh key={i} material={flatMat(PALETTE.chestGold)} position={[x, y, z]}>
            <icosahedronGeometry args={[0.021, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Reading — a stack of books with one lying open across the top. */
function BookStack() {
  const stack = [
    { h: 0.032, w: 0.19, d: 0.135, color: PALETTE.bookB, turn: 0 },
    { h: 0.028, w: 0.175, d: 0.125, color: PALETTE.bookA, turn: 0.14 },
    { h: 0.034, w: 0.185, d: 0.13, color: PALETTE.bookC, turn: -0.1 },
  ];
  let y = 0;
  const placed = stack.map((book) => {
    const at = y + book.h / 2;
    y += book.h;
    return { ...book, y: at };
  });

  return (
    <group>
      {placed.map((book, i) => (
        <group key={i} rotation={[0, book.turn, 0]}>
          <mesh material={flatMat(book.color)} position={[0, book.y, 0]}>
            <boxGeometry args={[book.w, book.h, book.d]} />
          </mesh>
          <mesh material={flatMat(PALETTE.bookPages)} position={[0.004, book.y, 0]}>
            <boxGeometry args={[book.w * 0.94, book.h * 0.68, book.d * 1.01]} />
          </mesh>
        </group>
      ))}

      {/* Open book: two leaves tented over the stack, spine along the middle. */}
      <group position={[0, y + 0.012, 0]} rotation={[0, 0.28, 0]}>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            material={flatMat(PALETTE.bookPages)}
            position={[side * 0.052, 0.012, 0]}
            rotation={[0, 0, side * 0.17]}
          >
            <boxGeometry args={[0.105, 0.008, 0.13]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.openBook)} position={[0, 0.004, 0]}>
          <boxGeometry args={[0.03, 0.01, 0.132]} />
        </mesh>
      </group>
    </group>
  );
}

/** Film — a reel standing on edge, leaning, with a loose loop of film. */
function FilmReel() {
  return (
    <group rotation={[0, 0, 0.12]}>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={flatMat(PALETTE.reelMetal)}
          position={[side * 0.026, 0.115, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.112, 0.112, 0.01, 12]} />
        </mesh>
      ))}
      {/* Hub */}
      <mesh material={flatMat(PALETTE.reelDark)} position={[0, 0.115, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.052, 8]} />
      </mesh>
      {/* Wound film between the flanges */}
      <mesh material={flatMat(PALETTE.filmStrip)} position={[0, 0.115, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.096, 0.096, 0.044, 12]} />
      </mesh>
      {/* Spokes, cut through the flange so it reads as a reel not a disc. */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI;
        return [-1, 1].map((side) => (
          <mesh
            key={`${i}-${side}`}
            material={flatMat(PALETTE.reelDark)}
            position={[side * 0.027, 0.115, 0]}
            rotation={[angle, 0, Math.PI / 2]}
          >
            <boxGeometry args={[0.012, 0.012, 0.18]} />
          </mesh>
        ));
      })}
      {/* A tail of film spilling onto the board. */}
      <mesh material={flatMat(PALETTE.filmStrip)} position={[0.1, 0.012, 0.05]} rotation={[0, 0.5, 0.1]}>
        <boxGeometry args={[0.16, 0.006, 0.03]} />
      </mesh>
    </group>
  );
}

/** Stellar Masses — a small refractor on a tripod, tilted at the sky. */
function Telescope() {
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2 + 0.4;
        return (
          <mesh
            key={i}
            material={flatMat(PALETTE.scopeTripod)}
            position={[Math.cos(angle) * 0.05, 0.11, Math.sin(angle) * 0.05]}
            rotation={[Math.sin(angle) * 0.4, 0, -Math.cos(angle) * 0.4]}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.24, 5]} />
          </mesh>
        );
      })}
      <mesh material={flatMat(PALETTE.scopeBrass)} position={[0, 0.235, 0]}>
        <cylinderGeometry args={[0.026, 0.03, 0.038, 7]} />
      </mesh>
      {/* Tube, on an equatorial tilt. */}
      <group position={[0, 0.27, 0]} rotation={[-0.62, 0.3, 0]}>
        <mesh material={flatMat(PALETTE.scopeTube)}>
          <cylinderGeometry args={[0.031, 0.036, 0.29, 8]} />
        </mesh>
        <mesh material={flatMat(PALETTE.scopeBrass)} position={[0, 0.153, 0]}>
          <cylinderGeometry args={[0.038, 0.034, 0.022, 8]} />
        </mesh>
        <mesh material={flatMat(PALETTE.scopeBrass)} position={[0, -0.152, 0]}>
          <cylinderGeometry args={[0.02, 0.024, 0.03, 8]} />
        </mesh>
        {/* Finder scope riding on the tube. */}
        <mesh material={flatMat(PALETTE.scopeBrass)} position={[0.042, 0.05, 0]} rotation={[0, 0, -0.06]}>
          <cylinderGeometry args={[0.011, 0.012, 0.1, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/** Sports — a two-handled cup on a plinth. Reads clearer than a ball, which at this scale is just a sphere. */
function Trophy() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.trophyBase)} position={[0, 0.022, 0]}>
        <boxGeometry args={[0.115, 0.044, 0.115]} />
      </mesh>
      <mesh material={flatMat(PALETTE.trophyBase)} position={[0, 0.052, 0]}>
        <boxGeometry args={[0.09, 0.02, 0.09]} />
      </mesh>
      <mesh material={flatMat(PALETTE.trophyGold)} position={[0, 0.082, 0]}>
        <cylinderGeometry args={[0.014, 0.03, 0.042, 8]} />
      </mesh>
      {/* Bowl: a cone opening upward, capped by a rim. */}
      <mesh material={flatMat(PALETTE.trophyGold)} position={[0, 0.138, 0]}>
        <cylinderGeometry args={[0.062, 0.022, 0.075, 10]} />
      </mesh>
      <mesh material={flatMat(PALETTE.trophyGold)} position={[0, 0.178, 0]}>
        <cylinderGeometry args={[0.066, 0.062, 0.012, 10]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={flatMat(PALETTE.trophyGold)}
          position={[side * 0.072, 0.142, 0]}
          rotation={[Math.PI / 2, 0, side * -0.3]}
        >
          <torusGeometry args={[0.028, 0.007, 4, 8, Math.PI * 1.1]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * LEGO — a few generic interlocking bricks, stacked off-square. Plain studded
 * blocks: no branding, no logo on the studs.
 */
function Bricks() {
  const bricks: { w: number; d: number; color: string; turn: number; x: number; z: number }[] = [
    { w: 0.13, d: 0.085, color: PALETTE.brickRed, turn: 0, x: 0, z: 0 },
    { w: 0.105, d: 0.085, color: PALETTE.brickBlue, turn: 0.18, x: 0.008, z: 0.004 },
    { w: 0.085, d: 0.062, color: PALETTE.brickYellow, turn: -0.12, x: -0.012, z: -0.006 },
  ];
  const BRICK_H = 0.042;
  const STUD_PITCH = 0.043;

  return (
    <group>
      {bricks.map((brick, i) => {
        const y = i * BRICK_H;
        const studCols = Math.max(1, Math.round(brick.w / STUD_PITCH));
        const studRows = Math.max(1, Math.round(brick.d / STUD_PITCH));
        return (
          <group key={i} position={[brick.x, y, brick.z]} rotation={[0, brick.turn, 0]}>
            <mesh material={flatMat(brick.color)} position={[0, BRICK_H / 2, 0]}>
              <boxGeometry args={[brick.w, BRICK_H, brick.d]} />
            </mesh>
            {Array.from({ length: studCols }, (_, c) =>
              Array.from({ length: studRows }, (_, r) => (
                <mesh
                  key={`${c}-${r}`}
                  material={flatMat(brick.color)}
                  position={[
                    (c - (studCols - 1) / 2) * STUD_PITCH,
                    BRICK_H + 0.006,
                    (r - (studRows - 1) / 2) * STUD_PITCH,
                  ]}
                >
                  <cylinderGeometry args={[0.013, 0.013, 0.012, 8]} />
                </mesh>
              ))
            )}
          </group>
        );
      })}
      {/* One loose brick on the board, so the stack reads as mid-build. */}
      <group position={[0.115, 0, 0.06]} rotation={[0, 0.7, 0]}>
        <mesh material={flatMat(PALETTE.brickGreen)} position={[0, BRICK_H / 2, 0]}>
          <boxGeometry args={[0.085, BRICK_H, 0.062]} />
        </mesh>
        {[-1, 1].map((c) => (
          <mesh
            key={c}
            material={flatMat(PALETTE.brickGreen)}
            position={[c * 0.021, BRICK_H + 0.006, 0]}
          >
            <cylinderGeometry args={[0.013, 0.013, 0.012, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Archery — a recurve bow leaning against a quiver of arrows. */
function BowAndQuiver() {
  return (
    <group>
      {/* Bow, standing on one limb tip and leaning back. */}
      <group position={[-0.05, 0, 0]} rotation={[0.14, 0, 0.06]}>
        <mesh material={flatMat(PALETTE.bowWood)} position={[0, 0.25, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.2, 0.009, 4, 12, Math.PI * 0.95]} />
        </mesh>
        {/* Riser, thickening the middle where a hand would go. */}
        <mesh material={flatMat(PALETTE.bowWood)} position={[-0.198, 0.25, 0]}>
          <boxGeometry args={[0.022, 0.09, 0.02]} />
        </mesh>
        {/* String, chord across the limb tips. */}
        <mesh material={flatMat(PALETTE.bowString)} position={[0.006, 0.25, 0]}>
          <boxGeometry args={[0.004, 0.398, 0.004]} />
        </mesh>
      </group>

      {/* Quiver, tipped back with arrows standing out of it. */}
      <group position={[0.085, 0, -0.01]} rotation={[0.2, 0, -0.16]}>
        <mesh material={flatMat(PALETTE.quiver)} position={[0, 0.105, 0]}>
          <cylinderGeometry args={[0.043, 0.036, 0.21, 8]} />
        </mesh>
        <mesh material={flatMat(PALETTE.chestIron)} position={[0, 0.17, 0]}>
          <cylinderGeometry args={[0.046, 0.046, 0.014, 8]} />
        </mesh>
        {[
          [0.012, 0.01, 0.05],
          [-0.014, -0.008, -0.04],
          [0.004, -0.016, 0.02],
        ].map(([x, z, lean], i) => (
          <group key={i} position={[x, 0.2, z]} rotation={[0, 0, lean]}>
            <mesh material={flatMat(PALETTE.arrowShaft)} position={[0, 0.075, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.15, 5]} />
            </mesh>
            {[0, 1, 2].map((f) => (
              <mesh
                key={f}
                material={flatMat(PALETTE.fletching)}
                position={[0, 0.132, 0]}
                rotation={[0, (f / 3) * Math.PI * 2, 0]}
              >
                <boxGeometry args={[0.016, 0.03, 0.002]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

const FIGURINE: Record<InterestId, () => JSX.Element> = {
  travel: Globe,
  skiing: Skis,
  history: Column,
  onepiece: StrawHatAndChest,
  reading: BookStack,
  film: FilmReel,
  stellar: Telescope,
  sports: Trophy,
  lego: Bricks,
  archery: BowAndQuiver,
};

interface FigurinesProps {
  onHover: (label: string | null) => void;
}

/** The ten clickable objects, placed onto their tiers. */
export function Figurines({ onHover }: FigurinesProps) {
  return (
    <>
      {OBJECTS.map((spot) => {
        const Figurine = FIGURINE[spot.id];
        return (
          <group
            key={spot.id}
            position={[spot.x, TIER_Y[spot.tier], spot.z]}
            rotation={[0, spot.rotationY, 0]}
          >
            <Clickable label={spot.label} haloRadius={spot.haloRadius} onHover={onHover}>
              <Figurine />
            </Clickable>
          </group>
        );
      })}
    </>
  );
}
