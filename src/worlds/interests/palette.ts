/**
 * The shelf room's palette: warm woods and muted pastels, the same family the
 * office and the library use. Nothing here is shared with the meadow — that
 * world keeps its own saturated toon palette.
 *
 * Every value sits well inside the mid tones. Flat shading already produces hard
 * light/dark steps between adjacent facets, so saturated base colors read as
 * harsh once that stepping lands on top. The one deliberate exception is the
 * candle flame, which is meant to be the brightest thing in the room.
 */
export const PALETTE = {
  // The unit
  wood: "#a9825a",
  woodDark: "#8a6845",
  woodEdge: "#bd9668",
  backPanel: "#7a5a3c",

  // Room around it
  wall: "#d8cdba",
  wallTrim: "#c3b6a0",
  floor: "#9b8264",
  floorAlt: "#8d765a",

  // Non-interactive dressing
  bookA: "#8f5f52",
  bookB: "#5c7488",
  bookC: "#6f7f5c",
  bookD: "#8a7196",
  bookE: "#b09055",
  bookPages: "#e5dcc6",
  potTerracotta: "#bd8468",
  leaf: "#7f9a69",
  leafDark: "#6d8759",
  candleWax: "#e6dcc4",
  candleFlame: "#ffcf7a",
  frame: "#8e7350",

  // Travel — globe
  globeSea: "#6f93aa",
  globeLand: "#8aa877",
  globeStand: "#b0913f",

  // Skiing
  skiTop: "#c96d63",
  skiBase: "#7f8a93",
  poleShaft: "#9aa2a9",
  poleGrip: "#4f545c",

  // Ancient history — column
  stone: "#cfc6b4",
  stoneShadow: "#b8ae9a",

  // One Piece — straw hat and chest
  straw: "#d9bd7e",
  strawBand: "#b6544a",
  chestWood: "#8a6039",
  chestIron: "#9aa0a6",
  chestGold: "#c9a445",

  // Reading
  openBook: "#c4b391",

  // Film — reel
  reelMetal: "#8e949b",
  reelDark: "#6d737a",
  filmStrip: "#4a4f55",

  // Stellar masses — telescope
  scopeTube: "#5f6f86",
  scopeBrass: "#b8933f",
  scopeTripod: "#8b7a5f",

  // Sports — trophy
  trophyGold: "#c9a445",
  trophyBase: "#6f5a3c",

  // LEGO — generic bricks
  brickRed: "#c4675e",
  brickBlue: "#5b7fa6",
  brickYellow: "#cfae5c",
  brickGreen: "#71956a",

  // Archery
  bowWood: "#9a7247",
  bowString: "#ddd6c4",
  quiver: "#8b6a4c",
  arrowShaft: "#c6b291",
  fletching: "#b6675e",

  // Feedback
  hoverHalo: "#f4e2bd",
} as const;
