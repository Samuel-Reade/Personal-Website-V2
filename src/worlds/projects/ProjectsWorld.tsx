import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { ArchipelagoScene } from "./ArchipelagoScene";

/**
 * The world behind the Projects portal: a bay of small islands the player rows
 * between in third person, one island per project. Like the office and the
 * library it shares nothing with the meadow's look — flat-shaded low-poly
 * geometry in soft pastels, no toon ramp, no outline pass, no bloom — but being
 * outdoors it keeps the meadow's live sun, moon and sky.
 */
export function ProjectsWorld() {
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

  // The islands set this while the pointer is over them; leaving the world with
  // a hover still active would otherwise strand the cursor as a pointer.
  useEffect(() => () => {
    document.body.style.cursor = "default";
  }, []);

  return (
    <div className="app-root sea-root">
      <Canvas
        // `far` has to clear the sky dome at 420 units; the sun and moon sit at
        // 300, inside it.
        camera={{ fov: 52, near: 0.1, far: 600, position: [0, 2.4, 6.5] }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <ArchipelagoScene onHover={onHover} />
        </Suspense>
      </Canvas>

      {!activePanel && (
        <>
          <button className="sea-back" onClick={exitWorld}>
            ← Back to the meadow
          </button>
          <div className="sea-title">
            <h1>Projects</h1>
            <p>Six islands in the bay. Row up to one and see what is on it.</p>
          </div>
          <div className="sea-hint">
            <span>Up / Down to row · Left / Right to steer</span>
            <span>Click an island to open it · Esc to leave</span>
          </div>
          <div className={`sea-label${hovered ? " is-visible" : ""}`} aria-live="polite">
            {hovered ?? ""}
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
