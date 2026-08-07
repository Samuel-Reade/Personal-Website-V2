import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { CameraRig } from "../../three/CameraRig";
import { ReturnPortal } from "../../three/ReturnPortal";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { ClearingLighting } from "./ClearingLighting";
import { Clearing } from "./Clearing";
import { Balloon } from "./Balloon";
import { Helicopter } from "./Helicopter";
import { BALLOONS, SPAWN_FACING, SPAWN_POSITION, nearestBalloon, type AssociationId } from "./layout";

interface ClearingSceneProps {
  onHover: (label: string | null) => void;
  /** Reports which balloon the interact key is currently aimed at, for the HUD prompt. */
  onTarget: (label: string | null) => void;
}

/**
 * Scene contents for the associations clearing.
 *
 * Like every world past the meadow this is a new environment rather than a new
 * interaction system: the chase camera, the return portal and the content panel
 * are the shared ones, and only the things that genuinely differ — an aircraft
 * instead of a walker, an altitude axis, an interact key — are local.
 */
export function ClearingScene({ onHover, onTarget }: ClearingSceneProps) {
  const positionRef = useRef(SPAWN_POSITION.clone());
  const facingRef = useRef(SPAWN_FACING);
  const keys = useKeyboardState();

  const [targetId, setTargetId] = useState<AssociationId | null>(null);
  /**
   * Requires Space to be released between opens, so holding it down doesn't
   * reopen the panel on the frame after it is closed — the same guard the jump
   * key uses in `three/Player.tsx`.
   */
  const interactArmed = useRef(true);

  // Leaving with a balloon still hovered would strand the cursor as a pointer.
  useEffect(
    () => () => {
      document.body.style.cursor = "default";
    },
    []
  );

  useFrame(() => {
    const near = nearestBalloon(positionRef.current);
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
    useStore.getState().openEntry("extracurriculars", near.org);
  });

  return (
    <>
      <ClearingLighting />
      <Clearing />

      {BALLOONS.map((spot) => (
        <Balloon
          key={spot.id}
          spot={spot}
          playerPosRef={positionRef}
          onHover={onHover}
          targeted={targetId === spot.id}
        />
      ))}

      {/* Behind the spawn point, out over the slope, so turning around is the
          in-world way home. Its trigger is wide and vertically bounded: the
          helicopter carries momentum and climbs, and an unbounded column would
          drop the player out of the world every time they overflew it. */}
      <ReturnPortal
        playerPosRef={positionRef}
        position={[0, 5.2, 34]}
        rotationY={0}
        scale={1.15}
        triggerRadius={2.6}
        triggerHeight={3.2}
      />

      <Helicopter positionRef={positionRef} facingRef={facingRef} />
      <CameraRig targetRef={positionRef} facingRef={facingRef} />
    </>
  );
}
