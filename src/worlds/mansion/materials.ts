import * as THREE from "three";

/**
 * Same rule as every other world behind a portal: faceted geometry under plain
 * Lambert shading with `flatShading` on, no gradient map, no outline pass, no
 * textures. What's different here is the palette — the hall is lit like a room
 * at dusk with the lamps on, so its colors run warmer and a good deal darker
 * than the library's daylit pastels. Flat shading on dark values is
 * unforgiving, hence the narrow range: the facets have to separate on hue and
 * lighting rather than on big jumps in lightness.
 */
export function flatMaterial(
  color: THREE.ColorRepresentation,
  opts: { emissive?: THREE.ColorRepresentation; emissiveIntensity?: number; side?: THREE.Side } = {}
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color, side: opts.side });
  // @types/three omits `flatShading` from the Lambert constructor params even
  // though three supports it at runtime, same as in the library's materials.
  (material as THREE.Material & { flatShading: boolean }).flatShading = true;
  if (opts.emissive !== undefined) {
    material.emissive = new THREE.Color(opts.emissive);
    material.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  return material;
}

export const PALETTE = {
  /**
   * The hall is marble: pale stone walls, a chequered floor, stone stairs and
   * balusters. Values sit close together and stay low-saturation on purpose —
   * flat shading already steps hard from facet to facet, and polished stone is
   * read from those steps rather than from big jumps in colour. The warmth in
   * the room comes from the candlelight falling on it, not from the stone.
   */
  tileLight: "#e4e0da",
  tileDark: "#95918d",
  tileBorder: "#78736f",

  /** Lavender runner and rug, the one saturated thing in a room of pale stone. */
  rug: "#7c6bb0",
  rugTrim: "#cabde8",
  rugField: "#8b7ac0",

  wall: "#d5cfc6",
  wallUpper: "#e0dad1",
  /** A marble dado rather than timber panelling, banded a shade darker than the wall. */
  wainscot: "#b6afa5",
  wainscotPanel: "#c2bbb1",
  chairRail: "#a49b8f",
  cornice: "#ded8cf",

  ceiling: "#c6bfb5",
  beam: "#ada598",

  pilaster: "#e6e1d9",
  pilasterTrim: "#cdc6bc",

  stairString: "#a49b8f",
  stairTread: "#ddd7ce",
  stairRunner: "#7c6bb0",
  balcony: "#c6bfb5",
  baluster: "#e8e4dd",
  /** Dark bronze, so the rails draw a line across all that pale stone. */
  handrail: "#5c554c",

  brass: "#c39a51",
  candle: "#f6e3bc",
  sconceBack: "#6a5136",

  /** The table and the book stay timber and leather — the warm note the pale
      room is arranged around, and what stops the centrepiece dissolving into
      the marble behind it. */
  tableTop: "#6f4f34",
  tableTrim: "#c39a51",
  tableBase: "#5b4028",

  bookCover: "#5f2d38",
  bookCoverEdge: "#4a2029",
  bookPage: "#f2e8d2",
  bookPageEdge: "#ddd0b2",
  bookGilt: "#d9b46a",
  bookText: "#a3937c",
  bookRibbon: "#c39a51",

  windowFrame: "#6b6259",
  /** Glass is rendered unlit and tinted by the clock — see MansionLighting. */
  glass: "#8fa9c4",
} as const;

/** Warm/cool tints the window glass takes as the real-world sun moves. */
export const DAWN_TINT = new THREE.Color("#e8a56d");
export const NOON_TINT = new THREE.Color("#dce9f2");
export const DUSK_TINT = new THREE.Color("#e0834f");
export const NIGHT_TINT = new THREE.Color("#3f4f79");
