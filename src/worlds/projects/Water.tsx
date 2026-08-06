import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { SEA_SIZE } from "./layout";
import { WAVE_AMPLITUDE, WAVE_GLSL } from "./waveField";
import type { SeaSky } from "./sky";

/**
 * Segments across the sea. This is the one number that trades the whole world's
 * frame budget against how coarse the chop looks — at 140 over 280 units each
 * facet is 2 units across, which is large enough to read as deliberate low-poly
 * faceting and fine enough to carry the shortest (3.9-unit) wave.
 */
const SEGMENTS = 140;

interface WaterProps {
  /** Written by SeaLighting each frame; the sea takes its tint from the same sky. */
  skyRef: React.MutableRefObject<SeaSky>;
}

/**
 * The sea. A single displaced plane, flat-shaded.
 *
 * Displacing vertices normally breaks lighting, because the geometry's normals
 * still describe the flat plane it started as — but `flatShading` derives its
 * normals in the fragment shader from screen-space derivatives of the *final*
 * position, so the facets light themselves correctly for free. That is the whole
 * reason the water can be one cheap Lambert material with a vertex hook rather
 * than a custom lit shader or a per-frame `computeVertexNormals` on 40k
 * triangles.
 */
export function Water({ skyRef }: WaterProps) {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE, SEGMENTS, SEGMENTS);
    // Baked into the geometry rather than applied as a mesh rotation so the
    // shader's local XZ is world XZ. Without this the vertex hook would have to
    // undo the rotation to sample the wave field, and the boat's CPU-side
    // sampling — which works in world space — would silently disagree with it.
    plane.rotateX(-Math.PI / 2);
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => {
    const mat = new THREE.MeshLambertMaterial({ color: PALETTE.waterDeep, flatShading: true });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uCrest = { value: new THREE.Color(PALETTE.waterCrest) };
      shader.uniforms.uAmplitude = { value: WAVE_AMPLITUDE };

      shader.vertexShader = `uniform float uTime;\nvarying float vWaveHeight;\n${WAVE_GLSL}\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWaveHeight = waveHeight(transformed.xz, uTime);
        transformed.y += vWaveHeight;`
      );

      shader.fragmentShader = `uniform vec3 uCrest;\nuniform float uAmplitude;\nvarying float vWaveHeight;\n${shader.fragmentShader}`;
      // Lifting crests toward a lighter tone is what stops the sea reading as
      // one flat sheet of color — the facets have shape from the lighting, but
      // without this the swell has no *depth* to it.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          uCrest,
          smoothstep(-uAmplitude * 0.35, uAmplitude * 0.85, vWaveHeight)
        );`
      );

      mat.userData.shader = shader;
    };
    // Without a stable key three would compile a fresh program per material
    // sharing this source; with one, the sea's program is cached like any other.
    mat.customProgramCacheKey = () => "sea-water";
    return mat;
  }, []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const shader = material.userData.shader as
      | { uniforms: { uTime: { value: number } } }
      | undefined;
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
    // Tinting the base color rather than the light keeps the sea reacting to
    // the sky even where the key light doesn't reach it.
    material.color.set(PALETTE.waterDeep).multiply(skyRef.current.waterTint);
  });

  return <mesh geometry={geometry} material={material} />;
}
