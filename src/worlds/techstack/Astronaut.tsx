import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { createRimToonMaterial } from "../../utils/toon";
import { resolveFloatMove, SPAWN_FACING } from "./layout";
import { createBodyGeometry } from "../../three/bodyGeometry";
import {
  ELBOW_DROP,
  EYE_X,
  EYE_Y,
  EYE_Z,
  HEAD_CENTER_Y,
  HEAD_PIVOT_Y,
  HEAD_RADIUS,
  HEAD_SCALE,
  HIP_Y,
  KNEE_DROP,
  LEG_X,
  SHOE_HEIGHT,
  SHOULDER_X,
  SHOULDER_Y,
  TORSO_TOP_Y,
  WRIST_DROP,
  buildFigureGeometry,
} from "../../three/figure";

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

/**
 * How thick the pressure suit is over him.
 *
 * The man inside is `three/figure.ts`'s, unchanged — the suit is that profile
 * with a constant 2.2cm added all round, which is what a garment of even
 * thickness does. It is why the silhouette reads as pressurised without the
 * limbs going back to being uniform tubes: a padded taper is still a taper.
 */
const SUIT_PAD = 0.022;
/**
 * Ten around a limb rather than twenty. The profiles under the suit are plain
 * capsules now, and a plain capsule at twenty segments is a smooth tube — which
 * would leave the same man faceted while he walks and rounded off while he
 * floats.
 */
const BODY = buildFigureGeometry({ segments: 10, pad: SUIT_PAD });

/** The helmet, sized to clear the head and seated on the same centre. */
const HELMET_RADIUS = HEAD_RADIUS * 1.17;
const HELMET_BOTTOM_Y = HEAD_CENTER_Y - HELMET_RADIUS;

/**
 * The orange waist band, sitting a few millimetres proud of the suit. Lofted
 * rather than boxed: the torso's cross-section is a rounded superellipse, and a
 * box laid over it stands off at the four corners and cuts in along the flats.
 */
const WAIST_TRIM = createBodyGeometry(
  [
    { y: 1.248, rx: 0.192, rz: 0.136 },
    { y: 1.196, rx: 0.19, rz: 0.135 },
  ],
  { squareness: 3.4 }
);

/**
 * The neutral body posture — what a body actually does in free fall, with the
 * elbows and knees carrying a permanent relaxed bend because there is no ground
 * to straighten against and the flexors win. It is also the reason the limbs
 * needed joints at all out here: the suit's arms and legs used to be single
 * straight tubes, which is the one shape a weightless body never holds.
 */
const ELBOW_BEND = -0.75;
const KNEE_BEND = 0.55;

const TORSO_PIVOT_Y = 1.2;
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
        {/* Legs, trailing in a loose free-fall bend rather than a stride. */}
        {[
          { ref: legL, x: -LEG_X },
          { ref: legR, x: LEG_X },
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, HIP_Y, 0]}>
            <mesh geometry={BODY.thigh} material={suitMat}>
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </mesh>
            <group position={[0, -KNEE_DROP, 0]} rotation={[KNEE_BEND, 0, 0]}>
              {/* Fills the joint as it folds — a suit has a bellows here for the
                  same reason, and without it the bend opens a wedge. */}
              <mesh material={suitMat} scale={[1, 0.92, 1.02]}>
                <sphereGeometry args={[0.099, 14, 12]} />
              </mesh>
              <mesh geometry={BODY.shin} material={suitMat}>
                <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
              </mesh>
              {/* Boot */}
              <RoundedBox
                args={[0.135, SHOE_HEIGHT + 0.025, 0.3]}
                radius={0.045}
                smoothness={CORNER_SMOOTHNESS}
                material={suitShadeMat}
                position={[0, -(HIP_Y - KNEE_DROP) + SHOE_HEIGHT / 2, 0.055]}
              >
                <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
              </RoundedBox>
            </group>
          </group>
        ))}

        <group ref={torso} position={[0, TORSO_PIVOT_Y, 0]}>
          <group position={[0, -TORSO_PIVOT_Y, 0]}>
            {/* The suit itself — his own torso profile, padded. It keeps the
                waist the jacket has, which is what stops a pressure suit reading
                as a barrel with a helmet on top. */}
            <mesh geometry={BODY.torso} material={suitMat}>
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </mesh>

            {/* Chest control panel */}
            <RoundedBox
              args={[0.19, 0.13, 0.04]}
              radius={0.02}
              smoothness={2}
              material={suitShadeMat}
              position={[0, 1.4, 0.135]}
            />
            <mesh material={trimMat} position={[0, 1.44, 0.158]}>
              <boxGeometry args={[0.14, 0.02, 0.01]} />
            </mesh>

            {/* Life-support pack */}
            <RoundedBox
              args={[0.35, 0.44, 0.18]}
              radius={0.06}
              smoothness={CORNER_SMOOTHNESS}
              material={packMat}
              position={[0, 1.42, -0.215]}
            >
              <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
            </RoundedBox>

            {/* Thruster nozzle and plume, firing aft. */}
            <group ref={thruster} position={[0, 1.3, -0.3]}>
              <mesh material={suitShadeMat} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.055, 0.075, 0.1, 10]} />
              </mesh>
              <mesh material={plumeMat} position={[0, 0, -0.28]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.075, 0.5, 10, 1, true]} />
              </mesh>
            </group>

            {/* Orange trim at the waist — the one saturated accent on the suit,
                and what keeps a white figure legible against stars. */}
            <mesh geometry={WAIST_TRIM} material={trimMat} />

            {/* Shoulder caps */}
            {[-SHOULDER_X, SHOULDER_X].map((x) => (
              <mesh key={x} material={suitMat} position={[x, 1.552, 0]} scale={[1, 0.94, 1.02]}>
                <sphereGeometry args={[0.101, 16, 12]} />
              </mesh>
            ))}

            {/* Arms. They have an elbow now: a pressurised sleeve is not a rigid
                pipe, and a straight arm is the one thing a body in free fall
                never holds. */}
            {[
              { ref: armL, x: -SHOULDER_X },
              { ref: armR, x: SHOULDER_X },
            ].map(({ ref, x }) => (
              <group key={x} ref={ref} position={[x, SHOULDER_Y, 0]}>
                <mesh geometry={BODY.upperArm} material={suitMat}>
                  <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
                </mesh>
                <group position={[0, -ELBOW_DROP, 0]} rotation={[ELBOW_BEND, 0, 0]}>
                  <mesh material={suitMat} scale={[1, 0.95, 1.05]}>
                    <sphereGeometry args={[0.087, 14, 12]} />
                  </mesh>
                  <mesh geometry={BODY.forearm} material={suitMat}>
                    <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
                  </mesh>
                  {/* Wrist ring, where a real suit's glove locks on. */}
                  <mesh material={trimMat} position={[0, -WRIST_DROP - 0.008, 0]}>
                    <cylinderGeometry args={[0.076, 0.074, 0.03, 16]} />
                  </mesh>
                  {/* Glove — a mitt rather than the open hand he walks with. */}
                  <mesh
                    material={suitShadeMat}
                    position={[0, -WRIST_DROP - 0.062, 0]}
                    scale={[1, 1.1, 0.95]}
                  >
                    <sphereGeometry args={[0.072, 12, 10]} />
                  </mesh>
                </group>
              </group>
            ))}

            {/* Neck ring, bridging the torso block and the underside of the
                helmet. Both moved down with the shorter body, so this is placed
                off them rather than at a height of its own. */}
            <mesh material={suitShadeMat} position={[0, (TORSO_TOP_Y + HELMET_BOTTOM_Y) / 2, 0]}>
              <cylinderGeometry args={[0.1, 0.108, 0.075, 10]} />
            </mesh>

            <group ref={head} position={[0, HEAD_PIVOT_Y, 0]}>
              <group position={[0, -HEAD_PIVOT_Y, 0]}>
                {/* Helmet shell, sized to clear the head inside it — which is
                    now the same oversized head the walker and the rower wear, so
                    the shell grew with it. */}
                <mesh material={suitMat} position={[0, HEAD_CENTER_Y, 0]}>
                  <sphereGeometry args={[HELMET_RADIUS, 12, 9]} />
                  <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={OUTLINE_ANGLE} />
                </mesh>

                {/* The head inside, a shade under the shared radius so it clears
                    the shell all round. */}
                <mesh material={skinMat} position={[0, HEAD_CENTER_Y, 0.01]} scale={HEAD_SCALE}>
                  <sphereGeometry args={[HEAD_RADIUS * 0.95, 10, 7]} />
                </mesh>
                {/* Two eyes and nothing else, matching the other two figures —
                    the mouth went with theirs. */}
                {[-EYE_X, EYE_X].map((x) => (
                  <mesh
                    key={x}
                    material={featureMat}
                    position={[x, EYE_Y, EYE_Z * 0.95]}
                    scale={[1, 1.2, 0.38]}
                  >
                    <sphereGeometry args={[0.032, 10, 8]} />
                  </mesh>
                ))}

                {/* Visor: a sphere segment across the front of the helmet.
                    Rendered after the face so the glass sits over it. */}
                <mesh material={visorMat} position={[0, HEAD_CENTER_Y, 0]} rotation={[0, 0, 0]}>
                  <sphereGeometry
                    args={[HELMET_RADIUS * 1.033, 16, 12, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.22, Math.PI * 0.56]}
                  />
                </mesh>

                {/* Visor surround and the lamp above it. */}
                <mesh material={trimMat} position={[0, HEAD_CENTER_Y + HELMET_RADIUS * 0.72, 0.062]} rotation={[0.35, 0, 0]}>
                  <boxGeometry args={[0.22, 0.032, 0.06]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
