import { useRef } from "react";
import * as THREE from "three";
import { CameraRig } from "../../three/CameraRig";
import { SeaLighting } from "./SeaLighting";
import { Water } from "./Water";
import { Wake } from "./Wake";
import { Boat } from "./Boat";
import { Island } from "./Island";
import { ISLANDS, SPAWN_FACING, SPAWN_POSITION } from "./layout";
import { createSeaSky } from "./sky";

interface ArchipelagoSceneProps {
  onHover: (label: string | null) => void;
}

/**
 * Scene contents for the archipelago: the sea and sky plus the boat and the
 * meadow's chase camera. Like the library this is a new environment, not a new
 * interaction system — the camera and the panel flow are the shared ones, and
 * only the things that genuinely differ (an avatar that floats, a movement model
 * with inertia) are local to this world.
 *
 * No camera bounds are passed: the library needs them because a chase camera in
 * a room backs through the wall, but out here there is nothing behind the boat
 * for the camera to clip into.
 */
export function ArchipelagoScene({ onHover }: ArchipelagoSceneProps) {
  const positionRef = useRef(SPAWN_POSITION.clone());
  const facingRef = useRef(SPAWN_FACING);
  const speedRef = useRef(0);
  // Written by SeaLighting each frame and read by the water, so both take their
  // colour from one sample of the clock rather than sampling it twice.
  const skyRef = useRef(createSeaSky());

  return (
    <>
      <SeaLighting skyRef={skyRef} />
      <Water skyRef={skyRef} />
      <Wake positionRef={positionRef} facingRef={facingRef} speedRef={speedRef} />

      {ISLANDS.map((spot) => (
        <Island key={spot.id} spot={spot} playerPosRef={positionRef} onHover={onHover} />
      ))}

      <Boat positionRef={positionRef} facingRef={facingRef} speedRef={speedRef} />
      <CameraRig targetRef={positionRef} facingRef={facingRef} />
    </>
  );
}
