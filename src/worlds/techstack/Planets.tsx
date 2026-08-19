import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRimToonMaterial } from "../../utils/toon";
import { getPlanetTexture } from "./planetTexture";
import { DISTANT_PLANETS, PLANET_RADIUS, type DistantPlanet } from "./layout";

/** How fast the main planet turns on its axis, radians per second. */
const SPIN_SPEED = 0.035;
/** Axial tilt, so the poles aren't dead vertical. */
const AXIAL_TILT = 0.32;

/**
 * The main planet: light royal blue, sitting at the origin with all four chip
 * shells around it, and dead ahead of the player at spawn.
 *
 * Toon-shaded like everything else on the site, with the surface carried by a
 * canvas map rather than geometry (see `planetTexture.ts`). The atmosphere is a
 * second, slightly larger sphere rendered back-faces-only and additively — a
 * cheap standby for a real scattering shell that reads correctly precisely
 * because you only ever see it around the planet's limb.
 */
export function MainPlanet() {
  const planet = useRef<THREE.Group>(null!);

  const surface = useMemo(
    () => createRimToonMaterial("#ffffff", { map: getPlanetTexture(), color: "#cfe4ff", strength: 0.34 }),
    []
  );

  const atmosphere = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#7fb4ff",
        transparent: true,
        opacity: 0.16,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useFrame((state) => {
    if (planet.current) planet.current.rotation.y = state.clock.elapsedTime * SPIN_SPEED;
  });

  return (
    <group rotation={[0, 0, AXIAL_TILT]}>
      <group ref={planet}>
        <mesh material={surface}>
          <sphereGeometry args={[PLANET_RADIUS, 64, 48]} />
        </mesh>
      </group>
      <mesh material={atmosphere} scale={1.045}>
        <sphereGeometry args={[PLANET_RADIUS, 32, 24]} />
      </mesh>
    </group>
  );
}

/**
 * One distant body at the local origin: the banded sphere, and the ring when
 * its spec asks for one.
 *
 * Split out from `DistantPlanets` so the balcony telescope can hang the same
 * bodies in its own sky — the night eyepiece shows *these* planets, not lookal-
 * ikes, and the only honest way to guarantee that is for both views to render
 * the one component from the one spec.
 *
 * Flat-shaded rather than textured — at this distance a map would be a handful
 * of pixels, and the banding does the same job for nothing.
 */
export function DistantPlanetBody({ planet }: { planet: DistantPlanet }) {
  const materials = useMemo(
    () => ({
      surface: createRimToonMaterial(planet.color, { strength: 0.3 }),
      band: createRimToonMaterial(planet.accent, { strength: 0.25 }),
      ring: planet.ring
        ? new THREE.MeshBasicMaterial({
            color: planet.accent,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false,
            toneMapped: false,
          })
        : null,
    }),
    [planet]
  );

  return (
    <group>
      <mesh material={materials.surface}>
        <sphereGeometry args={[planet.radius, 24, 18]} />
      </mesh>
      {/* A single banded latitude, scaled just proud of the surface. Gives
          each body an axis and a sense of rotation without a texture. */}
      <mesh material={materials.band} scale={[1.005, 0.3, 1.005]} position={[0, planet.radius * 0.22, 0]}>
        <sphereGeometry args={[planet.radius, 24, 12]} />
      </mesh>
      {materials.ring && (
        <mesh material={materials.ring} rotation={[Math.PI / 2 - 0.35, 0, 0.2]}>
          <ringGeometry args={[planet.radius * 1.5, planet.radius * 2.3, 64]} />
        </mesh>
      )}
    </group>
  );
}

/**
 * How each distant body tumbles, from its index — kept as a function so the
 * eyepiece can set the same body at the same attitude it holds out here.
 */
export function distantPlanetTumble(index: number): [number, number, number] {
  return [0.3 + index * 0.4, index * 0.9, 0.2 * index];
}

/**
 * The smaller bodies scattered between the chip shells and the starfield.
 *
 * They exist for parallax: with only the planet and a star sphere, floating
 * produces almost no sense of movement, because the stars are effectively at
 * infinity and the planet is the thing you are circling. Bodies at intermediate
 * distance are what make translation legible.
 */
export function DistantPlanets() {
  return (
    <>
      {DISTANT_PLANETS.map((planet, i) => (
        <group key={i} position={planet.position} rotation={distantPlanetTumble(i)}>
          <DistantPlanetBody planet={planet} />
        </group>
      ))}
    </>
  );
}
