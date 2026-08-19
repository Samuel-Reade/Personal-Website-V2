import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { getSunState } from "../../utils/time";
import { EyepieceOcean } from "./EyepieceOcean";
import {
  EyepieceSpace,
  EyepieceSpaceContacts,
  type ReachElements,
  type ReachKey,
} from "./EyepieceSpace";

/**
 * What covers the screen while the visitor is at the telescope: a circular
 * eyepiece over darkness, with its own small scene inside.
 *
 * Which scene is the visitor's real clock's decision, the same one every world
 * makes through `getSunState` — by day the telescope is levelled at the sea and
 * the four contact objects in it; at night it tips up to the tech-stack sky,
 * where four of that world's celestial bodies hang close enough to point at.
 * Both views reach me the same four ways. The check re-runs on a slow interval,
 * so someone who leaves the eyepiece open across dusk watches it swap on its
 * own; there is no toggle because the site has no toggle anywhere — time of day
 * is something that happens to it.
 *
 * The night view's four targets are DOM anchors laid over the canvas (see
 * EyepieceSpaceContacts); this component owns the wiring between them and the
 * scene: the ref map the frame loop steers, the hovered body, and the pointer
 * position that nudges the scope for parallax.
 */

/** How often to re-ask the clock whether it is day. */
const CLOCK_POLL_MS = 30_000;

const DAY_CAPTION = "Four things in the water each reach me — click one";
const NIGHT_CAPTION = "Four ways to reach me. Point the telescope at one.";

export function EyepieceView() {
  const telescopeOpen = useStore((s) => s.telescopeOpen);
  const closeTelescope = useStore((s) => s.closeTelescope);
  const [isDay, setIsDay] = useState(() => getSunState().isDay);
  const [caption, setCaption] = useState<string | null>(null);
  const [hoveredBody, setHoveredBody] = useState<ReachKey | null>(null);
  const reachEls = useRef<ReachElements>({});
  const pointer = useRef({ x: 0, y: 0 });

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
      setHoveredBody(null);
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
  }, [telescopeOpen, closeTelescope]);

  if (!telescopeOpen) return null;

  return (
    <div className="eyepiece-backdrop" onClick={closeTelescope}>
      <div
        className="eyepiece"
        onClick={(e) => e.stopPropagation()}
        // Feeds the night scene's parallax: each axis in [-1, 1] from the
        // centre of the lens, +y up to match world space.
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        }}
        onMouseLeave={() => {
          pointer.current.x = 0;
          pointer.current.y = 0;
        }}
      >
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
            // Looking straight down -Z from the origin: the scene lays the four
            // bodies out across that axis, and EyepieceSpace's projection of
            // them onto the anchors assumes this camera exactly.
            camera={{ fov: 55, near: 1, far: 900, position: [0, 0, 0] }}
            gl={{ antialias: true }}
          >
            <color attach="background" args={["#04060d"]} />
            <Suspense fallback={null}>
              <EyepieceSpace hovered={hoveredBody} reachEls={reachEls} pointer={pointer} />
            </Suspense>
          </Canvas>
        )}
        {!isDay && (
          <EyepieceSpaceContacts
            reachEls={reachEls}
            onHover={(key, bodyCaption) => {
              setHoveredBody(key);
              setCaption(bodyCaption);
            }}
          />
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
