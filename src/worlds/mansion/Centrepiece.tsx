import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useStore } from "../../state/useStore";
import { displaySize, getDisplayFont } from "../../three/displayFont";
import { flatMaterial, PALETTE } from "./materials";
import {
  LABEL_CAP_HEIGHT,
  LABEL_Y,
  TABLE_CENTER,
  TABLE_HEIGHT,
  TABLE_RADIUS,
  TABLE_SURFACE_Y,
} from "./layout";

/** What the book opens, named the way every portal in the meadow names its world. */
const LABEL = "Overview";

/** Matches the bob on the meadow's portal labels, so floating text reads the same everywhere. */
const BOB_HEIGHT = 0.09;
const BOB_SPEED = 2.2;

const BOOK_WIDTH = 1.15;
const BOOK_DEPTH = 0.78;
/** Angle each half of the open book lifts from its spine, so it reads as open rather than shut. */
const PAGE_TILT = 0.16;
/** Thickness of one leaf in the stack under each open page. */
const LEAF = 0.022;
const LEAF_COUNT = 4;
/** Lines of "text" ruled across each open page. */
const TEXT_LINES = 5;
/**
 * How far the whole book is tilted up toward the room on its rest.
 *
 * Lying flat it is barely a centimetre of edge from standing height across the
 * hall — a glow with no surface facing anyone to catch it. On a rest, the lit
 * pages face the door, which is the entire point of the object.
 */
const BOOK_TILT = 0.52;
const REST_HEIGHT = 0.14;

/** Resting glow, and what it climbs to under the pointer or with the walker at the table. */
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
 * overview panel — by a click, or by Space standing at the table (see
 * `SpaceInteract` in `MansionScene.tsx`).
 *
 * It follows the same interaction language as the library's floating books and
 * the archipelago's islands — a resting glow that lifts under the pointer and
 * when the walker is within reach, a pointer cursor, and one invisible hull
 * carrying the events so the gaps between the pages aren't holes a click falls
 * through.
 */
function OpenBook() {
  const openPanel = useStore((s) => s.openPanel);
  // The same lift the pointer gives it, for the walker who has come up to the
  // table: the glow answers the Space prompt the way the library's books rise
  // to meet him. Subscribed, but it only changes on the range crossing.
  const near = useStore((s) => s.bookNear);
  const [hovered, setHovered] = useState(false);

  const coverMaterial = useMemo(() => flatMaterial(PALETTE.bookCover), []);
  const coverEdgeMaterial = useMemo(() => flatMaterial(PALETTE.bookCoverEdge), []);
  const ribbonMaterial = useMemo(() => flatMaterial(PALETTE.bookRibbon), []);
  const giltMaterial = useMemo(() => flatMaterial(PALETTE.bookGilt), []);
  const leafMaterial = useMemo(() => flatMaterial(PALETTE.bookPageEdge), []);
  const textMaterial = useMemo(() => flatMaterial(PALETTE.bookText), []);
  const standMaterial = useMemo(() => flatMaterial(PALETTE.tableBase), []);
  const pageMaterial = useMemo(
    () => flatMaterial(PALETTE.bookPage, { emissive: "#ffdda1", emissiveIntensity: GLOW_REST }),
    []
  );
  const glowRef = useRef<THREE.PointLight>(null!);

  /**
   * Ruled lines on each open page, as thin bars. Lengths vary and the last one
   * is short, the way a paragraph ends — a stack of equal bars reads as a
   * barcode rather than as writing.
   */
  const lines = useMemo(
    () =>
      Array.from({ length: TEXT_LINES }, (_, i) => ({
        z: (i - (TEXT_LINES - 1) / 2) * 0.105,
        width: i === TEXT_LINES - 1 ? 0.42 : 0.66 + ((i * 37) % 5) * 0.035,
      })),
    []
  );

  useFrame((state, delta) => {
    const settle = 1 - Math.exp(-GLOW_RATE * delta);
    // A slow pulse under the resting glow, so the book reads as inviting rather
    // than as a lamp someone left on.
    const breathing = GLOW_REST + Math.sin(state.clock.elapsedTime * 1.3) * 0.09;
    const target = hovered || near ? GLOW_HOVER : breathing;

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
            {/* Board, with a darker strip proud of it so the cover reads as
                overhanging the block the way a bound one does. */}
            <mesh
              material={coverMaterial}
              position={[side * (BOOK_WIDTH / 2 + 0.02), 0.05, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[BOOK_WIDTH, 0.07, BOOK_DEPTH]} />
            </mesh>
            <mesh
              material={coverEdgeMaterial}
              position={[side * (BOOK_WIDTH + 0.005), 0.055, 0]}
              castShadow
            >
              <boxGeometry args={[0.05, 0.075, BOOK_DEPTH + 0.02]} />
            </mesh>

            {/* The leaf stack: a few thin sheets, each a little narrower than
                the one below, which is what gives the block a visible fore-edge
                instead of one solid slab. */}
            {Array.from({ length: LEAF_COUNT }, (_, i) => (
              <mesh
                key={i}
                material={leafMaterial}
                position={[side * (BOOK_WIDTH / 2), 0.085 + i * LEAF, 0]}
                receiveShadow
              >
                <boxGeometry
                  args={[BOOK_WIDTH - 0.07 - i * 0.02, LEAF, BOOK_DEPTH - 0.06 - i * 0.014]}
                />
              </mesh>
            ))}

            {/* The open page itself — the surface that carries the glow. */}
            <mesh
              material={pageMaterial}
              position={[side * (BOOK_WIDTH / 2), 0.085 + LEAF_COUNT * LEAF, 0]}
              receiveShadow
            >
              <boxGeometry args={[BOOK_WIDTH - 0.15, LEAF, BOOK_DEPTH - 0.14]} />
            </mesh>

            {/* Gilding along the fore-edge. */}
            <mesh
              material={giltMaterial}
              position={[side * (BOOK_WIDTH - 0.09), 0.085 + (LEAF_COUNT * LEAF) / 2, 0]}
            >
              <boxGeometry args={[0.02, LEAF_COUNT * LEAF, BOOK_DEPTH - 0.16]} />
            </mesh>

            {/* Ruled writing across the page. */}
            {lines.map((line, i) => (
              <mesh
                key={i}
                material={textMaterial}
                position={[
                  side * (BOOK_WIDTH / 2) - side * ((BOOK_WIDTH - 0.2 - line.width) / 2),
                  0.09 + LEAF_COUNT * LEAF,
                  line.z,
                ]}
              >
                <boxGeometry args={[line.width, 0.008, 0.022]} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Spine, with raised bands across it. */}
        <mesh material={coverMaterial} position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.16, 0.11, BOOK_DEPTH]} />
        </mesh>
        {[-0.22, 0, 0.22].map((z) => (
          <mesh key={z} material={coverEdgeMaterial} position={[0, 0.115, z]}>
            <boxGeometry args={[0.19, 0.02, 0.05]} />
          </mesh>
        ))}

        {/* Headband at the top of the spine, and the ribbon trailing out. */}
        <mesh material={giltMaterial} position={[0, 0.1, -BOOK_DEPTH / 2 + 0.03]}>
          <boxGeometry args={[0.15, 0.03, 0.04]} />
        </mesh>
        <mesh material={ribbonMaterial} position={[0.22, 0.13, BOOK_DEPTH / 2 - 0.06]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.07, 0.012, 0.5]} />
        </mesh>
        <mesh
          material={ribbonMaterial}
          position={[0.26, 0.09, BOOK_DEPTH / 2 + 0.16]}
          rotation={[0.5, 0.2, 0]}
        >
          <boxGeometry args={[0.07, 0.012, 0.22]} />
        </mesh>
      </group>

      {/* Spills the glow onto the table top and the underside of the label above. */}
      <pointLight ref={glowRef} position={[0, 0.62, 0.2]} color="#ffcf8f" intensity={2} distance={7} decay={2} />
    </group>
  );
}

/**
 * "Overview" in extruded 3D above the book — the same treatment the meadow's
 * portals give their section labels, down to the material: display-face
 * outlines through `TextGeometry`, bevelled, glowing the same violet, on the
 * same gentle bob.
 *
 * Matching them is the point. Everywhere else on the site, floating violet text
 * over a glowing object is the mark of something that opens a panel, and the
 * book is the one such object in this room.
 */
function FloatingLabel() {
  const group = useRef<THREE.Group>(null!);

  const geometry = useMemo(() => {
    const text = new TextGeometry(LABEL, {
      font: getDisplayFont(),
      size: displaySize(LABEL_CAP_HEIGHT),
      depth: 0.14,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.014,
      bevelSegments: 2,
    });
    // TextGeometry lays glyphs out rightward from the origin, so without this the
    // label would hang off to one side of the table.
    text.center();
    return text;
  }, []);

  // The portal label material from `three/Portals.tsx`, value for value.
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f4e8ff",
        emissive: new THREE.Color("#a855f7"),
        emissiveIntensity: 1.4,
        roughness: 0.35,
        metalness: 0,
      }),
    []
  );

  useFrame((state) => {
    if (!group.current) return;
    group.current.position.y = LABEL_Y + Math.sin(state.clock.elapsedTime * BOB_SPEED) * BOB_HEIGHT;
  });

  return (
    <group ref={group} position={[TABLE_CENTER[0], LABEL_Y, TABLE_CENTER[1]]}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

/** The table, the book on it, and the label floating over both. */
export function Centrepiece() {
  return (
    <group>
      <Table />
      <OpenBook />
      <FloatingLabel />
    </group>
  );
}
