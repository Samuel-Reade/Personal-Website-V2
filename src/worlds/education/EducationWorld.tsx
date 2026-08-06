import { Suspense, useEffect } from "react";
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
          <LibraryScene />
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
          <div className="library-hint">
            <span>Up / Down to walk · Left / Right to turn</span>
            <span>W / S to look up and down</span>
            <span>Click a floating book to open it</span>
            <span>Turn around for the portal home · or Esc</span>
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
