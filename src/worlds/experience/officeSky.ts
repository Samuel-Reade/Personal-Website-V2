import * as THREE from "three";
import { getSunState } from "../../utils/time";

/**
 * The office reads the same clock the meadow does, so stepping through a portal
 * never jumps you to a different time of day. It consumes only `getSunState`'s
 * elevation, though — the meadow's sky dome, sun/moon rig and season system stay
 * entirely over there.
 */
export interface OfficeSky {
  /** Upper band of the window gradient. */
  top: THREE.Color;
  /** Lower band, where the haze sits. */
  horizon: THREE.Color;
  /** Tint of the light spilling in through the glass. */
  light: THREE.Color;
  lightIntensity: number;
  ambientIntensity: number;
  /** Drives how strongly the ceiling panels read — they take over after dark. */
  interiorIntensity: number;
}

interface Keyframe {
  /** Sun elevation in radians this frame describes. */
  elevation: number;
  top: string;
  horizon: string;
  light: string;
  lightIntensity: number;
  ambientIntensity: number;
  interiorIntensity: number;
}

/**
 * Ordered low to high. The warm beige-pink horizon lives in the frames around
 * elevation 0 — the hazy early-morning / late-afternoon look — and cools toward
 * a soft blue-gray as the sun climbs.
 */
const KEYFRAMES: Keyframe[] = [
  {
    elevation: -0.35,
    top: "#3b4358",
    horizon: "#5c6076",
    light: "#8e97b8",
    lightIntensity: 0.12,
    ambientIntensity: 0.34,
    interiorIntensity: 1,
  },
  {
    elevation: -0.08,
    top: "#6a6f8a",
    horizon: "#a58c94",
    light: "#b9a6b0",
    lightIntensity: 0.32,
    ambientIntensity: 0.44,
    interiorIntensity: 0.82,
  },
  {
    elevation: 0.06,
    top: "#9aa2be",
    horizon: "#eec6ae",
    light: "#e8c6ac",
    lightIntensity: 0.62,
    ambientIntensity: 0.56,
    interiorIntensity: 0.5,
  },
  {
    elevation: 0.3,
    top: "#adbccd",
    horizon: "#f0dcc6",
    light: "#f2e2cc",
    lightIntensity: 0.86,
    ambientIntensity: 0.66,
    interiorIntensity: 0.24,
  },
  {
    elevation: 0.9,
    top: "#b7c6d4",
    horizon: "#e9dfd0",
    light: "#f6efe2",
    lightIntensity: 1,
    ambientIntensity: 0.72,
    interiorIntensity: 0.16,
  },
];

const scratchTop = new THREE.Color();
const scratchHorizon = new THREE.Color();
const scratchLight = new THREE.Color();

/** Current office sky, sampled from the visitor's local clock. */
export function getOfficeSky(date: Date = new Date()): OfficeSky {
  const { elevation } = getSunState(date);

  let lo = KEYFRAMES[0];
  let hi = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (elevation >= KEYFRAMES[i].elevation && elevation <= KEYFRAMES[i + 1].elevation) {
      lo = KEYFRAMES[i];
      hi = KEYFRAMES[i + 1];
      break;
    }
  }
  if (elevation <= KEYFRAMES[0].elevation) {
    lo = hi = KEYFRAMES[0];
  } else if (elevation >= KEYFRAMES[KEYFRAMES.length - 1].elevation) {
    lo = hi = KEYFRAMES[KEYFRAMES.length - 1];
  }

  const span = hi.elevation - lo.elevation;
  const t = span > 0.0001 ? THREE.MathUtils.clamp((elevation - lo.elevation) / span, 0, 1) : 0;

  return {
    top: scratchTop.set(lo.top).lerp(new THREE.Color(hi.top), t).clone(),
    horizon: scratchHorizon.set(lo.horizon).lerp(new THREE.Color(hi.horizon), t).clone(),
    light: scratchLight.set(lo.light).lerp(new THREE.Color(hi.light), t).clone(),
    lightIntensity: THREE.MathUtils.lerp(lo.lightIntensity, hi.lightIntensity, t),
    ambientIntensity: THREE.MathUtils.lerp(lo.ambientIntensity, hi.ambientIntensity, t),
    interiorIntensity: THREE.MathUtils.lerp(lo.interiorIntensity, hi.interiorIntensity, t),
  };
}

/**
 * Vertical two-stop gradient painted onto the window glass. A canvas texture
 * rather than a shader: the glass is unlit set dressing, and this keeps it to
 * one material with no custom program to maintain.
 */
export function createWindowGradient(): {
  texture: THREE.CanvasTexture;
  paint: (sky: OfficeSky) => void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const paint = (sky: OfficeSky) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `#${sky.top.getHexString()}`);
    gradient.addColorStop(1, `#${sky.horizon.getHexString()}`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    texture.needsUpdate = true;
  };

  paint(getOfficeSky());
  return { texture, paint };
}
