import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { buildBoatGeometry, DECK_Y, HULL_HALF_BEAM, HULL_HALF_LENGTH } from "./boatGeometry";
import { resolveBoatMove, SPAWN_FACING } from "./layout";
import { waveHeight } from "./waveField";

/**
 * Exponential drag. This is the whole difference between a boat and the meadow's
 * character: releasing the key coasts to a stop over a couple of seconds instead
 * of halting on the spot, which is what sells the hull as floating rather than
 * standing on the water.
 */
const DRAG = 1.15;
/**
 * Top speed under way — double what the boat used to manage.
 *
 * This is the *drag* terminal speed, not a clamp: thrust and drag balance at
 * ACCELERATION / DRAG, and that ratio is what the boat actually settles at, so
 * the clamp below never binds in forward gear. Previously these were two
 * independent constants — a 6.4 "max" against a real 4.6 / 1.15 = 4.0 — so the
 * stated figure was never the true one. Deriving acceleration from the target
 * keeps them from drifting apart again.
 *
 * Measured 7.92 at 60fps rather than a clean 8.0: the discrete integrator's
 * fixed point sits a shade under the continuous limit. It varies by about 1%
 * across frame rates, which is far too little to feel, and the ratio against the
 * old boat is exactly 2x either way since both share DRAG.
 */
const MAX_SPEED = 8.0;
const ACCELERATION = MAX_SPEED * DRAG;
/** Reverse is slower than forward, the way backing a rowboat with the oars is. */
const REVERSE_SCALE = 0.45;
/**
 * Slower than the meadow's 2.6 rad/s on purpose — a boat that pivots as sharply
 * as a person on foot reads as weightless. Still character-relative steering, so
 * the control scheme itself is unchanged.
 */
const TURN_RATE = 1.45;

/**
 * How far the keel sits below the water it floats on. Small, because the float
 * height is taken from the *highest* sample under the hull (see below) — sinking
 * further would put the deck back under the crests.
 */
const DRAFT = 0.1;
const PITCH_GAIN = 1.0;
const ROLL_GAIN = 1.0;

/**
 * Where the hull is measured against the sea, in boat-local XZ. Bow and stern
 * give the pitch, port and starboard the roll, and the highest of all five sets
 * the float height — so the boat rides the wave that is actually under it rather
 * than a single reading at its centre, which is what let the sea wash through
 * the deck whenever a crest arrived off-centre.
 */
const HULL_SAMPLES: [number, number][] = [
  [0, HULL_HALF_LENGTH],
  [0, -HULL_HALF_LENGTH],
  [HULL_HALF_BEAM, 0],
  [-HULL_HALF_BEAM, 0],
  [0, 0],
];

interface BoatProps {
  /** Mutated in place every frame — the same contract `Player` has with CameraRig. */
  positionRef: React.MutableRefObject<THREE.Vector3>;
  facingRef: React.MutableRefObject<number>;
  /** Signed speed along the facing, read by the wake. */
  speedRef: React.MutableRefObject<number>;
}

/**
 * The player: the meadow's character, seated in a rowboat, seen in third person.
 *
 * This stands in for `Player` rather than reusing it — the visible avatar is a
 * boat as well as a man, and the movement model has inertia the character
 * controller deliberately doesn't. What it keeps is `Player`'s exact interface
 * with the rest of the engine: it writes `positionRef` and `facingRef` every
 * frame, which is all `CameraRig` needs, so the chase camera behaves here
 * exactly as it does everywhere else.
 *
 * The man himself is rebuilt from `three/Player.tsx`'s proportions and colors —
 * black suit, cream shirt, the same head-to-shoulder ratio and the same hair
 * cap — because it is supposed to be the person who walked into the portal. He
 * faces the bow, so the camera sees his back exactly as it does in the meadow;
 * a real rower would face astern, but that would put the avatar's face into the
 * lens for the whole visit and break the over-the-shoulder read.
 *
 * `positionRef.y` is deliberately left at 0 while the visible hull rides the
 * swell. The camera reads that ref, and letting it bob would heave the whole
 * horizon up and down several times a second.
 */
export function Boat({ positionRef, facingRef, speedRef }: BoatProps) {
  const keys = useKeyboardState();

  const group = useRef<THREE.Group>(null!);
  const oarL = useRef<THREE.Group>(null!);
  const oarR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);

  const facing = useRef(SPAWN_FACING);
  const speed = useRef(0);
  const front = useRef(new THREE.Vector3());
  const next = useRef(new THREE.Vector3());
  /** Advances only while rowing, so the stroke pauses mid-glide instead of spinning on. */
  const stroke = useRef(0);
  /** Eases the stroke's amplitude in and out, so the oars settle rather than snapping to rest. */
  const strokeAmount = useRef(0);

  const boat = useMemo(() => buildBoatGeometry(), []);
  useEffect(() => boat.dispose, [boat]);

  useFrame((state, delta) => {
    const position = positionRef.current;
    const k = keys.current;
    const time = state.clock.elapsedTime;

    if (k.left) facing.current += TURN_RATE * delta;
    if (k.right) facing.current -= TURN_RATE * delta;

    const drive = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);
    if (drive !== 0) {
      speed.current += drive * ACCELERATION * (drive > 0 ? 1 : REVERSE_SCALE) * delta;
    }
    // exp form keeps the coast frame-rate independent.
    speed.current *= Math.exp(-DRAG * delta);
    speed.current = THREE.MathUtils.clamp(speed.current, -MAX_SPEED * REVERSE_SCALE, MAX_SPEED);

    if (Math.abs(speed.current) > 0.001) {
      front.current.set(Math.sin(facing.current), 0, Math.cos(facing.current));
      next.current.copy(position).addScaledVector(front.current, speed.current * delta);
      resolveBoatMove(next.current);
      position.copy(next.current);
    }

    facingRef.current = facing.current;
    speedRef.current = speed.current;

    // The oars are driven by how fast the boat is actually moving, not by
    // whether a key is down. Keyed off the input they froze mid-glide — the
    // boat carrying its way across the bay with the oars locked still, which is
    // the one moment the inertia is most visible. Off speed they keep pulling
    // as the boat runs on and wind down as it loses way.
    const effort = Math.abs(speed.current) / MAX_SPEED;
    stroke.current += delta * (1.8 + effort * 5.2) * Math.min(1, effort * 8);
    const settle = 1 - Math.exp(-3.4 * delta);
    // Reaches full sweep well before top speed, so an unhurried row still looks
    // like rowing rather than like twitching at the oars.
    const strokeTarget = THREE.MathUtils.clamp(effort * 2.4, 0, 1);
    strokeAmount.current = THREE.MathUtils.lerp(strokeAmount.current, strokeTarget, settle);

    // Sample the same wave field the water surface is displaced by, at the four
    // corners of the hull. Local (lx, lz) -> world, where forward is
    // (sin f, cos f) and starboard is (cos f, -sin f).
    const sinF = Math.sin(facing.current);
    const cosF = Math.cos(facing.current);
    let highest = -Infinity;
    const heights: number[] = [];
    for (const [lx, lz] of HULL_SAMPLES) {
      const h = waveHeight(
        position.x + lx * cosF + lz * sinF,
        position.z - lx * sinF + lz * cosF,
        time
      );
      heights.push(h);
      if (h > highest) highest = h;
    }
    const [bowH, sternH, stbdH, portH] = heights;

    if (group.current) {
      group.current.position.set(position.x, highest - DRAFT, position.z);

      // Rise over run between the actual hull ends, which is the real surface
      // slope the boat is sitting across — no gradient approximation needed.
      const pitchSlope = (bowH - sternH) / (2 * HULL_HALF_LENGTH);
      const rollSlope = (stbdH - portH) / (2 * HULL_HALF_BEAM);

      // YXZ so pitch and roll are applied in the boat's frame after the heading,
      // rather than the heading being folded into them.
      group.current.rotation.order = "YXZ";
      group.current.rotation.y = facing.current;
      // Positive rotation.x drops the bow, so the sign is inverted to make the
      // bow climb the wave ahead of it. A little idle rock on top keeps the boat
      // alive when the swell happens to be flat under it.
      group.current.rotation.x =
        -pitchSlope * PITCH_GAIN + Math.sin(time * 0.79) * 0.018 - effort * 0.04;
      group.current.rotation.z = rollSlope * ROLL_GAIN + Math.sin(time * 0.53 + 1.7) * 0.022;
    }

    const swing = Math.sin(stroke.current) * strokeAmount.current;
    if (oarL.current) oarL.current.rotation.x = swing * 0.42;
    if (oarR.current) oarR.current.rotation.x = swing * 0.42;
    if (armL.current) armL.current.rotation.x = -0.85 - swing * 0.32;
    if (armR.current) armR.current.rotation.x = -0.85 - swing * 0.32;
    // The body leans into the stroke with the arms — a rower's back does most
    // of the work, and without it the man reads as a statue with moving limbs.
    if (torso.current) torso.current.rotation.x = swing * 0.13;
  });

  /** Top of the aft thwart, which is what the man sits on. */
  const seatY = DECK_Y + 0.245;

  return (
    <group ref={group}>
      <mesh geometry={boat.hull} material={flatMat(PALETTE.hull)} />
      <mesh geometry={boat.interior} material={flatMat(PALETTE.hullDark)} />
      <mesh geometry={boat.gunwale} material={flatMat(PALETTE.gunwale)} />

      <mesh material={flatMat(PALETTE.thwart)} position={[0, DECK_Y + 0.22, 0]}>
        <boxGeometry args={[0.96, 0.05, 0.24]} />
      </mesh>
      {/* Bow thwart, kept ahead of where his feet land and narrow enough for the
          hull to have closed in to ±0.22 by then. */}
      <mesh material={flatMat(PALETTE.thwart)} position={[0, DECK_Y + 0.22, 1.3]}>
        <boxGeometry args={[0.4, 0.05, 0.2]} />
      </mesh>

      {/* The man, seated. Every offset below is three/Player.tsx's, measured
          from his hip block: chest +0.30, shoulders +0.445, head +0.735, and so
          on down to the 2cm brows. Only the pose differs. */}
      <group position={[0, seatY + 0.09, 0]}>
        <group ref={torso}>
          {/* Hips, chest, and the deltoid caps that round off the shoulder line. */}
          <mesh material={flatMat(PALETTE.suit)}>
            <boxGeometry args={[0.34, 0.18, 0.23]} />
          </mesh>
          <mesh material={flatMat(PALETTE.suit)} position={[0, 0.3, 0]}>
            <boxGeometry args={[0.4, 0.42, 0.24]} />
          </mesh>
          {[-0.215, 0.215].map((x) => (
            <mesh key={x} material={flatMat(PALETTE.suit)} position={[x, 0.45, 0]}>
              <boxGeometry args={[0.135, 0.15, 0.21]} />
            </mesh>
          ))}

          {/* Shirt, lapels, collar and tie. */}
          <mesh material={flatMat(PALETTE.suitShirt)} position={[0, 0.38, 0.122]}>
            <boxGeometry args={[0.11, 0.24, 0.02]} />
          </mesh>
          {[-0.082, 0.082].map((x) => (
            <mesh
              key={x}
              material={flatMat(PALETTE.suit)}
              position={[x, 0.39, 0.123]}
              rotation={[0, 0, x < 0 ? 0.16 : -0.16]}
            >
              <boxGeometry args={[0.09, 0.26, 0.022]} />
            </mesh>
          ))}
          <mesh material={flatMat(PALETTE.suitShirt)} position={[0, 0.495, 0.1]}>
            <boxGeometry args={[0.185, 0.045, 0.05]} />
          </mesh>
          <mesh material={flatMat(PALETTE.suitTie)} position={[0, 0.465, 0.132]}>
            <boxGeometry args={[0.058, 0.055, 0.035]} />
          </mesh>
          <mesh material={flatMat(PALETTE.suitTie)} position={[0, 0.335, 0.13]}>
            <boxGeometry args={[0.048, 0.2, 0.03]} />
          </mesh>

          {/* Head and hair. */}
          <mesh material={flatMat(PALETTE.suitSkin)} position={[0, 0.735, 0]} scale={[1, 1.07, 0.97]}>
            <sphereGeometry args={[0.133, 14, 14]} />
          </mesh>
          <mesh material={flatMat(PALETTE.suitHair)} position={[0, 0.745, -0.012]}>
            <sphereGeometry args={[0.14, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>

          {/* Face: brows, eyes, nose, mouth and nothing else. */}
          {[-0.05, 0.05].map((x) => (
            <group key={x}>
              <mesh material={flatMat(PALETTE.suitFeature)} position={[x, 0.758, 0.112]} scale={[1, 0.8, 0.6]}>
                <sphereGeometry args={[0.02, 8, 6]} />
              </mesh>
              <mesh
                material={flatMat(PALETTE.suitFeature)}
                position={[x, 0.788, 0.11]}
                rotation={[0, 0, x < 0 ? 0.12 : -0.12]}
              >
                <boxGeometry args={[0.058, 0.013, 0.022]} />
              </mesh>
            </group>
          ))}
          <mesh material={flatMat(PALETTE.suitSkin)} position={[0, 0.735, 0.122]}>
            <boxGeometry args={[0.028, 0.045, 0.032]} />
          </mesh>
          <mesh material={flatMat(PALETTE.suitFeature)} position={[0, 0.685, 0.114]}>
            <boxGeometry args={[0.062, 0.012, 0.022]} />
          </mesh>

          {/* Arms, angled down and forward so the hands meet the oar handles —
              the rest pose is -0.85rad and the stroke swings about it. */}
          {[-1, 1].map((side) => (
            <group
              key={side}
              ref={side === -1 ? armL : armR}
              position={[side * 0.225, 0.445, 0]}
              rotation={[-0.85, 0, side * 0.22]}
            >
              <mesh material={flatMat(PALETTE.suit)} position={[0, -0.25, 0]}>
                <boxGeometry args={[0.15, 0.5, 0.17]} />
              </mesh>
              <mesh material={flatMat(PALETTE.suitSkin)} position={[0, -0.52, 0]}>
                <sphereGeometry args={[0.075, 6, 5]} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Legs stretched forward along the deck. There is only 0.245 of seat
            height above the floor, so a chair-like right angle would put his
            feet through the hull; the shoes land at y 0.338 against a deck at
            0.34. */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.105, 0, 0]}>
            <mesh material={flatMat(PALETTE.suit)} position={[0, -0.09, 0.3]}>
              <boxGeometry args={[0.185, 0.2, 0.56]} />
            </mesh>
            <mesh material={flatMat(PALETTE.suit)} position={[0, -0.2, 0.74]}>
              <boxGeometry args={[0.16, 0.18, 0.42]} />
            </mesh>
            <mesh material={flatMat(PALETTE.suitShoe)} position={[0, -0.28, 1.0]}>
              <boxGeometry args={[0.185, 0.115, 0.3]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Oars, pivoting at the oarlocks. The outward-and-down tilt is baked into
          the inner group so the animated rotation stays a clean fore/aft sweep;
          the blade tip lands just under the waterline and the inboard handle
          rises to where his hands are. */}
      {[-1, 1].map((side) => (
        <group key={side} ref={side === -1 ? oarL : oarR} position={[side * 0.52, 0.6, 0.4]}>
          <group rotation={[0, 0, -side * 1.85]}>
            <mesh material={flatMat(PALETTE.oar)} position={[0, 0.85, 0]}>
              <cylinderGeometry args={[0.028, 0.032, 1.7, 6]} />
            </mesh>
            <mesh material={flatMat(PALETTE.oar)} position={[0, 1.78, 0]}>
              <boxGeometry args={[0.03, 0.36, 0.13]} />
            </mesh>
            <mesh material={flatMat(PALETTE.oar)} position={[0, -0.21, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.42, 6]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
