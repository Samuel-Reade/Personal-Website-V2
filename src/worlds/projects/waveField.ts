/**
 * The sea's wave field, defined once and consumed twice: the water surface
 * displaces its vertices with the GLSL below, and the boat samples the JS
 * function to ride the same swell. Keeping two hand-written copies in sync is
 * exactly the kind of thing that silently rots the first time an amplitude is
 * tweaked, so the GLSL is generated from these numbers rather than written out
 * beside them — the boat physically cannot drift out of the water it floats on.
 */

export interface Wave {
  /** Unit direction the crest lines travel along, in world XZ. */
  dirX: number;
  dirZ: number;
  amplitude: number;
  wavelength: number;
  /** Radians per second the phase advances. */
  speed: number;
}

/**
 * Three waves, deliberately non-harmonic (11 / 6.4 / 3.9) and pointed in
 * unrelated directions, so the sum never visibly repeats into a tiling pattern.
 * Amplitudes fall off with wavelength — a short wave as tall as the long swell
 * reads as noise rather than chop.
 */
export const WAVES: Wave[] = [
  { dirX: 0.87, dirZ: 0.5, amplitude: 0.13, wavelength: 11, speed: 0.85 },
  { dirX: -0.42, dirZ: 0.91, amplitude: 0.08, wavelength: 6.4, speed: 1.25 },
  { dirX: 0.64, dirZ: -0.77, amplitude: 0.045, wavelength: 3.9, speed: 1.8 },
];

const TAU = Math.PI * 2;

/** Crest-to-trough half-range, used to normalize the crest tint in the shader. */
export const WAVE_AMPLITUDE = WAVES.reduce((sum, w) => sum + w.amplitude, 0);

/** Surface height at a world XZ position. The GPU runs the generated twin below. */
export function waveHeight(x: number, z: number, time: number): number {
  let h = 0;
  for (const w of WAVES) {
    h += w.amplitude * Math.sin((x * w.dirX + z * w.dirZ) * (TAU / w.wavelength) + time * w.speed);
  }
  return h;
}

/**
 * The same function as GLSL, with the constants baked in as literals. Injected
 * into the water material by `Water.tsx`.
 */
export const WAVE_GLSL = `
float waveHeight(vec2 p, float t) {
  float h = 0.0;
${WAVES.map(
  (w) =>
    `  h += ${w.amplitude.toFixed(4)} * sin(dot(p, vec2(${w.dirX.toFixed(4)}, ${w.dirZ.toFixed(4)})) * ${(
      TAU / w.wavelength
    ).toFixed(5)} + t * ${w.speed.toFixed(4)});`
).join("\n")}
  return h;
}
`;
