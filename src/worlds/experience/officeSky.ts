import * as THREE from "three";
import { getSunState, MAX_SUN_ELEVATION } from "../../utils/time";

/**
 * The office reads the same clock the meadow does, so stepping through a portal
 * never jumps you to a different time of day. It consumes only `getSunState`'s
 * elevation, though — the meadow's sky dome and sun/moon rig stay entirely over
 * there.
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
    elevation: -0.265 * MAX_SUN_ELEVATION,
    top: "#3b4358",
    horizon: "#5c6076",
    light: "#8e97b8",
    lightIntensity: 0.12,
    // Lifted from 0.34: after dark the windows contribute almost nothing, so
    // this and the ceiling fill are all that carry the room.
    ambientIntensity: 0.48,
    interiorIntensity: 1,
  },
  {
    elevation: -0.061 * MAX_SUN_ELEVATION,
    top: "#6a6f8a",
    horizon: "#a58c94",
    light: "#b9a6b0",
    lightIntensity: 0.32,
    ambientIntensity: 0.55,
    interiorIntensity: 0.82,
  },
  {
    elevation: 0.045 * MAX_SUN_ELEVATION,
    top: "#9aa2be",
    horizon: "#eec6ae",
    light: "#e8c6ac",
    lightIntensity: 0.62,
    ambientIntensity: 0.56,
    interiorIntensity: 0.5,
  },
  {
    elevation: 0.227 * MAX_SUN_ELEVATION,
    top: "#adbccd",
    horizon: "#f0dcc6",
    light: "#f2e2cc",
    lightIntensity: 0.86,
    ambientIntensity: 0.66,
    interiorIntensity: 0.24,
  },
  {
    elevation: 0.682 * MAX_SUN_ELEVATION,
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

/** Deterministic jitter for the skyline, so the city never reshuffles between repaints. */
function cityRand(n: number): number {
  const x = Math.sin(n * 93.31 + 17.7) * 15731.743;
  return x - Math.floor(x);
}

/**
 * The view out of the glass: the sky's gradient with a city standing in front
 * of it. A canvas texture rather than a shader — the glass is unlit set
 * dressing, and this keeps it to one material with no custom program.
 *
 * The city is three rows of building silhouettes, each row nearer, taller and
 * less hazed than the one behind it, all tinted from the sky's own colors so
 * the district sits *in* the atmosphere rather than pasted on it. After dark
 * the nearest row shows grids of lit windows, scaled by how strongly the
 * office's own interior lighting is carrying — the city works the same hours.
 */
export function createWindowGradient(): {
  texture: THREE.CanvasTexture;
  paint: (sky: OfficeSky) => void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const scratch = new THREE.Color();

  const paint = (sky: OfficeSky) => {
    const { width, height } = canvas;
    const horizonY = height * 0.82;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `#${sky.top.getHexString()}`);
    gradient.addColorStop(0.82, `#${sky.horizon.getHexString()}`);
    gradient.addColorStop(1, `#${sky.horizon.getHexString()}`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Rows from back to front. Haze lerps each row's ink toward the horizon
    // color, which is exactly what distance does to a real skyline.
    const rows = [
      { salt: 0, haze: 0.75, top: 0.42, spread: 0.16, minW: 34, maxW: 60 },
      { salt: 40, haze: 0.5, top: 0.3, spread: 0.2, minW: 42, maxW: 78 },
      { salt: 80, haze: 0.24, top: 0.16, spread: 0.26, minW: 52, maxW: 96 },
    ];
    const litCity = Math.max(0, sky.interiorIntensity - 0.45) / 0.55;

    for (const row of rows) {
      scratch.copy(sky.top).multiplyScalar(0.55).lerp(sky.horizon, row.haze);
      const ink = `#${scratch.getHexString()}`;
      let x = -cityRand(row.salt) * 40;
      let i = 0;
      while (x < width) {
        const bw = row.minW + cityRand(row.salt + i * 7 + 1) * (row.maxW - row.minW);
        const bh = height * (row.top + cityRand(row.salt + i * 13 + 2) * row.spread);
        const top = horizonY - bh;
        ctx.fillStyle = ink;
        ctx.fillRect(x, top, bw, bh + (height - horizonY));
        // The odd rooftop plant room or mast, so the parapet line isn't a rule.
        if (cityRand(row.salt + i * 29 + 5) > 0.62) {
          const cap = 4 + cityRand(row.salt + i * 31) * 10;
          ctx.fillRect(x + bw * 0.3, top - cap, bw * 0.34, cap);
        }
        // Lit windows on the nearest row only — the rows behind are too hazed
        // for theirs to read, and drawing them muddies the silhouette.
        if (row.salt === 80 && litCity > 0.05) {
          ctx.fillStyle = `rgba(242, 220, 172, ${0.5 * litCity})`;
          const cols = Math.max(2, Math.floor(bw / 13));
          const rowsOfLights = Math.max(3, Math.floor(bh / 15));
          for (let wy = 0; wy < rowsOfLights; wy++) {
            for (let wx = 0; wx < cols; wx++) {
              if (cityRand(row.salt + i * 97 + wy * 17 + wx * 3) > 0.55) continue;
              ctx.fillRect(x + 4 + wx * (bw - 8) / cols, top + 6 + wy * (bh - 10) / rowsOfLights, 3.4, 4.6);
            }
          }
        }
        x += bw + 2 + cityRand(row.salt + i * 17 + 3) * 8;
        i += 1;
      }
    }
    texture.needsUpdate = true;
  };

  paint(getOfficeSky());
  return { texture, paint };
}
