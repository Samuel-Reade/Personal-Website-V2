import * as THREE from "three";
import { getSunState, MAX_SUN_ELEVATION } from "../../utils/time";

/**
 * The archipelago reads the same clock the meadow, office and library do, so
 * rowing out of a portal never jumps you to a different time of day. Like the
 * office it consumes only `getSunState` — but being outdoors it uses the
 * elevation for a real sky gradient and sun/moon placement rather than just
 * tinting a window.
 */
export interface SeaSky {
  /** Zenith color of the sky dome. */
  top: THREE.Color;
  /** Horizon color. The fog takes this too, so the sea dissolves into the sky. */
  horizon: THREE.Color;
  /** Tint of the sun (or moon, after dark) directional light. */
  keyLight: THREE.Color;
  keyIntensity: number;
  ambientIntensity: number;
  hemiIntensity: number;
  /** Multiplied into the water color, so the sea warms at sunset instead of staying flatly blue. */
  waterTint: THREE.Color;
  isNight: boolean;
}

interface Keyframe {
  /** Sun elevation in radians this frame describes. */
  elevation: number;
  top: string;
  horizon: string;
  keyLight: string;
  keyIntensity: number;
  ambientIntensity: number;
  hemiIntensity: number;
  waterTint: string;
}

/**
 * Ordered low to high. The warm horizon lives in the frames either side of
 * elevation 0 and cools toward a pale blue-gray as the sun climbs. Night is
 * kept deliberately legible rather than accurate — the same call the meadow
 * makes with its bright moonlight, for the same reason: a visitor arriving at
 * 2am should still be able to see the islands they are meant to sail to.
 */
const KEYFRAMES: Keyframe[] = [
  {
    elevation: -0.265 * MAX_SUN_ELEVATION,
    top: "#1e2740",
    horizon: "#3a4661",
    keyLight: "#8b99c6",
    keyIntensity: 0.62,
    ambientIntensity: 0.34,
    hemiIntensity: 0.38,
    waterTint: "#6d7c9e",
  },
  {
    elevation: -0.061 * MAX_SUN_ELEVATION,
    top: "#485272",
    horizon: "#8d7a8e",
    keyLight: "#bb9aa4",
    keyIntensity: 0.55,
    ambientIntensity: 0.44,
    hemiIntensity: 0.52,
    waterTint: "#8d8499",
  },
  {
    elevation: 0.045 * MAX_SUN_ELEVATION,
    top: "#8fa2c0",
    horizon: "#eec3a4",
    keyLight: "#f0c49c",
    keyIntensity: 1.0,
    ambientIntensity: 0.52,
    hemiIntensity: 0.68,
    waterTint: "#cbb49e",
  },
  {
    elevation: 0.227 * MAX_SUN_ELEVATION,
    top: "#a3bcd4",
    horizon: "#e5dcc9",
    keyLight: "#f6e6cc",
    keyIntensity: 1.28,
    ambientIntensity: 0.58,
    hemiIntensity: 0.82,
    waterTint: "#dfe4de",
  },
  {
    elevation: 0.682 * MAX_SUN_ELEVATION,
    top: "#a9c4dc",
    horizon: "#dfe3dc",
    keyLight: "#fbf4e6",
    keyIntensity: 1.45,
    ambientIntensity: 0.62,
    hemiIntensity: 0.92,
    waterTint: "#f4f6f2",
  },
];

/** Prebuilt so sampling allocates nothing — this runs every frame. */
const PARSED = KEYFRAMES.map((k) => ({
  ...k,
  topColor: new THREE.Color(k.top),
  horizonColor: new THREE.Color(k.horizon),
  keyColor: new THREE.Color(k.keyLight),
  tintColor: new THREE.Color(k.waterTint),
}));

/**
 * Seeded with the midday frame rather than with empty Colors. An unset
 * THREE.Color is black, and the water multiplies its base tone by `waterTint` —
 * so a default-constructed sky renders the sea pure black for however many
 * frames pass before the first `sampleSeaSky`.
 */
export function createSeaSky(): SeaSky {
  const noon = PARSED[PARSED.length - 1];
  return {
    top: noon.topColor.clone(),
    horizon: noon.horizonColor.clone(),
    keyLight: noon.keyColor.clone(),
    keyIntensity: noon.keyIntensity,
    ambientIntensity: noon.ambientIntensity,
    hemiIntensity: noon.hemiIntensity,
    waterTint: noon.tintColor.clone(),
    isNight: false,
  };
}

/**
 * Writes the current sky into `out` rather than returning a fresh object: this
 * is called from the render loop, and allocating five Colors a frame is exactly
 * the kind of steady garbage that shows up later as periodic hitching.
 */
export function sampleSeaSky(out: SeaSky, date: Date = new Date()): SeaSky {
  const { elevation, isDay } = getSunState(date);

  let lo = PARSED[0];
  let hi = PARSED[PARSED.length - 1];
  for (let i = 0; i < PARSED.length - 1; i++) {
    if (elevation >= PARSED[i].elevation && elevation <= PARSED[i + 1].elevation) {
      lo = PARSED[i];
      hi = PARSED[i + 1];
      break;
    }
  }
  if (elevation <= PARSED[0].elevation) {
    lo = hi = PARSED[0];
  } else if (elevation >= PARSED[PARSED.length - 1].elevation) {
    lo = hi = PARSED[PARSED.length - 1];
  }

  const span = hi.elevation - lo.elevation;
  const t = span > 0.0001 ? THREE.MathUtils.clamp((elevation - lo.elevation) / span, 0, 1) : 0;

  out.top.copy(lo.topColor).lerp(hi.topColor, t);
  out.horizon.copy(lo.horizonColor).lerp(hi.horizonColor, t);
  out.keyLight.copy(lo.keyColor).lerp(hi.keyColor, t);
  out.waterTint.copy(lo.tintColor).lerp(hi.tintColor, t);
  out.keyIntensity = THREE.MathUtils.lerp(lo.keyIntensity, hi.keyIntensity, t);
  out.ambientIntensity = THREE.MathUtils.lerp(lo.ambientIntensity, hi.ambientIntensity, t);
  out.hemiIntensity = THREE.MathUtils.lerp(lo.hemiIntensity, hi.hemiIntensity, t);
  out.isNight = !isDay;

  return out;
}
