import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Player } from "../../three/Player";
import { CameraRig } from "../../three/CameraRig";
import { ReturnPortal } from "../../three/ReturnPortal";
import { useLoading } from "../../state/useLoading";
import { useStore } from "../../state/useStore";
import { Hall } from "./Hall";
import { Staircases } from "./Staircases";
import { Windows } from "./Windows";
import { Centrepiece } from "./Centrepiece";
import { createInitialTint, MansionLighting } from "./MansionLighting";
import {
  CAMERA_BOUNDS,
  mansionGroundHeight,
  PORTAL_ARRIVAL_FACING,
  PORTAL_ARRIVAL_POSITION,
  PORTAL_POSITION,
  PORTAL_SCALE,
  PORTAL_TRIGGER,
  resolveMansionMove,
  SPAWN_FACING,
  SPAWN_POSITION,
} from "./layout";

/**
 * Reports the entry hall's real readiness to the loading screen.
 *
 * The three steps are ordered by when they can possibly finish: the geometry
 * exists once the scene has committed, the shaders once three has been asked to
 * compile them, and the room is genuinely on screen only after a frame has been
 * drawn. Forcing the compile here rather than letting it happen lazily is what
 * moves that cost in front of the Enter button instead of into the first second
 * of walking around.
 */
function LoadingProbe() {
  const markDone = useLoading((s) => s.markDone);
  const { gl, scene, camera } = useThree();
  const framed = useRef(false);

  useEffect(() => {
    markDone("geometry");
    gl.compile(scene, camera);
    markDone("shaders");
  }, [markDone, gl, scene, camera]);

  useFrame(() => {
    if (framed.current) return;
    framed.current = true;
    markDone("frame");
  });

  return null;
}

/**
 * Scene contents for the entry hall: the room itself plus the meadow's character
 * controller and chase camera. A new room using the existing mechanics — the
 * movement, the portal and the panel flow are all the shared ones — with its own
 * collision resolver and camera bounds, since the field's circular boundary
 * means nothing between four walls.
 */
export function MansionScene() {
  // Read once on mount rather than subscribed, the same way the meadow reads its
  // return state: this only seeds the refs below, and re-reading it mid-life
  // would fight the render loop for control of where the character is.
  const returning = useRef(useStore.getState().arrivedByPortal).current;
  const spawnFacing = returning ? PORTAL_ARRIVAL_FACING : SPAWN_FACING;

  const positionRef = useRef((returning ? PORTAL_ARRIVAL_POSITION : SPAWN_POSITION).clone());
  const facingRef = useRef(spawnFacing);
  const pitchRef = useRef(0);
  const tintRef = useRef(createInitialTint());
  const { scene } = useThree();

  // Near-black with a brown cast: what little of it shows past the walls reads
  // as unlit depth rather than as a hole in the room.
  const background = useMemo(() => new THREE.Color("#150f0b"), []);

  useEffect(() => {
    scene.background = background;
    // No fog indoors, for the same reason the library has none: the meadow's is
    // tuned to dissolve a horizon that doesn't exist in here.
    scene.fog = null;
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, background]);

  return (
    <>
      <MansionLighting tintRef={tintRef} />
      <Hall />
      <Windows tintRef={tintRef} />
      <Staircases />
      <Centrepiece />

      {/* Standing in the gap between the two flights, square to the door. The
          shared portal component: walking into it or clicking it both lead to
          the meadow, exactly as the portals in every other world do. */}
      <ReturnPortal
        playerPosRef={positionRef}
        position={PORTAL_POSITION}
        rotationY={0}
        scale={PORTAL_SCALE}
        triggerRadius={PORTAL_TRIGGER}
      />

      {/* The one world with more than one floor to stand on, so the only one
          that hands the controller a ground height. */}
      <Player
        positionRef={positionRef}
        facingRef={facingRef}
        initialFacing={spawnFacing}
        resolveMove={resolveMansionMove}
        groundHeight={mansionGroundHeight}
        pitchRef={pitchRef}
      />
      <CameraRig
        targetRef={positionRef}
        facingRef={facingRef}
        bounds={CAMERA_BOUNDS}
        pitchRef={pitchRef}
      />

      <LoadingProbe />
    </>
  );
}
