import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { flatMaterial } from "./materials";
import { buildLabelGeometry } from "./labelGeometry";
import {
  BOOK_HEIGHT,
  BOOK_THICKNESS,
  BOOK_WIDTH,
  TABLE_SURFACE_Y,
  type BookSpot,
  type EducationId,
} from "./layout";

/** Distance at which the book is fully lifted, and the distance it starts reacting from. */
const ACTIVATE_NEAR = 5.5;
const ACTIVATE_FAR = 12;
/** Chest height above the table top once fully lifted. */
const HOVER_Y = TABLE_SURFACE_Y + 1.35;
const SPIN_SPEED = 0.62;
const BOB_SPEED = 1.5;
const BOB_HEIGHT = 0.09;
/** Extra lift while the pointer is over the book, on top of the proximity lift. */
const POINTER_LIFT = 0.14;
/** Exponential settle rate — fast enough to feel responsive, slow enough to read as "settling". */
const SETTLE_RATE = 2.6;

/** Each school gets its own binding, a little richer than the surrounding pastels so it draws the eye. */
const COVER_COLORS: Record<EducationId, string> = {
  tamalpais: "#8f5f52",
  ucla: "#3f6ea3",
  uc3m: "#7a5288",
};

interface FloatingBookProps {
  spot: BookSpot;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

/**
 * A clickable education book. It sits flat in its pile until the player gets
 * close, then lifts out, stands upright, and settles into a slow spin and bob —
 * reactive rather than ambient, so the contrast against the static piles is what
 * marks it as interactive.
 */
export function FloatingBook({ spot, playerPosRef }: FloatingBookProps) {
  const openEntry = useStore((s) => s.openEntry);
  const [hovered, setHovered] = useState(false);

  const spinGroup = useRef<THREE.Group>(null!);
  const tiltGroup = useRef<THREE.Group>(null!);
  /** 0 = resting in the pile, 1 = fully lifted and spinning. */
  const active = useRef(0);
  const pointerLift = useRef(0);

  // Decorrelates the three books' bobbing so they don't pulse in unison.
  const seed = useMemo(() => spot.restPosition[2] * 0.7 + spot.restPosition[0], [spot]);

  const coverMaterial = useMemo(() => flatMaterial(COVER_COLORS[spot.id], { emissive: "#ffe9b8", emissiveIntensity: 0 }), [spot.id]);
  const pageMaterial = useMemo(() => flatMaterial("#e8dec6"), []);
  const labelMaterial = useMemo(() => flatMaterial("#f6efdd", { emissive: "#ffdf9c", emissiveIntensity: 0.25 }), []);

  const labelGeometry = useMemo(
    () => buildLabelGeometry(spot.labelLines, spot.labelSize),
    [spot.labelLines, spot.labelSize]
  );

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const player = playerPosRef.current;
    const dx = player.x - spot.restPosition[0];
    const dz = player.z - spot.restPosition[2];
    const distance = Math.hypot(dx, dz);

    // 1 when the player is inside ACTIVATE_NEAR, easing to 0 by ACTIVATE_FAR.
    const target = 1 - THREE.MathUtils.smoothstep(distance, ACTIVATE_NEAR, ACTIVATE_FAR);
    const settle = 1 - Math.exp(-SETTLE_RATE * delta);
    active.current = THREE.MathUtils.lerp(active.current, target, settle);
    pointerLift.current = THREE.MathUtils.lerp(pointerLift.current, hovered ? POINTER_LIFT : 0, settle);

    const a = active.current;

    if (spinGroup.current) {
      const bob = Math.sin(elapsed * BOB_SPEED + seed) * BOB_HEIGHT * a;
      spinGroup.current.position.y =
        THREE.MathUtils.lerp(spot.restPosition[1], HOVER_Y, a) + bob + pointerLift.current * a;
      // Spin lives on the outer group so its axis stays world-vertical; the tilt
      // below it would otherwise carry the spin axis over with the book as it
      // stands up.
      spinGroup.current.rotation.y += SPIN_SPEED * a * delta;
    }
    if (tiltGroup.current) {
      // -PI/2 lays the book flat with its cover facing up; 0 stands it upright.
      tiltGroup.current.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, 0, a);
    }

    coverMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      coverMaterial.emissiveIntensity,
      hovered ? 0.42 : 0.1 * a,
      settle
    );
    labelMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      labelMaterial.emissiveIntensity,
      hovered ? 0.95 : 0.25 + 0.3 * a,
      settle
    );
  });

  const interaction = {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(false);
      document.body.style.cursor = "default";
    },
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      openEntry("education", spot.entryKey);
    },
  };

  const coverOffset = BOOK_THICKNESS / 2 - 0.025;
  const labelOffset = BOOK_THICKNESS / 2 + 0.02;

  return (
    <group ref={spinGroup} position={[spot.restPosition[0], spot.restPosition[1], spot.restPosition[2]]}>
      <group ref={tiltGroup}>
        {/* One invisible hull carries every pointer event, so the gaps inside and
            between the label's glyphs aren't holes a click falls through. */}
        <mesh {...interaction}>
          <boxGeometry args={[BOOK_WIDTH + 0.18, BOOK_HEIGHT + 0.18, BOOK_THICKNESS + 0.3]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {[1, -1].map((side) => (
          <mesh key={side} material={coverMaterial} position={[0, 0, side * coverOffset]} castShadow>
            <boxGeometry args={[BOOK_WIDTH, BOOK_HEIGHT, 0.05]} />
          </mesh>
        ))}
        <mesh material={pageMaterial} castShadow>
          <boxGeometry args={[BOOK_WIDTH - 0.09, BOOK_HEIGHT - 0.07, BOOK_THICKNESS - 0.08]} />
        </mesh>
        <mesh material={coverMaterial} position={[-BOOK_WIDTH / 2 + 0.03, 0, 0]} castShadow>
          <boxGeometry args={[0.07, BOOK_HEIGHT, BOOK_THICKNESS]} />
        </mesh>

        {/* Titled on both covers: the book spins continuously, so a single face
            would leave the label unreadable half the time. */}
        <mesh geometry={labelGeometry} material={labelMaterial} position={[0, 0, labelOffset]} />
        <mesh
          geometry={labelGeometry}
          material={labelMaterial}
          position={[0, 0, -labelOffset]}
          rotation={[0, Math.PI, 0]}
        />
      </group>
    </group>
  );
}
