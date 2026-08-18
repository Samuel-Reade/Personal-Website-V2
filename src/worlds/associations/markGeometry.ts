import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { envelopeHalfWidth } from "./envelope";
import type { MarkSpec } from "./marks";

/**
 * Turns a mark's path layers into geometry lying *on* the envelope.
 *
 * The emblems used to be flat props stood off the front of the balloon at a
 * fixed depth, and were mostly inside it: at the height they sit, the profile
 * in `envelope.ts` puts the skin at 0.98 of the radius, and a flat plate at
 * 0.92 with its letters at 0.97 is a plate and letters you cannot see. Only the
 * pieces that happened to be thick enough — a ball, a ring — broke the surface.
 *
 * So the marks are wrapped instead. Each layer is extruded from its paths, cut
 * into triangles small enough to follow a curve, and then every vertex is moved
 * onto the surface of revolution the gores approximate: its x becomes an arc
 * along the envelope at its own height, its z a stand-off above the skin there.
 * The result hugs the balloon the way a painted logo would, and stays a hair
 * proud of it everywhere — the gores are flat facets, but at three columns a
 * panel they never fall more than 0.003 of the radius inside the true curve.
 *
 * Everything below is a fraction of the envelope radius, so the four balloons,
 * which are four different sizes, get emblems in proportion.
 */

/** How far the back of the mark stands off the skin. */
const STANDOFF = 0.012;
/** Thickness of the bottom layer — the field or plate the rest sits on. */
const PLATE_DEPTH = 0.02;
/**
 * Thickness of every layer above it. Shallow on purpose: the traced marks carry
 * hairline gaps — the loops of the UCLA script — and a deep layer turns each
 * into a groove whose walls read as a dark scratch, where a shallow one shows
 * the white beneath as the artwork does.
 */
const LAYER_DEPTH = 0.008;
/**
 * Radial nudge between successive layers above the plate. They overlap in depth
 * — stacking them end to end would make a six-layer badge half a unit tall —
 * so this is what keeps their top faces off one another.
 */
const LAYER_GAP = 0.003;
/**
 * Longest triangle edge left after tessellation. Wrapping moves vertices, not
 * faces, so a triangle spanning the whole plate would stay a flat chord with
 * its middle sunk into the skin; at a twentieth of the radius the sag is under
 * a thousandth of it.
 */
const MAX_EDGE = 0.05;
/** Straight segments per curve when flattening the paths. Small on screen; the default 12 buys nothing. */
const CURVE_SEGMENTS = 6;

const loader = new SVGLoader();

/**
 * The filled shapes of one path, flipped into three.js's y-up. SVGLoader gives
 * y-down; flipping the *points* rather than the finished geometry keeps every
 * triangle's winding right, where a negative scale would turn the front faces
 * into back faces and cull them.
 */
function shapesOf(path: string): THREE.Shape[] {
  // SVGLoader parses documents, not bare path data.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`;
  const parsed = loader.parse(svg);
  const shapes: THREE.Shape[] = [];
  for (const shapePath of parsed.paths) {
    // Sorts subpaths into solids and holes by nesting and winding.
    for (const shape of SVGLoader.createShapes(shapePath)) {
      const flipped = new THREE.Shape(shape.getPoints(CURVE_SEGMENTS).map((p) => new THREE.Vector2(p.x, -p.y)));
      for (const hole of shape.holes) {
        flipped.holes.push(new THREE.Path(hole.getPoints(CURVE_SEGMENTS).map((p) => new THREE.Vector2(p.x, -p.y))));
      }
      shapes.push(flipped);
    }
  }
  // Malformed path data doesn't throw — SVGLoader just yields nothing, and the
  // balloon would fly with a blank face. Fail where the fix is.
  if (shapes.length === 0) {
    throw new Error(`Mark path produced no shapes — malformed path data: ${path.slice(0, 64)}…`);
  }
  return shapes;
}

/**
 * Builds a mark's layers, in the order given, wrapped onto an envelope of the
 * given radius. Returned geometries line up with `spec.layers` one to one, are
 * in the envelope's own frame (origin at its centre, +Z its decorated face), and
 * belong to the caller.
 */
export function buildMarkGeometries(spec: MarkSpec, radius: number): THREE.BufferGeometry[] {
  // Extrude every layer at unit depth first, so the mark's extent — and with it
  // the scale that fits it to `spec.width` — is measured once across all of
  // them. Sized one at a time, the winged O's line-art would be blown up to the
  // width of the white it sits on, and the letters to the width of the shield.
  const raw = spec.layers.map(
    (layer) => new THREE.ExtrudeGeometry(shapesOf(layer.path), { depth: 1, bevelEnabled: false, curveSegments: CURVE_SEGMENTS })
  );
  const box = new THREE.Box3();
  for (const geometry of raw) {
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox!);
  }
  const scale = (spec.width * radius) / (box.max.x - box.min.x);
  const centerX = (box.max.x + box.min.x) / 2;
  const centerY = (box.max.y + box.min.y) / 2;

  // Enough passes to finish. The modifier splits a triangle's longest edge at
  // its midpoint, so two triangles sharing an edge always split it at the same
  // point — no cracks — *provided* both get to it. Cut off early, one side may
  // stop while the other has split on, and once wrapped the unsplit side sags
  // away from the split one as a hairline crack down the mark. It stops on its
  // own the pass nothing is left to split, which for these is well short of 40.
  const tessellate = new TessellateModifier(MAX_EDGE * radius, 40);
  const position = new THREE.Vector3();

  return raw.map((flat, index) => {
    const depth = (index === 0 ? PLATE_DEPTH : LAYER_DEPTH) * radius;
    // Where this layer's back sits above the plate's back.
    const lift = index === 0 ? 0 : (PLATE_DEPTH - LAYER_DEPTH + index * LAYER_GAP) * radius;

    flat.translate(-centerX, -centerY, 0);
    flat.scale(scale, scale, depth);
    const geometry = tessellate.modify(flat);
    flat.dispose();

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      position.fromBufferAttribute(positions, i);
      const y = spec.centerY * radius + position.y;
      // The angle is measured on the plate's back for every layer, so the
      // layers stay registered over one another instead of each contracting a
      // little more the further out it sits.
      const skin = envelopeHalfWidth(y / radius) * radius + STANDOFF * radius;
      const angle = position.x / skin;
      const rho = skin + lift + position.z;
      positions.setXYZ(i, Math.sin(angle) * rho, y, Math.cos(angle) * rho);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  });
}
