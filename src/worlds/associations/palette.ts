/**
 * The clearing's colours.
 *
 * A late-afternoon hilltop: warm grass, dusty rock, and three balloons in the
 * colours of the things they stand for. Scoped to this world like every other
 * palette here — see the note in `worlds/projects/materials.ts` for why each
 * world owns its own shading rather than sharing one helper.
 */
export const PALETTE = {
  /** The hill itself, lit face and shaded face. */
  grass: "#7d9a52",
  grassDark: "#617a40",
  grassPale: "#93ad63",
  soil: "#6b5738",
  rock: "#8d8578",
  rockDark: "#6f695f",

  /** Conifers on the slopes, in two tones so a hillside of them isn't one wall. */
  pine: "#4a6e44",
  pineDark: "#375539",
  /** Broadleaves in the valleys and along the coast, rounder and a shade lighter. */
  leaf: "#5c8a3e",
  leafDark: "#48713a",
  trunk: "#5b432c",
  /** Scrub between the stands, and the boulders on the high ground. */
  shrub: "#4f7a3c",
  shrubDark: "#3d6132",
  boulder: "#8a857c",
  boulderDark: "#6a665f",

  /**
   * Water. The streams read lighter than the sea on purpose — from above, a
   * ribbon in the sea's own colour disappears into the shadowed side of every
   * valley it runs through.
   */
  stream: "#6fa8c9",
  waterfall: "#9cc9de",
  foam: "#eef6fa",
  sea: "#2f6f92",

  /**
   * The ground plane beyond the terrain, far under the fog — what fills the gap
   * between the world's rim and the horizon so the edge never shows.
   */
  apron: "#2f3c44",

  /** Tether stakes and ropes. */
  rope: "#b8a173",
  stake: "#57452e",

  /** The load tapes banding the envelope, and the crown ring. */
  tape: "#e9e3d4",

  /** Basket wicker, and the burner frame above it. */
  basket: "#a5793f",
  basketDark: "#835f31",
  burner: "#8a8f96",

  /** The burner's flame, outer wash and inner core, and the vent at the crown. */
  flameOuter: "#ff9433",
  flameInner: "#ffdf8a",
  vent: "#4b443a",

  /** The helicopter's aviation lights. */
  navRed: "#ff3b30",
  navGreen: "#2ee56b",
  strobe: "#ffffff",

  /** What a balloon glows when the helicopter is close, and brighter under the pointer. */
  highlight: "#fff0b8",

  /**
   * UCLA Rugby — the university's blue and gold. The emblem is the club's own
   * lockup: the script wordmark and "RUGBY" in gold, keylined in white, on a
   * blue field. Field and script are taken from that artwork rather than from
   * the gores, so the badge reads as the real thing rather than as more balloon.
   */
  rugbyA: "#2c6fb5",
  rugbyB: "#f2c14a",
  rugbyField: "#306bc3",
  rugbyScript: "#f8ac35",
  rugbyKeyline: "#ffffff",

  /**
   * Olympic Club Rugby — the club's red and white.
   *
   * Kept deliberately far from UCLA's blue and gold, because these two are the
   * only pair on the hill that stand for the same sport: with similar colours a
   * visitor would read them as one balloon seen twice. The emblems separate them
   * too — the club's winged "O" against the university's script.
   */
  olympicA: "#b3352f",
  olympicB: "#f3ece2",
  /** The winged O's line-art, and the white it is cut from. */
  olympicInk: "#ae3b3f",
  olympicField: "#fbf8f2",

  /**
   * Lambda Chi Alpha — purple, green and gold: the cross and crescent, with the
   * letters on a green shield, on the purple field the fraternity's own badge
   * puts them on.
   */
  lambdaA: "#5c3f8f",
  lambdaB: "#3f7d4f",
  lambdaField: "#52327f",
  lambdaGold: "#f8c445",
  lambdaGreen: "#1c663b",
  lambdaOutline: "#2a1a45",

  /** Statistics & Data Science Club — a cool analytical teal. */
  statsA: "#2f7f86",
  statsB: "#d9e3e2",
  statsPlate: "#f1f5f4",
  statsBar: "#1f5b61",

  /**
   * The far cluster, out past the flight radius over the northern ridges.
   *
   * Deliberately not the associations' colours: those four stand for something
   * and can be flown to, and a fifth balloon in club colours would read as a
   * sixth one somebody had forgotten to make reachable. These are a balloonist's
   * colours instead — the cream they all band with, over terracotta, sand and a
   * dusty blue, each still saturated enough to hold up through a third of a
   * fog's worth of haze.
   */
  farBalloonCream: "#e6dac4",
  farBalloonRust: "#c4674f",
  farBalloonSand: "#d2a55f",
  farBalloonSky: "#7b8fb4",

  /** The helicopter. */
  heliBody: "#c8503f",
  heliDark: "#9c3b2d",
  heliGlass: "#9fd2e8",
  heliMetal: "#8c9199",
  heliRotor: "#4a4f56",
  /** Cheat line and boom band — the livery cream against the red hull. */
  heliAccent: "#efe8d8",
  /** The landing lamp's lens, unlit so it reads at any hour. */
  heliLamp: "#fff3c4",
} as const;
