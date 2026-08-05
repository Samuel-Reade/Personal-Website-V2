import * as THREE from "three";

/**
 * A deliberately non-uniform stepped lighting ramp — three flat tone bands
 * (shadow / midtone / highlight) with hard transitions, rather than an
 * evenly-spaced gradient. This is what MeshToonMaterial samples via
 * `gradientMap` to turn smooth NdotL falloff into flat cel-shaded bands.
 */
function createToonGradientTexture(): THREE.DataTexture {
  const size = 32;
  const data = new Uint8Array(size * 4);
  const bands: { end: number; value: number }[] = [
    { end: 0.4, value: 58 }, // shadow
    { end: 0.72, value: 152 }, // midtone
    { end: 1.0, value: 238 }, // highlight
  ];
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    const band = bands.find((b) => t <= b.end) ?? bands[bands.length - 1];
    data[i * 4 + 0] = band.value;
    data[i * 4 + 1] = band.value;
    data[i * 4 + 2] = band.value;
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

export interface RimOptions {
  /** Warm rim color, evoking sunlight catching an object's edge. */
  color?: THREE.ColorRepresentation;
  /** Higher = thinner, sharper rim. */
  power?: number;
  strength?: number;
}

const RIM_VARYING = "varying vec3 vRimViewDir;\n";

/** Vertex-shader snippet: capture a view-space direction for the rim term, using `transformed` as it stands after any prior sway/bend edits. */
function rimVertexSnippet(): string {
  return `
      vec4 mvPositionRim = modelViewMatrix * vec4(transformed, 1.0);
      vRimViewDir = normalize(-mvPositionRim.xyz);`;
}

/**
 * Fragment-shader snippet: a Fresnel-style rim term, added just before fog is
 * applied so it hazes out at a distance like everything else. Uses the local
 * `normal` variable (set up by `normal_fragment_begin`) rather than the raw
 * `vNormal` varying, since `vNormal` isn't declared at all when flat shading
 * is on — `normal` is computed correctly either way.
 */
function rimFragmentReplace(fragmentShader: string): string {
  return fragmentShader.replace(
    "#include <fog_fragment>",
    `float rimDot = 1.0 - max(dot(normal, normalize(vRimViewDir)), 0.0);
      float rimFactor = pow(clamp(rimDot, 0.0, 1.0), uRimPower);
      gl_FragColor.rgb += uRimColor * rimFactor * uRimStrength;
      #include <fog_fragment>`
  );
}

function applyRimUniforms(shader: THREE.WebGLProgramParametersWithUniforms, opts: RimOptions): void {
  shader.uniforms.uRimColor = { value: new THREE.Color(opts.color ?? "#ffd9a0") };
  shader.uniforms.uRimPower = { value: opts.power ?? 2.2 };
  shader.uniforms.uRimStrength = { value: opts.strength ?? 0.4 };
}

/**
 * A plain MeshToonMaterial (no wind sway) with a warm Fresnel rim light on
 * top — used for the player character, where sunlight should catch the
 * silhouette's edges without any vertex animation.
 */
export function createRimToonMaterial(
  color: THREE.ColorRepresentation,
  opts: RimOptions & { map?: THREE.Texture } = {}
): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial({ color, gradientMap: getSharedGradient(), map: opts.map });

  material.onBeforeCompile = (shader) => {
    applyRimUniforms(shader, opts);

    shader.vertexShader =
      `uniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;\n${RIM_VARYING}` +
      shader.vertexShader;
    shader.fragmentShader =
      `uniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;\n${RIM_VARYING}` +
      shader.fragmentShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>${rimVertexSnippet()}`
    );
    shader.fragmentShader = rimFragmentReplace(shader.fragmentShader);

    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => "rim-toon";
  return material;
}

/**
 * A MeshToonMaterial with a gentle wind-driven vertex sway baked in via
 * onBeforeCompile — used for tree canopies — plus the same warm rim light as
 * `createRimToonMaterial`. `material.userData.shader` is populated on first
 * compile so callers can drive `uTime` each frame.
 */
export function createSwayToonMaterial(
  color: THREE.ColorRepresentation,
  opts: { swayStrength?: number; swayFreq?: number; map?: THREE.Texture; rim?: RimOptions | false } = {}
): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial({ color, gradientMap: getSharedGradient(), map: opts.map });
  const swayStrength = opts.swayStrength ?? 0.06;
  const swayFreq = opts.swayFreq ?? 0.6;
  const rim = opts.rim ?? {};

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uSwayStrength = { value: swayStrength };
    shader.uniforms.uSwayFreq = { value: swayFreq };

    let vertexPrepend = `uniform float uTime;\nuniform float uSwayStrength;\nuniform float uSwayFreq;\n`;
    let fragmentPrepend = "";
    let vertexInject = `#include <begin_vertex>
      vec4 swayWorldPos = modelMatrix * vec4(transformed, 1.0);
      float heightFactor = clamp(position.y * 0.5, 0.0, 1.0);
      float sway = sin(uTime * uSwayFreq + swayWorldPos.x * 0.3 + swayWorldPos.z * 0.3) * uSwayStrength * heightFactor;
      transformed.x += sway;
      transformed.z += sway * 0.6;`;

    if (rim !== false) {
      applyRimUniforms(shader, rim);
      vertexPrepend += `uniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;\n${RIM_VARYING}`;
      fragmentPrepend += `uniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;\n${RIM_VARYING}`;
      vertexInject += rimVertexSnippet();
    }

    shader.vertexShader = vertexPrepend + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", vertexInject);

    if (rim !== false) {
      shader.fragmentShader = fragmentPrepend + shader.fragmentShader;
      shader.fragmentShader = rimFragmentReplace(shader.fragmentShader);
    }

    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => (rim !== false ? "sway-rim-toon" : "sway-toon");
  return material;
}

/**
 * A MeshToonMaterial for instanced grass: per-blade wind sway (desynced via
 * an `instancePhase` attribute), a radial "push away" bend around the
 * player's position so grass visibly parts as the character walks through,
 * and the same warm rim light along blade edges.
 */
export function createGrassMaterial(
  color: THREE.ColorRepresentation,
  opts: { swayStrength?: number; bendRadius?: number; rim?: RimOptions | false } = {}
): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial({ color, gradientMap: getSharedGradient() });
  const swayStrength = opts.swayStrength ?? 0.24;
  const bendRadius = opts.bendRadius ?? 1.3;
  const rim = opts.rim ?? {};

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uPlayerPos = { value: new THREE.Vector3(9999, 0, 9999) };
    shader.uniforms.uSwayStrength = { value: swayStrength };
    shader.uniforms.uBendRadius = { value: bendRadius };

    let vertexPrepend =
      `uniform float uTime;\nuniform vec3 uPlayerPos;\nuniform float uSwayStrength;\nuniform float uBendRadius;\nattribute float instancePhase;\n`;
    let fragmentPrepend = "";
    let vertexInject = `#include <begin_vertex>
      float h = clamp(position.y / 0.7, 0.0, 1.0);
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
      #endif`;

    if (rim !== false) {
      applyRimUniforms(shader, rim);
      vertexPrepend += `uniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;\n${RIM_VARYING}`;
      fragmentPrepend += `uniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;\n${RIM_VARYING}`;
      vertexInject += rimVertexSnippet();
    }

    shader.vertexShader = vertexPrepend + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", vertexInject);

    if (rim !== false) {
      shader.fragmentShader = fragmentPrepend + shader.fragmentShader;
      shader.fragmentShader = rimFragmentReplace(shader.fragmentShader);
    }

    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => (rim !== false ? "grass-rim-toon" : "grass-toon");
  return material;
}
