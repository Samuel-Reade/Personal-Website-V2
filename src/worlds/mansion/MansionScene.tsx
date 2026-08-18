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
  PORTAL_TRIGGER_HEIGHT,
  PORTAL_TRIGGER_REACH,
  resolveMansionMove,
  SPAWN_FACING,
  SPAWN_POSITION,
  TABLE_CENTER,
  TABLE_RADIUS,
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
 * How close to the table's centre the walker must stand for Space to open the
 * book. The table itself holds him 2.2 out — its collision circle plus his own
 * — so this reaches from its edge to about a step back from it: anyone who has
 * walked up to the table, and no one merely crossing the hall past it.
 */
const BOOK_INTERACT_RANGE = TABLE_RADIUS + 1.1;

/**
 * On the landing, beside the instrument. The height check keeps standing at
 * ground level under the balcony from counting as "at the telescope".
 */
function isAtTelescope(p: THREE.Vector3): boolean {
  return (
    Math.abs(p.y - LANDING_Y) <= 1.5 &&
    Math.hypot(p.x - TELESCOPE_X, p.z - TELESCOPE_Z) <= TELESCOPE_INTERACT_RANGE
  );
}

/**
 * At the table. No height check to match the telescope's: nothing stands over
 * or under the table, so a flat distance is the whole story.
 */
function isAtBook(p: THREE.Vector3): boolean {
  return Math.hypot(p.x - TABLE_CENTER[0], p.z - TABLE_CENTER[1]) <= BOOK_INTERACT_RANGE;
}

// Module-level so each SpaceInteract below is handed the same functions on
// every render, and read through getState at the moment they run rather than
// through a subscription that would re-render the scene.
const publishTelescopeNear = (near: boolean) => useStore.getState().setTelescopeNear(near);
const publishBookNear = (near: boolean) => useStore.getState().setBookNear(near);
const lookThroughTelescope = () => useStore.getState().openTelescope();
/** The book opens the overview — the same panel a click on it opens. */
const openBook = () => useStore.getState().openPanel("rundown");

interface SpaceInteractProps {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  /** Whether the walker is standing where Space means this. */
  isNear: (p: THREE.Vector3) => boolean;
  /**
   * Publishes range crossings to the store, where the chrome reads them to
   * raise the prompt and the scene reads them to turn the jump off.
   */
  setNear: (near: boolean) => void;
  /** What a press does. */
  interact: () => void;
}

/**
 * The interact key: Space, standing beside a thing, does what clicking it does
 * — raises the telescope's eyepiece, opens the book on the table. It is the
 * same key that opens a book in the library, an island in the bay and a
 * balloon over the range, because a visitor who has learned it once should
 * find it everywhere. Clicking still works; this is the hands-on-keys way to
 * the same place. One instance per thing, each with its own range and its own
 * flag in the store.
 */
function SpaceInteract({ positionRef, isNear, setNear, interact }: SpaceInteractProps) {
  const keys = useKeyboardState();
  /** Requires Space to be released between opens — the jump key's own guard. */
  const armed = useRef(true);
  /** Last range verdict, so the store is only written on boundary crossings. */
  const wasNear = useRef(false);

  // Leaving the hall from within range — a click on the portal does not care
  // where you stand — would otherwise strand the flag on, and with it the
  // prompt and the jump swap, for the next visit.
  useEffect(
    () => () => {
      if (wasNear.current) setNear(false);
    },
    [setNear]
  );

  useFrame(() => {
    const near = isNear(positionRef.current);

    // Published on the crossing, not per frame: this is what raises the Space
    // prompt in the chrome and turns the jump off while the key means "open".
    if (near !== wasNear.current) {
      wasNear.current = near;
      setNear(near);
    }

    if (!keys.current.jump) {
      armed.current = true;
      return;
    }
    if (!armed.current || !near) return;

    // Read non-reactively at the instant of the press, as every interact does.
    const store = useStore.getState();
    if (store.activePanel || store.telescopeOpen) return;

    armed.current = false;
    interact();
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
  // Subscribed, unlike everything below: the scene re-renders on the boundary
  // crossings so the controller's jump flag can follow the prompt. Twice per
  // visit to the telescope or the table is nothing.
  const nearTelescope = useStore((s) => s.telescopeNear);
  const nearBook = useStore((s) => s.bookNear);
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
          the meadow, exactly as the portals in every other world do. The reach
          is what lets it fire at all — the gallery's edge holds the visitor
          short of the disc, see PORTAL_TRIGGER_REACH — and the height bound is
          what keeps the gallery overhead out of the trigger, see
          PORTAL_TRIGGER_HEIGHT. */}
      <ReturnPortal
        playerPosRef={positionRef}
        position={PORTAL_POSITION}
        rotationY={0}
        scale={PORTAL_SCALE}
        triggerReach={PORTAL_TRIGGER_REACH}
        triggerHeight={PORTAL_TRIGGER_HEIGHT}
      />

      {/* The one world with more than one floor to stand on, so the only one
          that hands the controller a ground height. Space stops being jump
          within reach of the telescope or the book — there it is the interact
          key, the same swap the library makes for its books. */}
      <Player
        positionRef={positionRef}
        facingRef={facingRef}
        initialFacing={spawnFacing}
        resolveMove={resolveMansionMove}
        groundHeight={mansionGroundHeight}
        pitchRef={pitchRef}
        canJump={!nearTelescope && !nearBook}
      />
      <SpaceInteract
        positionRef={positionRef}
        isNear={isAtTelescope}
        setNear={publishTelescopeNear}
        interact={lookThroughTelescope}
      />
      <SpaceInteract
        positionRef={positionRef}
        isNear={isAtBook}
        setNear={publishBookNear}
        interact={openBook}
      />
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
