import { PORTAL_SURFACE_RADIUS } from "./portalMaterial";

/**
 * The parts of a portal the walk-in trigger cares about: where its disc stands,
 * which way it faces, and how big it is. `PortalSpot` in `world.ts` satisfies
 * this, and so does the prop set every `ReturnPortal` is given.
 */
export interface PortalDisc {
  position: [number, number, number];
  /** Y rotation of the disc; its face normal is (sin, 0, cos) of this. */
  rotationY: number;
  /** Multiplier on `PORTAL_SURFACE_RADIUS`. */
  scale: number;
}

/**
 * Whether a walker with this footprint radius, having moved from (fromX, fromZ)
 * to (toX, toZ) this frame, has touched any part of the disc.
 *
 * The rule is contact, not proximity: the trigger fires the moment any part of
 * the character meets any part of the visible surface, whether that is walking
 * square into the middle of it or clipping its rim on the way past. The disc is
 * a thin vertical circle standing on edge, so seen from above it is a segment
 * — through the centre, along the face, half as long as the surface radius —
 * and "touching" is the character's collision circle reaching that segment.
 * Every ground world's disc floats low enough and stands tall enough that the
 * walker's height overlaps it right out to the rim, so a flat test is enough.
 *
 * It is swept rather than sampled: the test is the distance from the segment
 * to the character's whole path across the frame, so a fast walker cannot step
 * clean over a footprint two-thirds of a unit thick between two frames. At the
 * speed slider's top a stride can be 0.4 units at 60 Hz, more on a slow frame,
 * which is exactly how a plain point test would miss.
 */
export function touchesPortalDisc(
  disc: PortalDisc,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  radius: number
): boolean {
  const [cx, , cz] = disc.position;
  const half = PORTAL_SURFACE_RADIUS * disc.scale;
  // The disc's local +X, i.e. the direction along its face, in world XZ.
  const alongX = Math.cos(disc.rotationY);
  const alongZ = -Math.sin(disc.rotationY);
  const ax = cx - alongX * half;
  const az = cz - alongZ * half;
  const bx = cx + alongX * half;
  const bz = cz + alongZ * half;

  return segmentDistance(fromX, fromZ, toX, toZ, ax, az, bx, bz) < radius;
}

/** Shortest distance between segments PQ and AB in the plane. */
function segmentDistance(
  px: number,
  pz: number,
  qx: number,
  qz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  // Proper crossing: each segment's endpoints fall on opposite sides of the
  // other's line. Any touch that isn't a proper crossing — a shared endpoint,
  // a collinear overlap, a zero-length path — puts one endpoint on the other
  // segment, and the point tests below then measure it at zero anyway.
  const d1 = cross(ax, az, bx, bz, px, pz);
  const d2 = cross(ax, az, bx, bz, qx, qz);
  const d3 = cross(px, pz, qx, qz, ax, az);
  const d4 = cross(px, pz, qx, qz, bx, bz);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;

  return Math.min(
    pointSegmentDistance(px, pz, ax, az, bx, bz),
    pointSegmentDistance(qx, qz, ax, az, bx, bz),
    pointSegmentDistance(ax, az, px, pz, qx, qz),
    pointSegmentDistance(bx, bz, px, pz, qx, qz)
  );
}

/** Which side of the line through A and B the point P lies on (signed area). */
function cross(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
  return (bx - ax) * (pz - az) - (bz - az) * (px - ax);
}

/** Distance from point P to the nearest point on segment AB. */
function pointSegmentDistance(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const length2 = abx * abx + abz * abz;
  const t =
    length2 > 0
      ? Math.min(1, Math.max(0, ((px - ax) * abx + (pz - az) * abz) / length2))
      : 0;
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}
