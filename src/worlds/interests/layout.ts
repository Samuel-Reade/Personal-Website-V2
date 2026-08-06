/**
 * Layout for the shelf room. The camera never moves, so everything here is
 * arranged to read from that one viewpoint: all ten objects sit in frame at
 * once, none occludes another, and each is large enough to identify without
 * getting closer.
 */

/** Outer dimensions of the unit. */
export const SHELF_WIDTH = 3.6;
export const SHELF_HEIGHT = 2.5;
export const SHELF_DEPTH = 0.5;
/** Thickness of the boards, uprights and back panel. */
export const BOARD = 0.055;
export const BACK_PANEL_Z = -SHELF_DEPTH / 2;

/**
 * Y of each tier's standing surface, bottom to top, with the headroom above
 * each. Both are larger than a real bookcase's would be: the objects are the
 * subject here, and they are sized to fill this space rather than to sit
 * politely inside it.
 */
export const TIER_Y = [0.34, 1.06, 1.78] as const;
export const TIER_CLEARANCE = 0.72;

/** Usable span across a tier, inside the uprights. */
export const INNER_HALF_WIDTH = SHELF_WIDTH / 2 - BOARD - 0.12;

/**
 * Standing eye position. Far enough back that the whole unit is in frame at
 * 4:3, close enough that the objects still fill it. Fixed for the scene's
 * lifetime — the look controls rotate from here, they never translate.
 */
export const EYE: [number, number, number] = [0, 1.28, 2.95];

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
  /** Shown in the hover label. Matches an INTERESTS entry's `label`. */
  label: string;
  /** Tier index into TIER_Y. */
  tier: number;
  /** Position across the tier, in world X. */
  x: number;
  /** Depth offset from the tier's centre line. Varied so nothing sits in a rank. */
  z: number;
  /** Y rotation, so no two objects face exactly the same way. */
  rotationY: number;
  /**
   * Size of the piece as modelled in Figurines.tsx, before `scale`. Kept here
   * rather than measured at runtime so the fit can be checked without a
   * renderer — and so these numbers are the ones the layout actually reasons
   * about, not a second copy of them living in a test.
   */
  modelHeight: number;
  modelHalfWidth: number;
  /**
   * Enlargement. Chosen per object so each one fills a good share of its tier's
   * headroom — the small pieces (a book stack, a handful of bricks) need far
   * more of it than the tall ones to carry equal weight on the shelf.
   */
  scale: number;
}

/** Final height of a piece once scaled. */
export function objectHeight(spot: ObjectSpot): number {
  return spot.modelHeight * spot.scale;
}

/** Final half-width of a piece once scaled. */
export function objectHalfWidth(spot: ObjectSpot): number {
  return spot.modelHalfWidth * spot.scale;
}

/** Radius of the halo pooled on the board beneath a piece. */
export function haloRadius(spot: ObjectSpot): number {
  return objectHalfWidth(spot) * 1.15;
}

/**
 * Ten objects over three tiers, 3 / 3 / 4 from the top down.
 *
 * The bottom board takes the extra one because it holds the narrowest pieces.
 * X positions are spread across the tier and then nudged, and every piece has
 * its own rotation and depth, so the shelf reads as arranged by hand rather
 * than laid out on a grid.
 */
export const OBJECTS: ObjectSpot[] = [
  // Top tier
  { id: "stellar", label: "Stellar Masses", tier: 2, x: -1.05, z: -0.02, rotationY: 0.38, modelHeight: 0.42, modelHalfWidth: 0.13, scale: 1.38 },
  { id: "travel", label: "Travel", tier: 2, x: 0.0, z: 0.03, rotationY: -0.22, modelHeight: 0.3, modelHalfWidth: 0.12, scale: 1.67 },
  { id: "film", label: "Film", tier: 2, x: 1.05, z: -0.01, rotationY: 0.5, modelHeight: 0.23, modelHalfWidth: 0.15, scale: 2.0 },

  // Middle tier
  { id: "history", label: "Ancient History", tier: 1, x: -1.05, z: 0.0, rotationY: -0.3, modelHeight: 0.39, modelHalfWidth: 0.1, scale: 1.44 },
  { id: "onepiece", label: "One Piece", tier: 1, x: 0.05, z: 0.02, rotationY: 0.24, modelHeight: 0.16, modelHalfWidth: 0.23, scale: 1.7 },
  { id: "reading", label: "Reading", tier: 1, x: 1.1, z: -0.02, rotationY: -0.42, modelHeight: 0.13, modelHalfWidth: 0.12, scale: 2.3 },

  // Bottom tier
  { id: "skiing", label: "Skiing", tier: 0, x: -1.15, z: -0.04, rotationY: 0.16, modelHeight: 0.55, modelHalfWidth: 0.13, scale: 1.09 },
  { id: "sports", label: "Sports", tier: 0, x: -0.35, z: 0.02, rotationY: -0.18, modelHeight: 0.19, modelHalfWidth: 0.1, scale: 2.3 },
  { id: "lego", label: "LEGO", tier: 0, x: 0.5, z: 0.03, rotationY: 0.32, modelHeight: 0.14, modelHalfWidth: 0.13, scale: 2.3 },
  { id: "archery", label: "Archery", tier: 0, x: 1.25, z: -0.02, rotationY: 0.28, modelHeight: 0.47, modelHalfWidth: 0.17, scale: 1.28 },
];

export type DressingKind = "books" | "plant" | "candle";

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
 * than positioned by eye. Deliberately sparse — a few book runs, one plant and
 * two candles. The objects are what the shelf is for, and every extra prop is
 * something else competing with them for the eye.
 */
export const DRESSING: DressingSpot[] = [
  // Top tier
  { kind: "books", tier: 2, x: -1.42, z: -0.03, halfWidth: 0.075, rotationY: 0.06, count: 3 },
  { kind: "books", tier: 2, x: -0.53, z: -0.04, halfWidth: 0.1, rotationY: -0.09, count: 4 },
  { kind: "candle", tier: 2, x: 0.47, z: 0.0, halfWidth: 0.055, rotationY: 0, height: 0.15 },

  // Middle tier
  { kind: "plant", tier: 1, x: -1.42, z: -0.02, halfWidth: 0.07, rotationY: 0.3 },
  { kind: "books", tier: 1, x: 0.63, z: -0.05, halfWidth: 0.075, rotationY: 0.14, count: 3 },

  // Bottom tier
  { kind: "candle", tier: 0, x: -0.85, z: 0.01, halfWidth: 0.055, rotationY: 0, height: 0.21 },
  { kind: "books", tier: 0, x: 0.04, z: -0.02, halfWidth: 0.05, rotationY: -0.05, count: 2 },
];
