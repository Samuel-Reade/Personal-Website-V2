/**
 * Layout for the shelf room. The camera never moves from EYE, so everything
 * here is arranged to read from that one viewpoint: all ten interactive objects
 * sit inside the frame at once, none occludes another, and nothing important
 * hides behind the uprights.
 */

/** Outer dimensions of the unit. Width is held under the 4:3 frame width at EYE's distance. */
export const SHELF_WIDTH = 3.0;
export const SHELF_HEIGHT = 2.1;
export const SHELF_DEPTH = 0.44;
/** Thickness of the boards, uprights and back panel. */
export const BOARD = 0.055;
export const BACK_PANEL_Z = -SHELF_DEPTH / 2;

/**
 * Y of each tier's standing surface, bottom to top. Three tiers spread ten
 * objects without crowding; two would put four or five on a board and the
 * silhouettes would start to merge at this distance.
 */
export const TIER_Y = [0.32, 0.97, 1.62] as const;
/** Headroom above each tier — objects are sized to clear this. */
export const TIER_CLEARANCE = 0.6;

/** Usable span across a tier, inside the uprights. */
export const INNER_HALF_WIDTH = SHELF_WIDTH / 2 - BOARD - 0.12;

/**
 * Seated-height eye, standing back far enough that the whole unit is in frame.
 * Fixed for the scene's lifetime — the look controls rotate from here, they
 * never translate.
 */
export const EYE: [number, number, number] = [0, 1.12, 2.35];

export type InterestId =
  | "travel"
  | "skiing"
  | "history"
  | "onepiece"
  | "reading"
  | "film"
  | "stellar"
  | "sports"
  | "lego"
  | "archery";

export interface ObjectSpot {
  id: InterestId;
  /** Matches an INTERESTS entry's `label` exactly — the key the panel narrows on. */
  label: string;
  /** Tier index into TIER_Y. */
  tier: number;
  /** Position across the tier, in world X. */
  x: number;
  /** Depth offset from the tier's centre line. Varied so nothing sits in a rank. */
  z: number;
  /** Y rotation, so no two objects face exactly the same way. */
  rotationY: number;
  /** Radius of the hover halo pooled on the board beneath. */
  haloRadius: number;
}

/**
 * Ten objects over three tiers, 3 / 4 / 3 from the top down.
 *
 * X positions are spread evenly across the tier and then nudged, and every piece
 * gets its own small rotation, so the shelf reads as arranged by hand rather
 * than laid out on a grid. The middle tier takes four because it sits closest to
 * eye level, where there is the most room to tell neighbours apart.
 */
export const OBJECTS: ObjectSpot[] = [
  // Top tier
  { id: "stellar", label: "Stellar Masses", tier: 2, x: -0.94, z: -0.02, rotationY: 0.38, haloRadius: 0.19 },
  { id: "travel", label: "Travel", tier: 2, x: 0.02, z: 0.03, rotationY: -0.22, haloRadius: 0.17 },
  { id: "film", label: "Film", tier: 2, x: 0.95, z: -0.01, rotationY: 0.5, haloRadius: 0.17 },

  // Middle tier
  { id: "history", label: "Ancient History", tier: 1, x: -1.06, z: 0.0, rotationY: -0.3, haloRadius: 0.16 },
  { id: "onepiece", label: "One Piece", tier: 1, x: -0.36, z: 0.02, rotationY: 0.24, haloRadius: 0.2 },
  { id: "reading", label: "Reading", tier: 1, x: 0.35, z: -0.02, rotationY: -0.42, haloRadius: 0.18 },
  { id: "lego", label: "LEGO", tier: 1, x: 1.05, z: 0.03, rotationY: 0.32, haloRadius: 0.15 },

  // Bottom tier
  { id: "skiing", label: "Skiing", tier: 0, x: -0.98, z: -0.04, rotationY: 0.16, haloRadius: 0.17 },
  { id: "sports", label: "Sports", tier: 0, x: 0.0, z: 0.02, rotationY: -0.18, haloRadius: 0.16 },
  { id: "archery", label: "Archery", tier: 0, x: 0.97, z: -0.02, rotationY: 0.28, haloRadius: 0.17 },
];

export type DressingKind = "books" | "plant" | "candle" | "frame";

export interface DressingSpot {
  kind: DressingKind;
  tier: number;
  x: number;
  z: number;
  /** How much room it takes across the board, used to prove it clears its neighbours. */
  halfWidth: number;
  rotationY: number;
  /** Books only: how many in the run. Drives the run's width, so it has to agree with halfWidth. */
  count?: number;
  /** Candles only. */
  height?: number;
}

/**
 * Non-interactive dressing, dropped into the gaps the ten objects leave rather
 * than positioned by eye. Every entry sits in a measured gap and is checked
 * against its neighbours — a stray book run overlapping a clickable object would
 * both look wrong and steal pointer events from it.
 *
 * The narrow slots at the extreme ends of the middle tier are deliberately left
 * empty: at 0.15-wide there is no piece of dressing that fits without touching
 * the object beside it.
 */
export const DRESSING: DressingSpot[] = [
  // Top tier
  { kind: "books", tier: 2, x: -1.2, z: -0.03, halfWidth: 0.075, rotationY: 0.06, count: 3 },
  { kind: "books", tier: 2, x: -0.45, z: -0.04, halfWidth: 0.1, rotationY: -0.09, count: 4 },
  { kind: "candle", tier: 2, x: 0.47, z: 0.0, halfWidth: 0.055, rotationY: 0, height: 0.13 },
  { kind: "books", tier: 2, x: 1.215, z: -0.03, halfWidth: 0.05, rotationY: -0.11, count: 2 },

  // Middle tier
  { kind: "books", tier: 1, x: -0.775, z: -0.05, halfWidth: 0.05, rotationY: 0.13, count: 2 },
  { kind: "books", tier: 1, x: 0.05, z: -0.05, halfWidth: 0.075, rotationY: 0.14, count: 3 },
  { kind: "plant", tier: 1, x: 0.695, z: -0.02, halfWidth: 0.07, rotationY: 0.3, count: undefined },

  // Bottom tier
  { kind: "books", tier: 0, x: -0.47, z: -0.02, halfWidth: 0.125, rotationY: -0.05, count: 5 },
  { kind: "candle", tier: 0, x: 0.3, z: 0.01, halfWidth: 0.055, rotationY: 0, height: 0.19 },
  { kind: "frame", tier: 0, x: 0.6, z: -0.07, halfWidth: 0.12, rotationY: 0.1 },
  { kind: "books", tier: 0, x: 1.235, z: -0.03, halfWidth: 0.05, rotationY: 0.12, count: 2 },
];
