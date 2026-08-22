import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStore } from "../../state/useStore";
import { getSunState } from "../../utils/time";
import { EyepieceRange, EYEPIECE_CAMERA } from "./EyepieceRange";
import { EyepieceBalloonTags, type BalloonTagElements } from "./EyepieceBalloons";
import {
  EyepieceSpace,
  EyepieceSpaceContacts,
  type ReachElements,
  type ReachKey,
} from "./EyepieceSpace";
import { PhonePanel } from "../../ui/PhonePanel";

/**
 * What covers the screen while the visitor is at the telescope: a circular
 * eyepiece over darkness, with its own small scene inside.
 *
 * Which scene is the visitor's real clock's decision, the same one every world
 * makes through `getSunState` — by day the telescope is levelled at the four
 * balloons flying beyond the associations range, which is the view the balcony
 * it stands on actually has; at night it tips up to the tech-stack sky, where
 * four of that world's celestial bodies hang close enough to point at.
 * Both views reach me the same four ways. The check re-runs on a slow interval,
 * so someone who leaves the eyepiece open across dusk watches it swap on its
 * own; there is no toggle because the site has no toggle anywhere — time of day
 * is something that happens to it.
 *
 * The night view's four targets are DOM anchors laid over the canvas (see
 * EyepieceSpaceContacts); this component owns the wiring between them and the
 * scene: the ref map the frame loop steers, the hovered body, and the pointer
 * position that nudges the scope for parallax.
 *
 * The day view lays four tags over its canvas the same way, for the same
 * reason: a hovered balloon and a hovered planet should be named by the same
 * pill, not by two different objects that happen to carry the same word. Its
 * targets stay in the scene — a balloon is raycast, not projected — so what
 * the overlay owns there is the label alone.
 */

/** How often to re-ask the clock whether it is day. */
const CLOCK_POLL_MS = 30_000;

/**
 * The line under "Connect" before anything is hovered — one line, whichever
 * scene the clock has put in the lens.
 *
 * It used to be two, and they described the scenery rather than the errand:
 * by day "Four balloons over the range", by night "four ways to reach me". A
 * visitor who opened the scope twice at different hours was told it was two
 * different things, when the only difference between them is what the four
 * targets are dressed as — the same four destinations either way, which is the
 * point `reach.ts` exists to hold.
 *
 * The night wording is the one that survives, because it names the errand
 * rather than the props, and it stays true by day: the day view's balloons are
 * raycast in the scene, so pointing at one is exactly what opens it.
 */
const IDLE_CAPTION = "Four ways to reach me. Point the telescope at one.";

export function EyepieceView() {
  const telescopeOpen = useStore((s) => s.telescopeOpen);
  const closeTelescope = useStore((s) => s.closeTelescope);
  const [isDay, setIsDay] = useState(() => getSunState().isDay);
  const [caption, setCaption] = useState<string | null>(null);
  const [hoveredBody, setHoveredBody] = useState<ReachKey | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const reachEls = useRef<ReachElements>({});
  const tagEls = useRef<BalloonTagElements>({});
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!telescopeOpen) return;
    setIsDay(getSunState().isDay);
    const poll = window.setInterval(() => setIsDay(getSunState().isDay), CLOCK_POLL_MS);
    return () => {
      window.clearInterval(poll);
      // Closing mid-hover would otherwise strand a pointer cursor on the hall.
      document.body.style.cursor = "default";
      setCaption(null);
      setHoveredBody(null);
      setPhoneOpen(false);
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
  }, [telescopeOpen]);

  // Its own effect, because it re-binds as the card opens and closes — the
  // reset-everything cleanup above must not run on that change, only when
  // the scope itself is lowered.
  useEffect(() => {
    if (!telescopeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape peels back one layer at a time: card first, then the scope.
      if (phoneOpen) setPhoneOpen(false);
      else closeTelescope();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [telescopeOpen, phoneOpen, closeTelescope]);

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
            honest way to swap, and it happens at most once a sitting.

            Both canvases measure with offsetSize — layout size, not the
            bounding rect — because the eyepiece mounts mid-iris, while the
            circle is CSS-scaled to 0.55. The rect reads small, the layout
            never changes so no resize ever follows, and the scene ends up
            rendered into a little square in the ring's top-left corner. */}
        {isDay ? (
          <Canvas
            key="day"
            // Standing where the instrument stands, aimed where the cluster
            // actually is — both computed in EyepieceRange off the mansion's
            // own geometry and the balloons' own coordinates, so neither is a
            // number anybody has to keep in agreement by hand.
            //
            // `far` is the associations world's own: its sea and ground apron
            // run out to some twenty-eight thousand units, and clipping short
            // of them takes the horizon out from under the range.
            camera={{
              fov: EYEPIECE_CAMERA.fov,
              near: 0.5,
              far: 30000,
              position: EYEPIECE_CAMERA.position,
            }}
            onCreated={({ camera }) => camera.lookAt(...EYEPIECE_CAMERA.target)}
            gl={{ antialias: true }}
            resize={{ offsetSize: true }}
          >
            {/* Only ever seen for the frame or two before the sky dome is up —
                past that the range carries its own horizon. */}
            <color attach="background" args={["#cfdce6"]} />
            <Suspense fallback={null}>
              <EyepieceRange
                tagEls={tagEls}
                onHover={setCaption}
                onPhoneClick={() => setPhoneOpen(true)}
              />
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
            resize={{ offsetSize: true }}
          >
            <color attach="background" args={["#04060d"]} />
            <Suspense fallback={null}>
              <EyepieceSpace hovered={hoveredBody} reachEls={reachEls} pointer={pointer} />
            </Suspense>
          </Canvas>
        )}
        {isDay && <EyepieceBalloonTags tagEls={tagEls} />}
        {!isDay && (
          <EyepieceSpaceContacts
            reachEls={reachEls}
            onHover={(key, bodyCaption) => {
              setHoveredBody(key);
              setCaption(bodyCaption);
            }}
            onPhoneClick={() => setPhoneOpen(true)}
          />
        )}
        <div className="eyepiece-rim" />
      </div>

      {phoneOpen && (
        <PhonePanel
          onClose={() => {
            setPhoneOpen(false);
            // Hand focus back to the planet the card came from.
            reachEls.current.phone?.focus();
          }}
        />
      )}

      {/* The corner chrome: the room's name top left with the caption line
          under it, and the way out top right — the same geometry every world's
          overlay keeps, so the eyepiece reads as a place, not a dialog. */}
      <div className="eyepiece-title">
        <h1>Connect</h1>
        <p className="eyepiece-caption">{caption ?? IDLE_CAPTION}</p>
      </div>

      <button className="eyepiece-close" onClick={closeTelescope} aria-label="Lower the telescope">
        ✕
      </button>
    </div>
  );
}
