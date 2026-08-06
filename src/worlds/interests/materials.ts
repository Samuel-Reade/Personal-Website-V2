import * as THREE from "three";

/**
 * Flat-shaded Lambert materials for the shelf room. Lambert rather than
 * Standard because the look wants light to land in broad even washes — a
 * roughness / metalness response would put specular highlights on surfaces
 * whose whole point is to read as flat facets.
 *
 * `flatShading` is what produces the faceted look: it discards the smoothed
 * vertex normals three.js generates and lights each triangle by its own face
 * normal, so every facet stays a single solid tone.
 *
 * Mirrors the office's and the library's own material modules rather than
 * importing one of them. Each world owning its shading keeps them independently
 * tunable; the first world that needs a different response would otherwise break
 * the other two.
 */
const cache = new Map<string, THREE.MeshLambertMaterial>();

/**
 * Cached by color — use for anything static. Never mutate what this returns:
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

const glowCache = new Map<string, THREE.MeshLambertMaterial>();

/** Flat material that also emits — candle flames, and nothing else in here. */
export function glowMat(color: string, intensity = 1): THREE.MeshLambertMaterial {
  const key = `${color}:${intensity}`;
  let material = glowCache.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: intensity,
      flatShading: true,
    });
    glowCache.set(key, material);
  }
  return material;
}

/**
 * Deterministic pseudo-random in [0, 1). The shelf dressing needs jitter that
 * survives re-renders — Math.random() would reshuffle every book on the shelf
 * on each React commit.
 */
export function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
