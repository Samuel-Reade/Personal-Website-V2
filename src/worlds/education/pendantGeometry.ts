import * as THREE from "three";

/**
 * The pendant lamps down the library aisle, as geometry.
 *
 * They used to be three primitives: a thin box for the flex, an open-ended
 * six-sided cone for the shade, and a sphere for the bulb. Two things were
 * wrong with that, and both of them showed while the player walked.
 *
 * The cone was open-ended and the hall's materials are front-side, so from
 * underneath a lamp you were looking at the inside of the shade and there was
 * nothing there — the shade culled away and left a bulb hanging in the air on
 * a string. Walking down the aisle popped each one off and back on in turn.
 * Everything here is a closed surface of revolution instead: there is no angle
 * that shows a lamp's inside surface without showing a lamp.
 *
 * And the flex was 0.08 across, which at the far end of a 66-unit hall is
 * under two pixels — thin enough to alias into a dotted line and crawl as the
 * camera moves. It is a rod now, and thick enough to hold together down there.
 *
 * The rest is what a hanging fixture actually has and this one didn't: a rose
 * where it meets the ceiling rather than a stick disappearing into the plaster,
 * a collar where the rod meets the shade, and a shade with a lining — a second
 * surface just inside the first, warm and emissive, so a lamp reads as lit from
 * below instead of as a dark cone with a dot under it.
 */

/**
 * Facets round each piece. The hall is flat-shaded, so these are the drawing:
 * twelve on the shade is round enough to read as turned metal at the scale it
 * hangs, and the rod and the rose are small enough to want fewer.
 */
const SHADE_SEGMENTS = 12;
const ROD_SEGMENTS = 8;

/** The shade, in its own space: neck at the top, rim at the bottom, origin between. */
export const SHADE_NECK_Y = 0.62;
export const SHADE_RIM_Y = -0.3;
const SHADE_NECK_RADIUS = 0.16;
const SHADE_RIM_RADIUS = 1.15;

/** Half-width of the rod. Set by legibility at the far end of the hall, not by taste. */
export const ROD_RADIUS = 0.07;
/** The rose at the ceiling: how far down it hangs, and how wide it sits. */
export const ROSE_HEIGHT = 0.2;
export const ROSE_RADIUS = 0.42;

/**
 * The shade's silhouette, from rim up to neck: a bell that flares fast off the
 * neck and straightens toward the rim.
 *
 * Ordered bottom-to-top because that is the order `LatheGeometry` wants if the
 * normals are to come out facing away from the axis — reversed, every shade in
 * the hall would be inside out, which is the same bug in a new coat.
 *
 * `inset` pulls the profile in toward the axis and `drop` lowers the rim, which
 * is how the lining is cut: the same curve, a little smaller, hanging a little
 * further, so it closes the rim off rather than leaving a gap to squint through
 * at a grazing angle.
 */
function shadeProfile(inset: number, drop: number): THREE.Vector2[] {
  const POINTS = 7;
  const points: THREE.Vector2[] = [];
  for (let i = POINTS - 1; i >= 0; i--) {
    const t = i / (POINTS - 1);
    const radius = SHADE_NECK_RADIUS + (SHADE_RIM_RADIUS - SHADE_NECK_RADIUS) * Math.pow(t, 0.75);
    const y = SHADE_NECK_Y + (SHADE_RIM_Y - SHADE_NECK_Y) * t;
    points.push(new THREE.Vector2(Math.max(0.03, radius - inset * t), y - drop * t));
  }
  return points;
}

let shade: THREE.LatheGeometry | null = null;
let liner: THREE.LatheGeometry | null = null;
let rose: THREE.CylinderGeometry | null = null;
let collar: THREE.CylinderGeometry | null = null;
let bulb: THREE.SphereGeometry | null = null;

/**
 * One geometry each, shared by every lamp in the hall — they are the same
 * fixture repeated, and there are three of them.
 */
export function getShadeGeometry(): THREE.LatheGeometry {
  return (shade ??= new THREE.LatheGeometry(shadeProfile(0, 0), SHADE_SEGMENTS));
}

/** The lining, cut just inside the shade and hanging just past its rim. */
export function getLinerGeometry(): THREE.LatheGeometry {
  return (liner ??= new THREE.LatheGeometry(shadeProfile(0.07, 0.03), SHADE_SEGMENTS));
}

/** The rose at the ceiling: wider where it meets the plaster than where the rod leaves it. */
export function getRoseGeometry(): THREE.CylinderGeometry {
  return (rose ??= new THREE.CylinderGeometry(ROSE_RADIUS, ROSE_RADIUS * 0.7, ROSE_HEIGHT, ROD_SEGMENTS));
}

/** The collar where the rod enters the shade's neck. */
export function getCollarGeometry(): THREE.CylinderGeometry {
  return (collar ??= new THREE.CylinderGeometry(0.13, 0.1, 0.16, ROD_SEGMENTS));
}

/** The bulb, sitting inside the shade with its base just clear of the rim. */
export function getBulbGeometry(): THREE.SphereGeometry {
  return (bulb ??= new THREE.SphereGeometry(0.26, 12, 8));
}

/** The rod, built per lamp because only the caller knows how far it has to reach. */
export function createRodGeometry(length: number): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, length, ROD_SEGMENTS);
}
