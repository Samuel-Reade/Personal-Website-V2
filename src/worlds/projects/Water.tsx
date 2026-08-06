import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSharedGradient, setFlatShading } from "../../utils/toon";
import { PALETTE } from "./palette";
import { SEA_SIZE } from "./layout";
import { WAVE_AMPLITUDE, WAVE_GLSL } from "./waveField";
import type { SeaSky } from "./sky";

/**
 * Segments across the sea. This is the one number that trades the whole world's
 * frame budget against how coarse the chop looks — at 130 over 300 units each
 * facet is 2.3 units across, which is large enough to read as deliberate
 * low-poly faceting and fine enough to carry the shortest (3.9-unit) wave.
 */
const SEGMENTS = 130;
/** World size of one facet. The follow offset is snapped to this — see below. */
const CELL = SEA_SIZE / SEGMENTS;

interface WaterProps {
  /** Written by SeaLighting each frame; the sea takes its tint from the same sky. */
  skyRef: React.MutableRefObject<SeaSky>;
  /** The boat, which the plane is recentred on so its rim is never reachable. */
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

/**
 * The sea. A single displaced plane, flat-shaded, carried along under the boat.
 *
 * Displacing vertices normally breaks lighting, because the geometry's normals
 * still describe the flat plane it started as — but `flatShading` derives its
 * normals in the fragment shader from screen-space derivatives of the *final*
 * position, so the facets light themselves correctly for free. That is the whole
 * reason the water can be one cheap Lambert material with a vertex hook rather
 * than a custom lit shader or a per-frame `computeVertexNormals` on 34k
 * triangles.
 *
 * The plane follows the boat rather than covering the whole sailable area,
 * because covering it would need a plane over 400 units across to keep its rim
 * outside the fog — four times the triangles to render water the player can
 * never get near. Following it keeps the mesh small and makes the sea
 * effectively unbounded.
 */
export function Water({ skyRef, playerPosRef }: WaterProps) {
  const mesh = useRef<THREE.Mesh>(null!);

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
    // MeshToonMaterial against the meadow's shared 3-band gradient, not Lambert:
    // this is the one place the archipelago deliberately reaches across into the
    // meadow's shading. The sea is asked to read like the meadow's canopies, and
    // that look is two specific things — light quantized into flat bands by the
    // shared ramp, and a family of tones scattered over the surface rather than
    // one flat color (see uBand* below). Smooth Lambert falloff gives neither.
    const mat = new THREE.MeshToonMaterial({
      color: "#ffffff",
      gradientMap: getSharedGradient(),
    });
    setFlatShading(mat);

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uOffset = { value: new THREE.Vector2() };
      shader.uniforms.uAmplitude = { value: WAVE_AMPLITUDE };
      shader.uniforms.uTint = { value: new THREE.Color("#ffffff") };
      shader.uniforms.uBandA = { value: new THREE.Color(PALETTE.waterDeep) };
      shader.uniforms.uBandB = { value: new THREE.Color(PALETTE.waterMid) };
      shader.uniforms.uBandC = { value: new THREE.Color(PALETTE.waterLight) };
      shader.uniforms.uBandD = { value: new THREE.Color(PALETTE.waterCrest) };

      shader.vertexShader = `uniform float uTime;\nuniform vec2 uOffset;\nvarying float vWaveHeight;\n${WAVE_GLSL}\n${shader.vertexShader}`;
      // Sampled at the vertex's *world* position — local position plus the
      // plane's own offset — so the swell stays pinned to the world while the
      // mesh slides under it. Sampling local position instead would drag the
      // waves along with the boat, which reads as the whole sea moving.
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWaveHeight = waveHeight(transformed.xz + uOffset, uTime);
        transformed.y += vWaveHeight;`
      );

      shader.fragmentShader =
        `uniform vec3 uBandA;\nuniform vec3 uBandB;\nuniform vec3 uBandC;\nuniform vec3 uBandD;\nuniform vec3 uTint;\nuniform float uAmplitude;\nvarying float vWaveHeight;\n` +
        shader.fragmentShader;
      // Quantized into four flat steps by height, then each step takes a whole
      // tone of its own. This is the canopy trick: a *stepped* selection between
      // several colors, so the surface breaks into legible blocks of tone, where
      // a continuous mix between two colors would just produce a soft gradient
      // and undo the flat banding the toon ramp is there to create.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float band = clamp((vWaveHeight / uAmplitude) * 0.5 + 0.5, 0.0, 0.999);
        band = floor(band * 4.0);
        vec3 seaColor = band < 1.0 ? uBandA : (band < 2.0 ? uBandB : (band < 3.0 ? uBandC : uBandD));
        diffuseColor.rgb *= seaColor * uTint;`
      );

      mat.userData.shader = shader;
    };
    // Without a stable key three would compile a fresh program per material
    // sharing this source; with one, the sea's program is cached like any other.
    mat.customProgramCacheKey = () => "sea-water-toon";
    return mat;
  }, []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const player = playerPosRef.current;
    // Snapped to the facet grid. Sliding the plane continuously would move every
    // vertex a fraction of a cell each frame, so the faceting would crawl and
    // shimmer across the whole sea; snapping means vertices only ever land on
    // the same world positions they would have had if the plane never moved.
    const offsetX = Math.round(player.x / CELL) * CELL;
    const offsetZ = Math.round(player.z / CELL) * CELL;
    if (mesh.current) mesh.current.position.set(offsetX, 0, offsetZ);

    const shader = material.userData.shader as
      | {
          uniforms: {
            uTime: { value: number };
            uOffset: { value: THREE.Vector2 };
            uTint: { value: THREE.Color };
          };
        }
      | undefined;
    if (shader) {
      shader.uniforms.uTime.value = state.clock.elapsedTime;
      shader.uniforms.uOffset.value.set(offsetX, offsetZ);
      // The sky tint multiplies the chosen band rather than the material's base
      // color, which the bands now replace outright — so the sea still warms at
      // sunset without collapsing its four tones back into one.
      shader.uniforms.uTint.value.copy(skyRef.current.waterTint);
    }
  });

  return <mesh ref={mesh} geometry={geometry} material={material} />;
}
