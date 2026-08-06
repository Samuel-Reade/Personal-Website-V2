import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { LookState } from "../hooks/useCursorLook";

export interface CameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface CameraRigProps {
  targetRef: React.MutableRefObject<THREE.Vector3>;
  /** The character's facing, written by Player each frame. The camera sits directly behind it. */
  facingRef: React.MutableRefObject<number>;
  /**
   * Optional walls to keep the camera inside. Only interior worlds need this —
   * outdoors the camera can hang in open air behind the character, but in a
   * room it would otherwise back straight through the wall and render the
   * interior from outside.
   */
  bounds?: CameraBounds;
  /**
   * Cursor-driven look offset from `useCursorLook`, shared with the character so
   * the head and the view agree. Omitted, the rig behaves exactly as it did
   * before free look existed.
   */
  lookRef?: React.MutableRefObject<LookState>;
}

/** How far along the backward ray we can travel before leaving a slab, or Infinity if parallel to it. */
function slabLimit(origin: number, direction: number, min: number, max: number): number {
  if (Math.abs(direction) < 1e-6) return Infinity;
  return direction > 0 ? (max - origin) / direction : (min - origin) / direction;
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
 * How the cursor's pitch is split between swinging the camera and raising the
 * point it aims at.
 *
 * Almost all of it goes into the aim point on purpose. Orbiting a 6.5-unit boom
 * far enough to look meaningfully upward would bury the camera: the aim point
 * sits only 1.5 above the ground, so anything past about 9 degrees of downward
 * swing puts the lens underneath the floor — or under the sea, in the
 * archipelago. Lifting what it looks at instead tilts the view as far as you
 * like with the camera staying safely above the world.
 */
const CAMERA_PITCH_SHARE = 0.35;
const AIM_LIFT = 5.5;
/** Hard floor for the camera, below which it would be inside the ground or the water. */
const MIN_CAMERA_Y = 0.5;

/**
 * Third-person chase camera, locked behind the character and pointed the same
 * way they are — there is no free orbit, so the view direction is always the
 * character's own. Scroll pulls the camera in and out along that line.
 */
export function CameraRig({ targetRef, facingRef, bounds, lookRef }: CameraRigProps) {
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
    const lookYaw = lookRef?.current.yaw ?? 0;
    const lookPitch = lookRef?.current.pitch ?? 0;
    // The cursor swings the boom around the character without turning the
    // character themselves — the arrow keys still own the body's heading.
    const yaw = facingRef.current + lookYaw;

    // The character's front is (sin, cos), so behind them is its negation.
    const backX = -Math.sin(yaw);
    const backZ = -Math.cos(yaw);

    let reach = distance.current;
    if (bounds) {
      // Shorten the boom rather than clamping the camera's position: clamping
      // would slide the camera sideways along the wall and swing the view off
      // the character, whereas pulling in keeps it directly behind them.
      reach = Math.min(
        reach,
        slabLimit(target.x, backX, bounds.minX, bounds.maxX),
        slabLimit(target.z, backZ, bounds.minZ, bounds.maxZ)
      );
      reach = Math.max(reach, MIN_DISTANCE * 0.4);
    }

    const pivotY = target.y + LOOK_HEIGHT;
    // Derived from the boom's length so that at rest the camera lands exactly
    // where it always did: CAMERA_HEIGHT above the character's feet.
    const basePitch = Math.atan2(CAMERA_HEIGHT - LOOK_HEIGHT, reach);
    const camPitch = basePitch - lookPitch * CAMERA_PITCH_SHARE;
    const horizontal = reach * Math.cos(camPitch);
    const vertical = reach * Math.sin(camPitch);

    desired.current.set(
      target.x + backX * horizontal,
      Math.max(pivotY + vertical, MIN_CAMERA_Y),
      target.z + backZ * horizontal
    );

    // exp form keeps the smoothing rate frame-rate independent.
    camera.position.lerp(desired.current, 1 - Math.exp(-FOLLOW_RATE * delta));

    lookAt.current.set(target.x, pivotY + lookPitch * AIM_LIFT, target.z);
    camera.lookAt(lookAt.current);
  });

  return null;
}
