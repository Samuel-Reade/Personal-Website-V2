import { PALETTE } from "./palette";
import { flatMat } from "./materials";

/**
 * The rest of the floor is only staffed during office hours — walk in at
 * midnight and the desks are empty, which is the point of the clock driving
 * this world at all.
 */
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 17;

export function isWorkHours(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

/**
 * Fraction of desks with someone at them during those hours. Deliberately short
 * of 1: a bullpen with every single seat filled reads as staged, and the empty
 * chairs give the eye somewhere to rest.
 */
const OCCUPANCY = 0.68;

const SKIN = [PALETTE.skinLight, PALETTE.skinMid, PALETTE.skinTan, PALETTE.skinDeep];
const HAIR = [PALETTE.hairDark, PALETTE.hairBrown, PALETTE.hairSandy, PALETTE.hairGrey];
const SHIRT = [
  PALETTE.shirtBlue,
  PALETTE.shirtSage,
  PALETTE.shirtMauve,
  PALETTE.shirtSand,
  PALETTE.shirtLavender,
];
const TROUSERS = [PALETTE.deskLeg, PALETTE.headphone, PALETTE.chairFrame];

/** Deterministic pseudo-random, so a desk's occupant never reshuffles on a re-render. */
function rand(seed: number, salt: number): number {
  const x = Math.sin(seed * 91.7 + salt * 47.31) * 28461.13;
  return x - Math.floor(x);
}

/** True when this desk should have someone at it, given the floor is staffed. */
export function isOccupied(seed: number): boolean {
  return rand(seed, 11) < OCCUPANCY;
}

const SEAT_HEIGHT = 0.48;
/** Shoulder height, where the arms hang from. */
const SHOULDER_Y = 0.92;

/**
 * Head, hair and (sometimes) headphones, shared by the seated and standing
 * figures. The hair comes in three cuts — cap, bun, and long — because a floor
 * of identical hemispherical haircuts is the fastest way for the crowd to read
 * as one person stamped out.
 */
function Head({ seed, y }: { seed: number; y: number }) {
  const skin = flatMat(SKIN[Math.floor(rand(seed, 1) * SKIN.length)]);
  const hair = flatMat(HAIR[Math.floor(rand(seed, 2) * HAIR.length)]);
  const cut = rand(seed, 12);
  const wearsHeadphones = rand(seed, 13) > 0.78;

  return (
    <group position={[0, y, 0]}>
      {/* Neck. */}
      <mesh material={skin} position={[0, 0.055, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.07, 6]} />
      </mesh>
      <mesh material={skin} position={[0, 0.16, 0]}>
        <icosahedronGeometry args={[0.105, 1]} />
      </mesh>
      {/* Ears break the head's egg silhouette from behind, which is how most
          of these figures are seen. */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={skin} position={[side * 0.1, 0.155, 0]}>
          <sphereGeometry args={[0.022, 5, 4]} />
        </mesh>
      ))}
      {/* Cap rather than a full sphere: it only has to break the head's
          silhouette, and a hemisphere costs half the triangles. */}
      <mesh material={hair} position={[0, 0.175, -0.008]}>
        <sphereGeometry args={[0.109, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
      </mesh>
      {cut > 0.66 && (
        // A bun pinned high on the back of the head.
        <mesh material={hair} position={[0, 0.23, -0.09]}>
          <sphereGeometry args={[0.042, 6, 5]} />
        </mesh>
      )}
      {cut < 0.3 && (
        // Longer hair falling to the collar.
        <mesh material={hair} position={[0, 0.07, -0.075]}>
          <boxGeometry args={[0.17, 0.2, 0.06]} />
        </mesh>
      )}
      {wearsHeadphones && (
        <group>
          <mesh material={flatMat(PALETTE.headphone)} position={[0, 0.19, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.115, 0.012, 4, 8, Math.PI]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} material={flatMat(PALETTE.headphoneCup)} position={[side * 0.115, 0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.032, 0.028, 0.026, 7]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/**
 * A seated figure, built from the same primitive vocabulary as the desks. Seen
 * from the player's own chair these are metres away and mostly facing the same
 * direction, so it is the silhouette that reads — head, shoulders, and arms
 * onto the desk — rather than any detail.
 */
export function Coworker({ seed }: { seed: number }) {
  const skin = flatMat(SKIN[Math.floor(rand(seed, 1) * SKIN.length)]);
  const shirt = flatMat(SHIRT[Math.floor(rand(seed, 3) * SHIRT.length)]);
  const trousers = flatMat(TROUSERS[Math.floor(rand(seed, 7) * TROUSERS.length)]);

  // A small turn each, so a row of them doesn't read as one figure stamped out
  // repeatedly. Kept slight — they are all working at their own desks.
  const turn = (rand(seed, 4) - 0.5) * 0.5;
  const lean = (rand(seed, 5) - 0.5) * 0.12;
  const height = 0.94 + rand(seed, 6) * 0.12;

  return (
    <group rotation={[0, turn, 0]} scale={[1, height, 1]}>
      <mesh material={shirt} position={[0, SEAT_HEIGHT + 0.23, 0]} rotation={[lean, 0, 0]}>
        <boxGeometry args={[0.34, 0.46, 0.22]} />
      </mesh>
      {/* Shoulder caps soften the box torso's top corners. */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={shirt} position={[side * 0.17, SHOULDER_Y - 0.02, 0]}>
          <sphereGeometry args={[0.055, 5, 4]} />
        </mesh>
      ))}

      <Head seed={seed} y={SHOULDER_Y} />

      {/* Jointed arms: upper arm dropping from the shoulder, forearm reaching
          level onto the desk. One bend is the whole difference between a figure
          typing and a figure sliding off its chair. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.2, SHOULDER_Y - 0.02, 0]}>
          <group rotation={[0.55, 0, side * -0.08]}>
            <mesh material={shirt} position={[0, -0.11, 0]}>
              <boxGeometry args={[0.085, 0.22, 0.095]} />
            </mesh>
          </group>
          <group position={[side * -0.018, -0.21, 0.1]} rotation={[1.35, 0, 0]}>
            <mesh material={skin} position={[0, -0.09, 0]}>
              <boxGeometry args={[0.07, 0.18, 0.075]} />
            </mesh>
            <mesh material={skin} position={[0, -0.19, 0]}>
              <icosahedronGeometry args={[0.043, 0]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Legs, almost entirely hidden by the desk and its modesty panel — they
          exist so the figure doesn't end at the seat when glimpsed side-on. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.095, 0, 0]}>
          <mesh material={trousers} position={[0, SEAT_HEIGHT - 0.05, -0.19]}>
            <boxGeometry args={[0.12, 0.11, 0.38]} />
          </mesh>
          <mesh material={trousers} position={[0, 0.17, -0.36]}>
            <boxGeometry args={[0.1, 0.34, 0.11]} />
          </mesh>
          {/* Shoes. */}
          <mesh material={flatMat(PALETTE.hairDark)} position={[0, 0.035, -0.32]}>
            <boxGeometry args={[0.1, 0.07, 0.19]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * A standing figure for the spots between the desks — the water cooler, a
 * doorway conversation. Same vocabulary as the seated one, on its feet.
 */
export function StandingCoworker({ seed, holdsCup = false }: { seed: number; holdsCup?: boolean }) {
  const skin = flatMat(SKIN[Math.floor(rand(seed, 1) * SKIN.length)]);
  const shirt = flatMat(SHIRT[Math.floor(rand(seed, 3) * SHIRT.length)]);
  const trousers = flatMat(TROUSERS[Math.floor(rand(seed, 7) * TROUSERS.length)]);
  const height = 0.95 + rand(seed, 6) * 0.1;
  const shoulderY = 1.38;

  return (
    <group scale={[1, height, 1]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.085, 0, 0]}>
          <mesh material={trousers} position={[0, 0.42, 0]}>
            <boxGeometry args={[0.11, 0.84, 0.12]} />
          </mesh>
          <mesh material={flatMat(PALETTE.hairDark)} position={[0, 0.035, 0.03]}>
            <boxGeometry args={[0.1, 0.07, 0.19]} />
          </mesh>
        </group>
      ))}
      <mesh material={shirt} position={[0, 1.09, 0]}>
        <boxGeometry args={[0.34, 0.52, 0.2]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={shirt} position={[side * 0.17, shoulderY - 0.04, 0]}>
          <sphereGeometry args={[0.055, 5, 4]} />
        </mesh>
      ))}
      {/* One arm hangs; the other bends up when there's a cup in it. */}
      {[-1, 1].map((side) => {
        const bent = holdsCup && side === 1;
        return (
          <group key={side} position={[side * 0.2, shoulderY - 0.04, 0]}>
            <mesh material={shirt} position={[0, -0.13, 0]} rotation={[0, 0, side * 0.06]}>
              <boxGeometry args={[0.08, 0.26, 0.09]} />
            </mesh>
            {bent ? (
              <group position={[0, -0.26, 0.02]} rotation={[1.25, 0, 0]}>
                <mesh material={skin} position={[0, -0.08, 0]}>
                  <boxGeometry args={[0.065, 0.16, 0.07]} />
                </mesh>
                <mesh material={flatMat(PALETTE.paper)} position={[0, -0.17, 0]}>
                  <cylinderGeometry args={[0.022, 0.017, 0.06, 7]} />
                </mesh>
              </group>
            ) : (
              <mesh material={skin} position={[0, -0.31, 0]}>
                <boxGeometry args={[0.065, 0.14, 0.07]} />
              </mesh>
            )}
          </group>
        );
      })}
      <Head seed={seed} y={shoulderY} />
    </group>
  );
}
