import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { Mouse } from "./DeskProps";
import { haloTexture } from "./materials";
import { PALETTE } from "./palette";
import { setLookLocked } from "./LookControls";
import {
  SCREEN_ASPECT,
  flushScreen,
  moveScreenCursor,
  pressScreenCursor,
  releaseScreenCursor,
} from "./screenTexture";

/**
 * The desk mouse, wired up as the input device it looks like. Press and hold it
 * and the drag stops turning the head and starts driving the arrow on the
 * monitor instead; the row that arrow lands on lights on screen and glows on
 * the desk, and letting go opens it.
 *
 * It is the second way into the same five records — the figurines are the
 * direct one — and the reason to have it is that it makes the monitor the thing
 * you operate rather than the thing you read. Every part of the loop stays
 * inside the world: no HTML cursor, no overlay, nothing that isn't on the desk.
 */

/** Fraction of the screen the cursor crosses per pixel of pointer drag. */
const CURSOR_RATE = 1 / 460;
/**
 * Metres the mouse itself slides per pixel of drag. Set so it reaches the end
 * of its roam at about the moment the cursor reaches the edge of the screen —
 * the two run out together rather than one visibly stalling before the other.
 */
const MOUSE_RATE = 1 / 1500;
/** How far off its home the mouse may wander, staying on the mat. */
const ROAM_X = 0.15;
const ROAM_Z = 0.1;

/**
 * Bigger than the pebble on every other desk. It has to be found before it can
 * be used, and at parity with the set dressing it was the least conspicuous
 * thing on the mat — smaller than the mug, lower than the phone.
 */
const BASE_SCALE = 1.35;
/**
 * Only a little wider than the mouse. The falloff is a proportion of the
 * radius, so a big disc spends all its brightness on empty mat and reads as
 * nothing at all — which is exactly what the first, far larger one did.
 */
const HALO_RADIUS = 0.1;
/**
 * Unlike the figurines' halo this one never goes out. Theirs answers a hover;
 * this one is the standing invitation, so it idles low and comes up to meet the
 * pointer rather than appearing from nothing.
 */
const HALO_REST = 0.46;
const HALO_LIT = 0.85;
/** Clear of the mat's top face, which sits a few millimetres over the desk. */
const HALO_Y = 0.011;

export function ScreenMouse() {
  const { gl } = useThree();
  const openEntry = useStore((s) => s.openEntry);

  const group = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Mesh>(null!);
  const [held, setHeld] = useState(false);
  const [hovered, setHovered] = useState(false);
  /** Mirrors `hovered` for the drag effect's cleanup, which must not re-run on hover. */
  const hoverRef = useRef(false);
  /** Displacement from the mouse's home position, in desk metres. */
  const offset = useRef({ x: 0, z: 0 });
  const scale = useRef(1);
  const last = useRef({ x: 0, y: 0 });

  const setCursor = useCallback(
    (style: string) => {
      gl.domElement.style.cursor = style;
    },
    [gl]
  );

  useFrame((_state, delta) => {
    const t = 1 - Math.exp(-14 * delta);
    // The same lift the figurines answer a hover with, at half the amount: this
    // one is a control, and a control that jumps at the cursor reads as loose.
    const lit = hovered || held;
    scale.current = THREE.MathUtils.lerp(scale.current, lit ? 1.08 : 1, t);
    // Position on the outer group, scale on the inner one — the same split the
    // figurines use, so the pool of light stays put while the mouse grows in it.
    if (group.current) group.current.position.set(offset.current.x, 0, offset.current.z);
    if (inner.current) inner.current.scale.setScalar(BASE_SCALE * scale.current);
    if (halo.current) {
      const material = halo.current.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.lerp(material.opacity, lit ? HALO_LIT : HALO_REST, t);
    }
    // The screen redraws here rather than inside the pointer handler, so a fast
    // drag costs one repaint a frame instead of one an event.
    flushScreen();
  });

  useEffect(() => {
    if (!held) return;
    setLookLocked(true);
    setCursor("grabbing");

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      // Vertical is scaled by the screen's aspect so a diagonal drag draws a
      // diagonal on the monitor rather than a steeper line.
      moveScreenCursor(dx * CURSOR_RATE, dy * CURSOR_RATE * SCREEN_ASPECT);
      offset.current.x = THREE.MathUtils.clamp(offset.current.x + dx * MOUSE_RATE, -ROAM_X, ROAM_X);
      offset.current.z = THREE.MathUtils.clamp(offset.current.z + dy * MOUSE_RATE, -ROAM_Z, ROAM_Z);
    };
    const onUp = () => {
      // The release is the click. Resting on a row means that row was pressed —
      // which covers both gestures: drag onto a record and let go, or press and
      // release without moving on the one the cursor was already sitting on.
      const target = releaseScreenCursor();
      setHeld(false);
      if (target) openEntry("experience", target);
    };

    // On window, so a release outside the canvas still ends the drag.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setLookLocked(false);
      setCursor(hoverRef.current ? "pointer" : "grab");
    };
  }, [held, openEntry, setCursor]);

  return (
    <group
      ref={group}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        hoverRef.current = true;
        setHovered(true);
        if (!held) setCursor("pointer");
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        hoverRef.current = false;
        setHovered(false);
        if (!held) setCursor("grab");
      }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        last.current = { x: e.clientX, y: e.clientY };
        // Taken here rather than in the effect below so the look controller sees
        // the lock on this very event, whichever listener it runs after.
        setLookLocked(true);
        pressScreenCursor();
        setHeld(true);
      }}
    >
      <mesh ref={halo} position={[0, HALO_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[HALO_RADIUS, 20]} />
        <meshBasicMaterial
          map={haloTexture()}
          color={PALETTE.hoverHalo}
          transparent
          opacity={HALO_REST}
          depthWrite={false}
        />
      </mesh>
      <group ref={inner}>
        <Mouse lit />
      </group>
    </group>
  );
}
