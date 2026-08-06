import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { waveHeight } from "./waveField";

/**
 * Ring pool size. Rings are recycled oldest-first, so this is really "how many
 * ripples are visible at once" — RING_LIFE seconds of them at one per
 * SPAWN_DISTANCE of travel, with headroom.
 */
const RING_COUNT = 22;
/** World units the boat must travel between ripples, so wake density is speed-independent. */
const SPAWN_DISTANCE = 1.15;
const RING_LIFE = 2.6;
/** Below this speed the boat is drifting, not cutting water, and leaves nothing. */
const MIN_WAKE_SPEED = 0.5;
/** How far behind the boat's centre a ripple is dropped. */
const STERN_OFFSET = 0.85;

interface Ripple {
  x: number;
  z: number;
  /** Seconds since spawn; >= RING_LIFE means the slot is free. */
  age: number;
}

interface WakeProps {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  facingRef: React.MutableRefObject<number>;
  /** Signed speed along the boat's facing, written by Boat each frame. */
  speedRef: React.MutableRefObject<number>;
}

/**
 * Expanding ripple rings dropped behind the boat as it moves.
 *
 * Spawning is driven by distance travelled rather than by a timer: on a timer,
 * a boat at full speed strews rings far apart and a drifting one piles them on
 * top of each other, which reads as the wake changing character with speed
 * instead of simply being longer.
 */
export function Wake({ positionRef, facingRef, speedRef }: WakeProps) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const ripples = useRef<Ripple[]>(
    Array.from({ length: RING_COUNT }, () => ({ x: 0, z: 0, age: RING_LIFE }))
  );
  const nextSlot = useRef(0);
  const lastSpawn = useRef(new THREE.Vector3());

  // One material per ring: opacity is animated per ripple, and a shared
  // instance would fade all of them together.
  const materials = useMemo(
    () =>
      Array.from(
        { length: RING_COUNT },
        () =>
          new THREE.MeshBasicMaterial({
            color: PALETTE.foam,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            // Unlit on purpose: foam is meant to read as bright disturbed water
            // at any hour, not to darken with the rest of the sea after dark.
            fog: true,
          })
      ),
    []
  );

  const geometry = useMemo(() => {
    // Built at unit radius and scaled per ripple. 16 sides keeps the ring
    // visibly faceted, in the same language as everything else here.
    const ring = new THREE.RingGeometry(0.78, 1, 16);
    ring.rotateX(-Math.PI / 2);
    return ring;
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      for (const material of materials) material.dispose();
    };
  }, [geometry, materials]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const position = positionRef.current;
    const facing = facingRef.current;

    if (Math.abs(speedRef.current) > MIN_WAKE_SPEED) {
      const travelled = Math.hypot(position.x - lastSpawn.current.x, position.z - lastSpawn.current.z);
      if (travelled >= SPAWN_DISTANCE) {
        const ripple = ripples.current[nextSlot.current];
        // The boat's front is (sin, cos), so the stern is back along it.
        ripple.x = position.x - Math.sin(facing) * STERN_OFFSET;
        ripple.z = position.z - Math.cos(facing) * STERN_OFFSET;
        ripple.age = 0;
        nextSlot.current = (nextSlot.current + 1) % RING_COUNT;
        lastSpawn.current.set(position.x, 0, position.z);
      }
    } else {
      // Reset the anchor while stationary, so pulling away doesn't immediately
      // dump a ripple from wherever the boat last happened to stop.
      lastSpawn.current.set(position.x, 0, position.z);
    }

    for (let i = 0; i < RING_COUNT; i++) {
      const ripple = ripples.current[i];
      const mesh = meshes.current[i];
      if (!mesh) continue;

      if (ripple.age >= RING_LIFE) {
        mesh.visible = false;
        continue;
      }

      ripple.age += delta;
      const t = THREE.MathUtils.clamp(ripple.age / RING_LIFE, 0, 1);

      mesh.visible = true;
      mesh.position.set(
        ripple.x,
        // Rides the swell like everything else, lifted a hair so it never
        // z-fights the surface it sits on.
        waveHeight(ripple.x, ripple.z, time) + 0.035,
        ripple.z
      );
      // Eases out: a ripple spreads fast on release and then slows.
      mesh.scale.setScalar(0.4 + (1 - (1 - t) * (1 - t)) * 2.6);
      materials[i].opacity = (1 - t) * 0.45;
    }
  });

  return (
    <>
      {materials.map((material, i) => (
        <mesh
          key={i}
          ref={(el) => (meshes.current[i] = el)}
          geometry={geometry}
          material={material}
          visible={false}
        />
      ))}
    </>
  );
}
