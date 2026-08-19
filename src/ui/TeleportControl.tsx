import { useCallback, useState } from "react";
import { useStore, type WorldId } from "../state/useStore";

interface Destination {
  id: WorldId;
  /** What the portal to it says, where there is one — so the menu and the ring agree. */
  label: string;
  /** What the place actually is. The labels are résumé sections; these are rooms. */
  place: string;
}

/**
 * Everywhere there is to go, in the order the visitor meets them: the hall the
 * site opens in, the meadow its portals ring, and then the six worlds behind
 * those portals, clockwise from the ring's own order in `three/world.ts`.
 *
 * Labels are taken from the portals rather than invented here, so the menu
 * calls each world what the disc in the meadow calls it — "Associations", not
 * "Extracurriculars", whatever the panel behind it is titled.
 */
const DESTINATIONS: Destination[] = [
  { id: "mansion", label: "Reade Hall", place: "the entry hall" },
  { id: "meadow", label: "The Meadow", place: "the ring of portals" },
  { id: "education", label: "Education", place: "the library" },
  { id: "experience", label: "Experience", place: "the office" },
  { id: "projects", label: "Projects", place: "the archipelago" },
  { id: "techstack", label: "Tech Stack", place: "orbit" },
  { id: "associations", label: "Associations", place: "the clearing" },
  { id: "interests", label: "Interests", place: "the shelf" },
];

/**
 * The teleport menu: the whole site's map in one button, at the left end of the
 * input row.
 *
 * The site is built to be walked — the meadow's ring of portals is the map, and
 * finding it on foot is most of the point. This is the shortcut for everyone
 * who has already done that once: from the shelf to the archipelago is
 * otherwise Escape, a walk across the meadow, and a portal.
 *
 * It sits with the speed slider and the music toggle rather than with the
 * controls key, because those three are the input row — chrome that acts on the
 * site rather than describing it — and it goes first in that row because it is
 * the largest thing you can do from there.
 *
 * Its own open/closed state, unlike the two cards in the opposite corner: they
 * share one slot and have to take turns, and this one is nowhere near them.
 */
export function TeleportControl() {
  const world = useStore((s) => s.world);
  const activePanel = useStore((s) => s.activePanel);
  const teleport = useStore((s) => s.teleport);
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((current) => !current), []);
  const close = useCallback(() => setOpen(false), []);

  const go = useCallback(
    (id: WorldId) => {
      setOpen(false);
      teleport(id);
    },
    [teleport]
  );

  // Steps aside under a panel with the rest of the input row.
  if (activePanel) return null;

  return (
    <>
      <div id="teleport-card" className={`teleport-card${open ? " is-open" : ""}`}>
        <div className="teleport-card-head">
          <span>Teleport</span>
          <button className="teleport-close" onClick={close} aria-label="Hide destinations">
            ✕
          </button>
        </div>
        <div className="teleport-list">
          {DESTINATIONS.map((destination) => {
            const here = destination.id === world;
            return (
              <button
                key={destination.id}
                className="teleport-row"
                onClick={() => go(destination.id)}
                // The world you are already in stays listed — a map with a hole
                // where you stand is harder to read than one without — but it
                // is not a destination, and says so rather than reloading the
                // room around you.
                disabled={here}
                aria-current={here ? "true" : undefined}
              >
                <span className="teleport-row-label">{destination.label}</span>
                <span className="teleport-row-place">{here ? "you are here" : destination.place}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        className="teleport-toggle"
        onClick={toggle}
        aria-controls="teleport-card"
        aria-expanded={open}
      >
        Teleport
      </button>
    </>
  );
}
