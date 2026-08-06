import { useMemo } from "react";
import * as THREE from "three";

/**
 * The star background: one `Points` cloud on a thick spherical shell far outside
 * anything the player can reach.
 *
 * Points rather than a skybox texture because the stars have to hold up while
 * the player translates. A cube map is painted at infinity and never shifts, so
 * flying across the system would leave the background locked rigidly to the
 * camera — the one thing that would give away that this is a small set. Real
 * geometry at a real (if large) distance parallaxes properly against the planets.
 */

const STAR_COUNT = 5200;
/** Shell bounds. Thick, so the field itself has depth rather than being a wall. */
const NEAR_SHELL = 220;
const FAR_SHELL = 480;

/**
 * Star tints, roughly along the stellar sequence — most stars are white or
 * faintly warm, with a scattering of hot blue and cool orange for variety.
 */
const TINTS: [number, string][] = [
  [0.5, "#ffffff"],
  [0.72, "#e8f0ff"],
  [0.86, "#ffe9c9"],
  [0.95, "#bcd4ff"],
  [1.0, "#ffbb88"],
];

function pickTint(t: number): THREE.Color {
  for (const [threshold, hex] of TINTS) {
    if (t <= threshold) return new THREE.Color(hex);
  }
  return new THREE.Color("#ffffff");
}

/** Deterministic pseudo-random in [0, 1) — the sky should be identical each visit. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function Starfield() {
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Direction from an evenly-distributed point on the sphere. Taking `z`
      // uniformly (rather than the polar angle) is what keeps the field from
      // bunching at the poles.
      const z = seeded(i * 1.7) * 2 - 1;
      const theta = seeded(i * 3.3 + 11) * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      const distance = NEAR_SHELL + seeded(i * 5.9 + 3) * (FAR_SHELL - NEAR_SHELL);

      positions[i * 3 + 0] = Math.cos(theta) * r * distance;
      positions[i * 3 + 1] = z * distance;
      positions[i * 3 + 2] = Math.sin(theta) * r * distance;

      const tint = pickTint(seeded(i * 7.1 + 5));
      // Dim a proportion of them so the field has faint stars behind bright
      // ones instead of reading as one uniform sheet of dots.
      const brightness = 0.42 + seeded(i * 2.3 + 9) * 0.58;
      colors[i * 3 + 0] = tint.r * brightness;
      colors[i * 3 + 1] = tint.g * brightness;
      colors[i * 3 + 2] = tint.b * brightness;

      // A handful of much larger stars carry the eye; the rest stay small.
      const roll = seeded(i * 11.3 + 2);
      sizes[i] = roll > 0.985 ? 4.2 : roll > 0.92 ? 2.4 : 1.3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    // Named `aSize`, not `size`: PointsMaterial's own vertex shader already
    // declares a uniform called `size`, and an attribute of the same name fails
    // to compile.
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      // Without attenuation every star renders the same size regardless of
      // distance, which flattens the shell's depth back out.
      sizeAttenuation: true,
      size: 1.3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    // Scale the base size by the per-star attribute. PointsMaterial has no
    // per-point size of its own, so this is the one line of shader patching
    // needed to get a field with genuinely varied magnitudes. The distance
    // attenuation in the stock shader runs after this line, so it still applies.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = `attribute float aSize;\n${shader.vertexShader}`.replace(
        "gl_PointSize = size;",
        "gl_PointSize = size * aSize;"
      );
    };
    mat.customProgramCacheKey = () => "star-sizes";

    return { geometry: geo, material: mat };
  }, []);

  // `frustumCulled` off: the cloud's bounding sphere is centred on the origin,
  // not the camera, so a player who has drifted toward one edge of the system can
  // otherwise have the entire sky culled at once.
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
