import { useEffect, useRef } from "react";

export interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

const KEY_MAP: Record<string, keyof KeyState> = {
  ArrowUp: "forward",
  ArrowDown: "backward",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Tracks arrow-key state in a ref (not React state) so the render loop can
 * read it every frame without triggering re-renders on every keypress.
 */
export function useKeyboardState() {
  const state = useRef<KeyState>({ forward: false, backward: false, left: false, right: false });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.key];
      if (key) {
        e.preventDefault();
        state.current[key] = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.key];
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
