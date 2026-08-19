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
  deskEdge: "#a98d68",
  deskLeg: "#b3ada2",
  deskMat: "#93a0ab",
  chairSeat: "#9aa4a9",
  chairFrame: "#a8a29a",

  // Clutter
  monitorBody: "#98a2a8",
  monitorScreen: "#6f7d86",
  monitorGlow: "#b9cfd6",
  ledLit: "#a8d3b0",
  ledDark: "#5c666e",
  cable: "#6e6a66",
  keyboard: "#cdc7bb",
  keycap: "#b9b3a7",
  mouse: "#c2bcb1",
  mug: "#d3ada4",
  mugInner: "#8f7d78",
  mugBand: "#bcc9c2",
  coffee: "#6b5644",
  paper: "#ede6db",
  paperAlt: "#e2dacd",
  notebookCover: "#9fadbe",
  penBody: "#5f6a74",
  stickyYellow: "#efe3a8",
  stickyBlue: "#b8cfe0",
  headphone: "#4f555c",
  headphoneCup: "#666d75",
  phoneBody: "#3f444a",
  potTerracotta: "#c99b86",
  soil: "#7a6450",
  leafSage: "#9db58c",
  leafSageDark: "#8aa47b",
  lampShade: "#b6c2bb",
  lampArm: "#a9a29a",
  lampBulb: "#f6ead0",

  // Room dressing
  baseboard: "#c9c0b1",
  door: "#b7a68d",
  doorFrame: "#cfc6b6",
  doorHandle: "#8f9499",
  whiteboard: "#f3efe6",
  whiteboardFrame: "#b9b3a7",
  artTealA: "#a7c4bc",
  artTealB: "#7fa39a",
  artRustA: "#d1a58f",
  artRustB: "#b07f68",
  artFrame: "#8d8578",
  clockFace: "#f1ece1",
  clockRim: "#8f8a80",
  cabinet: "#cfc5b2",
  cabinetDark: "#bfb4a0",
  printer: "#d9d4c9",
  printerDark: "#aaa79e",
  coolerBottle: "#b9d2dc",
  coolerBody: "#e3ded2",
  exitSign: "#a8c8a4",
  plantTub: "#b3aa9a",

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
  // Lifted well above the rest of the desk: the tower holds the centre, and at
  // the old blue-grays it read as the dimmest thing in the busiest spot.
  towerBody: "#dce3e9",
  towerBodyAlt: "#cbd4dc",
  towerWindow: "#f4e8cb",

  // Coworkers — only on the floor during office hours
  skinLight: "#e3c4a6",
  skinMid: "#cfa47e",
  skinTan: "#b3855e",
  skinDeep: "#8d6244",
  hairDark: "#332e2b",
  hairBrown: "#5f4a3a",
  hairSandy: "#8f7554",
  hairGrey: "#a9a29b",
  shirtBlue: "#a6b6c6",
  shirtSage: "#a9c0aa",
  shirtMauve: "#c3aebb",
  shirtSand: "#cfc1a5",
  shirtLavender: "#b4aac8",

  // Feedback
  hoverHalo: "#f2e2c4",
} as const;

export type PaletteColor = (typeof PALETTE)[keyof typeof PALETTE];
