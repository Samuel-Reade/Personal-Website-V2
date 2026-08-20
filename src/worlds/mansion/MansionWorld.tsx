import { lazy, Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { PanelOverlay } from "../../ui/PanelOverlay";
import { MansionScene } from "./MansionScene";

// Lazy like the worlds in App.tsx, and mounted only while open: the eyepiece
// carries a second Canvas, the ocean and a starfield, none of which belongs in
// the entry bundle the loading screen is measuring.
const EyepieceView = lazy(() =>
  import("./EyepieceView").then((m) => ({ default: m.EyepieceView }))
);

/**
 * Reade Hall, the room the site opens in: a mansion entry hall, with the meadow
 * of section portals one portal away through the gap in the staircase. The
 * meadow has a portal back, so this is the one world a visitor can be standing
 * in without having just arrived from the loading screen.
 *
 * Mounted from the first moment, behind the loading screen — that is what the
 * progress bar is measuring — so everything the visitor shouldn't see until
 * they have clicked Enter is gated on `entered` rather than on this component
 * existing.
 */
export function MansionWorld() {
  const entered = useStore((s) => s.entered);
  const activePanel = useStore((s) => s.activePanel);
  const telescopeOpen = useStore((s) => s.telescopeOpen);
  const telescopeNear = useStore((s) => s.telescopeNear);
  const bookNear = useStore((s) => s.bookNear);

  // Leaving with the book still hovered would strand the cursor as a pointer
  // over the meadow.
  useEffect(() => () => {
    document.body.style.cursor = "default";
  }, []);

  return (
    <div className="app-root mansion-root">
      <Canvas
        shadows
        // `far` clears the outermost thing drawn, which is the sky shell the
        // Connect balcony's overlook closes over at 700 units — the real
        // associations range runs 600 out from that rail (see `Overlook.tsx`),
        // where the view it replaced stopped at 150.
        //
        // Raising it costs almost nothing. Depth precision is governed by the
        // *near* plane, not the far one, and near stays at 0.1: the room's own
        // geometry resolves to well under a millimetre either side of this
        // change. What a short far plane did cost was the view — at 160 the
        // mountainside was sawn off a third of the way down and the doorway
        // framed the sky behind it.
        camera={{ fov: 52, near: 0.1, far: 900, position: [0, 2.4, 11] }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <MansionScene />
        </Suspense>
      </Canvas>

      {entered && !activePanel && !telescopeOpen && (
        <>
          <div className="mansion-title">
            <h1>Reade Hall</h1>
            <p>
              Approach the table to learn more about me. Proceed to the portal to explore
              what I&apos;ve done. Walk upstairs to get in touch.
            </p>
          </div>
          {/* The interact prompt, the same one the library raises at its
              books: it appears when the walker is beside the telescope or at
              the table, which is also the moment Space stops meaning jump. The
              text is left in place while it fades out so it doesn't blank
              mid-fade. */}
          <div
            className={`mansion-prompt${telescopeNear || bookNear ? " is-visible" : ""}`}
            aria-live="polite"
          >
            <kbd>Space</kbd>
            <span>{telescopeNear ? "Look through the telescope" : bookNear ? "Open the book" : ""}</span>
          </div>
        </>
      )}

      <PanelOverlay />

      {telescopeOpen && (
        <Suspense fallback={null}>
          <EyepieceView />
        </Suspense>
      )}
    </div>
  );
}
