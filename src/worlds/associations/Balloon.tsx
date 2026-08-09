import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { PALETTE } from "./palette";
import { flatMat, flatMatUnique } from "./materials";
import { Emblem } from "./emblems";
import { PROXIMITY_FAR, PROXIMITY_NEAR, type BalloonSpot } from "./layout";

/** Exponential settle rate for the glow and the lift, matching the archipelago's islands. */
const SETTLE_RATE = 3.2;
/** Emissive strength when the helicopter is alongside, and under the pointer. */
const GLOW_NEAR = 0.26;
const GLOW_HOVER = 0.66;

/** How far the balloon rises and falls on its tether, and how far it leans doing it. */
const BOB_HEIGHT = 0.42;
const BOB_SPEED = 0.42;
const SWAY_ANGLE = 0.055;
const SWAY_SPEED = 0.31;

/**
 * Panels around the envelope.
 *
 * Fourteen rather than ten. A real balloon carries sixteen to twenty-four gores,
 * and at ten this read as a faceted ball; fourteen keeps every panel clearly a
 * flat plane — which the rest of the site requires — while giving the silhouette
 * enough sides to be round at the distance it is seen from.
 */
const GORES = 14;

/**
 * The envelope's profile: half-width at each height, both as fractions of the
 * radius, from the crown down to the mouth.
 *
 * This is the shape that makes it a balloon rather than a sphere. A hot air
 * envelope is not round — it is widest a third of the way down, holds nearly
 * full width well below that, then draws in hard to a mouth about a third of its
 * greatest width. A sphere segment, which is what this was, gives a perfect dome
 * and a mouth as wide as the balloon, and reads as a bauble.
 */
const PROFILE: [number, number][] = [
  [1.0, 0.0],
  [0.94, 0.3],
  [0.82, 0.58],
  [0.66, 0.82],
  [0.44, 0.97],
  [0.2, 1.0],
  [-0.04, 0.95],
  [-0.28, 0.82],
  [-0.52, 0.64],
  [-0.74, 0.46],
  [-0.9, 0.35],
];

interface BalloonProps {
  spot: BalloonSpot;
  /** The helicopter's position, for the proximity ramp. */
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onHover: (label: string | null) => void;
  /** True while this is the balloon the interact key would open. */
  targeted: boolean;
}

/**
 * One association, as a tethered hot air balloon.
 *
 * The whole thing is one click target — envelope, basket and all — because
 * pointer events from any child bubble to the group. A player lining up on a
 * basket and a player lining up on the envelope get the same result, which is
 * what you want when both are being aimed at from a moving aircraft.
 *
 * Interactivity is signalled three ways, and each covers a case the others miss.
 * Proximity glow reads from across the clearing and says a balloon is worth
 * flying to. Pointer glow says a click will land. And `targeted` — the brightest
 * of the three — says the interact key is aimed here, which matters because the
 * key has no cursor to show where it points.
 */
export function Balloon({ spot, playerPosRef, onHover, targeted }: BalloonProps) {
  const openEntry = useStore((s) => s.openEntry);
  const [hovered, setHovered] = useState(false);

  const floatGroup = useRef<THREE.Group>(null!);
  const tether = useRef<THREE.Mesh>(null!);
  const flame = useRef<THREE.Group>(null!);
  const glow = useRef(0);

  // Unique rather than cached, because the render loop drives their emissive and
  // the shared instances behind flatMat() are used by the rest of the clearing.
  // Double-sided: the mouth is open and from below — which is where the
  // helicopter usually is — you are looking at the inside of the far panels.
  const skinA = useMemo(() => {
    const m = flatMatUnique(EMBLEM_COLORS[spot.id].a, { emissive: PALETTE.highlight, emissiveIntensity: 0 });
    m.side = THREE.DoubleSide;
    return m;
  }, [spot.id]);
  const skinB = useMemo(() => {
    const m = flatMatUnique(EMBLEM_COLORS[spot.id].b, { emissive: PALETTE.highlight, emissiveIntensity: 0 });
    m.side = THREE.DoubleSide;
    return m;
  }, [spot.id]);
  useEffect(
    () => () => {
      skinA.dispose();
      skinB.dispose();
    },
    [skinA, skinB]
  );

  /**
   * The burner flame, in two cones — an outer orange wash and a hotter core.
   *
   * Additive and unlit, because fire is a light source, not a lit surface: in
   * daylight it washes to a shimmer and after dark it pops, both for free.
   * A pilot light burns all the time, and every few seconds the burner opens up
   * — which is the rhythm a moored balloon actually keeps, firing in bursts to
   * hold its height.
   */
  const flameMats = useMemo(
    () =>
      [PALETTE.flameOuter, PALETTE.flameInner].map(
        (color) =>
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
      ),
    []
  );
  useEffect(() => () => flameMats.forEach((m) => m.dispose()), [flameMats]);

  /**
   * One gore of the envelope: a lune from crown to skirt.
   *
   * Built as a sphere segment rather than a whole sphere per colour, because
   * alternating panels is the only way to get two-tone stripes out of flat
   * shading without a texture — and this world, like the rest of the site, has
   * no textures in it.
   */
  const gore = useMemo(() => {
    const phi = (Math.PI * 2) / GORES;
    const positions: number[] = [];
    const indices: number[] = [];
    // Three columns across a panel, so its own curvature shows rather than the
    // panel reading as one flat quad bent only at the seams.
    const COLUMNS = 3;

    for (const [y, w] of PROFILE) {
      for (let c = 0; c <= COLUMNS; c++) {
        const angle = (c / COLUMNS) * phi;
        positions.push(Math.cos(angle) * w * spot.radius, y * spot.radius, Math.sin(angle) * w * spot.radius);
      }
    }
    for (let r = 0; r < PROFILE.length - 1; r++) {
      for (let c = 0; c < COLUMNS; c++) {
        const a = r * (COLUMNS + 1) + c;
        indices.push(a, a + COLUMNS + 1, a + 1, a + 1, a + COLUMNS + 1, a + COLUMNS + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [spot.radius]);
  useEffect(() => () => gore.dispose(), [gore]);

  /**
   * Load tapes: the horizontal bands that carry an envelope's weight down to the
   * basket. One of the few details that reads as *balloon* rather than as a ball
   * on strings, and they cost two rings.
   */
  const tapes = useMemo(() => [{ y: 0.32, w: 0.995 }, { y: -0.16, w: 0.9 }], []);

  /** Where the basket hangs, measured down from the envelope's centre. */
  const basketDrop = spot.radius * 1.62;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const player = playerPosRef.current;

    // 3D distance, unlike the archipelago's islands — altitude is half of what
    // separates one balloon from another here.
    const distance = Math.hypot(
      player.x - spot.anchor[0],
      player.y - spot.centerY,
      player.z - spot.anchor[1]
    );
    const nearness = 1 - THREE.MathUtils.smoothstep(distance, PROXIMITY_NEAR, PROXIMITY_FAR);

    const settle = 1 - Math.exp(-SETTLE_RATE * delta);
    const target = hovered || targeted ? GLOW_HOVER : nearness * GLOW_NEAR;
    glow.current = THREE.MathUtils.lerp(glow.current, target, settle);
    skinA.emissiveIntensity = glow.current;
    skinB.emissiveIntensity = glow.current;

    // Bob and lean on the tether. Both run off the same phase so a balloon
    // rising is also leaning, the way something actually straining on a line
    // moves, rather than two unrelated wobbles happening at once.
    const bob = Math.sin(t * BOB_SPEED + spot.phase);
    if (floatGroup.current) {
      floatGroup.current.position.y = spot.height + bob * BOB_HEIGHT;
      floatGroup.current.rotation.z = Math.sin(t * SWAY_SPEED + spot.phase) * SWAY_ANGLE;
      floatGroup.current.rotation.x = Math.cos(t * SWAY_SPEED * 0.8 + spot.phase) * SWAY_ANGLE * 0.7;
    }

    // The tether has to follow, or it detaches visibly at the top of every bob.
    // Scaling a unit cylinder along its own length is enough: the anchor is
    // directly below the basket, so the rope only ever changes in length.
    if (tether.current) {
      const length = spot.height + bob * BOB_HEIGHT - basketDrop;
      tether.current.scale.y = Math.max(0.01, length);
      tether.current.position.y = length / 2;
    }

    // The burner. A fast shimmer over a slow burst envelope: raised to a high
    // power, the sine spends most of its cycle near zero — the pilot light —
    // and opens up for a second or two out of every cycle.
    if (flame.current) {
      const burst = Math.pow(Math.max(0, Math.sin(t * 0.27 + spot.phase * 2.3)), 10);
      const shimmer = 0.8 + 0.2 * Math.sin(t * 21 + spot.phase) * Math.sin(t * 15.7);
      const strength = (0.16 + 0.84 * burst) * shimmer;
      flame.current.scale.y = 0.45 + strength * 1.15;
      flameMats[0].opacity = 0.28 + 0.6 * strength;
      flameMats[1].opacity = 0.38 + 0.55 * strength;
    }
  });

  return (
    // Sat on the hill's surface, not on y = 0 — the crown of this clearing
    // stands 2.2 units up, and anchoring at the origin buries every stake.
    // Everything inside is therefore measured from the ground at this stake.
    <group position={[spot.anchor[0], spot.groundY, spot.anchor[1]]}>
      {/* Stake and rope. Outside the floating group, because the ground end of a
          tether does not move with the thing it is holding down. */}
      <mesh material={flatMat(PALETTE.stake)} position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.36, 5]} />
      </mesh>
      <mesh ref={tether} material={flatMat(PALETTE.rope)}>
        {/* A unit-height cylinder, scaled each frame — see the note above.
            Thicker than a rope strictly is, because it now runs sixty-odd units
            from summit to basket and at true scale it would vanish — the line
            has to survive being seen from the flight band. */}
        <cylinderGeometry args={[0.055, 0.055, 1, 4]} />
      </mesh>

      <group
        ref={floatGroup}
        position={[0, spot.height, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(spot.label);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          onHover(null);
          document.body.style.cursor = "default";
        }}
        onClick={(e) => {
          e.stopPropagation();
          openEntry("extracurriculars", spot.org);
        }}
      >
        <group rotation={[0, spot.rotationY, 0]}>
          {/* Envelope, in alternating gores. */}
          {Array.from({ length: GORES }, (_, i) => (
            <mesh
              key={i}
              geometry={gore}
              material={i % 2 === 0 ? skinA : skinB}
              rotation={[0, (i / GORES) * Math.PI * 2, 0]}
            />
          ))}
          {/* Load tapes, and the crown ring at the top of them. */}
          {tapes.map((tape) => (
            <mesh
              key={tape.y}
              material={flatMat(PALETTE.tape)}
              position={[0, tape.y * spot.radius, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[tape.w * spot.radius, spot.radius * 0.022, 4, GORES]} />
            </mesh>
          ))}
          <mesh
            material={flatMat(PALETTE.tape)}
            position={[0, spot.radius * 0.93, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[spot.radius * 0.3, spot.radius * 0.03, 4, 10]} />
          </mesh>
          {/* The parachute vent at the crown — the dark disc every real envelope
              carries at its apex, and the one detail of a balloon that is only
              visible from above, which is where the helicopter mostly is. Set
              just over the apex so it caps the crown rather than slicing
              through the gores' closing cone. */}
          <mesh
            material={flatMat(PALETTE.vent)}
            position={[0, spot.radius * 1.005, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[spot.radius * 0.17, 10]} />
          </mesh>

          {/* The motif, stood off the front of the envelope so it reads against
              the gores rather than disappearing into the seam between two. */}
          <group position={[0, spot.radius * 0.1, spot.radius * 0.92]}>
            <Emblem id={spot.id} scale={spot.radius * 0.42} />
          </group>

          {/* Burner frame and basket. */}
          <mesh material={flatMat(PALETTE.burner)} position={[0, -basketDrop + 0.62, 0]}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
          </mesh>
          {/* The flame, firing up from the burner into the mouth. The cones sit
              above the group's origin so the animated y-scale stretches them
              upward from the burner rather than through it. */}
          <group ref={flame} position={[0, -basketDrop + 0.8, 0]}>
            <mesh material={flameMats[0]} position={[0, 0.5, 0]}>
              <coneGeometry args={[0.17, 1, 6]} />
            </mesh>
            <mesh material={flameMats[1]} position={[0, 0.33, 0]}>
              <coneGeometry args={[0.09, 0.66, 6]} />
            </mesh>
          </group>
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`${sx}${sz}`}
                material={flatMat(PALETTE.rope)}
                position={[sx * 0.34, -basketDrop + 0.5, sz * 0.34]}
              >
                <cylinderGeometry args={[0.022, 0.022, spot.radius * 0.62, 4]} />
              </mesh>
            ))
          )}
          {/* Basket: squared, as a real one is, with a padded rim and corner
              posts. A plain barrel was saying "there is something under there"
              and nothing else. */}
          <mesh material={flatMat(PALETTE.basket)} position={[0, -basketDrop, 0]}>
            <boxGeometry args={[0.86, 0.62, 0.72]} />
          </mesh>
          <mesh material={flatMat(PALETTE.basketDark)} position={[0, -basketDrop + 0.33, 0]}>
            <boxGeometry args={[0.92, 0.09, 0.78]} />
          </mesh>
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`post${sx}${sz}`}
                material={flatMat(PALETTE.basketDark)}
                position={[sx * 0.44, -basketDrop + 0.02, sz * 0.37]}
              >
                <boxGeometry args={[0.07, 0.66, 0.07]} />
              </mesh>
            ))
          )}
          {/* Burner uprights, carrying the frame off the basket rim. */}
          {[-1, 1].map((sx) => (
            <mesh
              key={`upright${sx}`}
              material={flatMat(PALETTE.burner)}
              position={[sx * 0.3, -basketDrop + 0.5, 0]}
            >
              <boxGeometry args={[0.045, 0.42, 0.045]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Each balloon's two envelope colours, kept beside the emblem that goes on it. */
const EMBLEM_COLORS: Record<BalloonSpot["id"], { a: string; b: string }> = {
  "ucla-rugby": { a: PALETTE.rugbyA, b: PALETTE.rugbyB },
  "olympic-rugby": { a: PALETTE.olympicA, b: PALETTE.olympicB },
  "lambda-chi": { a: PALETTE.lambdaA, b: PALETTE.lambdaB },
  "stats-club": { a: PALETTE.statsA, b: PALETTE.statsB },
};
