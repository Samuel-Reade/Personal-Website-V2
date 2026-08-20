import { getVisitorLocation } from "./location";
import { solarDay, solarElevation } from "./solar";

export interface SunState {
  /**
   * Radians above (+) or below (-) the horizon, as the site draws it.
   *
   * Where the disc is hung and where the key light points from — a framing
   * number, not an astronomical one. See MAX_SUN_ELEVATION.
   */
  elevation: number;
  /** Radians, sweeps a full circle between one sunrise and the next. */
  azimuth: number;
  isDay: boolean;
  /**
   * Radians above the horizon, for real, uncapped.
   *
   * What the sky's colour is actually made of. Twilight is defined against
   * this and nothing else: the sun is six degrees down at the end of civil
   * dusk wherever you stand, and no amount of arc-flattening moves that.
   */
  trueElevation: number;
}

/**
 * Highest the sun (or moon) is drawn, in radians — about 41 degrees.
 *
 * Deliberately far short of the zenith, and the constraint is the camera rather
 * than astronomy. The third-person rig sits slightly above the character looking
 * slightly down; even with the look keys held it only sees up to about 56
 * degrees of elevation. The arc used to peak at 75.6, which put both bodies
 * above the top of the frame for the middle of their transit — the moon was
 * rendering correctly at midnight and was simply impossible to look at.
 *
 * It is now a ceiling rather than a fixed height. A real noon sun clears it
 * across most of the inhabited world in summer, and clamping there costs very
 * little: forty-one degrees and sixty-two degrees are both plainly midday, and
 * the sky is barely a different blue between them. What the ceiling must not do
 * is *raise* a low sun, which is why what follows tracks underneath it.
 */
export const MAX_SUN_ELEVATION = Math.PI * 0.23;

/**
 * Lowest the noon sun is drawn, whatever the truth — fifteen degrees.
 *
 * The one number in this file that is a preference rather than a fact, and the
 * dial to turn if the site ever feels too gloomy in a northern January. Zero
 * would be perfectly faithful: Reykjavík's midwinter sun genuinely peaks at two
 * and a half degrees, and the site would spend that whole day in a sunrise. At
 * fifteen the far north keeps a recognisable day, and everywhere the true noon
 * sun already clears fifteen — which is most people, most of the year — this
 * does nothing at all.
 *
 * It has a second job. Below about ten degrees the shadow rig starts to
 * struggle: shadows grow past the ortho box that catches them and the depth
 * bias stops holding at grazing incidence. Keeping the drawn sun above fifteen
 * keeps the renderer inside the range it was tuned for, which is why raising
 * this is cheap and lowering it is not.
 */
export const MIN_SUN_PEAK = (15 * Math.PI) / 180;

const DEGREES = 180 / Math.PI;

/**
 * Smoothstep, so this module can shape a curve without pulling in three.
 */
function smoothstep(x: number, min: number, max: number): number {
  const t = Math.min(1, Math.max(0, (x - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/**
 * One local day reduced to what the sky needs: a set of clock times with known
 * positions in the arc, and how tall the arc is.
 */
interface DayShape {
  /**
   * Clock hours since local midnight, paired with how far round the arc that
   * moment is. Strictly increasing in both, and spanning yesterday through
   * tomorrow so that three in the morning has something either side of it.
   */
  anchors: { hours: number; phase: number }[];
  /** Centre of the sun's arc. Zero on any day with a sunrise in it. */
  middle: number;
  /** Half its height, for the sun and for the moon respectively. */
  sunAmplitude: number;
  moonAmplitude: number;
}

/**
 * Worked out once a day, not once a frame.
 *
 * Six or seven components ask for the sun every frame, and the day's shape is
 * the expensive half of the answer — three passes of the solar position model
 * and an arccosine each. The instantaneous elevation underneath it is a dozen
 * trig calls and is left alone.
 */
let cached: { key: string; shape: DayShape } | null = null;

function dayShape(date: Date): DayShape {
  const where = getVisitorLocation(date);
  const key = `${date.getFullYear()}/${date.getMonth()}/${date.getDate()}@${where.latitude},${where.longitude}`;
  if (cached && cached.key === key) return cached.shape;

  const anchors: { hours: number; phase: number }[] = [];
  let middle = 0;
  let sunAmplitude = MAX_SUN_ELEVATION;
  let moonAmplitude = MAX_SUN_ELEVATION;

  // Yesterday and tomorrow as well as today, because the small hours sit
  // between one day's solar midnight and the next day's sunrise and have to be
  // interpolated across the join.
  for (const offset of [-1, 0, 1]) {
    const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12);
    const day = solarDay(noon, where.latitude, where.longitude);
    const base = 2 * Math.PI * offset;
    const shift = 24 * offset;

    if (day.sunrise !== null && day.sunset !== null) {
      // The four corners of an ordinary day. Sunrise starts the arc, the
      // transit is the top of it, sunset is halfway round, solar midnight is
      // the bottom — exactly the positions the old fixed 6/12/18/24 schedule
      // put them at, now placed on the clock where they actually fall.
      anchors.push({ hours: day.sunrise + shift, phase: base });
      anchors.push({ hours: day.solarNoon + shift, phase: base + Math.PI / 2 });
      anchors.push({ hours: day.sunset + shift, phase: base + Math.PI });
      anchors.push({ hours: day.solarNoon + 12 + shift, phase: base + (3 * Math.PI) / 2 });
    } else {
      // Inside a polar circle there are no crossings to anchor to, so the arc
      // is pinned by its top and bottom alone and runs linearly between them.
      anchors.push({ hours: day.solarNoon + shift, phase: base + Math.PI / 2 });
      anchors.push({ hours: day.solarNoon + 12 + shift, phase: base + (3 * Math.PI) / 2 });
    }

    if (offset !== 0) continue;

    if (day.sunrise !== null) {
      // An ordinary day: the arc is centred on the horizon, so it crosses at
      // the anchors, and its height is the true noon sun held between the
      // camera's ceiling and the floor above.
      middle = 0;
      sunAmplitude = clamp(day.noonElevation, MIN_SUN_PEAK, MAX_SUN_ELEVATION);
      moonAmplitude = clamp(day.antisolarNoonElevation, MIN_SUN_PEAK, MAX_SUN_ELEVATION);
    } else {
      // A polar day or night: the whole arc is on one side of the horizon and
      // must stay there, so it cannot be re-centred or floored — only scaled
      // down until its far end fits in frame. A sun that never sets must never
      // be drawn setting, and a sun that never rises must never appear.
      const top = day.noonElevation;
      const bottom = day.midnightElevation;
      const scale = Math.min(1, MAX_SUN_ELEVATION / Math.max(Math.abs(top), Math.abs(bottom)));
      middle = ((top + bottom) / 2) * scale;
      sunAmplitude = ((top - bottom) / 2) * scale;
      moonAmplitude = sunAmplitude;
    }
  }

  anchors.sort((a, b) => a.hours - b.hours);
  const shape: DayShape = { anchors, middle, sunAmplitude, moonAmplitude };
  cached = { key, shape };
  return shape;
}

/**
 * How far round the arc the given moment is: 0 at sunrise, a quarter turn at
 * the transit, half at sunset, three quarters at solar midnight.
 *
 * This is the whole of the change in one function. The site's sky was always a
 * sine of this angle; it used to be handed a clock straight — sunrise nailed to
 * six, sunset to eighteen — and now it is handed a clock warped so those
 * numbers land on the real events. Everything downstream is untouched, which is
 * the point: the arc keeps its shape, its ceiling and its bearings, and only
 * its timing becomes true.
 */
function arcPhase(date: Date, shape: DayShape): number {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const anchors = shape.anchors;

  for (let i = 0; i < anchors.length - 1; i++) {
    const from = anchors[i];
    const to = anchors[i + 1];
    if (hours >= from.hours && hours < to.hours) {
      const across = (hours - from.hours) / (to.hours - from.hours);
      return from.phase + across * (to.phase - from.phase);
    }
  }
  // Only reachable if the anchors somehow failed to span the day; falling back
  // on the old fixed schedule is wrong but never broken.
  return ((hours - 6) / 24) * Math.PI * 2;
}

/**
 * Where the sun is, and where it really is.
 *
 * `elevation` and `azimuth` are the arc the site draws — capped for the camera,
 * floored for the renderer, and running on the visitor's own sunrise and
 * sunset. `trueElevation` is the astronomy underneath, which is what the sky's
 * colour is keyed to.
 *
 * They agree exactly whenever the true noon sun falls between the floor and the
 * ceiling, which is most latitudes for most of the year. They part only where
 * the sun is too high to keep in frame — and forty degrees and seventy are the
 * same blue overhead, so nothing is lost there.
 */
export function getSunState(date: Date = new Date()): SunState {
  const shape = dayShape(date);
  const phase = arcPhase(date, shape);
  const where = getVisitorLocation(date);

  const trueElevation = solarElevation(date, where.latitude, where.longitude);
  return {
    elevation: shape.middle + Math.sin(phase) * shape.sunAmplitude,
    azimuth: phase,
    trueElevation,
    isDay: trueElevation > 0,
  };
}

/**
 * How high a body stands as a fraction of the drawn ceiling: 0 at the horizon,
 * 1 at the top of a full arc, negative below.
 *
 * Held against the ceiling rather than against the day's own peak, so a short
 * winter day reports as short rather than being renormalised back to looking
 * like a tall one.
 */
export function elevationFraction(elevation: number): number {
  return Math.sin(elevation) / Math.sin(MAX_SUN_ELEVATION);
}

/**
 * The moon sits opposite the sun, up whenever the sun is down.
 *
 * On its own arc, though, not on the sun's negated. The two are mirrored in the
 * equator rather than in the horizon: the moon rides high through the long
 * nights of winter and skims low across the short ones of summer, which is the
 * opposite of what the sun is doing and the reverse of what negating it gives.
 */
export function getMoonState(date: Date = new Date()): SunState {
  const shape = dayShape(date);
  const phase = arcPhase(date, shape);
  const elevation = -(shape.middle + Math.sin(phase) * shape.moonAmplitude);
  return {
    elevation,
    azimuth: phase + Math.PI,
    trueElevation: elevation,
    isDay: elevation > 0,
  };
}

/**
 * Day strength: 1 while the sun is properly up, 0 once the sky has finished
 * going out, and a handover across the last of the light.
 *
 * Measured in real degrees of solar altitude, which is the change that matters
 * here. It used to be a fraction of the drawn arc, which quietly assumed every
 * day reaches the same height — so a day that peaked at a fifth of the ceiling
 * was read as permanently half-dark, and an arctic noon came out at eighty-three
 * per cent night. Degrees do not have that problem: three degrees up is three
 * degrees up in Reykjavík and in Singapore, and the sky is bright at it in both.
 *
 * That the curve saturates well before noon is deliberate and is what the eye
 * actually does. A December noon in London is not a dim scene, it is a bright
 * one lit from a low angle — the season shows in where the sun is and how long
 * the shadows are, not in the exposure.
 */
export function daylight(sun: SunState): number {
  return smoothstep(sun.trueElevation * DEGREES, -6, 3);
}

/**
 * How far into night it is: 0 while the sun is up, 1 once the last of the glow
 * has gone.
 *
 * Handed over between sunset and the end of nautical twilight — the sun on the
 * horizon and the sun twelve degrees under it. That band is the blue hour, and
 * running the fog, the horizon dome and the stars across exactly it is what
 * puts the site's dusk at the same moment as the one outside.
 */
export function nightAmount(sun: SunState): number {
  return 1 - smoothstep(sun.trueElevation * DEGREES, -12, 0);
}

/**
 * The warm cast a low sun puts through the haze: full with the sun on the
 * horizon, gone by the time it is ten degrees up.
 *
 * Ten because that is roughly where golden hour stops being golden. It is the
 * one curve that stays wide open through a northern midwinter — London's noon
 * sun in December clears fifteen degrees and no more, so the whole of that day
 * is spent inside the tail of this, which is exactly how that day looks.
 */
export function duskAmount(sun: SunState): number {
  return 1 - smoothstep(sun.trueElevation * DEGREES, -4, 10);
}
