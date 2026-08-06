import * as THREE from "three";

/**
 * Flat-shaded Lambert materials, cached by color. Lambert rather than Standard
 * because the look wants light to land in broad even washes — a roughness /
 * metalness response would put specular highlights on surfaces whose whole
 * point is to read as flat facets.
 *
 * `flatShading` is what produces the faceted look: it discards the smoothed
 * vertex normals three.js generates and lights each triangle by its own face
 * normal, so every facet stays a single solid tone.
 */
const cache = new Map<string, THREE.MeshLambertMaterial>();

export function flatMat(color: string): THREE.MeshLambertMaterial {
  let material = cache.get(color);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, flatShading: true });
    cache.set(color, material);
  }
  return material;
}

const emissiveCache = new Map<string, THREE.MeshLambertMaterial>();

/** Flat material that also emits — ceiling panels, screen glow, window light. */
export function glowMat(color: string, intensity = 1): THREE.MeshLambertMaterial {
  const key = `${color}:${intensity}`;
  let material = emissiveCache.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: intensity,
      flatShading: true,
    });
    emissiveCache.set(key, material);
  }
  return material;
}

/**
 * Deterministic pseudo-random in [0, 1). The office set dressing needs jitter
 * that survives re-renders — Math.random() would reshuffle every desk in the
 * room on each React commit.
 */
export function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
