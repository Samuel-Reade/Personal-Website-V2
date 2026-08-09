import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Sky as SkyImpl } from "three/examples/jsm/objects/Sky.js";
import { getGlowTexture, horizonFade, placeBody } from "../../three/celestial";
import { elevationFraction, getMoonState, getSunState } from "../../utils/time";
import { FOG_FAR, FOG_NEAR } from "./layout";

/**
 * Sky, sun, moon and fog over the clearing, on the visitor's own clock.
 *
 * This is an outdoor world, so it runs the same clock as the meadow and the
 * archipelago — `utils/time.ts` for the hour, `three/celestial.ts` for where the
 * body sits and how it fades through the horizon. A hilltop that was always
 * mid-afternoon would be the one outdoor scene on the site that ignores what
 * time it is.
 */

const NIGHT_SKY = new THREE.Color("#1b2233");
/**
 * Matched to the Sky dome's own hazy horizon rather than to a generic daylight
 * blue. The fog is what the horizon is made of now — the apron and the sea both
 * resolve to this colour at distance — so any gap between it and the sky's
 * horizon tint would draw a seam exactly where the fade is supposed to be
 * seamless.
 */
const DAY_SKY = new THREE.Color("#c6d4dc");
/**
 * Past FOG_FAR, so both bodies opt out of the fog that would paint them flat —
 * and far past the flight band. At the old 150 the flight floor climbed above
 * the sun's own distance, and a mid-morning sun could sit visibly *below* the
 * helicopter. The discs and glows are scaled up by the same factor the distance
 * grew, so their apparent size is unchanged.
 */
const BODY_DISTANCE = 1200;

export function ClearingLighting() {
  const { scene } = useThree();
  const sunLight = useRef<THREE.DirectionalLight>(null!);
  const fillLight = useRef<THREE.DirectionalLight>(null!);
  const moonLight = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const sunDisc = useRef<THREE.Mesh>(null!);
  const sunGlow = useRef<THREE.Sprite>(null!);
  const moonDisc = useRef<THREE.Mesh>(null!);
  const moonGlow = useRef<THREE.Sprite>(null!);

  const glow = useMemo(() => getGlowTexture(), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);
  const sunBody = useMemo(() => new THREE.Vector3(), []);
  const moonBody = useMemo(() => new THREE.Vector3(), []);

  // Read once: this only decides whether the star field is mounted, and nobody
  // flies here long enough to cross dusk.
  const night = useMemo(() => !getSunState().isDay, []);

  const sky = useMemo(() => {
    const dome = new SkyImpl();
    dome.scale.setScalar(450000);
    const u = dome.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.01;
    u.mieDirectionalG.value = 0.85;
    return dome;
  }, []);

  useEffect(() => {
    scene.fog = new THREE.Fog(NIGHT_SKY.getHex(), FOG_NEAR, FOG_FAR);
    return () => {
      scene.fog = null;
      sky.material.dispose();
      sky.geometry.dispose();
    };
  }, [scene, sky]);

  useFrame(() => {
    const sun = getSunState();
    const moon = getMoonState();
    const day = THREE.MathUtils.clamp(elevationFraction(sun.elevation) + 0.15, 0, 1);

    placeBody(sun, 90, sunDir);
    sky.material.uniforms.sunPosition.value.copy(sunDir).normalize();

    placeBody(sun, BODY_DISTANCE, sunBody);
    placeBody(moon, BODY_DISTANCE, moonBody);
    const sunUp = horizonFade(sun.elevation);
    const moonUp = horizonFade(moon.elevation);

    if (sunLight.current) {
      sunLight.current.position.copy(sunDir);
      sunLight.current.intensity = THREE.MathUtils.lerp(0, 1.65, day);
    }
    if (fillLight.current) {
      fillLight.current.position.copy(sunDir).multiplyScalar(-1);
      fillLight.current.intensity = 0.28 * day + 0.1;
    }
    if (moonLight.current) {
      moonLight.current.position.copy(moonBody);
      // Generous, as in the meadow: an honest moon leaves four balloons as four
      // silhouettes, and the emblems are the entire point of them.
      moonLight.current.intensity = THREE.MathUtils.lerp(1.45, 0, day);
    }
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.lerp(0.55, 0.9, day);

    if (sunDisc.current) {
      sunDisc.current.position.copy(sunBody);
      sunDisc.current.visible = sunUp > 0.01;
      (sunDisc.current.material as THREE.MeshBasicMaterial).opacity = sunUp;
    }
    if (sunGlow.current) {
      sunGlow.current.position.copy(sunBody);
      sunGlow.current.visible = sunUp > 0.01;
      (sunGlow.current.material as THREE.SpriteMaterial).opacity = sunUp * 0.85;
      sunGlow.current.scale.setScalar(THREE.MathUtils.lerp(336, 224, day));
    }
    if (moonDisc.current) {
      moonDisc.current.position.copy(moonBody);
      moonDisc.current.visible = moonUp > 0.01;
      (moonDisc.current.material as THREE.MeshBasicMaterial).opacity = moonUp;
    }
    if (moonGlow.current) {
      moonGlow.current.position.copy(moonBody);
      moonGlow.current.visible = moonUp > 0.01;
      (moonGlow.current.material as THREE.SpriteMaterial).opacity = moonUp;
      moonGlow.current.scale.setScalar(THREE.MathUtils.lerp(256, 176, day));
    }

    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(NIGHT_SKY).lerp(DAY_SKY, day);
  });

  return (
    <>
      <primitive object={sky} />

      <mesh ref={sunDisc}>
        <sphereGeometry args={[42, 16, 16]} />
        <meshBasicMaterial color="#fff6de" fog={false} transparent depthWrite={false} />
      </mesh>
      <sprite ref={sunGlow} renderOrder={1}>
        <spriteMaterial map={glow} transparent depthWrite={false} fog={false} color="#ffe9bd" />
      </sprite>
      <mesh ref={moonDisc}>
        <sphereGeometry args={[34, 14, 14]} />
        <meshBasicMaterial color="#fdfbf4" fog={false} transparent depthWrite={false} />
      </mesh>
      <sprite ref={moonGlow} renderOrder={1}>
        <spriteMaterial map={glow} transparent depthWrite={false} fog={false} color="#eef2ff" />
      </sprite>

      {/* Pushed out with the sun and moon — a 220-unit star shell would now sit
          *below* the flight band, with the player looking down on the night sky. */}
      {night && <Stars radius={3200} depth={600} count={2400} factor={40} fade speed={0.4} />}

      <hemisphereLight ref={hemi} args={["#bfe3f5", "#5a6b45", 0.6]} />
      <directionalLight ref={sunLight} color="#fff0d9" />
      <directionalLight ref={fillLight} color="#8fb0d6" />
      <directionalLight ref={moonLight} color="#cdd9f5" />
    </>
  );
}
