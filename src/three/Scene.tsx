import { useRef } from "react";
import * as THREE from "three";
import { SkyLighting } from "./SkyLighting";
import { Ground } from "./Ground";
import { Grass } from "./Grass";
import { Mountains } from "./Mountains";
import { Clouds } from "./Clouds";
import { Portals } from "./Portals";
import { Player } from "./Player";
import { CameraRig } from "./CameraRig";

export function Scene() {
  const positionRef = useRef(new THREE.Vector3(0, 0, 0));
  // Written by Player, read by CameraRig — the camera is pinned behind whatever
  // direction the character currently faces.
  const facingRef = useRef(0);

  return (
    <>
      <SkyLighting />
      <Mountains />
      <Clouds />
      <Ground />
      <Grass playerPosRef={positionRef} />
      <Portals />
      <Player positionRef={positionRef} facingRef={facingRef} />
      <CameraRig targetRef={positionRef} facingRef={facingRef} />
    </>
  );
}
