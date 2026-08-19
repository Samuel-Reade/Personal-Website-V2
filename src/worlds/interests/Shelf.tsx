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
 * Pitch of a book in a run. Fixed rather than jittered per volume, so a run's
 * total span is exactly `count * BOOK_PITCH` — which is what lets the layout
 * declare a halfWidth for it and have that number be true. The jitter goes into
 * height and lean instead, where it costs nothing.
 */
const BOOK_PITCH = 0.05;

/**
 * A run of plain books, leaning slightly, filling dead space on a tier.
 *
 * Each spine carries two raised bands with a label between them and a cap at
 * head and tail, which is what a book has and a coloured box does not. One
 * volume lies flat across the top of every run, since a shelf nobody tidies
 * always has one.
 */
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
  const shortest = Math.min(...books.map((b) => b.height));

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
          {/* Raised bands across the spine, with the label between them. */}
          {[0.78, 0.26].map((f, b) => (
            <mesh
              key={b}
              material={flatMat(book.color)}
              position={[0, book.height * f, -0.0715]}
            >
              <boxGeometry args={[book.width * 1.05, 0.007, 0.005]} />
            </mesh>
          ))}
          <mesh material={flatMat(PALETTE.bookPages)} position={[0, book.height * 0.52, -0.0725]}>
            <boxGeometry args={[book.width * 0.6, book.height * 0.16, 0.003]} />
          </mesh>
          {/* Head and tail caps at the ends of the spine. */}
          {[0.985, 0.015].map((f, c) => (
            <mesh
              key={c}
              material={flatMat(PALETTE.bookPages)}
              position={[0, book.height * f, -0.069]}
            >
              <boxGeometry args={[book.width * 0.7, 0.005, 0.008]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* The one laid flat across the top of the run. */}
      <group position={[span * 0.5, shortest + 0.015, 0.005]} rotation={[0, 0.12, 0]}>
        <mesh material={flatMat(spines[(count + 2) % spines.length])}>
          <boxGeometry args={[BOOK_PITCH * 1.7, 0.026, 0.135]} />
        </mesh>
        <mesh material={flatMat(PALETTE.bookPages)} position={[0, 0, 0.003]}>
          <boxGeometry args={[BOOK_PITCH * 1.62, 0.017, 0.137]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A potted plant: a thrown pot with a rolled rim standing in a saucer, soil in
 * it, and blades in two greens fanning out of the soil rather than out of the
 * pot's mouth — which is the difference between a plant and cones in a cup.
 */
function PottedPlant() {
  const blades: [number, number, number, number][] = [
    [0, 0, 0, 0.17],
    [0.03, 0.014, 0.44, 0.14],
    [-0.028, 0.02, -0.4, 0.13],
    [0.01, -0.032, 0.3, 0.115],
    [-0.02, -0.026, -0.24, 0.1],
    [0.034, -0.016, 0.56, 0.09],
    [-0.036, 0.006, -0.58, 0.085],
  ];
  return (
    <group>
      <mesh material={flatMat(PALETTE.potRim)} position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.07, 0.064, 0.012, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.potTerracotta)} position={[0, 0.058, 0]}>
        <cylinderGeometry args={[0.062, 0.046, 0.092, 8]} />
      </mesh>
      {/* A band round the belly, and the rolled rim at the mouth. */}
      <mesh material={flatMat(PALETTE.potRim)} position={[0, 0.072, 0]}>
        <cylinderGeometry args={[0.0595, 0.0595, 0.006, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.potRim)} position={[0, 0.104, 0]}>
        <cylinderGeometry args={[0.068, 0.068, 0.016, 8]} />
      </mesh>
      {/* Soil, sunk just below the rim. */}
      <mesh material={flatMat(PALETTE.soil)} position={[0, 0.106, 0]}>
        <cylinderGeometry args={[0.062, 0.062, 0.01, 8]} />
      </mesh>

      {blades.map(([x, z, tilt, h], i) => (
        <group key={i} position={[x, 0.108, z]} rotation={[0, i * 1.25, tilt]}>
          <mesh
            material={flatMat(i % 2 === 0 ? PALETTE.leaf : PALETTE.leafDark)}
            position={[0, h / 2, 0]}
          >
            <coneGeometry args={[0.036, h, 5]} />
          </mesh>
          {/* The rib up the middle of the blade. */}
          <mesh
            material={flatMat(i % 2 === 0 ? PALETTE.leafDark : PALETTE.leaf)}
            position={[0, h * 0.42, 0]}
          >
            <coneGeometry args={[0.009, h * 0.8, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * A candle on a turned dish: wax with a drip run over the side, a wick, and the
 * flame.
 */
function Candle({ height = 0.16 }: { height?: number }) {
  const top = 0.024 + height;
  return (
    <group>
      <mesh material={flatMat(PALETTE.wood)} position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.024, 7]} />
      </mesh>
      {/* A lip round the dish, so it reads as turned rather than as a puck. */}
      <mesh material={flatMat(PALETTE.woodEdge)} position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.05, 0.046, 0.006, 7]} />
      </mesh>
      <mesh material={flatMat(PALETTE.candleWax)} position={[0, 0.024 + height / 2, 0]}>
        <cylinderGeometry args={[0.026, 0.03, height, 7]} />
      </mesh>
      {/* The pooled top, and a drip that has run over the edge of it. */}
      <mesh material={flatMat(PALETTE.candleWax)} position={[0, top + 0.003, 0]}>
        <cylinderGeometry args={[0.028, 0.026, 0.008, 7]} />
      </mesh>
      <mesh material={flatMat(PALETTE.candleWax)} position={[0.024, top - 0.036, 0.008]}>
        <capsuleGeometry args={[0.005, 0.05, 2, 5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.candleWick)} position={[0, top + 0.012, 0]}>
        <cylinderGeometry args={[0.0018, 0.0018, 0.012, 4]} />
      </mesh>

      {/* The one emissive thing in the room, so it reads as the light source it
          is pretending to be. Two cones, so the flame has a hotter core than
          its edge rather than being one flat tone. */}
      <mesh material={glowMat(PALETTE.candleFlame, 1.6)} position={[0, top + 0.034, 0]}>
        <coneGeometry args={[0.016, 0.055, 5]} />
      </mesh>
      <mesh material={glowMat(PALETTE.candleFlameCore, 2.4)} position={[0, top + 0.028, 0]}>
        <coneGeometry args={[0.008, 0.03, 4]} />
      </mesh>
    </group>
  );
}

/** The carcass: uprights, boards, back panel, plinth and cornice. */
function Carcass() {
  const half = SHELF_WIDTH / 2;
  const innerWidth = SHELF_WIDTH - BOARD * 2;

  return (
    <group>
      {/* Uprights, each with a bead run down its front edge. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            material={flatMat(PALETTE.woodDark)}
            position={[side * (half - BOARD / 2), SHELF_HEIGHT / 2, 0]}
          >
            <boxGeometry args={[BOARD, SHELF_HEIGHT, SHELF_DEPTH]} />
          </mesh>
          <mesh
            material={flatMat(PALETTE.woodEdge)}
            position={[side * (half - BOARD / 2), SHELF_HEIGHT / 2, SHELF_DEPTH / 2 - 0.006]}
          >
            <boxGeometry args={[BOARD * 0.7, SHELF_HEIGHT - 0.2, 0.014]} />
          </mesh>
          {/* Shelf pins under each board, which is what a board this thin would
              actually be sitting on. */}
          {TIER_Y.map((y, i) => (
            <mesh
              key={i}
              material={flatMat(PALETTE.shelfPin)}
              position={[side * (half - BOARD), y - BOARD - 0.008, SHELF_DEPTH / 4]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.007, 0.007, 0.016, 6]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Back panel, inset so the boards read as let into it, with two boarded
          seams up it so it is not one flat sheet across three tiers. */}
      <mesh material={flatMat(PALETTE.backPanel)} position={[0, SHELF_HEIGHT / 2, BACK_PANEL_Z]}>
        <boxGeometry args={[innerWidth, SHELF_HEIGHT, 0.02]} />
      </mesh>
      {[-1.16, 0, 1.16].map((x, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.woodGrain)}
          position={[x, SHELF_HEIGHT / 2, BACK_PANEL_Z + 0.011]}
        >
          <boxGeometry args={[0.012, SHELF_HEIGHT, 0.003]} />
        </mesh>
      ))}

      {/* Standing boards, one per tier, plus the top. */}
      {[...TIER_Y, SHELF_HEIGHT - BOARD / 2].map((y, i) => (
        <mesh key={i} material={flatMat(PALETTE.wood)} position={[0, y - BOARD / 2, 0]}>
          <boxGeometry args={[innerWidth, BOARD, SHELF_DEPTH]} />
        </mesh>
      ))}

      {/* Front edge lipping on each board — a plain box edge-on reads as card. */}
      {TIER_Y.map((y, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.woodEdge)}
          position={[0, y - BOARD / 2, SHELF_DEPTH / 2 - 0.008]}
        >
          <boxGeometry args={[innerWidth, BOARD * 0.8, 0.016]} />
        </mesh>
      ))}
      {/* And a bead under each lip, which is what casts the line along the
          front of a real board. */}
      {TIER_Y.map((y, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.woodDark)}
          position={[0, y - BOARD - 0.004, SHELF_DEPTH / 2 - 0.012]}
        >
          <boxGeometry args={[innerWidth, 0.008, 0.02]} />
        </mesh>
      ))}

      {/* Plinth, so the unit meets the floor on a base rather than on two legs,
          with a moulding along its top and a recessed toe under it. */}
      <mesh material={flatMat(PALETTE.woodDark)} position={[0, 0.085, 0]}>
        <boxGeometry args={[SHELF_WIDTH, 0.13, SHELF_DEPTH]} />
      </mesh>
      <mesh material={flatMat(PALETTE.woodEdge)} position={[0, 0.156, 0]}>
        <boxGeometry args={[SHELF_WIDTH + 0.02, 0.016, SHELF_DEPTH + 0.014]} />
      </mesh>
      <mesh material={flatMat(PALETTE.backPanel)} position={[0, 0.01, SHELF_DEPTH / 2 - 0.03]}>
        <boxGeometry args={[SHELF_WIDTH - 0.24, 0.02, 0.06]} />
      </mesh>

      {/* Cornice, in two courses so it steps out rather than sitting on as a slab. */}
      <mesh material={flatMat(PALETTE.wood)} position={[0, SHELF_HEIGHT + 0.014, 0]}>
        <boxGeometry args={[SHELF_WIDTH + 0.03, 0.028, SHELF_DEPTH + 0.02]} />
      </mesh>
      <mesh material={flatMat(PALETTE.woodEdge)} position={[0, SHELF_HEIGHT + 0.044, 0]}>
        <boxGeometry args={[SHELF_WIDTH + 0.07, 0.032, SHELF_DEPTH + 0.05]} />
      </mesh>
      <mesh material={flatMat(PALETTE.woodDark)} position={[0, SHELF_HEIGHT + 0.065, 0]}>
        <boxGeometry args={[SHELF_WIDTH + 0.05, 0.01, SHELF_DEPTH + 0.03]} />
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
      {/* A picture rail high on the wall, above everything on the unit, and a
          dado line below it — the two horizontals a room like this would have,
          and enough to stop the wall reading as an infinite backdrop. */}
      <mesh material={flatMat(PALETTE.wallTrim)} position={[0, 2.62, BACK_PANEL_Z - 0.105]}>
        <boxGeometry args={[11, 0.05, 0.022]} />
      </mesh>
      <mesh material={flatMat(PALETTE.wallTrim)} position={[0, 0.95, BACK_PANEL_Z - 0.105]}>
        <boxGeometry args={[11, 0.026, 0.014]} />
      </mesh>

      <mesh material={flatMat(PALETTE.floor)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.4]}>
        <planeGeometry args={[11, 6]} />
      </mesh>
      {/* Floorboards, as a few seams running out from the unit. */}
      {[-2.4, -1.2, 0, 1.2, 2.4].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.floorAlt)} position={[x, 0.002, 1.4]}>
          <boxGeometry args={[0.016, 0.002, 6]} />
        </mesh>
      ))}
      {/* A rug's edge, breaking up what would be an unbroken sheet of floor. */}
      <mesh material={flatMat(PALETTE.floorAlt)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 2.1]}>
        <planeGeometry args={[4.6, 2.4]} />
      </mesh>
      <mesh material={flatMat(PALETTE.wallTrim)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 2.1]}>
        <planeGeometry args={[4.36, 2.16]} />
      </mesh>
      {/* Skirting, in two courses so it has a cap. */}
      <mesh material={flatMat(PALETTE.wallTrim)} position={[0, 0.07, BACK_PANEL_Z - 0.09]}>
        <boxGeometry args={[11, 0.14, 0.04]} />
      </mesh>
      <mesh material={flatMat(PALETTE.wall)} position={[0, 0.145, BACK_PANEL_Z - 0.085]}>
        <boxGeometry args={[11, 0.016, 0.05]} />
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
