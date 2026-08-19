import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSunState } from "../../utils/time";
import { DAWN_TINT, DUSK_TINT, flatMaterial, NIGHT_TINT, NOON_TINT, PALETTE } from "./materials";
import { CEILING_HEIGHT, HALL_MAX_Z, HALL_MIN_Z } from "./layout";
import {
  createRodGeometry,
  getBulbGeometry,
  getCollarGeometry,
  getLinerGeometry,
  getRoseGeometry,
  getShadeGeometry,
  ROSE_HEIGHT,
  SHADE_NECK_Y,
} from "./pendantGeometry";

/** Where the pendant lamps hang down the aisle — a 16 pitch that ends one pitch short of the far wall. */
const PENDANT_Z = [-2, -18, -34];
const PENDANT_Y = 9.5;

/**
 * The rod, from inside the rose down to inside the collar. Both ends overlap
 * the piece they enter rather than meeting it face to face: a butt joint here
 * is two coplanar surfaces, which is a seam that flickers as the camera moves —
 * the exact failure this whole fixture was rebuilt to stop.
 */
const ROD_TOP_Y = CEILING_HEIGHT - 0.1;
const ROD_BOTTOM_Y = PENDANT_Y + SHADE_NECK_Y - 0.06;
const ROD_CENTER_Y = (ROD_TOP_Y + ROD_BOTTOM_Y) / 2;

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

  // Every lamp is the same fixture, so they share one geometry each — the rod
  // included, which is why it is built here rather than per lamp.
  const rodGeometry = useMemo(() => createRodGeometry(ROD_TOP_Y - ROD_BOTTOM_Y), []);

  const shadeMaterial = useMemo(() => flatMaterial("#5d4a37"), []);
  /**
   * The lining, seen only from below and only from inside the shade — hence
   * `BackSide`, which is also what keeps it from showing through the shade it
   * hangs inside. Emissive rather than lit: the lamp's own point light sits
   * below the rim so it doesn't wash the ceiling, which leaves nothing inside
   * the shade to light the lining, and an unlit lining reads as a dark hole
   * where the lamp should be brightest.
   */
  const linerMaterial = useMemo(
    () => flatMaterial("#8a6a45", { emissive: "#ffcf94", side: THREE.BackSide }),
    []
  );
  const bulbMaterial = useMemo(() => flatMaterial("#f6e6c0", { emissive: "#f6e6c0" }), []);
  /** The rose, the rod and the collar: one dark bronze, since they are one fitting. */
  const metalMaterial = useMemo(() => flatMaterial("#4a3f33"), []);

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
    // The lining follows the bulb but never as brightly — it is a surface
    // catching the light, not the source.
    linerMaterial.emissiveIntensity = THREE.MathUtils.lerp(0.55, 0.16, daylight);
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

      {PENDANT_Z.map((z, index) => (
        <group key={z} position={[0, 0, z]}>
          {/* The rose, sunk a little into the plaster so no seam opens between
              the two as the camera comes round. */}
          <mesh
            geometry={getRoseGeometry()}
            material={metalMaterial}
            position={[0, CEILING_HEIGHT - ROSE_HEIGHT / 2 + 0.05, 0]}
          />
          <mesh geometry={rodGeometry} material={metalMaterial} position={[0, ROD_CENTER_Y, 0]} />
          <mesh
            geometry={getCollarGeometry()}
            material={metalMaterial}
            position={[0, PENDANT_Y + SHADE_NECK_Y, 0]}
          />
          <mesh
            geometry={getShadeGeometry()}
            material={shadeMaterial}
            position={[0, PENDANT_Y, 0]}
            castShadow
          />
          <mesh geometry={getLinerGeometry()} material={linerMaterial} position={[0, PENDANT_Y, 0]} />
          <mesh geometry={getBulbGeometry()} material={bulbMaterial} position={[0, PENDANT_Y - 0.02, 0]} />
          <pointLight
            // Indexed rather than pushed: a ref callback fires again on every
            // remount, and pushing would grow this array without bound.
            ref={(node) => {
              if (node) pendantRefs.current[index] = node;
            }}
            position={[0, PENDANT_Y - 0.45, 0]}
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
