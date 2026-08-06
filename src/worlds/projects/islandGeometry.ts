import * as THREE from "three";
import { seeded } from "./materials";

/**
 * Islands are built by hand rather than from a CylinderGeometry so the coastline
 * can be jittered per side. A cylinder would give every island the same perfect
 * circle, which at six islands in one bay reads as six copies of one prop; here
 * each gets its own silhouette from its seed.
 *
 * Geometry is left non-indexed so no vertex is shared between facets. Flat
 * shading derives its normals per triangle either way, but an indexed build
 * would still merge the rings' positions and make later per-facet tweaks fiddly.
 */

/** Sides around the island. Low enough that the facets read as facets. */
const SIDES = 9;

interface Ring {
  /** Per-side Y, so plateau rims can be rugged rather than perfectly level. */
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

export interface IslandGeometry {
  /** Submerged base up to the waterline. */
  shore: THREE.BufferGeometry;
  /** Waterline up to the top of the beach. */
  beach: THREE.BufferGeometry;
  /** Beach up to the plateau rim. */
  slope: THREE.BufferGeometry;
  /** The flat top the centerpiece stands on. */
  cap: THREE.BufferGeometry;
  /** Scattered shoreline rocks as [x, y, z, radius] in island-local space. */
  rocks: [number, number, number, number][];
  /** Y of the plateau, where centerpieces are placed. */
  plateauY: number;
  dispose: () => void;
}

/**
 * One island. `radius` is the waterline radius (and the collision circle), so
 * the submerged base flares wider than it and the plateau sits well inside it —
 * a centerpiece placed at the plateau's edge would otherwise overhang the sea.
 */
export function buildIslandGeometry(radius: number, height: number, seed: number): IslandGeometry {
  const angles = Array.from({ length: SIDES }, (_, i) => (i / SIDES) * Math.PI * 2);

  // One jitter multiplier per side, reused by every ring, so the island tapers
  // as a coherent landmass. Fresh jitter per ring would twist the silhouette
  // into a corkscrew instead.
  const sideJitter = angles.map((_, i) => 0.86 + seeded(seed * 3.1 + i) * 0.28);
  const flat = angles.map(() => 0);
  const rimJitter = angles.map((_, i) => (seeded(seed * 7.7 + i) - 0.5) * height * 0.22);

  const base = buildRing(radius * 1.04, -1.9, sideJitter, flat);
  const waterline = buildRing(radius, -0.12, sideJitter, flat);
  const beachTop = buildRing(radius * 0.82, height * 0.34, sideJitter, flat);
  const plateau = buildRing(radius * 0.52, height, sideJitter, rimJitter);

  const rocks: [number, number, number, number][] = [];
  const rockCount = 3;
  for (let i = 0; i < rockCount; i++) {
    const angle = seeded(seed * 13.3 + i) * Math.PI * 2;
    const dist = radius * (0.9 + seeded(seed * 17.1 + i) * 0.16);
    rocks.push([
      Math.cos(angle) * dist,
      -0.08,
      Math.sin(angle) * dist,
      0.2 + seeded(seed * 19.7 + i) * 0.22,
    ]);
  }

  const shore = buildBand(base, waterline, angles);
  const beach = buildBand(waterline, beachTop, angles);
  const slope = buildBand(beachTop, plateau, angles);
  const cap = buildCap(plateau, angles, height * 1.04);

  return {
    shore,
    beach,
    slope,
    cap,
    rocks,
    plateauY: height * 1.02,
    dispose: () => {
      shore.dispose();
      beach.dispose();
      slope.dispose();
      cap.dispose();
    },
  };
}
