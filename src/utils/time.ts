export interface SunState {
  /** Radians above (+) or below (-) the horizon. */
  elevation: number;
  /** Radians, sweeps a full circle over 24h. */
  azimuth: number;
  isDay: boolean;
}

/**
 * Highest the sun (or moon) climbs, in radians — about 41 degrees.
 *
 * Deliberately far short of the zenith, and the constraint is the camera rather
 * than astronomy. The third-person rig sits slightly above the character looking
 * slightly down; even with the look keys held it only sees up to about 56
 * degrees of elevation. The arc used to peak at 75.6, which put both bodies
 * above the top of the frame for the middle of their transit — the moon was
 * rendering correctly at midnight and was simply impossible to look at.
 *
 * Everything keyed off elevation is expressed as a fraction of this, so moving
 * it re-times the whole day coherently instead of desynchronising the skies.
 */
export const MAX_SUN_ELEVATION = Math.PI * 0.23;

/**
 * Approximate (non-astronomical) sun position driven purely by the visitor's
 * local clock: sunrise ~6am, highest ~12pm, sunset ~6pm, nadir ~12am.
 */
export function getSunState(date: Date = new Date()): SunState {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const angle = ((hours - 6) / 24) * Math.PI * 2;
  const elevation = Math.sin(angle) * MAX_SUN_ELEVATION;
  const azimuth = angle;
  return { elevation, azimuth, isDay: elevation > 0 };
}

/**
 * How high a body stands as a fraction of its own peak: 0 at the horizon, 1 at
 * the top of the arc, negative below.
 *
 * Lighting curves use this rather than raw `sin(elevation)` so that flattening
 * the arc for visibility doesn't also dim the world — the sun should look lower
 * without noon getting darker.
 */
export function elevationFraction(elevation: number): number {
  return Math.sin(elevation) / Math.sin(MAX_SUN_ELEVATION);
}

/** The moon sits opposite the sun, up whenever the sun is down. */
export function getMoonState(date: Date = new Date()): SunState {
  const sun = getSunState(date);
  return { elevation: -sun.elevation, azimuth: sun.azimuth + Math.PI, isDay: !sun.isDay };
}
