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
  leafColor: string;
  /** 0 = bare branches, 1 = full canopy. */
  leafDensity: number;
  name: string;
}

interface Keyframe {
  color: string;
  density: number;
  name: string;
}

// One keyframe per month (Northern-hemisphere Japanese maple cycle). The
// current day-of-month is used to interpolate between a month and the next
// so the transition isn't a hard cut on the 1st.
const MONTH_KEYFRAMES: Keyframe[] = [
  { color: "#6b4636", density: 0.12, name: "Winter" }, // Jan
  { color: "#6b4636", density: 0.14, name: "Winter" }, // Feb
  { color: "#9a6b4a", density: 0.4, name: "Early Spring" }, // Mar
  { color: "#b5533c", density: 0.75, name: "Spring" }, // Apr
  { color: "#8a9a52", density: 0.95, name: "Late Spring" }, // May
  { color: "#5c7a4a", density: 1, name: "Summer" }, // Jun
  { color: "#4c6b3f", density: 1, name: "Summer" }, // Jul
  { color: "#4c6b3f", density: 1, name: "Summer" }, // Aug
  { color: "#7a7a3f", density: 0.95, name: "Early Fall" }, // Sep
  { color: "#c1752c", density: 0.85, name: "Fall" }, // Oct
  { color: "#a83e23", density: 0.5, name: "Late Fall" }, // Nov
  { color: "#6b4636", density: 0.2, name: "Winter" }, // Dec
];

export function getSeasonInfo(date: Date = new Date()): SeasonInfo {
  const month = date.getMonth();
  const dayFrac = (date.getDate() - 1) / 30;
  const a = MONTH_KEYFRAMES[month];
  const b = MONTH_KEYFRAMES[(month + 1) % 12];
  const color = new THREE.Color(a.color).lerp(new THREE.Color(b.color), dayFrac);
  const density = THREE.MathUtils.lerp(a.density, b.density, dayFrac);
  return {
    leafColor: `#${color.getHexString()}`,
    leafDensity: density,
    name: dayFrac < 0.5 ? a.name : b.name,
  };
}
