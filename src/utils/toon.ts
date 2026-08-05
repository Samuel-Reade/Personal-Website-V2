import * as THREE from "three";

/**
 * A tiny stepped gradient (4 texels) used as every MeshToonMaterial's
 * gradientMap. This is what turns smooth lighting into the flat 2-3 tone
 * "cel" bands that give the scene its painterly, non-photoreal look.
 */
function createToonGradientTexture(): THREE.DataTexture {
  const size = 4;
  const data = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const v = Math.round((i / (size - 1)) * 255);
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

let sharedGradient: THREE.DataTexture | null = null;
/** All toon materials in the scene share one gradient map for a consistent look. */
export function getSharedGradient(): THREE.DataTexture {
  if (!sharedGradient) sharedGradient = createToonGradientTexture();
  return sharedGradient;
}

/**
 * Enables faceted low-poly shading. @types/three omits `flatShading` from
 * MeshToonMaterial's constructor params even though three.js supports it at
 * runtime for any Mesh material, hence the cast.
 */
export function setFlatShading(material: THREE.Material): void {
  (material as THREE.Material & { flatShading: boolean }).flatShading = true;
}

/**
 * A MeshToonMaterial with a gentle wind-driven vertex sway baked in via
 * onBeforeCompile — used for tree canopies. `material.userData.shader`
 * is populated on first compile so callers can drive `uTime` each frame.
 */
export function createSwayToonMaterial(
  color: THREE.ColorRepresentation,
  opts: { swayStrength?: number; swayFreq?: number } = {}
): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial({ color, gradientMap: getSharedGradient() });
  const swayStrength = opts.swayStrength ?? 0.06;
  const swayFreq = opts.swayFreq ?? 0.6;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uSwayStrength = { value: swayStrength };
    shader.uniforms.uSwayFreq = { value: swayFreq };

    shader.vertexShader =
      `uniform float uTime;\nuniform float uSwayStrength;\nuniform float uSwayFreq;\n` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec4 swayWorldPos = modelMatrix * vec4(transformed, 1.0);
      float heightFactor = clamp(position.y * 0.5, 0.0, 1.0);
      float sway = sin(uTime * uSwayFreq + swayWorldPos.x * 0.3 + swayWorldPos.z * 0.3) * uSwayStrength * heightFactor;
      transformed.x += sway;
      transformed.z += sway * 0.6;`
    );

    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => "sway-toon";
  return material;
}

/**
 * A MeshToonMaterial for instanced grass: per-blade wind sway (desynced via
 * an `instancePhase` attribute) plus a radial "push away" bend around the
 * player's position so grass visibly parts as the character walks through.
 */
export function createGrassMaterial(
  color: THREE.ColorRepresentation,
  opts: { swayStrength?: number; bendRadius?: number } = {}
): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial({ color, gradientMap: getSharedGradient() });
  const swayStrength = opts.swayStrength ?? 0.18;
  const bendRadius = opts.bendRadius ?? 1.3;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uPlayerPos = { value: new THREE.Vector3(9999, 0, 9999) };
    shader.uniforms.uSwayStrength = { value: swayStrength };
    shader.uniforms.uBendRadius = { value: bendRadius };

    shader.vertexShader =
      `uniform float uTime;\nuniform vec3 uPlayerPos;\nuniform float uSwayStrength;\nuniform float uBendRadius;\nattribute float instancePhase;\n` +
      shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float h = clamp(position.y / 0.55, 0.0, 1.0);
      float sway = sin(uTime * 1.6 + instancePhase) * uSwayStrength * h;
      transformed.x += sway;
      transformed.z += sway * 0.5;
      #ifdef USE_INSTANCING
        vec3 instWorldPos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec2 toInst = instWorldPos.xz - uPlayerPos.xz;
        float d = length(toInst);
        float bend = (1.0 - smoothstep(0.0, uBendRadius, d)) * h;
        vec2 away = toInst / (d + 0.0001);
        transformed.x += away.x * bend * 0.85;
        transformed.z += away.y * bend * 0.85;
        transformed.y -= bend * position.y * 0.35;
      #endif`
    );

    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => "grass-toon";
  return material;
}
