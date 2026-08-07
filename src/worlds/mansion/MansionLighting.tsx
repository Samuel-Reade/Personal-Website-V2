import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSunState } from "../../utils/time";
import { DAWN_TINT, DUSK_TINT, flatMaterial, NIGHT_TINT, NOON_TINT, PALETTE } from "./materials";
import {
  CEILING_HEIGHT,
  HALL_MAX_X,
  HALL_MIN_X,
  HALL_MIN_Z,
  SCONCE_Y,
  SCONCE_Z,
  TABLE_CENTER,
  WALL_THICKNESS,
} from "./layout";

/** Where the chandelier hangs — over the table, high enough to walk under. */
const CHANDELIER_Y = 9.6;
/** Resting output of the chandelier, on the same scale as the library's pendants. */
const CHANDELIER_INTENSITY = 30;
const CHANDELIER_RADIUS = 2.1;
const CANDLE_COUNT = 8;

/**
 * The flames stay warm — they are the only warm thing in the room now, and the
 * point of a white hall is that their light lands as warm pools on cool stone.
 */
const CANDLELIGHT = new THREE.Color("#ffc98a");
/**
 * Bounce off the floor. Near-white and neutral, because the floor it is
 * bouncing off is white marble; the warm brown this used to be was light the
 * room has no source for, and it turned the stone tan wherever a flame didn't
 * reach.
 */
const FLOOR_BOUNCE = new THREE.Color("#b9b8bf");

export function createInitialTint(): THREE.Color {
  return new THREE.Color().copy(NOON_TINT);
}

/**
 * A faceted iron ring of candles on a chain, and the point light it casts.
 * The light is the room's main source; everything else is fill.
 */
function Chandelier() {
  const ironMaterial = useMemo(() => flatMaterial(PALETTE.brass), []);
  const armMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);
  const candleMaterial = useMemo(
    () => flatMaterial(PALETTE.candle, { emissive: PALETTE.candle, emissiveIntensity: 1 }),
    []
  );

  const candles = useMemo(
    () =>
      Array.from({ length: CANDLE_COUNT }, (_, i) => {
        const a = (i / CANDLE_COUNT) * Math.PI * 2;
        return { x: Math.cos(a) * CHANDELIER_RADIUS, z: Math.sin(a) * CHANDELIER_RADIUS };
      }),
    []
  );

  return (
    <group position={[TABLE_CENTER[0], CHANDELIER_Y, TABLE_CENTER[1]]}>
      {/* Chain up to the ceiling. */}
      <mesh material={armMaterial} position={[0, (CEILING_HEIGHT - CHANDELIER_Y) / 2 + 0.4, 0]}>
        <cylinderGeometry args={[0.07, 0.07, CEILING_HEIGHT - CHANDELIER_Y + 0.8, 5]} />
      </mesh>

      <mesh material={ironMaterial} castShadow>
        <cylinderGeometry args={[0.42, 0.28, 0.8, 6]} />
      </mesh>
      {/* The ring, as a faceted torus. */}
      <mesh material={ironMaterial} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.35, 0]} castShadow>
        <torusGeometry args={[CHANDELIER_RADIUS, 0.1, 4, 12]} />
      </mesh>

      {candles.map(({ x, z }, i) => (
        <group key={i} position={[x, 0, z]}>
          {/* Arm out to the ring. */}
          <mesh
            material={armMaterial}
            position={[-x / 2, -0.2, -z / 2]}
            rotation={[0, -Math.atan2(z, x), 0]}
          >
            <boxGeometry args={[CHANDELIER_RADIUS, 0.09, 0.09]} />
          </mesh>
          <mesh material={ironMaterial} position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 0.14, 6]} />
          </mesh>
          <mesh material={candleMaterial} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.08, 0.09, 0.55, 6]} />
          </mesh>
          <mesh material={candleMaterial} position={[0, 0.46, 0]}>
            <coneGeometry args={[0.09, 0.24, 5]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Wall sconces: a faceted backplate, a bracket, and a lit candle. */
function Sconces() {
  const backMaterial = useMemo(() => flatMaterial(PALETTE.sconceBack), []);
  const brassMaterial = useMemo(() => flatMaterial(PALETTE.brass), []);
  const flameMaterial = useMemo(
    () => flatMaterial(PALETTE.candle, { emissive: PALETTE.candle, emissiveIntensity: 1 }),
    []
  );

  const xs = [HALL_MIN_X + WALL_THICKNESS + 0.1, HALL_MAX_X - WALL_THICKNESS - 0.1];

  return (
    <group>
      {xs.map((x, side) =>
        SCONCE_Z.map((z) => {
          const inward = side === 0 ? 1 : -1;
          return (
            <group key={`${side}-${z}`} position={[x, SCONCE_Y, z]}>
              <mesh material={backMaterial}>
                <boxGeometry args={[0.14, 1.1, 0.6]} />
              </mesh>
              <mesh material={brassMaterial} position={[inward * 0.32, -0.1, 0]}>
                <boxGeometry args={[0.6, 0.1, 0.1]} />
              </mesh>
              <mesh material={brassMaterial} position={[inward * 0.55, 0.02, 0]}>
                <cylinderGeometry args={[0.16, 0.2, 0.14, 6]} />
              </mesh>
              <mesh material={flameMaterial} position={[inward * 0.55, 0.3, 0]}>
                <cylinderGeometry args={[0.07, 0.08, 0.44, 6]} />
              </mesh>
              <mesh material={flameMaterial} position={[inward * 0.55, 0.62, 0]}>
                <coneGeometry args={[0.08, 0.22, 5]} />
              </mesh>
            </group>
          );
        })
      )}
    </group>
  );
}

/**
 * Lighting for the hall, driven by the visitor's real local clock like every
 * other world on the site — walking in from the meadow shouldn't reset the time
 * of day. What is different here is the balance: the candlelight is constant and
 * dominant, and the daylight through the windows is a fill that swings from warm
 * at dawn through cool at noon to a thin blue at night. A dark hall lit by its
 * own lamps is the point, so even at midday the windows never take over.
 *
 * `tintRef` is written here and read by `Windows`, so the glass and the light
 * agree on one colour per frame.
 */
export function MansionLighting({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  const windowLight = useRef<THREE.DirectionalLight>(null!);
  const chandelierLight = useRef<THREE.PointLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);

  const horizonTint = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const sun = getSunState();
    const height = Math.sin(sun.elevation);
    const daylight = THREE.MathUtils.clamp(height + 0.1, 0, 1);
    // getSunState sweeps azimuth from 0 at sunrise, so a positive cosine is the
    // climbing half of the day — that's what separates dawn's tint from dusk's.
    const isMorning = Math.cos(sun.azimuth) > 0;

    horizonTint.copy(isMorning ? DAWN_TINT : DUSK_TINT);
    if (height <= 0) {
      tintRef.current.copy(NIGHT_TINT);
    } else {
      tintRef.current.copy(horizonTint).lerp(NOON_TINT, THREE.MathUtils.smoothstep(height, 0, 0.35));
    }

    if (windowLight.current) {
      windowLight.current.color.copy(tintRef.current);
      // Tops out well below the library's 1.9 sun, so the room stays a
      // candlelit interior rather than turning into a daylit one at noon.
      windowLight.current.intensity = 0.18 + daylight * 0.9;
    }

    if (hemi.current) {
      hemi.current.intensity = 0.34 + daylight * 0.26;
      hemi.current.color.copy(tintRef.current);
    }

    if (chandelierLight.current) {
      // A slow, shallow flicker. Two out-of-step sines rather than randomness:
      // random jitter at frame rate reads as a fault in the renderer, where a
      // gentle wander reads as flame.
      const t = state.clock.elapsedTime;
      chandelierLight.current.intensity =
        CHANDELIER_INTENSITY + Math.sin(t * 1.7) * 0.9 + Math.sin(t * 0.63 + 1.4) * 0.6;
    }
  });

  return (
    <>
      {/* The floor the whole room sits on. Point lights fall off as 1/d² under
          three's physical lighting, so in a room this size they are effectively
          local pools — without a little flat ambient, everything more than a few
          metres from a flame goes to true black. */}
      <ambientLight intensity={0.3} color="#eeedf2" />
      <hemisphereLight ref={hemi} groundColor={FLOOR_BOUNCE} intensity={0.4} />

      {/* Daylight, angled in through the side windows. */}
      <directionalLight ref={windowLight} position={[12, 14, 6]} intensity={0.5} />

      {/* The chandelier's own light — the room's main source, calibrated against
          the library's pendants (8–26 at decay 2) rather than guessed. */}
      <pointLight
        ref={chandelierLight}
        position={[TABLE_CENTER[0], CHANDELIER_Y - 0.4, TABLE_CENTER[1]]}
        color={CANDLELIGHT}
        intensity={CHANDELIER_INTENSITY}
        distance={46}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0015}
      />

      {/* One point light per wall rather than one per sconce: six sconces
          sharing two lights is invisible at this scale and a third of the
          per-fragment cost. */}
      {[HALL_MIN_X + 2.4, HALL_MAX_X - 2.4].map((x) => (
        <pointLight
          key={x}
          position={[x, SCONCE_Y + 0.5, SCONCE_Z[1]]}
          color={CANDLELIGHT}
          intensity={11}
          distance={30}
          decay={2}
        />
      ))}

      {/* Washes the back wall and the underside of the balconies, so the gap the
          portal stands in doesn't read as a black hole between the stairs. */}
      <pointLight
        position={[0, 7, HALL_MIN_Z + 6]}
        color="#d8cfc4"
        intensity={7}
        distance={26}
        decay={2}
      />

      <Chandelier />
      <Sconces />
    </>
  );
}
