import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSunState } from "../../utils/time";
import { flatMaterial, GLASS_COLORS, NIGHT_TINT, PALETTE } from "./materials";
import {
  END_WINDOW_X,
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

const WINDOW_HEIGHT = WINDOW_TOP - WINDOW_BOTTOM;
/** Fraction of the window height given over to the rounded arch at the top. */
const ARCH_FRACTION = 0.3;
const PANE_COLS = 5;
const PANE_ROWS = 9;
/** Gap between panes, which the dark backing plate shows through as leading. */
const PANE_GAP = 0.09;

/**
 * One window's worth of leaded panes as a single geometry with per-vertex color.
 *
 * Built by hand rather than by merging PlaneGeometries because every pane needs
 * its own flat color, and a color attribute written directly is far cheaper than
 * one material per pane. Panes falling outside the arch curve are skipped, which
 * is what gives the window its rounded head without any curved geometry.
 */
function buildWindowGeometry(seed: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  const archHeight = WINDOW_HEIGHT * ARCH_FRACTION;
  const archStart = WINDOW_HEIGHT - archHeight;
  const cellW = WINDOW_WIDTH / PANE_COLS;
  const cellH = WINDOW_HEIGHT / PANE_ROWS;
  const color = new THREE.Color();

  for (let row = 0; row < PANE_ROWS; row++) {
    for (let col = 0; col < PANE_COLS; col++) {
      const cx = -WINDOW_WIDTH / 2 + cellW * (col + 0.5);
      const cy = cellH * (row + 0.5);

      // Clip the corners off the top rows against a half-ellipse.
      if (cy > archStart) {
        const t = (cy - archStart) / archHeight;
        const allowedHalfWidth = (WINDOW_WIDTH / 2) * Math.sqrt(Math.max(0, 1 - t * t));
        if (Math.abs(cx) + cellW * 0.3 > allowedHalfWidth) continue;
      }

      const halfW = (cellW - PANE_GAP) / 2;
      const halfH = (cellH - PANE_GAP) / 2;
      const x0 = cx - halfW;
      const x1 = cx + halfW;
      const y0 = cy - halfH;
      const y1 = cy + halfH;

      // Deterministic per-pane pick, so a window looks hand-assorted but never
      // reshuffles between renders.
      const index = Math.abs(Math.round(Math.sin(seed + row * 12.9898 + col * 78.233) * 43758.5453));
      color.set(GLASS_COLORS[index % GLASS_COLORS.length]);

      positions.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
      for (let v = 0; v < 6; v++) {
        colors.push(color.r, color.g, color.b);
        normals.push(0, 0, 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

interface WindowWall {
  /** Yaw that turns a pane's +Z (the side its normals face) into the room. */
  rotationY: number;
  /**
   * The world axis this wall's inward normal lies along, and its sign. Read
   * against the sun's direction to decide whether the sun is behind the wall.
   */
  axis: "x" | "z";
  inward: 1 | -1;
  /** World XZ of each window's centre, on the wall's inner face. */
  centers: [number, number][];
  /**
   * Which of the two shared geometry sets this wall draws from. Facing walls
   * share a set — a window's pattern is deliberately mirrored across the hall,
   * and the two ends are never in the same view — so the hall needs eight
   * distinct windows, not sixteen.
   */
  set: "side" | "end";
}

/**
 * All four walls. The sun as `getSunState` models it rises at +Z, stands at +X
 * by noon and sets at -Z, so over a day the shafts move from the front wall
 * (behind spawn) to the right wall to the back wall at the head of the aisle.
 */
const WALLS: WindowWall[] = [
  {
    rotationY: Math.PI / 2,
    axis: "x",
    inward: 1,
    centers: WINDOW_Z.map((z) => [HALL_MIN_X + WALL_THICKNESS, z]),
    set: "side",
  },
  {
    rotationY: -Math.PI / 2,
    axis: "x",
    inward: -1,
    centers: WINDOW_Z.map((z) => [HALL_MAX_X - WALL_THICKNESS, z]),
    set: "side",
  },
  {
    rotationY: Math.PI,
    axis: "z",
    inward: -1,
    centers: END_WINDOW_X.map((x) => [x, HALL_MAX_Z - WALL_THICKNESS]),
    set: "end",
  },
  {
    rotationY: 0,
    axis: "z",
    inward: 1,
    centers: END_WINDOW_X.map((x) => [x, HALL_MIN_Z + WALL_THICKNESS]),
    set: "end",
  },
];

/**
 * Tall leaded windows down both side walls and across both ends, plus the
 * light shafts they throw.
 *
 * The glass is unlit (`MeshBasicMaterial`) because in the fiction it *is* the
 * light source — running it through the scene's lighting would darken it exactly
 * when the sun is behind it. Its brightness and tint are driven off the visitor's
 * real local clock instead, the same `getSunState` the outdoor world uses.
 */
export function StainedGlass({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  const glassMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    []
  );
  const backingMaterial = useMemo(() => flatMaterial("#2a2622"), []);
  const frameMaterial = useMemo(() => flatMaterial(PALETTE.wallTrim), []);
  // One material per wall, not one shared: only the wall the sun is actually
  // behind should throw beams, and a single shared opacity would light them all.
  const shaftMaterials = useMemo(
    () =>
      WALLS.map(
        () =>
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          })
      ),
    []
  );

  const geometrySets = useMemo(
    () => ({
      side: WINDOW_Z.map((_, i) => buildWindowGeometry(i * 7.3 + 1.7)),
      // Offset well clear of the side seeds so no end window repeats a side one.
      end: END_WINDOW_X.map((_, i) => buildWindowGeometry(i * 5.1 + 61.3)),
    }),
    []
  );

  /** Every window in the hall, flattened so the shaft groups can be indexed by one running count. */
  const windows = useMemo(
    () =>
      WALLS.flatMap((wall, wallIndex) =>
        wall.centers.map(([x, z], i) => ({
          wallIndex,
          x,
          z,
          rotationY: wall.rotationY,
          geometry: geometrySets[wall.set][i],
        }))
      ),
    [geometrySets]
  );

  const shaftGroups = useRef<THREE.Group[]>([]);

  useFrame(() => {
    const sun = getSunState();
    const daylight = THREE.MathUtils.clamp(Math.sin(sun.elevation) + 0.12, 0, 1);
    const tint = tintRef.current;

    // Multiplying the shared basic material's color scales every pane's vertex
    // color at once: bright and warm at midday, dim and blue after dark.
    glassMaterial.color.copy(tint).multiplyScalar(THREE.MathUtils.lerp(0.34, 1.25, daylight));
    if (daylight < 0.02) glassMaterial.color.copy(NIGHT_TINT).multiplyScalar(0.3);

    // Where the sun is, in the same spherical convention SkyLighting uses. Only
    // the walls it is actually behind should throw shafts.
    const sunX = Math.cos(sun.elevation) * Math.sin(sun.azimuth);
    const sunZ = Math.cos(sun.elevation) * Math.cos(sun.azimuth);
    const pitch = THREE.MathUtils.clamp(sun.elevation, -0.2, Math.PI / 2);

    for (const group of shaftGroups.current) {
      if (group) group.rotation.x = -pitch;
    }

    for (let wallIndex = 0; wallIndex < WALLS.length; wallIndex++) {
      const wall = WALLS[wallIndex];
      // A wall catches the sun when its inward normal points away from it.
      const toward = wall.axis === "x" ? sunX : sunZ;
      const facing = THREE.MathUtils.clamp(-wall.inward * toward, 0, 1);
      shaftMaterials[wallIndex].color.copy(tint);
      shaftMaterials[wallIndex].opacity = facing * daylight * 0.16;
    }
  });

  return (
    <group>
      {windows.map((opening, index) => (
        <group key={index} position={[opening.x, WINDOW_BOTTOM, opening.z]} rotation={[0, opening.rotationY, 0]}>
          {/* Dark plate behind the panes — the gaps between them read as leading. */}
          <mesh material={backingMaterial} position={[0, WINDOW_HEIGHT / 2, -0.12]}>
            <boxGeometry args={[WINDOW_WIDTH, WINDOW_HEIGHT, 0.12]} />
          </mesh>
          <mesh geometry={opening.geometry} material={glassMaterial} />
          {/* Stone surround. */}
          <mesh material={frameMaterial} position={[0, WINDOW_HEIGHT / 2, -0.3]}>
            <boxGeometry args={[WINDOW_WIDTH + 0.7, WINDOW_HEIGHT + 0.7, 0.35]} />
          </mesh>

          <group
            ref={(node) => {
              if (node) shaftGroups.current[index] = node;
            }}
            position={[0, WINDOW_HEIGHT / 2, 0]}
          >
            {/* Anchored at the window and extending forward, so rotating the
                group about X sweeps the beam from the floor to the far wall as
                the sun climbs. */}
            <mesh material={shaftMaterials[opening.wallIndex]} position={[0, 0, 11]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[WINDOW_WIDTH * 0.92, 22]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
