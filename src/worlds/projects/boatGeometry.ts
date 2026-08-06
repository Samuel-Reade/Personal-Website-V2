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
 *
 * The hull is built as a genuinely closed solid: an outer skin, an inner skin,
 * a floor, and caps at both ends and both surfaces. Every visible face is
 * front-facing, so nothing relies on double-sided materials. An earlier version
 * drew only the outer skin, which left the inside of the far gunwale culled and
 * the sea visible straight through the middle of the boat.
 */

interface Section {
  z: number;
  /**
   * Half-width of the flat bottom. A dory chine rather than a knife keel: a
   * V-hull's interior pinches to nothing at floor height, leaving a floor too
   * narrow to seat anyone on.
   */
  bottomHalfWidth: number;
  /** Height of the bottom, which rises toward both ends. */
  bottomY: number;
  /** Half-width at the gunwale. */
  halfWidth: number;
  /** Height of the gunwale — this is the sheer line. */
  rimY: number;
}

const SECTIONS: Section[] = [
  { z: -1.5, bottomHalfWidth: 0.16, bottomY: 0.16, halfWidth: 0.33, rimY: 0.63 },
  { z: -1.2, bottomHalfWidth: 0.26, bottomY: 0.07, halfWidth: 0.43, rimY: 0.6 },
  { z: -0.45, bottomHalfWidth: 0.34, bottomY: 0.0, halfWidth: 0.52, rimY: 0.57 },
  { z: 0.35, bottomHalfWidth: 0.33, bottomY: 0.0, halfWidth: 0.51, rimY: 0.57 },
  { z: 1.05, bottomHalfWidth: 0.2, bottomY: 0.05, halfWidth: 0.36, rimY: 0.61 },
  { z: 1.55, bottomHalfWidth: 0.04, bottomY: 0.2, halfWidth: 0.08, rimY: 0.69 },
];

/** Half-length and half-beam of the hull, exported so the boat can sample the water under all of it. */
export const HULL_HALF_LENGTH = 1.55;
export const HULL_HALF_BEAM = 0.55;

/**
 * Interior floor height. This is freeboard, and it is load-bearing: the boat
 * floats at the highest point the water reaches under its hull, and measurement
 * shows the surface can still rise another 0.09 above that between sample
 * points. At 0.16 the deck sat 0.04 above the float height and the sea visibly
 * washed through the inside of the boat. 0.34 clears it with margin.
 */
export const DECK_Y = 0.34;
/** Width of the flat lip along the top of the hull. */
const GUNWALE_WIDTH = 0.05;

type Vec3 = [number, number, number];

function bottom(s: Section, side: number): Vec3 {
  return [side * s.bottomHalfWidth, s.bottomY, s.z];
}
function rim(s: Section, side: number): Vec3 {
  return [side * s.halfWidth, s.rimY, s.z];
}

/**
 * Half-width of the hull at an arbitrary height, by interpolating the section's
 * flare from chine to gunwale. The floor is sized from this rather than from a
 * fixed fraction of the beam — the previous fixed 0.84 made the floor wider than
 * the hull containing it at every station, so the slab jutted out through both
 * sides of the boat.
 */
function halfWidthAt(s: Section, y: number): number {
  const t = THREE.MathUtils.clamp((y - s.bottomY) / (s.rimY - s.bottomY), 0, 1);
  return s.bottomHalfWidth + t * (s.halfWidth - s.bottomHalfWidth);
}

function deckEdge(s: Section, side: number): Vec3 {
  return [side * halfWidthAt(s, DECK_Y), DECK_Y, s.z];
}

function toGeometry(positions: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export interface BoatGeometry {
  /** Outer skin: bottom, both topsides, and the caps at bow and stern. */
  hull: THREE.BufferGeometry;
  /** Everything seen from inside the boat: floor, inner topsides, inner caps. */
  interior: THREE.BufferGeometry;
  gunwale: THREE.BufferGeometry;
  dispose: () => void;
}

export function buildBoatGeometry(): BoatGeometry {
  const hull: number[] = [];
  const interior: number[] = [];
  const gunwale: number[] = [];

  for (let i = 0; i < SECTIONS.length - 1; i++) {
    const a = SECTIONS[i];
    const b = SECTIONS[i + 1];

    // --- Outer bottom, wound to face down.
    hull.push(...bottom(a, -1), ...bottom(a, 1), ...bottom(b, 1));
    hull.push(...bottom(a, -1), ...bottom(b, 1), ...bottom(b, -1));

    // --- Outer topsides, chine up to gunwale. The two sides need opposite
    // winding: mirroring the vertices across X flips each triangle's
    // handedness, so reusing one order would light the port side from inside.
    hull.push(...bottom(a, 1), ...rim(a, 1), ...rim(b, 1));
    hull.push(...bottom(a, 1), ...rim(b, 1), ...bottom(b, 1));
    hull.push(...bottom(a, -1), ...rim(b, -1), ...rim(a, -1));
    hull.push(...bottom(a, -1), ...bottom(b, -1), ...rim(b, -1));

    // --- Interior floor, wound to face up.
    interior.push(...deckEdge(a, -1), ...deckEdge(b, -1), ...deckEdge(b, 1));
    interior.push(...deckEdge(a, -1), ...deckEdge(b, 1), ...deckEdge(a, 1));

    // --- Inner topsides, floor edge up to gunwale, facing inward. These are the
    // faces the chase camera actually looks at when it looks into the boat.
    interior.push(...deckEdge(a, 1), ...rim(b, 1), ...rim(a, 1));
    interior.push(...deckEdge(a, 1), ...deckEdge(b, 1), ...rim(b, 1));
    interior.push(...deckEdge(a, -1), ...rim(a, -1), ...rim(b, -1));
    interior.push(...deckEdge(a, -1), ...rim(b, -1), ...deckEdge(b, -1));

    // --- The flat lip capping the hull's top edge, both sides.
    for (const side of [1, -1]) {
      const inA: Vec3 = [side * a.halfWidth, a.rimY, a.z];
      const inB: Vec3 = [side * b.halfWidth, b.rimY, b.z];
      const outA: Vec3 = [side * (a.halfWidth + GUNWALE_WIDTH), a.rimY, a.z];
      const outB: Vec3 = [side * (b.halfWidth + GUNWALE_WIDTH), b.rimY, b.z];
      if (side === 1) {
        gunwale.push(...inA, ...inB, ...outB);
        gunwale.push(...inA, ...outB, ...outA);
      } else {
        gunwale.push(...inA, ...outB, ...inB);
        gunwale.push(...inA, ...outA, ...outB);
      }
    }
  }

  const stern = SECTIONS[0];
  const bow = SECTIONS[SECTIONS.length - 1];

  // --- Outer transom and stem, closing both ends of the shell.
  hull.push(...bottom(stern, -1), ...rim(stern, 1), ...bottom(stern, 1));
  hull.push(...bottom(stern, -1), ...rim(stern, -1), ...rim(stern, 1));
  hull.push(...bottom(bow, -1), ...bottom(bow, 1), ...rim(bow, 1));
  hull.push(...bottom(bow, -1), ...rim(bow, 1), ...rim(bow, -1));

  // --- And their inner faces, above the floor, so the ends of the boat are not
  // see-through either.
  interior.push(...deckEdge(stern, -1), ...deckEdge(stern, 1), ...rim(stern, 1));
  interior.push(...deckEdge(stern, -1), ...rim(stern, 1), ...rim(stern, -1));
  interior.push(...deckEdge(bow, -1), ...rim(bow, 1), ...deckEdge(bow, 1));
  interior.push(...deckEdge(bow, -1), ...rim(bow, -1), ...rim(bow, 1));

  const hullGeometry = toGeometry(hull);
  const interiorGeometry = toGeometry(interior);
  const gunwaleGeometry = toGeometry(gunwale);

  return {
    hull: hullGeometry,
    interior: interiorGeometry,
    gunwale: gunwaleGeometry,
    dispose: () => {
      hullGeometry.dispose();
      interiorGeometry.dispose();
      gunwaleGeometry.dispose();
    },
  };
}
