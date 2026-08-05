import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Sky as SkyImpl } from "three/examples/jsm/objects/Sky.js";
import { getSunState, getMoonState } from "../utils/time";
import { FOG_NEAR, FOG_FAR } from "./world";

const NIGHT_SKY = new THREE.Color("#1b2233");
// A distinctly blue-gray haze (rather than a near-neutral pale gray) so
// distant elements — mountains, horizon — visibly cool off with distance.
const DAY_SKY = new THREE.Color("#b9cdd6");

/** A soft radial glow sprite, generated on a canvas — used for the moon's halo. */
function createGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Sky dome, sun/moon lights, and atmospheric fog — all driven by the
 * visitor's real local clock every frame.
 */
export function SkyLighting() {
  const sunRef = useRef<THREE.DirectionalLight>(null!);
  const fillRef = useRef<THREE.DirectionalLight>(null!);
  const moonLightRef = useRef<THREE.DirectionalLight>(null!);
  const hemiRef = useRef<THREE.HemisphereLight>(null!);
  const moonMeshRef = useRef<THREE.Mesh>(null!);
  const moonGlowRef = useRef<THREE.Sprite>(null!);
  const { scene } = useThree();
  const [isNight, setIsNight] = useState(() => !getSunState().isDay);

  const sunPos = useMemo(() => new THREE.Vector3(100, 20, 0), []);
  const moonPos = useMemo(() => new THREE.Vector3(-100, -20, 0), []);
  const glowTexture = useMemo(() => createGlowTexture(), []);

  const sky = useMemo(() => {
    const s = new SkyImpl();
    s.scale.setScalar(450000);
    const u = s.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.01;
    u.mieDirectionalG.value = 0.85;
    return s;
  }, []);

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

    const dayStrength = THREE.MathUtils.clamp(Math.sin(sun.elevation) + 0.15, 0, 1);

    if (sunRef.current) {
      sunRef.current.position.copy(sunPos);
      sunRef.current.intensity = THREE.MathUtils.lerp(0, 1.7, dayStrength);
      // Golden-hour amber rather than neutral white — this is the single
      // biggest driver of the warm, glowing (vs. harsh/flat) look.
      sunRef.current.color.set("#ffd9a3");
    }
    if (fillRef.current) {
      fillRef.current.position.copy(sunPos).multiplyScalar(-1);
      fillRef.current.intensity = 0.3 * dayStrength + 0.1;
    }
    if (moonLightRef.current) {
      moonLightRef.current.position.copy(moonPos);
      moonLightRef.current.intensity = THREE.MathUtils.lerp(1.5, 0, dayStrength);
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.copy(moonPos).normalize().multiplyScalar(120);
    }
    if (moonGlowRef.current) {
      moonGlowRef.current.position.copy(moonMeshRef.current.position);
      const glowStrength = THREE.MathUtils.lerp(1, 0, dayStrength);
      (moonGlowRef.current.material as THREE.SpriteMaterial).opacity = glowStrength;
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
      <mesh ref={moonMeshRef}>
        <sphereGeometry args={[3.4, 16, 16]} />
        <meshBasicMaterial color="#fdfbf4" />
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
