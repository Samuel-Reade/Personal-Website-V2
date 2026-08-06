import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Where the player is looking, relative to whichever way their body faces.
 * Yaw is positive to the left, matching the character controller's convention
 * that the left arrow *increases* facing; pitch is positive looking up.
 */
export interface LookState {
  yaw: number;
  pitch: number;
}

/** Deflection at the very edge of the viewport, in radians. */
const MAX_YAW = 0.9;
const MAX_PITCH = 0.5;
/**
 * Fraction of the half-viewport around the centre that produces no rotation.
 *
 * Without it, aiming at a portal or an island is a chase: the camera swings as
 * the cursor approaches the target, so the target moves away from the cursor.
 * A still centre means anything the player is actually about to click sits in a
 * region where the view holds steady.
 */
const DEAD_ZONE = 0.22;
/** Exponential catch-up. Low enough to feel like a head turning, not a snap. */
const SMOOTH_RATE = 7;

/** Remaps [-1, 1] with a still band in the middle, without a step at its edge. */
function applyDeadZone(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= DEAD_ZONE) return 0;
  return Math.sign(value) * ((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE));
}

/**
 * Cursor-driven free look, shared by the camera and the character so both read
 * from one smoothed value rather than each easing toward the raw pointer on its
 * own — two independent smoothers at the same rate still drift apart under a
 * variable frame time, and the character would visibly lag or lead the view.
 *
 * Tracked by pointer *position* rather than by dragging: the player should be
 * able to look around without holding a button, and pointer lock is not an
 * option in a world where the islands and portals have to stay clickable.
 *
 * Call this inside the Canvas and pass the returned ref to both consumers.
 */
export function useCursorLook(): React.MutableRefObject<LookState> {
  const look = useRef<LookState>({ yaw: 0, pitch: 0 });
  const target = useMemo(() => ({ yaw: 0, pitch: 0 }), []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      // Normalized against the viewport rather than the canvas: the canvas fills
      // it, and reading layout per pointer event would thrash it.
      const nx = (event.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      const ny = (event.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      // Cursor right looks right, which is a *decrease* in yaw; cursor up looks
      // up, which is an increase in pitch.
      target.yaw = -applyDeadZone(THREE.MathUtils.clamp(nx, -1, 1)) * MAX_YAW;
      target.pitch = -applyDeadZone(THREE.MathUtils.clamp(ny, -1, 1)) * MAX_PITCH;
    };
    // Leaving the window would otherwise strand the view at whatever deflection
    // the cursor had as it crossed the edge.
    const onLeave = () => {
      target.yaw = 0;
      target.pitch = 0;
    };

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [target]);

  useFrame((_state, delta) => {
    // exp form keeps the smoothing rate frame-rate independent.
    const t = 1 - Math.exp(-SMOOTH_RATE * delta);
    look.current.yaw = THREE.MathUtils.lerp(look.current.yaw, target.yaw, t);
    look.current.pitch = THREE.MathUtils.lerp(look.current.pitch, target.pitch, t);
  });

  return look;
}
