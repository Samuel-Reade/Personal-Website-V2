import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flatMaterial, PALETTE } from "./materials";
import {
  BACK_WINDOW_SILL,
  BACK_WINDOW_SPRING,
  BACK_WINDOW_WIDTH,
  HALL_MAX_X,
  HALL_MIN_X,
  HALL_MIN_Z,
  WALL_THICKNESS,
  WINDOW_SILL,
  WINDOW_SPRING,
  WINDOW_WIDTH,
  WINDOW_Z,
} from "./layout";

/** Voussoirs in each semicircular head. 7 is enough to read as an arch while staying visibly faceted. */
const ARCH_SEGMENTS = 7;
const FRAME_DEPTH = 0.26;
const MULLION = 0.14;

interface WindowProps {
  width: number;
  sill: number;
  spring: number;
  glassMaterial: THREE.Material;
}

/**
 * One tall arched window: a glass panel, a frame around it, a semicircular head
 * built from wedge blocks, and a cross of glazing bars.
 *
 * Drawn flat against the wall rather than punched through it. Nothing outside
 * the hall is ever seen — there is no exterior modelled — so an opening would
 * frame a view of the inside of the far wall. The glass is unlit and tinted by
 * the clock instead, which is what sells it as daylight coming in.
 */
function ArchedWindow({ width, sill, spring, glassMaterial }: WindowProps) {
  const frameMaterial = useMemo(() => flatMaterial(PALETTE.windowFrame), []);
  const radius = width / 2;

  const arch = useMemo(
    () =>
      Array.from({ length: ARCH_SEGMENTS }, (_, i) => {
        const a = ((i + 0.5) / ARCH_SEGMENTS) * Math.PI;
        return {
          x: Math.cos(a) * radius,
          y: Math.sin(a) * radius,
          // Each block lies tangent to the curve, so the run of them reads as one arc.
          rotation: a - Math.PI / 2,
        };
      }),
    [radius]
  );

  const shaftHeight = spring - sill;

  return (
    <group>
      {/* Glass: the straight shaft plus the half-round head above it. */}
      <mesh material={glassMaterial} position={[0, sill + shaftHeight / 2, 0]}>
        <planeGeometry args={[width, shaftHeight]} />
      </mesh>
      <mesh material={glassMaterial} position={[0, spring, 0]}>
        {/* 12 radial segments — faceted, matching everything else in the hall. */}
        <circleGeometry args={[radius, 12, 0, Math.PI]} />
      </mesh>

      {/* Jambs and sill. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={frameMaterial}
          position={[s * (radius + MULLION / 2), sill + shaftHeight / 2, 0.02]}
          castShadow
        >
          <boxGeometry args={[MULLION * 2, shaftHeight, FRAME_DEPTH]} />
        </mesh>
      ))}
      <mesh material={frameMaterial} position={[0, sill - 0.12, 0.06]} castShadow>
        <boxGeometry args={[width + 0.9, 0.34, FRAME_DEPTH + 0.24]} />
      </mesh>

      {/* Arch head. */}
      {arch.map(({ x, y, rotation }, i) => (
        <mesh
          key={i}
          material={frameMaterial}
          position={[x, spring + y, 0.02]}
          rotation={[0, 0, rotation]}
          castShadow
        >
          <boxGeometry args={[MULLION * 2, (Math.PI * radius) / ARCH_SEGMENTS + 0.08, FRAME_DEPTH]} />
        </mesh>
      ))}

      {/* Glazing bars. */}
      <mesh material={frameMaterial} position={[0, sill + shaftHeight / 2, 0.03]}>
        <boxGeometry args={[MULLION, shaftHeight, 0.1]} />
      </mesh>
      {[0.36, 0.68].map((t) => (
        <mesh key={t} material={frameMaterial} position={[0, sill + shaftHeight * t, 0.03]}>
          <boxGeometry args={[width, MULLION, 0.1]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Every window in the hall. `tintRef` is written once per frame by
 * MansionLighting and read here, so the glass, the fill light and the shafts
 * all agree on one daylight colour rather than each recomputing it.
 */
export function Windows({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  // Unlit: the glass *is* the light source in the fiction, so shading it would
  // only darken the panes on the wall the sun happens to be behind.
  const glassMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: PALETTE.glass, side: THREE.DoubleSide }),
    []
  );
  const lastTint = useRef(new THREE.Color());

  useFrame(() => {
    if (!lastTint.current.equals(tintRef.current)) {
      lastTint.current.copy(tintRef.current);
      glassMaterial.color.copy(tintRef.current);
    }
  });

  const sideX = [HALL_MIN_X + WALL_THICKNESS + 0.02, HALL_MAX_X - WALL_THICKNESS - 0.02];

  return (
    <group>
      {sideX.map((x, side) =>
        WINDOW_Z.map((z) => (
          <group
            key={`${side}-${z}`}
            position={[x, 0, z]}
            // Faces into the room from whichever wall it is on.
            rotation={[0, side === 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
          >
            <ArchedWindow
              width={WINDOW_WIDTH}
              sill={WINDOW_SILL}
              spring={WINDOW_SPRING}
              glassMaterial={glassMaterial}
            />
          </group>
        ))
      )}

      {/* The tall one over the portal, so the gap between the stairs is lit from
          behind and the portal reads as a silhouette against it. */}
      <group position={[0, 0, HALL_MIN_Z + WALL_THICKNESS + 0.02]}>
        <ArchedWindow
          width={BACK_WINDOW_WIDTH}
          sill={BACK_WINDOW_SILL}
          spring={BACK_WINDOW_SPRING}
          glassMaterial={glassMaterial}
        />
      </group>
    </group>
  );
}
