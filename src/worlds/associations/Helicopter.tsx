import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { useStore } from "../../state/useStore";
import { PALETTE } from "./palette";
import { flatMat, flatMatUnique } from "./materials";
import { MIN_ALTITUDE, SPAWN_FACING, resolveFlight } from "./layout";

/**
 * Movement model: the astronaut's, constant for constant.
 *
 * DRAG, MAX_SPEED, ACCELERATION, REVERSE_SCALE and TURN_RATE are the space
 * world's exact values — the request was for the suit's mechanics, and
 * inheriting the numbers is the only way that stays true if the suit is ever
 * retuned. The same drift, the same long coast, the same reluctant reverse:
 * two flying machines, one hand on both.
 */
const DRAG = 1.15;
const MAX_SPEED = 8.0;
const ACCELERATION = MAX_SPEED * DRAG;
/** Backing off is slower than driving forward, as it is in the suit. */
const REVERSE_SCALE = 0.45;
const TURN_RATE = 1.5;

/**
 * Uniform upscale of the whole airframe.
 *
 * The arena is now over a hundred units across and the envelopes it shares the
 * sky with are four units of balloon each; at 1× the machine read as a drone
 * buzzing the range rather than an aircraft flying it. The scale sits on the
 * outer group so every proportion below is authored at 1× and grows together —
 * and the chase camera's distances are retuned to match in FlightCameraRig.
 */
const HELI_SCALE = 1.35;

/** Nose-down at full forward speed, and the roll into a full-rate turn. Radians. */
const MAX_PITCH = 0.3;
const MAX_ROLL = 0.42;
/**
 * How much of the aim the airframe leans into while under way. A machine
 * hauling itself up a climb should visibly point up it — but only a share,
 * because a helicopter climbs on its rotor, not its nose, and matching the aim
 * one-to-one would read as a jet.
 */
const ATTITUDE_AIM_SHARE = 0.55;
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

/**
 * The aim, on W and S — the astronaut's, at the astronaut's exact rate and
 * range. These keys don't only tip the view, they steer the thrust vector,
 * which is why the ceiling is far wider than the walker's 0.62 — and it stays
 * just short of vertical so the heading never degenerates: aimed straight up,
 * `facing` has nothing to point at and the yaw keys would silently stop doing
 * anything.
 */
const LOOK_RATE = 1.3;
const MAX_LOOK_PITCH = 1.25;

interface HelicopterProps {
  /** Mutated in place each frame — read by the camera, the balloons and the HUD. */
  positionRef: React.MutableRefObject<THREE.Vector3>;
  /** Mutated in place each frame with the heading, so the chase camera sits behind. */
  facingRef: React.MutableRefObject<number>;
  /** Written each frame with the aim from the look keys, read by FlightCameraRig. */
  pitchRef?: React.MutableRefObject<number>;
}

/**
 * The player, for this world only: a low-poly light helicopter.
 *
 * It replaces the walking character rather than extending it. The figure in
 * `three/Player.tsx` is a person with a walk cycle and a jump, and none of that
 * survives contact with an aircraft — so this owns its own controller, and the
 * shared piece is the contract it writes: position, facing and aim into refs,
 * the same contract every camera rig on the site reads.
 *
 * Controls are the astronaut's, key for key. Up and Down drive, Left and
 * Right swing the nose, and W and S aim — with thrust following the aim, so
 * pointing up and holding forward is how you climb, exactly as it is in the
 * space world. One scheme for both flying machines, and nothing to relearn
 * between them.
 */
export function Helicopter({ positionRef, facingRef, pitchRef }: HelicopterProps) {
  const keys = useKeyboardState();

  /** The airframe, which banks. Separate from the position group so the tilt can't fight the flight path. */
  const frame = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const mainRotor = useRef<THREE.Group>(null!);
  const tailRotor = useRef<THREE.Group>(null!);

  const facing = useRef(SPAWN_FACING);
  /** Forward speed along the aim. Carries momentum. */
  const speed = useRef(0);
  const pitch = useRef(0);
  const roll = useRef(0);
  /** View pitch, distinct from `pitch` above — that one is the airframe's attitude. */
  const look = useRef(0);
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

  /**
   * Aviation lights, unlit so they read at any hour: steady red on the port
   * side and green on starboard, a slow-pulsing beacon on the engine deck, and
   * a white double-flash strobe on the fin — the flash pattern real strobes
   * carry, and the single detail that most says *aircraft* from a distance.
   */
  const beaconMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: PALETTE.navRed, transparent: true }),
    []
  );
  const strobeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: PALETTE.strobe, transparent: true }),
    []
  );

  useFrame((state, delta) => {
    const k = keys.current;
    const position = positionRef.current;

    if (k.left) facing.current += TURN_RATE * delta;
    if (k.right) facing.current -= TURN_RATE * delta;

    // W and S tilt the aim, and thrust follows it — the astronaut's rule.
    // Integrated and held rather than sprung back, as everywhere on the site.
    if (k.lookUp) look.current += LOOK_RATE * delta;
    if (k.lookDown) look.current -= LOOK_RATE * delta;
    look.current = THREE.MathUtils.clamp(look.current, -MAX_LOOK_PITCH, MAX_LOOK_PITCH);
    if (pitchRef) pitchRef.current = look.current;

    const drive = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);

    // The slider's multiplier, applied as the suit applies it: thrust and cap
    // together, so the terminal speed moves by exactly the multiplier.
    const speedScale = useStore.getState().speedScale;

    // The astronaut's integrator, verbatim: thrust while a key is held, drag
    // always, clamped to full ahead and a slower astern. The exp decay keeps
    // the coast frame-rate independent, exactly as the suit's does.
    if (drive !== 0) {
      speed.current += drive * ACCELERATION * speedScale * (drive > 0 ? 1 : REVERSE_SCALE) * delta;
    }
    speed.current *= Math.exp(-DRAG * delta);
    speed.current = THREE.MathUtils.clamp(
      speed.current,
      -MAX_SPEED * REVERSE_SCALE * speedScale,
      MAX_SPEED * speedScale
    );

    if (Math.abs(speed.current) > 0.001) {
      // Facing gives the horizontal bearing; the aim lifts it out of the plane,
      // exactly as the astronaut flies.
      const cosLook = Math.cos(look.current);
      step.set(
        Math.sin(facing.current) * cosLook * speed.current * delta,
        Math.sin(look.current) * speed.current * delta,
        Math.cos(facing.current) * cosLook * speed.current * delta
      );
      position.add(step);
      resolveFlight(position);
    }

    facingRef.current = facing.current;

    // Attitude. Nose down with forward speed, tipped toward the aim while under
    // way, roll into the turn — and level out on its own, because every target
    // falls to zero the moment the keys are released and the speed bleeds off.
    // The aim term is scaled by speed, not applied outright: a hovering
    // helicopter looking up stays level, one climbing points up the climb.
    // Against the scaled top speed, so the attitude and the hover bob read
    // flat-out at whatever the slider currently makes of it.
    const speedFraction = speed.current / (MAX_SPEED * speedScale);
    const turnInput = (k.left ? 1 : 0) - (k.right ? 1 : 0);
    const settle = 1 - Math.exp(-ATTITUDE_RATE * delta);
    pitch.current = THREE.MathUtils.lerp(
      pitch.current,
      (MAX_PITCH * Math.cos(look.current) - look.current * ATTITUDE_AIM_SHARE) * speedFraction,
      settle
    );
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

    // Beacon breathing, strobe double-flashing. Opacity rather than visibility,
    // so a dim ember stays where the light lives between flashes.
    beaconMat.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 5.2));
    const cycle = t % 1.3;
    strobeMat.opacity = cycle < 0.06 || (cycle > 0.14 && cycle < 0.2) ? 1 : 0.08;

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
    <group ref={frame} position={[0, MIN_ALTITUDE, 0]} scale={HELI_SCALE}>
      <group ref={body}>
        {/* Cabin: a faceted pod, longer than it is tall, tapering aft the way a
            fuselage does. Rotated about X so the taper runs nose to tail — the
            first pass rotated it about Z, which laid the tube across the
            airframe and made one side of the machine fatter than the other. */}
        <mesh material={flatMat(PALETTE.heliBody)} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.66, 0.5, 1.7, 7]} />
        </mesh>
        {/* Belly, flattening the underside. A helicopter is not a tube, and the
            flat bottom is most of what makes it read as one from above — which
            is the only angle this is ever seen from. */}
        <mesh material={flatMat(PALETTE.heliDark)} position={[0, -0.42, -0.05]}>
          <boxGeometry args={[0.78, 0.28, 1.5]} />
        </mesh>
        {/* Nose, dropping away below the canopy. */}
        <mesh material={flatMat(PALETTE.heliBody)} position={[0, -0.12, 0.82]} rotation={[Math.PI / 2 + 0.22, 0, 0]}>
          <coneGeometry args={[0.55, 0.7, 7]} />
        </mesh>
        {/* Canopy, with a frame post splitting it into two panes, and side glass. */}
        <mesh material={flatMat(PALETTE.heliGlass)} position={[0, 0.14, 0.6]} scale={[0.92, 0.78, 1.15]}>
          <sphereGeometry args={[0.44, 8, 6]} />
        </mesh>
        <mesh material={flatMat(PALETTE.heliDark)} position={[0, 0.16, 0.96]}>
          <boxGeometry args={[0.045, 0.5, 0.06]} />
        </mesh>
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} material={flatMat(PALETTE.heliGlass)} position={[x, 0.16, 0.12]}>
            <boxGeometry args={[0.05, 0.34, 0.62]} />
          </mesh>
        ))}
        {/* Rear cabin glass, aft of the doors — a machine with one pane a side
            reads as single-seat, and this one carries passengers in the fiction. */}
        {[-0.56, 0.56].map((x) => (
          <mesh key={x} material={flatMat(PALETTE.heliGlass)} position={[x, 0.14, -0.44]}>
            <boxGeometry args={[0.05, 0.26, 0.36]} />
          </mesh>
        ))}
        {/* Livery: a cream cheat line down each flank, and a matching band on
            the boom. The single strongest realism cue at this art scale — real
            airframes are almost never one unbroken colour, and the line gives
            the eye the fuselage's true length. */}
        {[-1, 1].map((side) => (
          <mesh key={side} material={flatMat(PALETTE.heliAccent)} position={[side * 0.585, -0.06, 0.02]}>
            <boxGeometry args={[0.03, 0.16, 1.5]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.heliAccent)} position={[0, 0.18, -1.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.185, 0.185, 0.2, 7]} />
        </mesh>

        {/* Position lights on the hull flanks — red to port (+x, given the nose
            flies +z), green to starboard — a pitot probe off the nose, a landing
            lamp under the belly, and the anti-collision lights animated above. */}
        <mesh position={[0.63, 0.02, 0.3]}>
          <sphereGeometry args={[0.055, 6, 5]} />
          <meshBasicMaterial color={PALETTE.navRed} />
        </mesh>
        <mesh position={[-0.63, 0.02, 0.3]}>
          <sphereGeometry args={[0.055, 6, 5]} />
          <meshBasicMaterial color={PALETTE.navGreen} />
        </mesh>
        <mesh material={beaconMat} position={[0, 0.82, -0.55]}>
          <sphereGeometry args={[0.07, 6, 5]} />
        </mesh>
        <mesh material={strobeMat} position={[0, 0.98, -3.12]}>
          <sphereGeometry args={[0.05, 6, 5]} />
        </mesh>
        <mesh material={flatMat(PALETTE.heliMetal)} position={[0.14, -0.04, 1.32]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.4, 4]} />
        </mesh>
        <mesh material={flatMat(PALETTE.heliMetal)} position={[0, -0.62, 0.58]}>
          <cylinderGeometry args={[0.07, 0.09, 0.14, 6]} />
        </mesh>
        <mesh position={[0, -0.7, 0.58]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshBasicMaterial color={PALETTE.heliLamp} />
        </mesh>

        {/* Engine cowling behind the mast, running fore-aft and tapering toward
            the twin exhausts — every turbine helicopter carries this bulge, and
            its absence is most of why the old shape read as a pod with a stick
            on top. Aligned with the flight axis now, as the cabin is. */}
        <mesh material={flatMat(PALETTE.heliDark)} position={[0, 0.46, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.26, 0.9, 6]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            material={flatMat(PALETTE.heliMetal)}
            position={[side * 0.17, 0.44, -1.02]}
            rotation={[Math.PI / 2, 0, side * 0.12]}
          >
            <cylinderGeometry args={[0.09, 0.11, 0.3, 6]} />
          </mesh>
        ))}
        {/* Comms whip on the spine, leaning aft in the wash. */}
        <mesh material={flatMat(PALETTE.heliDark)} position={[0, 0.44, -1.35]} rotation={[-0.3, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.45, 4]} />
        </mesh>

        {/* Tail boom, thick at the cabin and tapering back to the gearbox — a
            real boom carries its loads at the root. It runs longer now: a light
            helicopter's tail is most of its length, and the stubby first pass
            put the rotor disc at 1.4× the airframe, which is drone proportion. */}
        <mesh material={flatMat(PALETTE.heliBody)} position={[0, 0.18, -1.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.09, 2.8, 7]} />
        </mesh>
        {/* Swept fin with the tail gearbox faired into it, a ventral fin below,
            and a skid guarding the boom on a tail-low landing — the pair of
            details that separate a tail from a stick with a propeller. */}
        <mesh material={flatMat(PALETTE.heliBody)} position={[0, 0.5, -3.05]} rotation={[-0.22, 0, 0]}>
          <boxGeometry args={[0.07, 0.8, 0.42]} />
        </mesh>
        <mesh material={flatMat(PALETTE.heliBody)} position={[0, -0.1, -2.98]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[0.055, 0.34, 0.3]} />
        </mesh>
        <mesh material={flatMat(PALETTE.heliMetal)} position={[0, -0.16, -2.72]} rotation={[1.0, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.04, 0.5, 5]} />
        </mesh>
        <mesh material={flatMat(PALETTE.heliDark)} position={[0, 0.26, -3.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 0.2, 6]} />
        </mesh>
        {/* Stabilisers with end plates, well forward of the tail rotor's arc. */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh material={flatMat(PALETTE.heliBody)} position={[side * 0.34, 0.14, -2.45]}>
              <boxGeometry args={[0.6, 0.05, 0.32]} />
            </mesh>
            <mesh material={flatMat(PALETTE.heliBody)} position={[side * 0.63, 0.16, -2.45]}>
              <boxGeometry args={[0.05, 0.24, 0.3]} />
            </mesh>
          </group>
        ))}

        {/* Mast, and the main rotor above it. */}
        <mesh material={flatMat(PALETTE.heliMetal)} position={[0, 0.68, 0.02]}>
          <cylinderGeometry args={[0.09, 0.12, 0.4, 6]} />
        </mesh>
        <group ref={mainRotor} position={[0, 0.92, 0.02]}>
          <mesh material={flatMat(PALETTE.heliMetal)}>
            <cylinderGeometry args={[0.17, 0.19, 0.16, 6]} />
          </mesh>
          {/* Swashplate under the hub. */}
          <mesh material={flatMat(PALETTE.heliDark)} position={[0, -0.13, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.07, 6]} />
          </mesh>
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle) => (
            <group key={angle} rotation={[0, -angle, 0]}>
              {/* Blade root — the narrow arm between hub and blade, which is what
                  stops the four reading as one cross cut from card. */}
              <mesh material={flatMat(PALETTE.heliMetal)} position={[0, 0, 0.3]}>
                <boxGeometry args={[0.07, 0.05, 0.42]} />
              </mesh>
              {/* Coned very slightly down at the tip, as an unloaded rotor
                  droops. A dead-flat disc gives away that it is a prop. */}
              <mesh material={flatMat(PALETTE.heliRotor)} position={[0, -0.05, 1.75]} rotation={[0.028, 0, 0]}>
                <boxGeometry args={[0.17, 0.035, 2.6]} />
              </mesh>
            </group>
          ))}
        </group>
        {/* The blur disc. Outside the spinning group — it is a circle, so turning
            it would change nothing and cost a matrix update every frame. */}
        <mesh material={discMat} position={[0, 0.9, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[3.1, 24]} />
        </mesh>

        {/* Tail rotor, turning in its own plane on the gearbox axle, with its
            own smaller disc. */}
        <group ref={tailRotor} position={[0.16, 0.26, -3.02]}>
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
        <mesh material={discMat} position={[0.19, 0.26, -3.02]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.9, 16]} />
        </mesh>

        {/* Skids: a tube each side on two cross-struts, with the front of each
            turned up. That upturned toe is the detail that reads as landing gear
            rather than as two rails glued on. */}
        {[-0.46, 0.46].map((x) => (
          <group key={x} position={[x, -0.8, 0]}>
            <mesh material={flatMat(PALETTE.heliMetal)} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.055, 0.055, 2.05, 5]} />
            </mesh>
            <mesh material={flatMat(PALETTE.heliMetal)} position={[0, 0.09, 1.1]} rotation={[Math.PI / 2 - 0.5, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.36, 5]} />
            </mesh>
            {[0.5, -0.5].map((z) => (
              <mesh
                key={z}
                material={flatMat(PALETTE.heliMetal)}
                position={[-Math.sign(x) * 0.11, 0.3, z]}
                rotation={[0, 0, Math.sign(x) * 0.35]}
              >
                <cylinderGeometry args={[0.042, 0.042, 0.66, 5]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
