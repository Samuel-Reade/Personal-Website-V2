import * as THREE from "three";
import { seeded } from "./materials";

/**
 * Islands are built by hand rather than from a CylinderGeometry so the coastline
 * can be jittered per side. A cylinder would give every island the same perfect
 * circle, which at seven islands in one bay reads as seven copies of one prop; here
 * each gets its own silhouette from its seed.
 *
 * Geometry is left non-indexed so no vertex is shared between facets. Flat
 * shading derives its normals per triangle either way, but an indexed build
 * would still merge the rings' positions and make later per-facet tweaks fiddly.
 */

/** Sides around the island. Enough for a coastline with real bays in it, few enough to stay faceted. */
const SIDES = 14;

interface Ring {
  /** Per-side Y, so rims can be rugged rather than perfectly level. */
  ys: number[];
  /** Per-side radius. */
  radii: number[];
}

function buildRing(radius: number, y: number, jitter: number[], yJitter: number[]): Ring {
  return {
    radii: jitter.map((j) => radius * j),
    ys: yJitter.map((j) => y + j),
  };
}

function ringPoint(ring: Ring, angles: number[], i: number): [number, number, number] {
  return [Math.cos(angles[i]) * ring.radii[i], ring.ys[i], Math.sin(angles[i]) * ring.radii[i]];
}

/**
 * A skirt of quads between two rings. Winding is (lower_i, upper_i, upper_j)
 * then (lower_i, upper_j, lower_j) — the order that puts the face normal
 * outward; the reverse lights the island from the inside and renders it black.
 */
function buildBand(lower: Ring, upper: Ring, angles: number[]): THREE.BufferGeometry {
  const positions: number[] = [];

  for (let i = 0; i < angles.length; i++) {
    const j = (i + 1) % angles.length;
    const a = ringPoint(lower, angles, i);
    const b = ringPoint(lower, angles, j);
    const c = ringPoint(upper, angles, j);
    const d = ringPoint(upper, angles, i);
    positions.push(...a, ...d, ...c, ...a, ...c, ...b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Triangle fan closing the plateau. Wound (center, j, i) so the normal points up. */
function buildCap(ring: Ring, angles: number[], centerY: number): THREE.BufferGeometry {
  const positions: number[] = [];

  for (let i = 0; i < angles.length; i++) {
    const j = (i + 1) % angles.length;
    positions.push(0, centerY, 0, ...ringPoint(ring, angles, j), ...ringPoint(ring, angles, i));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export type ScatterKind = "palm" | "bush" | "tuft";

export interface ScatterProp {
  kind: ScatterKind;
  position: [number, number, number];
  scale: number;
  rotationY: number;
}

export interface IslandGeometry {
  /** Submerged base up to the waterline. */
  shore: THREE.BufferGeometry;
  /** Waterline up to the top of the beach. */
  beach: THREE.BufferGeometry;
  /** Beach up to the shoulder. */
  lower: THREE.BufferGeometry;
  /** Shoulder up to the plateau rim. */
  upper: THREE.BufferGeometry;
  /** The flat top the centerpiece stands on. */
  cap: THREE.BufferGeometry;
  /** Shoreline boulders as [x, y, z, radius] in island-local space. */
  rocks: [number, number, number, number][];
  /** Palms, bushes and grass tufts sitting on the island's slopes. */
  scatter: ScatterProp[];
  /** Y of the plateau, where centerpieces are placed. */
  plateauY: number;
  dispose: () => void;
}

/**
 * One island. `radius` is the waterline radius (and the collision circle), so
 * the submerged base flares wider than it and the plateau sits well inside it —
 * a centerpiece placed at the plateau's edge would otherwise overhang the sea.
 *
 * `plateauFraction` controls how much of the island is flat top: the working
 * islands (an airstrip, a film set, a gym) need far more usable ground than the
 * ones carrying a single object.
 */
export function buildIslandGeometry(
  radius: number,
  height: number,
  seed: number,
  plateauFraction = 0.52
): IslandGeometry {
  const angles = Array.from({ length: SIDES }, (_, i) => (i / SIDES) * Math.PI * 2);

  // One jitter multiplier per side, reused by every ring, so the island tapers
  // as a coherent landmass. Fresh jitter per ring would twist the silhouette
  // into a corkscrew instead.
  const sideJitter = angles.map((_, i) => 0.84 + seeded(seed * 3.1 + i) * 0.32);
  const flat = angles.map(() => 0);
  // A second, smaller jitter applied only to the mid bands, so the slope bulges
  // and pinches on its way up instead of being a clean cone.
  const shoulderJitter = angles.map((_, i) => sideJitter[i] * (0.9 + seeded(seed * 5.3 + i) * 0.2));
  const beachJitter = angles.map((_, i) => sideJitter[i] * (0.95 + seeded(seed * 9.1 + i) * 0.12));
  const rimJitter = angles.map((_, i) => (seeded(seed * 7.7 + i) - 0.5) * height * 0.2);
  const beachYJitter = angles.map((_, i) => (seeded(seed * 11.3 + i) - 0.5) * height * 0.12);

  const base = buildRing(radius * 1.05, -1.9, sideJitter, flat);
  const waterline = buildRing(radius, -0.12, sideJitter, flat);
  const beachTop = buildRing(radius * 0.88, height * 0.22, beachJitter, beachYJitter);
  const shoulder = buildRing(radius * (plateauFraction + 0.2), height * 0.62, shoulderJitter, beachYJitter);
  const plateau = buildRing(radius * plateauFraction, height, sideJitter, rimJitter);

  const rocks: [number, number, number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const angle = seeded(seed * 13.3 + i) * Math.PI * 2;
    const dist = radius * (0.88 + seeded(seed * 17.1 + i) * 0.2);
    rocks.push([
      Math.cos(angle) * dist,
      -0.1 + seeded(seed * 23.9 + i) * 0.12,
      Math.sin(angle) * dist,
      0.16 + seeded(seed * 19.7 + i) * 0.3,
    ]);
  }

  // Foliage is placed by interpolating between two rings at a real side index,
  // so every prop is guaranteed to sit on the surface however the coastline was
  // jittered — computing a height from the radius alone would float or bury
  // props wherever the island bulges.
  const scatter: ScatterProp[] = [];
  const scatterCount = Math.round(radius * 2.6);
  for (let i = 0; i < scatterCount; i++) {
    const side = Math.floor(seeded(seed * 29.3 + i) * SIDES) % SIDES;
    const nextSide = (side + 1) % SIDES;
    const along = seeded(seed * 31.7 + i);
    const up = 0.12 + seeded(seed * 37.1 + i) * 0.76;

    const lowPoint = ringPoint(beachTop, angles, side);
    const lowNext = ringPoint(beachTop, angles, nextSide);
    const highPoint = ringPoint(plateau, angles, side);
    const highNext = ringPoint(plateau, angles, nextSide);

    // Blend around the ring as well as up it, so props aren't lined up on the
    // fourteen spokes the geometry happens to be built from.
    const lx = THREE.MathUtils.lerp(lowPoint[0], lowNext[0], along);
    const lz = THREE.MathUtils.lerp(lowPoint[2], lowNext[2], along);
    const ly = THREE.MathUtils.lerp(lowPoint[1], lowNext[1], along);
    const hx = THREE.MathUtils.lerp(highPoint[0], highNext[0], along);
    const hz = THREE.MathUtils.lerp(highPoint[2], highNext[2], along);
    const hy = THREE.MathUtils.lerp(highPoint[1], highNext[1], along);

    const roll = seeded(seed * 41.9 + i);
    scatter.push({
      kind: roll < 0.22 ? "palm" : roll < 0.6 ? "bush" : "tuft",
      position: [
        THREE.MathUtils.lerp(lx, hx, up),
        THREE.MathUtils.lerp(ly, hy, up),
        THREE.MathUtils.lerp(lz, hz, up),
      ],
      scale: 0.7 + seeded(seed * 43.7 + i) * 0.7,
      rotationY: seeded(seed * 47.3 + i) * Math.PI * 2,
    });
  }

  const shore = buildBand(base, waterline, angles);
  const beach = buildBand(waterline, beachTop, angles);
  const lower = buildBand(beachTop, shoulder, angles);
  const upper = buildBand(shoulder, plateau, angles);
  const cap = buildCap(plateau, angles, height * 1.03);

  return {
    shore,
    beach,
    lower,
    upper,
    cap,
    rocks,
    scatter,
    plateauY: height * 1.01,
    dispose: () => {
      shore.dispose();
      beach.dispose();
      lower.dispose();
      upper.dispose();
      cap.dispose();
    },
  };
}
