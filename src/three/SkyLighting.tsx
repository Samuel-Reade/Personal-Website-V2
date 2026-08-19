import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { elevationFraction, getSunState, getMoonState } from "../utils/time";
import {
  createSkyDome,
  SUN_DISC_RADIUS,
  SUN_GLOW_OPACITY,
  SUN_GLOW_TIGHT,
  SUN_GLOW_WIDE,
  getGlowTexture,
  horizonFade,
  placeBody,
} from "./celestial";
import { FOG_NEAR, FOG_FAR } from "./world";

const NIGHT_SKY = new THREE.Color("#1b2233");
// A distinctly blue-gray haze (rather than a near-neutral pale gray) so
// distant elements — mountains, horizon — visibly cool off with distance.
const DAY_SKY = new THREE.Color("#b9cdd6");

/**
 * How far out the sun and moon discs sit. Past FOG_FAR, so both carry
 * `fog={false}` — otherwise the haze paints them out to flat horizon colour,
 * which is how the moon used to be hidden by day: not by intent, but because
 * the fog happened to swallow it.
 */
const BODY_DISTANCE = 120;

/**
 * Sky dome, sun/moon lights, and atmospheric fog — all driven by the
 * visitor's real local clock every frame.
 */
export function SkyLighting() {
  const sunRef = useRef<THREE.DirectionalLight>(null!);
  const fillRef = useRef<THREE.DirectionalLight>(null!);
  const moonLightRef = useRef<THREE.DirectionalLight>(null!);
  const hemiRef = useRef<THREE.HemisphereLight>(null!);
  const sunMeshRef = useRef<THREE.Mesh>(null!);
  const sunGlowRef = useRef<THREE.Sprite>(null!);
  const moonMeshRef = useRef<THREE.Mesh>(null!);
  const moonGlowRef = useRef<THREE.Sprite>(null!);
  const { scene } = useThree();
  const [isNight, setIsNight] = useState(() => !getSunState().isDay);

  const sunPos = useMemo(() => new THREE.Vector3(100, 20, 0), []);
  const moonPos = useMemo(() => new THREE.Vector3(-100, -20, 0), []);
  const sunBody = useMemo(() => new THREE.Vector3(), []);
  const moonBody = useMemo(() => new THREE.Vector3(), []);
  const glowTexture = useMemo(() => getGlowTexture(), []);

  // The dome, with the site's atmosphere and its own exposure — see
  // `createSkyDome` for why the sky is dimmed on its own rather than the frame.
  const sky = useMemo(() => createSkyDome(), []);

  useEffect(() => {
    scene.fog = new THREE.Fog(NIGHT_SKY.getHex(), FOG_NEAR, FOG_FAR);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useEffect(() => {
    const id = window.setInterval(() => setIsNight(!getSunState().isDay), 30000);
    return () => window.clearInterval(id);
  }, []);

  useFrame(() => {
    const sun = getSunState();
    const moon = getMoonState();
    const dist = 80;

    sunPos.set(
      Math.cos(sun.elevation) * Math.sin(sun.azimuth) * dist,
      Math.sin(sun.elevation) * dist,
      Math.cos(sun.elevation) * Math.cos(sun.azimuth) * dist
    );
    moonPos.set(
      Math.cos(moon.elevation) * Math.sin(moon.azimuth) * dist,
      Math.sin(moon.elevation) * dist,
      Math.cos(moon.elevation) * Math.cos(moon.azimuth) * dist
    );

    sky.material.uniforms.sunPosition.value.copy(sunPos).normalize();

    const dayStrength = THREE.MathUtils.clamp(elevationFraction(sun.elevation) + 0.15, 0, 1);

    if (sunRef.current) {
      sunRef.current.position.copy(sunPos);
      sunRef.current.intensity = THREE.MathUtils.lerp(0, 1.7, dayStrength);
      // A gentle warm gold rather than neutral white — enough to give a
      // golden-hour glow without crushing blue so hard that muted natural
      // greens (grass, foliage) shift all the way to olive/khaki once
      // multiplied through (a more saturated amber like #ffd9a3 did
      // exactly that: fine on neutral-gray materials, but visibly wrong
      // on the greens making up most of the scene).
      sunRef.current.color.set("#fff0d9");
    }
    if (fillRef.current) {
      fillRef.current.position.copy(sunPos).multiplyScalar(-1);
      fillRef.current.intensity = 0.3 * dayStrength + 0.1;
    }
    if (moonLightRef.current) {
      moonLightRef.current.position.copy(moonPos);
      moonLightRef.current.intensity = THREE.MathUtils.lerp(1.5, 0, dayStrength);
    }
    // Both discs are placed off their own state, so each is up exactly while its
    // own elevation is above the horizon rather than being inferred from the
    // other's. They cross the sky on opposite arcs: sunrise at +Z, noon near the
    // zenith, sunset at -Z, with the moon half a day behind.
    const sunUp = horizonFade(sun.elevation);
    const moonUp = horizonFade(moon.elevation);

    placeBody(sun, BODY_DISTANCE, sunBody);
    placeBody(moon, BODY_DISTANCE, moonBody);

    if (sunMeshRef.current) {
      sunMeshRef.current.position.copy(sunBody);
      sunMeshRef.current.visible = sunUp > 0.01;
      (sunMeshRef.current.material as THREE.MeshBasicMaterial).opacity = sunUp;
    }
    if (sunGlowRef.current) {
      sunGlowRef.current.position.copy(sunBody);
      sunGlowRef.current.visible = sunUp > 0.01;
      (sunGlowRef.current.material as THREE.SpriteMaterial).opacity = sunUp * SUN_GLOW_OPACITY;
      // Swollen near the horizon and tight overhead, which is what sells a low
      // sun as low without moving anything.
      sunGlowRef.current.scale.setScalar(
        THREE.MathUtils.lerp(SUN_GLOW_WIDE, SUN_GLOW_TIGHT, dayStrength)
      );
    }

    if (moonMeshRef.current) {
      moonMeshRef.current.position.copy(moonBody);
      moonMeshRef.current.visible = moonUp > 0.01;
      (moonMeshRef.current.material as THREE.MeshBasicMaterial).opacity = moonUp;
    }
    if (moonGlowRef.current) {
      moonGlowRef.current.position.copy(moonBody);
      moonGlowRef.current.visible = moonUp > 0.01;
      (moonGlowRef.current.material as THREE.SpriteMaterial).opacity = moonUp;
      moonGlowRef.current.scale.setScalar(THREE.MathUtils.lerp(26, 18, dayStrength));
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.lerp(0.5, 0.95, dayStrength);
    }

    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.color.copy(NIGHT_SKY).lerp(DAY_SKY, dayStrength);
    }
    scene.background = null;
  });

  return (
    <>
      <primitive object={sky} />

      {/* Sun. Sits inside the sky shader's own bright spot at the same bearing,
          giving that soft bloom a hard edge to belong to. `fog={false}` on both
          bodies because they stand well past FOG_FAR — fogged, they would render
          as flat horizon colour at every hour. */}
      <mesh ref={sunMeshRef}>
        <sphereGeometry args={[SUN_DISC_RADIUS, 20, 20]} />
        <meshBasicMaterial color="#fff6de" fog={false} transparent depthWrite={false} />
      </mesh>
      <sprite ref={sunGlowRef} renderOrder={1}>
        <spriteMaterial map={glowTexture} transparent depthWrite={false} fog={false} color="#ffe9bd" />
      </sprite>

      <mesh ref={moonMeshRef}>
        <sphereGeometry args={[3.4, 16, 16]} />
        <meshBasicMaterial color="#fdfbf4" fog={false} transparent depthWrite={false} />
      </mesh>
      <sprite ref={moonGlowRef} renderOrder={1}>
        <spriteMaterial map={glowTexture} transparent depthWrite={false} fog={false} color="#eef2ff" />
      </sprite>
      {isNight && <Stars radius={200} depth={60} count={2500} factor={3} fade speed={0.4} />}
      <hemisphereLight ref={hemiRef} args={["#bfe3f5", "#5a6b45", 0.5]} />
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
        shadow-radius={4}
      />
      <directionalLight ref={fillRef} color="#8fb0d6" />
      <directionalLight ref={moonLightRef} color="#cdd9f5" />
    </>
  );
}
