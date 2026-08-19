import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { getSunState } from "../../utils/time";
import { EyepieceOcean } from "./EyepieceOcean";
import { EyepieceSpace } from "./EyepieceSpace";

/**
 * What covers the screen while the visitor is at the telescope: a circular
 * eyepiece over darkness, with its own small scene inside.
 *
 * Which scene is the visitor's real clock's decision, the same one every world
 * makes through `getSunState` — by day the telescope is levelled at the sea and
 * the four contact objects in it; at night it tips up to the tech-stack planet
 * hanging among the stars, with four of its chips drifted near enough to click.
 * Both views reach me the same four ways. The check re-runs on a slow interval,
 * so someone who leaves the eyepiece open across dusk watches it swap on its
 * own; there is no toggle because the site has no toggle anywhere — time of day
 * is something that happens to it.
 */

/** How often to re-ask the clock whether it is day. */
const CLOCK_POLL_MS = 30_000;

const DAY_CAPTION = "Four things in the water each reach me — click one";
const NIGHT_CAPTION = "Four chips in orbit each reach me — click one";

export function EyepieceView() {
  const telescopeOpen = useStore((s) => s.telescopeOpen);
  const closeTelescope = useStore((s) => s.closeTelescope);
  const [isDay, setIsDay] = useState(() => getSunState().isDay);
  const [caption, setCaption] = useState<string | null>(null);

  useEffect(() => {
    if (!telescopeOpen) return;
    setIsDay(getSunState().isDay);
    const poll = window.setInterval(() => setIsDay(getSunState().isDay), CLOCK_POLL_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTelescope();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("keydown", onKey);
      // Closing mid-hover would otherwise strand a pointer cursor on the hall.
      document.body.style.cursor = "default";
      setCaption(null);
    };
  }, [telescopeOpen, closeTelescope]);

  if (!telescopeOpen) return null;

  return (
    <div className="eyepiece-backdrop" onClick={closeTelescope}>
      <div className="eyepiece" onClick={(e) => e.stopPropagation()}>
        {/* Keyed by the time of day: the two views want different cameras, and
            Canvas only reads its camera props on creation — remounting is the
            honest way to swap, and it happens at most once a sitting. */}
        {isDay ? (
          <Canvas
            key="day"
            camera={{ fov: 50, near: 0.1, far: 420, position: [0, 2.6, 9] }}
            onCreated={({ camera }) => camera.lookAt(0, 1, -30)}
            gl={{ antialias: true }}
          >
            {/* The sky gradient's own horizon tone, so anything past the sky
                quad's edges dissolves into it rather than into a third blue. */}
            <color attach="background" args={["#e2ecf1"]} />
            <Suspense fallback={null}>
              <EyepieceOcean onHover={setCaption} />
            </Suspense>
          </Canvas>
        ) : (
          <Canvas
            key="night"
            camera={{ fov: 55, near: 1, far: 900, position: [0, 0, 0] }}
            onCreated={({ camera }) => camera.lookAt(30, 130, -300)}
            gl={{ antialias: true }}
          >
            <color attach="background" args={["#04060d"]} />
            <Suspense fallback={null}>
              <EyepieceSpace onHover={setCaption} />
            </Suspense>
          </Canvas>
        )}
        <div className="eyepiece-rim" />
      </div>

      <p className="eyepiece-caption">{caption ?? (isDay ? DAY_CAPTION : NIGHT_CAPTION)}</p>

      <button className="eyepiece-close" onClick={closeTelescope} aria-label="Lower the telescope">
        ✕
      </button>
    </div>
  );
}
