import * as THREE from "three";
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
