import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { FlightCameraRig } from "./FlightCameraRig";
import { ReturnPortal } from "../../three/ReturnPortal";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { ClearingLighting } from "./ClearingLighting";
import { Mountains } from "./Mountains";
import { Forest } from "./Forest";
import { Groundcover } from "./Groundcover";
import { Ocean, Streams } from "./Water";
import { Balloon } from "./Balloon";
import { DistantBalloons } from "./DistantBalloons";
import { Mansion } from "./Mansion";
import { Gondola } from "./Gondola";
import { Helicopter } from "./Helicopter";
import {
  BALLOONS,
  PORTAL_POSITION,
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
 * interaction system: the return portal and the content panel are the shared
 * ones, and only the things that genuinely differ — an aircraft instead of a
 * walker, a camera that follows a 3D heading, an interact key — are local.
 */
export function ClearingScene({ onHover, onTarget }: ClearingSceneProps) {
  const positionRef = useRef(SPAWN_POSITION.clone());
  const facingRef = useRef(SPAWN_FACING);
  const pitchRef = useRef(0);
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
    useStore.getState().openEntry("extracurriculars", near.org);
  });

  return (
    <>
      <ClearingLighting />
      <Mountains />
      <Ocean />
      <Streams />
      <Forest />
      <Groundcover />

      {/* Scenery: four more flying together far beyond the range, which is what
          puts a sense of scale on the sky the four real ones hang in. */}
      <DistantBalloons />

      {/* And the house on the summit north of the arena, with the tramway that
          serves it. Both are scenery too — there is no way to land on that peak
          and nothing to do there — but they are what turns the range from
          country into somewhere people are. */}
      <Mansion />
      <Gondola />

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
          around is the in-world way home — and far enough behind that it is
          behind the chase camera too, not just the aircraft, so arriving does
          not mean looking back through the swirl you came out of (see
          PORTAL_DISTANCE). Its height is the balloons': the middle of their
          ladder, so it hangs level with them rather than sunk below them at
          the flight floor — and, like theirs, it comes off the floor rather
          than being a fixed number, since a fixed height would now be
          somewhere inside a mountain.

          The trigger is wide and vertically bounded — the helicopter carries
          momentum and climbs, and an unbounded column would drop the player out
          of the world every time they passed over it.

          Faced back toward the arena, where the player always is — at 0 it
          faced the open sea, and the only side of the label anyone could ever
          see was the back, mirrored. */}
      <ReturnPortal
        playerPosRef={positionRef}
        position={PORTAL_POSITION}
        rotationY={Math.PI}
        scale={1.15}
        triggerRadius={2.6}
        triggerHeight={3.2}
      />

      <Helicopter positionRef={positionRef} facingRef={facingRef} pitchRef={pitchRef} />
      {/* The space world's rig, not the walkers': it trails the full 3D heading
          and looks at the machine every frame, which is what keeps the
          helicopter centred on screen however it is aimed. */}
      <FlightCameraRig targetRef={positionRef} facingRef={facingRef} pitchRef={pitchRef} />
    </>
  );
}
