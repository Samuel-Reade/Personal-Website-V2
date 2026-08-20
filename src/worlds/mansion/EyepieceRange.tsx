import { ClearingLighting } from "../associations/ClearingLighting";
import { FAR_BALLOONS } from "../associations/DistantBalloons";
import { MIN_ALTITUDE } from "../associations/layout";
import { TELESCOPE_EYE } from "../associations/Mansion";
import { Mountains } from "../associations/Mountains";
import { Forest } from "../associations/Forest";
import { Groundcover } from "../associations/Groundcover";
import { Ocean, Streams } from "../associations/Water";
import { DistantArchipelago } from "../associations/DistantArchipelago";
import { EyepieceBalloons } from "./EyepieceBalloons";

/**
 * Where the lens stands, what it is aimed at, and how far it is stopped down.
 *
 * The aim is computed rather than written: every balloon's bearing and
 * elevation off the eye is taken, and the camera is pointed at the middle of
 * what those two spread across. Aiming at the cluster's centre of mass was the
 * obvious thing and it is subtly wrong — the four are not evenly spaced, so
 * the mean sits a degree and a half east of the middle of the spread and pushes
 * the westmost balloon out into the vignette. The middle of the extremes is
 * what actually centres four things in a round frame.
 *
 * FIELD is the magnification, and it is the one number here chosen by eye
 * rather than derived. The cluster subtends about thirteen degrees from this
 * balcony; a thirty-two degree field puts the outermost balloon a little past
 * half way to the rim, which leaves the lens reading as a lens — sky around
 * the edges, the range falling away below — rather than as four balloons
 * cropped tight. The world's own camera runs at fifty-five, so this is a
 * shade under twice life size: a spotting scope, not an observatory.
 */
const FIELD = 32;

export const EYEPIECE_CAMERA = (() => {
  const [ex, ey, ez] = TELESCOPE_EYE;

  const bearings: number[] = [];
  const elevations: number[] = [];
  for (const b of FAR_BALLOONS) {
    const dx = b.x - ex;
    const dz = b.z - ez;
    const dy = MIN_ALTITUDE + b.aboveFloor - ey;
    bearings.push(Math.atan2(dx, -dz));
    elevations.push(Math.atan2(dy, Math.hypot(dx, dz)));
  }

  const bearing = (Math.min(...bearings) + Math.max(...bearings)) / 2;
  const elevation = (Math.min(...elevations) + Math.max(...elevations)) / 2;

  // Any distance down that line lands the same aim; this one is about the
  // range of the cluster, so the number reads as the place it points at.
  const REACH = 220;
  const flat = Math.cos(elevation) * REACH;

  return {
    position: [ex, ey, ez] as [number, number, number],
    target: [
      ex + Math.sin(bearing) * flat,
      ey + Math.sin(elevation) * REACH,
      ez - Math.cos(bearing) * flat,
    ] as [number, number, number],
    fov: FIELD,
  };
})();

/**
 * What the telescope shows: the associations range, from the balcony it is
 * bolted to, with the four balloons flying beyond it.
 *
 * Not a view *like* that one — that one. Every piece here is the component the
 * associations world itself mounts, at the coordinates that world puts it at,
 * lit by that world's own sun on the same clock. The lens is simply a second
 * camera into a place the site already has, parked where the instrument stands
 * (see `EYEPIECE_CAMERA`) and stopped down to a telescope's field.
 *
 * This replaced a hand-built seascape — cliffs, surf, a lighthouse — that was
 * invented for the eyepiece and answered to nothing. It read well and it was a
 * lie: the balcony hangs off a mansion on a mountain, two hundred units of
 * forested ridge and a strait of open water short of anything it claimed to
 * show. Borrowing the real range costs a scene that can never drift out of
 * agreement with the world it is a window onto — move a mountain and the
 * telescope sees the mountain move.
 *
 * What is deliberately *not* here is the near half of that world. The
 * helicopter, the four tethered balloons on the summits, the return portal and
 * the camera rig are all things a pilot flies among; none of them is in front
 * of this lens, and the balloons in particular would be a second set of four
 * competing with the four the scope is aimed at. The mansion is left out for
 * the plainest reason of all: the camera is standing on it.
 */
export function EyepieceRange({ onHover }: { onHover: (caption: string | null) => void }) {
  return (
    <>
      {/* Sun, moon, sky dome and the fog the range fades into, all on the
          visitor's clock — the same instance the world runs, so the hour
          through the eyepiece is the hour outside it. */}
      <ClearingLighting />

      <Mountains />
      <Ocean />
      <DistantArchipelago />
      <Streams />
      <Forest />
      <Groundcover />

      <EyepieceBalloons onHover={onHover} />
    </>
  );
}
