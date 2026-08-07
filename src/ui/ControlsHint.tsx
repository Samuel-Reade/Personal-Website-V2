import { useCallback, useEffect, useState } from "react";
import { useStore, type WorldId } from "../state/useStore";

/** How long the popup holds on first load before easing away. */
const AUTO_DISMISS_MS = 5000;

interface KeyHint {
  /** The caps to draw, in order. */
  caps: string[];
  /** What they do in this world. */
  label: string;
}

/**
 * What the keys actually do, per world.
 *
 * There is no single list to print here. The arrows walk in the meadow, row in
 * the archipelago, thrust in space and only turn the head on the office desk;
 * Space and W/S aren't read at all in two of the six worlds. A fixed legend
 * would therefore be wrong in half of them, so this reads the current world
 * instead — and omits a key rather than inventing a label for one nothing is
 * listening to.
 *
 * Taken from the controllers themselves: `three/Player.tsx` (meadow, library),
 * `projects/Boat.tsx`, `techstack/Astronaut.tsx`, and
 * `experience/LookControls.tsx` (office, shelf).
 */
const CONTROLS: Record<WorldId, KeyHint[]> = {
  // The entry hall walks like the meadow and the library — it uses the same
  // controller — but there is nothing in it to jump over, so Space is left off.
  mansion: [
    { caps: ["↑", "↓"], label: "Walk" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Look" },
  ],
  meadow: [
    { caps: ["↑", "↓"], label: "Walk" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Look" },
    { caps: ["Space"], label: "Jump" },
  ],
  education: [
    { caps: ["↑", "↓"], label: "Walk" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Look" },
    { caps: ["Space"], label: "Jump" },
  ],
  projects: [
    { caps: ["↑", "↓"], label: "Row" },
    { caps: ["←", "→"], label: "Steer" },
    { caps: ["W", "S"], label: "Look" },
  ],
  techstack: [
    { caps: ["↑", "↓"], label: "Thrust" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Aim" },
  ],
  // The one world where W / S is altitude rather than the view, and the one
  // where Space opens something rather than jumping — a helicopter has to be
  // able to climb, and there is nothing on a hilltop to jump over.
  associations: [
    { caps: ["↑", "↓"], label: "Fly" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Climb" },
    { caps: ["Space"], label: "Open" },
  ],
  // Nothing walks on the desk or at the shelf: `LookControls` reads the arrows
  // to turn the head and nothing else, so Space and W/S are left off entirely.
  experience: [
    { caps: ["↑", "↓"], label: "Tilt" },
    { caps: ["←", "→"], label: "Pan" },
  ],
  interests: [
    { caps: ["↑", "↓"], label: "Tilt" },
    { caps: ["←", "→"], label: "Pan" },
  ],
};

/**
 * The controls key: a compact card in the bottom-right showing what the keys do
 * in whichever world is loaded, plus the button that summons it back.
 *
 * Global rather than per-world — it lives beside the world switch in `App.tsx`,
 * not inside any world — so it survives a portal transit with its open/closed
 * state intact, and the player doesn't get the same card thrown at them again
 * every time they arrive somewhere new.
 *
 * Note it binds no keyboard shortcut of its own. Escape is already spoken for
 * twice over: the panel closes on it, and once nothing is open every world
 * leaves on it. A third listener would close this card *and* eject the player
 * from the world in the same keystroke.
 */
export function ControlsHint() {
  const world = useStore((s) => s.world);
  const activePanel = useStore((s) => s.activePanel);
  const [open, setOpen] = useState(true);

  /**
   * The one automatic dismissal, on first load. Re-opening from the toggle is a
   * deliberate act — a request to read the thing — so it holds until it is
   * closed rather than timing out from under whoever asked for it.
   */
  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, []);

  const toggle = useCallback(() => setOpen((current) => !current), []);
  const close = useCallback(() => setOpen(false), []);

  // A content panel covers three-quarters of the screen from the right, which is
  // the corner this lives in. It steps aside entirely rather than hiding behind
  // the panel — the same thing HUD and every world's chrome already do.
  if (activePanel) return null;

  return (
    <>
      <div id="controls-card" className={`controls-card${open ? " is-open" : ""}`}>
        <div className="controls-card-head">
          <span>Controls</span>
          <button className="controls-close" onClick={close} aria-label="Hide controls">
            ✕
          </button>
        </div>
        <div className="controls-grid">
          {CONTROLS[world].map((hint) => (
            <div className="controls-item" key={hint.label}>
              <span className="controls-caps">
                {hint.caps.map((cap) => (
                  // `is-wide` because "Space" needs a bar, not the square the
                  // single-glyph caps sit in.
                  <kbd key={cap} className={`controls-cap${cap.length > 1 ? " is-wide" : ""}`}>
                    {cap}
                  </kbd>
                ))}
              </span>
              <span className="controls-item-label">{hint.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="controls-toggle"
        onClick={toggle}
        aria-controls="controls-card"
        aria-expanded={open}
        aria-label={open ? "Hide controls" : "Show controls"}
      >
        ?
      </button>
    </>
  );
}
