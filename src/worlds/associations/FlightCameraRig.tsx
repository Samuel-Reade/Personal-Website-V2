import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The chase camera for the helicopter — the space world's rig, retuned.
 *
 * `three/CameraRig` can't keep an aircraft centred. It assumes a character
 * standing on ground: its boom swings in the XZ plane and it deliberately
 * routes almost all pitch into *lifting the point it aims at* rather than
 * orbiting, precisely so the lens never drops below the floor. That lift is
 * what slid the helicopter down the screen every time the pilot aimed. Up
 * here there is no floor within eighty units, and the machine genuinely flies
 * up and down its aim — so this is `techstack/SpaceCameraRig` over again: the
 * boom trails the full 3D heading and the camera looks *at the helicopter*,
 * every frame, which is the whole of what keeps it centred. Copied rather
 * than imported for the same reason every world owns its materials — the
 * numbers below are this machine's, and retuning the suit's camera should
 * never quietly re-frame this one.
 */

/** A helicopter is twice the suit's size, so the whole envelope sits further out. */
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 13;
const START_DISTANCE = 8;
/**
 * How far above the boom line the camera rides. Small, and applied along world
 * up rather than the airframe's, so the horizon doesn't roll with the bank.
 */
const SHOULDER_LIFT = 1.3;
/** Height on the machine the camera aims at — the rotor head, its visual centre. */
const LOOK_HEIGHT = 0.3;
const FOLLOW_RATE = 9;
const ZOOM_PER_WHEEL_UNIT = 0.005;

interface FlightCameraRigProps {
  targetRef: React.MutableRefObject<THREE.Vector3>;
  facingRef: React.MutableRefObject<number>;
  /** The aim, written by the helicopter each frame. */
  pitchRef: React.MutableRefObject<number>;
}

export function FlightCameraRig({ targetRef, facingRef, pitchRef }: FlightCameraRigProps) {
  const { camera, gl } = useThree();
  const distance = useRef(START_DISTANCE);

  const desired = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const heading = useMemo(() => new THREE.Vector3(), []);
  /**
   * Placed outright on the first frame rather than eased into: the Canvas
   * starts the camera at a fixed spot that has nothing to do with where the
   * helicopter spawns, and easing from there flies it across the range before
   * the shot settles.
   */
  const placed = useRef(false);

  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      distance.current = THREE.MathUtils.clamp(
        distance.current + event.deltaY * ZOOM_PER_WHEEL_UNIT,
        MIN_DISTANCE,
        MAX_DISTANCE
      );
    };
    // Bound to the canvas, so scrolling an open content panel doesn't zoom the
    // world behind it.
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [gl]);

  useFrame((_state, delta) => {
    const target = targetRef.current;
    const yaw = facingRef.current;
    const pitch = pitchRef.current;

    // The same heading the helicopter thrusts along, so the camera always
    // trails directly behind the direction of travel.
    const cosPitch = Math.cos(pitch);
    heading.set(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch);

    const reach = distance.current;
    desired.set(
      target.x - heading.x * reach,
      target.y - heading.y * reach + LOOK_HEIGHT + SHOULDER_LIFT,
      target.z - heading.z * reach
    );

    if (placed.current) {
      // exp form keeps the smoothing rate frame-rate independent.
      camera.position.lerp(desired, 1 - Math.exp(-FOLLOW_RATE * delta));
    } else {
      camera.position.copy(desired);
      placed.current = true;
    }

    lookAt.set(target.x, target.y + LOOK_HEIGHT, target.z);
    // `up` pinned to world up rather than the airframe's, so the range never
    // rolls under the player when the machine banks into a turn.
    camera.up.set(0, 1, 0);
    camera.lookAt(lookAt);
  });

  return null;
}
