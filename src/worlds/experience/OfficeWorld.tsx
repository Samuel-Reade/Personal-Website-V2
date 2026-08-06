import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { OfficeScene } from "./OfficeScene";

/**
 * The world behind the Experience portal: a seated, first-person view of a desk
 * on an open-plan office floor. Deliberately shares nothing with the meadow's
 * look — flat-shaded low-poly geometry in soft pastels, no toon ramp, no
 * outline pass, no bloom.
 */
export function OfficeWorld() {
  const exitWorld = useStore((s) => s.exitWorld);
  const activePanel = useStore((s) => s.activePanel);
  const [hoveredOrg, setHoveredOrg] = useState<string | null>(null);

  const onHover = useCallback((org: string | null) => setHoveredOrg(org), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape belongs to the panel while one is open — PanelOverlay closes it.
      // Only once the desk is clear does Escape mean "leave this world".
      if (e.key === "Escape" && !activePanel) exitWorld();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel, exitWorld]);

  return (
    <div className="app-root office-root">
      {/* 58 rather than a tighter portrait-lens fov so the outermost two
          figurines still clear the frame edge on a 4:3 window. */}
      <Canvas camera={{ fov: 58, near: 0.05, far: 90 }} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <OfficeScene onHover={onHover} />
        </Suspense>
      </Canvas>

      {!activePanel && (
        <>
          <button className="office-back" onClick={exitWorld}>
            ← Back to the meadow
          </button>
          <div className="office-title">
            <h1>Experience</h1>
            <p>Five things on this desk. Each one is a place I worked.</p>
          </div>
          <div className="office-hint">
            <span>Arrow keys or drag to look around</span>
            <span>Click an object to open it · Esc to leave</span>
          </div>
          <div className={`office-label${hoveredOrg ? " is-visible" : ""}`} aria-live="polite">
            {hoveredOrg ?? ""}
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
