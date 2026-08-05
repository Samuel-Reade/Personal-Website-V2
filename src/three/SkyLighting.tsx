import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Sky as SkyImpl } from "three/examples/jsm/objects/Sky.js";
import { getSunState, getMoonState } from "../utils/time";

const NIGHT_SKY = new THREE.Color("#1b2233");
const DAY_SKY = new THREE.Color("#dce6e2");

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
  const { scene } = useThree();
  const [isNight, setIsNight] = useState(() => !getSunState().isDay);

  const sunPos = useMemo(() => new THREE.Vector3(100, 20, 0), []);
  const moonPos = useMemo(() => new THREE.Vector3(-100, -20, 0), []);

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
    scene.fog = new THREE.Fog(NIGHT_SKY.getHex(), 22, 75);
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
      sunRef.current.color.set("#fff1d8");
    }
    if (fillRef.current) {
      fillRef.current.position.copy(sunPos).multiplyScalar(-1);
      fillRef.current.intensity = 0.3 * dayStrength + 0.1;
    }
    if (moonLightRef.current) {
      moonLightRef.current.position.copy(moonPos);
      moonLightRef.current.intensity = THREE.MathUtils.lerp(0.5, 0, dayStrength);
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.copy(moonPos).normalize().multiplyScalar(120);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.lerp(0.3, 0.85, dayStrength);
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
        <sphereGeometry args={[3, 16, 16]} />
        <meshBasicMaterial color="#eef1f5" />
      </mesh>
      {isNight && <Stars radius={200} depth={60} count={2500} factor={3} fade speed={0.4} />}
      <hemisphereLight ref={hemiRef} args={["#cfe3e8", "#4c5a3f", 0.5]} />
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
      />
      <directionalLight ref={fillRef} color="#8fb0d6" />
      <directionalLight ref={moonLightRef} color="#a9c0e8" />
    </>
  );
}
