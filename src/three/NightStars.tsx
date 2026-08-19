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
/**
 * Point size at the reference radius, before each star's own multiplier.
 *
 * Halved from 4.6, which drew a true star with a core and a halo but drew it
 * too large — the field read as lamps rather than as stars. At 2.3 a common
 * star is about four pixels across and the brightest around ten. It survives
 * the shrink where the old 1.8 could not because the core is drawn from
 * `gl_PointCoord` now rather than sampled from a texture: it stays a solid
 * saturated centre at any size instead of dissolving once the sprite runs out
 * of pixels.
 */
const REFERENCE_SIZE = 2.3;

/**
 * How bright the faintest star is drawn, as a fraction of the brightest.
 *
 * 0.72, lifted twice: first off the 0.42 the space field uses, then again once
 * the sky behind went deep (see `NIGHT_SKY` in celestial.ts). Lifting the floor
 * rather than the ceiling is what brightens a star field without blowing it
 * out — the bright stars were always bright, and it is the faint majority that
 * decides whether the sky reads as full or as sparse.
 */
const DIM_FLOOR = 0.8;

/**
 * Multiplied through every star's colour after the floor above.
 *
 * Above 1 deliberately: a point's alpha falls away from its centre, so an
 * additive star only ever lays down its full colour at the very middle. Over
 * 1 the core clips to white and the falloff does the rest — which is exactly
 * how a bright star behaves, a white centre with colour in its skirt. Without
 * it the tints (the blue and amber ones especially) never reach white and the
 * whole field reads as coloured dust.
 */
const BRIGHTNESS_GAIN = 1.45;

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
  /** Scratch for the drawing-buffer read below; this runs every frame. */
  const bufferSize = useMemo(() => new THREE.Vector2(), []);

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

      const brightness = (DIM_FLOOR + seeded(i * 2.3 + 9) * (1 - DIM_FLOOR)) * BRIGHTNESS_GAIN;
      colors[i * 3 + 0] = tint[0] * brightness;
      colors[i * 3 + 1] = tint[1] * brightness;
      colors[i * 3 + 2] = tint[2] * brightness;

      // A handful of much larger stars carry the eye; the rest stay small.
      const magnitude = seeded(i * 11.3 + 2);
      sizes[i] = magnitude > 0.988 ? 3.0 : magnitude > 0.93 ? 1.9 : 1.15;
      phases[i] = seeded(i * 13.7 + 4) * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aTint", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    // A shader of our own rather than `PointsMaterial` with its chunks patched.
    // That is not a stylistic preference: three's point pipeline decides the
    // size from a `size` uniform times a `scale` uniform it sets from the
    // drawing buffer, mixes the vertex colour through `diffuse` and `opacity`,
    // and then runs tone mapping and colour-space chunks that a world with an
    // EffectComposer configures differently from one without. Every one of
    // those is a place a star can quietly lose most of its brightness, and
    // between them these came out as grey tiles. Here the size in pixels and
    // the colour written to the framebuffer are both stated outright.
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      // Additive, so a star lying over the moon's halo adds to it rather than
      // punching a hole in it.
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: REFERENCE_SIZE * scale },
        // Half the drawing buffer's height, which is what turns a world-space
        // size into pixels under a perspective camera. Written every frame
        // from the renderer, so a resized window keeps its stars the same size.
        uPixelScale: { value: 400 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aTint;
        uniform float uTime;
        uniform float uSize;
        uniform float uPixelScale;
        varying vec3 vTint;
        varying float vGlow;

        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Its own rate as well as its own phase: a field twinkling in one
          // rhythm reads as a string of fairy lights. 1/2π maps the phase onto
          // 0..1, which spreads the field between about 1.5 and 4 seconds a
          // cycle without needing a second attribute.
          float rate = 1.2 + 2.4 * fract(aPhase * 0.15915);
          float shimmer = sin(uTime * rate + aPhase);
          vTint = aTint;
          vGlow = 1.0 + ${SHIMMER_BRIGHTNESS.toFixed(3)} * shimmer;
          gl_PointSize = uSize * aSize * (1.0 + ${SHIMMER_SIZE.toFixed(3)} * shimmer)
            * (uPixelScale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vTint;
        varying float vGlow;

        void main() {
          // Distance from the point's centre, 0 in the middle and 1 at its edge.
          float r = length(gl_PointCoord - 0.5) * 2.0;
          // A solid core inside a soft halo. The core is what makes a star look
          // like a point of light rather than a smudge; the halo is what gives
          // the shimmer something to breathe.
          float core = 1.0 - smoothstep(0.0, 0.5, r);
          float halo = (1.0 - smoothstep(0.35, 1.0, r)) * 0.4;
          float alpha = clamp(core + halo, 0.0, 1.0);
          if (alpha < 0.01) discard;
          // Written straight out: no tone mapping and no colour-space chunk, so
          // a star is exactly as bright as it says it is in every world.
          gl_FragColor = vec4(vTint * vGlow, alpha);
        }
      `,
    });

    return { geometry: geo, starMaterial: mat };
  }, [radius, scale]);

  useFrame((state, delta) => {
    starMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    // Half the drawing buffer's height — the perspective divide's companion.
    // Read from the renderer rather than assumed, so the stars keep their size
    // across a resize and on a high-DPI screen.
    starMaterial.uniforms.uPixelScale.value = state.gl.getDrawingBufferSize(bufferSize).y * 0.5;
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
