import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../palette";
import { flatMat, flatMatUnique, seeded } from "../materials";

/**
 * COVID-19 misinformation: a phone showing a flagged-content mark, with a
 * constant stream of speech bubbles pouring off it — the posts the study
 * classified, some of them flagged.
 */

/** Enough that the stream never visibly thins, few enough to stay one object. */
const BUBBLE_COUNT = 26;
const BUBBLE_LIFETIME = 6.5;
const BUBBLE_RISE = 5.4;
/** Fraction of bubbles carrying the flagged mark. */
const FLAGGED_SHARE = 0.3;

interface Bubble {
  age: number;
  /** Where it leaves the phone, in the phone's local XZ. */
  originX: number;
  originZ: number;
  /** Horizontal drift over its life. */
  driftX: number;
  driftZ: number;
  scale: number;
  spin: number;
  bobPhase: number;
  flagged: boolean;
}

/**
 * A speech balloon: rounded body plus a tail. Built once and shared as geometry
 * across every bubble — only the materials differ, and only their opacity is
 * animated, so the whole stream is a couple of dozen draws of the same shape.
 */
function useBubbleGeometry() {
  return useMemo(() => {
    const body = new THREE.IcosahedronGeometry(0.34, 1);
    // Squashed into a lozenge, which reads as a speech balloon where a sphere
    // reads as a bubble of air.
    body.scale(1.34, 1, 0.55);
    const tail = new THREE.ConeGeometry(0.12, 0.3, 5);
    tail.translate(0, -0.34, 0);
    return { body, tail };
  }, []);
}

function SpeechBubbles() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const { body, tail } = useBubbleGeometry();

  const bubbles = useMemo<Bubble[]>(
    () =>
      Array.from({ length: BUBBLE_COUNT }, (_, i) => {
        const angle = seeded(i * 7.3) * Math.PI * 2;
        return {
          // Spread through the cycle so the stream is already full on frame one.
          age: (i / BUBBLE_COUNT) * BUBBLE_LIFETIME,
          originX: Math.cos(angle) * (0.3 + seeded(i * 11.9) * 0.5),
          originZ: Math.sin(angle) * (0.2 + seeded(i * 13.1) * 0.35),
          driftX: (seeded(i * 17.7) - 0.5) * 3.4,
          driftZ: (seeded(i * 19.3) - 0.5) * 2.2,
          scale: 0.62 + seeded(i * 23.1) * 0.62,
          spin: (seeded(i * 29.7) - 0.5) * 0.9,
          bobPhase: seeded(i * 31.3) * Math.PI * 2,
          flagged: seeded(i * 37.9) < FLAGGED_SHARE,
        };
      }),
    []
  );

  // One material per bubble, because each fades on its own schedule.
  const materials = useMemo(
    () =>
      bubbles.map((bubble) =>
        flatMatUnique(bubble.flagged ? PALETTE.bubbleFlagged : PALETTE.bubble, {
          transparent: true,
          opacity: 0,
        })
      ),
    [bubbles]
  );
  useEffect(() => {
    return () => {
      body.dispose();
      tail.dispose();
      for (const material of materials) material.dispose();
    };
  }, [body, tail, materials]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      const group = groups.current[i];
      if (!group) continue;

      bubble.age = (bubble.age + delta) % BUBBLE_LIFETIME;
      const t = bubble.age / BUBBLE_LIFETIME;

      group.position.set(
        bubble.originX + bubble.driftX * t + Math.sin(time * 0.8 + bubble.bobPhase) * 0.18 * t,
        3.1 + t * BUBBLE_RISE,
        bubble.originZ + bubble.driftZ * t
      );
      // Pops to full size quickly and then holds, the way a notification lands.
      group.scale.setScalar(bubble.scale * Math.min(1, t * 7));
      group.rotation.z = bubble.spin * t;
      group.rotation.y = Math.sin(time * 0.5 + bubble.bobPhase) * 0.25;

      materials[i].opacity = Math.min(t * 7, 1) * (1 - t * t) * 0.92;
    }
  });

  return (
    <>
      {bubbles.map((bubble, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)}>
          <mesh geometry={body} material={materials[i]} />
          <mesh geometry={tail} material={materials[i]} position={[-0.16, 0, 0]} rotation={[0, 0, 0.3]} />
          {/* Two short bars standing in for text. Flagged bubbles get the strike
              mark instead, so the stream reads as mostly ordinary posts with
              some proportion of them caught. */}
          {bubble.flagged ? (
            <mesh material={flatMat(PALETTE.flagRed)} position={[0, 0, 0.16]} rotation={[0, 0, -Math.PI / 4]}>
              <boxGeometry args={[0.34, 0.07, 0.03]} />
            </mesh>
          ) : (
            <>
              <mesh material={flatMat(PALETTE.bubbleText)} position={[0, 0.08, 0.16]}>
                <boxGeometry args={[0.4, 0.06, 0.02]} />
              </mesh>
              <mesh material={flatMat(PALETTE.bubbleText)} position={[-0.06, -0.06, 0.16]}>
                <boxGeometry args={[0.28, 0.06, 0.02]} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </>
  );
}

export function PhoneScene() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.phoneBezel)} position={[0, 0.16, 0]}>
        <boxGeometry args={[1.5, 0.32, 0.72]} />
      </mesh>
      <mesh material={flatMat(PALETTE.phoneBody)} position={[0, 1.85, 0]}>
        <boxGeometry args={[1.5, 3.1, 0.22]} />
      </mesh>
      <mesh material={flatMat(PALETTE.phoneScreen)} position={[0, 1.9, 0.13]}>
        <boxGeometry args={[1.28, 2.6, 0.03]} />
      </mesh>
      <mesh material={flatMat(PALETTE.phoneBezel)} position={[0, 3.28, 0.13]}>
        <boxGeometry args={[0.34, 0.06, 0.03]} />
      </mesh>

      {/* The blocked mark: a ring with a bar struck through it. */}
      <mesh material={flatMat(PALETTE.flagRed)} position={[0, 1.9, 0.17]}>
        <torusGeometry args={[0.44, 0.1, 5, 14]} />
      </mesh>
      <mesh material={flatMat(PALETTE.flagRed)} position={[0, 1.9, 0.19]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.88, 0.19, 0.08]} />
      </mesh>

      <SpeechBubbles />
    </group>
  );
}
