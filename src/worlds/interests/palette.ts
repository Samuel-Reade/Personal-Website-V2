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
  woodGrain: "#9d764f",
  backPanel: "#7a5a3c",
  shelfPin: "#6f5539",

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
  potRim: "#a9705a",
  soil: "#54412e",
  leaf: "#7f9a69",
  leafDark: "#6d8759",
  candleWax: "#e6dcc4",
  candleWick: "#4a4038",
  candleFlame: "#ffcf7a",
  candleFlameCore: "#fff2cd",
  frame: "#8e7350",

  // Travel — globe
  globeSea: "#6f93aa",
  globeLand: "#8aa877",
  globeStand: "#b0913f",
  globeIce: "#dfe6e8",
  globeMeridian: "#c7a75a",

  // Skiing
  skiTop: "#c96d63",
  skiBase: "#7f8a93",
  skiStripe: "#e3b3a8",
  skiEdge: "#b9c0c6",
  poleShaft: "#9aa2a9",
  poleGrip: "#4f545c",
  poleStrap: "#6d6156",

  // Ancient history — column
  stone: "#cfc6b4",
  stoneShadow: "#b8ae9a",
  stoneDeep: "#9d937f",

  // One Piece — straw hat and chest
  straw: "#d9bd7e",
  strawBand: "#b6544a",
  chestWood: "#8a6039",
  chestIron: "#9aa0a6",
  chestGold: "#c9a445",
  chestGem: "#7fa6b8",
  chestGemRed: "#b26a63",

  // Reading
  openBook: "#c4b391",
  bookRibbon: "#a8574e",
  bookBand: "#c2a45f",

  // Film — reel
  reelMetal: "#8e949b",
  reelDark: "#6d737a",
  filmStrip: "#4a4f55",
  filmSprocket: "#31363b",

  // Stellar masses — telescope
  scopeTube: "#5f6f86",
  scopeBrass: "#b8933f",
  scopeTripod: "#8b7a5f",
  scopeDark: "#46536b",
  scopeFoot: "#5c5145",

  // Sports — trophy
  trophyGold: "#c9a445",
  trophyBase: "#6f5a3c",
  trophyPlaque: "#a8874c",

  // LEGO — generic bricks
  brickRed: "#c4675e",
  brickBlue: "#5b7fa6",
  brickYellow: "#cfae5c",
  brickGreen: "#71956a",
  brickGrey: "#8d949b",
  brickWhite: "#d5cfc2",

  // Archery
  bowWood: "#9a7247",
  bowString: "#ddd6c4",
  quiver: "#8b6a4c",
  quiverTrim: "#6b5038",
  arrowShaft: "#c6b291",
  arrowHead: "#9aa0a6",
  fletching: "#b6675e",
  fletchingAlt: "#dcd2bb",

  // Feedback
  hoverHalo: "#f4e2bd",
} as const;
