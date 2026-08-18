import { useEffect, useState } from "react";
import { useStore, type WorldId } from "../state/useStore";

/**
 * The top-right corner, the same in every world: the visitor's clock, and —
 * anywhere there is somewhere to go back to — the way back to the meadow
 * beside it.
 *
 * Global chrome like the controls key and the speed slider, and for the same
 * reason: it has to survive a portal transit. Before this each world drew its
 * own back button and only the meadow showed the time; now one bar carries
 * both, and takes the world's ink from a `data-world` attribute so the button
 * still reads in the room's own palette (see `.top-bar` in styles.css).
 *
 * The clock is here because the whole site is keyed to it — sun, moon, and
 * what the telescope shows — and someone arriving to a moonlit meadow has no
 * other way to tell whether the site is set at night or simply is night.
 * Polled every 30s, the same cadence the loading screen uses.
 */

/** Worlds with somewhere to go back to: everything past the meadow. */
const HAS_BACK: Partial<Record<WorldId, true>> = {
  experience: true,
  education: true,
  projects: true,
  techstack: true,
  interests: true,
  associations: true,
};

export function TopBar() {
  const world = useStore((s) => s.world);
  const activePanel = useStore((s) => s.activePanel);
  const telescopeOpen = useStore((s) => s.telescopeOpen);
  const exitWorld = useStore((s) => s.exitWorld);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  // Steps aside whenever a panel or the eyepiece is up, as everything else in
  // this layer does.
  if (activePanel || telescopeOpen) return null;

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="top-bar" data-world={world}>
      <div className="top-bar-clock">{time}</div>
      {HAS_BACK[world] && (
        <button className="top-bar-back" onClick={exitWorld}>
          ← Back to the meadow
        </button>
      )}
    </div>
  );
}
