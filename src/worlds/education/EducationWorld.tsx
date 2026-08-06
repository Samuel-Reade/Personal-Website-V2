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

/** Spawn facing -Z, straight down the aisle — the same heading the outdoor world spawns on. */
const SPAWN_FACING = Math.PI;

/**
 * The education world: a library hall the player walks down, with three
 * clickable books standing in for the résumé's education entries.
 *
 * Shares the outdoor world's character controller and chase camera — this is a
 * new environment, not a new interaction system — but supplies its own collision
 * resolver and camera bounds, since neither the circular field boundary nor the
 * open-air camera makes sense inside a room.
 */
export function EducationWorld() {
  const positionRef = useRef(SPAWN_POSITION.clone());
  const facingRef = useRef(SPAWN_FACING);
  const tintRef = useRef(createInitialTint());
  const { scene } = useThree();

  const background = useMemo(() => new THREE.Color("#17141f"), []);

  useEffect(() => {
    const previous = scene.background;
    scene.background = background;
    // No fog indoors: the outdoor world's fog is tuned to dissolve a horizon
    // that doesn't exist in here, and at those distances it would just haze the
    // far end of the hall into flat grey.
    const previousFog = scene.fog;
    scene.fog = null;
    return () => {
      scene.background = previous;
      scene.fog = previousFog;
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
