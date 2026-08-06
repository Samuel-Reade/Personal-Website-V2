/**
 * The archipelago's palette: soft, desaturated pastels throughout, same as the
 * office and the library. Nothing here is shared with the meadow — that world
 * keeps its own saturated toon palette, and the two are deliberately unrelated.
 *
 * Every value sits well inside the mid tones. Flat shading already produces hard
 * light/dark steps between adjacent facets, so saturated base colors read as
 * harsh once that stepping lands on top — and the sea, being one enormous
 * faceted surface, is the worst offender if its base color is pushed.
 */
export const PALETTE = {
  // Sea. The crest tone is a lift of the deep one rather than a different hue:
  // the water reads as one body catching light, not as two colors of paint.
  waterDeep: "#5f8397",
  waterCrest: "#8fb0bd",
  foam: "#e4eef1",

  // Land
  sand: "#d9c9a8",
  sandDark: "#bda98a",
  slope: "#a3b78c",
  grass: "#aec095",
  rock: "#a9a49a",

  // Boat and the rower sitting in it
  hull: "#b0805c",
  hullDark: "#96684a",
  gunwale: "#c8ac86",
  thwart: "#c2a37c",
  oar: "#cbb190",
  shirt: "#93a7b5",
  skin: "#d7b391",
  hair: "#4a3b30",
  trousers: "#6f7a86",

  // Rolled-formed aluminum durability — the factory
  factoryWall: "#c4bcae",
  factoryRoof: "#a49b8f",
  factoryWindow: "#8fa3ad",
  stack: "#bfb3a4",
  stackBand: "#a2907f",
  smoke: "#dcd6cc",

  // ASA DataFest — the bar chart
  chartBase: "#c3b9a8",
  chartBarA: "#8fa9bd",
  chartBarB: "#9db58c",
  chartBarC: "#c2a17f",
  chartBarD: "#a898bb",

  // COVID-19 misinformation — the phone
  phoneBody: "#8b939c",
  phoneScreen: "#dfe5e8",
  phoneBezel: "#767e87",
  flagRed: "#c25f5c",

  // Cortisol experiment — the bench press
  benchPad: "#7c848d",
  benchFrame: "#a9a29a",
  barbell: "#b6bcc2",
  plate: "#8d949b",

  // Netflix success — the television
  tvBody: "#b9a98f",
  tvScreen: "#93a8ae",
  tvTrim: "#9d8e77",
  tvKnob: "#cbbda3",

  // Voting — the ballot box
  ballotBox: "#a8b3bd",
  ballotLid: "#94a0aa",
  ballotSlot: "#6d757d",
  ballotPaper: "#ece5d6",

  // Feedback
  highlight: "#f4e6c6",
} as const;
