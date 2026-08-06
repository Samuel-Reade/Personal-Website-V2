import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { buildBoatGeometry, DECK_Y } from "./boatGeometry";
import { resolveBoatMove, SPAWN_FACING } from "./layout";
import { waveHeight } from "./waveField";

const MAX_SPEED = 6.4;
/** Reverse is slower than forward, the way backing a rowboat with the oars is. */
const REVERSE_SCALE = 0.45;
const ACCELERATION = 4.6;
/**
 * Exponential drag. This is the whole difference between a boat and the meadow's
 * character: releasing the key coasts to a stop over a couple of seconds instead
 * of halting on the spot, which is what sells the hull as floating rather than
 * standing on the water.
 */
const DRAG = 1.15;
/**
 * Slower than the meadow's 2.6 rad/s on purpose — a boat that pivots as sharply
 * as a person on foot reads as weightless. Still character-relative steering, so
 * the control scheme itself is unchanged.
 */
const TURN_RATE = 1.45;

/** How deep the hull sits, so the waterline crosses it rather than sitting under it. */
const DRAFT = 0.12;
/** Sampling offset for the surface gradient the hull tilts along. */
const SLOPE_SAMPLE = 0.7;
const PITCH_GAIN = 1.1;
const ROLL_GAIN = 1.5;

interface BoatProps {
  /** Mutated in place every frame — the same contract `Player` has with CameraRig. */
  positionRef: React.MutableRefObject<THREE.Vector3>;
  facingRef: React.MutableRefObject<number>;
  /** Signed speed along the facing, read by the wake. */
  speedRef: React.MutableRefObject<number>;
}

/**
 * The player: a rower, seated, seen in third person.
 *
 * This stands in for the meadow's `Player` rather than reusing it — the visible
 * avatar is a boat and its occupant, and the movement model has inertia the
 * character controller deliberately doesn't. What it does keep is `Player`'s
 * exact interface with the rest of the engine: it writes `positionRef` and
 * `facingRef` every frame, which is all `CameraRig` needs, so the chase camera
 * behaves here exactly as it does everywhere else.
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

    // Stroke rate rises with speed so rowing hard looks like rowing hard.
    const effort = Math.abs(speed.current) / MAX_SPEED;
    if (drive !== 0) stroke.current += delta * (2.2 + effort * 4.2);
    const settle = 1 - Math.exp(-3.4 * delta);
    strokeAmount.current = THREE.MathUtils.lerp(strokeAmount.current, drive !== 0 ? 1 : 0, settle);

    // Ride the same wave field the water surface is displaced by.
    const height = waveHeight(position.x, position.z, time);
    const gradX =
      waveHeight(position.x + SLOPE_SAMPLE, position.z, time) -
      waveHeight(position.x - SLOPE_SAMPLE, position.z, time);
    const gradZ =
      waveHeight(position.x, position.z + SLOPE_SAMPLE, time) -
      waveHeight(position.x, position.z - SLOPE_SAMPLE, time);

    if (group.current) {
      group.current.position.set(position.x, height - DRAFT, position.z);

      // Resolve the surface gradient into the hull's own axes, so a wave running
      // across the boat rolls it and one running under it pitches it, whatever
      // heading it happens to be on.
      const sinF = Math.sin(facing.current);
      const cosF = Math.cos(facing.current);
      const slopeForward = gradX * sinF + gradZ * cosF;
      const slopeRight = gradX * cosF - gradZ * sinF;

      // YXZ so pitch and roll are applied in the boat's frame after the heading,
      // rather than the heading being folded into them.
      group.current.rotation.order = "YXZ";
      group.current.rotation.y = facing.current;
      // Positive rotation.x drops the bow, so the sign is inverted to make the
      // bow climb the wave ahead of it. A little idle rock on top keeps the boat
      // alive when the swell happens to be flat under it.
      group.current.rotation.x =
        -slopeForward * PITCH_GAIN + Math.sin(time * 0.79) * 0.018 - effort * 0.045;
      group.current.rotation.z = slopeRight * ROLL_GAIN + Math.sin(time * 0.53 + 1.7) * 0.022;
    }

    const swing = Math.sin(stroke.current) * strokeAmount.current;
    if (oarL.current) oarL.current.rotation.x = swing * 0.5;
    if (oarR.current) oarR.current.rotation.x = swing * 0.5;
    if (armL.current) armL.current.rotation.x = -0.35 - swing * 0.45;
    if (armR.current) armR.current.rotation.x = -0.35 - swing * 0.45;
  });

  return (
    <group ref={group}>
      <mesh geometry={boat.hull} material={flatMat(PALETTE.hull)} />
      <mesh geometry={boat.deck} material={flatMat(PALETTE.hullDark)} />
      <mesh geometry={boat.gunwale} material={flatMat(PALETTE.gunwale)} />

      {/* Thwarts: the rower sits on the aft one, the forward one is just a boat
          looking like a boat. */}
      <mesh material={flatMat(PALETTE.thwart)} position={[0, DECK_Y + 0.22, -0.5]}>
        <boxGeometry args={[0.96, 0.05, 0.22]} />
      </mesh>
      <mesh material={flatMat(PALETTE.thwart)} position={[0, DECK_Y + 0.22, 0.62]}>
        <boxGeometry args={[0.78, 0.05, 0.2]} />
      </mesh>

      {/* The rower, facing the stern the way a rower actually sits — the bow is
          behind them, which is also why the camera looking over the bow works. */}
      <group position={[0, DECK_Y + 0.27, -0.5]}>
        <mesh material={flatMat(PALETTE.trousers)} position={[0, 0.08, 0.26]}>
          <boxGeometry args={[0.34, 0.16, 0.55]} />
        </mesh>
        <mesh material={flatMat(PALETTE.trousers)} position={[0, -0.06, 0.5]}>
          <boxGeometry args={[0.3, 0.16, 0.16]} />
        </mesh>
        <mesh material={flatMat(PALETTE.shirt)} position={[0, 0.32, 0.02]}>
          <boxGeometry args={[0.42, 0.44, 0.3]} />
        </mesh>
        <mesh material={flatMat(PALETTE.skin)} position={[0, 0.64, 0.02]}>
          <icosahedronGeometry args={[0.14, 1]} />
        </mesh>
        <mesh material={flatMat(PALETTE.hair)} position={[0, 0.69, -0.01]}>
          <icosahedronGeometry args={[0.135, 1]} />
        </mesh>

        {[-1, 1].map((side) => (
          <group key={side} ref={side === -1 ? armL : armR} position={[side * 0.25, 0.44, 0.04]}>
            <mesh material={flatMat(PALETTE.shirt)} position={[0, -0.02, 0.22]}>
              <boxGeometry args={[0.12, 0.12, 0.46]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Oars, pivoting at the oarlocks. The outward tilt is baked into the
          inner group so the animated rotation stays a clean fore/aft sweep. */}
      {[-1, 1].map((side) => (
        <group key={side} ref={side === -1 ? oarL : oarR} position={[side * 0.5, 0.42, -0.28]}>
          <group rotation={[0, 0, -side * 1.42]}>
            <mesh material={flatMat(PALETTE.oar)} position={[0, 0.82, 0]}>
              <cylinderGeometry args={[0.028, 0.032, 1.64, 6]} />
            </mesh>
            <mesh material={flatMat(PALETTE.oar)} position={[0, 1.72, 0]}>
              <boxGeometry args={[0.03, 0.36, 0.13]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
