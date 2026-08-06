import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { getMoonState, getSunState } from "../../utils/time";
import { FOG_FAR, FOG_NEAR } from "./layout";
import { createSeaSky, sampleSeaSky, type SeaSky } from "./sky";

/**
 * Radius of the sky dome. Inside the camera's far plane, and well outside
 * anything the boat can reach.
 */
const DOME_RADIUS = 420;
/** How far out the sun and moon discs are placed — inside the dome, so they read against it. */
const BODY_DISTANCE = 300;

const domeVertex = /* glsl */ `
varying vec3 vDir;

void main() {
  // The dome is a unit-ish sphere centred on the origin, so its local position
  // is already the direction from the middle of the world.
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const domeFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
varying vec3 vDir;

void main() {
  // Biased low and eased so the warm band hugs the horizon instead of washing
  // halfway up the sky — a linear mix puts the horizon color at 45 degrees of
  // elevation, which reads as a gradient backdrop rather than as sky.
  float t = smoothstep(-0.04, 0.5, vDir.y);
  gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

interface SeaLightingProps {
  /** Shared with the water, which tints itself by the same sky. */
  skyRef: React.MutableRefObject<SeaSky>;
}

/**
 * Sky dome, sun/moon discs and the whole world's lighting, driven by the
 * visitor's real local clock every frame — same contract as the meadow's
 * SkyLighting, but flat-shaded pastels rather than a physical sky model.
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

  // Polled rather than read per frame: <Stars> is a whole instanced point cloud,
  // and toggling it on a boolean that only flips twice a day shouldn't cost a
  // re-render check every frame.
  const [isNight, setIsNight] = useState(() => !getSunState().isDay);
  useEffect(() => {
    const id = window.setInterval(() => setIsNight(!getSunState().isDay), 30000);
    return () => window.clearInterval(id);
  }, []);

  const domeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: THREE.BackSide,
        // The dome is the backdrop for everything; nothing is ever behind it,
        // and writing depth from a sphere this large only risks clipping.
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color("#a9c4dc") },
          uHorizon: { value: new THREE.Color("#dfe3dc") },
        },
      }),
    []
  );
  useEffect(() => () => domeMaterial.dispose(), [domeMaterial]);

  const sunPos = useMemo(() => new THREE.Vector3(), []);
  const moonPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    scene.fog = new THREE.Fog("#dfe3dc", FOG_NEAR, FOG_FAR);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame(() => {
    const sky = sampleSeaSky(skyRef.current);
    const sun = getSunState();
    const moon = getMoonState();

    sunPos.set(
      Math.cos(sun.elevation) * Math.sin(sun.azimuth),
      Math.sin(sun.elevation),
      Math.cos(sun.elevation) * Math.cos(sun.azimuth)
    );
    moonPos.set(
      Math.cos(moon.elevation) * Math.sin(moon.azimuth),
      Math.sin(moon.elevation),
      Math.cos(moon.elevation) * Math.cos(moon.azimuth)
    );

    domeMaterial.uniforms.uTop.value.copy(sky.top);
    domeMaterial.uniforms.uHorizon.value.copy(sky.horizon);
    (scene.fog as THREE.Fog).color.copy(sky.horizon);

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

    if (sunMeshRef.current) {
      sunMeshRef.current.position.copy(sunPos).multiplyScalar(BODY_DISTANCE);
      sunMeshRef.current.visible = sun.elevation > -0.12;
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.copy(moonPos).multiplyScalar(BODY_DISTANCE);
      moonMeshRef.current.visible = moon.elevation > -0.12;
    }
  });

  return (
    <>
      <mesh material={domeMaterial} renderOrder={-1000}>
        <sphereGeometry args={[DOME_RADIUS, 24, 16]} />
      </mesh>

      {/* Low segment counts so both bodies read as the same faceted language as
          the islands rather than as smooth spheres pasted on the sky. */}
      <mesh ref={sunMeshRef}>
        <sphereGeometry args={[9, 10, 8]} />
        <meshBasicMaterial color="#fff3d8" fog={false} />
      </mesh>
      <mesh ref={moonMeshRef}>
        <sphereGeometry args={[7, 10, 8]} />
        <meshBasicMaterial color="#eef1fb" fog={false} />
      </mesh>

      {isNight && <Stars radius={260} depth={70} count={2200} factor={4} fade speed={0.3} />}

      <ambientLight ref={ambientRef} />
      <hemisphereLight ref={hemiRef} args={["#cfe0ea", "#5d7183", 0.8]} />
      <directionalLight ref={keyRef} />
      <directionalLight ref={fillRef} color="#93a9c4" />
    </>
  );
}
