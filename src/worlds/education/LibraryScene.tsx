import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Player } from "../../three/Player";
import { CameraRig } from "../../three/CameraRig";
import { Hall } from "./Hall";
import { StainedGlass } from "./StainedGlass";
import { Shelves } from "./Shelves";
import { Tables } from "./Tables";
import { FloatingBook } from "./FloatingBook";
import { createInitialTint, LibraryLighting } from "./LibraryLighting";
import { BOOK_SPOTS, CAMERA_BOUNDS, resolveLibraryMove, SPAWN_POSITION } from "./layout";

/** Spawn facing -Z, straight down the aisle — the same heading the meadow spawns on. */
const SPAWN_FACING = Math.PI;

/**
 * Scene contents for the library: the hall itself plus the meadow's character
 * controller and chase camera. This is a new environment, not a new interaction
 * system, so movement and the panel flow are the shared ones — but it supplies
 * its own collision resolver and camera bounds, since neither the field's
 * circular boundary nor an unbounded camera makes sense inside a room.
 */
export function LibraryScene() {
  const positionRef = useRef(SPAWN_POSITION.clone());
  const facingRef = useRef(SPAWN_FACING);
  const tintRef = useRef(createInitialTint());
  const { scene } = useThree();

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

  return (
    <>
      <LibraryLighting tintRef={tintRef} />
      <Hall />
      <StainedGlass tintRef={tintRef} />
      <Shelves />
      <Tables />
      {BOOK_SPOTS.map((spot) => (
        <FloatingBook key={spot.id} spot={spot} playerPosRef={positionRef} />
      ))}
      <Player
        positionRef={positionRef}
        facingRef={facingRef}
        initialFacing={SPAWN_FACING}
        resolveMove={resolveLibraryMove}
      />
      <CameraRig targetRef={positionRef} facingRef={facingRef} bounds={CAMERA_BOUNDS} />
    </>
  );
}
