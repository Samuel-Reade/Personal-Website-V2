/**
 * The office world's palette: soft, desaturated pastels throughout. Nothing in
 * here is shared with the meadow — that world keeps its own saturated toon
 * palette, and the two are deliberately unrelated.
 *
 * Every value sits well inside the mid tones. Flat shading already produces
 * hard light/dark steps between adjacent facets, so saturated base colors read
 * as harsh once that stepping is applied on top.
 */
export const PALETTE = {
  // Architecture
  carpet: "#c8bcab",
  carpetAlt: "#bfb2a0",
  wall: "#ded5c7",
  ceiling: "#e7e0d5",
  column: "#d4cabb",
  mullion: "#c3bbb0",
  ceilingLight: "#f2ece0",

  // Desks
  deskTop: "#c9a97f",
  deskTopAlt: "#c0a077",
  deskLeg: "#b3ada2",
  chairSeat: "#9aa4a9",
  chairFrame: "#a8a29a",

  // Clutter
  monitorBody: "#98a2a8",
  monitorScreen: "#6f7d86",
  monitorGlow: "#b9cfd6",
  keyboard: "#cdc7bb",
  keycap: "#b9b3a7",
  mouse: "#c2bcb1",
  mug: "#d3ada4",
  mugInner: "#8f7d78",
  paper: "#ede6db",
  paperAlt: "#e2dacd",
  potTerracotta: "#c99b86",
  leafSage: "#9db58c",
  leafSageDark: "#8aa47b",
  lampShade: "#b6c2bb",
  lampArm: "#a9a29a",

  // Interactive figurines
  popcornBucketRed: "#d69a95",
  popcornBucketCream: "#efe5d5",
  popcornKernel: "#f1e3c1",
  padlockBody: "#aab6c0",
  padlockShackle: "#bcc5cd",
  padlockKeyhole: "#7d8a94",
  bearFur: "#c9a583",
  bearFurDark: "#b08f70",
  bearMuzzle: "#e0c6a8",
  cashNote: "#a8c0a0",
  cashNoteAlt: "#9db797",
  cashBand: "#d9cfae",
  towerBody: "#b9c3cb",
  towerBodyAlt: "#aab4bd",
  towerWindow: "#8d9aa4",

  // Feedback
  hoverHalo: "#f2e2c4",
} as const;

export type PaletteColor = (typeof PALETTE)[keyof typeof PALETTE];
