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
interface SpaceSceneProps {
  onHover: (label: string | null) => void;
  /**
   * Index into SHELLS of the ring selected in the HUD legend, or null. Owned by
   * the world above rather than in here, because the legend that sets it is HTML
   * chrome outside the Canvas.
   */
  selectedShell: number | null;
}

export function SpaceScene({ onHover, selectedShell }: SpaceSceneProps) {
  const position = useRef(new THREE.Vector3(...SPAWN_POSITION));
  const facing = useRef(SPAWN_FACING);
  const pitch = useRef(0);

  // Wide enough that a player carrying the full 8 units/sec doesn't step clean
  // over the trigger between frames, and bounded vertically so that flying high
  // above the portal on the way out to an outer shell isn't treated as entering
  // it — see `triggerHeight` in ReturnPortal.
  const portalTrigger = useMemo(() => ({ radius: 2.6, height: 2.6 }), []);

  // The extruded marks and the planet map are module-level caches shared by
  // every chip, so they outlive this component unless it cleans them up. Leaving
  // them would leak a texture and every mark's geometry on each visit.
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
      <Shells onHover={onHover} selectedShell={selectedShell} />

      <Astronaut positionRef={position} facingRef={facing} pitchRef={pitch} />
      <SpaceCameraRig targetRef={position} facingRef={facing} pitchRef={pitch} />

      <ReturnPortal
        playerPosRef={position}
        position={RETURN_PORTAL_POSITION}
        rotationY={0}
        triggerRadius={portalTrigger.radius}
        triggerHeight={portalTrigger.height}
      />
    </>
  );
}
