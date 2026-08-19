import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { createSkyDome, getGlowTexture, horizonFade, placeBody } from "../../three/celestial";
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
 * What the day fog leans toward while the sun is low. The dome's horizon goes
 * warm as the sun drops and a fog held at the noon grey under it read as a cold
 * bank the sunset stopped at; a lean toward this — never all the way — keeps
 * the far ground in the same evening as the sky over it.
 */
const DUSK_SKY = new THREE.Color("#d8c6b6");
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
 * How far up the sky the daytime haze band reaches, as the sine of its
 * elevation — about seven degrees.
 *
 * By day the same dome that carries the night sky is a band of haze instead:
 * fog colour at and below the horizon, gone this far above it. It is what joins
 * the two halves of the view. Everything past FOG_FAR — sea, apron, the outer
 * range — is flat fog colour, and the Sky dome above it is whatever its
 * scattering model says the horizon is at this hour: never quite the same
 * grey, and a hard line ruled across the frame at eye level wherever the two
 * met. Pinning the sky to the fog colour at the horizon and letting it out over
 * a few degrees turns the line into the haze a real horizon has.
 */
const HAZE_TOP = 0.12;
/**
 * Inside the camera's far plane and beyond every mountain. The sea and the
 * apron overrun this radius at their far corners, but both draw after the dome
 * — it renders first (renderOrder −2) and writes no depth, so the overlap never
 * shows.
 */
const HORIZON_DOME_RADIUS = 14000;

const horizonDomeVertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const horizonDomeFragmentShader = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uNight;
uniform float uHazeTop;
varying vec3 vDir;
void main() {
  // At night: horizon colour at and below eye level, darkening toward the
  // zenith — the smoothstep clamps, so the below-horizon sliver past the
  // apron's edge stays flat fog colour rather than mirroring the gradient.
  vec3 night = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, vDir.y));
  // By day: the same horizon colour as a band of haze, opaque at the horizon
  // and clear a few degrees up, with the Sky dome showing through above.
  float haze = 1.0 - smoothstep(0.0, uHazeTop, vDir.y);
  // Whatever the hour, the horizon itself is fog colour at full opacity — that
  // is the whole promise: the sky meets the far ground in one colour.
  //
  // No tonemapping or colorspace includes, deliberately: fog is mixed in after
  // both, in output space, so a fully fogged surface displays its colour's raw
  // hex. The dome has to make the same promise — run these colours through the
  // ACES curve and the sky meets the sea a step darker, a seam ruled across the
  // view at eye level. The uniforms are fed display-space values to match.
  gl_FragColor = vec4(mix(uHorizon, night, uNight), mix(haze, 1.0, uNight));
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

  // The shared dome — which takes the shader's own sun out, so the disc below
  // is the only one — with this world's hazier, hotter atmosphere and no
  // exposure of its own, exactly the look it had.
  const sky = useMemo(
    () =>
      createSkyDome({
        atmosphere: { turbidity: 4, rayleigh: 1.4, mieCoefficient: 0.01, mieDirectionalG: 0.85 },
        exposure: 1,
      }),
    []
  );

  const horizonDomeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: horizonDomeVertexShader,
        fragmentShader: horizonDomeFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        uniforms: {
          // Display-space on purpose — see the note in the fragment shader.
          uZenith: { value: NIGHT_ZENITH.clone().convertLinearToSRGB() },
          uHorizon: { value: NIGHT_SKY.clone().convertLinearToSRGB() },
          uNight: { value: 1 },
          uHazeTop: { value: HAZE_TOP },
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
      horizonDomeMaterial.dispose();
    };
  }, [scene, sky, horizonDomeMaterial]);

  useFrame(({ camera }) => {
    const sun = getSunState();
    const moon = getMoonState();
    const day = THREE.MathUtils.clamp(elevationFraction(sun.elevation) + 0.15, 0, 1);

    placeBody(sun, 90, sunDir);
    sky.material.uniforms.sunPosition.value.copy(sunDir).normalize();

    // From the camera, not the origin. The flight band runs two hundred units
    // up, and a body twelve hundred out that is placed from the ground sits
    // nine degrees lower than its elevation says from up there — a late sun
    // was drawn *below* the horizon line while the sky was still lit by it.
    placeBody(sun, BODY_DISTANCE, sunBody).add(camera.position);
    placeBody(moon, BODY_DISTANCE, moonBody).add(camera.position);
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

    // The handover starts as the sun crosses the horizon (day = 0.15) and is
    // done a few degrees up, once the dome's scattering is physical again.
    const nightAmount = 1 - THREE.MathUtils.smoothstep(day, 0.15, 0.4);

    // The fog goes to night on the same schedule as the sky, not ahead of it.
    // It used to fade toward navy across the whole of `day`, so by late
    // afternoon — the sun a hand above the horizon and the Sky dome still
    // bright — the far ground was already most of the way to night: a dark
    // sheet under a light sky, cut off along a ruler at eye level. Now it holds
    // the day grey (leaning warm as the sun gets low) for as long as the Sky
    // dome is up, and only turns with the dome.
    const dusk = 1 - THREE.MathUtils.smoothstep(elevationFraction(sun.elevation), 0.08, 0.4);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(DAY_SKY).lerp(DUSK_SKY, dusk * 0.6).lerp(NIGHT_SKY, nightAmount);

    horizonDomeMaterial.uniforms.uNight.value = nightAmount;
    // Sampled off the live fog rather than restating it, so the two cannot
    // drift — the fog is what the horizon is made of, at night as much as by
    // day. Converted because the fog uniform is uploaded in display space and
    // the dome's colours live there too.
    if (fog) {
      (horizonDomeMaterial.uniforms.uHorizon.value as THREE.Color)
        .copy(fog.color)
        .convertLinearToSRGB();
    }
    sky.visible = nightAmount < 0.999;
  });

  return (
    <>
      <primitive object={sky} />

      {/* The horizon dome: the night sky after dark, a band of haze along the
          horizon by day, and always the fog colour where the sky meets the far
          ground. Drawn before every other transparent thing (renderOrder −2)
          because it is the backdrop; depth-tested so the mountains still stand
          in front of it, and never culled because the camera always stands
          inside it. */}
      <mesh renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[HORIZON_DOME_RADIUS, 32, 16]} />
        <primitive object={horizonDomeMaterial} attach="material" />
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
