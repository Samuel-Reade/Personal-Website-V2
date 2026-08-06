import * as THREE from "three";

/**
 * The rowboat's hull, lofted from cross-sections rather than assembled from
 * boxes. A boat is the one prop in this world the player looks at constantly,
 * from directly behind, for the whole visit — a box-built approximation reads as
 * a crate the moment the camera settles on it, whereas a lofted hull gets a real
 * sheer line and a pointed bow for about the same triangle count.
 *
 * Sections run stern (index 0, -Z) to bow (+Z), because the character's forward
 * is local +Z — see the meadow's Player, whose `rotation.y = f` points local +Z
 * along (sin f, cos f).
 */

interface Section {
  z: number;
  /** Half-width at the gunwale. */
  halfWidth: number;
  /** Height of the keel line, which rises toward both ends. */
  keelY: number;
  /** Height of the gunwale, which also rises toward both ends — this is the sheer. */
  rimY: number;
}

const SECTIONS: Section[] = [
  { z: -1.5, halfWidth: 0.33, keelY: 0.13, rimY: 0.63 },
  { z: -1.2, halfWidth: 0.43, keelY: 0.05, rimY: 0.6 },
  { z: -0.45, halfWidth: 0.52, keelY: 0.0, rimY: 0.57 },
  { z: 0.35, halfWidth: 0.51, keelY: 0.0, rimY: 0.57 },
  { z: 1.05, halfWidth: 0.36, keelY: 0.04, rimY: 0.61 },
  { z: 1.55, halfWidth: 0.08, keelY: 0.18, rimY: 0.69 },
];

/** Half-length and half-beam of the hull, exported so the boat can sample the water under all of it. */
export const HULL_HALF_LENGTH = 1.55;
export const HULL_HALF_BEAM = 0.55;

/** How far in from the gunwale the interior floor sits. */
const DECK_INSET = 0.84;
/**
 * Interior floor height. This is freeboard, and it is load-bearing: the boat
 * floats at the highest point the water reaches under its hull, and measurement
 * shows the surface can still rise another 0.09 above that between sample
 * points. At the original 0.16 the deck sat 0.04 above the float height and the
 * sea visibly washed through the inside of the boat. 0.34 clears it with margin.
 */
export const DECK_Y = 0.34;
/** Width of the flat lip along the top of the hull. */
const GUNWALE_WIDTH = 0.05;

function keel(s: Section): [number, number, number] {
  return [0, s.keelY, s.z];
}
function rim(s: Section, side: number): [number, number, number] {
  return [side * s.halfWidth, s.rimY, s.z];
}

function toGeometry(positions: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export interface BoatGeometry {
  hull: THREE.BufferGeometry;
  deck: THREE.BufferGeometry;
  gunwale: THREE.BufferGeometry;
  dispose: () => void;
}

export function buildBoatGeometry(): BoatGeometry {
  const hull: number[] = [];
  const deck: number[] = [];
  const gunwale: number[] = [];

  for (let i = 0; i < SECTIONS.length - 1; i++) {
    const a = SECTIONS[i];
    const b = SECTIONS[i + 1];

    // Starboard (+X) and port (-X) skins. The two sides need opposite winding:
    // mirroring the vertices across X flips each triangle's handedness, so
    // reusing one order would light the port side from inside the hull.
    hull.push(...keel(a), ...rim(b, 1), ...keel(b));
    hull.push(...keel(a), ...rim(a, 1), ...rim(b, 1));
    hull.push(...keel(a), ...keel(b), ...rim(b, -1));
    hull.push(...keel(a), ...rim(b, -1), ...rim(a, -1));

    // Interior floor, so looking down into the boat from the chase camera shows
    // a deck rather than straight through the open top and out the bottom.
    const pa: [number, number, number] = [-a.halfWidth * DECK_INSET, DECK_Y, a.z];
    const pb: [number, number, number] = [-b.halfWidth * DECK_INSET, DECK_Y, b.z];
    const sa: [number, number, number] = [a.halfWidth * DECK_INSET, DECK_Y, a.z];
    const sb: [number, number, number] = [b.halfWidth * DECK_INSET, DECK_Y, b.z];
    deck.push(...pa, ...pb, ...sb);
    deck.push(...pa, ...sb, ...sa);

    // The flat lip capping the hull's top edge, both sides.
    for (const side of [1, -1]) {
      const inA: [number, number, number] = [side * a.halfWidth, a.rimY, a.z];
      const inB: [number, number, number] = [side * b.halfWidth, b.rimY, b.z];
      const outA: [number, number, number] = [side * (a.halfWidth + GUNWALE_WIDTH), a.rimY, a.z];
      const outB: [number, number, number] = [side * (b.halfWidth + GUNWALE_WIDTH), b.rimY, b.z];
      if (side === 1) {
        gunwale.push(...inA, ...inB, ...outB);
        gunwale.push(...inA, ...outB, ...outA);
      } else {
        gunwale.push(...inA, ...outB, ...inB);
        gunwale.push(...inA, ...outA, ...outB);
      }
    }
  }

  // Close both ends. Without these the hull is an open tube and the sea shows
  // through the transom.
  const stern = SECTIONS[0];
  const bow = SECTIONS[SECTIONS.length - 1];
  hull.push(...keel(stern), ...rim(stern, -1), ...rim(stern, 1));
  hull.push(...keel(bow), ...rim(bow, 1), ...rim(bow, -1));

  const hullGeometry = toGeometry(hull);
  const deckGeometry = toGeometry(deck);
  const gunwaleGeometry = toGeometry(gunwale);

  return {
    hull: hullGeometry,
    deck: deckGeometry,
    gunwale: gunwaleGeometry,
    dispose: () => {
      hullGeometry.dispose();
      deckGeometry.dispose();
      gunwaleGeometry.dispose();
    },
  };
}
