import * as THREE from "three";

/**
 * Fraction of the disc's radius the portal surface itself occupies. The
 * remainder is empty geometry the outer glow fades across, so the halo has
 * somewhere to live without a second mesh.
 */
export const PORTAL_SURFACE_FRACTION = 0.8;

const vertexShader = /* glsl */ `
uniform float uDome;
varying vec2 vDisc;

void main() {
  // The geometry is a unit circle in local XY, so this is already normalized.
  vDisc = position.xy;
  vec3 transformed = position;
  // Push the middle forward into a shallow dome so the disc catches the light
  // as a surface rather than reading as a flat decal pasted on the world.
  transformed.z += uDome * (1.0 - dot(vDisc, vDisc));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uBright;
uniform vec3 uCore;
uniform vec3 uGlow;
varying vec2 vDisc;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

/**
 * Two octaves only. More would add exactly the fine grain this surface is
 * meant not to have — the shapes should stay large and legible.
 */
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 2; i++) {
    sum += valueNoise(p) * amp;
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

void main() {
  vec2 p = vDisc;
  float radius = length(p);

  // Rotating each sample by an amount that depends on its radius shears
  // concentric noise into spiral arms. log() keeps the twist finite at the
  // centre, and because the rotation is a continuous function of position
  // there is no seam where the angle would otherwise wrap from PI to -PI.
  float twist = uTime * 0.35 + uSeed - log(radius + 0.12) * 2.2;
  float cosT = cos(twist);
  float sinT = sin(twist);
  vec2 swirled = mat2(cosT, -sinT, sinT, cosT) * p;

  float n = fbm(swirled * 2.0 + uSeed);

  // Concentric rings shoved around by that noise, so they read as overlapping
  // hand-drawn blobs twisting inward rather than a clean mathematical spiral.
  // Low frequency on purpose: a few broad arms rather than many thin ones.
  float rings = sin(radius * 9.0 - uTime * 1.1 + n * 6.0);
  float shade = smoothstep(-0.7, 0.9, rings * 0.55 + n * 1.1 - radius * 0.35);

  // Posterize into four flat steps. This is what makes the surface read as
  // blocks of solid colour instead of a continuous gradient — quantizing the
  // shade before the mixes means the mixes can only ever land on four tones.
  shade = floor(shade * 4.0) / 3.0;

  vec3 color = mix(uDeep, uMid, clamp(shade * 2.0, 0.0, 1.0));
  color = mix(color, uBright, clamp(shade * 2.0 - 1.0, 0.0, 1.0));

  // Bright churning core, kept crisp-edged to match the flat banding.
  color = mix(color, uCore, smoothstep(0.21, 0.15, radius));

  // Sparse light flecks, carried by the same swirled coordinates so they drift
  // around the spiral with everything else. step() rather than smoothstep so
  // each fleck is a solid chip instead of a soft smudge.
  // Kept small and rare: at lower frequencies the swirl stretches them into
  // long dashes, which puts back the busy-ness the flat banding removed.
  float speck = valueNoise(swirled * 30.0 + uTime * 0.15);
  color = mix(color, uCore, step(0.91, speck));

  // Jagged organic rim. Feeding the angle in as (cos, sin) keeps this noise
  // continuous all the way around the loop instead of tearing at the wrap.
  float angle = atan(p.y, p.x);
  float rimWobble = fbm(vec2(cos(angle), sin(angle)) * 3.0 + uSeed) - 0.5;
  float edge = ${PORTAL_SURFACE_FRACTION.toFixed(3)} + rimWobble * 0.1;

  float inside = 1.0 - smoothstep(edge - 0.03, edge + 0.01, radius);
  float pulse = 0.82 + 0.18 * sin(uTime * 1.7 + uSeed);
  float halo = exp(-max(radius - edge, 0.0) * 11.0) * (1.0 - inside) * pulse;

  color += uGlow * halo * 1.4;
  // Pulse the surface too, so the whole disc breathes rather than just its edge.
  color *= mix(1.0, pulse, inside * 0.35);

  float alpha = max(inside, halo);
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(color, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The swirling portal surface. Unlit on purpose — it is a light source in the
 * fiction, so it ignores the scene's toon lighting entirely and just emits.
 * Each portal gets its own material so `uSeed` can decorrelate the swirls;
 * they would otherwise churn in perfect lockstep.
 */
export function createPortalMaterial(seed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    // The disc is emissive and never needs to occlude anything, so writing
    // depth would only risk it clipping its own glow against neighbours.
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uDome: { value: 0.12 },
      // Built through THREE.Color so they land in the renderer's linear working
      // space, matching every other material in the scene. All four surface
      // tones sit in the lavender range — the darkest is a muted violet rather
      // than a near-black, so the flat bands stay a family instead of reading
      // as light shapes cut out of a dark hole.
      uDeep: { value: new THREE.Color("#4c327f") },
      uMid: { value: new THREE.Color("#9078d8") },
      uBright: { value: new THREE.Color("#c7b0f6") },
      uCore: { value: new THREE.Color("#f4efff") },
      uGlow: { value: new THREE.Color("#bda6f5") },
    },
  });
}
