import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { CameraRig } from "../../three/CameraRig";
import { ReturnPortal } from "../../three/ReturnPortal";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { ClearingLighting } from "./ClearingLighting";
import { Mountains } from "./Mountains";
import { Forest } from "./Forest";
import { Ocean, Streams } from "./Water";
import { Balloon } from "./Balloon";
import { Helicopter } from "./Helicopter";
import {
  BALLOONS,
  MIN_ALTITUDE,
  SPAWN_FACING,
  SPAWN_POSITION,
  nearestBalloon,
  type AssociationId,
} from "./layout";

interface ClearingSceneProps {
  onHover: (label: string | null) => void;
  /** Reports which balloon the interact key is currently aimed at, for the HUD prompt. */
  onTarget: (label: string | null) => void;
}

/**
 * Scene contents for the associations world: a mountain range running down to a
 * coast, four balloons on its summits, and a helicopter in the air above them.
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
      <Mountains />
      <Ocean />
      <Streams />
      <Forest />

      {BALLOONS.map((spot) => (
        <Balloon
          key={spot.id}
          spot={spot}
          playerPosRef={positionRef}
          onHover={onHover}
          targeted={targetId === spot.id}
        />
      ))}

      {/* Behind the spawn point, hanging in open air over the range, so turning
          around is the in-world way home. Its height comes off the flight floor
          rather than being chosen: the floor is the one altitude guaranteed to
          clear every summit in range, and a portal at a fixed height would now
          be somewhere inside a mountain.

          The trigger is wide and vertically bounded — the helicopter carries
          momentum and climbs, and an unbounded column would drop the player out
          of the world every time they passed over it. */}
      <ReturnPortal
        playerPosRef={positionRef}
        position={[0, MIN_ALTITUDE + 3.4, 34]}
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
