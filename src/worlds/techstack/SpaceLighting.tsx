import { BLACK_HOLE_POSITION } from "./layout";

/**
 * Lighting for the tech-stack system.
 *
 * Space is a hard lighting environment for toon shading: with a single key and
 * no ambient — which is physically what deep space is — every surface facing
 * away from the star drops into the ramp's bottom band and the object loses its
 * silhouette entirely against a black sky. So there is a deliberate lift here
 * that vacuum would not give you.
 *
 * No shadows anywhere in this world. The chips tumble in four independently
 * rotating rings around a sphere, which is close to the worst possible case for
 * a single shadow map: either the map covers the whole system and every chip is
 * a few texels, or it covers the chips and the planet stops casting.
 */
export function SpaceLighting() {
  return (
    <>
      {/* The system's star, off to one side and high, so the planet shows a clear
          terminator rather than being lit flat from the camera's direction. */}
      <directionalLight position={[38, 30, 22]} intensity={2.5} color="#fff4e2" />

      {/* Bounce off the planet, filling the chips' shadow sides from below with
          the blue they would actually pick up from it. */}
      <directionalLight position={[-14, -24, -8]} intensity={0.55} color="#5f7fd8" />

      {/* The black hole's accretion disc is the second brightest thing out here,
          so it gets its own warm key from its actual position. */}
      <pointLight position={BLACK_HOLE_POSITION} intensity={900} distance={260} color="#ff9a52" />

      {/* The lift described above. Low enough that the terminator survives. */}
      <ambientLight intensity={0.42} color="#8fa4d8" />
    </>
  );
}
