import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { PALETTE } from "./palette";
import { flatMat, flatMatUnique } from "./materials";
import { MIN_ALTITUDE, SPAWN_FACING, resolveFlight } from "./layout";

/** Units per second, flat out. Brisk enough to cross the clearing in a few seconds. */
const SPEED = 11;
/** Radians per second the nose swings. */
const TURN_RATE = 1.7;
/** Units per second of climb and descent on W and S. */
const CLIMB_RATE = 6.5;

/**
 * How quickly the machine reaches the speed being asked of it, and how quickly
 * it gives it back.
 *
 * Acceleration rather than instant velocity, because everything the banking does
 * is read off the *difference* between where the helicopter is going and where
 * it is being told to go. With instant velocity there is no difference to read,
 * and the tilt would snap on and off with the key.
 */
const ACCEL = 3.4;
const DRAG = 2.6;
const CLIMB_ACCEL = 4.5;

/** Nose-down at full forward speed, and the roll into a full-rate turn. Radians. */
const MAX_PITCH = 0.3;
const MAX_ROLL = 0.42;
/** How fast the airframe settles into a new attitude — the visible half of the feel. */
const ATTITUDE_RATE = 3.2;

/** Rotor speed, radians per second. Fast enough to blur, slow enough not to strobe badly. */
const MAIN_ROTOR_SPEED = 26;
const TAIL_ROTOR_SPEED = 38;

/** Hover bob: amplitude in units, and cycles per second. */
const BOB_HEIGHT = 0.11;
const BOB_SPEED = 1.5;
const SWAY_ANGLE = 0.03;
const SWAY_SPEED = 0.9;

interface HelicopterProps {
  /** Mutated in place each frame — read by the camera, the balloons and the HUD. */
  positionRef: React.MutableRefObject<THREE.Vector3>;
  /** Mutated in place each frame with the heading, so the chase camera sits behind. */
  facingRef: React.MutableRefObject<number>;
}

/**
 * The player, for this world only: a small low-poly helicopter.
 *
 * It replaces the walking character rather than extending it. The figure in
 * `three/Player.tsx` is a person with a walk cycle and a jump, and none of that
 * survives contact with an aircraft — so this owns its own controller, and the
 * shared piece is the contract it writes: position and facing into refs, exactly
 * what `three/CameraRig.tsx` reads everywhere else on the site.
 *
 * Controls follow the site's convention where they can. Up and Down drive
 * forward and back, Left and Right swing the nose. W and S are the one
 * departure: everywhere else they tilt the view, and here they are altitude,
 * because a helicopter with no vertical control is a car.
 */
export function Helicopter({ positionRef, facingRef }: HelicopterProps) {
  const keys = useKeyboardState();

  /** The airframe, which banks. Separate from the position group so the tilt can't fight the flight path. */
  const frame = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const mainRotor = useRef<THREE.Group>(null!);
  const tailRotor = useRef<THREE.Group>(null!);

  const facing = useRef(SPAWN_FACING);
  /** Forward speed along the nose, and climb rate. Both carry momentum. */
  const speed = useRef(0);
  const climb = useRef(0);
  const pitch = useRef(0);
  const roll = useRef(0);
  const step = useMemo(() => new THREE.Vector3(), []);

  /**
   * The blades are drawn twice: a solid pair, and a translucent disc over them.
   *
   * A spinning blade at any believable rate lands somewhere between one frame
   * and the next, so on its own it strobes — the classic wagon-wheel, and at 26
   * rad/s it reads as a slow backwards wobble rather than as speed. The disc is
   * what a real rotor actually looks like at speed, and it carries the motion
   * that the discrete blades cannot.
   */
  const discMat = useMemo(
    () => flatMatUnique(PALETTE.heliRotor, { transparent: true, opacity: 0.22 }),
    []
  );

  useFrame((state, delta) => {
    const k = keys.current;
    const position = positionRef.current;

    if (k.left) facing.current += TURN_RATE * delta;
    if (k.right) facing.current -= TURN_RATE * delta;

    const drive = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);
    const lift = (k.lookUp ? 1 : 0) - (k.lookDown ? 1 : 0);

    // Ease toward the demanded speed, and coast back to nothing when nothing is
    // demanded. `1 - exp(-rate * dt)` keeps both frame-rate independent.
    const targetSpeed = drive * SPEED;
    const speedRate = drive !== 0 ? ACCEL : DRAG;
    speed.current = THREE.MathUtils.lerp(speed.current, targetSpeed, 1 - Math.exp(-speedRate * delta));
    climb.current = THREE.MathUtils.lerp(
      climb.current,
      lift * CLIMB_RATE,
      1 - Math.exp(-CLIMB_ACCEL * delta)
    );

    step.set(
      Math.sin(facing.current) * speed.current * delta,
      climb.current * delta,
      Math.cos(facing.current) * speed.current * delta
    );
    position.add(step);
    resolveFlight(position);

    facingRef.current = facing.current;

    // Attitude. Nose down with forward speed, roll into the turn — and level out
    // on its own, because both targets fall to zero the moment the keys are
    // released and the speed bleeds off.
    const speedFraction = speed.current / SPEED;
    const turnInput = (k.left ? 1 : 0) - (k.right ? 1 : 0);
    const settle = 1 - Math.exp(-ATTITUDE_RATE * delta);
    pitch.current = THREE.MathUtils.lerp(pitch.current, speedFraction * MAX_PITCH, settle);
    // Rolls with the turn, and only as far as it is actually moving — a
    // helicopter pivoting on the spot banks very little, and rolling hard while
    // stationary reads as a glitch rather than as flying.
    roll.current = THREE.MathUtils.lerp(
      roll.current,
      turnInput * MAX_ROLL * (0.35 + 0.65 * Math.abs(speedFraction)),
      settle
    );

    if (frame.current) {
      frame.current.rotation.x = pitch.current;
      frame.current.rotation.z = roll.current;
    }

    // Hover bob and sway, on the body alone so it never moves the real position
    // the camera and the balloons read. Fades out as the machine picks up speed:
    // the idle wallow of a hovering helicopter is not what one in transit does.
    const t = state.clock.elapsedTime;
    const idle = 1 - Math.min(1, Math.abs(speedFraction) * 1.6);
    if (body.current) {
      body.current.position.y = Math.sin(t * BOB_SPEED) * BOB_HEIGHT * idle;
      body.current.rotation.z = Math.sin(t * SWAY_SPEED + 1.1) * SWAY_ANGLE * idle;
    }

    if (mainRotor.current) mainRotor.current.rotation.y = t * MAIN_ROTOR_SPEED;
    if (tailRotor.current) tailRotor.current.rotation.x = t * TAIL_ROTOR_SPEED;

    if (frame.current) {
      frame.current.position.copy(position);
      frame.current.rotation.y = facing.current;
      // rotation.x and .z are the attitude set above; applying yaw after them in
      // YXZ order means the bank is read in the airframe's own axes rather than
      // the world's, which is the difference between rolling into a turn and
      // rolling sideways relative to north.
      frame.current.rotation.order = "YXZ";
    }
  });

  return (
    <group ref={frame} position={[0, MIN_ALTITUDE, 0]}>
      <group ref={body}>
        {/* Cabin: a stubby faceted pod. Six segments around, so it reads as cut
            from flat panels like everything else on the hill. */}
        <mesh material={flatMat(PALETTE.heliBody)} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.62, 0.52, 1.5, 6]} />
        </mesh>
        {/* Nose cap, closing the front of the pod. */}
        <mesh material={flatMat(PALETTE.heliBody)} position={[0, -0.04, 0.72]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.56, 0.55, 6]} />
        </mesh>
        {/* Canopy. Sits proud of the nose so it reads as glass set into the shell. */}
        <mesh material={flatMat(PALETTE.heliGlass)} position={[0, 0.12, 0.52]}>
          <sphereGeometry args={[0.42, 8, 6]} />
        </mesh>

        {/* Tail boom and fin. */}
        <mesh material={flatMat(PALETTE.heliDark)} position={[0, 0.08, -1.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.16, 1.9, 6]} />
        </mesh>
        <mesh material={flatMat(PALETTE.heliBody)} position={[0, 0.36, -2.16]}>
          <boxGeometry args={[0.07, 0.62, 0.42]} />
        </mesh>
        <mesh material={flatMat(PALETTE.heliDark)} position={[0, -0.02, -2.24]}>
          <boxGeometry args={[0.5, 0.07, 0.3]} />
        </mesh>

        {/* Mast, and the main rotor above it. */}
        <mesh material={flatMat(PALETTE.heliMetal)} position={[0, 0.62, 0.02]}>
          <cylinderGeometry args={[0.09, 0.11, 0.42, 6]} />
        </mesh>
        <group ref={mainRotor} position={[0, 0.85, 0.02]}>
          <mesh material={flatMat(PALETTE.heliMetal)}>
            <cylinderGeometry args={[0.16, 0.16, 0.12, 6]} />
          </mesh>
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle) => (
            <mesh
              key={angle}
              material={flatMat(PALETTE.heliRotor)}
              position={[Math.sin(angle) * 1.5, 0, Math.cos(angle) * 1.5]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[0.16, 0.035, 3]} />
            </mesh>
          ))}
        </group>
        {/* The blur disc. Outside the spinning group — it is a circle, so turning
            it would change nothing and cost a matrix update every frame. */}
        <mesh material={discMat} position={[0, 0.85, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[3.05, 20]} />
        </mesh>

        {/* Tail rotor, turning in its own plane, with its own smaller disc. */}
        <group ref={tailRotor} position={[0.16, 0.28, -2.16]}>
          {[0, Math.PI / 2].map((angle) => (
            <mesh
              key={angle}
              material={flatMat(PALETTE.heliRotor)}
              position={[0, Math.sin(angle) * 0.42, Math.cos(angle) * 0.42]}
              rotation={[-angle, 0, 0]}
            >
              <boxGeometry args={[0.03, 0.85, 0.11]} />
            </mesh>
          ))}
        </group>
        <mesh material={discMat} position={[0.17, 0.28, -2.16]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.88, 14]} />
        </mesh>

        {/* Skids. */}
        {[-0.44, 0.44].map((x) => (
          <group key={x} position={[x, -0.72, 0]}>
            <mesh material={flatMat(PALETTE.heliMetal)} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.055, 0.055, 1.9, 5]} />
            </mesh>
            {[0.45, -0.45].map((z) => (
              <mesh
                key={z}
                material={flatMat(PALETTE.heliMetal)}
                position={[-Math.sign(x) * 0.1, 0.26, z]}
                rotation={[0, 0, Math.sign(x) * 0.35]}
              >
                <cylinderGeometry args={[0.04, 0.04, 0.56, 5]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
