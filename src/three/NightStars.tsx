import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The night sky over every outdoor world on the site.
 *
 * One field, shared: the meadow, the archipelago, the range and the loading
 * backdrop all mount this same component, and because the positions come from a
 * fixed seed rather than `Math.random()`, they are not merely similar skies —
 * they are the *same* sky. The constellation overhead in the meadow is the
 * constellation overhead on the water and over the mountains, at the same
 * bearing, because the site is one place at one hour and the worlds are rooms
 * in it. Four hand-tuned `<Stars>` calls used to stand here — 200 to 3200
 * units, factor 3 to 40, four counts — and they read as four different nights.
 *
 * (The tech-stack system keeps its own `techstack/Starfield`: you are out
 * *among* those stars rather than under them, and it needs a shell you fly
 * through rather than a dome overhead.)
 */

/** Deterministic pseudo-random in [0, 1) — the sky is identical on every visit. */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const STAR_COUNT = 2600;

/**
 * The radius the field's sizes and thickness are quoted at. A world mounting
 * this at a different radius gets everything scaled by the ratio, so the sky
 * subtends the same angle whether it is drawn 200 units out over the meadow or
 * 3200 out over the range — same apparent star size, same apparent density.
 */
const REFERENCE_RADIUS = 200;
/** Shell thickness at the reference radius: enough depth that the field isn't a wall. */
const REFERENCE_DEPTH = 60;
/** Point size at the reference radius, before each star's own multiplier. */
const REFERENCE_SIZE = 1.8;

/**
 * How bright the faintest star is drawn, as a fraction of the brightest.
 *
 * 0.72, lifted twice: first off the 0.42 the space field uses, then again once
 * the sky behind went deep (see `NIGHT_SKY` in celestial.ts). Lifting the floor
 * rather than the ceiling is what brightens a star field without blowing it
 * out — the bright stars were always bright, and it is the faint majority that
 * decides whether the sky reads as full or as sparse.
 */
const DIM_FLOOR = 0.72;

/**
 * The shimmer, as a fraction either side of a star's resting value.
 *
 * Two things move, and they have to move together to read as atmosphere rather
 * than as a bug: the brightness swings hard, and the point swells a little as
 * it brightens. Brightness alone reads as flicker; size alone reads as a
 * breathing dot. Each star runs at its own rate as well as its own phase —
 * a field twinkling in one rhythm is a string of fairy lights.
 */
const SHIMMER_BRIGHTNESS = 0.42;
const SHIMMER_SIZE = 0.22;

interface NightStarsProps {
  /**
   * How far out the shell sits. Pick it inside the world's camera far plane and
   * outside anything the player can reach; everything else scales off it.
   */
  radius?: number;
  /** Turns the whole field, for worlds that want the sky to wheel slowly. */
  spin?: number;
}

export function NightStars({ radius = REFERENCE_RADIUS, spin = 0 }: NightStarsProps) {
  const group = useRef<THREE.Group>(null!);

  const scale = radius / REFERENCE_RADIUS;

  const { geometry, starMaterial } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);

    const depth = REFERENCE_DEPTH * scale;
    const inner = radius - depth / 2;

    for (let i = 0; i < STAR_COUNT; i++) {
      // Taking z uniformly rather than the polar angle is what keeps the field
      // from bunching at the poles.
      const z = seeded(i * 1.7) * 2 - 1;
      const theta = seeded(i * 3.3 + 11) * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      const distance = inner + seeded(i * 5.9 + 3) * depth;

      positions[i * 3 + 0] = Math.cos(theta) * r * distance;
      positions[i * 3 + 1] = z * distance;
      positions[i * 3 + 2] = Math.sin(theta) * r * distance;

      // Along the stellar sequence: mostly white, a scattering of hot blue and
      // cool amber. The same tints the space field uses, because it is the same
      // galaxy seen from the ground.
      const roll = seeded(i * 7.1 + 5);
      const tint =
        roll < 0.5
          ? [1.0, 1.0, 1.0]
          : roll < 0.72
            ? [0.91, 0.94, 1.0]
            : roll < 0.86
              ? [1.0, 0.95, 0.84]
              : roll < 0.95
                ? [0.78, 0.86, 1.0]
                : [1.0, 0.82, 0.6];

      const brightness = DIM_FLOOR + seeded(i * 2.3 + 9) * (1 - DIM_FLOOR);
      colors[i * 3 + 0] = tint[0] * brightness;
      colors[i * 3 + 1] = tint[1] * brightness;
      colors[i * 3 + 2] = tint[2] * brightness;

      // A handful of much larger stars carry the eye; the rest stay small.
      const magnitude = seeded(i * 11.3 + 2);
      sizes[i] = magnitude > 0.988 ? 4.0 : magnitude > 0.93 ? 2.4 : 1.2;
      phases[i] = seeded(i * 13.7 + 4) * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    // Named `aSize`, not `size`: PointsMaterial's vertex shader already declares
    // a uniform called `size`, and an attribute of the same name fails to compile.
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      sizeAttenuation: true,
      size: REFERENCE_SIZE * scale,
      transparent: true,
      depthWrite: false,
      // Additive, so a star lying over the moon's halo or the horizon glow adds
      // to it rather than punching a grey hole in it.
      blending: THREE.AdditiveBlending,
      // The stars are their own light source; running them through the frame's
      // tone mapping is what greyed them off in the first place.
      toneMapped: false,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = `
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        ${shader.vertexShader}
      `
        // `color_vertex` is where three fills `vColor` from the per-star colour
        // attribute, and it runs before the point size is set — so the shimmer
        // is computed here and both the brightness and the size below ride on
        // it. Deriving the rate from the phase saves a second attribute:
        // 1/2π maps the phase onto 0..1, which spreads the field over rates
        // between about a second and a half and four seconds a cycle.
        .replace(
          "#include <color_vertex>",
          `#include <color_vertex>
           float aRate = 1.2 + 2.4 * fract(aPhase * 0.15915);
           float shimmer = sin(uTime * aRate + aPhase);
           vColor *= 1.0 + ${SHIMMER_BRIGHTNESS.toFixed(3)} * shimmer;`
        )
        .replace(
          "gl_PointSize = size;",
          `gl_PointSize = size * aSize * (1.0 + ${SHIMMER_SIZE.toFixed(3)} * shimmer);`
        );
      mat.userData.shader = shader;
    };
    mat.customProgramCacheKey = () => "night-stars";

    return { geometry: geo, starMaterial: mat };
  }, [radius, scale]);

  useFrame((state, delta) => {
    const shader = starMaterial.userData.shader;
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
    if (spin && group.current) group.current.rotation.y += delta * spin;
  });

  return (
    <group ref={group}>
      {/* `frustumCulled` off: the cloud's bounding sphere is centred on the
          origin rather than the camera, so a player who has walked toward one
          edge of a world can otherwise have the whole sky culled at once. */}
      <points geometry={geometry} material={starMaterial} frustumCulled={false} />
    </group>
  );
}
