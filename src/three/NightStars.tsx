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
const REFERENCE_SIZE = 1.5;

/**
 * How bright the faintest star is drawn, as a fraction of the brightest.
 *
 * 0.55, up from the 0.42 the space field uses and well up from what drei's
 * `<Stars>` was giving these worlds — the ask was a brighter night, and the
 * honest way to grant it is to lift the floor rather than the ceiling: the
 * bright stars were already bright, and raising them further would have blown
 * them out against a sky that is deliberately not black. Lifting the dim end
 * brings the faint majority up out of the near-invisible.
 */
const DIM_FLOOR = 0.55;

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
      sizes[i] = magnitude > 0.988 ? 3.6 : magnitude > 0.93 ? 2.2 : 1.15;
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
      `.replace(
        "gl_PointSize = size;",
        // Each star breathes on its own phase — a shallow ±12%, which reads as
        // atmosphere without the field flickering like a string of fairy lights.
        "gl_PointSize = size * aSize * (1.0 + 0.12 * sin(uTime * 1.7 + aPhase));"
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
