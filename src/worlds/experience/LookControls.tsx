import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { useStore } from "../../state/useStore";

/**
 * The player is seated, so there is no movement here at all — only looking.
 * Arrow keys pan and tilt; dragging does the same with the pointer. Both are
 * clamped, because the desk is the subject: letting the view swing all the way
 * round would spend most of its range pointed at the back of an empty room.
 */
const YAW_LIMIT = 0.95;
const PITCH_MIN = -0.62;
const PITCH_MAX = 0.26;
/** Radians per second when panning with the arrow keys. */
const KEY_LOOK_RATE = 1.05;
const DRAG_SENSITIVITY = 0.0034;
/** Exponential catch-up, so key-panning eases instead of starting hard. */
const SMOOTH_RATE = 12;

interface LookControlsProps {
  /** Seated eye position. Fixed for the lifetime of the scene. */
  position: [number, number, number];
  /** Where the view rests before any input, in radians. */
  restPitch?: number;
}

export function LookControls({ position, restPitch = -0.2 }: LookControlsProps) {
  const { camera, gl } = useThree();
  const keys = useKeyboardState();

  const yaw = useRef(0);
  const pitch = useRef(restPitch);
  // Rendered orientation trails the target, which is what makes key-panning
  // feel weighted rather than mechanical.
  const smoothYaw = useRef(0);
  const smoothPitch = useRef(restPitch);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    camera.position.set(...position);
  }, [camera, position]);

  useEffect(() => {
    const canvas = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      // Left button only — right-drag is the browser's, not ours.
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw.current = THREE.MathUtils.clamp(
        yaw.current - (e.clientX - lastX) * DRAG_SENSITIVITY,
        -YAW_LIMIT,
        YAW_LIMIT
      );
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - (e.clientY - lastY) * DRAG_SENSITIVITY,
        PITCH_MIN,
        PITCH_MAX
      );
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const endDrag = () => {
      dragging = false;
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    // On window, so releasing outside the canvas still ends the drag.
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [gl]);

  useFrame((_state, delta) => {
    const k = keys.current;
    // The key names are the meadow controller's — here "forward" is simply the
    // up arrow, which tilts the view rather than walking anywhere.
    const yawInput = (k.left ? 1 : 0) - (k.right ? 1 : 0);
    const pitchInput = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);

    // The speed slider reaches the seated worlds too: turning the head is all
    // the moving the player does here, so the key rate is what it scales.
    // Dragging stays 1:1 — a pointer mapped through a multiplier stops
    // feeling attached to the hand.
    const speedScale = useStore.getState().speedScale;

    if (yawInput !== 0) {
      yaw.current = THREE.MathUtils.clamp(
        yaw.current + yawInput * KEY_LOOK_RATE * speedScale * delta,
        -YAW_LIMIT,
        YAW_LIMIT
      );
    }
    if (pitchInput !== 0) {
      pitch.current = THREE.MathUtils.clamp(
        pitch.current + pitchInput * KEY_LOOK_RATE * speedScale * delta,
        PITCH_MIN,
        PITCH_MAX
      );
    }

    const t = 1 - Math.exp(-SMOOTH_RATE * delta);
    smoothYaw.current = THREE.MathUtils.lerp(smoothYaw.current, yaw.current, t);
    smoothPitch.current = THREE.MathUtils.lerp(smoothPitch.current, pitch.current, t);

    euler.current.set(smoothPitch.current, smoothYaw.current, 0);
    camera.quaternion.setFromEuler(euler.current);
  });

  return null;
}
