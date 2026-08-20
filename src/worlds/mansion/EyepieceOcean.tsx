import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSharedGradient, setFlatShading } from "../../utils/toon";
import { WAVE_AMPLITUDE, WAVE_GLSL, waveHeight } from "../projects/waveField";
import { PALETTE as SEA } from "../projects/palette";
import { Cliffs } from "./EyepieceCliffs";
import { EyepieceBalloons } from "./EyepieceBalloons";

/**
 * What the telescope shows by day: open water under a pale sky, the cliff the
 * balcony itself stands on running off to the west, and four hot air balloons
 * standing off it — the four ways to reach me, one to an envelope. The balloons
 * live in `EyepieceBalloons.tsx`; everything in this file is the place they are
 * seen against.
 *
 * The water is deliberately the archipelago's: the same wave field, the same
 * four stepped tones, the same shared toon ramp. This is the second place the
 * site reaches across worlds for a look (the archipelago itself borrows the
 * meadow's gradient), and for the same reason — the sea through the eyepiece
 * should read as *that* sea, not a third rendering of water. The balloons make
 * it the third: they are the associations clearing's own far cluster.
 */

interface OceanProps {
  /** Reports the hovered object's caption, or null, up to the overlay chrome. */
  onHover: (caption: string | null) => void;
}

/**
 * The archipelago's banded water, semi-transparent over the dark plane below.
 *
 * Transparency is the one departure from that world's water, and what it buys
 * here is depth: the balcony stands on a cliff in open sea, and a sheet you can
 * see a little way into reads as deep in a way an opaque one never does. There
 * used to be a sand shelf under the near end of it, back when an anchor lay on
 * the bottom for GitHub — with the four contacts up in the air it was a pale
 * slab filling the bottom third of the lens and holding nothing.
 */
function Water() {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(380, 230, 150, 90);
    // Both baked in, not set on the mesh, for the same reason the archipelago
    // bakes its rotation: the shader displaces in local coordinates, and the
    // floating objects sample the JS wave field in world coordinates. With the
    // geometry itself rotated and pushed out to sea, local *is* world, and the
    // two can never disagree.
    plane.rotateX(-Math.PI / 2);
    plane.translate(0, 0, -85);
    return plane;
  }, []);

  const material = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({
      color: "#ffffff",
      gradientMap: getSharedGradient(),
      transparent: true,
      opacity: 0.62,
    });
    setFlatShading(mat);

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uAmplitude = { value: WAVE_AMPLITUDE };
      shader.uniforms.uBandA = { value: new THREE.Color(SEA.waterDeep) };
      shader.uniforms.uBandB = { value: new THREE.Color(SEA.waterMid) };
      shader.uniforms.uBandC = { value: new THREE.Color(SEA.waterLight) };
      shader.uniforms.uBandD = { value: new THREE.Color(SEA.waterCrest) };

      shader.vertexShader = `uniform float uTime;\nvarying float vWaveHeight;\n${WAVE_GLSL}\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWaveHeight = waveHeight(transformed.xz, uTime);
        transformed.y += vWaveHeight;`
      );

      shader.fragmentShader =
        `uniform vec3 uBandA;\nuniform vec3 uBandB;\nuniform vec3 uBandC;\nuniform vec3 uBandD;\nuniform float uAmplitude;\nvarying float vWaveHeight;\n` +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float band = clamp((vWaveHeight / uAmplitude) * 0.5 + 0.5, 0.0, 0.999);
        band = floor(band * 4.0);
        vec3 seaColor = band < 1.0 ? uBandA : (band < 2.0 ? uBandB : (band < 3.0 ? uBandC : uBandD));
        diffuseColor.rgb *= seaColor;`
      );

      mat.userData.shader = shader;
    };
    mat.customProgramCacheKey = () => "eyepiece-water-toon";
    return mat;
  }, []);

  useFrame((state) => {
    const shader = material.userData.shader as
      | { uniforms: { uTime: { value: number } } }
      | undefined;
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <mesh geometry={geometry} material={material} />;
}

/**
 * What the water is seen against: unlit near-dark blue, far enough down that
 * the surface never meets it. This is depth, not a surface anyone should read.
 */
function Deep() {
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: "#31485a" }), []);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} position={[0, -5.5, -100]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[400, 260]} />
    </mesh>
  );
}

/** Sky and clouds. The coastline itself now lives in EyepieceCliffs. */
function Sky() {
  /**
   * A gradient rather than a flat sheet: deep zenith blue falling to a pale,
   * warm horizon. Aerial perspective is most of what a "realistic" sky is,
   * and a single colour has none. Two vertex colours on one quad buy it.
   */
  const skyGeometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(560, 170);
    const zenith = new THREE.Color("#6f9cba");
    const horizon = new THREE.Color("#e2ecf1");
    // PlaneGeometry orders its four vertices top row first.
    const colors = new Float32Array([
      zenith.r, zenith.g, zenith.b,
      zenith.r, zenith.g, zenith.b,
      horizon.r, horizon.g, horizon.b,
      horizon.r, horizon.g, horizon.b,
    ]);
    plane.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return plane;
  }, []);
  const skyMaterial = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true }), []);
  const hazeMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#e2ecf1", transparent: true, opacity: 0.85 }),
    []
  );
  const cloudMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#eef4f6" }), []);
  const clouds = useRef<THREE.Group>(null!);

  useFrame((state) => {
    // A drift of a few units over a minute: visible if watched, still if not.
    if (clouds.current) clouds.current.position.x = Math.sin(state.clock.elapsedTime * 0.012) * 6;
  });

  return (
    <group>
      <mesh geometry={skyGeometry} material={skyMaterial} position={[0, 85, -179]} />
      {/* Pale band where sky meets water — haze is what says the sea keeps
          going rather than stopping at a wall. */}
      <mesh material={hazeMaterial} position={[0, 7, -177]}>
        <planeGeometry args={[520, 26]} />
      </mesh>

      <group ref={clouds}>
        {([
          [-40, 34, -150, 7],
          [22, 42, -158, 9],
          [66, 30, -146, 6],
        ] as const).map(([x, y, z, s], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh material={cloudMaterial} scale={[s, s * 0.34, s * 0.6]}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
            <mesh material={cloudMaterial} position={[s * 0.7, -s * 0.06, 0]} scale={[s * 0.6, s * 0.24, s * 0.5]}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Deterministic hash for the whitecap scatter — same sea on every visit. */
function capRand(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const CAP_COUNT = 44;

/**
 * Whitecaps: small foam streaks scattered across the swell, each visible only
 * while the wave under it is near its crest. This is the detail that turns a
 * displaced sheet into open water — a real sea is never an unbroken colour,
 * and the caps appearing and dying with the actual wave field means they
 * always sit on top of a crest rather than painted at random.
 */
function Whitecaps() {
  const caps = useMemo(
    () =>
      Array.from({ length: CAP_COUNT }, (_, i) => ({
        x: -46 + capRand(i * 3.1) * 110,
        z: -16 - capRand(i * 7.7) * 116,
        length: 0.8 + capRand(i * 5.3) * 1.1,
        spin: capRand(i * 9.1) * Math.PI,
        phase: capRand(i * 11.7),
      })),
    []
  );
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const materials = useMemo(
    () =>
      caps.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: "#f4f9fa",
            transparent: true,
            opacity: 0,
            depthWrite: false,
          })
      ),
    [caps]
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    caps.forEach((cap, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const h = waveHeight(cap.x, cap.z, t);
      // 0 at mid-swell, 1 at the crest — the cap only exists near the top.
      const crest = THREE.MathUtils.smoothstep(h / WAVE_AMPLITUDE, 0.45, 0.95);
      materials[i].opacity = crest * 0.7;
      mesh.position.y = h + 0.06;
      mesh.scale.setScalar(0.7 + crest * 0.5);
    });
  });

  return (
    <>
      {caps.map((cap, i) => (
        <mesh
          key={i}
          ref={(node) => {
            meshes.current[i] = node;
          }}
          material={materials[i]}
          position={[cap.x, 0, cap.z]}
          rotation={[-Math.PI / 2, 0, cap.spin]}
        >
          <planeGeometry args={[cap.length, 0.28]} />
        </mesh>
      ))}
    </>
  );
}

/** The full daytime scene behind the eyepiece. */
export function EyepieceOcean({ onHover }: OceanProps) {
  return (
    <group>
      {/* Bright, even, and shadowless: a calm noon at sea. */}
      <ambientLight intensity={0.85} color="#f4f7f8" />
      <directionalLight position={[30, 50, 10]} intensity={1.0} color="#fff4e2" />

      <Sky />
      <Cliffs />
      <Deep />
      <Water />
      <Whitecaps />

      <EyepieceBalloons onHover={onHover} />
    </group>
  );
}
