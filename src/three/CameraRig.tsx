import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface CameraRigProps {
  targetRef: React.MutableRefObject<THREE.Vector3>;
  /** The character's facing, written by Player each frame. The camera sits directly behind it. */
  facingRef: React.MutableRefObject<number>;
}

const MIN_DISTANCE = 3;
const MAX_DISTANCE = 9;
const START_DISTANCE = 6.5;
/** How far above the character's feet the camera floats. */
const CAMERA_HEIGHT = 2.4;
/** Height on the character the camera aims at — roughly the shoulders. */
const LOOK_HEIGHT = 1.5;
/**
 * Exponential catch-up rate. High enough that the camera reads as rigidly
 * mounted behind the character, low enough that a fast pivot doesn't snap the
 * whole horizon across in a single frame.
 */
const FOLLOW_RATE = 12;
const ZOOM_PER_WHEEL_UNIT = 0.005;

/**
 * Third-person chase camera, locked behind the character and pointed the same
 * way they are — there is no free orbit, so the view direction is always the
 * character's own. Scroll pulls the camera in and out along that line.
 */
export function CameraRig({ targetRef, facingRef }: CameraRigProps) {
  const { camera, gl } = useThree();
  const distance = useRef(START_DISTANCE);
  const desired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());

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
    // Bound to the canvas rather than the window so scrolling an open content
    // panel doesn't also zoom the world behind it.
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [gl]);

  useFrame((_state, delta) => {
    const target = targetRef.current;
    const facing = facingRef.current;

    // The character's front is (sin, cos), so behind them is its negation.
    desired.current.set(
      target.x - Math.sin(facing) * distance.current,
      target.y + CAMERA_HEIGHT,
      target.z - Math.cos(facing) * distance.current
    );

    // exp form keeps the smoothing rate frame-rate independent.
    camera.position.lerp(desired.current, 1 - Math.exp(-FOLLOW_RATE * delta));

    lookAt.current.set(target.x, target.y + LOOK_HEIGHT, target.z);
    camera.lookAt(lookAt.current);
  });

  return null;
}
