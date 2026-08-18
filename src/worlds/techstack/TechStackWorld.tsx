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
  /**
   * The chip under the pointer, and the chip the astronaut is up close to. The
   * label at the foot of the screen shows the pointer's if there is one — it
   * is the more deliberate of the two — and otherwise the nearby chip's.
   */
  const [hovered, setHovered] = useState<string | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const label = hovered ?? near;
  /**
   * Which ring the legend has picked out, if any. It is a highlight and nothing
   * more — the shells are a *visual* grouping that deliberately doesn't line up
   * with the resume's groups (see `layout.ts`), so selecting one lights the
   * orbit rather than opening a panel. The chips are the same: fly up to one
   * (or hover it) and it lights and names itself, and that is all.
   *
   * Starts on the innermost ring (Foundations, SHELLS[0]) rather than on nothing:
   * arriving with one orbit already lit is what says the key is a control at
   * all. Left unselected, four identical faint rings give no reason to try
   * clicking their names.
   */
  const [selectedShell, setSelectedShell] = useState<number | null>(0);

  const onHover = useCallback((label: string | null) => setHovered(label), []);
  const onNear = useCallback((label: string | null) => setNear(label), []);

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

  return (
    <div className="app-root space-root">
      <Canvas
        // `far` has to clear the far edge of the star shell at 480.
        camera={{ fov: 55, near: 0.1, far: 900, position: [0, 3, 41] }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <SpaceScene onHover={onHover} onNear={onNear} selectedShell={selectedShell} />
        </Suspense>
      </Canvas>

      {!activePanel && (
        <>
          <div className="space-title">
            <h1>Tech Stack</h1>
            <p>
              {CHIP_COUNT} tools in four orbits. Fly up to one to see what it is.
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
          {/* The keys live in the global controls key (ControlsHint), which
              shows itself on arrival. */}
          <div className={`space-label${label ? " is-visible" : ""}`} aria-live="polite">
            {label ?? ""}
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
