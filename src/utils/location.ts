/**
 * Roughly where the visitor is, worked out from their browser's timezone.
 *
 * Everything about the sky follows from this: how long the day is, when the sun
 * sets, how high it stands at noon. The site has no other way to know — and it
 * deliberately doesn't ask.
 *
 * The Geolocation API would be exact and is the wrong tool. It fires a
 * permission prompt, and a portfolio that opens by demanding your location has
 * spent trust it cannot earn back on a dusk that is forty minutes better. An IP
 * lookup avoids the prompt but puts a third-party network call on the path to
 * first paint, and fails closed on anyone with a VPN.
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` costs nothing, asks
 * nobody, needs no network and is already correct for the clock the site
 * reads. It resolves to an IANA zone — "America/Los_Angeles" — which is a
 * region, not a point; the table below turns it into that region's principal
 * city. That is an error of tens of kilometres against a person, which moves
 * sunset by well under a minute.
 */

export interface VisitorLocation {
  /** Degrees north, negative south. */
  latitude: number;
  /** Degrees east, negative west. */
  longitude: number;
  /**
   * Where this came from — `"zone"` when the timezone was in the table,
   * `"offset"` when it fell back, `"override"` in development.
   */
  source: "zone" | "offset" | "override";
}

/**
 * Principal city of each IANA zone, to a tenth of a degree.
 *
 * Latitude is the one that matters. It sets the length of the day and the
 * height of the noon sun, and it is the reason this table exists at all —
 * there is no way to infer it from the clock. Longitude only decides how far
 * the visitor sits from the meridian their timezone is named for, and the
 * fallback below can approximate it without help.
 *
 * Not exhaustive, and it does not need to be: anything missing falls through to
 * the offset path, which is wrong by at most a half hour of solar time rather
 * than broken.
 */
const ZONE_COORDS: Record<string, [number, number]> = {
  // North America
  "America/New_York": [40.7, -74.0],
  "America/Detroit": [42.3, -83.0],
  "America/Toronto": [43.7, -79.4],
  "America/Montreal": [45.5, -73.6],
  "America/Halifax": [44.6, -63.6],
  "America/St_Johns": [47.6, -52.7],
  "America/Chicago": [41.9, -87.6],
  "America/Winnipeg": [49.9, -97.1],
  "America/Mexico_City": [19.4, -99.1],
  "America/Denver": [39.7, -105.0],
  "America/Edmonton": [53.5, -113.5],
  "America/Phoenix": [33.4, -112.1],
  "America/Los_Angeles": [34.1, -118.2],
  "America/Vancouver": [49.3, -123.1],
  "America/Anchorage": [61.2, -149.9],
  "Pacific/Honolulu": [21.3, -157.9],
  // Central and South America
  "America/Bogota": [4.7, -74.1],
  "America/Lima": [-12.0, -77.0],
  "America/Santiago": [-33.4, -70.7],
  "America/Buenos_Aires": [-34.6, -58.4],
  "America/Argentina/Buenos_Aires": [-34.6, -58.4],
  "America/Sao_Paulo": [-23.5, -46.6],
  "America/Panama": [9.0, -79.5],
  "America/Havana": [23.1, -82.4],
  "America/Costa_Rica": [9.9, -84.1],
  "America/Guatemala": [14.6, -90.5],
  "America/Caracas": [10.5, -66.9],
  "America/Montevideo": [-34.9, -56.2],
  "America/La_Paz": [-16.5, -68.1],
  "America/Asuncion": [-25.3, -57.6],
  // Europe
  "Europe/London": [51.5, -0.1],
  "Europe/Dublin": [53.3, -6.3],
  "Europe/Lisbon": [38.7, -9.1],
  "Europe/Madrid": [40.4, -3.7],
  "Europe/Paris": [48.9, 2.4],
  "Europe/Brussels": [50.8, 4.4],
  "Europe/Amsterdam": [52.4, 4.9],
  "Europe/Berlin": [52.5, 13.4],
  "Europe/Zurich": [47.4, 8.5],
  "Europe/Vienna": [48.2, 16.4],
  "Europe/Prague": [50.1, 14.4],
  "Europe/Rome": [41.9, 12.5],
  "Europe/Copenhagen": [55.7, 12.6],
  "Europe/Oslo": [59.9, 10.8],
  "Europe/Stockholm": [59.3, 18.1],
  "Europe/Helsinki": [60.2, 24.9],
  "Europe/Warsaw": [52.2, 21.0],
  "Europe/Budapest": [47.5, 19.0],
  "Europe/Bucharest": [44.4, 26.1],
  "Europe/Athens": [38.0, 23.7],
  "Europe/Kyiv": [50.5, 30.5],
  "Europe/Kiev": [50.5, 30.5],
  "Europe/Moscow": [55.8, 37.6],
  "Europe/Istanbul": [41.0, 29.0],
  "Atlantic/Reykjavik": [64.1, -21.9],
  // Africa and the Middle East
  "Africa/Casablanca": [33.6, -7.6],
  "Africa/Lagos": [6.5, 3.4],
  "Africa/Cairo": [30.0, 31.2],
  "Africa/Nairobi": [-1.3, 36.8],
  "Africa/Johannesburg": [-26.2, 28.0],
  "Africa/Accra": [5.6, -0.2],
  "Africa/Addis_Ababa": [9.0, 38.7],
  "Asia/Jerusalem": [31.8, 35.2],
  "Asia/Dubai": [25.2, 55.3],
  "Asia/Riyadh": [24.7, 46.7],
  "Asia/Tehran": [35.7, 51.4],
  "Asia/Baghdad": [33.3, 44.4],
  // Asia
  "Asia/Karachi": [24.9, 67.0],
  "Asia/Kolkata": [22.6, 88.4],
  "Asia/Calcutta": [22.6, 88.4],
  "Asia/Colombo": [6.9, 79.9],
  "Asia/Kathmandu": [27.7, 85.3],
  "Asia/Dhaka": [23.8, 90.4],
  "Asia/Bangkok": [13.8, 100.5],
  "Asia/Jakarta": [-6.2, 106.8],
  "Asia/Singapore": [1.4, 103.8],
  "Asia/Kuala_Lumpur": [3.1, 101.7],
  "Asia/Manila": [14.6, 121.0],
  "Asia/Ho_Chi_Minh": [10.8, 106.7],
  "Asia/Hong_Kong": [22.3, 114.2],
  "Asia/Taipei": [25.0, 121.6],
  "Asia/Shanghai": [31.2, 121.5],
  "Asia/Seoul": [37.6, 127.0],
  "Asia/Tokyo": [35.7, 139.7],
  "Asia/Almaty": [43.2, 76.9],
  "Asia/Tashkent": [41.3, 69.2],
  "Asia/Yekaterinburg": [56.8, 60.6],
  "Asia/Novosibirsk": [55.0, 82.9],
  "Asia/Vladivostok": [43.1, 131.9],
  // Oceania
  "Australia/Perth": [-31.9, 115.9],
  "Australia/Adelaide": [-34.9, 138.6],
  "Australia/Darwin": [-12.5, 130.8],
  "Australia/Brisbane": [-27.5, 153.0],
  "Australia/Sydney": [-33.9, 151.2],
  "Australia/Melbourne": [-37.8, 145.0],
  "Australia/Hobart": [-42.9, 147.3],
  "Pacific/Auckland": [-36.9, 174.8],
  "Pacific/Fiji": [-18.1, 178.4],
  "Pacific/Guam": [13.4, 144.8],
};

/**
 * Where to stand when the timezone is not in the table.
 *
 * Longitude comes out of the UTC offset, which is the meridian the zone is
 * named for: fifteen degrees per hour, so a visitor is within 7.5° of it —
 * a half hour of solar time at the very worst, and usually far less.
 *
 * Latitude has no such trick. There is nothing in a clock that says how far
 * north you are, so this picks 40° and accepts being wrong: at the equinoxes
 * latitude barely matters, and at the solstices it is the difference between a
 * long evening and a short one. The table is what keeps this path rare.
 */
const FALLBACK_LATITUDE = 40;

function offsetLocation(date: Date): VisitorLocation {
  // getTimezoneOffset counts minutes *behind* UTC, so west is positive and the
  // sign has to turn over. Four minutes of offset is one degree of longitude.
  return {
    latitude: FALLBACK_LATITUDE,
    longitude: -date.getTimezoneOffset() / 4,
    source: "offset",
  };
}

/**
 * The visitor's location, as near as the browser can say without asking them.
 *
 * Takes a date because the offset fallback depends on it — a zone's offset
 * moves with daylight saving, and reading it off "now" while computing a sky
 * for some other moment is how an hour goes missing.
 */
/**
 * Resolved once and kept.
 *
 * This is asked for inside the frame loop — every world that draws a sky reads
 * the sun, and the sun starts here — and `Intl.DateTimeFormat()` builds a
 * formatter to answer, which is far too much to do sixty times a second in
 * seven places. Nobody changes timezone mid-session, and the one case that
 * would (a laptop carried across a boundary) is a page reload away from being
 * right. `undefined` means not yet asked; `null` means asked and got nothing.
 */
let resolvedZone: [number, number] | null | undefined;
let resolvedOverride: VisitorLocation | null | undefined;

export function getVisitorLocation(date: Date = new Date()): VisitorLocation {
  if (import.meta.env.DEV) {
    if (resolvedOverride === undefined) resolvedOverride = locationOverride();
    if (resolvedOverride) return resolvedOverride;
  }

  if (resolvedZone === undefined) {
    let zone: string | undefined;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Intl is everywhere this site runs, but a resolved timezone is not
      // guaranteed by the spec and some locked-down browsers return nothing.
      zone = undefined;
    }
    resolvedZone = zone ? ZONE_COORDS[zone] ?? null : null;
  }

  // The offset fallback is left uncached on purpose: it reads the date's own
  // UTC offset, which moves with daylight saving, and a sky being drawn for
  // some other moment than now must get that moment's offset.
  if (!resolvedZone) return offsetLocation(date);
  return { latitude: resolvedZone[0], longitude: resolvedZone[1], source: "zone" };
}

/**
 * `?lat=` and `?lon=` in development, so the sky can be stood somewhere else.
 *
 * This is not a convenience. The whole point of the change is that the site
 * looks different at different latitudes, and every failure mode worth finding
 * — a winter noon that never gets bright, a polar day with no sunset in it —
 * lives at a latitude the author is not sitting at. Without this the only
 * testable sky is the one outside the window.
 *
 * `?tz=` takes an IANA name straight out of the table, which is usually easier
 * to remember than a coordinate pair.
 */
function locationOverride(): VisitorLocation | null {
  const params = new URLSearchParams(location.search);

  const named = params.get("tz");
  if (named && ZONE_COORDS[named]) {
    return { latitude: ZONE_COORDS[named][0], longitude: ZONE_COORDS[named][1], source: "override" };
  }

  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (Number.isFinite(lat) && params.has("lat")) {
    return {
      latitude: lat,
      longitude: Number.isFinite(lon) && params.has("lon") ? lon : 0,
      source: "override",
    };
  }
  return null;
}
