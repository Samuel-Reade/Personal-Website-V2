import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { LogoLayer } from "./logos";

/**
 * Turns a mark's 24x24 SVG paths into real extruded geometry for a chip face.
 *
 * Extrusion rather than a texture is what gives the marks their depth — at a
 * grazing angle a chip shows the *side* of its logo, which a flat decal can't
 * do. The cost is that every mark has to survive triangulation, which is why
 * `logos.ts` keeps each layer to a single path.
 *
 * A mark is one or more layers (see `LogoSpec.layers`), and they are built
 * *together*: each is extruded on its own, but the scale-and-centre step that
 * fits a mark to the face is computed once from all of them and applied to all
 * of them. Normalised one at a time, AWS's smile would be blown up to the same
 * width as its wordmark and Amplitude's white wave stretched to the size of the
 * disc it sits on.
 */

/** The viewBox every mark is authored on — both Simple Icons' and the hand-drawn set's. */
const VIEW_BOX = 24;

/**
 * Width the widest axis of a mark is normalized to, in world units. Sized
 * against `Chip.tsx`'s 1.5-unit face, leaving a margin so a wide mark doesn't
 * run out over the puck's rounded corners.
 */
const TARGET_SIZE = 0.95;
/** Extrusion depth. Shallow: a deep mark reads as a chess piece, not an inlay. */
const DEPTH = 0.035;

const loader = new SVGLoader();

/**
 * Geometry is cached per mark, keyed by its layers' path data. Twenty-odd chips
 * are built once at mount, but React strict-mode double-invokes and any future
 * respawn would otherwise re-triangulate every mark — and triangulation of a
 * 2,800-character path like React's is the single most expensive thing that
 * happens in this world.
 */
const cache = new Map<string, THREE.ExtrudeGeometry[]>();

function cacheKey(layers: readonly LogoLayer[]): string {
  return layers.map((layer) => layer.path).join("|");
}

/** Parses and extrudes one layer's path, still in raw (mirrored) SVG units. */
function extrudeLayer(path: string): THREE.ExtrudeGeometry {
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

  // Many of these paths are hand-authored or vendored (see logos.ts), and a
  // typo in path data doesn't throw — SVGLoader just yields nothing and the
  // chip ships with a blank face. Failing loudly here is the difference between
  // a five-second fix and hunting for which of twenty-odd chips came out empty.
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
  return geometry;
}

/**
 * Builds a mark's layers, in the order given, all sharing one normalisation.
 * The returned array lines up with `layers` one to one.
 */
export function buildLogoGeometries(layers: readonly LogoLayer[]): THREE.ExtrudeGeometry[] {
  const key = cacheKey(layers);
  const cached = cache.get(key);
  if (cached) return cached;

  const geometries = layers.map((layer) => extrudeLayer(layer.path));

  // Normalize: scale the widest axis of the *whole mark* to TARGET_SIZE and
  // centre it on the origin, so a squat mark and a tall one occupy the same
  // visual weight on their chips — and so every layer of a mark moves as one.
  const box = new THREE.Box3();
  for (const geometry of geometries) {
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox!);
  }
  const width = box.max.x - box.min.x;
  const height = box.max.y - box.min.y;
  const scale = TARGET_SIZE / Math.max(width, height);
  const centerX = ((box.max.x + box.min.x) / 2) * scale;
  const centerY = ((box.max.y + box.min.y) / 2) * scale;

  for (const geometry of geometries) {
    geometry.scale(scale, scale, 1);
    geometry.translate(-centerX, -centerY, 0);
    geometry.computeBoundingBox();
  }

  cache.set(key, geometries);
  return geometries;
}

/** Frees every cached mark. Called when the world unmounts. */
export function disposeLogoGeometries(): void {
  for (const geometries of cache.values()) {
    for (const geometry of geometries) geometry.dispose();
  }
  cache.clear();
}
