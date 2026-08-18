/**
 * The envelope's profile: half-width at each height, both as fractions of the
 * radius, from the crown down to the mouth.
 *
 * This is the shape that makes it a balloon rather than a sphere. A hot air
 * envelope is not round — it is widest a third of the way down, holds nearly
 * full width well below that, then draws in hard to a mouth about a third of its
 * greatest width. A sphere segment, which is what this was, gives a perfect dome
 * and a mouth as wide as the balloon, and reads as a bauble.
 *
 * Lives here rather than in `Balloon.tsx` because two things are cut to it: the
 * gores themselves, and the emblem, which is wrapped onto the surface they make
 * (see `markGeometry.ts`) and so has to know where that surface is.
 */
export const PROFILE: [number, number][] = [
  [1.0, 0.0],
  [0.94, 0.3],
  [0.82, 0.58],
  [0.66, 0.82],
  [0.44, 0.97],
  [0.2, 1.0],
  [-0.04, 0.95],
  [-0.28, 0.82],
  [-0.52, 0.64],
  [-0.74, 0.46],
  [-0.9, 0.35],
];

/**
 * The envelope's half-width at a height, both as fractions of the radius —
 * linear between the profile's rows, which is exactly what the gores draw, so
 * anything placed with this sits on the surface rather than a smoothed guess at
 * it. Clamped to the profile's ends.
 */
export function envelopeHalfWidth(y: number): number {
  if (y >= PROFILE[0][0]) return PROFILE[0][1];
  for (let i = 1; i < PROFILE.length; i++) {
    const [y0, w0] = PROFILE[i - 1];
    const [y1, w1] = PROFILE[i];
    if (y >= y1) return w1 + ((y - y1) / (y0 - y1)) * (w0 - w1);
  }
  return PROFILE[PROFILE.length - 1][1];
}
