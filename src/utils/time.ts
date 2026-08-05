import * as THREE from "three";

export interface SunState {
  /** Radians above (+) or below (-) the horizon. */
  elevation: number;
  /** Radians, sweeps a full circle over 24h. */
  azimuth: number;
  isDay: boolean;
}

/**
 * Approximate (non-astronomical) sun position driven purely by the visitor's
 * local clock: sunrise ~6am, zenith ~12pm, sunset ~6pm, nadir ~12am.
 */
export function getSunState(date: Date = new Date()): SunState {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const angle = ((hours - 6) / 24) * Math.PI * 2;
  const elevation = Math.sin(angle) * (Math.PI * 0.42);
  const azimuth = angle;
  return { elevation, azimuth, isDay: elevation > 0 };
}

/** The moon sits opposite the sun, up whenever the sun is down. */
export function getMoonState(date: Date = new Date()): SunState {
  const sun = getSunState(date);
  return { elevation: -sun.elevation, azimuth: sun.azimuth + Math.PI, isDay: !sun.isDay };
}

export interface SeasonInfo {
  /** A representative single tone (first palette color) for simple uses like the HUD. */
  leafColor: string;
  /** Several colors to scatter across a canopy — real maples are never one flat color. */
  leafPalette: string[];
  /** 0 = bare branches, 1 = full canopy. */
  leafDensity: number;
  name: string;
}

interface Keyframe {
  palette: [string, string, string, string];
  density: number;
  name: string;
}

// One keyframe per month (Northern-hemisphere Japanese maple cycle). The
// current day-of-month interpolates between a month and the next so leaf
// color/density shift gradually rather than cutting hard on the 1st.
const MONTH_KEYFRAMES: Keyframe[] = [
  { palette: ["#5a4634", "#4a3828", "#5a4634", "#4a3828"], density: 0, name: "Winter" }, // Jan
  { palette: ["#5a4634", "#4a3828", "#5a4634", "#4a3828"], density: 0, name: "Winter" }, // Feb
  { palette: ["#8a6b4a", "#a85f42", "#7a8a52", "#9c6b46"], density: 0.4, name: "Early Spring" }, // Mar
  { palette: ["#b5533c", "#8a9a52", "#c46a4a", "#7d9456"], density: 0.75, name: "Spring" }, // Apr
  { palette: ["#6b8a54", "#8a9a52", "#5c7a4a", "#4c6b3f"], density: 0.95, name: "Late Spring" }, // May
  { palette: ["#4c6b3f", "#5c7a4a", "#3f5c36", "#6b8a54"], density: 1, name: "Summer" }, // Jun
  { palette: ["#4c6b3f", "#5c7a4a", "#3f5c36", "#6b8a54"], density: 1, name: "Summer" }, // Jul
  { palette: ["#4c6b3f", "#5c7a4a", "#3f5c36", "#6b8a54"], density: 1, name: "Summer" }, // Aug
  { palette: ["#7a7a3f", "#8a9a52", "#a89a4a", "#5c7a4a"], density: 0.95, name: "Early Fall" }, // Sep
  { palette: ["#c1502c", "#7a2430", "#d9822e", "#a83e23"], density: 0.85, name: "Fall" }, // Oct
  { palette: ["#8a2f2a", "#5c2028", "#a83e23", "#6b3a28"], density: 0.4, name: "Late Fall" }, // Nov
  { palette: ["#5a4634", "#4a3828", "#5a4634", "#4a3828"], density: 0, name: "Winter" }, // Dec
];

export function getSeasonInfo(date: Date = new Date()): SeasonInfo {
  const month = date.getMonth();
  const dayFrac = (date.getDate() - 1) / 30;
  const a = MONTH_KEYFRAMES[month];
  const b = MONTH_KEYFRAMES[(month + 1) % 12];
  const density = THREE.MathUtils.lerp(a.density, b.density, dayFrac);
  const leafPalette = a.palette.map(
    (c, i) => `#${new THREE.Color(c).lerp(new THREE.Color(b.palette[i]), dayFrac).getHexString()}`
  );
  return {
    leafColor: leafPalette[0],
    leafPalette,
    leafDensity: density,
    name: dayFrac < 0.5 ? a.name : b.name,
  };
}
