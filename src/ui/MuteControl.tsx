import { useCallback, useState } from "react";
import { useStore } from "../state/useStore";
import { isMuted, setMuted } from "../audio/music";

/**
 * The music toggle, beside the speed slider: the site's whole input chrome in
 * one row, bottom-left. Global for the same reason the slider is — the music
 * plays through every world, so the switch for it can't live in any one of
 * them — and it steps aside with the slider whenever a panel is up.
 *
 * The preference itself lives in `audio/music.ts`, which remembers it across
 * visits; this is only the button.
 */
export function MuteControl() {
  const activePanel = useStore((s) => s.activePanel);
  const [muted, setMutedState] = useState(isMuted);

  const toggle = useCallback(() => {
    setMutedState((current) => {
      setMuted(!current);
      return !current;
    });
  }, []);

  if (activePanel) return null;

  return (
    <button
      className="mute-control"
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? "Unmute music" : "Mute music"}
      title={muted ? "Unmute music" : "Mute music"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
