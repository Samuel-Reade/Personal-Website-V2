import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { NightStars } from "../../three/NightStars";
import { HorizonDome } from "../../three/HorizonDome";
import {
  createSkyDome,
  DAY_SKY,
  DUSK_SKY,
  NIGHT_SKY,
  getGlowTexture,
  glowSpread,
  horizonFade,
  placeBody,
  SUN_DISC_RADIUS,
  SUN_GLOW_OPACITY,
} from "../../three/celestial";
import { daylight, duskAmount, getMoonState, getSunState, nightAmount } from "../../utils/time";
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

/**
 * What the day fog leans toward while the sun is low. The dome's horizon goes
 * warm as the sun drops and a fog held at the noon grey under it read as a cold
 * bank the sunset stopped at; a lean toward this — never all the way — keeps
 * the far ground in the same evening as the sky over it.
 */
/**
 * Past FOG_FAR, so both bodies opt out of the fog that would paint them flat —
 * and far past the flight band. At the old 150 the flight floor climbed above
 * the sun's own distance, and a mid-morning sun could sit visibly *below* the
 * helicopter. The discs and glows are scaled up by the same factor the distance
 * grew, so their apparent size is unchanged.
 */
const BODY_DISTANCE = 1200;
/**
 * How much bigger everything in the sky is drawn here than in the meadow,
 * which quotes the shared sun constants at 120 units out. Apparent size is
 * size over distance, so matching the meadow's sky means scaling its numbers
 * by exactly the ratio of the distances and nothing else.
 *
 * The moon was already built this way and came out right. The sun was not: it
 * stood at a 42-unit disc under a halo swelling to 336 at 0.85 opacity, where
 * the ratio asks for 26 and 140 at 0.36 — a sun half again too big inside a
 * glare two and a half times too wide, which is most of why the afternoon here
 * read as hotter than the afternoon over the field.
 */
const SKY_SCALE = BODY_DISTANCE / 120;

/**
 * Inside the camera's far plane and beyond every mountain. The sea and the
 * apron overrun this radius at their far corners, but both draw after the
 * horizon dome, which writes no depth, so the overlap never shows.
 */
const HORIZON_DOME_RADIUS = 14000;

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

  // The shared dome, on the shared atmosphere and the shared exposure — no
  // arguments, which is the point. This world used to carry a hazier, hotter
  // sky of its own (turbidity 4, mie 0.01 at g 0.85, undimmed), and against
  // the meadow's it read as a different afternoon on a different planet: a
  // white-hot band round the sun and a horizon several steps paler. The site
  // is one place at one hour, so the sky over the range is the sky over the
  // field.
  const sky = useMemo(() => createSkyDome(), []);

  useEffect(() => {
    scene.fog = new THREE.Fog(NIGHT_SKY.getHex(), FOG_NEAR, FOG_FAR);
    return () => {
      scene.fog = null;
      sky.material.dispose();
      sky.geometry.dispose();
    };
  }, [scene, sky]);

  useFrame(({ camera }) => {
    const sun = getSunState();
    const moon = getMoonState();
    const day = daylight(sun);

    placeBody(sun, 90, sunDir);
    sky.material.uniforms.sunPosition.value.copy(sunDir).normalize();

    // From the camera, not the origin. The flight band runs two hundred units
    // up, and a body twelve hundred out that is placed from the ground sits
    // nine degrees lower than its elevation says from up there — a late sun
    // was drawn *below* the horizon line while the sky was still lit by it.
    placeBody(sun, BODY_DISTANCE, sunBody).add(camera.position);
    placeBody(moon, BODY_DISTANCE, moonBody).add(camera.position);
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
      (sunGlow.current.material as THREE.SpriteMaterial).opacity = sunUp * SUN_GLOW_OPACITY;
      sunGlow.current.scale.setScalar(glowSpread(sun.trueElevation) * SKY_SCALE);
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

    // The handover runs from sunset to the end of nautical twilight, which is
    // the blue hour — see `nightAmount`.
    const night = nightAmount(sun);

    // The fog goes to night on the same schedule as the sky, not ahead of it.
    // It used to fade toward navy across the whole of `day`, so by late
    // afternoon — the sun a hand above the horizon and the Sky dome still
    // bright — the far ground was already most of the way to night: a dark
    // sheet under a light sky, cut off along a ruler at eye level. Now it holds
    // the day grey (leaning warm as the sun gets low) for as long as the Sky
    // dome is up, and only turns with the dome.
    const dusk = duskAmount(sun);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(DAY_SKY).lerp(DUSK_SKY, dusk * 0.6).lerp(NIGHT_SKY, night);

    // The horizon dome reads this same schedule and this same fog off the
    // scene itself, so there is nothing to hand it. Once it is fully opaque
    // the Sky dome behind it is only wasted fill.
    sky.visible = night < 0.999;
  });

  return (
    <>
      <primitive object={sky} />

      {/* The horizon dome: the night sky after dark, a band of haze along the
          horizon by day, and always the fog colour where the sky meets the far
          ground. Drawn before every other transparent thing (renderOrder −2)
          because it is the backdrop; depth-tested so the mountains still stand
          in front of it, and never culled because the camera always stands
          inside it. */}
      <HorizonDome radius={HORIZON_DOME_RADIUS} />

      <mesh ref={sunDisc}>
        <sphereGeometry args={[SUN_DISC_RADIUS * SKY_SCALE, 16, 16]} />
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
      {/* Pushed out with the sun and moon — a 220-unit shell would sit *below*
          the flight band, with the player looking down on the night sky. The
          field scales itself off that radius, so it is the same sky the meadow
          and the sea show, at the same apparent size. */}
      {night && <NightStars radius={3200} />}

      <hemisphereLight ref={hemi} args={["#bfe3f5", "#5a6b45", 0.6]} />
      <directionalLight ref={sunLight} color="#fff0d9" />
      <directionalLight ref={fillLight} color="#8fb0d6" />
      <directionalLight ref={moonLight} color="#cdd9f5" />
    </>
  );
}
