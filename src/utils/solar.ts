/**
 * Where the sun really is, for a given moment and a given place on Earth.
 *
 * This is the astronomy and nothing else — no framing, no art direction, no
 * opinion about what the sky should look like. `utils/time.ts` is what decides
 * how much of this the site actually draws; everything here is just true.
 *
 * The algorithm is NOAA's, the same one behind their solar calculator, good to
 * well under a minute for sunrise and sunset anywhere outside the polar
 * circles. It is short enough to carry rather than take a dependency for, and
 * carrying it means the site's sky has no supply chain.
 */

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Julian day from a Date. The constant is the Julian day of the Unix epoch;
 * everything after is arithmetic.
 */
function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Julian centuries since J2000.0 — the time variable every term below is in. */
function julianCentury(date: Date): number {
  return (julianDay(date) - 2451545) / 36525;
}

/**
 * The sun's declination and the equation of time, which between them are the
 * whole of what a place needs to work out its own day.
 *
 * Declination is how far north or south the sun is standing — the thing that
 * makes a June day long and a December day short. The equation of time is the
 * gap between clock noon and solar noon that comes of the Earth's orbit being
 * an ellipse travelled at a varying rate; it runs to a quarter hour either way
 * across a year, which is a quarter hour of sunset nobody would otherwise
 * account for.
 */
function sunPosition(t: number): { declination: number; equationOfTime: number } {
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const center =
    Math.sin(rad(meanAnomaly)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * meanAnomaly)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * meanAnomaly)) * 0.000289;

  // Apparent, not true: the correction is nutation and aberration, the sky
  // shifting slightly because the Earth wobbles and because light takes time.
  const apparentLongitude =
    meanLongitude + center - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * t));

  const meanObliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(rad(125.04 - 1934.136 * t));

  const declination = Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLongitude)));

  const y = Math.tan(rad(obliquity / 2)) ** 2;
  const equationOfTime =
    4 *
    deg(
      y * Math.sin(2 * rad(meanLongitude)) -
        2 * eccentricity * Math.sin(rad(meanAnomaly)) +
        4 * eccentricity * y * Math.sin(rad(meanAnomaly)) * Math.cos(2 * rad(meanLongitude)) -
        0.5 * y * y * Math.sin(4 * rad(meanLongitude)) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * rad(meanAnomaly))
    );

  return { declination, equationOfTime };
}

/**
 * How high the sun stands at this exact moment, in radians above the horizon.
 * Negative below it, and it keeps going negative — twilight is measured in how
 * far under the sun has got, so the number stays meaningful well after sunset.
 */
export function solarElevation(date: Date, latitude: number, longitude: number): number {
  const { declination, equationOfTime } = sunPosition(julianCentury(date));

  const localMinutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  // True solar time: the clock, corrected for the orbit and for how far the
  // visitor sits from the meridian their timezone is named after. That second
  // term is why this matters — San Francisco runs its clocks off a meridian
  // seventeen degrees to its east, so its solar noon is past one in the
  // afternoon and every naive sunset is an hour early.
  const zoneMinutes = -date.getTimezoneOffset();
  const trueSolarMinutes = localMinutes + equationOfTime + 4 * longitude - zoneMinutes;
  const hourAngle = rad(trueSolarMinutes / 4 - 180);

  return Math.asin(
    Math.sin(rad(latitude)) * Math.sin(declination) +
      Math.cos(rad(latitude)) * Math.cos(declination) * Math.cos(hourAngle)
  );
}

export interface SolarDay {
  /** Local hours past midnight, or null where the sun does not rise that day. */
  sunrise: number | null;
  /** Local hours past midnight, or null where the sun does not set that day. */
  sunset: number | null;
  /** Local hours past midnight. Always exists, even inside the polar circles. */
  solarNoon: number;
  /** Radians, at the meridian transit — the highest the sun gets all day. */
  noonElevation: number;
  /**
   * Radians, at the anti-transit — the lowest it gets. Negative on any ordinary
   * day, and the other half of what an arctic one needs: inside the polar
   * circles the sun's whole arc sits on one side of the horizon, so a day is
   * described by where its ceiling and its floor are rather than by when it
   * crossed.
   */
  midnightElevation: number;
  /**
   * Radians. How high the point opposite the sun transits — where a full moon
   * would stand at its highest.
   *
   * The moon is drawn as the sun's opposite, and an opposite that borrows the
   * sun's own arc gets the season backwards: it would ride low through the
   * winter nights it actually owns, and climb through the short summer ones it
   * barely appears in. Its arc is the sun's reflected in the equator, which is
   * this.
   */
  antisolarNoonElevation: number;
  /**
   * True when the sun is up for the whole twenty-four hours, false when it is
   * down for all of them. Only meaningful when `sunrise` and `sunset` are null,
   * and it is the difference between an arctic June and an arctic December.
   */
  polarDay: boolean;
}

/**
 * The shape of one local day at one place: when the sun comes up, when it goes
 * over, when it goes down, and how high it got.
 *
 * Sunrise and sunset are taken at 90.833° from the zenith rather than at 90°.
 * The extra half-degree-and-a-bit is the sun's own radius plus the atmosphere
 * bending its light around the curve of the Earth — which is why the sun you
 * watch touch the horizon has in fact already set.
 */
export function solarDay(date: Date, latitude: number, longitude: number): SolarDay {
  // Anchored at local noon rather than at the passed moment: declination drifts
  // through a day, and taking it at the middle keeps sunrise and sunset
  // symmetric about the transit instead of leaning on whichever hour happened
  // to ask.
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const { declination, equationOfTime } = sunPosition(julianCentury(noon));
  const zoneHours = -noon.getTimezoneOffset() / 60;

  const solarNoon = (720 - 4 * longitude - equationOfTime) / 60 + zoneHours;
  // Transit and anti-transit: the same expression at hour angles of 0 and 180,
  // which is to say with the last cosine at +1 and -1.
  const sinLat = Math.sin(rad(latitude));
  const cosLat = Math.cos(rad(latitude));
  const noonElevation = Math.asin(sinLat * Math.sin(declination) + cosLat * Math.cos(declination));
  const midnightElevation = Math.asin(sinLat * Math.sin(declination) - cosLat * Math.cos(declination));
  // The anti-solar point carries the opposite declination; everything else about
  // its transit is the same.
  const antisolarNoonElevation = Math.asin(
    -sinLat * Math.sin(declination) + cosLat * Math.cos(declination)
  );

  const cosHourAngle =
    Math.cos(rad(90.833)) / (Math.cos(rad(latitude)) * Math.cos(declination)) -
    Math.tan(rad(latitude)) * Math.tan(declination);

  // Outside [-1, 1] there is no moment at which the sun crosses the horizon,
  // because it never does. Above 1 it stays down all day; below -1 it stays up.
  if (cosHourAngle > 1) {
    return {
      sunrise: null, sunset: null, solarNoon,
      noonElevation, midnightElevation, antisolarNoonElevation, polarDay: false,
    };
  }
  if (cosHourAngle < -1) {
    return {
      sunrise: null, sunset: null, solarNoon,
      noonElevation, midnightElevation, antisolarNoonElevation, polarDay: true,
    };
  }

  const halfDay = deg(Math.acos(cosHourAngle)) / 15;
  return {
    sunrise: solarNoon - halfDay,
    sunset: solarNoon + halfDay,
    solarNoon,
    noonElevation,
    midnightElevation,
    antisolarNoonElevation,
    polarDay: false,
  };
}
