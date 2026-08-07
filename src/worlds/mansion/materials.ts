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
  /** The two marble tones the floor checkers between, plus its border band. */
  tileLight: "#b9a88f",
  tileDark: "#8a7461",
  tileBorder: "#6d5947",

  rug: "#7e4340",
  rugTrim: "#b78b4e",
  rugField: "#8d5049",

  wall: "#a89073",
  wallUpper: "#b59c7e",
  wainscot: "#61462f",
  wainscotPanel: "#6e5138",
  chairRail: "#7d5c3e",
  cornice: "#8e7150",

  ceiling: "#7d674f",
  beam: "#5b4530",

  pilaster: "#bda78a",
  pilasterTrim: "#a08a6d",

  stairString: "#5d432d",
  stairTread: "#7c5b3c",
  stairRunner: "#7e4340",
  balcony: "#6b4e34",
  baluster: "#c9b795",
  handrail: "#4f3924",

  brass: "#c39a51",
  candle: "#f6e3bc",
  sconceBack: "#6a5136",

  tableTop: "#6f4f34",
  tableTrim: "#c39a51",
  tableBase: "#5b4028",

  bookCover: "#75373d",
  bookPage: "#f2e8d2",
  bookRibbon: "#c39a51",

  windowFrame: "#5d432d",
  /** Glass is rendered unlit and tinted by the clock — see MansionLighting. */
  glass: "#8fa9c4",
} as const;

/** Warm/cool tints the window glass takes as the real-world sun moves. */
export const DAWN_TINT = new THREE.Color("#e8a56d");
export const NOON_TINT = new THREE.Color("#dce9f2");
export const DUSK_TINT = new THREE.Color("#e0834f");
export const NIGHT_TINT = new THREE.Color("#3f4f79");
