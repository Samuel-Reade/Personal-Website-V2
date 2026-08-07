import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { ClearingScene } from "./ClearingScene";

/**
 * The world behind the Extracurriculars portal: a hilltop clearing with four
 * tethered balloons, flown between in a small helicopter.
 *
 * Like the office, the library, the archipelago and the space world it owns its
 * own Canvas and lighting and shares nothing of the meadow's toon setup — but
 * being outdoors it keeps the meadow's live sun, moon and sky.
 */
export function AssociationsWorld() {
  const exitWorld = useStore((s) => s.exitWorld);
  const activePanel = useStore((s) => s.activePanel);
  const [hovered, setHovered] = useState<string | null>(null);
  const [targeted, setTargeted] = useState<string | null>(null);

  const onHover = useCallback((label: string | null) => setHovered(label), []);
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

  // The balloons set this while the pointer is over them; leaving the world with
  // a hover still active would otherwise strand the cursor as a pointer.
  useEffect(
    () => () => {
      document.body.style.cursor = "default";
    },
    []
  );

  return (
    <div className="app-root clearing-root">
      <Canvas
        // `far` has to clear the sky dome and the sun and moon at 150.
        camera={{ fov: 55, near: 0.1, far: 600, position: [0, 8, 33] }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <ClearingScene onHover={onHover} onTarget={onTarget} />
        </Suspense>
      </Canvas>

      {!activePanel && (
        <>
          <button className="clearing-back" onClick={exitWorld}>
            ← Back to the meadow
          </button>
          <div className="clearing-title">
            <h1>Associations</h1>
            <p>Four balloons on the hill. Fly up to one and open it.</p>
          </div>
          <div className="clearing-hint">
            <span>Up / Down to fly · Left / Right to turn</span>
            <span>W / S to climb and descend</span>
            <span>Space by a balloon to open it · or click one</span>
            <span>Turn around for the portal home · or Esc</span>
          </div>

          {/* The name of whatever is under the pointer. */}
          <div className={`clearing-label${hovered ? " is-visible" : ""}`} aria-live="polite">
            {hovered ?? ""}
          </div>

          {/* And the prompt for the interact key, which has no cursor to say
              where it is aimed. Suppressed while the pointer is already naming
              something, so the two never stack up on top of each other. */}
          <div className={`clearing-prompt${targeted && !hovered ? " is-visible" : ""}`} aria-live="polite">
            <kbd>Space</kbd>
            <span>{targeted ? `Open ${targeted}` : ""}</span>
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
