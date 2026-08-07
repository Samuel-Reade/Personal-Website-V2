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

/** Segments around the envelope. Low, so the gores read as flat panels. */
const GORES = 10;

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
  const glow = useRef(0);

  // Unique rather than cached, because the render loop drives their emissive and
  // the shared instances behind flatMat() are used by the rest of the clearing.
  const skinA = useMemo(
    () => flatMatUnique(EMBLEM_COLORS[spot.id].a, { emissive: PALETTE.highlight, emissiveIntensity: 0 }),
    [spot.id]
  );
  const skinB = useMemo(
    () => flatMatUnique(EMBLEM_COLORS[spot.id].b, { emissive: PALETTE.highlight, emissiveIntensity: 0 }),
    [spot.id]
  );
  useEffect(
    () => () => {
      skinA.dispose();
      skinB.dispose();
    },
    [skinA, skinB]
  );

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
    return new THREE.SphereGeometry(spot.radius, 3, 8, 0, phi, 0, Math.PI * 0.62);
  }, [spot.radius]);
  useEffect(() => () => gore.dispose(), [gore]);

  /** The skirt: the envelope's mouth, tapering down toward the burner. */
  const skirt = useMemo(
    () => new THREE.ConeGeometry(spot.radius * 0.56, spot.radius * 0.72, GORES, 1, true),
    [spot.radius]
  );
  useEffect(() => () => skirt.dispose(), [skirt]);

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
        {/* A unit-height cylinder, scaled each frame — see the note above. */}
        <cylinderGeometry args={[0.035, 0.035, 1, 4]} />
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
          {/* The mouth, hanging below the envelope's equator. */}
          <mesh
            geometry={skirt}
            material={skinB}
            position={[0, -spot.radius * 0.76, 0]}
            rotation={[Math.PI, 0, 0]}
          />

          {/* The motif, stood off the front of the envelope so it reads against
              the gores rather than disappearing into the seam between two. */}
          <group position={[0, spot.radius * 0.1, spot.radius * 0.92]}>
            <Emblem id={spot.id} scale={spot.radius * 0.42} />
          </group>

          {/* Burner frame and basket. */}
          <mesh material={flatMat(PALETTE.burner)} position={[0, -basketDrop + 0.62, 0]}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
          </mesh>
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
          <mesh material={flatMat(PALETTE.basket)} position={[0, -basketDrop, 0]}>
            <cylinderGeometry args={[0.52, 0.44, 0.66, 8]} />
          </mesh>
          <mesh material={flatMat(PALETTE.basketDark)} position={[0, -basketDrop + 0.35, 0]}>
            <torusGeometry args={[0.52, 0.05, 4, 8]} />
          </mesh>
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
