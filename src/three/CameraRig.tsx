import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

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
   * View pitch in radians, positive looking up, written each frame by whichever
   * controller owns the keyboard (Player, or Boat in the archipelago) — the same
   * contract `facingRef` already has. Omitted, the rig behaves exactly as it did
   * before the look keys existed.
   */
  pitchRef?: React.MutableRefObject<number>;
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
 * How the look pitch is split between swinging the boom and raising the point
 * the camera aims at.
 *
 * Most of it goes into the aim point on purpose. The aim point sits only 1.5
 * above the ground, so orbiting a 6.5-unit boom far enough to look meaningfully
 * upward would put the lens under the floor — or under the sea, in the
 * archipelago. Lifting what it looks at instead tilts the view as far as you
 * like while the camera stays safely above the world.
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
export function CameraRig({ targetRef, facingRef, bounds, pitchRef }: CameraRigProps) {
  const { camera, gl } = useThree();
  const distance = useRef(START_DISTANCE);
  const desired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  /**
   * False until the camera has been put where it belongs, which happens outright
   * on the first frame rather than by easing into it.
   *
   * `<Canvas camera={{ position }}>` starts the camera at one fixed spot per
   * world, and that spot has no idea where the character actually arrives:
   * coming back into the hall it is 28 units up the room, and returning to the
   * meadow it is clear across the ring. Easing from there is a swoop over the
   * scenery before the shot settles, which after a portal transit reads as the
   * camera hunting for the character rather than as travel. The smoothing below
   * exists to soften a pivot mid-walk — not to fly the camera in from whatever
   * framing the last world left behind.
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
    // Bound to the canvas rather than the window so scrolling an open content
    // panel doesn't also zoom the world behind it.
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [gl]);

  useFrame((_state, delta) => {
    const target = targetRef.current;
    const facing = facingRef.current;

    // The character's front is (sin, cos), so behind them is its negation.
    const backX = -Math.sin(facing);
    const backZ = -Math.cos(facing);

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

    const pitch = pitchRef?.current ?? 0;
    const pivotY = target.y + LOOK_HEIGHT;
    // Derived from the boom's length so that at pitch 0 the camera lands exactly
    // where it always did: CAMERA_HEIGHT above the character's feet.
    const basePitch = Math.atan2(CAMERA_HEIGHT - LOOK_HEIGHT, reach);
    const camPitch = basePitch - pitch * CAMERA_PITCH_SHARE;
    const horizontal = reach * Math.cos(camPitch);
    const vertical = reach * Math.sin(camPitch);

    desired.current.set(
      target.x + backX * horizontal,
      Math.max(pivotY + vertical, MIN_CAMERA_Y),
      target.z + backZ * horizontal
    );

    if (placed.current) {
      // exp form keeps the smoothing rate frame-rate independent.
      camera.position.lerp(desired.current, 1 - Math.exp(-FOLLOW_RATE * delta));
    } else {
      camera.position.copy(desired.current);
      placed.current = true;
    }

    lookAt.current.set(target.x, pivotY + pitch * AIM_LIFT, target.z);
    camera.lookAt(lookAt.current);
  });

  return null;
}
