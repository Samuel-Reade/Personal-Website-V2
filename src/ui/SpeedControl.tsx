import { useStore } from "../state/useStore";

/**
 * Half speed to triple speed, around each controller's native tune at 1. The
 * bottom stays a usable stroll rather than a crawl; the top is quick enough
 * that crossing any world takes a few seconds, and the worlds' own bounds are
 * what keep even that from flying off the map.
 */
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const STEP = 0.1;

/**
 * The speed slider: one control over how fast the playable character moves,
 * whoever that is on this screen — the walker, the boat, the suit, the
 * helicopter, or the seated head at the desk and the shelf.
 *
 * Global chrome like the controls key, and for the same reason: it has to
 * survive a portal transit with its setting intact. It lives in the corner the
 * per-world hints vacated, and steps aside whenever a content panel is up, as
 * everything else in that layer does.
 */
export function SpeedControl() {
  const speedScale = useStore((s) => s.speedScale);
  const setSpeedScale = useStore((s) => s.setSpeedScale);
  const activePanel = useStore((s) => s.activePanel);

  if (activePanel) return null;

  return (
    <div className="speed-control">
      <label htmlFor="speed-slider">Speed</label>
      <input
        id="speed-slider"
        type="range"
        min={MIN_SCALE}
        max={MAX_SCALE}
        step={STEP}
        value={speedScale}
        onChange={(e) => setSpeedScale(parseFloat(e.target.value))}
        // The arrows drive the character; without this, focus left on the
        // slider after a drag would have them nudging the speed instead.
        onPointerUp={(e) => (e.target as HTMLInputElement).blur()}
        aria-label="Character speed"
      />
      <span className="speed-value">{speedScale.toFixed(1)}×</span>
    </div>
  );
}
