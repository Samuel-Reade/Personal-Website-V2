import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSunState } from "../../utils/time";
import { DAWN_TINT, DUSK_TINT, flatMaterial, NIGHT_TINT, NOON_TINT, PALETTE } from "./materials";
import { CEILING_HEIGHT, HALL_MAX_Z, HALL_MIN_Z } from "./layout";

/** Where the pendant lamps hang down the aisle. */
const PENDANT_Z = [-2, -18, -34, -50];
const PENDANT_Y = 9.5;

/**
 * Interior lighting driven by the visitor's real local clock — the same rule the
 * outdoor world follows, so walking in from the field doesn't reset the time of
 * day. `tintRef` is written here and read by `StainedGlass`, so the glass, the
 * light shafts, and the directional light all agree on one color per frame
 * rather than each recomputing it.
 */
export function LibraryLighting({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  const sunRef = useRef<THREE.DirectionalLight>(null!);
  const moonRef = useRef<THREE.DirectionalLight>(null!);
  const hemiRef = useRef<THREE.HemisphereLight>(null!);
  const pendantRefs = useRef<THREE.PointLight[]>([]);

  const sunPosition = useMemo(() => new THREE.Vector3(), []);
  const horizonTint = useMemo(() => new THREE.Color(), []);

  const shadeMaterial = useMemo(() => flatMaterial("#5d4a37"), []);
  const bulbMaterial = useMemo(() => flatMaterial("#f6e6c0", { emissive: "#f6e6c0" }), []);
  const chainMaterial = useMemo(() => flatMaterial("#4a3f33"), []);

  useFrame(() => {
    const sun = getSunState();
    const height = Math.sin(sun.elevation);
    const daylight = THREE.MathUtils.clamp(height + 0.12, 0, 1);
    // getSunState sweeps azimuth from 0 at sunrise, so a positive cosine is the
    // climbing half of the day — that's what separates dawn's tint from dusk's.
    const isMorning = Math.cos(sun.azimuth) > 0;

    horizonTint.copy(isMorning ? DAWN_TINT : DUSK_TINT);
    if (height <= 0) {
      tintRef.current.copy(NIGHT_TINT);
    } else {
      tintRef.current.copy(horizonTint).lerp(NOON_TINT, THREE.MathUtils.smoothstep(height, 0, 0.38));
    }

    const distance = 60;
    sunPosition.set(
      Math.cos(sun.elevation) * Math.sin(sun.azimuth) * distance,
      Math.max(Math.sin(sun.elevation) * distance, 2),
      Math.cos(sun.elevation) * Math.cos(sun.azimuth) * distance
    );

    if (sunRef.current) {
      sunRef.current.position.copy(sunPosition);
      sunRef.current.color.copy(tintRef.current);
      sunRef.current.intensity = THREE.MathUtils.lerp(0, 1.9, daylight);
    }
    if (moonRef.current) {
      moonRef.current.intensity = THREE.MathUtils.lerp(0.5, 0, daylight);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.lerp(0.34, 0.62, daylight);
    }
    // Lamps carry the room after dark and fade back to a token glow at midday.
    const lampStrength = THREE.MathUtils.lerp(1, 0.18, daylight);
    for (const lamp of pendantRefs.current) {
      if (lamp) lamp.intensity = lampStrength * 26;
    }
    bulbMaterial.emissiveIntensity = THREE.MathUtils.lerp(1.1, 0.35, daylight);
  });

  return (
    <>
      <ambientLight intensity={0.22} color="#e8dfd0" />
      <hemisphereLight ref={hemiRef} args={["#dfe7f2", "#6d5947", 0.45]} />

      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-bias={-0.0006}
        shadow-radius={3}
      />
      <directionalLight ref={moonRef} color={NIGHT_TINT} position={[-30, 40, 10]} intensity={0.4} />

      {PENDANT_Z.map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh material={chainMaterial} position={[0, (CEILING_HEIGHT + PENDANT_Y) / 2, 0]}>
            <boxGeometry args={[0.08, CEILING_HEIGHT - PENDANT_Y, 0.08]} />
          </mesh>
          <mesh material={shadeMaterial} position={[0, PENDANT_Y, 0]} castShadow>
            <coneGeometry args={[1.15, 0.85, 6, 1, true]} />
          </mesh>
          <mesh material={bulbMaterial} position={[0, PENDANT_Y - 0.35, 0]}>
            <sphereGeometry args={[0.24, 6, 5]} />
          </mesh>
          <pointLight
            ref={(node) => {
              if (node) pendantRefs.current.push(node);
            }}
            position={[0, PENDANT_Y - 0.5, 0]}
            color="#ffe6b8"
            distance={26}
            decay={2}
            intensity={8}
          />
        </group>
      ))}

      {/* Keeps the far end of the hall from going pitch black once the sun is
          low, without adding another shadow-casting light. */}
      <pointLight
        position={[0, 6, HALL_MIN_Z + 8]}
        color="#d8cbb4"
        distance={30}
        decay={2}
        intensity={5}
      />
      <pointLight position={[0, 6, HALL_MAX_Z - 6]} color="#d8cbb4" distance={26} decay={2} intensity={4} />
    </>
  );
}

/** Exposed so the world can seed a tint before the first frame runs. */
export function createInitialTint(): THREE.Color {
  return new THREE.Color(PALETTE.wall);
}
