import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useStore } from "../../state/useStore";
import { displaySize, getDisplayFont } from "../../three/displayFont";
import { flatMaterial, PALETTE } from "./materials";
import {
  NAME_CAP_HEIGHT,
  NAME_Y,
  TABLE_CENTER,
  TABLE_HEIGHT,
  TABLE_RADIUS,
  TABLE_SURFACE_Y,
} from "./layout";

const NAME = "Samuel Reade";

/** Matches the bob on the meadow's portal labels, so floating text reads the same everywhere. */
const BOB_HEIGHT = 0.09;
const BOB_SPEED = 2.2;

const BOOK_WIDTH = 1.15;
const BOOK_DEPTH = 0.78;
/** Angle each half of the open book lifts from its spine, so it reads as open rather than shut. */
const PAGE_TILT = 0.16;
/**
 * How far the whole book is tilted up toward the room on its rest.
 *
 * Lying flat it is barely a centimetre of edge from standing height across the
 * hall — a glow with no surface facing anyone to catch it. On a rest, the lit
 * pages face the door, which is the entire point of the object.
 */
const BOOK_TILT = 0.52;
const REST_HEIGHT = 0.14;

/** Resting glow, and what it climbs to under the pointer. */
const GLOW_REST = 0.55;
const GLOW_HOVER = 1.35;
/** Exponential settle rate, frame-rate independent — the same easing used across the site. */
const GLOW_RATE = 7;

function Table() {
  const topMaterial = useMemo(() => flatMaterial(PALETTE.tableTop), []);
  const trimMaterial = useMemo(() => flatMaterial(PALETTE.tableTrim), []);
  const baseMaterial = useMemo(() => flatMaterial(PALETTE.tableBase), []);

  return (
    <group position={[TABLE_CENTER[0], 0, TABLE_CENTER[1]]}>
      {/* 12 sides rather than a smooth cylinder — round enough to read as a
          circular table, faceted enough to belong in this room. */}
      <mesh material={topMaterial} position={[0, TABLE_HEIGHT - 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.12, 12]} />
      </mesh>
      <mesh material={trimMaterial} position={[0, TABLE_HEIGHT - 0.15, 0]}>
        <cylinderGeometry args={[TABLE_RADIUS - 0.04, TABLE_RADIUS - 0.12, 0.08, 12]} />
      </mesh>

      <mesh material={baseMaterial} position={[0, TABLE_HEIGHT / 2 - 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.42, TABLE_HEIGHT - 0.2, 8]} />
      </mesh>
      <mesh material={baseMaterial} position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 1, 0.24, 8]} />
      </mesh>
      <mesh material={trimMaterial} position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.7, 0.82, 0.08, 8]} />
      </mesh>
    </group>
  );
}

/**
 * The open book on the table: the room's one clickable object, opening the
 * overview panel.
 *
 * It follows the same interaction language as the library's floating books and
 * the archipelago's islands — a resting glow that lifts under the pointer, a
 * pointer cursor, and one invisible hull carrying the events so the gaps between
 * the pages aren't holes a click falls through.
 */
function OpenBook() {
  const openPanel = useStore((s) => s.openPanel);
  const [hovered, setHovered] = useState(false);

  const coverMaterial = useMemo(() => flatMaterial(PALETTE.bookCover), []);
  const ribbonMaterial = useMemo(() => flatMaterial(PALETTE.bookRibbon), []);
  const standMaterial = useMemo(() => flatMaterial(PALETTE.tableBase), []);
  const pageMaterial = useMemo(
    () => flatMaterial(PALETTE.bookPage, { emissive: "#ffdda1", emissiveIntensity: GLOW_REST }),
    []
  );
  const glowRef = useRef<THREE.PointLight>(null!);

  useFrame((state, delta) => {
    const settle = 1 - Math.exp(-GLOW_RATE * delta);
    // A slow pulse under the resting glow, so the book reads as inviting rather
    // than as a lamp someone left on.
    const breathing = GLOW_REST + Math.sin(state.clock.elapsedTime * 1.3) * 0.09;
    const target = hovered ? GLOW_HOVER : breathing;

    pageMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      pageMaterial.emissiveIntensity,
      target,
      settle
    );
    if (glowRef.current) {
      // Scaled to the room's other point lights, which run 7–30 at decay 2.
      glowRef.current.intensity = THREE.MathUtils.lerp(glowRef.current.intensity, target * 3.4, settle);
    }
  });

  const interaction = {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(false);
      document.body.style.cursor = "default";
    },
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      openPanel("rundown");
    },
  };

  return (
    <group position={[TABLE_CENTER[0], TABLE_SURFACE_Y, TABLE_CENTER[1]]}>
      {/* One hull over the whole book, generously sized: this is a small object
          seen from across a large room, and a hit area matched exactly to the
          pages would be a pixel or two wide from the door. */}
      <mesh position={[0, 0.32, 0]} {...interaction}>
        <boxGeometry args={[BOOK_WIDTH * 2 + 0.4, 0.8, BOOK_DEPTH + 0.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* The rest the book leans on: a faceted pad and a sloped board. */}
      <mesh material={standMaterial} position={[0, REST_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.02, 1.18, REST_HEIGHT, 8]} />
      </mesh>
      <mesh
        material={standMaterial}
        position={[0, REST_HEIGHT + 0.06, 0]}
        rotation={[BOOK_TILT, 0, 0]}
        castShadow
      >
        <boxGeometry args={[BOOK_WIDTH * 2 + 0.14, 0.08, BOOK_DEPTH + 0.12]} />
      </mesh>

      {/* Everything above the rest tips back as one, so the lit pages face the
          door rather than the ceiling. */}
      <group position={[0, REST_HEIGHT + 0.12, 0]} rotation={[BOOK_TILT, 0, 0]}>
        {([-1, 1] as const).map((side) => (
          <group key={side} rotation={[0, 0, -side * PAGE_TILT]}>
            <mesh
              material={coverMaterial}
              position={[side * (BOOK_WIDTH / 2 + 0.02), 0.05, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[BOOK_WIDTH, 0.07, BOOK_DEPTH]} />
            </mesh>
            <mesh material={pageMaterial} position={[side * (BOOK_WIDTH / 2), 0.11, 0]} receiveShadow>
              <boxGeometry args={[BOOK_WIDTH - 0.09, 0.06, BOOK_DEPTH - 0.08]} />
            </mesh>
          </group>
        ))}

        {/* Spine, and the ribbon marker trailing out of it. */}
        <mesh material={coverMaterial} position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.14, 0.1, BOOK_DEPTH]} />
        </mesh>
        <mesh material={ribbonMaterial} position={[0.22, 0.13, BOOK_DEPTH / 2 - 0.06]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.07, 0.012, 0.5]} />
        </mesh>
      </group>

      {/* Spills the glow onto the table top and the underside of the name above. */}
      <pointLight ref={glowRef} position={[0, 0.62, 0.2]} color="#ffcf8f" intensity={2} distance={7} decay={2} />
    </group>
  );
}

/**
 * "Samuel Reade" in extruded 3D above the table — the same technique as the
 * section labels floating over the meadow's portals: display-face outlines
 * through `TextGeometry`, bevelled, on the same gentle bob.
 *
 * The colour is the one departure. The portal labels glow the portals' violet;
 * in here that would be the only cool thing in a warm room, so this takes the
 * hall's candlelight instead.
 */
function FloatingName() {
  const group = useRef<THREE.Group>(null!);

  const geometry = useMemo(() => {
    const text = new TextGeometry(NAME, {
      font: getDisplayFont(),
      size: displaySize(NAME_CAP_HEIGHT),
      depth: 0.16,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.016,
      bevelSegments: 2,
    });
    // TextGeometry lays glyphs out rightward from the origin, so without this the
    // name would hang off to one side of the table.
    text.center();
    return text;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#fff3dc",
        emissive: new THREE.Color("#e8a33d"),
        emissiveIntensity: 1.15,
        roughness: 0.4,
        metalness: 0,
        flatShading: true,
      }),
    []
  );

  useFrame((state) => {
    if (!group.current) return;
    group.current.position.y = NAME_Y + Math.sin(state.clock.elapsedTime * BOB_SPEED) * BOB_HEIGHT;
  });

  return (
    <group ref={group} position={[TABLE_CENTER[0], NAME_Y, TABLE_CENTER[1]]}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

/** The table, the book on it, and the name floating over both. */
export function Centrepiece() {
  return (
    <group>
      <Table />
      <OpenBook />
      <FloatingName />
    </group>
  );
}
