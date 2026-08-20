import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { getGlowTexture } from "../../three/celestial";
import { nightAmount } from "../../utils/time";

/**
 * The burner under a hot air balloon, wherever one of them hangs on this site:
 * the clearing's four tethered ones, the cluster flying beyond its ridges, the
 * four in the telescope, and the four out of the interests room's window.
 *
 * It used to be written out twice, identically, in two of those places and
 * missing from the other two — which is how the range ended up dark after
 * sunset. A balloon is the one aircraft that carries its own light: it stays
 * up by burning, so at night the flame is not decoration on it, it is the only
 * thing that says it is still flying rather than painted on the sky. Stated
 * once here, every balloon on the site burns on the same rhythm and comes up
 * together as the sun goes down.
 *
 * Two cones, additive and unlit, because fire is a light source rather than a
 * lit surface: in daylight it washes out to a shimmer under the mouth and after
 * dark it pops, both for free. And out of the fog for the same reason the sun
 * and moon are — see `ClearingLighting` — or the far cluster's burners, three
 * hundred units out, would be a third of the way to the night sky's own colour.
 */

/**
 * How much of the burner is lit between bursts, by day and once it is fully
 * dark.
 *
 * A real burner idles on a pilot light and opens up for a second or two out of
 * every cycle to hold its height, and by day that is the whole of it: the
 * balloon is lit by the sun, the flame is a detail on it. After dark the idle
 * is all there is to see for most of the cycle, and at a sixth of full it went
 * out between bursts — four balloons that vanished and lit and vanished again.
 * The night pilot is set where the flame reads continuously and a burst still
 * clearly *is* a burst.
 */
const PILOT_DAY = 0.16;
const PILOT_NIGHT = 0.66;

/** The burst: slow, and raised to a high power so the sine sits near zero most of its cycle. */
const BURST_SPEED = 0.27;
const BURST_SHARPNESS = 10;

interface BurnerFlameProps {
  /**
   * The outer cone's height, in whatever space this is dropped into. The
   * clearing's balloons and the telescope's both come out at about one world
   * unit, which is what a burner's flame actually is; the far cluster asks for
   * more, and says why where it does.
   */
  size?: number;
  /** Decorrelates this burner's rhythm from the others'. */
  phase?: number;
  /**
   * Across of the warm halo the flame throws after dark, in the same space.
   *
   * The halo is the part that survives distance. A flame a metre tall is a
   * pixel from three hundred units away and nothing at all through a window,
   * where a soft warm disc four times its size is still a spark you can point
   * at — which is the whole ask of a night burner. Nothing of it shows by day.
   */
  halo?: number;
}

export function BurnerFlame({ size = 1, phase = 0, halo = size * 3.4 }: BurnerFlameProps) {
  const flame = useRef<THREE.Group>(null!);
  const glow = useRef<THREE.Sprite>(null!);

  const texture = useMemo(() => getGlowTexture(), []);

  const materials = useMemo(() => {
    const cones = [PALETTE.flameOuter, PALETTE.flameInner].map(
      (color) =>
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        })
    );
    const wash = new THREE.SpriteMaterial({
      map: texture,
      color: PALETTE.flameOuter,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    return { cones, wash };
  }, [texture]);

  useEffect(
    () => () => {
      materials.cones.forEach((m) => m.dispose());
      materials.wash.dispose();
    },
    [materials]
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Read off the clock rather than off a light, because two of the four
    // places this hangs have no sun in them to ask. It crosses dusk on the same
    // curve the skies do, so the burners come up as the world goes down instead
    // of snapping on at six.
    const night = nightAmount();
    const pilot = THREE.MathUtils.lerp(PILOT_DAY, PILOT_NIGHT, night);

    const burst = Math.pow(Math.max(0, Math.sin(t * BURST_SPEED + phase * 2.3)), BURST_SHARPNESS);
    const shimmer = 0.8 + 0.2 * Math.sin(t * 21 + phase) * Math.sin(t * 15.7);
    const strength = (pilot + (1 - pilot) * burst) * shimmer;

    flame.current.scale.y = 0.45 + strength * 1.15;
    materials.cones[0].opacity = 0.28 + 0.6 * strength;
    materials.cones[1].opacity = 0.38 + 0.55 * strength;

    // The halo breathes with the burst rather than only brightening with it —
    // a burner opening up throws light further, not just harder.
    materials.wash.opacity = night * (0.16 + 0.34 * strength);
    glow.current.scale.setScalar(halo * (0.72 + 0.38 * strength));
  });

  return (
    // The cones sit above the origin so the animated y-scale stretches them
    // upward from the burner rather than through it.
    <group>
      {/* Behind the cones, and centred a little up them: it is the air around a
          flame that glows, not the jet itself. */}
      <sprite ref={glow} material={materials.wash} position={[0, size * 0.45, 0]} />
      <group ref={flame}>
        <mesh material={materials.cones[0]} position={[0, size * 0.5, 0]}>
          <coneGeometry args={[size * 0.17, size, 6]} />
        </mesh>
        <mesh material={materials.cones[1]} position={[0, size * 0.33, 0]}>
          <coneGeometry args={[size * 0.09, size * 0.66, 6]} />
        </mesh>
      </group>
    </group>
  );
}
