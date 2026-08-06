import { useCallback, useRef } from "react";
import * as THREE from "three";
import { useStore, WORLD_BY_PORTAL, type ReturnState } from "../state/useStore";
import { SkyLighting } from "./SkyLighting";
import { Ground } from "./Ground";
import { Grass } from "./Grass";
import { Clouds } from "./Clouds";
import { Portals } from "./Portals";
import { Player } from "./Player";
import { CameraRig } from "./CameraRig";
import type { PortalSpot } from "./world";

export function Scene() {
  const enterWorld = useStore((s) => s.enterWorld);
  const openPanel = useStore((s) => s.openPanel);
  // Read once on mount rather than subscribed: this is the seed for the refs
  // below, and re-reading it mid-life would fight the render loop for control
  // of the player's position.
  const meadowReturn = useRef(useStore.getState().meadowReturn).current;

  const positionRef = useRef(new THREE.Vector3(...(meadowReturn?.position ?? [0, 0, 0])));
  // Written by Player, read by CameraRig — the camera is pinned behind whatever
  // direction the character currently faces.
  const facingRef = useRef(meadowReturn?.facing ?? 0);
  const pitchRef = useRef(0);

  const handleEnterPortal = useCallback(
    (spot: PortalSpot, from: ReturnState) => {
      const world = WORLD_BY_PORTAL[spot.id];
      // Portals whose world isn't built yet keep the original behaviour of
      // simply opening their content panel.
      if (world) enterWorld(world, from);
      else openPanel(spot.id);
    },
    [enterWorld, openPanel]
  );

  return (
    <>
      <SkyLighting />
      <Clouds />
      <Ground />
      <Grass playerPosRef={positionRef} />
      <Portals />
      <Player
        positionRef={positionRef}
        facingRef={facingRef}
        initialFacing={meadowReturn?.facing}
        pitchRef={pitchRef}
        onEnterPortal={handleEnterPortal}
      />
      <CameraRig targetRef={positionRef} facingRef={facingRef} pitchRef={pitchRef} />
    </>
  );
}
