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
  /**
   * Sea. Four tones rather than two, and stepped rather than blended, so the
   * surface reads as bands of flat color instead of one sheet sharing a single
   * tone. See Water.tsx for how the bands are quantized.
   */
  waterDeep: "#4f7288",
  waterMid: "#5f8397",
  waterLight: "#7ba3b3",
  waterCrest: "#9dbecb",
  foam: "#e4eef1",

  // Land
  sand: "#d9c9a8",
  sandDark: "#bda98a",
  slope: "#a3b78c",
  grass: "#aec095",
  grassDark: "#93a87c",
  rock: "#a9a49a",
  rockDark: "#8e8a81",
  cliff: "#b3aca0",

  // Foliage scattered over the slopes
  palmTrunk: "#a98a68",
  palmFrond: "#8fae7c",
  palmFrondDark: "#7d9c6c",
  bush: "#9bb488",
  bushDark: "#87a075",
  tuft: "#b3c49b",

  // Boat
  hull: "#b0805c",
  hullDark: "#96684a",
  gunwale: "#c8ac86",
  thwart: "#c2a37c",
  oar: "#cbb190",

  /**
   * The rower. Still the same man who walked into the portal — skin, hair and
   * features are the meadow character's exact values from three/Player.tsx and
   * should stay that way. What has changed is that he has dressed for the boat:
   * navy jacket, cream trousers, a red neckerchief in place of the tie, and deck
   * shoes. Keep the clothes saturated enough to read as his rather than drifting
   * into the pastels around them.
   */
  suit: "#2e4666",
  suitShirt: "#f0ece1",
  /** Cream sailing trousers — the one place he stops matching the jacket. */
  suitTrouser: "#d8cfbb",
  suitSkin: "#caa07a",
  suitHair: "#241d17",
  /** Deck shoes: tan rather than the meadow's near-black dress shoe. */
  suitShoe: "#8a6242",
  /** Neckerchief, knotted at the collar. */
  suitTie: "#b8534a",
  /** Peaked sailing cap, and the band and peak that break it up. */
  suitCap: "#f2eee4",
  suitCapTrim: "#2e4666",
  /** Brows, eyes and mouth. */
  suitFeature: "#1a1410",

  // Rolled-formed aluminum durability — the works, its mountains and its airstrip
  factoryWall: "#c4bcae",
  factoryRoof: "#a49b8f",
  factoryWindow: "#8fa3ad",
  stack: "#bfb3a4",
  stackBand: "#a2907f",
  smoke: "#dcd6cc",
  mountain: "#9d9a93",
  mountainDark: "#87857f",
  mountainSnow: "#e8eaea",
  tarmac: "#8d8a85",
  tarmacEdge: "#7c7975",
  tarmacLine: "#ddd8cc",
  planeBody: "#d5dade",
  planeBodyAlt: "#bcc3c8",
  planeWing: "#c6ccd1",
  planeFin: "#96a8b5",
  planeWindow: "#7c8a94",
  planeEngine: "#9aa1a7",

  /**
   * ASA DataFest — the chart. Deliberately the most saturated thing in the
   * world: it is a data visualization standing on an island of pastels, and it
   * is supposed to be the thing you see first from the water.
   */
  chartBase: "#b8ae9c",
  chartGrid: "#cdc4b3",
  chartBarA: "#5b93c4",
  chartBarB: "#5faa7d",
  chartBarC: "#d99a4e",
  chartBarD: "#a273c4",
  chartBarE: "#d4676a",

  // COVID-19 misinformation — the phone and the chatter coming off it
  phoneBody: "#8b939c",
  phoneScreen: "#dfe5e8",
  phoneBezel: "#767e87",
  flagRed: "#c25f5c",
  bubble: "#f2f5f7",
  bubbleAlt: "#e2e9ee",
  bubbleFlagged: "#e7b9b6",
  bubbleText: "#9aa6b0",

  // Cortisol experiment — the gym
  benchPad: "#7c848d",
  benchFrame: "#a9a29a",
  barbell: "#b6bcc2",
  plate: "#8d949b",
  plateAccent: "#a2707a",
  rackFrame: "#8a9199",
  dumbbell: "#9ba2a9",
  kettlebell: "#7f868d",
  gymMat: "#8fa3a8",
  gymMatAlt: "#9db0b4",

  // Netflix success — the television and the film set around it
  tvBody: "#b9a98f",
  tvScreen: "#93a8ae",
  tvTrim: "#9d8e77",
  tvKnob: "#cbbda3",
  clapperBody: "#4f545c",
  clapperStripe: "#e9ecef",
  cameraBody: "#6b7178",
  cameraLens: "#4e545a",
  tripod: "#8b8f95",
  lightHead: "#a8adb3",
  lightGlow: "#ffeec4",
  setFlat: "#b0a893",
  setFlatAlt: "#a09984",
  chairCanvas: "#93705f",
  reel: "#8e949b",

  // Voting — the ballot box
  ballotBox: "#a8b3bd",
  ballotLid: "#94a0aa",
  ballotSlot: "#6d757d",
  ballotPaper: "#ece5d6",

  // Feedback
  highlight: "#f4e6c6",
} as const;
