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

  // The islands set this while the pointer is over them; leaving the world with
  // a hover still active would otherwise strand the cursor as a pointer.
  useEffect(() => () => {
    document.body.style.cursor = "default";
  }, []);

  return (
    <div className="app-root sea-root">
      <Canvas
        // `far` has to clear the outermost thing drawn, which is SeaLighting's
        // horizon dome at 1150. That radius is itself set by the chain below
        // it — the star shell at 900 outside the distant clearing's far shore
        // at ~563, and the sun and moon at 700 between them — so this number
        // moves whenever that island does.
        camera={{ fov: 52, near: 0.1, far: 1300, position: [0, 2.4, 6.5] }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <ArchipelagoScene onHover={onHover} onTarget={onTarget} />
        </Suspense>
      </Canvas>

      {!activePanel && (
        <>
          <div className="sea-title">
            <h1>Projects</h1>
            <p>Six islands for six projects. Row up to them to investigate.</p>
          </div>
          {/* The keys live in the global controls key (ControlsHint), which
              shows itself on arrival. */}
          <div className={`sea-label${hovered ? " is-visible" : ""}`} aria-live="polite">
            {hovered ?? ""}
          </div>

          {/* The prompt for the interact key, which has no cursor to say where it
              is aimed. Suppressed while the pointer is already naming something,
              so the two never stack up on top of each other. */}
          <div className={`sea-prompt${targeted && !hovered ? " is-visible" : ""}`} aria-live="polite">
            <kbd>Space</kbd>
            <span>{targeted ? `Open ${targeted}` : ""}</span>
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
