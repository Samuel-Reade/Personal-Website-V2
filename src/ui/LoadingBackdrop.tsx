import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createGrassMaterial } from "../utils/toon";
import { NightStars } from "../three/NightStars";
import { HorizonDome } from "../three/HorizonDome";
import { buildClumpGeometry } from "../three/grassGeometry";
import { Clouds } from "../three/Clouds";
import {
  createSkyDome,
  DAY_SKY,
  NIGHT_SKY,
  getGlowTexture,
  horizonFade,
  placeBody,
  SUN_DISC_RADIUS,
  SUN_GLOW_OPACITY,
  SUN_GLOW_TIGHT,
  SUN_GLOW_WIDE,
} from "../three/celestial";
import { daylight, getMoonState, getSunState } from "../utils/time";

/**
 * The meadow, seen from down in the grass, behind the loading screen.
 *
 * It runs on the same clock as everything else — `utils/time.ts` — so whoever
 * arrives at nine in the evening waits in front of a moonlit field and whoever
 * arrives at noon waits in front of a bright one. The sun and moon are placed by
 * `three/celestial.ts`, the same module the meadow and the archipelago use, so
 * the body sits at the same bearing here as it will once they are inside.
 *
 * What it is NOT is the meadow's `Scene`. That field is ~75,000 clumps over a
 * radius-52 disc, built on the main thread, and this screen's entire job is to
 * be up while the hall behind it compiles — spending seconds building a second
 * meadow to decorate the wait would be self-defeating. So the grass here is the
 * same clump geometry and the same shader, scattered through a wedge shaped like
 * the camera's own frustum: dense at the lens, thinning with distance, and gone
 * into fog before its far edge arrives. Around 6,000 clumps rather than 75,000,
 * and none of them anywhere the camera cannot see.
 */

/** Where the lens sits, and what it looks at. Low, as if lying in the field. */
const EYE: [number, number, number] = [0, 1.12, 7];
const AIM = new THREE.Vector3(0, 2.5, -18);

const GRASS_COUNT = 6000;
/**
 * How far ahead of the lens the field is scattered. There is no point past the
 * fog: a clump beyond FOG_FAR renders as flat horizon colour.
 */
const MAX_DEPTH = 46;
/**
 * The wedge widens with depth at a fixed angle rather than between two chosen
 * widths, so it is the camera's own frustum that decides how wide the field has
 * to be. 62° clears the horizontal half-angle of a 55° vertical lens on every
 * aspect the site can be opened at, up to and including a 32:9 span (61.6°).
 * That is what stops the grass falling short of the frame edge on a wide
 * monitor — a lerp between a chosen near width and a chosen far width was tried
 * first and did exactly that: bald corners from about fifteen units out at 16:9,
 * and from under ten at 21:9.
 */
const COVER_TAN = Math.tan((62 * Math.PI) / 180);
/** Keeps the scatter a little wider than the frustum at the lens, where the camera drifts. */
const EDGE_MARGIN = 3;
/**
 * Pushes the scatter toward the lens. The wedge's area grows with the square of
 * depth, so an even scatter would put almost everything at the far end where it
 * is four pixels tall and half-dissolved — and leave the foreground bald. At
 * 2.2 the nearest five units come out at about 30 clumps per square unit, which
 * is the meadow's own field density, and it thins from there.
 */
const DEPTH_BIAS = 2.2;

/** The meadow's own grass colours, so this is the field they are about to stand in. */
const BASE_COLOR = "#6d8f4b";
const TIP_COLOR = "#9cb56a";
const GROUND_COLOR = "#5b7740";

/** Matched to the wedge so the far grass is pure haze by the time its edge arrives. */
const FOG_NEAR = 13;
const FOG_FAR = 44;

const BODY_DISTANCE = 120;

interface GrassField {
  matrices: Float32Array;
  colors: Float32Array;
  phases: Float32Array;
}

/** Half-width of the scattered field at a given distance ahead of the lens. */
function halfWidthAt(depth: number): number {
  return EDGE_MARGIN + depth * COVER_TAN;
}

/** Scatters the wedge, dense at the lens and thinning into the fog. */
function buildGrassField(): GrassField {
  const dummy = new THREE.Object3D();
  const base = new THREE.Color(BASE_COLOR);
  const tip = new THREE.Color(TIP_COLOR);
  const color = new THREE.Color();

  const matrices = new Float32Array(GRASS_COUNT * 16);
  const colors = new Float32Array(GRASS_COUNT * 3);
  const phases = new Float32Array(GRASS_COUNT);

  for (let i = 0; i < GRASS_COUNT; i++) {
    const depth = MAX_DEPTH * Math.random() ** DEPTH_BIAS;
    const halfWidth = halfWidthAt(depth);
    const x = (Math.random() - 0.5) * 2 * halfWidth;
    // A little behind the lens as well as ahead of it, so the very bottom of the
    // frame is grass rather than a clean edge.
    const z = EYE[2] - depth + 2;

    dummy.position.set(x, 0, z);
    // Bigger with distance, exactly as the meadow's skirt is: a far clump has to
    // cover more ground to still read as a clump.
    dummy.scale.setScalar(0.62 + Math.random() * 0.8 + (depth / MAX_DEPTH) * 1.15);
    // Yaw jitter only. The clump geometry bakes in a shared lean so the field
    // reads as blown one way, and a full random spin averages that to nothing.
    dummy.rotation.set(0, (Math.random() - 0.5) * 0.9, 0);
    dummy.updateMatrix();
    dummy.matrix.toArray(matrices, i * 16);

    phases[i] = Math.random() * Math.PI * 2;
    color.copy(base).lerp(tip, Math.random() * 0.55);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return { matrices, colors, phases };
}

function GrassWedge() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const field = useMemo(() => buildGrassField(), []);
  const geometry = useMemo(() => buildClumpGeometry(), []);
  const material = useMemo(() => {
    // Rim off and both faces drawn, for the same reasons the meadow's is — see
    // the note in three/Grass.tsx.
    const grass = createGrassMaterial(BASE_COLOR, { rim: false });
    grass.side = THREE.DoubleSide;
    return grass;
  }, []);

  useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    instanced.instanceMatrix.set(field.matrices);
    instanced.instanceMatrix.needsUpdate = true;
    instanced.instanceColor = new THREE.InstancedBufferAttribute(field.colors, 3);
    instanced.instanceColor.needsUpdate = true;
    geometry.setAttribute("instancePhase", new THREE.InstancedBufferAttribute(field.phases, 1));
    // Nothing here culls — the wedge was cut to the frustum, so every clump is
    // on screen by construction and a bounding sphere would only be a chance to
    // get it wrong.
    instanced.frustumCulled = false;
  }, [field, geometry]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((state) => {
    const shader = material.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, GRASS_COUNT]} />;
}

/** Sky dome, sun or moon, and the light each of them casts. */
function TimeOfDay() {
  const { scene } = useThree();
  const sunLight = useRef<THREE.DirectionalLight>(null!);
  const moonLight = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const sunDisc = useRef<THREE.Mesh>(null!);
  const sunGlow = useRef<THREE.Sprite>(null!);
  const moonDisc = useRef<THREE.Mesh>(null!);
  const moonGlow = useRef<THREE.Sprite>(null!);

  const glow = useMemo(() => getGlowTexture(), []);
  const sunBody = useMemo(() => new THREE.Vector3(), []);
  const moonBody = useMemo(() => new THREE.Vector3(), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);

  // Read once at mount rather than per frame: this only gates whether the star
  // field is mounted at all, and nobody waits here long enough to cross dusk.
  const night = useMemo(() => !getSunState().isDay, []);

  // The meadow's dome, exposure and all — the same sky as behind the button.
  const sky = useMemo(() => createSkyDome(), []);

  useEffect(() => {
    scene.fog = new THREE.Fog(NIGHT_SKY.getHex(), FOG_NEAR, FOG_FAR);
    return () => {
      scene.fog = null;
      sky.material.dispose();
      sky.geometry.dispose();
    };
  }, [scene, sky]);

  useFrame(() => {
    const sun = getSunState();
    const moon = getMoonState();
    const day = daylight(sun);

    placeBody(sun, 80, sunDir);
    sky.material.uniforms.sunPosition.value.copy(sunDir).normalize();

    placeBody(sun, BODY_DISTANCE, sunBody);
    placeBody(moon, BODY_DISTANCE, moonBody);
    const sunUp = horizonFade(sun.elevation);
    const moonUp = horizonFade(moon.elevation);

    if (sunLight.current) {
      sunLight.current.position.copy(sunDir);
      sunLight.current.intensity = THREE.MathUtils.lerp(0, 1.7, day);
    }
    if (moonLight.current) {
      moonLight.current.position.copy(moonBody);
      // Deliberately generous, as in the meadow: a physically honest moon leaves
      // the field too dark to recognise as a field.
      moonLight.current.intensity = THREE.MathUtils.lerp(1.5, 0, day);
    }
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.lerp(0.55, 0.95, day);

    if (sunDisc.current) {
      sunDisc.current.position.copy(sunBody);
      sunDisc.current.visible = sunUp > 0.01;
      (sunDisc.current.material as THREE.MeshBasicMaterial).opacity = sunUp;
    }
    if (sunGlow.current) {
      sunGlow.current.position.copy(sunBody);
      sunGlow.current.visible = sunUp > 0.01;
      (sunGlow.current.material as THREE.SpriteMaterial).opacity = sunUp * SUN_GLOW_OPACITY;
      sunGlow.current.scale.setScalar(THREE.MathUtils.lerp(SUN_GLOW_WIDE, SUN_GLOW_TIGHT, day));
    }
    if (moonDisc.current) {
      moonDisc.current.position.copy(moonBody);
      moonDisc.current.visible = moonUp > 0.01;
      (moonDisc.current.material as THREE.MeshBasicMaterial).opacity = moonUp;
    }
    if (moonGlow.current) {
      moonGlow.current.position.copy(moonBody);
      moonGlow.current.visible = moonUp > 0.01;
      (moonGlow.current.material as THREE.SpriteMaterial).opacity = moonUp;
      moonGlow.current.scale.setScalar(THREE.MathUtils.lerp(26, 18, day));
    }

    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(NIGHT_SKY).lerp(DAY_SKY, day);
  });

  return (
    <>
      <primitive object={sky} />

      {/* Both bodies stand past FOG_FAR, so both opt out of the fog — hazed, they
          render as flat horizon colour at every hour. */}
      <mesh ref={sunDisc}>
        <sphereGeometry args={[SUN_DISC_RADIUS, 16, 16]} />
        <meshBasicMaterial color="#fff6de" fog={false} transparent depthWrite={false} />
      </mesh>
      <sprite ref={sunGlow} renderOrder={1}>
        <spriteMaterial map={glow} transparent depthWrite={false} fog={false} color="#ffe9bd" />
      </sprite>
      <mesh ref={moonDisc}>
        <sphereGeometry args={[3.4, 14, 14]} />
        <meshBasicMaterial color="#fdfbf4" fog={false} transparent depthWrite={false} />
      </mesh>
      <sprite ref={moonGlow} renderOrder={1}>
        <spriteMaterial map={glow} transparent depthWrite={false} fog={false} color="#eef2ff" />
      </sprite>

      {/* The same horizon treatment the meadow gets, so the sky behind the
          button and the sky behind the door are one sky — see `HorizonDome`. */}
      <HorizonDome radius={200} />

      {/* The same field the meadow itself shows, at the same radius: the
          backdrop and the world behind the button are the same sky half a
          second apart, and the stars should not resettle across the fade. */}
      {night && <NightStars radius={170} />}

      <hemisphereLight ref={hemi} args={["#bfe3f5", "#5a6b45", 0.6]} />
      <directionalLight ref={sunLight} color="#fff0d9" />
      <directionalLight ref={moonLight} color="#cdd9f5" />
    </>
  );
}

/** Ground under the grass, so the gaps between clumps aren't sky. */
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <circleGeometry args={[70, 24]} />
      <meshLambertMaterial color={GROUND_COLOR} />
    </mesh>
  );
}

/**
 * A drift, rather than a locked-off shot. Slow enough not to compete with the
 * text over it, and enough that the screen never looks like a still image while
 * someone is waiting on it.
 */
function DriftingCamera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...EYE);
    camera.lookAt(AIM);
  }, [camera]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    camera.position.x = EYE[0] + Math.sin(t * 0.055) * 1.1;
    camera.position.y = EYE[1] + Math.sin(t * 0.041) * 0.07;
    camera.lookAt(AIM);
  });

  return null;
}

/**
 * Keeps a WebGL failure off this screen in particular.
 *
 * The loading screen is the one thing that must render on any machine that can
 * run the site at all — it is where someone is told what to do, and it owns the
 * button that lets them in. This backdrop is decoration, so if the context fails
 * to come up it is dropped and the CSS gradient underneath is what shows. The
 * hall behind is already covered separately: `PATIENCE_MS` in LoadingScreen
 * unlocks the door whether or not a first frame ever arrives.
 */
class BackdropBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function LoadingBackdrop() {
  return (
    <BackdropBoundary>
      <div className="loading-backdrop" aria-hidden="true">
        <Canvas
          // Capped rather than uncapped: this is a backdrop behind a scrim, and
          // it is sharing the GPU with the hall compiling behind it — the one
          // thing on screen whose speed the visitor is actually waiting on.
          dpr={[1, 1.5]}
          camera={{ fov: 55, near: 0.1, far: 500, position: EYE }}
          gl={{ antialias: true, powerPreference: "low-power" }}
        >
          <TimeOfDay />
          <Ground />
          <GrassWedge />
          <Clouds />
          <DriftingCamera />
        </Canvas>
      </div>
    </BackdropBoundary>
  );
}
