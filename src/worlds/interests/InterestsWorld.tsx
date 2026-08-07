import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { ShelfScene } from "./ShelfScene";

/**
 * The world behind the Interests portal: a stationary first-person view of a
 * bookshelf, with one object per interest standing on it.
 *
 * Unlike the office desk it borrows its shape from, nothing here is clickable.
 * The shelf is something to look at rather than a menu — hovering a piece
 * lights it and names it, and that is the whole interaction. Like every world
 * outside the meadow it is flat-shaded low-poly in soft pastels, with no toon
 * ramp, outline pass or bloom.
 */
export function InterestsWorld() {
  const exitWorld = useStore((s) => s.exitWorld);
  const activePanel = useStore((s) => s.activePanel);
  const [hovered, setHovered] = useState<string | null>(null);

  const onHover = useCallback((label: string | null) => setHovered(label), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape belongs to the panel while one is open — PanelOverlay closes it.
      // Only once nothing is open does Escape mean "leave this world".
      if (e.key === "Escape" && !activePanel) exitWorld();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel, exitWorld]);

  // Leaving with an object still hovered would otherwise strand the cursor as a
  // pointer over the next world.
  useEffect(() => () => {
    document.body.style.cursor = "default";
  }, []);

  return (
    <div className="app-root shelf-root">
      {/* 56 rather than a tighter lens so the outermost objects on the widest
          tier still clear the frame edge on a 4:3 window. */}
      <Canvas camera={{ fov: 56, near: 0.05, far: 40 }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <ShelfScene onHover={onHover} />
        </Suspense>
      </Canvas>

      {!activePanel && (
        <>
          <button className="shelf-back" onClick={exitWorld}>
            ← Back to the meadow
          </button>
          <div className="shelf-title">
            <h1>Interests</h1>
            <p>Ten things on a shelf. Point at one to see what it is.</p>
          </div>
          {/* The arrows are in the global controls key (ControlsHint); drag
              isn't a key, so it stays here. */}
          <div className="shelf-hint">
            <span>Drag to look around</span>
            <span>Hover an object to name it · Esc to leave</span>
          </div>
          <div className={`shelf-label${hovered ? " is-visible" : ""}`} aria-live="polite">
            {hovered ?? ""}
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
