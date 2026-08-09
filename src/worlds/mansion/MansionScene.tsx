import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Player } from "../../three/Player";
import { CameraRig } from "../../three/CameraRig";
import { ReturnPortal } from "../../three/ReturnPortal";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { useLoading } from "../../state/useLoading";
import { useStore } from "../../state/useStore";
import { Hall } from "./Hall";
import { Staircases } from "./Staircases";
import { Windows } from "./Windows";
import { Centrepiece } from "./Centrepiece";
import { Outside } from "./Outside";
import { ConnectSign } from "./ConnectSign";
import { createInitialTint, MansionLighting } from "./MansionLighting";
import {
  CAMERA_BOUNDS,
  isOutside,
  LANDING_Y,
  mansionGroundHeight,
  OUTSIDE_CAMERA_BOUNDS,
  PORTAL_ARRIVAL_FACING,
  PORTAL_ARRIVAL_POSITION,
  PORTAL_POSITION,
  PORTAL_SCALE,
  PORTAL_TRIGGER,
  PORTAL_TRIGGER_HEIGHT,
  resolveMansionMove,
  SPAWN_FACING,
  SPAWN_POSITION,
  TELESCOPE_X,
  TELESCOPE_Z,
} from "./layout";

/**
 * How close the walker must stand for Space to raise the eyepiece. Generous
 * enough to catch anyone who has clearly walked up to the instrument, tight
 * enough that Space at the balcony door still means nothing.
 */
const TELESCOPE_INTERACT_RANGE = 2.6;

/**
 * The interact key at the telescope: Space, standing beside it, raises the
 * eyepiece — the same key that opens a book in the library, an island in the
 * bay and a balloon over the range, because a visitor who has learned it once
 * should find it everywhere. Clicking the instrument still works; this is the
 * hands-on-keys way to the same place.
 */
function TelescopeInteract({
  positionRef,
}: {
  positionRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const keys = useKeyboardState();
  /** Requires Space to be released between opens — the jump key's own guard. */
  const armed = useRef(true);

  useFrame(() => {
    if (!keys.current.jump) {
      armed.current = true;
      return;
    }
    if (!armed.current) return;

    const p = positionRef.current;
    // On the landing, beside the instrument — the height check keeps a Space
    // press at ground level under the balcony from opening a view the player
    // can't see the telescope of.
    if (Math.abs(p.y - LANDING_Y) > 1.5) return;
    if (Math.hypot(p.x - TELESCOPE_X, p.z - TELESCOPE_Z) > TELESCOPE_INTERACT_RANGE) return;

    // Read non-reactively at the instant of the press, as every interact does.
    const store = useStore.getState();
    if (store.activePanel || store.telescopeOpen) return;

    armed.current = false;
    store.openTelescope();
  });

  return null;
}

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
/**
 * Keeps the camera's box on the same side of the back wall as the visitor.
 *
 * `CameraRig` reads `bounds` afresh every frame, so handing it one object and
 * rewriting its fields is enough — no re-render, and nothing downstream has to
 * know the box can change. Mounted above the rig so this frame's swap has
 * already happened by the time the rig reads it.
 */
function CameraBoundsSwitch({
  positionRef,
  bounds,
}: {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}) {
  useFrame(() => {
    const box = isOutside(positionRef.current.z) ? OUTSIDE_CAMERA_BOUNDS : CAMERA_BOUNDS;
    bounds.minX = box.minX;
    bounds.maxX = box.maxX;
    bounds.minZ = box.minZ;
    bounds.maxZ = box.maxZ;
  });
  return null;
}

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
  // Mutated in place by CameraBoundsSwitch below rather than replaced, so the
  // rig can be handed one stable object for the life of the world.
  const cameraBounds = useRef({ ...CAMERA_BOUNDS }).current;
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

      {/* Through the doorway at the head of the stair: the balcony, the cliff it
          stands on, and the sea. The sign naming it hangs on the inside face of
          the wall, where it can actually be read on the way to it. */}
      <Outside tintRef={tintRef} />
      <ConnectSign />

      {/* Standing in the gap between the two flights, square to the door. The
          shared portal component: walking into it or clicking it both lead to
          the meadow, exactly as the portals in every other world do. The height
          bound is what keeps the gallery overhead out of the trigger — see
          PORTAL_TRIGGER_HEIGHT. */}
      <ReturnPortal
        playerPosRef={positionRef}
        position={PORTAL_POSITION}
        rotationY={0}
        scale={PORTAL_SCALE}
        triggerRadius={PORTAL_TRIGGER}
        triggerHeight={PORTAL_TRIGGER_HEIGHT}
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
      <TelescopeInteract positionRef={positionRef} />
      <CameraBoundsSwitch positionRef={positionRef} bounds={cameraBounds} />
      <CameraRig
        targetRef={positionRef}
        facingRef={facingRef}
        bounds={cameraBounds}
        pitchRef={pitchRef}
      />

      <LoadingProbe />
    </>
  );
}
