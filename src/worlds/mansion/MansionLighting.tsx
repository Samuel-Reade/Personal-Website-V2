import { useEffect, useMemo, useRef } from "react";
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
 * The chandelier: two tiers of candles on scrolled brass arms around a turned
 * central column, hung from the ceiling on a chain of links under a canopy,
 * with a drop of glass under each lower arm and a larger one under the
 * finial. The point light it casts is the room's main source; everything
 * else is fill.
 *
 * It was a single ring on eight straight spokes on a rod, which read as a
 * wagon wheel. What makes a chandelier a chandelier is the things a wheel
 * doesn't have — the arms curving out and up, the column they spring from,
 * the second tier, the chain — and each is here at the hall's faceting: a
 * scroll is a tube along one bezier with five sides, a link is a torus with
 * six, a drop is an octahedron.
 */
function Chandelier() {
  const brassMaterial = useMemo(() => flatMaterial(PALETTE.brass), []);
  const bronzeMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);
  const candleMaterial = useMemo(
    () => flatMaterial(PALETTE.candle, { emissive: PALETTE.candle, emissiveIntensity: 1 }),
    []
  );
  // Glass, catching the candlelight: a little emissive, so the drops read
  // as bright points rather than grey beads.
  const glassMaterial = useMemo(
    () => flatMaterial("#e4ebf2", { emissive: "#b8c9da", emissiveIntensity: 0.4 }),
    []
  );

  /** [radius of the tier, height of the arm root on the column, candles on it]. */
  const tiers = useMemo<[number, number, number][]>(
    () => [
      [CHANDELIER_RADIUS, -0.05, 12],
      [CHANDELIER_RADIUS * 0.58, 0.72, 6],
    ],
    []
  );

  /**
   * One scrolled arm, as a tube along a cubic bezier in the arm's own x–y
   * plane: out and down from the column, then sweeping up to the candle cup.
   * Every arm shares the shape; only its yaw and its tier's radius differ.
   */
  const armGeometries = useMemo(
    () =>
      tiers.map(([radius]) => {
        const curve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(0.22, 0, 0),
          new THREE.Vector3(radius * 0.45, -0.55, 0),
          new THREE.Vector3(radius * 0.85, -0.5, 0),
          new THREE.Vector3(radius, -0.12, 0)
        );
        return new THREE.TubeGeometry(curve, 10, 0.038, 5, false);
      }),
    [tiers]
  );

  /** Chain links from the canopy down to the top of the column. */
  const chainLength = CEILING_HEIGHT - CHANDELIER_Y - 1.1;
  const links = useMemo(() => {
    const pitch = 0.2;
    const count = Math.floor(chainLength / pitch);
    return Array.from({ length: count }, (_, i) => ({
      y: 1.1 + pitch * (i + 0.5),
      // Alternate links turn through a right angle, as a chain hangs.
      turn: (i % 2) * (Math.PI / 2),
    }));
  }, [chainLength]);

  useEffect(() => () => armGeometries.forEach((g) => g.dispose()), [armGeometries]);

  return (
    <group position={[TABLE_CENTER[0], CHANDELIER_Y, TABLE_CENTER[1]]}>
      {/* Canopy on the ceiling, and the chain out of it. */}
      <mesh material={brassMaterial} position={[0, CEILING_HEIGHT - CHANDELIER_Y - 0.14, 0]}>
        <cylinderGeometry args={[0.16, 0.5, 0.28, 8]} />
      </mesh>
      {links.map(({ y, turn }, i) => (
        <mesh key={i} material={bronzeMaterial} position={[0, y, 0]} rotation={[0, turn, 0]}>
          <torusGeometry args={[0.1, 0.024, 6, 8]} />
        </mesh>
      ))}

      {/* The column: a knop under the chain, a turned shaft, the dish the
          arms spring from, and a finial with its drop. */}
      <mesh material={brassMaterial} position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.13, 8, 6]} />
      </mesh>
      <mesh material={brassMaterial} position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.07, 0.11, 0.44, 8]} />
      </mesh>
      <mesh material={brassMaterial} position={[0, 0.44, 0]}>
        <cylinderGeometry args={[0.2, 0.12, 0.14, 8]} />
      </mesh>
      <mesh material={brassMaterial} position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.1, 0.13, 0.36, 8]} />
      </mesh>
      <mesh material={brassMaterial} castShadow>
        <cylinderGeometry args={[0.36, 0.24, 0.32, 8]} />
      </mesh>
      <mesh material={brassMaterial} position={[0, -0.36, 0]}>
        <cylinderGeometry args={[0.24, 0.1, 0.42, 8]} />
      </mesh>
      <mesh material={brassMaterial} position={[0, -0.66, 0]}>
        <sphereGeometry args={[0.12, 8, 6]} />
      </mesh>
      <mesh material={glassMaterial} position={[0, -0.98, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
      </mesh>

      {tiers.map(([radius, rootY, count], tier) => (
        <group key={tier} position={[0, rootY, 0]}>
          {/* The ring the cups stand on, at the height the arms arrive. */}
          <mesh material={bronzeMaterial} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} castShadow>
            <torusGeometry args={[radius, 0.045, 5, count * 2]} />
          </mesh>

          {Array.from({ length: count }, (_, i) => {
            const a = (i / count) * Math.PI * 2 + (tier === 1 ? Math.PI / count : 0);
            return (
              <group key={i} rotation={[0, -a, 0]}>
                {/* The arm, scrolling out from the column. */}
                <mesh geometry={armGeometries[tier]} material={brassMaterial} castShadow />
                {/* Drip pan, socket, candle, flame. */}
                <mesh material={brassMaterial} position={[radius, -0.12, 0]}>
                  <cylinderGeometry args={[0.15, 0.09, 0.05, 6]} />
                </mesh>
                <mesh material={brassMaterial} position={[radius, -0.03, 0]}>
                  <cylinderGeometry args={[0.07, 0.085, 0.13, 6]} />
                </mesh>
                <mesh material={candleMaterial} position={[radius, 0.24, 0]}>
                  <cylinderGeometry args={[0.058, 0.064, 0.44, 6]} />
                </mesh>
                <mesh material={candleMaterial} position={[radius, 0.55, 0]}>
                  <coneGeometry args={[0.062, 0.2, 5]} />
                </mesh>
                {/* A drop of glass under every lower arm, between the cups. */}
                {tier === 0 && (
                  <group rotation={[0, Math.PI / count, 0]}>
                    <mesh material={bronzeMaterial} position={[radius, -0.32, 0]}>
                      <cylinderGeometry args={[0.008, 0.008, 0.26, 4]} />
                    </mesh>
                    <mesh material={glassMaterial} position={[radius, -0.5, 0]}>
                      <octahedronGeometry args={[0.075, 0]} />
                    </mesh>
                  </group>
                )}
              </group>
            );
          })}
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

  // On the face of the pilaster each one hangs from (see Pilasters in
  // Hall.tsx: centred 0.35 inside the wall face, a hexagonal shaft about 0.62
  // to its flat), with the backplate's own half-thickness clear of it.
  const xs = [
    HALL_MIN_X + WALL_THICKNESS / 2 + 0.35 + 0.62 + 0.07,
    HALL_MAX_X - WALL_THICKNESS / 2 - 0.35 - 0.62 - 0.07,
  ];

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

      {/* Washes the back wall and the underside of the gallery, so the bay the
          portal stands in doesn't read as a black hole between the stairs.

          This used to hang at y = 7 and throw down through the gap between two
          separate balconies. There is no gap any more — the gallery runs the
          full width at 5.4 — so from up there it now lights the top of the slab
          and leaves everything beneath it unlit. It belongs under the gallery,
          which is the side the visitor walks on. */}
      <pointLight
        position={[0, 3.4, HALL_MIN_Z + 7]}
        color="#d8cfc4"
        intensity={8}
        distance={28}
        decay={2}
      />

      {/* And one right under the slab, close to the back wall. The bay is three
          metres deep and roofed now, so the wash above cannot reach the far
          corners of it at any useful angle — this is what keeps the soffit, the
          stair undersides and the wall behind the portal off true black. */}
      <pointLight
        position={[0, 3, HALL_MIN_Z + 2.4]}
        color="#cfc7bd"
        intensity={7}
        distance={22}
        decay={2}
      />

      <Chandelier />
      <Sconces />
    </>
  );
}
