import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/useStore";
import { useLoading, useLoadingLabel, useLoadingProgress } from "../state/useLoading";
import { initAudio } from "../audio/ambience";

/** Kept in step with the `.loading-screen` opacity transition in styles.css. */
const FADE_MS = 700;

/**
 * How long to wait before opening the door regardless.
 *
 * The steps behind the bar are real, which means they can genuinely fail to
 * finish — a machine with WebGL blocked never draws a first frame. Stranding
 * someone on a loading screen forever is worse than letting them in to whatever
 * did render, so the button unlocks either way.
 */
const PATIENCE_MS = 12000;

const TAGLINE = "A portfolio you can walk through.";

/** Movement, interaction, portals — three lines, in the order they come up. */
const PRIMER: { keys: string[]; text: string }[] = [
  { keys: ["↑", "↓", "←", "→"], text: "Walk and turn" },
  { keys: ["Click"], text: "Anything glowing opens a panel" },
  { keys: ["Portals"], text: "Walk in to travel between worlds" },
];

/**
 * The first thing anyone sees: who this is, what they are about to be dropped
 * into, and how far along the entry hall is.
 *
 * The bar is wired to real work (see `state/useLoading.ts`) rather than to a
 * timer — the hall is being built and compiled behind this screen the whole time
 * it is up. The button doubles as the user gesture browsers require before audio
 * may play, which is why the ambience starts here rather than on mount.
 */
export function LoadingScreen() {
  const enter = useStore((s) => s.enter);
  const markDone = useLoading((s) => s.markDone);
  const progress = useLoadingProgress();
  const label = useLoadingLabel();

  const [timedOut, setTimedOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  // Webfonts are the one step this screen owns: it is the thing on screen that
  // is set in them, so it is the thing that should wait for them.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) {
      markDone("fonts");
      return;
    }
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) markDone("fonts");
    });
    return () => {
      live = false;
    };
  }, [markDone]);

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), PATIENCE_MS);
    return () => window.clearTimeout(id);
  }, []);

  const ready = progress >= 1 || timedOut;

  // Moves focus to the button the moment it becomes usable, so Enter and Space
  // work without anyone having to find it with the pointer first.
  useEffect(() => {
    if (ready) button.current?.focus();
  }, [ready]);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(enter, FADE_MS);
    return () => window.clearTimeout(id);
  }, [leaving, enter]);

  const handleEnter = () => {
    if (!ready || leaving) return;
    // Has to happen inside the click itself: an AudioContext created outside a
    // gesture starts suspended and stays that way.
    initAudio();
    setLeaving(true);
  };

  const percent = Math.round(progress * 100);

  return (
    <div
      className={`loading-screen${leaving ? " is-leaving" : ""}`}
      role="dialog"
      aria-label="Welcome"
      aria-busy={!ready}
    >
      <div className="loading-inner">
        <h1 className="loading-name">Samuel Reade</h1>
        <p className="loading-tagline">{TAGLINE}</p>

        <ul className="loading-primer">
          {PRIMER.map(({ keys, text }) => (
            <li key={text}>
              <span className="loading-keys">
                {keys.map((key) => (
                  <kbd key={key} className={key.length > 2 ? "is-wide" : undefined}>
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="loading-primer-text">{text}</span>
            </li>
          ))}
        </ul>

        <div className="loading-progress">
          <div
            className="loading-bar"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Building the entry hall"
          >
            <div className="loading-bar-fill" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <p className="loading-status">
            {ready ? "Ready" : label}
            <span className="loading-percent">{percent}%</span>
          </p>
        </div>

        <button ref={button} className="loading-enter" onClick={handleEnter} disabled={!ready}>
          {ready ? "Enter the hall" : "Building…"}
        </button>
        <p className="loading-note">Sound on. You can mute it inside.</p>
      </div>
    </div>
  );
}
