import { PALETTE } from "./palette";
import { flatMat, glowMat, seeded } from "./materials";
import {
  DRESSING,
  type DressingSpot,
  BACK_PANEL_Z,
  BOARD,
  SHELF_DEPTH,
  SHELF_HEIGHT,
  SHELF_WIDTH,
  TIER_Y,
} from "./layout";

/**
 * The unit itself and the room it stands in, plus the dressing that makes the
 * shelf look lived in — none of it interactive. Everything is primitives with
 * deliberately low segment counts, so the facets stay visible.
 */

/**
 * A run of plain books, leaning slightly, filling dead space on a tier.
 *
 * Books are laid on a fixed pitch rather than at jittered widths, so the run's
 * total span is exactly `count * BOOK_PITCH` — which is what lets the layout
 * declare a halfWidth for it and have that number be true. The jitter goes into
 * height and lean instead, where it costs nothing.
 */
const BOOK_PITCH = 0.05;

function BookRun({ count, seed }: { count: number; seed: number }) {
  const spines = [PALETTE.bookA, PALETTE.bookB, PALETTE.bookC, PALETTE.bookD, PALETTE.bookE];
  const books = Array.from({ length: count }, (_, i) => ({
    x: (i + 0.5) * BOOK_PITCH,
    width: BOOK_PITCH * 0.86,
    height: 0.19 + seeded(seed + i * 7.7) * 0.09,
    // Every few books one leans, which is what stops the run reading as a
    // single extruded block.
    lean: seeded(seed + i * 11.3) < 0.28 ? (seeded(seed + i * 5.9) - 0.5) * 0.42 : 0,
    color: spines[i % spines.length],
  }));
  const span = count * BOOK_PITCH;

  return (
    <group position={[-span / 2, 0, 0]}>
      {books.map((book, i) => (
        <group key={i} position={[book.x, 0, 0]} rotation={[0, 0, book.lean]}>
          <mesh material={flatMat(book.color)} position={[0, book.height / 2, 0]}>
            <boxGeometry args={[book.width, book.height, 0.14]} />
          </mesh>
          {/* Page block, just proud of the spine on the front edge. */}
          <mesh material={flatMat(PALETTE.bookPages)} position={[0, book.height / 2, 0.072]}>
            <boxGeometry args={[book.width * 0.8, book.height * 0.88, 0.008]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function PottedPlant() {
  const blades: [number, number, number, number][] = [
    [0, 0, 0, 0.17],
    [0.03, 0.014, 0.44, 0.14],
    [-0.028, 0.02, -0.4, 0.13],
    [0.01, -0.032, 0.3, 0.115],
    [-0.02, -0.026, -0.24, 0.1],
  ];
  return (
    <group>
      <mesh material={flatMat(PALETTE.potTerracotta)} position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.062, 0.046, 0.1, 6]} />
      </mesh>
      <mesh material={flatMat(PALETTE.potTerracotta)} position={[0, 0.104, 0]}>
        <cylinderGeometry args={[0.068, 0.068, 0.016, 6]} />
      </mesh>
      {blades.map(([x, z, tilt, h], i) => (
        <mesh
          key={i}
          material={flatMat(i % 2 === 0 ? PALETTE.leaf : PALETTE.leafDark)}
          position={[x, 0.11 + h / 2, z]}
          rotation={[0, i * 1.25, tilt]}
        >
          <coneGeometry args={[0.036, h, 5]} />
        </mesh>
      ))}
    </group>
  );
}

function Candle({ height = 0.16 }: { height?: number }) {
  return (
    <group>
      <mesh material={flatMat(PALETTE.wood)} position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.024, 7]} />
      </mesh>
      <mesh material={flatMat(PALETTE.candleWax)} position={[0, 0.024 + height / 2, 0]}>
        <cylinderGeometry args={[0.026, 0.03, height, 7]} />
      </mesh>
      {/* The one emissive thing in the room, so it reads as the light source it
          is pretending to be. */}
      <mesh material={glowMat(PALETTE.candleFlame, 1.6)} position={[0, 0.024 + height + 0.028, 0]}>
        <coneGeometry args={[0.016, 0.055, 5]} />
      </mesh>
    </group>
  );
}

/** The carcass: uprights, boards, back panel and a plinth. */
function Carcass() {
  const half = SHELF_WIDTH / 2;

  return (
    <group>
      {/* Uprights */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={flatMat(PALETTE.woodDark)}
          position={[side * (half - BOARD / 2), SHELF_HEIGHT / 2, 0]}
        >
          <boxGeometry args={[BOARD, SHELF_HEIGHT, SHELF_DEPTH]} />
        </mesh>
      ))}

      {/* Back panel, inset so the boards read as let into it. */}
      <mesh material={flatMat(PALETTE.backPanel)} position={[0, SHELF_HEIGHT / 2, BACK_PANEL_Z]}>
        <boxGeometry args={[SHELF_WIDTH - BOARD * 2, SHELF_HEIGHT, 0.02]} />
      </mesh>

      {/* Standing boards, one per tier, plus the top. */}
      {[...TIER_Y, SHELF_HEIGHT - BOARD / 2].map((y, i) => (
        <mesh key={i} material={flatMat(PALETTE.wood)} position={[0, y - BOARD / 2, 0]}>
          <boxGeometry args={[SHELF_WIDTH - BOARD * 2, BOARD, SHELF_DEPTH]} />
        </mesh>
      ))}

      {/* Front edge lipping on each board — a plain box edge-on reads as card. */}
      {TIER_Y.map((y, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.woodEdge)}
          position={[0, y - BOARD / 2, SHELF_DEPTH / 2 - 0.008]}
        >
          <boxGeometry args={[SHELF_WIDTH - BOARD * 2, BOARD * 0.8, 0.016]} />
        </mesh>
      ))}

      {/* Plinth, so the unit meets the floor on a base rather than on two legs. */}
      <mesh material={flatMat(PALETTE.woodDark)} position={[0, 0.075, 0]}>
        <boxGeometry args={[SHELF_WIDTH, 0.15, SHELF_DEPTH]} />
      </mesh>
      {/* Cornice */}
      <mesh material={flatMat(PALETTE.woodEdge)} position={[0, SHELF_HEIGHT + 0.03, 0]}>
        <boxGeometry args={[SHELF_WIDTH + 0.07, 0.06, SHELF_DEPTH + 0.05]} />
      </mesh>
    </group>
  );
}

/** The room. Only what the fixed camera can actually see. */
function Room() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.wall)} position={[0, 1.9, BACK_PANEL_Z - 0.16]}>
        <boxGeometry args={[11, 5.6, 0.1]} />
      </mesh>
      <mesh material={flatMat(PALETTE.floor)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.4]}>
        <planeGeometry args={[11, 6]} />
      </mesh>
      {/* A rug's edge, breaking up what would be an unbroken sheet of floor. */}
      <mesh material={flatMat(PALETTE.floorAlt)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 2.1]}>
        <planeGeometry args={[4.6, 2.4]} />
      </mesh>
      {/* Skirting */}
      <mesh material={flatMat(PALETTE.wallTrim)} position={[0, 0.07, BACK_PANEL_Z - 0.09]}>
        <boxGeometry args={[11, 0.14, 0.04]} />
      </mesh>
    </group>
  );
}

/** Renders one dressing entry. */
function Dressing({ spot }: { spot: DressingSpot }) {
  switch (spot.kind) {
    case "books":
      return <BookRun count={spot.count ?? 3} seed={spot.x * 97 + spot.tier * 13} />;
    case "plant":
      return <PottedPlant />;
    case "candle":
      return <Candle height={spot.height} />;
  }
}

/**
 * The unit, the room, and the dressing that makes the shelf look lived in.
 * Dressing positions come from the layout rather than being written in here, so
 * they can be checked against the ten interactive objects for overlap.
 */
export function Shelf() {
  return (
    <group>
      <Room />
      <Carcass />

      {DRESSING.map((spot, i) => (
        <group
          key={i}
          position={[spot.x, TIER_Y[spot.tier], spot.z]}
          rotation={[0, spot.rotationY, 0]}
        >
          <Dressing spot={spot} />
        </group>
      ))}
    </group>
  );
}
