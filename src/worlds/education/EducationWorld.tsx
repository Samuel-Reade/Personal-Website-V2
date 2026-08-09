import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { LibraryScene } from "./LibraryScene";

/**
 * The world behind the Education portal: a university library hall the player
 * walks down in third person, with one floating book per school. Like the
 * office, it shares nothing with the meadow's look — flat-shaded low-poly
 * geometry in soft pastels, no toon ramp, no outline pass, no bloom.
 */
export function EducationWorld() {
  const exitWorld = useStore((s) => s.exitWorld);
  const activePanel = useStore((s) => s.activePanel);
  const [targeted, setTargeted] = useState<string | null>(null);

  const onTarget = useCallback((label: string | null) => setTargeted(label), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape belongs to the panel while one is open — PanelOverlay closes it.
      // Only once nothing is open does Escape mean "leave this world".
      if (e.key === "Escape" && !activePanel) exitWorld();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel, exitWorld]);

  return (
    <div className="app-root library-root">
      <Canvas
        shadows
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 2.4, 11.5] }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <LibraryScene onTarget={onTarget} />
        </Suspense>
      </Canvas>

      {!activePanel && (
        <>
          <button className="library-back" onClick={exitWorld}>
            ← Back to the meadow
          </button>
          <div className="library-title">
            <h1>Education</h1>
            <p>Walk the aisle. The books that lift are the ones you can read.</p>
          </div>
          {/* Keys live in the global controls key (ControlsHint); this carries
              only what that card doesn't cover. */}
          <div className="library-hint">
            <span>Space by a floating book to open it · or click one</span>
            <span>Turn around for the portal home · or Esc</span>
          </div>

          {/* The prompt for the interact key, which has no cursor to say where it
              is aimed. Nothing in this world names what the pointer is over, so
              unlike the sea and the range it has nothing to give way to. */}
          <div className={`library-prompt${targeted ? " is-visible" : ""}`} aria-live="polite">
            <kbd>Space</kbd>
            <span>{targeted ? `Open ${targeted}` : ""}</span>
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
