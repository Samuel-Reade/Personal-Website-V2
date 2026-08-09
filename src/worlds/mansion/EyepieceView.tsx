import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { getMoonState, getSunState } from "../../utils/time";
import { Starfield } from "../techstack/Starfield";
import { EyepieceOcean } from "./EyepieceOcean";

/**
 * What covers the screen while the visitor is at the telescope: a circular
 * eyepiece over darkness, with its own small scene inside.
 *
 * Which scene is the visitor's real clock's decision, the same one every world
 * makes through `getSunState` — by day the telescope is levelled at the sea and
 * the four contact objects in it; at night it tips up to the stars. The check
 * re-runs on a slow interval, so someone who leaves the eyepiece open across
 * dusk watches it swap on its own; there is no toggle because the site has no
 * toggle anywhere — time of day is something that happens to it.
 */

/** How often to re-ask the clock whether it is day. */
const CLOCK_POLL_MS = 30_000;

const DAY_CAPTION = "Four things in the water each reach me — click one";
const NIGHT_CAPTION = "The night sky, holding still. Come back in daylight to reach me.";

/**
 * The night view: the tech-stack world's own starfield — the site has exactly
 * one night sky and this is it — turning at about the speed the real one does
 * as seen from a fixed scope, with the moon where the site's clock has it.
 */
function NightSky() {
  const stars = useRef<THREE.Group>(null!);
  // Sampled on mount: the moon will not move visibly in one sitting.
  const moonY = useRef(Math.max(50, Math.sin(getMoonState().elevation) * 300)).current;

  useFrame((_, delta) => {
    if (stars.current) stars.current.rotation.y += delta * 0.006;
  });

  return (
    <group>
      <group ref={stars}>
        <Starfield />
      </group>
      {/* The moon: a flat disc and a halo, both unlit, both facing the scope. */}
      <group position={[70, moonY, -260]} onUpdate={(g) => g.lookAt(0, 0, 0)}>
        <mesh>
          <circleGeometry args={[13, 20]} />
          <meshBasicMaterial color="#e6ebf2" />
        </mesh>
        <mesh position={[0, 0, -1]}>
          <circleGeometry args={[19, 20]} />
          <meshBasicMaterial color="#aabcd8" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

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
              <NightSky />
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
