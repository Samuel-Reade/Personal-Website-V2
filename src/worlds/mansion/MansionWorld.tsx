import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { isMuted, setMuted, startAmbience } from "../../audio/ambience";
import { MansionScene } from "./MansionScene";

/**
 * The room the site opens in: a mansion entry hall, with the meadow of section
 * portals one portal away through the gap in the staircase.
 *
 * Mounted from the first moment, behind the loading screen — that is what the
 * progress bar is measuring — so everything the visitor shouldn't see or hear
 * until they have clicked Enter is gated on `entered` rather than on this
 * component existing.
 */
export function MansionWorld() {
  const entered = useStore((s) => s.entered);
  const activePanel = useStore((s) => s.activePanel);
  const [muted, setMutedState] = useState(isMuted);

  const toggleMute = useCallback(() => {
    setMutedState((current) => {
      setMuted(!current);
      return !current;
    });
  }, []);

  // The context behind this was created by the Enter click, which is the user
  // gesture browsers require before any of it is allowed to make a sound.
  useEffect(() => {
    if (!entered) return;
    return startAmbience();
  }, [entered]);

  // Leaving with the book still hovered would strand the cursor as a pointer
  // over the meadow.
  useEffect(() => () => {
    document.body.style.cursor = "default";
  }, []);

  return (
    <div className="app-root mansion-root">
      <Canvas
        shadows
        camera={{ fov: 52, near: 0.1, far: 160, position: [0, 2.4, 11] }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <MansionScene />
        </Suspense>
      </Canvas>

      {entered && !activePanel && (
        <>
          <div className="mansion-title">
            <h1>Entry Hall</h1>
            <p>The book on the table opens my overview. The portal at the back leads outside.</p>
          </div>
          <button
            className="mansion-mute"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute ambience" : "Mute ambience"}
            title={muted ? "Unmute ambience" : "Mute ambience"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </>
      )}

      <PanelOverlay />
    </div>
  );
}
