import * as THREE from "three";

/**
 * The library's look is deliberately *not* the outdoor world's toon pipeline:
 * no gradient map, no `<Outlines>`, no textures. Faceted geometry lit by plain
 * Lambert shading with `flatShading` on, so every triangle reads as its own
 * flat facet. Keeping this in one place means the whole hall stays consistent
 * even though it shares nothing with `utils/toon.ts`.
 */
export function flatMaterial(
  color: THREE.ColorRepresentation,
  opts: { emissive?: THREE.ColorRepresentation; emissiveIntensity?: number; side?: THREE.Side } = {}
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color, side: opts.side });
  // @types/three omits `flatShading` from the Lambert constructor params even
  // though three supports it at runtime, same as the MeshToonMaterial case in
  // utils/toon.ts.
  (material as THREE.Material & { flatShading: boolean }).flatShading = true;
  if (opts.emissive !== undefined) {
    material.emissive = new THREE.Color(opts.emissive);
    material.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  return material;
}

/**
 * Soft desaturated pastels for the architecture. Every value is deliberately
 * low-saturation — flat shading already produces hard facet-to-facet steps, and
 * saturated base colors turn those steps into harsh banding.
 */
export const PALETTE = {
  floorPlankA: "#b79b7d",
  floorPlankB: "#ab8e70",
  floorPlankC: "#c0a488",
  runner: "#8f6f74",
  wall: "#d6cdbe",
  wallTrim: "#c3b7a4",
  ceiling: "#cabfae",
  beam: "#8d7355",
  column: "#ded6c8",
  tableTop: "#9c7a58",
  tableLeg: "#7d6046",
  shelf: "#8a6a4c",
} as const;

/**
 * Book covers. Muted enough to sit under the pastel architecture, varied enough
 * that a pile of them still reads as separate volumes rather than one block.
 */
export const BOOK_COLORS = [
  "#b5817f",
  "#8fa3b8",
  "#93ab8c",
  "#c2b087",
  "#a08fb4",
  "#bb9273",
  "#7f9ea1",
  "#c0a0a8",
  "#87927e",
  "#a9a2bd",
] as const;

/**
 * Muted jewel tones for the stained glass. Darker and greyer than real stained
 * glass on purpose: these panes are rendered unlit (they are the light source in
 * the fiction) and get brightened by daylight at runtime, so picking true
 * saturated jewel colors here blows them out to neon at midday.
 */
export const GLASS_COLORS = [
  "#2f4a78",
  "#2c6350",
  "#a8762c",
  "#553a63",
  "#2a606d",
  "#84404c",
  "#3b5590",
  "#7d6a2a",
] as const;

/** Warm/cool tints the sunbeams pass through as the real-world sun moves. */
export const DAWN_TINT = new THREE.Color("#ffb27a");
export const NOON_TINT = new THREE.Color("#fff4dd");
export const DUSK_TINT = new THREE.Color("#ff9d6e");
export const NIGHT_TINT = new THREE.Color("#8fa6d8");
