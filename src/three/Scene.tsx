import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SkyLighting } from "./SkyLighting";
import { Ground } from "./Ground";
import { Grass } from "./Grass";
import { PathGrass } from "./PathGrass";
import { Flowers } from "./Flowers";
import { Mountains } from "./Mountains";
import { Clouds } from "./Clouds";
import { Trees } from "./Trees";
import { Sign } from "./Sign";
import { Player } from "./Player";
import { CameraRig } from "./CameraRig";
import { STANDALONE_SIGNS } from "./world";
import { getSeasonInfo } from "../utils/time";

export function Scene() {
  const positionRef = useRef(new THREE.Vector3(0, 0, 0));
  const yawRef = useRef(0);
  // Season doesn't need to be re-evaluated within a single visit.
  const season = useMemo(() => getSeasonInfo(), []);

  return (
    <>
      <SkyLighting />
      <Mountains />
      <Clouds />
      <Ground />
      <Grass playerPosRef={positionRef} />
      <PathGrass />
      <Flowers />
      <Trees season={season} />
      {STANDALONE_SIGNS.map((s) => (
        <Sign key={s.id} id={s.id} label={s.label} position={s.position} rotationY={s.rotationY} />
      ))}
      <Player positionRef={positionRef} cameraYawRef={yawRef} />
      <CameraRig targetRef={positionRef} yawRef={yawRef} />
    </>
  );
}
