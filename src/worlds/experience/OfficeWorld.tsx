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
          {/* No overlay title — the monitor on the desk carries it instead;
              the way back is the global top bar's. */}
          {/* The controls — drag included — live in the global controls key
              (ControlsHint), which shows itself on arrival. */}
          <div className={`office-label${hoveredOrg ? " is-visible" : ""}`} aria-live="polite">
            {hoveredOrg ?? ""}
          </div>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
