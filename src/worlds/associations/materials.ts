import * as THREE from "three";

/**
 * Flat-shaded Lambert materials for the clearing.
 *
 * The same arrangement the archipelago, the office and the library each keep —
 * see the note in `worlds/projects/materials.ts` for why every world owns its
 * shading rather than importing one shared helper. Lambert because the look
 * wants light in broad even washes, and `flatShading` because each triangle
 * should hold a single solid tone.
 */
const cache = new Map<string, THREE.MeshLambertMaterial>();

/**
 * Cached by colour — for static set dressing. Never mutate what this returns:
 * the instance is shared by every mesh asking for that colour, so animating one
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
 * A fresh instance every call, for anything the render loop drives — the
 * balloons' proximity and hover glow. Callers own it and dispose it on unmount.
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
 * Deterministic pseudo-random in [0, 1), so the treeline and the rocks scatter
 * the same way on every render. `Math.random()` here would reshuffle the whole
 * clearing on each React commit.
 */
export function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
