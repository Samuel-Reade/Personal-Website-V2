import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BLACK_HOLE_POSITION, BLACK_HOLE_RADIUS } from "./layout";

/**
 * The black hole on the far side of the system.
 *
 * Real gravitational lensing needs a screen-space pass that bends whatever is
 * behind the object, which this world has no composer for — and adding one for a
 * single distant prop would put a full-screen render target on every frame of a
 * scene that otherwise doesn't need one.
 *
 * What it does instead is the geometry trick the effect is famous for: as well
 * as the accretion disc lying in its own plane, a second copy of the disc stands
 * perpendicular to it, arcing over and under the core. That vertical halo is
 * what lensing actually produces — the far side of the disc bent up over the top
 * of the hole and down beneath it — so the silhouette reads correctly from any
 * angle without a single extra pass.
 */

const DISC_INNER = BLACK_HOLE_RADIUS * 1.35;
const DISC_OUTER = BLACK_HOLE_RADIUS * 3.1;

/** Hot inner edge through to the cooler outer rim. */
const HOT = new THREE.Color("#fff1c4");
const MID = new THREE.Color("#ffab4d");
const COOL = new THREE.Color("#e0542c");

const discVertex = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Radial temperature gradient plus a set of sheared bands that rotate faster at
 * the inner edge than the outer — differential rotation, which is what stops the
 * disc reading as a solid spinning plate.
 */
const discFragment = /* glsl */ `
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  uniform float uOpacity;
  uniform vec3 uHot;
  uniform vec3 uMid;
  uniform vec3 uCool;
  varying vec2 vLocal;

  void main() {
    float r = length(vLocal);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);

    vec3 color = t < 0.5
      ? mix(uHot, uMid, t * 2.0)
      : mix(uMid, uCool, (t - 0.5) * 2.0);

    // Keplerian-ish shear: angular speed falls off with radius.
    float angle = atan(vLocal.y, vLocal.x);
    float shear = uTime * (1.9 / pow(max(r, 0.001) / uInner, 1.5));
    float bands = 0.72 + 0.28 * sin(angle * 3.0 + shear * 3.0)
                       + 0.16 * sin(angle * 7.0 - shear * 1.7);

    // Fade at both rims so the ring has no hard cut at either edge.
    float alpha = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.6, 1.0, t));
    // Brightest right at the inner edge, where the material is hottest.
    alpha *= mix(1.0, 0.45, t);

    gl_FragColor = vec4(color * bands, alpha * uOpacity);
  }
`;

function createDiscMaterial(opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: DISC_INNER },
      uOuter: { value: DISC_OUTER },
      uOpacity: { value: opacity },
      uHot: { value: HOT },
      uMid: { value: MID },
      uCool: { value: COOL },
    },
    vertexShader: discVertex,
    fragmentShader: discFragment,
    transparent: true,
    side: THREE.DoubleSide,
    // Additive so the disc glows against the starfield instead of occluding it,
    // and depthWrite off so the two crossed copies don't clip one another.
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export function BlackHole() {
  const photonRing = useRef<THREE.Group>(null!);

  const discMaterial = useMemo(() => createDiscMaterial(1), []);
  const haloMaterial = useMemo(() => createDiscMaterial(0.55), []);

  /** The event horizon: pure black, and unlit so nothing ever lifts it off black. */
  const coreMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#000000", toneMapped: false }),
    []
  );

  /**
   * The photon sphere — the thin bright circle light traces around the horizon.
   * Billboarded, because from any viewpoint it is always a circle centred on the
   * core; a fixed ring would flatten to a line as you moved around it.
   */
  const photonMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffd9a0",
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    discMaterial.uniforms.uTime.value = elapsed;
    haloMaterial.uniforms.uTime.value = elapsed;
    if (photonRing.current) photonRing.current.lookAt(state.camera.position);
  });

  return (
    <group position={BLACK_HOLE_POSITION} rotation={[0, 0.6, 0.22]}>
      {/* Slightly under the photon ring's inner edge, so the ring reads as
          hugging the horizon rather than floating off it. */}
      <mesh material={coreMaterial}>
        <sphereGeometry args={[BLACK_HOLE_RADIUS, 32, 24]} />
      </mesh>

      <group ref={photonRing}>
        <mesh material={photonMaterial}>
          <ringGeometry args={[BLACK_HOLE_RADIUS * 1.02, BLACK_HOLE_RADIUS * 1.13, 96]} />
        </mesh>
      </group>

      {/* The disc, lying in the hole's equatorial plane and tipped toward the
          player so it reads as a disc and not a line. */}
      <mesh material={discMaterial} rotation={[Math.PI / 2 - 0.42, 0, 0]}>
        <ringGeometry args={[DISC_INNER, DISC_OUTER, 128, 1]} />
      </mesh>

      {/* The lensed halo: the same disc stood on edge, which is where the light
          from the disc's far side actually appears. */}
      <mesh material={haloMaterial} rotation={[Math.PI / 2 - 0.42, Math.PI / 2, 0]}>
        <ringGeometry args={[DISC_INNER, DISC_OUTER, 128, 1]} />
      </mesh>
    </group>
  );
}
