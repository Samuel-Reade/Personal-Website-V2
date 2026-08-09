import { useEffect, useRef } from "react";

export interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  lookUp: boolean;
  lookDown: boolean;
  pitchUp: boolean;
  pitchDown: boolean;
  jump: boolean;
}

const KEY_MAP: Record<string, keyof KeyState> = {
  ArrowUp: "forward",
  ArrowDown: "backward",
  ArrowLeft: "left",
  ArrowRight: "right",
  // Tilting the view is a separate axis from walking, so it gets its own keys
  // rather than a modifier on the arrows.
  w: "lookUp",
  s: "lookDown",
  // A second look axis, for the one world where W and S are spoken for: the
  // helicopter reads them as altitude, so E and D carry the view tilt there.
  // Everywhere else nothing listens to them.
  e: "pitchUp",
  d: "pitchDown",
  " ": "jump",
};

/**
 * Named keys ("ArrowUp") arrive as-is; character keys arrive as the character
 * produced, so W with caps lock or shift held reads as "W" and would miss the
 * map entirely. Folding single characters to lower case covers both.
 */
function lookup(key: string): keyof KeyState | undefined {
  return KEY_MAP[key.length === 1 ? key.toLowerCase() : key];
}

/**
 * Tracks movement and look keys in a ref (not React state) so the render loop
 * can read them every frame without triggering re-renders on every keypress.
 */
export function useKeyboardState() {
  const state = useRef<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    lookUp: false,
    lookDown: false,
    pitchUp: false,
    pitchDown: false,
    jump: false,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = lookup(e.key);
      if (key) {
        e.preventDefault();
        state.current[key] = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = lookup(e.key);
      if (key) {
        e.preventDefault();
        state.current[key] = false;
      }
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up, { passive: false });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return state;
}
