import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { SpaceScene } from "./SpaceScene";
import { CHIP_COUNT, SHELLS } from "./layout";

/**
 * The world behind the Tech Stack portal: open space, with the tools orbiting a
 * planet in four shells and the player floating between them in a suit.
 *
 * Like the office, the library and the archipelago it owns its own Canvas and
 * lighting and shares nothing with the meadow — but unlike them it is lit
 * against pure black, which is why the toon ramp needed the deliberate ambient
 * lift documented in `SpaceLighting`.
 */
export function TechStackWorld() {
  const exitWorld = useStore((s) => s.exitWorld);
  const activePanel = useStore((s) => s.activePanel);
  const [hovered, setHovered] = useState<string | null>(null);
  /**
   * Which ring the legend has picked out, if any. It is a highlight and nothing
   * more — the shells are a *visual* grouping that deliberately doesn't line up
   * with the content groups the chips open (see `layout.ts`), so selecting one
   * lights the orbit rather than opening a panel.
   */
  const [selectedShell, setSelectedShell] = useState<number | null>(null);

  const onHover = useCallback((label: string | null) => setHovered(label), []);

  // Clicking the selected entry again clears it, so the key can always be put back.
  const toggleShell = useCallback(
    (index: number) => setSelectedShell((current) => (current === index ? null : index)),
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape belongs to the panel while one is open — PanelOverlay closes it.
      // Only once nothing is open does Escape mean "leave this world".
      if (e.key === "Escape" && !activePanel) exitWorld();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel, exitWorld]);

  // The chips set this while the pointer is over them; leaving the world with a
  // hover still active would otherwise strand the cursor as a pointer.
  useEffect(() => () => {
    document.body.style.cursor = "default";
  }, []);

  return (
    <div className="app-root space-root">
      <Canvas
        // `far` has to clear the far edge of the star shell at 480.
        camera={{ fov: 55, near: 0.1, far: 900, position: [0, 3, 41] }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <SpaceScene onHover={onHover} selectedShell={selectedShell} />
        </Suspense>
      </Canvas>

      {!activePanel && (
        <>
          {/* The persistent way out. The portal behind spawn is the in-world
              route home, but a player who has drifted to the far side of the
              system shouldn't have to fly back to leave. */}
          <button className="space-back" onClick={exitWorld}>
            ← Back to the meadow
          </button>
          <div className="space-title">
            <h1>Tech Stack</h1>
            <p>
              {CHIP_COUNT} tools in four orbits. Fly up to one and click it.
            </p>
          </div>
          <div className="space-legend">
            {SHELLS.map((shell, i) => (
              <button
                key={shell.label}
                type="button"
                className={`space-legend-item${selectedShell === i ? " is-selected" : ""}`}
                onClick={() => toggleShell(i)}
                aria-pressed={selectedShell === i}
              >
                <span className="space-legend-index">{i + 1}</span>
                {shell.label}
              </button>
            ))}
          </div>
          <div className="space-hint">
            <span>Up / Down to thrust · Left / Right to turn</span>
            <span>W / S to aim — thrust follows your aim, so point up to climb</span>
            <span>Turn around for the portal home · or Esc</span>
          </div>
          <div className={`space-label${hovered ? " is-visible" : ""}`} aria-live="polite">
            {hovered ?? ""}
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
