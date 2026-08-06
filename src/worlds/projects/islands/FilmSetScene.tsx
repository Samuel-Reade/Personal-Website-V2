import { PALETTE } from "../palette";
import { flatMat, flatMatUnique } from "../materials";
import { useEffect, useMemo } from "react";

/**
 * Netflix success: the television is the subject, and a working film set is
 * built around it — camera on a tripod aimed at the screen, lamps on stands,
 * clapperboard, director's chair, flats and film cans.
 *
 * Everything faces inward at the set, so from the boat the island reads as a
 * production in progress rather than as props parked in a field.
 */

function Television() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.tvTrim)} position={[0, 0.22, 0]}>
        <boxGeometry args={[1.5, 0.44, 1.0]} />
      </mesh>
      <mesh material={flatMat(PALETTE.tvBody)} position={[0, 1.45, 0]}>
        <boxGeometry args={[2.7, 2.0, 1.5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.tvScreen)} position={[0, 1.5, 0.77]}>
        <boxGeometry args={[2.1, 1.5, 0.06]} />
      </mesh>
      {[1.75, 1.5].map((y, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.tvKnob)}
          position={[1.15, y, 0.77]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.11, 0.11, 0.07, 6]} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={flatMat(PALETTE.tvTrim)}
          position={[side * 0.42, 3.05, -0.2]}
          rotation={[0.12, 0, side * 0.42]}
        >
          <cylinderGeometry args={[0.032, 0.045, 1.5, 5]} />
        </mesh>
      ))}
    </group>
  );
}

/** Shared by every leg of every tripod on the set. */
function TripodLegs({ height, spread }: { height: number; spread: number }) {
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            material={flatMat(PALETTE.tripod)}
            position={[Math.cos(angle) * spread * 0.5, height * 0.5, Math.sin(angle) * spread * 0.5]}
            rotation={[Math.sin(angle) * 0.26, 0, -Math.cos(angle) * 0.26]}
          >
            <cylinderGeometry args={[0.04, 0.04, height, 5]} />
          </mesh>
        );
      })}
    </group>
  );
}

function FilmCamera() {
  return (
    <group>
      <TripodLegs height={1.5} spread={0.8} />
      <group position={[0, 1.62, 0]}>
        <mesh material={flatMat(PALETTE.cameraBody)}>
          <boxGeometry args={[0.56, 0.5, 0.9] } />
        </mesh>
        {/* Lens, pointed at +Z — the set is arranged so this looks at the screen. */}
        <mesh material={flatMat(PALETTE.cameraLens)} position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.17, 0.2, 0.42, 8]} />
        </mesh>
        {/* Magazines on top, the detail that makes a box read as a film camera. */}
        {[-0.17, 0.17].map((z, i) => (
          <mesh key={i} material={flatMat(PALETTE.reel)} position={[0, 0.38, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.26, 0.26, 0.14, 9]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.tripod)} position={[0.34, -0.06, -0.36]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.5, 5]} />
        </mesh>
      </group>
    </group>
  );
}

/** A lamp on a stand. The head is emissive so the set reads as lit by its own rig. */
function SetLight({ tilt = -0.5 }: { tilt?: number }) {
  const glow = useMemo(
    () => flatMatUnique(PALETTE.lightGlow, { emissive: PALETTE.lightGlow, emissiveIntensity: 0.85 }),
    []
  );
  useEffect(() => () => glow.dispose(), [glow]);

  return (
    <group>
      <TripodLegs height={2.0} spread={0.7} />
      <mesh material={flatMat(PALETTE.tripod)} position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.4, 5]} />
      </mesh>
      <group position={[0, 2.2, 0]} rotation={[tilt, 0, 0]}>
        <mesh material={flatMat(PALETTE.lightHead)}>
          <boxGeometry args={[0.5, 0.44, 0.34]} />
        </mesh>
        <mesh material={glow} position={[0, 0, 0.2]}>
          <boxGeometry args={[0.4, 0.34, 0.04]} />
        </mesh>
        {/* Barn doors */}
        {[
          [0, 0.3, 0.55, 0],
          [0, -0.3, -0.55, 0],
        ].map(([x, y, rot], i) => (
          <mesh
            key={i}
            material={flatMat(PALETTE.lightHead)}
            position={[x, y, 0.26]}
            rotation={[rot as number, 0, 0]}
          >
            <boxGeometry args={[0.5, 0.22, 0.03]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Clapperboard() {
  return (
    <group rotation={[-0.35, 0, 0.12]}>
      <mesh material={flatMat(PALETTE.clapperBody)} position={[0, 0.36, 0]}>
        <boxGeometry args={[1.0, 0.72, 0.06]} />
      </mesh>
      {/* The hinged arm, held open. */}
      <group position={[-0.5, 0.74, 0.02]} rotation={[0, 0, -0.34]}>
        <mesh material={flatMat(PALETTE.clapperBody)} position={[0.5, 0.07, 0]}>
          <boxGeometry args={[1.0, 0.16, 0.06]} />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh
            key={i}
            material={flatMat(PALETTE.clapperStripe)}
            position={[0.12 + i * 0.2, 0.07, 0.035]}
            rotation={[0, 0, 0.34]}
          >
            <boxGeometry args={[0.1, 0.17, 0.02]} />
          </mesh>
        ))}
      </group>
      {/* Slate lines on the body */}
      {[0.5, 0.34, 0.18].map((y, i) => (
        <mesh key={i} material={flatMat(PALETTE.clapperStripe)} position={[0, y, 0.035]}>
          <boxGeometry args={[0.78, 0.04, 0.02]} />
        </mesh>
      ))}
    </group>
  );
}

function DirectorChair() {
  return (
    <group>
      {[
        [-0.28, -0.24],
        [0.28, -0.24],
        [-0.28, 0.24],
        [0.28, 0.24],
      ].map(([x, z], i) => (
        <mesh key={i} material={flatMat(PALETTE.tripod)} position={[x, 0.44, z]} rotation={[0, 0, x > 0 ? -0.1 : 0.1]}>
          <cylinderGeometry args={[0.035, 0.035, 0.88, 5]} />
        </mesh>
      ))}
      <mesh material={flatMat(PALETTE.chairCanvas)} position={[0, 0.88, 0]}>
        <boxGeometry args={[0.66, 0.08, 0.54]} />
      </mesh>
      <mesh material={flatMat(PALETTE.chairCanvas)} position={[0, 1.28, -0.26]}>
        <boxGeometry args={[0.66, 0.3, 0.07]} />
      </mesh>
      {[-0.33, 0.33].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.tripod)} position={[x, 1.14, -0.26]}>
          <cylinderGeometry args={[0.03, 0.03, 0.52, 5]} />
        </mesh>
      ))}
    </group>
  );
}

/** Scenery flats propped at the back of the set. */
function Flats() {
  return (
    <group>
      {[
        [-1.5, 0.2, 2.6, 3.0],
        [1.4, -0.16, 2.2, 2.4],
        [3.3, -0.4, 1.8, 2.0],
      ].map(([x, rot, w, h], i) => (
        <group key={i} position={[x, 0, 0]} rotation={[0, rot, 0]}>
          <mesh material={flatMat(i % 2 === 0 ? PALETTE.setFlat : PALETTE.setFlatAlt)} position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, 0.12]} />
          </mesh>
          {/* Brace behind, so the flat reads as standing rather than growing. */}
          <mesh material={flatMat(PALETTE.tripod)} position={[0, h * 0.3, -0.5]} rotation={[0.6, 0, 0]}>
            <boxGeometry args={[0.08, h * 0.8, 0.08]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FilmCans() {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={flatMat(PALETTE.reel)} position={[i * 0.05, 0.07 + i * 0.13, i * 0.04]}>
          <cylinderGeometry args={[0.34, 0.34, 0.12, 10]} />
        </mesh>
      ))}
      <mesh material={flatMat(PALETTE.reel)} position={[0.7, 0.34, 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.34, 0.34, 0.12, 10]} />
      </mesh>
    </group>
  );
}

export function FilmSetScene() {
  return (
    <group>
      <Television />

      {/* Flats behind the set, screening off the back of the island. */}
      <group position={[-0.6, 0, -2.6]}>
        <Flats />
      </group>

      {/* Camera front and centre, looking back at the screen (+Z faces the TV
          because the camera sits on the far side of it). */}
      <group position={[0.3, 0, 3.5]} rotation={[0, Math.PI, 0]}>
        <FilmCamera />
      </group>

      <group position={[-3.1, 0, 2.2]} rotation={[0, 0.9, 0]}>
        <SetLight tilt={-0.45} />
      </group>
      <group position={[3.2, 0, 1.5]} rotation={[0, -0.8, 0]}>
        <SetLight tilt={-0.55} />
      </group>

      <group position={[-2.4, 0, 3.4]} rotation={[0, 0.55, 0]}>
        <DirectorChair />
      </group>
      <group position={[-1.5, 0, 4.0]} rotation={[0, 0.3, 0]}>
        <Clapperboard />
      </group>
      <group position={[2.6, 0, 3.5]} rotation={[0, -0.4, 0]}>
        <FilmCans />
      </group>
    </group>
  );
}
