import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * One clickable thing in the telescope's daytime view: an invisible hull
 * carrying the events, a scale lift and an emissive glow while hovered, and the
 * link on click — the same interaction language as the book, the islands and the
 * shelf.
 *
 * Its own module because the thing being pointed at has changed once already
 * (an anchor, a lighthouse, a bottle and a bell, before the four balloons) and
 * the behaviour did not: whatever hangs in front of the lens, hovering it lifts
 * it, captions it and reaches me one way. Keeping the behaviour separate from
 * the imagery is what makes the next swap a change of geometry only.
 *
 * "Reaches me one way" is the href for three of the four and a callback for
 * the fourth — see `onActivate`.
 */

/** Warm lift the objects take under the pointer. */
export const HIGHLIGHT = "#ffd9a0";
const HOVER_RATE = 8;
const HOVER_SCALE = 1.09;

export function ContactObject({
  caption,
  href,
  onActivate,
  hull,
  hullPosition = [0, 0, 0],
  position,
  glow,
  onHover,
  onHoverChange,
  children,
}: {
  caption: string;
  href: string;
  /**
   * Run instead of following `href`, for the target whose link is not the
   * right thing to do with a click. The phone is the only one: its href is a
   * `tel:`, which on a desktop does nothing at all, so the night sky has
   * always intercepted it and raised the save-my-number card instead. The day
   * view had no way to say the same thing and simply fired the `tel:`.
   */
  onActivate?: () => void;
  hull: [number, number, number];
  hullPosition?: [number, number, number];
  position: [number, number, number];
  /** Materials whose emissive lifts under the pointer, from rest to hover. */
  glow: { material: THREE.MeshLambertMaterial; rest?: number; hover?: number }[];
  onHover: (caption: string | null) => void;
  /**
   * Reports this object's own hover state, which `onHover` cannot: that one
   * carries a caption up to the chrome shared by all four, so a child watching
   * it has no way to tell "I am hovered" from "one of my neighbours is".
   */
  onHoverChange?: (hovered: boolean) => void;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

  useEffect(() => onHoverChange?.(hovered), [hovered, onHoverChange]);

  useFrame((_, delta) => {
    const settle = 1 - Math.exp(-HOVER_RATE * delta);
    const scale = THREE.MathUtils.lerp(group.current.scale.x, hovered ? HOVER_SCALE : 1, settle);
    group.current.scale.setScalar(scale);
    for (const { material, rest = 0, hover = 0.9 } of glow) {
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        hovered ? hover : rest,
        settle
      );
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh
        position={hullPosition}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(caption);
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
          if (onActivate) {
            onActivate();
            return;
          }
          // "#" is contacts.ts's "not wired yet" — a no-op beats a blank tab.
          if (href === "#") return;
          if (href.startsWith("http")) window.open(href, "_blank", "noopener,noreferrer");
          else window.location.href = href;
        }}
      >
        <boxGeometry args={hull} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {children}
    </group>
  );
}
