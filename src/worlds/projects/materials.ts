import * as THREE from "three";

/**
 * Flat-shaded Lambert materials for the archipelago. Lambert rather than
 * Standard because the look wants light to land in broad even washes — a
 * roughness / metalness response would put specular highlights on surfaces
 * whose whole point is to read as flat facets.
 *
 * `flatShading` is what produces the faceted look: it discards the smoothed
 * vertex normals three.js generates and lights each triangle by its own face
 * normal, so every facet stays a single solid tone.
 *
 * This mirrors the office's and the library's own material modules rather than
 * importing one of them. Each world owning its shading keeps them independently
 * tunable — the alternative couples three unrelated looks to one helper, and the
 * first world that needs a different response breaks the other two.
 */
const cache = new Map<string, THREE.MeshLambertMaterial>();

/**
 * Cached by color — use for static set dressing. Never mutate what this returns:
 * the instance is shared by every mesh asking for that color, so animating one
 * consumer's emissive would animate all of them.
 */
export function flatMat(color: string): THREE.MeshLambertMaterial {
  let material = cache.get(color);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, flatShading: true });
    cache.set(color, material);
  }
  return material;
}

/**
 * A fresh instance every call, for anything the render loop drives — hover
 * glows, fading wake rings, drifting smoke. Callers own it and should dispose it
 * when the component unmounts.
 */
export function flatMatUnique(
  color: string,
  opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    transparent: opts.transparent,
    opacity: opts.opacity ?? 1,
  });
  if (opts.emissive !== undefined) {
    material.emissive = new THREE.Color(opts.emissive);
    material.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  return material;
}

/**
 * Deterministic pseudo-random in [0, 1). The islands need jitter that survives
 * re-renders — Math.random() would reshuffle every coastline in the archipelago
 * on each React commit.
 */
export function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
