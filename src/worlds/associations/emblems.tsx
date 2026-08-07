import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import type { AssociationId } from "./layout";

/**
 * What is painted on each envelope.
 *
 * All four are built from primitives at the same low resolution as the rest of
 * the hill, and all four are *shapes* rather than lettering — a balloon read
 * from a moving helicopter at twenty metres has about a second to say what it
 * is, and a word does not survive that. The exception is the fraternity, whose
 * whole identity is three Greek letters; those are drawn as bars rather than set
 * in type, both because the site's display face has no Greek and because
 * extruded glyphs at this size would read as mush.
 *
 * Every emblem is modelled at roughly unit size and scaled by the caller, so one
 * set of proportions serves four differently sized envelopes.
 */

/** A rugby ball: a sphere stretched along one axis, with a lace stripe over the seam. */
function RugbyBall({ laces = true }: { laces?: boolean }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh material={flatMat(PALETTE.rugbyBall)} scale={[0.62, 1, 0.62]}>
        <sphereGeometry args={[0.5, 8, 6]} />
      </mesh>
      {laces && (
        <>
          <mesh material={flatMat(PALETTE.rugbyLace)} position={[0, 0, 0.3]} scale={[0.1, 0.62, 0.1]}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {[-0.16, 0, 0.16].map((y) => (
            <mesh key={y} material={flatMat(PALETTE.rugbyLace)} position={[0, y, 0.34]}>
              <boxGeometry args={[0.22, 0.045, 0.06]} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

/** UCLA Rugby: the ball alone, on the blue and gold. */
function UclaRugbyEmblem() {
  return <RugbyBall />;
}

/**
 * Olympic Club Rugby: a ring over a ball.
 *
 * The ring is the club's "O", and it is the entire reason this balloon is not
 * mistaken for the other rugby one — see the note on the colours in `palette.ts`.
 * The ball sits behind it so the balloon still says rugby at a glance.
 */
function OlympicRugbyEmblem() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.olympicRing)} position={[0, 0, 0.12]}>
        <torusGeometry args={[0.52, 0.11, 5, 12]} />
      </mesh>
      <group scale={0.62} position={[0, 0, -0.06]}>
        <RugbyBall laces={false} />
      </group>
    </group>
  );
}

/** A bar of a Greek letter: a slab rotated about Z, positioned by its centre. */
function Stroke({
  x,
  y,
  length,
  angle,
  thickness = 0.12,
}: {
  x: number;
  y: number;
  length: number;
  angle: number;
  thickness?: number;
}) {
  return (
    <mesh
      material={flatMat(PALETTE.lambdaLetter)}
      position={[x, y, 0.07]}
      rotation={[0, 0, angle]}
    >
      <boxGeometry args={[thickness, length, 0.08]} />
    </mesh>
  );
}

/**
 * Lambda Chi Alpha: the three letters on a crest.
 *
 * Λ and Α are both a pair of legs leaning together, and the only thing that
 * separates them is Α's crossbar — so the alpha is drawn a touch wider as well,
 * or at this size the two read as the same letter twice.
 */
function LambdaChiEmblem() {
  const lean = 0.33;
  return (
    <group>
      {/* The crest: a shield, squared at the shoulders and pointed at the base. */}
      <mesh material={flatMat(PALETTE.lambdaCrest)} position={[0, 0.12, 0]}>
        <boxGeometry args={[1.24, 0.92, 0.09]} />
      </mesh>
      <mesh material={flatMat(PALETTE.lambdaCrest)} position={[0, -0.5, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.88, 0.88, 0.09]} />
      </mesh>

      {/* Λ */}
      <group position={[-0.4, 0.14, 0]} scale={0.78}>
        <Stroke x={-0.11} y={0} length={0.6} angle={lean} />
        <Stroke x={0.11} y={0} length={0.6} angle={-lean} />
      </group>
      {/* Χ */}
      <group position={[0, 0.14, 0]} scale={0.78}>
        <Stroke x={0} y={0} length={0.62} angle={0.62} />
        <Stroke x={0} y={0} length={0.62} angle={-0.62} />
      </group>
      {/* Α */}
      <group position={[0.4, 0.14, 0]} scale={0.78}>
        <Stroke x={-0.13} y={0} length={0.6} angle={lean * 1.15} />
        <Stroke x={0.13} y={0} length={0.6} angle={-lean * 1.15} />
        <Stroke x={0} y={-0.1} length={0.24} angle={Math.PI / 2} thickness={0.1} />
      </group>
    </group>
  );
}

/** Statistics & Data Science Club: four rising bars on a plate, with an axis under them. */
function StatsEmblem() {
  const bars = [0.3, 0.52, 0.42, 0.78];
  return (
    <group>
      <mesh material={flatMat(PALETTE.statsPlate)} position={[0, 0, 0]}>
        <boxGeometry args={[1.24, 1.06, 0.09]} />
      </mesh>
      {bars.map((height, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.statsBar)}
          // Grown from a common baseline rather than centred, so the four read as
          // a chart rather than as four floating tiles.
          position={[-0.42 + i * 0.28, -0.34 + height / 2, 0.08]}
        >
          <boxGeometry args={[0.19, height, 0.07]} />
        </mesh>
      ))}
      <mesh material={flatMat(PALETTE.statsBar)} position={[0, -0.38, 0.08]}>
        <boxGeometry args={[1.02, 0.06, 0.07]} />
      </mesh>
    </group>
  );
}

export function Emblem({ id, scale }: { id: AssociationId; scale: number }) {
  return (
    <group scale={scale}>
      {id === "ucla-rugby" && <UclaRugbyEmblem />}
      {id === "olympic-rugby" && <OlympicRugbyEmblem />}
      {id === "lambda-chi" && <LambdaChiEmblem />}
      {id === "stats-club" && <StatsEmblem />}
    </group>
  );
}
