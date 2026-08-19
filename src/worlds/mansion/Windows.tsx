import { useEffect, useMemo, useRef } from "react";
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

/** Facets in each semicircular head. 12 reads as an arch while staying visibly faceted. */
const ARCH_SEGMENTS = 12;
/** The timber frame: how deep it stands off the wall, and how wide its members are. */
const FRAME_DEPTH = 0.26;
const FRAME_WIDTH = 0.28;
/** Glazing bars, and the depth they stand off the glass. */
const BAR = 0.09;
const BAR_DEPTH = 0.1;
/** The stone architrave around the frame, and how far it stands proud of the wall. */
const SURROUND = 0.36;
const SURROUND_DEPTH = 0.14;
/** Roughly how big a pane is: the grid of bars is fitted to this. */
const PANE = 1.1;

interface WindowProps {
  width: number;
  sill: number;
  spring: number;
  glassMaterial: THREE.Material;
}

/**
 * A half annulus, extruded: the arch of the frame, the arch of the surround,
 * and the concentric bar in the fanlight are all this shape at different radii.
 * Built as one piece rather than as a run of blocks — the blocks left gaps at
 * the joints and read as a broken ring — and faceted at ARCH_SEGMENTS so it
 * still belongs in the hall. Centred on z.
 */
function halfRing(inner: number, outer: number, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI, false);
  shape.absarc(0, 0, inner, Math.PI, 0, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: ARCH_SEGMENTS,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/**
 * One tall arched window, complete: glass, a timber frame — jambs, a rail at
 * the sill, a transom at the springing, and a continuous arch — the glazing
 * bars dividing the shaft into a grid of near-square panes and the fanlight
 * into a fan, and a stone surround around all of it with a keystone at the
 * crown and a sill below.
 *
 * Drawn flat against the wall rather than punched through it. Nothing outside
 * the hall is ever seen — there is no exterior modelled — so an opening would
 * frame a view of the inside of the far wall. The glass is unlit and tinted by
 * the clock instead, which is what sells it as daylight coming in.
 */
function ArchedWindow({ width, sill, spring, glassMaterial }: WindowProps) {
  const frameMaterial = useMemo(() => flatMaterial(PALETTE.windowFrame), []);
  const stoneMaterial = useMemo(() => flatMaterial(PALETTE.windowSurround), []);
  const radius = width / 2;
  const shaftHeight = spring - sill;

  // The pane grid: as many columns and rows as fit at about a PANE each.
  const columns = Math.max(2, Math.round(width / PANE));
  const rows = Math.max(1, Math.round(shaftHeight / PANE));
  // Spokes in the fanlight, evenly spaced between the springing points.
  const spokes = Math.max(3, columns);

  const frameArch = useMemo(
    () => halfRing(radius, radius + FRAME_WIDTH, FRAME_DEPTH),
    [radius]
  );
  const surroundArch = useMemo(
    () => halfRing(radius + FRAME_WIDTH, radius + FRAME_WIDTH + SURROUND, SURROUND_DEPTH),
    [radius]
  );
  const fanRingRadius = radius * 0.56;
  const fanRing = useMemo(
    () => halfRing(fanRingRadius - BAR / 2, fanRingRadius + BAR / 2, BAR_DEPTH),
    [fanRingRadius]
  );
  useEffect(
    () => () => {
      frameArch.dispose();
      surroundArch.dispose();
      fanRing.dispose();
    },
    [frameArch, surroundArch, fanRing]
  );

  return (
    <group>
      {/* Glass: the straight shaft plus the half-round head above it. */}
      <mesh material={glassMaterial} position={[0, sill + shaftHeight / 2, 0]}>
        <planeGeometry args={[width, shaftHeight]} />
      </mesh>
      <mesh material={glassMaterial} position={[0, spring, 0]}>
        <circleGeometry args={[radius, ARCH_SEGMENTS, 0, Math.PI]} />
      </mesh>

      {/* The stone surround: an architrave up each side and over the arch, a
          keystone at the crown, and the sill it all stands on. Proud of the
          wall by less than the frame, so the frame reads as set into it. */}
      {[-1, 1].map((s) => (
        <mesh
          key={`surround${s}`}
          material={stoneMaterial}
          position={[s * (radius + FRAME_WIDTH + SURROUND / 2), sill + shaftHeight / 2, SURROUND_DEPTH / 2]}
          castShadow
        >
          <boxGeometry args={[SURROUND, shaftHeight, SURROUND_DEPTH]} />
        </mesh>
      ))}
      <mesh
        geometry={surroundArch}
        material={stoneMaterial}
        position={[0, spring, SURROUND_DEPTH / 2]}
        castShadow
      />
      <mesh
        material={stoneMaterial}
        position={[0, spring + radius + FRAME_WIDTH + SURROUND / 2, SURROUND_DEPTH / 2 + 0.05]}
        castShadow
      >
        <boxGeometry args={[0.44, SURROUND + 0.34, SURROUND_DEPTH + 0.1]} />
      </mesh>
      <mesh material={stoneMaterial} position={[0, sill - 0.14, 0.12]} castShadow>
        <boxGeometry args={[width + 2 * (FRAME_WIDTH + SURROUND) + 0.2, 0.3, 0.44]} />
      </mesh>

      {/* The frame: jambs, a rail on the sill, a transom at the springing, and
          the arch, all one colour and all meeting. */}
      {[-1, 1].map((s) => (
        <mesh
          key={`jamb${s}`}
          material={frameMaterial}
          position={[s * (radius + FRAME_WIDTH / 2), sill + shaftHeight / 2, FRAME_DEPTH / 2]}
          castShadow
        >
          <boxGeometry args={[FRAME_WIDTH, shaftHeight, FRAME_DEPTH]} />
        </mesh>
      ))}
      <mesh material={frameMaterial} position={[0, sill + 0.08, FRAME_DEPTH / 2]} castShadow>
        <boxGeometry args={[width + 2 * FRAME_WIDTH, 0.16, FRAME_DEPTH]} />
      </mesh>
      <mesh material={frameMaterial} position={[0, spring, FRAME_DEPTH / 2]} castShadow>
        <boxGeometry args={[width + 2 * FRAME_WIDTH, 0.18, FRAME_DEPTH]} />
      </mesh>
      <mesh geometry={frameArch} material={frameMaterial} position={[0, spring, FRAME_DEPTH / 2]} castShadow />

      {/* Glazing bars in the shaft: a grid of near-square panes. */}
      {Array.from({ length: columns - 1 }, (_, i) => -width / 2 + (width * (i + 1)) / columns).map((x) => (
        <mesh key={`v${x}`} material={frameMaterial} position={[x, sill + shaftHeight / 2, BAR_DEPTH / 2]}>
          <boxGeometry args={[BAR, shaftHeight, BAR_DEPTH]} />
        </mesh>
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => sill + (shaftHeight * (i + 1)) / rows).map((y) => (
        <mesh key={`h${y}`} material={frameMaterial} position={[0, y, BAR_DEPTH / 2]}>
          <boxGeometry args={[width, BAR, BAR_DEPTH]} />
        </mesh>
      ))}

      {/* The fanlight: spokes radiating from the springing point, and one
          concentric bar across them. */}
      {Array.from({ length: spokes }, (_, i) => ((i + 1) / (spokes + 1)) * Math.PI).map((a) => (
        <mesh
          key={`spoke${a}`}
          material={frameMaterial}
          position={[(Math.cos(a) * radius) / 2, spring + (Math.sin(a) * radius) / 2, BAR_DEPTH / 2]}
          rotation={[0, 0, a - Math.PI / 2]}
        >
          <boxGeometry args={[BAR, radius, BAR_DEPTH]} />
        </mesh>
      ))}
      <mesh geometry={fanRing} material={frameMaterial} position={[0, spring, BAR_DEPTH / 2]} />
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
