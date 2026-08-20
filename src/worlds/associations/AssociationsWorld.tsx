import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { ClearingScene } from "./ClearingScene";
import { SPAWN_ALTITUDE } from "./layout";

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
        // `far` reaches the corners of the sea and the ground apron at ~28k
        // units, so the surfaces that carry the horizon are never clipped —
        // everything past FOG_FAR is pure fog colour, and the world fades out
        // instead of ending. Costs nothing: only the apron and the sea live out
        // there. The start position only matters for the first frame before
        // CameraRig takes the camera, but it is put near the spawn so that
        // frame isn't shot from inside a mountain.
        camera={{ fov: 55, near: 0.5, far: 30000, position: [0, SPAWN_ALTITUDE + 3, 34] }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <ClearingScene onHover={onHover} onTarget={onTarget} />
        </Suspense>
      </Canvas>

      {!activePanel && (
        <>
          <div className="clearing-title">
            <h1>Associations</h1>
            <p>Four balloons over the range. Fly up to them to interact.</p>
          </div>
          {/* No key list here: the controls live in the global controls key
              (ControlsHint), which shows itself on arrival. */}

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
