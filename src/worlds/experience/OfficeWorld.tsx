import { Suspense, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { OfficeScene } from "./OfficeScene";
import { setScreenFocus } from "./screenTexture";

/**
 * The world behind the Experience portal: a seated, first-person view of a desk
 * on an open-plan office floor. Deliberately shares nothing with the meadow's
 * look — flat-shaded low-poly geometry in soft pastels, no toon ramp, no
 * outline pass, no bloom.
 */
export function OfficeWorld() {
  const exitWorld = useStore((s) => s.exitWorld);
  const activePanel = useStore((s) => s.activePanel);

  // Hover names things on the monitor rather than in an overlay: the readout
  // is the desk's own screen, so this bypasses React state entirely — a canvas
  // redraw per hover change, no re-render of anything.
  const onHover = useCallback((org: string | null) => setScreenFocus(org), []);

  // A hover has no pointerout once the world unmounts; don't leave the last
  // record burned onto the screen for the next visit.
  useEffect(() => () => setScreenFocus(null), []);

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

      {/* The corner block every world wears. The monitor used to carry the
          title; now it is a live readout of whatever the cursor rests on, and
          the title sits where visitors have been taught to look. The way back
          is the global top bar's; the controls — drag included — live in the
          global controls key (ControlsHint). */}
      {!activePanel && (
        <div className="office-title">
          <h1>Experience</h1>
          <p>Five objects on the desk represent where I&apos;ve worked. Click on them!</p>
        </div>
      )}

      <PanelOverlay />
    </div>
  );
}
