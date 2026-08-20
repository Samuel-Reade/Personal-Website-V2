import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { PALETTE } from "./palette";
import { flatMat, flatMatUnique } from "./materials";
import { buildIslandGeometry } from "./islandGeometry";
import { ScatterProp } from "./Foliage";
import { Centerpiece } from "./islands";
import type { IslandSpot } from "./layout";

/** Distance past the shoreline at which the island is fully lit, and where it starts reacting. */
const PROXIMITY_NEAR = 5;
const PROXIMITY_FAR = 19;
/** Exponential settle rate for every ramp on the island. */
const SETTLE_RATE = 3.2;
/** Emissive strength at full proximity, and under the pointer. */
const GLOW_NEAR = 0.24;
const GLOW_HOVER = 0.62;

interface IslandProps {
  spot: IslandSpot;
  /** The boat's position, for the proximity ramp. */
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onHover: (label: string | null) => void;
  /**
   * Whether the interact key is aimed here. Lights the island as strongly as the
   * pointer does, which matters because the key — unlike a click — has no cursor
   * to show where it points.
   */
  targeted: boolean;
}

/**
 * One project island: a jittered low-poly landmass with its themed centerpiece
 * standing on the plateau.
 *
 * The whole island is one click target — pointer events raised by any child mesh
 * bubble to this group — so the player can aim at the coastline or at the
 * centerpiece and get the same result, and never has to leave the boat.
 *
 * Interactivity is signalled two ways on purpose. Proximity glow reads from
 * across the water and tells you an island is worth rowing to; the stronger
 * pointer glow tells you the click will land. Hover alone would be invisible
 * until the cursor happened to cross an island, and proximity alone would give
 * no feedback that the click is aimed.
 */
export function Island({ spot, playerPosRef, onHover, targeted }: IslandProps) {
  const openEntry = useStore((s) => s.openEntry);
  const [hovered, setHovered] = useState(false);

  const centerpieceGroup = useRef<THREE.Group>(null!);
  const glow = useRef(0);
  const lift = useRef(0);

  const geometry = useMemo(
    () => buildIslandGeometry(spot.radius, spot.height, spot.seed, spot.plateauFraction),
    [spot.radius, spot.height, spot.seed, spot.plateauFraction]
  );
  useEffect(() => geometry.dispose, [geometry]);

  // Unique rather than cached: these are driven every frame, and the shared
  // instances behind flatMat() are used by other islands and by the boat.
  const beachMat = useMemo(() => flatMatUnique(PALETTE.sand, { emissive: PALETTE.highlight, emissiveIntensity: 0 }), []);
  const lowerMat = useMemo(() => flatMatUnique(PALETTE.slope, { emissive: PALETTE.highlight, emissiveIntensity: 0 }), []);
  const upperMat = useMemo(() => flatMatUnique(PALETTE.grassDark, { emissive: PALETTE.highlight, emissiveIntensity: 0 }), []);
  const capMat = useMemo(() => flatMatUnique(PALETTE.grass, { emissive: PALETTE.highlight, emissiveIntensity: 0 }), []);
  useEffect(() => {
    return () => {
      beachMat.dispose();
      lowerMat.dispose();
      upperMat.dispose();
      capMat.dispose();
    };
  }, [beachMat, lowerMat, upperMat, capMat]);

  useFrame((_state, delta) => {
    const player = playerPosRef.current;
    const distance = Math.hypot(player.x - spot.position[0], player.z - spot.position[1]);
    // 1 once the boat is within PROXIMITY_NEAR of the shore, easing to 0 by FAR.
    const nearness =
      1 - THREE.MathUtils.smoothstep(distance, spot.radius + PROXIMITY_NEAR, spot.radius + PROXIMITY_FAR);

    const settle = 1 - Math.exp(-SETTLE_RATE * delta);
    // The lift below stays on `hovered` alone: the rise is pointer feedback, and
    // the glow is what the interact key borrows.
    const target = hovered || targeted ? GLOW_HOVER : nearness * GLOW_NEAR;
    glow.current = THREE.MathUtils.lerp(glow.current, target, settle);
    lift.current = THREE.MathUtils.lerp(lift.current, hovered ? 1 : 0, settle);

    beachMat.emissiveIntensity = glow.current;
    lowerMat.emissiveIntensity = glow.current;
    upperMat.emissiveIntensity = glow.current;
    capMat.emissiveIntensity = glow.current;

    if (centerpieceGroup.current) {
      // A small rise rather than a scale-up: these pieces stand on a plateau, and
      // growing one would sink its base into the ground it sits on.
      centerpieceGroup.current.position.y = geometry.plateauY + lift.current * 0.12;
    }
  });

  return (
    <group
      position={[spot.position[0], 0, spot.position[1]]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(spot.project);
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
        openEntry("projects", spot.project);
      }}
    >
      <mesh geometry={geometry.shore} material={flatMat(PALETTE.sandDark)} />
      <mesh geometry={geometry.beach} material={beachMat} />
      <mesh geometry={geometry.lower} material={lowerMat} />
      <mesh geometry={geometry.upper} material={upperMat} />
      <mesh geometry={geometry.cap} material={capMat} />

      {geometry.rocks.map(([x, y, z, r], i) => (
        <mesh
          key={i}
          material={flatMat(i % 2 === 0 ? PALETTE.rock : PALETTE.rockDark)}
          position={[x, y, z]}
          rotation={[0, i * 1.1, 0]}
        >
          <icosahedronGeometry args={[r, 0]} />
        </mesh>
      ))}

      {geometry.scatter.map((prop, i) => (
        <group key={i} position={prop.position} rotation={[0, prop.rotationY, 0]} scale={prop.scale}>
          <ScatterProp kind={prop.kind} />
        </group>
      ))}

      <group ref={centerpieceGroup} position={[0, geometry.plateauY, 0]} rotation={[0, spot.rotationY, 0]}>
        <Centerpiece id={spot.id} />
      </group>
    </group>
  );
}
