import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRimToonMaterial } from "../../utils/toon";
import { getPlanetTexture } from "./planetTexture";
import { DISTANT_PLANETS, PLANET_RADIUS } from "./layout";

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
 * The smaller bodies scattered between the chip shells and the starfield.
 *
 * They exist for parallax: with only the planet and a star sphere, floating
 * produces almost no sense of movement, because the stars are effectively at
 * infinity and the planet is the thing you are circling. Bodies at intermediate
 * distance are what make translation legible.
 *
 * Flat-shaded rather than textured — at this distance a map would be a handful
 * of pixels, and the banding does the same job for nothing.
 */
export function DistantPlanets() {
  const bodies = useMemo(
    () =>
      DISTANT_PLANETS.map((planet) => ({
        ...planet,
        surface: createRimToonMaterial(planet.color, { strength: 0.3 }),
        band: createRimToonMaterial(planet.accent, { strength: 0.25 }),
        ringMaterial: planet.ring
          ? new THREE.MeshBasicMaterial({
              color: planet.accent,
              transparent: true,
              opacity: 0.4,
              side: THREE.DoubleSide,
              depthWrite: false,
              toneMapped: false,
            })
          : null,
      })),
    []
  );

  return (
    <>
      {bodies.map((body, i) => (
        <group key={i} position={body.position} rotation={[0.3 + i * 0.4, i * 0.9, 0.2 * i]}>
          <mesh material={body.surface}>
            <sphereGeometry args={[body.radius, 24, 18]} />
          </mesh>
          {/* A single banded latitude, scaled just proud of the surface. Gives
              each body an axis and a sense of rotation without a texture. */}
          <mesh material={body.band} scale={[1.005, 0.3, 1.005]} position={[0, body.radius * 0.22, 0]}>
            <sphereGeometry args={[body.radius, 24, 12]} />
          </mesh>
          {body.ringMaterial && (
            <mesh material={body.ringMaterial} rotation={[Math.PI / 2 - 0.35, 0, 0.2]}>
              <ringGeometry args={[body.radius * 1.5, body.radius * 2.3, 64]} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}
