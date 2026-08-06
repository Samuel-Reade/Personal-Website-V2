import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The chase camera for free flight.
 *
 * `three/CameraRig` can't be reused here. It assumes a character standing on
 * ground: its boom swings in the XZ plane and it deliberately routes almost all
 * pitch into *lifting the point it aims at* rather than orbiting, precisely so
 * the lens never drops below the floor. Out here there is no floor to protect
 * against and the body genuinely points up and down — the boom has to follow the
 * full 3D heading, or flying "up" would leave the camera behind at the old
 * altitude looking at the astronaut's boots.
 */

const MIN_DISTANCE = 3.5;
const MAX_DISTANCE = 11;
const START_DISTANCE = 7;
/**
 * How far above the boom line the camera rides. Small, and applied along world
 * up rather than the body's up, so the horizon doesn't roll with the astronaut's
 * idle sway.
 */
const SHOULDER_LIFT = 1.15;
/** Height on the body the camera aims at — roughly the life-support pack. */
const LOOK_HEIGHT = 1.45;
const FOLLOW_RATE = 9;
const ZOOM_PER_WHEEL_UNIT = 0.005;

interface SpaceCameraRigProps {
  targetRef: React.MutableRefObject<THREE.Vector3>;
  facingRef: React.MutableRefObject<number>;
  /** The body's vertical aim, written by the astronaut each frame. */
  pitchRef: React.MutableRefObject<number>;
}

export function SpaceCameraRig({ targetRef, facingRef, pitchRef }: SpaceCameraRigProps) {
  const { camera, gl } = useThree();
  const distance = useRef(START_DISTANCE);

  const desired = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const heading = useMemo(() => new THREE.Vector3(), []);

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

    // The same heading the astronaut thrusts along, so the camera always trails
    // directly behind the direction of travel.
    const cosPitch = Math.cos(pitch);
    heading.set(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch);

    const reach = distance.current;
    desired.set(
      target.x - heading.x * reach,
      target.y - heading.y * reach + LOOK_HEIGHT + SHOULDER_LIFT,
      target.z - heading.z * reach
    );

    // exp form keeps the smoothing rate frame-rate independent.
    camera.position.lerp(desired, 1 - Math.exp(-FOLLOW_RATE * delta));

    lookAt.set(target.x, target.y + LOOK_HEIGHT, target.z);
    // `up` is pinned to world up rather than the body's, so the star field never
    // rolls under the player — a rolling horizon in a world with no horizon is
    // disorienting rather than dynamic.
    camera.up.set(0, 1, 0);
    camera.lookAt(lookAt);
  });

  return null;
}
