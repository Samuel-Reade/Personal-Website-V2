import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { daylight, getSunState, nightAmount } from "../utils/time";

/**
 * The join between the sky and the ground, and the night sky itself.
 *
 * Three's Sky is a Preetham model, and the model is only honest while the sun
 * is above the horizon. Below it the extinction term inverts: a muddy warm
 * glow at the zenith, darkness at the horizon — twilight upside down — with a
 * seam ruled across the view at eye level where it meets the fog. So the dome
 * carries the day and this carries the night, crossfading while the sun climbs
 * its first few degrees, where the scattering is trustworthy again.
 *
 * By day the same surface is a band of haze instead: fog colour at and below
 * the horizon, gone a few degrees above it. That is what joins the two halves
 * of an outdoor view. Everything past the world's fog distance is flat fog
 * colour, and the Sky dome above it is whatever the model says the horizon is
 * at this hour — never quite the same grey, and a hard line wherever the two
 * met.
 *
 * The range worked this out first and kept a copy of its own; this is that
 * technique made shared, so the meadow, the sea and the loading backdrop all
 * meet their horizons the same way and all show the same night.
 */

/**
 * Overhead colour after dark. Near-black, with just enough blue left in it to
 * read as sky rather than as a hole in the frame — the horizon keeps the
 * lighter end of the gradient, which is where a real night sky is brightest
 * anyway. Deep enough that the stars are unambiguously the brightest thing up
 * there; the world below stays legible on its moonlight, not on its sky.
 */
const NIGHT_ZENITH = new THREE.Color("#04060b");
/**
 * How far up the sky the daytime haze band reaches, as the sine of its
 * elevation — about seven degrees.
 */
const HAZE_TOP = 0.12;

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uNight;
uniform float uHazeTop;
varying vec3 vDir;
void main() {
  // At night: horizon colour at and below eye level, darkening toward the
  // zenith. The smoothstep clamps, so the below-horizon sliver past the
  // world's rim stays flat fog colour rather than mirroring the gradient.
  vec3 night = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, vDir.y));
  // By day: the same horizon colour as a band of haze, opaque at the horizon
  // and clear a few degrees up, with the Sky dome showing through above.
  float haze = 1.0 - smoothstep(0.0, uHazeTop, vDir.y);
  // Whatever the hour, the horizon itself is fog colour at full opacity — that
  // is the whole promise: the sky meets the far ground in one colour.
  //
  // No tonemapping or colorspace includes, deliberately: fog is mixed in after
  // both, in output space, so a fully fogged surface displays its colour's raw
  // hex. This has to make the same promise — run these colours through the ACES
  // curve and the sky meets the ground a step darker, which is the seam again.
  // The uniforms are fed display-space values to match.
  gl_FragColor = vec4(mix(uHorizon, night, uNight), mix(haze, 1.0, uNight));
}
`;

interface HorizonDomeProps {
  /**
   * How far out the shell sits. Put it outside everything the world draws in
   * the sky — the sun and moon discs especially — and inside the camera's far
   * plane. The dome follows the camera, so that margin holds wherever the
   * player walks.
   */
  radius: number;
  /**
   * Set by a world that runs an `EffectComposer`.
   *
   * The shader writes finished, display-space colour (see the note in it), and
   * on a world that renders straight to the canvas that is exactly right. A
   * composer changes the contract underneath it: the scene is drawn into a
   * linear buffer and the chain encodes once at the very end, so the same
   * fragment gets encoded a second time and every dark value is lifted —
   * measurably, the meadow's night sky sat at #343f4c where the archipelago's
   * identical sky sat at #0b1017. Handing the composer linear values instead
   * lets its own encode land them in the same place.
   */
  composited?: boolean;
}

export function HorizonDome({ radius, composited = false }: HorizonDomeProps) {
  const mesh = useRef<THREE.Mesh>(null!);
  const horizon = useMemo(() => new THREE.Color(), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        uniforms: {
          uZenith: {
            value: composited ? NIGHT_ZENITH.clone() : NIGHT_ZENITH.clone().convertLinearToSRGB(),
          },
          uHorizon: { value: new THREE.Color() },
          uNight: { value: 1 },
          uHazeTop: { value: HAZE_TOP },
        },
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, scene }) => {
    const sun = getSunState();
    const day = daylight(sun);

    // The handover runs from sunset to the end of nautical twilight — see
    // `nightAmount`, which the range's fog and the meadow's stars read too, so
    // the three turn over together.
    material.uniforms.uNight.value = nightAmount(sun);

    // Sampled off the world's live fog rather than re-derived from a pair of
    // colours passed in. The promise this dome makes is precisely that the sky
    // meets the far ground in one colour, and the far ground *is* the fog —
    // so reading it is the only way the two cannot drift. It also means a
    // world with its own ideas about haze (the range leans warm while the sun
    // is low) gets a sky that leans with it, for free. Converted because the
    // uniform is read in display space; see the note in the shader.
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      horizon.copy(fog.color);
      if (!composited) horizon.convertLinearToSRGB();
      (material.uniforms.uHorizon.value as THREE.Color).copy(horizon);
    }

    // Follows the camera so the shell is always exactly `radius` away: parked
    // at the origin, its far wall sits radius-plus-however-far-the-player-has-
    // walked out, which on a world whose camera far plane is tight enough
    // punches a hole in the sky at the edge of the map.
    if (mesh.current) mesh.current.position.copy(camera.position);
  });

  return (
    // Drawn before everything else transparent (renderOrder −2) because it is
    // the backdrop, and never culled because the camera is always inside it.
    <mesh ref={mesh} material={material} renderOrder={-2} frustumCulled={false}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
}
