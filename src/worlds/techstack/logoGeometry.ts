import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * Turns a 24x24 SVG path into real extruded geometry for a chip face.
 *
 * Extrusion rather than a texture is what gives the marks their depth — at a
 * grazing angle a chip shows the *side* of its logo, which a flat decal can't
 * do. The cost is that every mark has to survive triangulation, which is why
 * `logos.ts` keeps each one to a single path.
 */

/** The viewBox every mark is authored on — both Simple Icons' and the hand-drawn set's. */
const VIEW_BOX = 24;

/** Width the widest axis of a mark is normalized to, in world units. */
const TARGET_SIZE = 0.62;
/** Extrusion depth. Shallow: a deep mark reads as a chess piece, not an inlay. */
const DEPTH = 0.035;

const loader = new SVGLoader();

/**
 * Geometry is cached by path string. Twenty-one chips are built once at mount,
 * but React strict-mode double-invokes and any future respawn would otherwise
 * re-triangulate every mark — and triangulation of a 2,800-character path like
 * React's is the single most expensive thing that happens in this world.
 */
const cache = new Map<string, THREE.ExtrudeGeometry>();

export function buildLogoGeometry(path: string): THREE.ExtrudeGeometry {
  const cached = cache.get(path);
  if (cached) return cached;

  // SVGLoader parses documents, not bare path data, so the path is wrapped in
  // the smallest valid SVG that carries the right viewBox.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_BOX} ${VIEW_BOX}"><path d="${path}"/></svg>`;
  const parsed = loader.parse(svg);

  const shapes: THREE.Shape[] = [];
  for (const shapePath of parsed.paths) {
    // Detects holes by winding — without it, counters (the bowl of a "P", the
    // gaps in the GitHub cat) fill in solid.
    shapes.push(...SVGLoader.createShapes(shapePath));
  }

  // Seven of these marks are hand-authored (see logos.ts), and a typo in path
  // data doesn't throw — SVGLoader just yields nothing and the chip ships with a
  // blank face. Failing loudly here is the difference between a five-second fix
  // and hunting for which of twenty-one chips came out empty.
  if (shapes.length === 0) {
    throw new Error(`Logo path produced no shapes — malformed path data: ${path.slice(0, 64)}…`);
  }

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: DEPTH,
    bevelEnabled: false,
    // Straight segments on curves: these are small on screen, and the default 12
    // multiplies the triangle count of a path like React's for no visible gain.
    curveSegments: 6,
  });

  // SVG's Y axis runs downward and three.js's runs up, so every mark arrives
  // mirrored. Flipping the geometry rather than the mesh's scale keeps the
  // normals correct — a negative scale on the mesh would invert winding and
  // light the faces from behind.
  geometry.scale(1, -1, 1);

  // Normalize: scale the widest axis to TARGET_SIZE and centre on the origin, so
  // a squat mark and a tall one occupy the same visual weight on their chips.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const width = box.max.x - box.min.x;
  const height = box.max.y - box.min.y;
  const scale = TARGET_SIZE / Math.max(width, height);
  geometry.scale(scale, scale, 1);

  geometry.computeBoundingBox();
  const scaled = geometry.boundingBox!;
  geometry.translate(
    -(scaled.max.x + scaled.min.x) / 2,
    -(scaled.max.y + scaled.min.y) / 2,
    0
  );

  cache.set(path, geometry);
  return geometry;
}

/** Frees every cached mark. Called when the world unmounts. */
export function disposeLogoGeometries(): void {
  for (const geometry of cache.values()) geometry.dispose();
  cache.clear();
}
