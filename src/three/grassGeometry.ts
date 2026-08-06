import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Half-width of a blade at its base. Deliberately broad against the ~0.6
 * height: each blade should read as its own stylized shape at a glance rather
 * than as fine detail, matching the chunky language of the trees and character.
 */
const BLADE_HALF_WIDTH = 0.075;
/** Rows of quads up a blade. Enough to carry a curve, few enough to stay chunky. */
const BLADE_ROWS = 4;
/** How far a blade tilts away from its clump's center. */
const SPLAY = 0.2;

/**
 * One blade: a strip of quads whose width follows `sqrt(1 - t^3)`, so it stays
 * broad through most of its length and then closes off near the top. A plain
 * linear taper reads as a thin spike from any distance; this keeps the blade
 * shape legible and rounds its shoulders.
 */
function buildBlade(height: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= BLADE_ROWS; row++) {
    const t = row / BLADE_ROWS;
    const halfWidth = BLADE_HALF_WIDTH * Math.sqrt(Math.max(0, 1 - t * t * t));
    const y = t * height;
    // A little forward curl, strongest at the tip.
    const z = t * t * 0.05;
    positions.push(-halfWidth, y, z, halfWidth, y, z);
  }

  for (let row = 0; row < BLADE_ROWS; row++) {
    const a = row * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }

  const blade = new THREE.BufferGeometry();
  blade.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  blade.setIndex(indices);
  blade.computeVertexNormals();
  return blade;
}

/**
 * A clump of a few broad blades splayed outward from a shared root, so the
 * clump silhouette is a rounded tuft rather than three separate uprights —
 * the same "few large rounded forms" shape language as the tree canopies.
 * `heightScale` lets shorter grass reuse the exact same blade shape.
 */
export function buildClumpGeometry(heightScale = 1): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const bladeCount = 3;

  for (let i = 0; i < bladeCount; i++) {
    const height = (0.5 + Math.random() * 0.22) * heightScale;
    const blade = buildBlade(height);
    blade.rotateZ(SPLAY + Math.random() * 0.16);
    // Spread over the full circle (rather than a half-turn) because the splay
    // now gives each blade a direction to point in.
    blade.rotateY((i / bladeCount) * Math.PI * 2 + Math.random() * 0.4);
    blades.push(blade);
  }
  const clump = mergeGeometries(blades);

  // A shared lean direction (independent of each blade's own rotation) so the
  // whole field reads as wind-blown at rest, not just wiggling in place.
  const clumpPos = clump.attributes.position as THREE.BufferAttribute;
  for (let v = 0; v < clumpPos.count; v++) {
    const y = clumpPos.getY(v);
    clumpPos.setX(v, clumpPos.getX(v) + y * y * 0.22);
  }
  clump.computeVertexNormals();

  return clump;
}
