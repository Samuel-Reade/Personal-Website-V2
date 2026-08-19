import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { CameraRig } from "../../three/CameraRig";
import { ReturnPortal } from "../../three/ReturnPortal";
import { SeaLighting } from "./SeaLighting";
import { DistantClearing } from "./DistantClearing";
import { Water } from "./Water";
import { Wake } from "./Wake";
import { Boat } from "./Boat";
import { Island } from "./Island";
import {
  ISLANDS,
  SPAWN_FACING,
  SPAWN_POSITION,
  nearestIsland,
  type CenterpieceId,
} from "./layout";
import { createSeaSky } from "./sky";

interface ArchipelagoSceneProps {
  onHover: (label: string | null) => void;
  /** Reports which island the interact key is currently aimed at, for the HUD prompt. */
  onTarget: (label: string | null) => void;
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
export function ArchipelagoScene({ onHover, onTarget }: ArchipelagoSceneProps) {
  const positionRef = useRef(SPAWN_POSITION.clone());
  const facingRef = useRef(SPAWN_FACING);
  const speedRef = useRef(0);
  const pitchRef = useRef(0);
  // Written by SeaLighting each frame and read by the water, so both take their
  // colour from one sample of the clock rather than sampling it twice.
  const skyRef = useRef(createSeaSky());

  const keys = useKeyboardState();
  const [targetId, setTargetId] = useState<CenterpieceId | null>(null);
  /**
   * Requires Space to be released between opens, so holding it down doesn't
   * reopen the panel on the frame after it is closed — the same guard the
   * balloons use in `associations/ClearingScene.tsx`.
   */
  const interactArmed = useRef(true);

  useFrame(() => {
    const near = nearestIsland(positionRef.current);
    const id = near?.id ?? null;
    if (id !== targetId) {
      setTargetId(id);
      onTarget(near?.label ?? null);
    }

    // Read non-reactively: subscribing here would re-render the scene on every
    // panel open, and the guard only needs the value at the instant of the press.
    // Checked before the re-arm below, not after: while a panel is up Space
    // belongs to it, and an interact that armed itself underneath would read
    // the press that closes the card as a fresh open on the very next frame.
    if (useStore.getState().activePanel) {
      interactArmed.current = false;
      return;
    }
    if (!keys.current.jump) {
      interactArmed.current = true;
      return;
    }
    if (!interactArmed.current || !near) return;

    interactArmed.current = false;
    useStore.getState().openEntry("projects", near.project);
  });

  return (
    <>
      <SeaLighting skyRef={skyRef} />
      {/* The associations island, far off between the factory and the ballot. */}
      <DistantClearing />
      <Water skyRef={skyRef} playerPosRef={positionRef} />
      <Wake positionRef={positionRef} facingRef={facingRef} speedRef={speedRef} />

      {ISLANDS.map((spot) => (
        <Island
          key={spot.id}
          spot={spot}
          playerPosRef={positionRef}
          onHover={onHover}
          targeted={targetId === spot.id}
        />
      ))}

      {/* Astern of spawn in open water — the nearest island is 31 out, so this
          stretch is clear. Facing -Z, back toward spawn, so the boat meets it
          head-on after coming about. The trigger is wide because the boat
          carries momentum and a tight circle can be stepped clean over between
          two frames. */}
      <ReturnPortal
        playerPosRef={positionRef}
        position={[0, 2.4, 16]}
        scale={1.15}
        triggerRadius={2.4}
      />

      <Boat positionRef={positionRef} facingRef={facingRef} speedRef={speedRef} pitchRef={pitchRef} />
      <CameraRig targetRef={positionRef} facingRef={facingRef} pitchRef={pitchRef} />
    </>
  );
}
