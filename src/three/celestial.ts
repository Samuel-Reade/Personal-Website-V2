import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import type { SunState } from "../utils/time";

/**
 * Shared placement and fading for the sun and moon, used by every outdoor world
 * so a body sits at the same bearing in each of them at the same moment. The
 * clock itself lives in `utils/time.ts`; this is only the geometry.
 */

/**
 * Direction of a body on the sky, written into `out`.
 *
 * The convention matches `world.ts`'s `angleToPosition`: azimuth 0 is +Z, and
 * elevation lifts out of the XZ plane. Over a day that traces a real arc —
 * `getSunState` puts sunrise on +Z, noon near the zenith, and sunset on -Z.
 *
 * Writes in place because this runs every frame in two worlds; returning a new
 * Vector3 each time is exactly the steady garbage that shows up later as
 * periodic hitching.
 */
export function placeBody(state: SunState, distance: number, out: THREE.Vector3): THREE.Vector3 {
  const horizontal = Math.cos(state.elevation) * distance;
  return out.set(
    horizontal * Math.sin(state.azimuth),
    Math.sin(state.elevation) * distance,
    horizontal * Math.cos(state.azimuth)
  );
}

/**
 * How visible a body should be at a given elevation: fully gone below the
 * horizon, fully present once clear of it.
 *
 * The band straddles zero rather than starting at it so a body fades through
 * the horizon instead of popping the instant its centre crosses — and it
 * lingers slightly below, which is what makes a sunset read as a sunset.
 *
 * Held in absolute radians, not as a fraction of the arc's peak: this describes
 * the horizon, which doesn't move when the arc is flattened. At the current peak
 * the band works out to roughly an hour of real time either side of rise and
 * set.
 */
export function horizonFade(elevation: number): number {
  return THREE.MathUtils.smoothstep(elevation, -0.14, 0.05);
}

/**
 * How big the sun is drawn, and how hot its halo burns.
 *
 * Shared for the same reason the placement above is: the meadow and the loading
 * backdrop are the same sky half a second either side of the button, and they
 * each used to carry their own copy of these numbers.
 *
 * They came down together. The disc stood at 4.2 units at 120 out — a four
 * degree sun, eight times the real one — under a halo that swelled to 34, some
 * sixteen degrees across. On its own that is only a large sun. The meadow runs a
 * bloom pass over the finished frame, though, and bloom is screen-space: it has
 * no depth to respect, so a patch of sky that far above the luminance threshold
 * blooms over whatever is drawn in front of it as well. That is what was
 * flattening a region of the sky to white and taking the clouds and anything
 * near the sun's bearing with it.
 */
export const SUN_DISC_RADIUS = 2.6;
/**
 * Halo width: swollen near the horizon, tighter overhead.
 *
 * Brought in again with the dome's exposure (SKY_EXPOSURE below): against a
 * sky that no longer saturates, a 19-unit halo — nine degrees of sky, before
 * the bloom pass spreads it — read as a white patch a third of the frame wide
 * with the sun somewhere inside it. At 14 the halo is still a glare around a
 * low sun, but the disc is a disc in it and the sky around it stays sky.
 */
export const SUN_GLOW_WIDE = 14;
export const SUN_GLOW_TIGHT = 9;
export const SUN_GLOW_OPACITY = 0.36;

/**
 * The atmosphere the sky dome is built with.
 *
 * `mieCoefficient` and `mieDirectionalG` together shape the forward-scattering
 * lobe — the bright halo hugging the sun — and they are the other half of the
 * white patch: 0.01 at g = 0.85 is a tight, very hot peak sitting exactly where
 * the disc and its sprite already are. Dropping the coefficient dims the lobe
 * and dropping g spreads what is left over more sky, so the same light arrives
 * as haze rather than as a hole burned in the dome.
 *
 * The coefficient came down again, 0.004 to 0.002, with the exposure below.
 * Once the dome stopped saturating, what was left of the white was the lobe
 * itself: with the sun anywhere in front of the camera through the afternoon,
 * the model's circumsolar haze at 0.004 still ran a broad patch of the sky —
 * up to a third of what is on screen at half four — above the tone mapper's
 * shoulder, and the sun sat somewhere inside a flat pale field rather than in
 * the sky. Halving it takes that patch under the shoulder and leaves the sun a
 * disc with a small halo in a sky that stays sky. Measured, not guessed: the
 * fraction of the sky band clipping to white in front of a 17° sun went from
 * 0.4 to nil, and noon is unchanged. Turbidity does the same job less well —
 * at 1.6 the patch was still a tenth of the band — and it also flattens the
 * horizon haze that gives the day its depth, so it stays where it was.
 */
export const SKY_ATMOSPHERE = {
  turbidity: 3.4,
  rayleigh: 1.4,
  mieCoefficient: 0.002,
  mieDirectionalG: 0.72,
};

/**
 * How bright the dome is drawn, applied to the sky alone before the renderer's
 * tone mapping.
 *
 * Three's Sky shader is a Preetham model that comes out hot: its own example
 * runs the whole renderer at half exposure to hold it, and this canvas runs at
 * the default 1.0 because everything *else* in the meadow — the toon-lit
 * grass, the character, the portals — was tuned there. At 1.0 the dome
 * saturates: the horizon band goes white at every daytime hour, and with the
 * sun in front of the camera late in the afternoon the entire sky went white,
 * labels and clouds with it, and the bloom pass then spread that saturated
 * field over the top of the frame. So the dome gets an exposure of its own,
 * multiplied in just before `tonemapping_fragment` — the same trick as the
 * example's, but scoped to the sky so nothing else in the scene shifts.
 *
 * 0.42, not the example's 0.5: their sky is thicker (turbidity 10, rayleigh
 * 3) and reads darker per unit, so this thinner one wants a shade less to
 * land in the same place — blue overhead, paling toward the horizon, the
 * sun a bright spot in it rather than a hole burned through it.
 */
export const SKY_EXPOSURE = 0.42;

export interface SkyDomeOptions {
  /** The atmosphere; the site's by default. */
  atmosphere?: typeof SKY_ATMOSPHERE;
  /** The dome's own exposure; SKY_EXPOSURE by default. */
  exposure?: number;
}

/**
 * The sky dome, built once per outdoor canvas: three's Sky with an atmosphere
 * on it, an exposure of its own patched into its shader, and its built-in sun
 * taken out. Shared by the meadow, the loading backdrop and the range — every
 * outdoor sky on the site — which used to each carry their own copy of the
 * setup, and would otherwise have to carry their own copy of the patches.
 *
 * The built-in sun goes because every one of those skies draws its own: a
 * disc sized for the world and a halo sprite, faded through the horizon and
 * placed where the world wants it (`placeBody`, from the camera). The shader
 * draws a second, half-degree disc at the sun's true bearing that nothing
 * else on the site knows about. It hid inside the saturated white while the
 * dome was overexposed; the moment the sky was brought down it stood out as a
 * hard bright point beside the site's own sun — two suns. What stays is the
 * dome's scattering, the soft brightening around the sun's bearing, which is
 * exactly what the site's disc is meant to sit inside.
 */
export function createSkyDome({
  atmosphere = SKY_ATMOSPHERE,
  exposure = SKY_EXPOSURE,
}: SkyDomeOptions = {}): Sky {
  const dome = new Sky();
  dome.scale.setScalar(450000);
  const material = dome.material;
  const u = material.uniforms;
  u.turbidity.value = atmosphere.turbidity;
  u.rayleigh.value = atmosphere.rayleigh;
  u.mieCoefficient.value = atmosphere.mieCoefficient;
  u.mieDirectionalG.value = atmosphere.mieDirectionalG;

  // The lines as they stand in three r169's Sky.js. Patched as text because
  // Sky is a raw ShaderMaterial with no onBeforeCompile hooks of its own; the
  // guards keep a future three from silently dropping either patch — they
  // would throw here, in development, rather than ship a white sky or a
  // second sun.
  const outputLine = "gl_FragColor = vec4( retColor, 1.0 );";
  const sunLine = "L0 += ( vSunE * 19000.0 * Fex ) * sundisk;";
  for (const line of [outputLine, sunLine]) {
    if (!material.fragmentShader.includes(line)) {
      throw new Error(`Sky shader line not found (${line}) — three's Sky.js has changed; update createSkyDome`);
    }
  }
  u.uSkyExposure = { value: exposure };
  material.fragmentShader = material.fragmentShader
    .replace("uniform float mieDirectionalG;", "uniform float mieDirectionalG;\n\t\tuniform float uSkyExposure;")
    .replace(sunLine, "// (built-in sun disc removed — see createSkyDome in celestial.ts)")
    .replace(outputLine, "gl_FragColor = vec4( retColor * uSkyExposure, 1.0 );");
  return dome;
}

/**
 * The haze every outdoor world resolves to at distance, at both ends of the
 * day — the fog colour, and therefore (see `HorizonDome`) the colour the sky
 * meets the ground in.
 *
 * Shared rather than restated per world, because they used to be restated per
 * world and drifted: a few steps of grey between the meadow's horizon and the
 * range's was most of what made stepping between them feel like changing
 * planets.
 *
 * The night is deliberately deep. It sat at #1b2233 — a lit navy that read as
 * late dusk at three in the morning and, being brighter than the stars over
 * it, left the field looking washed. Down here the stars are the brightest
 * thing in the sky again, which is the whole point of a night sky.
 */
export const NIGHT_SKY = new THREE.Color("#0b1018");
/**
 * A distinctly blue-gray haze (rather than a near-neutral pale gray) so
 * distant elements — mountains, horizon — visibly cool off with distance.
 */
export const DAY_SKY = new THREE.Color("#b9cdd6");

/**
 * The warm haze a low sun puts along the horizon, between the day's grey and
 * the night's.
 *
 * Shared for the same reason DAY_SKY and NIGHT_SKY are. It lived in the range's
 * lighting alone, which meant the range warmed up at dusk and the meadow simply
 * went out — two worlds, one clock, and visibly different evenings.
 */
export const DUSK_SKY = new THREE.Color("#d8c6b6");

/**
 * How wide the sun's halo is drawn, given how high the sun really is.
 *
 * Swollen near the horizon and tight overhead, which is what sells a low sun as
 * low without moving anything. Keyed to the true elevation rather than to the
 * day strength it used to follow: day strength now saturates as soon as the sun
 * is properly up, so riding it would leave the halo at its tightest through a
 * midwinter noon that is nowhere near overhead.
 *
 * That coupling is also what made this worth being careful about. The halo is
 * drawn additively under a screen-space bloom pass, and a wide one held over a
 * whole short winter day is the same white patch that dropping the exposure and
 * halving the mie coefficient was meant to clear. Tied to real height it can
 * only be wide when the sun is genuinely low, which is when it should be.
 */
export function glowSpread(trueElevation: number): number {
  const degrees = (trueElevation * 180) / Math.PI;
  return THREE.MathUtils.lerp(SUN_GLOW_WIDE, SUN_GLOW_TIGHT, THREE.MathUtils.smoothstep(degrees, 0, 30));
}

/**
 * A soft radial glow sprite, generated on a canvas. Both bodies wear one: it is
 * what separates a lit disc from a flat circle pasted on the sky, and it costs a
 * single 128px texture shared across every user of this module.
 */
let cachedGlow: THREE.CanvasTexture | null = null;
export function getGlowTexture(): THREE.CanvasTexture {
  if (cachedGlow) return cachedGlow;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  cachedGlow = new THREE.CanvasTexture(canvas);
  cachedGlow.needsUpdate = true;
  return cachedGlow;
}
