import * as THREE from "three";

/**
 * Lofted body parts: a stack of cross-sections skinned into one closed surface.
 *
 * The character's limbs used to be `RoundedBox`es, which gave them a constant
 * cross-section from joint to joint — and with a corner radius eating most of
 * that cross-section (the upper arm was 0.145 wide with a 0.058 radius) what was
 * left was a capsule. A real limb is nowhere near constant: a thigh fills the
 * trouser at the hip and draws in by a third at the knee, a calf swells below
 * the joint and narrows to an ankle half its width. That taper is most of what
 * separates a body from a balloon animal, and there is no primitive for it —
 * `CylinderGeometry` tapers but only between two radii and only in a circle.
 *
 * So parts are described as a profile instead: a few rings down the length, each
 * with its own width and depth, skinned top to bottom.
 */

/** One cross-section through a limb or the torso. */
export interface BodyRing {
  /** Height in the part's local space. Rings run top to bottom. */
  y: number;
  /** Half-width, across the body. */
  rx: number;
  /** Half-depth, front to back. */
  rz: number;
}

export interface BodyGeometryOptions {
  /** Vertices around each ring. 20 is smooth at the size these parts are drawn. */
  segments?: number;
  /**
   * Cross-section shape, as the exponent n of the superellipse
   * `|x/rx|^n + |z/rz|^n = 1`.
   *
   * At n = 2 this is exactly an ellipse, which is the right section for an arm
   * or a leg. Raising it squares the corners off toward a rounded rectangle:
   * the torso runs at 3.4, where the front face is flat to within half a
   * millimetre across the width of the shirt panel, so the lapels, collar and
   * tie still sit on a plane rather than floating off a curve — while the
   * corners stay soft enough to read as a draped jacket.
   */
  squareness?: number;
}

/**
 * Skins `rings` into a closed surface. Rings must be ordered top to bottom;
 * consecutive rings are joined by a band of quads, and each end is capped.
 */
export function createBodyGeometry(
  rings: BodyRing[],
  { segments = 20, squareness = 2 }: BodyGeometryOptions = {}
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  // The superellipse in parametric form is |cos|^(2/n) — at n = 2 the exponent
  // is 1 and this collapses to the plain cosine of an ellipse.
  const power = 2 / squareness;

  for (const ring of rings) {
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      positions.push(
        ring.rx * Math.sign(cos) * Math.abs(cos) ** power,
        ring.y,
        ring.rz * Math.sign(sin) * Math.abs(sin) ** power
      );
    }
  }

  // Wrapping s with a modulo shares the seam vertices rather than duplicating
  // them, so `computeVertexNormals` smooths straight through the seam instead
  // of leaving a visible crease down the back of every limb.
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < segments; s++) {
      const next = (s + 1) % segments;
      const a = r * segments + s;
      const b = r * segments + next;
      const c = (r + 1) * segments + s;
      const d = (r + 1) * segments + next;
      indices.push(a, b, c, b, d, c);
    }
  }

  // Flat caps. Every one of them ends up inside something — a shoulder, a knee,
  // a shoe, the collar — so they are never actually seen; they are here so each
  // part is a closed solid, which is what drei's <Outlines> needs to expand into
  // a clean silhouette rather than a stroke with a hole at each end.
  const lastRing = rings.length - 1;
  const topCenter = positions.length / 3;
  positions.push(0, rings[0].y, 0);
  const bottomCenter = topCenter + 1;
  positions.push(0, rings[lastRing].y, 0);
  for (let s = 0; s < segments; s++) {
    const next = (s + 1) % segments;
    indices.push(topCenter, next, s);
    indices.push(bottomCenter, lastRing * segments + s, lastRing * segments + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
