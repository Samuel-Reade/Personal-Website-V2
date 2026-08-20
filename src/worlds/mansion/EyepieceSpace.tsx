import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Starfield } from "../techstack/Starfield";
import { DistantPlanetBody, MainPlanet, distantPlanetTumble } from "../techstack/Planets";
import { BlackHole } from "../techstack/BlackHole";
import { getGlowTexture } from "../techstack/glowTexture";
import { BLACK_HOLE_RADIUS, DISTANT_PLANETS, SHELLS } from "../techstack/layout";
import { REACH_TARGETS, type ReachKey, type ReachTarget } from "./reach";

/**
 * What the telescope shows by night: the tech-stack system's own sky. The blue
 * planet with its chip shells hangs small and far off at the centre of the view
 * — scenery, a callback, not a target — and four of the system's celestial
 * bodies have swung near enough to point at. Those four are the ways to reach
 * me: the black hole is GitHub, the purple ringed planet is LinkedIn, the big
 * orange one is Email, the small blue-grey one is Phone.
 *
 * They are not portraits of the tech-stack bodies; they are the same
 * components — `BlackHole` and `DistantPlanetBody` from the same specs in
 * `techstack/layout.ts` — seen from a different vantage point.
 *
 * The clickable thing over each body is a real anchor element, not a raycast:
 * `EyepieceSpaceContacts` renders four `<a>`s and the scene steers them by
 * projecting each body's position into the eyepiece every frame. That is what
 * buys tab focus, focus rings, ARIA labels and 44px touch targets for free.
 */

/**
 * Re-exported rather than moved outright: `EyepieceView` and this file's own
 * anchors have always imported the key type from here, and the identity of the
 * four now lives in `reach.ts` beside the words themselves.
 */
export type { ReachKey };

/**
 * Where each of the four bodies sits in the view.
 *
 * What each one is *called* is no longer here. Label, caption, aria and href
 * come from `reach.ts`, which the day view reads too, so hovering a
 * destination says the same thing whichever scene the clock has put in the
 * lens. What is left below is what is genuinely this scene's: an orbit, a
 * size, a drift and a halo colour.
 *
 * `at` and `extent` are in eyepiece units: 1 is the circular mask's radius, so
 * the safe area the brief asks for is |at| + extent + drift ≤ 0.85, and the
 * minimum body-to-body gap of 15% of the viewport's width is 0.3. The numbers
 * below satisfy both at every viewport size because everything scales with the
 * circle.
 */
interface Orbit {
    /** Tint of the halo the body gains under the pointer. */
    hue: string;
    /** Centre of the body's drift, in mask radii from the centre of the view. */
    at: [number, number];
    /** The body's visual radius, rings and discs included, in mask radii. */
    extent: number;
    /** Drift ellipse: size in mask radii, seconds per loop, winding and start. */
    drift: { amp: number; period: number; dir: 1 | -1; phase: number };
    /** Which side of the body the label pill sits — always toward the centre. */
    labelSide: "left" | "right";
}

const ORBITS: Record<ReachKey, Orbit> = {
  github: {
    hue: "#ffab4d",
    at: [-0.34, 0.34],
    extent: 0.28,
    drift: { amp: 0.02, period: 30, dir: 1, phase: 0.4 },
    labelSide: "right",
  },
  email: {
    hue: "#e0997c",
    at: [0.52, 0.38],
    extent: 0.16,
    drift: { amp: 0.03, period: 24, dir: -1, phase: 2.1 },
    labelSide: "left",
  },
  linkedin: {
    hue: "#bda9e4",
    at: [-0.4, -0.48],
    extent: 0.184,
    drift: { amp: 0.03, period: 36, dir: 1, phase: 4.0 },
    labelSide: "right",
  },
  phone: {
    hue: "#a3bade",
    at: [0.38, -0.3],
    extent: 0.07,
    drift: { amp: 0.035, period: 21, dir: -1, phase: 1.2 },
    labelSide: "left",
  },
};

/** Tab order: reading order across the circle — upper-left first, lower-right last. */
/**
 * The two halves joined: what a body is, and where it orbits. Everything in
 * this file goes on reading `REACH[key]` exactly as it did.
 */
export const REACH = Object.fromEntries(
  (Object.keys(ORBITS) as ReachKey[]).map((key) => [key, { ...REACH_TARGETS[key], ...ORBITS[key] }])
) as Record<ReachKey, ReachTarget & Orbit>;

export const REACH_ORDER: ReachKey[] = ["github", "email", "linkedin", "phone"];

/** The DOM anchors the scene steers, one per body, owned by the overlay chrome. */
export type ReachElements = Partial<Record<ReachKey, HTMLAnchorElement | null>>;

/** Must match the night `Canvas` fov in EyepieceView. */
const FOV = 55;
const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/** How far down the view axis the four bodies hang. */
const BODY_DEPTH = 60;
/** Mask radius in world units at the bodies' depth (the canvas is square). */
const BODY_RADIUS = BODY_DEPTH * TAN_HALF_FOV;

/** The blue planet, much deeper — scenery, behind everything but the stars. */
const EARTH_DEPTH = 320;
const EARTH_RADIUS = EARTH_DEPTH * TAN_HALF_FOV;
/** Where it drifts about, kept to the empty middle of the view. */
const EARTH_AT: [number, number] = [0.05, 0.06];
const EARTH_DRIFT = { amp: 0.03, period: 55 };
/**
 * Shrinks the whole system (planet radius 6, shells out to ~22.4) until it
 * spans ~9% of the viewport's width: present, legible as *that* planet, and
 * no rival to the four bodies in front of it.
 */
const EARTH_SCALE = (0.09 * EARTH_RADIUS) / 22.4;

/** Hover: the brief's 15% swell, at the site's usual settle rate. */
const HOVER_SCALE = 1.15;
const HOVER_RATE = 8;
const GLOW_OPACITY = 0.5;

/** Parallax from nudging the scope: foreground leads, background trails. */
const FG_PARALLAX_PX = 8;
const BG_PARALLAX_PX = 3;

/** The three planet specs reused from the tech-stack sky, by their index there. */
const PLANET_INDEX: Record<Exclude<ReachKey, "github">, number> = {
  email: 0, // the big orange/red one
  linkedin: 1, // the purple one with the ring
  phone: 4, // the small blue-grey one
};

/** A body's world scale: shrink its native size until it spans `extent` mask radii. */
function bodyScale(key: ReachKey): number {
  const extentWorld = REACH[key].extent * BODY_RADIUS;
  if (key === "github") return extentWorld / (BLACK_HOLE_RADIUS * 3.1);
  const planet = DISTANT_PLANETS[PLANET_INDEX[key]];
  return extentWorld / (planet.radius * (planet.ring ? 2.3 : 1));
}

interface SpaceProps {
  /** Which body's anchor the pointer or keyboard is on, if any. */
  hovered: ReachKey | null;
  /** The overlay's anchors, steered from the frame loop. */
  reachEls: React.MutableRefObject<ReachElements>;
  /** Pointer position over the eyepiece, each axis in [-1, 1], +y up. */
  pointer: React.MutableRefObject<{ x: number; y: number }>;
}

/**
 * The planet's four shells, miniaturised to dots. Real radii, tilts, speeds and
 * chip counts from the tech-stack layout — this is that system, not a print of
 * one — but each chip is a half-unit fleck: at this distance the swarm is meant
 * to be barely made out.
 */
function MiniatureShells({ frozen }: { frozen: boolean }) {
  const spins = useRef<(THREE.Group | null)[]>([]);
  const fleck = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#9aa2c8", toneMapped: false }),
    []
  );

  useFrame((state) => {
    if (frozen) return;
    SHELLS.forEach((shell, i) => {
      const spin = spins.current[i];
      if (spin) spin.rotation.y = shell.phase + state.clock.elapsedTime * shell.speed;
    });
  });

  return (
    <>
      {SHELLS.map((shell, i) => (
        <group key={shell.label} rotation={[0, shell.node, 0]}>
          <group rotation={[shell.inclination, 0, 0]}>
            <group ref={(g) => (spins.current[i] = g)} rotation={[0, shell.phase, 0]}>
              {shell.chips.map((_, j) => {
                const bearing = (j / shell.chips.length) * Math.PI * 2;
                return (
                  <mesh
                    key={j}
                    material={fleck}
                    position={[
                      Math.cos(bearing) * shell.radius,
                      0,
                      Math.sin(bearing) * shell.radius,
                    ]}
                  >
                    <boxGeometry args={[0.7, 0.5, 0.24]} />
                  </mesh>
                );
              })}
            </group>
          </group>
        </group>
      ))}
    </>
  );
}

export function EyepieceSpace({ hovered, reachEls, pointer }: SpaceProps) {
  const fg = useRef<THREE.Group>(null!);
  const bg = useRef<THREE.Group>(null!);
  const stars = useRef<THREE.Group>(null!);
  const earth = useRef<THREE.Group>(null!);
  const bodies = useRef<Partial<Record<ReachKey, THREE.Group | null>>>({});
  const projected = useMemo(() => new THREE.Vector3(), []);

  /**
   * Honoured the way the brief asks: drift, parallax and the star pan freeze;
   * hover and focus still swell and glow, so the states remain legible.
   */
  const reduceMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  /** One halo per body, in that body's own hue, lifted while its anchor is hot. */
  const glows = useMemo(() => {
    const materials = {} as Record<ReachKey, THREE.SpriteMaterial>;
    for (const key of REACH_ORDER) {
      materials[key] = new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: REACH[key].hue,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
    }
    return materials;
  }, []);
  useEffect(() => () => Object.values(glows).forEach((m) => m.dispose()), [glows]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const settle = 1 - Math.exp(-HOVER_RATE * delta);
    const { size, camera } = state;

    // Nudging the scope: content follows the pointer, the far layer by less.
    // Amplitudes are set in on-screen pixels and converted at each layer's own
    // depth, so the 8px cap holds at every viewport size.
    if (!reduceMotion) {
      const fgShift = (FG_PARALLAX_PX * 2 * BODY_RADIUS) / size.height;
      const bgShift = (BG_PARALLAX_PX * 2 * EARTH_RADIUS) / size.height;
      fg.current.position.set(pointer.current.x * fgShift, pointer.current.y * fgShift, 0);
      bg.current.position.set(pointer.current.x * bgShift, pointer.current.y * bgShift, 0);
      stars.current.rotation.y += delta * 0.006;
    }

    // The blue planet's slow wander about the middle distance.
    const et = reduceMotion ? 0 : (t / EARTH_DRIFT.period) * Math.PI * 2;
    earth.current.position.set(
      (EARTH_AT[0] + Math.cos(et) * EARTH_DRIFT.amp) * EARTH_RADIUS,
      (EARTH_AT[1] + Math.sin(et) * EARTH_DRIFT.amp * 0.7) * EARTH_RADIUS,
      -EARTH_DEPTH
    );

    for (const key of REACH_ORDER) {
      const spec = REACH[key];
      const group = bodies.current[key];
      if (!group) continue;

      // A slow ellipse around the anchor point, each body on its own period
      // and winding. Amplitude is inside the safe-area budget, so no drift can
      // carry a body against the mask.
      const bt = reduceMotion
        ? spec.drift.phase
        : (t / spec.drift.period) * Math.PI * 2 * spec.drift.dir + spec.drift.phase;
      const x = (spec.at[0] + Math.cos(bt) * spec.drift.amp) * BODY_RADIUS;
      const y = (spec.at[1] + Math.sin(bt) * spec.drift.amp * 0.7) * BODY_RADIUS;
      group.position.set(x, y, -BODY_DEPTH);

      // The lerp is around the body's base scale — the shrink that fits its
      // native size into the eyepiece — with the hover swell on top of it.
      const hot = hovered === key;
      const base = bodyScale(key);
      const scale = THREE.MathUtils.lerp(group.scale.x, base * (hot ? HOVER_SCALE : 1), settle);
      group.scale.setScalar(scale);
      glows[key].opacity = THREE.MathUtils.lerp(
        glows[key].opacity,
        hot ? GLOW_OPACITY : 0,
        settle
      );

      // Steer the body's anchor element: project the drifted, parallaxed
      // position into the eyepiece and park the DOM square over it. Size is
      // the body's on-screen footprint, floored at 44px for touch.
      const el = reachEls.current[key];
      if (!el) continue;
      projected
        .set(x + fg.current.position.x, y + fg.current.position.y, -BODY_DEPTH)
        .project(camera);
      const px = (projected.x * 0.5 + 0.5) * size.width;
      const py = (-projected.y * 0.5 + 0.5) * size.height;
      const diameter = Math.max(44, spec.extent * size.height + 8);
      el.style.width = `${diameter}px`;
      el.style.height = `${diameter}px`;
      el.style.transform = `translate(-50%, -50%) translate(${px}px, ${py}px)`;
      el.style.visibility = "visible";
    }
  });

  return (
    <group>
      {/* The bodies are toon and Lambert surfaces — this sky needs lighting. */}
      <ambientLight intensity={0.5} color="#c8d2ee" />
      <directionalLight position={[120, 260, -60]} intensity={1.0} color="#eef2ff" />

      {/* The far layer: stars, and the tech-stack planet with its chip shells
          — the visual callback, deliberately small and out of the way. */}
      <group ref={bg}>
        <group ref={stars}>
          <Starfield />
        </group>
        <group ref={earth} position={[EARTH_AT[0] * EARTH_RADIUS, EARTH_AT[1] * EARTH_RADIUS, -EARTH_DEPTH]}>
          <group scale={EARTH_SCALE}>
            <MainPlanet />
            <MiniatureShells frozen={reduceMotion} />
          </group>
        </group>
      </group>

      {/* The near layer: the four bodies, one per quadrant of the circle. */}
      <group ref={fg}>
        <group ref={(g) => (bodies.current.github = g)} scale={bodyScale("github")}>
          <BlackHole position={[0, 0, 0]} />
          <sprite material={glows.github} scale={BLACK_HOLE_RADIUS * 7} position={[0, 0, -BLACK_HOLE_RADIUS * 4]} />
        </group>

        {(["email", "linkedin", "phone"] as const).map((key) => {
          const index = PLANET_INDEX[key];
          const planet = DISTANT_PLANETS[index];
          return (
            <group key={key} ref={(g) => (bodies.current[key] = g)} scale={bodyScale(key)}>
              {/* The same attitude the body holds in the tech-stack sky. */}
              <group rotation={distantPlanetTumble(index)}>
                <DistantPlanetBody planet={planet} />
              </group>
              <sprite
                material={glows[key]}
                scale={planet.radius * (planet.ring ? 6.5 : 4.5)}
                position={[0, 0, -planet.radius * 1.4]}
              />
            </group>
          );
        })}
      </group>
    </group>
  );
}

interface ContactsProps {
  reachEls: React.MutableRefObject<ReachElements>;
  /** Reports the hot body and its caption up to the overlay chrome. */
  onHover: (key: ReachKey | null, caption: string | null) => void;
  /**
   * Clicking the phone planet opens the save-my-number card instead of
   * dialling — a `tel:` link on a desk does nothing useful, and on a phone
   * the card's vCard beats a bare call. See PhonePanel.
   */
  onPhoneClick: () => void;
}

/**
 * The four anchors over the four bodies. Real links in the DOM — tabbable in
 * reading order, each with its ARIA name, its focus ring, and the label pill
 * that fades in beside the body on hover or focus. The scene positions them;
 * this component owns everything about them that is markup.
 */
export function EyepieceSpaceContacts({ reachEls, onHover, onPhoneClick }: ContactsProps) {
  return (
    <>
      {REACH_ORDER.map((key) => {
        const spec = REACH[key];
        const external = spec.href.startsWith("http");
        return (
          <a
            key={key}
            ref={(el) => (reachEls.current[key] = el)}
            className="eyepiece-body"
            data-label-side={spec.labelSide}
            href={spec.href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            aria-label={spec.aria}
            aria-haspopup={key === "phone" ? "dialog" : undefined}
            onMouseEnter={() => onHover(key, spec.caption)}
            onMouseLeave={() => onHover(null, null)}
            onFocus={() => onHover(key, spec.caption)}
            onBlur={() => onHover(null, null)}
            onClick={(e) => {
              // "#" is contacts.ts's "not wired yet" — a no-op beats a blank tab.
              if (spec.href === "#") {
                e.preventDefault();
                return;
              }
              if (key === "phone") {
                e.preventDefault();
                onPhoneClick();
              }
            }}
          >
            <span className="eyepiece-body-label">{spec.label}</span>
          </a>
        );
      })}
    </>
  );
}
