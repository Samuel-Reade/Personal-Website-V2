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
