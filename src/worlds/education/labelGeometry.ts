import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { displaySize, getDisplayFont } from "../../three/displayFont";

/**
 * Multi-line extruded text, centered on its own origin.
 *
 * TextGeometry lays a single run of glyphs out rightward from the origin with no
 * concept of line breaks, so each line is built separately, centered on X, and
 * offset down by one line height before the whole block is merged and recentered
 * on Y. Callers pass lines pre-split — wrapping by measured width would need a
 * per-glyph advance table that the font JSON doesn't expose cheaply.
 *
 * `capHeight` is the height of the letters themselves, not the em size — see
 * `displaySize`. Line height and extrusion depth stay measured against it rather
 * than the em, so a label's proportions don't move when the display face does.
 *
 * Bevels are off and `curveSegments` is low on purpose: the letters should read
 * as the same faceted flat-shaded solid as everything else in the hall, not as
 * the softly rounded type used on the outdoor portal labels.
 */
export function buildLabelGeometry(lines: string[], capHeight: number): THREE.BufferGeometry {
  const font = getDisplayFont();
  // 1.32 rather than the 1.34-of-em this was written as: measured against caps
  // instead of the em, it is the same gap on screen as before the font swap.
  const lineHeight = capHeight * 1.32;

  const lineGeometries = lines.map((line, i) => {
    const geometry = new TextGeometry(line, {
      font,
      size: displaySize(capHeight),
      depth: capHeight * 0.16,
      curveSegments: 2,
      bevelEnabled: false,
    });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    geometry.translate(-(box.max.x + box.min.x) / 2, -i * lineHeight, 0);
    return geometry;
  });

  const merged = mergeGeometries(lineGeometries)!;
  for (const geometry of lineGeometries) geometry.dispose();

  merged.computeBoundingBox();
  const box = merged.boundingBox!;
  merged.translate(0, -(box.max.y + box.min.y) / 2, 0);
  merged.computeVertexNormals();
  return merged;
}
