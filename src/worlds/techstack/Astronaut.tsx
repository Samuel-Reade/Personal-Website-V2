import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { createRimToonMaterial } from "../../utils/toon";
import { resolveFloatMove, SPAWN_FACING } from "./layout";

/**
 * Movement model: the rowboat's, lifted into three dimensions.
 *
 * MAX_SPEED and DRAG are the archipelago's exact values, so a lap of this system
 * covers ground at the same rate a lap of the bay does — the request was for the
 * boat's speed, and inheriting the constants is the only way that stays true if
 * the boat is ever retuned. What changes is the axis count: there is no ground
 * plane here, so thrust runs along wherever the astronaut is *looking*, pitch
 * included, and there is nothing to resolve against but the outer limit and the
 * planet.
 */
const DRAG = 1.15;
const MAX_SPEED = 8.0;
const ACCELERATION = MAX_SPEED * DRAG;
/** Backing off is slower than driving forward, as it is in the boat. */
const REVERSE_SCALE = 0.45;
/**
 * Slower than the meadow's 2.6 rad/s and close to the boat's 1.45. A suit with
 * cold-gas thrusters should feel like it has mass to swing around.
 */
const TURN_RATE = 1.5;

/** Radians per second W and S tilt the aim, matching `three/Player.tsx`. */
const LOOK_RATE = 1.3;
/**
 * Far wider than the meadow's 0.62. On foot the look keys only tip the view;
 * here they steer the thrust vector, and a ceiling that low would mean the
 * player could never climb out of the plane they spawned in. Kept just short of
 * vertical so the heading never degenerates — straight up leaves `facing` with
 * nothing to point at, and the yaw keys would silently stop doing anything.
 */
const MAX_PITCH = 1.25;

/** Idle drift — the suit is never perfectly still, even at rest. */
const BOB_AMPLITUDE = 0.09;
const BOB_SPEED = 0.9;
const SWAY_AMPLITUDE = 0.055;
const SWAY_SPEED = 0.63;
/** Slow tumble the whole body carries, damped out as the thrusters take over. */
const IDLE_ROLL = 0.07;

const OUTLINE_COLOR = "#2a2438";
const OUTLINE_THICKNESS = 0.026;
const OUTLINE_ANGLE = 1;
const CORNER_SMOOTHNESS = 4;

const TORSO_PIVOT_Y = 1.2;
const HEAD_PIVOT_Y = 1.71;
const TORSO_TWIST_SHARE = 0.38;
const MAX_HEAD_PITCH = 0.5;

interface AstronautProps {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  facingRef: React.MutableRefObject<number>;
  /** Written each frame so the camera can pitch with the direction of travel. */
  pitchRef: React.MutableRefObject<number>;
}

/**
 * The player, in a spacesuit, floating free.
 *
 * Built from `three/Player.tsx`'s proportions rather than reusing it — the
 * controller has no ground under it and the silhouette is a pressure suit rather
 * than a jacket — but it is the same man underneath at the same scale, with the
 * suit's white shell over his frame and his face behind the visor.
 *
 * The legs don't walk. There is nothing to walk on, so they hold a loose
 * free-fall tuck and drift with the body's sway, which is what reads as
 * weightless; a walk cycle in vacuum is the single fastest way to break it.
 */
export function Astronaut({ positionRef, facingRef, pitchRef }: AstronautProps) {
  const keys = useKeyboardState();

  const group = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const thruster = useRef<THREE.Group>(null!);

  const facing = useRef(SPAWN_FACING);
  /** Vertical aim of the body, driven by the cursor and used to steer thrust. */
  const pitch = useRef(0);
  const speed = useRef(0);
  const heading = useRef(new THREE.Vector3());
  const next = useRef(new THREE.Vector3());

  // The suit: a warm off-white rather than pure white, which under the toon
  // ramp's top band would clip to a flat sheet with no form left in it.
  const suitMat = useMemo(() => createRimToonMaterial("#e9e6de", { strength: 0.34 }), []);
  const suitShadeMat = useMemo(() => createRimToonMaterial("#c3c0bb", { strength: 0.3 }), []);
  const packMat = useMemo(() => createRimToonMaterial("#9aa3b4", { strength: 0.3 }), []);
  const trimMat = useMemo(() => createRimToonMaterial("#e8933f", { strength: 0.35 }), []);
  const skinMat = useMemo(() => createRimToonMaterial("#caa07a", { strength: 0.22 }), []);
  const featureMat = useMemo(() => createRimToonMaterial("#1a1410", { strength: 0 }), []);

  /**
   * The visor. Unlit and additive so it reads as glass catching starlight rather
   * than as a painted panel, with enough opacity that the face behind it is
   * visible but clearly under glass.
   */
  const visorMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#4d7fd6",
        transparent: true,
        opacity: 0.5,
        toneMapped: false,
      }),
    []
  );

  /** Thruster plume, faded in and out with throttle. */
  const plumeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#9fd4ff",
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useFrame((state, delta) => {
    const position = positionRef.current;
    const k = keys.current;
    const elapsed = state.clock.elapsedTime;

    if (k.left) facing.current += TURN_RATE * delta;
    if (k.right) facing.current -= TURN_RATE * delta;

    // W and S tilt the aim, and thrust follows it. This is what makes the whole
    // sphere of directions reachable from the flat control scheme the rest of
    // the site uses: aim up, hold forward, climb.
    if (k.lookUp) pitch.current += LOOK_RATE * delta;
    if (k.lookDown) pitch.current -= LOOK_RATE * delta;
    pitch.current = THREE.MathUtils.clamp(pitch.current, -MAX_PITCH, MAX_PITCH);

    const drive = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);
    if (drive !== 0) {
      speed.current += drive * ACCELERATION * (drive > 0 ? 1 : REVERSE_SCALE) * delta;
    }
    // exp form keeps the coast frame-rate independent, exactly as the boat does.
    speed.current *= Math.exp(-DRAG * delta);
    speed.current = THREE.MathUtils.clamp(speed.current, -MAX_SPEED * REVERSE_SCALE, MAX_SPEED);

    if (Math.abs(speed.current) > 0.001) {
      // Facing gives the horizontal bearing; pitch lifts it out of the plane.
      const cosPitch = Math.cos(pitch.current);
      heading.current.set(
        Math.sin(facing.current) * cosPitch,
        Math.sin(pitch.current),
        Math.cos(facing.current) * cosPitch
      );
      next.current.copy(position).addScaledVector(heading.current, speed.current * delta);
      resolveFloatMove(next.current);
      position.copy(next.current);
    }

    facingRef.current = facing.current;
    pitchRef.current = pitch.current;

    const throttle = Math.abs(speed.current) / MAX_SPEED;

    if (group.current) {
      // Idle bob and sway, applied to the rendered group only — positionRef stays
      // clean, so the camera and the portal triggers aren't dragged along with
      // it. Damped as the thrusters come up: under way the suit is being driven,
      // and the drift should read as what happens when it isn't.
      const idle = 1 - throttle * 0.75;
      group.current.position.set(
        position.x + Math.sin(elapsed * SWAY_SPEED) * SWAY_AMPLITUDE * idle,
        position.y + Math.sin(elapsed * BOB_SPEED) * BOB_AMPLITUDE * idle,
        position.z + Math.cos(elapsed * SWAY_SPEED * 0.77) * SWAY_AMPLITUDE * idle
      );

      // YXZ so the pitch is taken in the body's own frame after the heading,
      // rather than the heading being folded into it.
      group.current.rotation.order = "YXZ";
      group.current.rotation.y = facing.current;
      // Negated: positive pitch means looking up, which tips the body's nose up.
      group.current.rotation.x = -pitch.current;
      group.current.rotation.z =
        Math.sin(elapsed * 0.41) * IDLE_ROLL * idle - speed.current * 0.012;
    }

    // Limbs drift on their own slightly out of phase with the body, which is
    // what separates a floating figure from a rigid prop being moved around.
    const driftA = Math.sin(elapsed * 0.83) * 0.1 * (1 - throttle * 0.6);
    const driftB = Math.sin(elapsed * 0.67 + 1.4) * 0.1 * (1 - throttle * 0.6);

    if (armL.current) armL.current.rotation.x = -0.28 + driftA;
    if (armR.current) armR.current.rotation.x = -0.28 + driftB;
    if (armL.current) armL.current.rotation.z = 0.42 + driftB * 0.5;
    if (armR.current) armR.current.rotation.z = -0.42 - driftA * 0.5;

    // A loose free-fall tuck, breathing very slightly.
    if (legL.current) legL.current.rotation.x = 0.34 + driftB * 0.6;
    if (legR.current) legR.current.rotation.x = 0.22 + driftA * 0.6;

    // The whole body already rotates to the aim, so the head only adds a small
    // extra lead in the same direction — enough that he reads as looking where
    // he is going rather than being carried there rigidly.
    if (torso.current) torso.current.rotation.x = pitch.current * TORSO_TWIST_SHARE * 0.3;
    if (head.current) {
      head.current.rotation.order = "YXZ";
      head.current.rotation.x = -THREE.MathUtils.clamp(
        pitch.current * 0.28,
        -MAX_HEAD_PITCH,
        MAX_HEAD_PITCH
      );
    }

    // Plume: only on forward thrust, and only while a key is actually held —
    // coasting should show nothing firing.
    const firing = drive > 0 ? throttle : 0;
    plumeMat.opacity = THREE.MathUtils.lerp(plumeMat.opacity, firing * 0.75, 1 - Math.exp(-9 * delta));
    if (thruster.current) {
      const flicker = 1 + Math.sin(elapsed * 34) * 0.14;
      thruster.current.scale.set(1, 1, Math.max(0.001, firing * 2.4 * flicker));
    }
  });

  return (
    <group ref={group}>
      <group ref={body}>
        {/* Hips */}
        <RoundedBox
          args={[0.38, 0.2, 0.26]}
          radius={0.075}
          smoothness={CORNER_SMOOTHNESS}
          material={suitMat}
          position={[0, 1.11, 0]}
        >
          <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
        </RoundedBox>

        {/* Legs, in a loose tuck rather than a stride. */}
        {[
          { ref: legL, x: -0.105 },
          { ref: legR, x: 0.105 },
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, 1.06, 0]}>
            <RoundedBox
              args={[0.2, 0.48, 0.22]}
              radius={0.07}
              smoothness={CORNER_SMOOTHNESS}
              material={suitMat}
              position={[0, -0.24, 0]}
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>
            <RoundedBox
              args={[0.175, 0.46, 0.2]}
              radius={0.06}
              smoothness={CORNER_SMOOTHNESS}
              material={suitMat}
              position={[0, -0.68, 0.03]}
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>
            {/* Boot */}
            <RoundedBox
              args={[0.2, 0.15, 0.3]}
              radius={0.05}
              smoothness={CORNER_SMOOTHNESS}
              material={suitShadeMat}
              position={[0, -0.94, 0.08]}
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>
          </group>
        ))}

        <group ref={torso} position={[0, TORSO_PIVOT_Y, 0]}>
          <group position={[0, -TORSO_PIVOT_Y, 0]}>
            {/* Chest — bulkier than the suit jacket it replaces, which is most of
                what makes the silhouette read as pressurised. */}
            <RoundedBox
              args={[0.46, 0.46, 0.3]}
              radius={0.1}
              smoothness={CORNER_SMOOTHNESS}
              material={suitMat}
              position={[0, 1.42, 0]}
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>

            {/* Chest control panel */}
            <RoundedBox
              args={[0.19, 0.13, 0.04]}
              radius={0.02}
              smoothness={2}
              material={suitShadeMat}
              position={[0, 1.4, 0.155]}
            />
            <mesh material={trimMat} position={[0, 1.44, 0.178]}>
              <boxGeometry args={[0.14, 0.02, 0.01]} />
            </mesh>

            {/* Life-support pack */}
            <RoundedBox
              args={[0.4, 0.46, 0.18]}
              radius={0.06}
              smoothness={CORNER_SMOOTHNESS}
              material={packMat}
              position={[0, 1.44, -0.22]}
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>

            {/* Thruster nozzle and plume, firing aft. */}
            <group ref={thruster} position={[0, 1.3, -0.32]}>
              <mesh material={suitShadeMat} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.055, 0.075, 0.1, 10]} />
              </mesh>
              <mesh material={plumeMat} position={[0, 0, -0.28]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.075, 0.5, 10, 1, true]} />
              </mesh>
            </group>

            {/* Orange trim at the waist and shoulders — the one saturated accent
                on the suit, and what keeps a white figure legible against stars. */}
            <mesh material={trimMat} position={[0, 1.22, 0]}>
              <boxGeometry args={[0.465, 0.045, 0.305]} />
            </mesh>

            {/* Shoulder caps */}
            {[-0.245, 0.245].map((x) => (
              <mesh key={x} material={suitMat} position={[x, 1.56, 0]} scale={[1, 0.94, 1]}>
                <sphereGeometry args={[0.105, 14, 12]} />
              </mesh>
            ))}

            {/* Arms — no elbow joint; the suit's limbs are one soft tube, which is
                how a pressurised sleeve actually behaves. */}
            {[
              { ref: armL, x: -0.245 },
              { ref: armR, x: 0.245 },
            ].map(({ ref, x }) => (
              <group key={x} ref={ref} position={[x, 1.55, 0]}>
                <RoundedBox
                  args={[0.16, 0.56, 0.18]}
                  radius={0.065}
                  smoothness={CORNER_SMOOTHNESS}
                  material={suitMat}
                  position={[0, -0.28, 0]}
                >
                  <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
                </RoundedBox>
                <mesh material={trimMat} position={[0, -0.5, 0]}>
                  <boxGeometry args={[0.165, 0.035, 0.185]} />
                </mesh>
                {/* Glove */}
                <mesh material={suitShadeMat} position={[0, -0.6, 0]}>
                  <sphereGeometry args={[0.085, 12, 10]} />
                </mesh>
              </group>
            ))}

            {/* Neck ring */}
            <mesh material={suitShadeMat} position={[0, 1.67, 0]}>
              <cylinderGeometry args={[0.1, 0.105, 0.06, 14]} />
            </mesh>

            <group ref={head} position={[0, HEAD_PIVOT_Y, 0]}>
              <group position={[0, -HEAD_PIVOT_Y, 0]}>
                {/* Helmet shell, with the visor cut into the front of it. */}
                <mesh material={suitMat} position={[0, 1.85, 0]}>
                  <sphereGeometry args={[0.215, 24, 20]} />
                  <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
                </mesh>

                {/* The head inside, kept small enough to clear the shell. */}
                <mesh material={skinMat} position={[0, 1.845, 0.01]} scale={[1, 1.05, 0.97]}>
                  <sphereGeometry args={[0.125, 18, 16]} />
                </mesh>
                {[-0.047, 0.047].map((x) => (
                  <mesh
                    key={x}
                    material={featureMat}
                    position={[x, 1.862, 0.108]}
                    scale={[1, 0.8, 0.55]}
                  >
                    <sphereGeometry args={[0.021, 12, 10]} />
                  </mesh>
                ))}
                <mesh material={featureMat} position={[0, 1.8, 0.107]} scale={[1, 0.26, 0.36]}>
                  <sphereGeometry args={[0.03, 12, 10]} />
                </mesh>

                {/* Visor: a sphere segment across the front of the helmet.
                    Rendered after the face so the glass sits over it. */}
                <mesh material={visorMat} position={[0, 1.85, 0]} rotation={[0, 0, 0]}>
                  <sphereGeometry
                    args={[0.222, 24, 20, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.22, Math.PI * 0.56]}
                  />
                </mesh>

                {/* Visor surround and the lamp above it. */}
                <mesh material={trimMat} position={[0, 2.01, 0.055]} rotation={[0.35, 0, 0]}>
                  <boxGeometry args={[0.2, 0.03, 0.055]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
