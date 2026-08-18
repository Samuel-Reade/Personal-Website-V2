import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Sky as SkyImpl } from "three/examples/jsm/objects/Sky.js";
import { getGlowTexture, horizonFade, placeBody } from "../../three/celestial";
import { elevationFraction, getMoonState, getSunState } from "../../utils/time";
import { FOG_FAR, FOG_NEAR } from "./layout";

/**
 * Sky, sun, moon and fog over the clearing, on the visitor's own clock.
 *
 * This is an outdoor world, so it runs the same clock as the meadow and the
 * archipelago — `utils/time.ts` for the hour, `three/celestial.ts` for where the
 * body sits and how it fades through the horizon. A hilltop that was always
 * mid-afternoon would be the one outdoor scene on the site that ignores what
 * time it is.
 */

const NIGHT_SKY = new THREE.Color("#1b2233");
/**
 * Matched to the Sky dome's own hazy horizon rather than to a generic daylight
 * blue. The fog is what the horizon is made of now — the apron and the sea both
 * resolve to this colour at distance — so any gap between it and the sky's
 * horizon tint would draw a seam exactly where the fade is supposed to be
 * seamless.
 */
const DAY_SKY = new THREE.Color("#c6d4dc");
/**
 * Past FOG_FAR, so both bodies opt out of the fog that would paint them flat —
 * and far past the flight band. At the old 150 the flight floor climbed above
 * the sun's own distance, and a mid-morning sun could sit visibly *below* the
 * helicopter. The discs and glows are scaled up by the same factor the distance
 * grew, so their apparent size is unchanged.
 */
const BODY_DISTANCE = 1200;

/**
 * The Sky dome's scattering model is only honest while the sun is up. Below the
 * horizon its extinction term inverts the sky — a muddy warm glow at the zenith,
 * darkness at the horizon, twilight upside down — and the seam where that meets
 * the navy fog runs across the view at eye level. So the dome only carries the
 * day: past dusk it hands over to this gradient, deep navy overhead falling to
 * exactly the fog colour at the horizon, which is what makes the sea and the sky
 * meet without an edge. The crossfade runs while the sun climbs its first few
 * degrees, where the dome's output is trustworthy again.
 */
const NIGHT_ZENITH = new THREE.Color("#0e1424");
/**
 * Inside the camera's far plane and beyond every mountain. The sea and the
 * apron overrun this radius at their far corners, but both draw after the dome
 * — it renders first (renderOrder −2) and writes no depth, so the overlap never
 * shows.
 */
const NIGHT_DOME_RADIUS = 14000;

const nightDomeVertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const nightDomeFragmentShader = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uOpacity;
varying vec3 vDir;
void main() {
  // Horizon colour at and below eye level, darkening toward the zenith — the
  // smoothstep clamps, so the below-horizon sliver past the apron's edge stays
  // flat fog colour rather than mirroring the gradient.
  //
  // No tonemapping or colorspace includes, deliberately: fog is mixed in after
  // both, in output space, so a fully fogged surface displays its colour's raw
  // hex. The dome has to make the same promise — run these colours through the
  // ACES curve and the sky meets the sea a step darker, a seam ruled across the
  // view at eye level. The uniforms are fed display-space values to match.
  gl_FragColor = vec4(mix(uHorizon, uZenith, smoothstep(0.0, 0.55, vDir.y)), uOpacity);
}
`;

export function ClearingLighting() {
  const { scene } = useThree();
  const sunLight = useRef<THREE.DirectionalLight>(null!);
  const fillLight = useRef<THREE.DirectionalLight>(null!);
  const moonLight = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const sunDisc = useRef<THREE.Mesh>(null!);
  const sunGlow = useRef<THREE.Sprite>(null!);
  const moonDisc = useRef<THREE.Mesh>(null!);
  const moonGlow = useRef<THREE.Sprite>(null!);

  const glow = useMemo(() => getGlowTexture(), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);
  const sunBody = useMemo(() => new THREE.Vector3(), []);
  const moonBody = useMemo(() => new THREE.Vector3(), []);

  // Read once: this only decides whether the star field is mounted, and nobody
  // flies here long enough to cross dusk.
  const night = useMemo(() => !getSunState().isDay, []);

  const sky = useMemo(() => {
    const dome = new SkyImpl();
    dome.scale.setScalar(450000);
    const u = dome.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.01;
    u.mieDirectionalG.value = 0.85;
    return dome;
  }, []);

  const nightDome = useRef<THREE.Mesh>(null!);
  const nightDomeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: nightDomeVertexShader,
        fragmentShader: nightDomeFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        uniforms: {
          // Display-space on purpose — see the note in the fragment shader.
          uZenith: { value: NIGHT_ZENITH.clone().convertLinearToSRGB() },
          uHorizon: { value: NIGHT_SKY.clone().convertLinearToSRGB() },
          uOpacity: { value: 0 },
        },
      }),
    []
  );

  useEffect(() => {
    scene.fog = new THREE.Fog(NIGHT_SKY.getHex(), FOG_NEAR, FOG_FAR);
    return () => {
      scene.fog = null;
      sky.material.dispose();
      sky.geometry.dispose();
      nightDomeMaterial.dispose();
    };
  }, [scene, sky, nightDomeMaterial]);

  useFrame(() => {
    const sun = getSunState();
    const moon = getMoonState();
    const day = THREE.MathUtils.clamp(elevationFraction(sun.elevation) + 0.15, 0, 1);

    placeBody(sun, 90, sunDir);
    sky.material.uniforms.sunPosition.value.copy(sunDir).normalize();

    placeBody(sun, BODY_DISTANCE, sunBody);
    placeBody(moon, BODY_DISTANCE, moonBody);
    const sunUp = horizonFade(sun.elevation);
    const moonUp = horizonFade(moon.elevation);

    if (sunLight.current) {
      sunLight.current.position.copy(sunDir);
      sunLight.current.intensity = THREE.MathUtils.lerp(0, 1.65, day);
    }
    if (fillLight.current) {
      fillLight.current.position.copy(sunDir).multiplyScalar(-1);
      fillLight.current.intensity = 0.28 * day + 0.1;
    }
    if (moonLight.current) {
      moonLight.current.position.copy(moonBody);
      // Generous, as in the meadow: an honest moon leaves four balloons as four
      // silhouettes, and the emblems are the entire point of them.
      moonLight.current.intensity = THREE.MathUtils.lerp(1.45, 0, day);
    }
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.lerp(0.55, 0.9, day);

    if (sunDisc.current) {
      sunDisc.current.position.copy(sunBody);
      sunDisc.current.visible = sunUp > 0.01;
      (sunDisc.current.material as THREE.MeshBasicMaterial).opacity = sunUp;
    }
    if (sunGlow.current) {
      sunGlow.current.position.copy(sunBody);
      sunGlow.current.visible = sunUp > 0.01;
      (sunGlow.current.material as THREE.SpriteMaterial).opacity = sunUp * 0.85;
      sunGlow.current.scale.setScalar(THREE.MathUtils.lerp(336, 224, day));
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
      moonGlow.current.scale.setScalar(THREE.MathUtils.lerp(256, 176, day));
    }

    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(NIGHT_SKY).lerp(DAY_SKY, day);

    // The handover starts as the sun crosses the horizon (day = 0.15) and is
    // done a few degrees up, once the dome's scattering is physical again.
    const nightAmount = 1 - THREE.MathUtils.smoothstep(day, 0.15, 0.4);
    nightDomeMaterial.uniforms.uOpacity.value = nightAmount;
    // Sampled off the live fog rather than restating it, so the two cannot
    // drift — the fog is what the horizon is made of, at night as much as by
    // day. Converted because the fog uniform is uploaded in display space and
    // the dome's colours live there too.
    if (fog) {
      (nightDomeMaterial.uniforms.uHorizon.value as THREE.Color)
        .copy(fog.color)
        .convertLinearToSRGB();
    }
    if (nightDome.current) nightDome.current.visible = nightAmount > 0.001;
    sky.visible = nightAmount < 0.999;
  });

  return (
    <>
      <primitive object={sky} />

      {/* The night sky, faded in as the Sky dome above fades out. Drawn before
          every other transparent thing (renderOrder −2) because it is the
          backdrop; depth-tested so the mountains still stand in front of it, and
          never culled because the camera always stands inside it. */}
      <mesh ref={nightDome} renderOrder={-2} frustumCulled={false} visible={false}>
        <sphereGeometry args={[NIGHT_DOME_RADIUS, 32, 16]} />
        <primitive object={nightDomeMaterial} attach="material" />
      </mesh>

      <mesh ref={sunDisc}>
        <sphereGeometry args={[42, 16, 16]} />
        <meshBasicMaterial color="#fff6de" fog={false} transparent depthWrite={false} />
      </mesh>
      <sprite ref={sunGlow} renderOrder={1}>
        <spriteMaterial map={glow} transparent depthWrite={false} fog={false} color="#ffe9bd" />
      </sprite>
      <mesh ref={moonDisc}>
        <sphereGeometry args={[34, 14, 14]} />
        <meshBasicMaterial color="#fdfbf4" fog={false} transparent depthWrite={false} />
      </mesh>
      <sprite ref={moonGlow} renderOrder={1}>
        <spriteMaterial map={glow} transparent depthWrite={false} fog={false} color="#eef2ff" />
      </sprite>

      {/* Pushed out with the sun and moon — a 220-unit star shell would now sit
          *below* the flight band, with the player looking down on the night sky. */}
      {night && <Stars radius={3200} depth={600} count={2400} factor={40} fade speed={0.4} />}

      <hemisphereLight ref={hemi} args={["#bfe3f5", "#5a6b45", 0.6]} />
      <directionalLight ref={sunLight} color="#fff0d9" />
      <directionalLight ref={fillLight} color="#8fb0d6" />
      <directionalLight ref={moonLight} color="#cdd9f5" />
    </>
  );
}
