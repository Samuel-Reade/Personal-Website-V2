import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ReturnPortal } from "../../three/ReturnPortal";
import { Astronaut } from "./Astronaut";
import { BlackHole } from "./BlackHole";
import { DistantPlanets, MainPlanet } from "./Planets";
import { Shells } from "./Shells";
import { SpaceCameraRig } from "./SpaceCameraRig";
import { SpaceLighting } from "./SpaceLighting";
import { Starfield } from "./Starfield";
import { disposeLogoGeometries } from "./logoGeometry";
import { disposePlanetTexture } from "./planetTexture";
import { RETURN_PORTAL_POSITION, SPAWN_FACING, SPAWN_POSITION } from "./layout";

/**
 * Everything inside the tech-stack world's Canvas.
 *
 * The astronaut writes its position, heading and pitch into refs that the camera
 * reads — the same contract `Player` has with `CameraRig` everywhere else on the
 * site, so the chase camera behaves consistently even though both halves of it
 * are new here.
 */
export function SpaceScene({ onHover }: { onHover: (label: string | null) => void }) {
  const position = useRef(new THREE.Vector3(...SPAWN_POSITION));
  const facing = useRef(SPAWN_FACING);
  const pitch = useRef(0);

  // The portal has to be reachable by flying into it, and the trigger is a
  // horizontal-distance test, so a wide radius keeps a player carrying the full
  // 8 units/sec from stepping straight over it between frames.
  const portalTrigger = useMemo(() => 2.6, []);

  // The extruded marks and the planet map are module-level caches shared by
  // every chip, so they outlive this component unless it cleans them up. Leaving
  // them would leak a texture and twenty-one geometries on each visit.
  useEffect(
    () => () => {
      disposeLogoGeometries();
      disposePlanetTexture();
    },
    []
  );

  return (
    <>
      {/* No fog: fog is depth-cued against a lit background, and against black
          it just dims everything uniformly toward the void it already is. */}
      <color attach="background" args={["#05060f"]} />

      <SpaceLighting />
      <Starfield />
      <BlackHole />
      <DistantPlanets />

      <MainPlanet />
      <Shells onHover={onHover} />

      <Astronaut positionRef={position} facingRef={facing} pitchRef={pitch} />
      <SpaceCameraRig targetRef={position} facingRef={facing} pitchRef={pitch} />

      <ReturnPortal
        playerPosRef={position}
        position={RETURN_PORTAL_POSITION}
        rotationY={0}
        triggerRadius={portalTrigger}
      />
    </>
  );
}
