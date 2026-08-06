import * as THREE from "three";
import { FontLoader, type Font, type FontData } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import helvetikerBold from "three/examples/fonts/helvetiker_bold.typeface.json";

/** Same bundled font the outdoor portals use — nothing to fetch, nothing to 404. */
let cachedFont: Font | null = null;
function getFont(): Font {
  if (!cachedFont) cachedFont = new FontLoader().parse(helvetikerBold as unknown as FontData);
  return cachedFont;
}

/**
 * Multi-line extruded text, centered on its own origin.
 *
 * TextGeometry lays a single run of glyphs out rightward from the origin with no
 * concept of line breaks, so each line is built separately, centered on X, and
 * offset down by one line height before the whole block is merged and recentered
 * on Y. Callers pass lines pre-split — wrapping by measured width would need a
 * per-glyph advance table that the font JSON doesn't expose cheaply.
 *
 * Bevels are off and `curveSegments` is low on purpose: the letters should read
 * as the same faceted flat-shaded solid as everything else in the hall, not as
 * the softly rounded type used on the outdoor portal labels.
 */
export function buildLabelGeometry(lines: string[], size: number): THREE.BufferGeometry {
  const font = getFont();
  const lineHeight = size * 1.34;

  const lineGeometries = lines.map((line, i) => {
    const geometry = new TextGeometry(line, {
      font,
      size,
      depth: size * 0.16,
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
