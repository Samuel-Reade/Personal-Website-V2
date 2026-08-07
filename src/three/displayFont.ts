import { FontLoader, type Font, type FontData } from "three/examples/jsm/loaders/FontLoader.js";
import spaceGrotesk700 from "./fonts/space-grotesk-700.typeface.json";

/**
 * Space Grotesk 700 as extruded-text outlines — the 3D half of the site's
 * display face, matching the `--font-display` the stylesheet loads for the HTML
 * chrome.
 *
 * `TextGeometry` needs glyph outlines rather than a CSS family, so this can't
 * share the webfont the overlays use; `fonts/to-typeface.py` converts the same
 * face into the JSON imported here. Being an import it is bundled rather than
 * fetched, so in-world labels are never missing or swapped mid-scene the way the
 * HTML text can be while Google Fonts is still in flight.
 */
let cached: Font | null = null;

export function getDisplayFont(): Font {
  if (!cached) cached = new FontLoader().parse(spaceGrotesk700 as unknown as FontData);
  return cached;
}

/**
 * Caps in Space Grotesk fill 700 of its 1000 em units; helvetiker's — which every
 * in-world label size in the codebase was eyeballed against — filled 1013. Left
 * alone, the swap would shrink every portal and book label by a third.
 *
 * So sizes stay written as the cap height they should render at, and get
 * converted here rather than each one being re-tuned by hand. Cap height is the
 * right thing to match: it holds the labels' apparent size and their fit against
 * the portal discs, and only costs ~8% extra string width, Space Grotesk being
 * the narrower face per cap.
 */
const CAP_HEIGHT_RATIO = 1013 / 700;

export function displaySize(capHeight: number): number {
  return capHeight * CAP_HEIGHT_RATIO;
}
