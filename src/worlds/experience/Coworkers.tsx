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
 * A seated figure, built from the same primitive vocabulary as the desks. Seen
 * from the player's own chair these are metres away and mostly facing the same
 * direction, so it is the silhouette that reads — head, shoulders, and arms
 * onto the desk — rather than any detail.
 */
export function Coworker({ seed }: { seed: number }) {
  const skin = flatMat(SKIN[Math.floor(rand(seed, 1) * SKIN.length)]);
  const hair = flatMat(HAIR[Math.floor(rand(seed, 2) * HAIR.length)]);
  const shirt = flatMat(SHIRT[Math.floor(rand(seed, 3) * SHIRT.length)]);

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

      <mesh material={skin} position={[0, SHOULDER_Y + 0.055, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.07, 6]} />
      </mesh>
      <mesh material={skin} position={[0, SHOULDER_Y + 0.16, 0]}>
        <icosahedronGeometry args={[0.105, 1]} />
      </mesh>
      {/* Cap rather than a full sphere: it only has to break the head's
          silhouette, and a hemisphere costs half the triangles. */}
      <mesh material={hair} position={[0, SHOULDER_Y + 0.175, -0.008]}>
        <sphereGeometry args={[0.109, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
      </mesh>

      {/* Arms angled down and forward so the hands land on the desk surface
          rather than hanging in the gap between chair and desk. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.2, SHOULDER_Y, 0]} rotation={[1.1, 0, 0]}>
          <mesh material={shirt} position={[0, -0.17, 0]}>
            <boxGeometry args={[0.085, 0.34, 0.095]} />
          </mesh>
          <mesh material={skin} position={[0, -0.355, 0]}>
            <icosahedronGeometry args={[0.043, 0]} />
          </mesh>
        </group>
      ))}

      {/* Legs, almost entirely hidden by the desk and its modesty panel — they
          exist so the figure doesn't end at the seat when glimpsed side-on. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.095, 0, 0]}>
          <mesh material={flatMat(PALETTE.deskLeg)} position={[0, SEAT_HEIGHT - 0.05, -0.19]}>
            <boxGeometry args={[0.12, 0.11, 0.38]} />
          </mesh>
          <mesh material={flatMat(PALETTE.deskLeg)} position={[0, 0.17, -0.36]}>
            <boxGeometry args={[0.1, 0.34, 0.11]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
