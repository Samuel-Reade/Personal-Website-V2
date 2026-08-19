import { useCallback, useEffect } from "react";
import { useStore, type WorldId } from "../state/useStore";

/** How long the popup holds on arriving in a world before easing away. */
const AUTO_DISMISS_MS = 7000;

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
  // controller. Space is listed as the interact key too: it opens the book on
  // the table and looks through the balcony telescope, the two things in this
  // world it reaches. No Esc row here or in the meadow: they are the home
  // worlds, and nothing listens for it. Everywhere else Esc leaves, and the
  // card says so.
  mansion: [
    { caps: ["↑", "↓"], label: "Walk" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Look" },
    { caps: ["Space"], label: "Jump / open" },
    { caps: ["Scroll"], label: "Zoom" },
  ],
  meadow: [
    { caps: ["↑", "↓"], label: "Walk" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Look" },
    { caps: ["Space"], label: "Jump" },
    { caps: ["Scroll"], label: "Zoom" },
  ],
  // Walks like the meadow, but Space opens the book he is standing at rather
  // than jumping — `Player` takes `canJump={false}` here.
  education: [
    { caps: ["↑", "↓"], label: "Walk" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Look" },
    { caps: ["Space"], label: "Open" },
    { caps: ["Scroll"], label: "Zoom" },
    { caps: ["Esc"], label: "Leave" },
  ],
  // Space reads as both here for the same reason it does in the hall: the boat
  // hops off the swell, except within reach of an island, where it opens it.
  projects: [
    { caps: ["↑", "↓"], label: "Row" },
    { caps: ["←", "→"], label: "Steer" },
    { caps: ["W", "S"], label: "Look" },
    { caps: ["Space"], label: "Jump / open" },
    { caps: ["Scroll"], label: "Zoom" },
    { caps: ["Esc"], label: "Leave" },
  ],
  techstack: [
    { caps: ["↑", "↓"], label: "Thrust" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Aim" },
    { caps: ["Scroll"], label: "Zoom" },
    { caps: ["Esc"], label: "Leave" },
  ],
  // Flies on the astronaut's scheme, key for key: W / S aim, thrust follows
  // the aim, so the labels match the space world's on purpose. E / D are the
  // one row space doesn't have — the collective, straight up and down — which
  // came back by request after the aim scheme unbound it. Space opens here as
  // it does in the library and the archipelago — the meadow is now the only
  // world left that jumps.
  associations: [
    { caps: ["↑", "↓"], label: "Fly" },
    { caps: ["←", "→"], label: "Turn" },
    { caps: ["W", "S"], label: "Aim" },
    { caps: ["E", "D"], label: "Climb" },
    { caps: ["Space"], label: "Open" },
    { caps: ["Scroll"], label: "Zoom" },
    { caps: ["Esc"], label: "Leave" },
  ],
  // Nothing walks on the desk or at the shelf: `LookControls` reads the arrows
  // to turn the head and nothing else, so Space and W/S are left off entirely.
  // Drag is not a key, but with the per-world hint chrome gone this card is
  // the only place left that can say the pointer works too.
  experience: [
    { caps: ["↑", "↓"], label: "Tilt" },
    { caps: ["←", "→"], label: "Pan" },
    { caps: ["Drag"], label: "Look around" },
    { caps: ["Esc"], label: "Leave" },
  ],
  interests: [
    { caps: ["↑", "↓"], label: "Tilt" },
    { caps: ["←", "→"], label: "Pan" },
    { caps: ["Drag"], label: "Look around" },
    { caps: ["Esc"], label: "Leave" },
  ],
};

/**
 * The controls key: a compact card in the bottom-right showing what the keys do
 * in whichever world is loaded, plus the button that summons it back.
 *
 * Global rather than per-world — it lives beside the world switch in `App.tsx`,
 * not inside any world — and it is the whole of the controls chrome: the
 * per-world corner hints are gone, so on each arrival this card shows itself
 * with the new world's keys for a few seconds and then gets out of the way.
 *
 * Note it binds no keyboard shortcut of its own. Escape is already spoken for
 * twice over: the panel closes on it, and once nothing is open every world
 * leaves on it. A third listener would close this card *and* eject the player
 * from the world in the same keystroke.
 */
export function ControlsHint() {
  const world = useStore((s) => s.world);
  const activePanel = useStore((s) => s.activePanel);
  // Open/closed lives in the store rather than here because this card shares
  // its slot with the contact card — see `CornerCard` in state/useStore.ts.
  const open = useStore((s) => s.cornerCard === "controls");
  const setCornerCard = useStore((s) => s.setCornerCard);
  const toggleCornerCard = useStore((s) => s.toggleCornerCard);

  /**
   * Pops open on every arrival — the controls differ world to world, and a card
   * that only introduced itself once would leave the player flying a helicopter
   * on the walking instructions — then dismisses itself after a few seconds.
   * Re-opening from the toggle is a deliberate act, a request to read the
   * thing, so that one holds until it is closed rather than timing out from
   * under whoever asked for it: keyed on `world`, the timer here only ever runs
   * on the showing this effect itself triggered.
   */
  useEffect(() => {
    setCornerCard("controls");
    const id = window.setTimeout(() => {
      // Only stand this card down — by now the visitor may have opened the
      // contact card in its place, and this timer isn't theirs to cancel.
      if (useStore.getState().cornerCard === "controls") setCornerCard(null);
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [world, setCornerCard]);

  const toggle = useCallback(() => toggleCornerCard("controls"), [toggleCornerCard]);
  const close = useCallback(() => setCornerCard(null), [setCornerCard]);

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
