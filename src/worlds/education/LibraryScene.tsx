import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { Player } from "../../three/Player";
import { CameraRig } from "../../three/CameraRig";
import { ReturnPortal } from "../../three/ReturnPortal";
import { Hall } from "./Hall";
import { StainedGlass } from "./StainedGlass";
import { Shelves } from "./Shelves";
import { Tables } from "./Tables";
import { FloatingBook } from "./FloatingBook";
import { createInitialTint, LibraryLighting } from "./LibraryLighting";
import {
  BOOK_SPOTS,
  CAMERA_BOUNDS,
  RETURN_PORTAL_POSITION,
  RETURN_PORTAL_SCALE,
  resolveLibraryMove,
  nearestBook,
  SPAWN_POSITION,
  type EducationId,
} from "./layout";

/** Spawn facing -Z, straight down the aisle — the same heading the meadow spawns on. */
const SPAWN_FACING = Math.PI;

interface LibrarySceneProps {
  /** Reports which book the interact key is currently aimed at, for the HUD prompt. */
  onTarget: (label: string | null) => void;
}

/**
 * Scene contents for the library: the hall itself plus the meadow's character
 * controller and chase camera. This is a new environment, not a new interaction
 * system, so movement and the panel flow are the shared ones — but it supplies
 * its own collision resolver and camera bounds, since neither the field's
 * circular boundary nor an unbounded camera makes sense inside a room.
 */
export function LibraryScene({ onTarget }: LibrarySceneProps) {
  const positionRef = useRef(SPAWN_POSITION.clone());
  const facingRef = useRef(SPAWN_FACING);
  const pitchRef = useRef(0);
  const tintRef = useRef(createInitialTint());
  const { scene } = useThree();

  const keys = useKeyboardState();
  const [targetId, setTargetId] = useState<EducationId | null>(null);
  /**
   * Requires Space to be released between opens, so holding it down doesn't
   * reopen the panel on the frame after it is closed — the same guard the
   * balloons use in `associations/ClearingScene.tsx`.
   */
  const interactArmed = useRef(true);

  const background = useMemo(() => new THREE.Color("#17141f"), []);

  useEffect(() => {
    scene.background = background;
    // No fog indoors: the meadow's fog is tuned to dissolve a horizon that
    // doesn't exist in here, and at those distances it would only haze the far
    // end of the hall into flat grey.
    scene.fog = null;
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, background]);

  useFrame(() => {
    const near = nearestBook(positionRef.current);
    const id = near?.id ?? null;
    if (id !== targetId) {
      setTargetId(id);
      onTarget(near?.label ?? null);
    }

    if (!keys.current.jump) {
      interactArmed.current = true;
      return;
    }
    if (!interactArmed.current || !near) return;
    // Read non-reactively: subscribing here would re-render the scene on every
    // panel open, and the guard only needs the value at the instant of the press.
    if (useStore.getState().activePanel) return;

    interactArmed.current = false;
    useStore.getState().openEntry("education", near.entryKey);
  });

  return (
    <>
      <LibraryLighting tintRef={tintRef} />
      <Hall />
      <StainedGlass tintRef={tintRef} />
      <Shelves />
      <Tables />
      {BOOK_SPOTS.map((spot) => (
        <FloatingBook
          key={spot.id}
          spot={spot}
          playerPosRef={positionRef}
          targeted={targetId === spot.id}
        />
      ))}
      {/* Faces -Z, back down the aisle, so its label reads to a player who has
          turned around to leave. */}
      <ReturnPortal
        playerPosRef={positionRef}
        position={RETURN_PORTAL_POSITION}
        scale={RETURN_PORTAL_SCALE}
      />
      {/* Space opens the book you are standing at in here, so it cannot also be
          the jump key — see `canJump` in `three/Player.tsx`. */}
      <Player
        positionRef={positionRef}
        facingRef={facingRef}
        initialFacing={SPAWN_FACING}
        resolveMove={resolveLibraryMove}
        pitchRef={pitchRef}
        outfit="graduate"
        canJump={false}
      />
      <CameraRig targetRef={positionRef} facingRef={facingRef} bounds={CAMERA_BOUNDS} pitchRef={pitchRef} />
    </>
  );
}
