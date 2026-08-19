import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { elevationFraction, getMoonState, getSunState } from "../../utils/time";
import {
  createSkyDome,
  getGlowTexture,
  horizonFade,
  placeBody,
  SUN_DISC_RADIUS,
  SUN_GLOW_OPACITY,
  SUN_GLOW_TIGHT,
  SUN_GLOW_WIDE,
} from "../../three/celestial";
import { NightStars } from "../../three/NightStars";
import { HorizonDome } from "../../three/HorizonDome";
import { FOG_FAR, FOG_NEAR } from "./layout";
import { createSeaSky, sampleSeaSky, type SeaSky } from "./sky";

/** How far out the sun and moon discs are placed. */
const BODY_DISTANCE = 300;
/**
 * Apparent-size scale against the meadow, which quotes the shared sun
 * constants at 120 units out — see the same constant in the range's lighting.
 * The bodies here stood at a 9-unit sun under a halo swelling to 120, where
 * the ratio asks for 6.5 and 35: a sun and a glare half again too big for the
 * sky they now share.
 */
const SKY_SCALE = BODY_DISTANCE / 120;

/**
 * The horizon haze, and the night it fades to. Both the meadow's own values:
 * this world draws the meadow's dome now, so it has to resolve to the meadow's
 * horizon or the sea would meet the sky in a colour the sky never reaches.
 */
const NIGHT_SKY = new THREE.Color("#1b2233");
const DAY_SKY = new THREE.Color("#b9cdd6");

interface SeaLightingProps {
  /** Shared with the water, which tints itself by the same sky. */
  skyRef: React.MutableRefObject<SeaSky>;
}

/**
 * Sky dome, sun/moon discs and the whole world's lighting, driven by the
 * visitor's real local clock every frame — the same contract as the meadow's
 * SkyLighting, and now the same sky.
 *
 * It used to be a two-stop gradient dome of its own, keyframed from the sun's
 * elevation in `sky.ts`. It was a good backdrop and it was not the site's sky:
 * rowing out of the portal put you under a different atmosphere from the one
 * you had just been standing in, warmer and flatter, with the horizon a
 * different grey. The dome is the shared one now. What stays keyframed is
 * everything the *sea* needs — the key light's colour and strength, the
 * ambient and hemisphere levels, and the tint multiplied into the water — so
 * the water still warms at sunset under a sky that warms with it.
 *
 * There are no shadow maps in here, matching the office and library: the light
 * is a broad even wash, and the faceted geometry already implies its own form.
 */
export function SeaLighting({ skyRef }: SeaLightingProps) {
  const { scene } = useThree();

  const keyRef = useRef<THREE.DirectionalLight>(null!);
  const fillRef = useRef<THREE.DirectionalLight>(null!);
  const ambientRef = useRef<THREE.AmbientLight>(null!);
  const hemiRef = useRef<THREE.HemisphereLight>(null!);
  const sunMeshRef = useRef<THREE.Mesh>(null!);
  const moonMeshRef = useRef<THREE.Mesh>(null!);
  const sunGlowRef = useRef<THREE.Sprite>(null!);
  const moonGlowRef = useRef<THREE.Sprite>(null!);
  const glowTexture = useMemo(() => getGlowTexture(), []);

  // Polled rather than read per frame: <Stars> is a whole instanced point cloud,
  // and toggling it on a boolean that only flips twice a day shouldn't cost a
  // re-render check every frame.
  const [isNight, setIsNight] = useState(() => !getSunState().isDay);
  useEffect(() => {
    const id = window.setInterval(() => setIsNight(!getSunState().isDay), 30000);
    return () => window.clearInterval(id);
  }, []);

  // The shared dome, on the shared atmosphere and exposure — the meadow's sky,
  // because it is the same sky. Named for the object rather than `sky`, which
  // in the frame loop below means this world's sampled lighting state.
  const skyDome = useMemo(() => createSkyDome(), []);
  useEffect(
    () => () => {
      skyDome.material.dispose();
      skyDome.geometry.dispose();
    },
    [skyDome]
  );

  const sunPos = useMemo(() => new THREE.Vector3(), []);
  const moonPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    scene.fog = new THREE.Fog(NIGHT_SKY.getHex(), FOG_NEAR, FOG_FAR);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame(() => {
    const sky = sampleSeaSky(skyRef.current);
    const sun = getSunState();
    const moon = getMoonState();

    // Unit directions, shared by the lights below and scaled out to
    // BODY_DISTANCE for the discs — the same arc the meadow traces, so rowing
    // out of a portal never moves the sun.
    placeBody(sun, 1, sunPos);
    placeBody(moon, 1, moonPos);

    skyDome.material.uniforms.sunPosition.value.copy(sunPos);

    // The same curve the meadow drives its haze on, so the two horizons arrive
    // at the same grey at the same hour.
    const dayStrength = THREE.MathUtils.clamp(elevationFraction(sun.elevation) + 0.15, 0, 1);
    // Guarded rather than cast: the effect that installs the fog runs after the
    // first commit, and nothing guarantees it beats the first frame here.
    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(NIGHT_SKY).lerp(DAY_SKY, dayStrength);

    // The key light follows whichever body is actually up, so the sea is lit
    // from the moon's side of the sky after dark rather than from a sun that
    // has set. One light doing both jobs keeps the shading direction unambiguous.
    const keySource = sun.isDay ? sunPos : moonPos;
    if (keyRef.current) {
      keyRef.current.position.copy(keySource).multiplyScalar(60);
      keyRef.current.color.copy(sky.keyLight);
      keyRef.current.intensity = sky.keyIntensity;
    }
    if (fillRef.current) {
      // Opposite the key and much weaker — just enough to keep the shadowed
      // side of an island off pure black.
      fillRef.current.position.copy(keySource).multiplyScalar(-45);
      fillRef.current.intensity = 0.2;
    }
    if (ambientRef.current) ambientRef.current.intensity = sky.ambientIntensity;
    if (hemiRef.current) hemiRef.current.intensity = sky.hemiIntensity;

    // Faded through the horizon rather than switched at it: a hard `visible`
    // toggle pops a nine-unit disc out of existence in one frame, right at the
    // moment of the day the player is most likely to be looking at it.
    const sunUp = horizonFade(sun.elevation);
    const moonUp = horizonFade(moon.elevation);

    if (sunMeshRef.current) {
      sunMeshRef.current.position.copy(sunPos).multiplyScalar(BODY_DISTANCE);
      sunMeshRef.current.visible = sunUp > 0.01;
      (sunMeshRef.current.material as THREE.MeshBasicMaterial).opacity = sunUp;
    }
    if (sunGlowRef.current) {
      sunGlowRef.current.position.copy(sunPos).multiplyScalar(BODY_DISTANCE);
      sunGlowRef.current.visible = sunUp > 0.01;
      (sunGlowRef.current.material as THREE.SpriteMaterial).opacity = sunUp * SUN_GLOW_OPACITY;
      // Widest at the horizon, tightest overhead — the meadow's halo, scaled.
      sunGlowRef.current.scale.setScalar(
        THREE.MathUtils.lerp(SUN_GLOW_WIDE, SUN_GLOW_TIGHT, dayStrength) * SKY_SCALE
      );
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.copy(moonPos).multiplyScalar(BODY_DISTANCE);
      moonMeshRef.current.visible = moonUp > 0.01;
      (moonMeshRef.current.material as THREE.MeshBasicMaterial).opacity = moonUp;
    }
    if (moonGlowRef.current) {
      moonGlowRef.current.position.copy(moonPos).multiplyScalar(BODY_DISTANCE);
      moonGlowRef.current.visible = moonUp > 0.01;
      (moonGlowRef.current.material as THREE.SpriteMaterial).opacity = moonUp;
      moonGlowRef.current.scale.setScalar(
        THREE.MathUtils.lerp(26, 18, dayStrength) * SKY_SCALE
      );
    }
  });

  return (
    <>
      <primitive object={skyDome} />

      {/* Low segment counts so both bodies read as the same faceted language as
          the islands rather than as smooth spheres pasted on the sky. Their
          sizes are the meadow's, scaled by how much further out they stand. */}
      <mesh ref={sunMeshRef}>
        <sphereGeometry args={[SUN_DISC_RADIUS * SKY_SCALE, 10, 8]} />
        <meshBasicMaterial color="#fff3d8" fog={false} transparent depthWrite={false} />
      </mesh>
      <mesh ref={moonMeshRef}>
        <sphereGeometry args={[3.4 * SKY_SCALE, 10, 8]} />
        <meshBasicMaterial color="#eef1fb" fog={false} transparent depthWrite={false} />
      </mesh>

      {/* Halos, drawn after the discs so they read as light around a body rather
          than as a disc sitting on a smudge. */}
      <sprite ref={sunGlowRef} renderOrder={1}>
        <spriteMaterial map={glowTexture} transparent depthWrite={false} fog={false} color="#ffe4b3" />
      </sprite>
      <sprite ref={moonGlowRef} renderOrder={1}>
        <spriteMaterial map={glowTexture} transparent depthWrite={false} fog={false} color="#e6ecff" />
      </sprite>

      {/* The night sky and the daytime haze band, on this world's own fog
          colours — the same treatment the meadow and the range get. Outside
          the bodies at 300 (plus however far the boat has rowed from the
          middle) and inside the camera's 600 far plane. */}
      <HorizonDome radius={520} />

      {/* The site's one night sky — the same field, at the same apparent size,
          as the meadow and the range show. */}
      {isNight && <NightStars radius={260} />}

      <ambientLight ref={ambientRef} />
      <hemisphereLight ref={hemiRef} args={["#cfe0ea", "#5d7183", 0.8]} />
      <directionalLight ref={keyRef} />
      <directionalLight ref={fillRef} color="#93a9c4" />
    </>
  );
}
