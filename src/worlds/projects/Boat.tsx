import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboardState } from "../../hooks/useKeyboard";
import { useStore } from "../../state/useStore";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { getHairGeometry, type HatFit } from "../../three/hair";
import { buildBoatGeometry, DECK_Y, HULL_HALF_BEAM, HULL_HALF_LENGTH } from "./boatGeometry";
import {
  ANKLE_DROP,
  ELBOW_DROP,
  EYE_X,
  EYE_Y,
  EYE_Z,
  HEAD_CAP_SCALE,
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
  TORSO_RINGS,
  TORSO_TOP_Y,
  WRIST_DROP,
  buildFigureGeometry,
} from "../../three/figure";
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

/** All three match the meadow character, so the same man looks around the same way in both worlds. */
const LOOK_RATE = 1.3;
const MAX_LOOK_PITCH = 0.62;
const MAX_HEAD_PITCH = 0.42;

/**
 * The rower, at the bay's faceting. Ten segments a ring rather than the meadow's
 * twenty: this world is flat-shaded low-poly, and a smooth tube would read as a
 * visitor from the other one.
 */
const BODY = buildFigureGeometry({ segments: 10 });

/**
 * His soles, in boat space.
 *
 * Placed by his seat rather than his feet — the jacket hem is what rests on the
 * thwart, so the figure hangs from that contact point and the legs reach forward
 * to the deck from there. Taking the hem straight off the shared profile means
 * he keeps sitting *on* the thwart rather than in it if that profile is ever
 * retouched.
 */
const SEAT_Y = DECK_Y + 0.245;
const ORIGIN_Y = SEAT_Y - TORSO_RINGS[TORSO_RINGS.length - 1].y;
/** The deck, in his own feet-measured coordinates. */
const DECK_LOCAL = DECK_Y - ORIGIN_Y;

/**
 * How far the thigh drops below horizontal. Nearly flat: there is only 0.245 of
 * seat above the floor, and a chair-like right angle would put his feet through
 * the hull.
 */
const THIGH_PITCH = 0.14;
/**
 * ...and the shin angle that follows from it, derived rather than dialled in, so
 * the sole lands exactly on the deck instead of hovering over it or sinking
 * through it — and stays there if the deck or his proportions ever move.
 */
const SHIN_PITCH = Math.asin(
  (HIP_Y - (DECK_LOCAL + SHOE_HEIGHT) - KNEE_DROP * Math.sin(THIGH_PITCH)) / ANKLE_DROP
);

const KNEE_Y = HIP_Y - KNEE_DROP * Math.sin(THIGH_PITCH);
const KNEE_Z = KNEE_DROP * Math.cos(THIGH_PITCH);
const ANKLE_Z = KNEE_Z + ANKLE_DROP * Math.cos(SHIN_PITCH);

/**
 * A limb profile runs down its own -Y, so pointing one forward and `pitch` below
 * horizontal is a rotation of `pitch - 90°` about X.
 */
const limbPitch = (pitch: number): [number, number, number] => [pitch - Math.PI / 2, 0, 0];

/**
 * Where the arms rest, before the stroke swings about it.
 *
 * Set so the fists actually meet the oar handles: at the old angle the hands sat
 * 0.13 off the handle axis and only a deliberately oversized ball of a hand
 * covered the gap. With a properly sized fist the pose has to do the work.
 */
const ARM_REST_PITCH = -0.76;

/**
 * The stroke, in three motions.
 *
 * The old animation rocked the oars 0.42 rad about the boat's own X axis — but
 * an oar shaft points *outward*, nearly along X, and rotating a vector about
 * its own axis barely moves it. The visible sweep came out at a tenth of the
 * stated angle, and from the chase camera the man read as a statue holding two
 * sticks. So the oars now sweep about the oarlock's vertical axis, which is
 * the plane a real stroke lives in: blades driving aft through the water, then
 * lifting clear and swinging forward for the next catch.
 *
 * He faces the bow, so this is a push stroke — hands and back driving forward
 * as the blades go aft — which is what the lever actually does from that seat,
 * and it keeps the arms honest: they track where the handles really move.
 */
/** Half-angle of the blades' fore-aft sweep, radians about the oarlock. */
const OAR_SWEEP = 0.55;
/** How far the shaft lifts on the return, enough to pull the blade clear. */
const OAR_LIFT = 0.32;
/** How far the arms swing through a full stroke, and the back behind them. */
const ARM_SWING = 0.45;
const TORSO_SWING = 0.22;

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
  /** Written each frame with the view pitch from the look keys, for CameraRig. */
  pitchRef?: React.MutableRefObject<number>;
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
/**
 * The peaked sailing cap's crown, and the band that finishes it. Pulled out of
 * the meshes below so the fit handed to the hair can be read off the same two
 * numbers the cap is drawn from.
 */
const CAP_RADIUS = HEAD_RADIUS * 1.08;
const CAP_CUT = Math.PI * 0.46;
const CAP_BAND_RADIUS = HEAD_RADIUS * 1.09;
/**
 * What the cap leaves for the hair beneath it.
 *
 * Far less than the mortarboard does, because this is a cap rather than a hat
 * sat on top of one: its shell is only eight hundredths of a head-radius off
 * the skull, so the hair under it lies almost flat. That costs nothing worth
 * having — none of it can be seen — and what does show is all below the rim,
 * where the locks stand at their full height and come out from under the band
 * at the back and sides, which is the whole reason for giving him hair with a
 * shape instead of the smooth skullcap he wore before.
 *
 * The rim is taken a little above the crown's own cut, because the band hangs
 * below the crown and is the lowest thing the hair has to clear.
 */
const CAP_HAT: HatFit = { rimPhi: Math.PI * 0.45, rise: 0.05 };

export function Boat({ positionRef, facingRef, speedRef, pitchRef }: BoatProps) {
  const keys = useKeyboardState();

  const group = useRef<THREE.Group>(null!);
  const oarL = useRef<THREE.Group>(null!);
  const oarR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);

  const facing = useRef(SPAWN_FACING);
  const speed = useRef(0);
  const front = useRef(new THREE.Vector3());
  const next = useRef(new THREE.Vector3());
  /** Advances only while rowing, so the stroke pauses mid-glide instead of spinning on. */
  const stroke = useRef(0);
  const pitch = useRef(0);
  /** Eases the stroke's amplitude in and out, so the oars settle rather than snapping to rest. */
  const strokeAmount = useRef(0);

  const boat = useMemo(() => buildBoatGeometry(), []);
  useEffect(() => boat.dispose, [boat]);

  /**
   * His hair needs both faces drawn — it is an open shell whose lock tips stand
   * off the skull, so a lock seen from below is a hole in his head — and
   * `flatMat` hands out a shared instance that must not be mutated. So this one
   * is his own, and he disposes of it.
   */
  const hairMaterial = useMemo(() => {
    const material = new THREE.MeshLambertMaterial({
      color: PALETTE.suitHair,
      flatShading: true,
    });
    material.side = THREE.DoubleSide;
    return material;
  }, []);
  useEffect(() => () => hairMaterial.dispose(), [hairMaterial]);

  useFrame((state, delta) => {
    const position = positionRef.current;
    const k = keys.current;
    const time = state.clock.elapsedTime;

    if (k.left) facing.current += TURN_RATE * delta;
    if (k.right) facing.current -= TURN_RATE * delta;

    // The slider's multiplier. Scaling thrust and cap together moves the drag
    // terminal speed by exactly the multiplier, so the boat still settles the
    // same way — just faster or slower. Read non-reactively: a slider drag
    // should never re-render the bay.
    const speedScale = useStore.getState().speedScale;

    const drive = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);
    if (drive !== 0) {
      speed.current += drive * ACCELERATION * speedScale * (drive > 0 ? 1 : REVERSE_SCALE) * delta;
    }
    // exp form keeps the coast frame-rate independent.
    speed.current *= Math.exp(-DRAG * delta);
    speed.current = THREE.MathUtils.clamp(
      speed.current,
      -MAX_SPEED * REVERSE_SCALE * speedScale,
      MAX_SPEED * speedScale
    );

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
    // Normalised to the *scaled* top speed, so the oars read full effort at
    // whatever flat-out currently means rather than flailing at 2x or idling
    // at half.
    const effort = Math.abs(speed.current) / (MAX_SPEED * speedScale);
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

    // The cycle: blades drive aft while `swing` rises, return while it falls.
    // `recovery` is the falling half, eased — that is when the blades lift out
    // of the water, because an oar dragged back through the sea it just pulled
    // on would brake the boat it is supposed to be driving.
    const swing = Math.sin(stroke.current) * strokeAmount.current;
    const recovery = Math.max(0, -Math.cos(stroke.current)) * strokeAmount.current;
    // Sweep about the vertical, lift about the fore-aft axis; both signs flip
    // with the side so port and starboard pull together rather than mirrored.
    if (oarL.current) {
      oarL.current.rotation.y = -swing * OAR_SWEEP;
      oarL.current.rotation.z = -recovery * OAR_LIFT;
    }
    if (oarR.current) {
      oarR.current.rotation.y = swing * OAR_SWEEP;
      oarR.current.rotation.z = recovery * OAR_LIFT;
    }
    // The arms track the handles — forward through the drive, back on the
    // return — and the body works with them: a rower's back does most of the
    // stroke, and without it the man reads as a statue with moving limbs.
    if (armL.current) armL.current.rotation.x = ARM_REST_PITCH - swing * ARM_SWING;
    if (armR.current) armR.current.rotation.x = ARM_REST_PITCH - swing * ARM_SWING;
    if (torso.current) torso.current.rotation.x = swing * TORSO_SWING;

    // W and S tilt the view; the head follows as far as a neck reasonably can.
    if (k.lookUp) pitch.current += LOOK_RATE * delta;
    if (k.lookDown) pitch.current -= LOOK_RATE * delta;
    pitch.current = THREE.MathUtils.clamp(pitch.current, -MAX_LOOK_PITCH, MAX_LOOK_PITCH);
    if (pitchRef) pitchRef.current = pitch.current;
    if (head.current) {
      head.current.rotation.x = -THREE.MathUtils.clamp(
        pitch.current,
        -MAX_HEAD_PITCH,
        MAX_HEAD_PITCH
      );
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={boat.hull} material={flatMat(PALETTE.hull)} />
      <mesh geometry={boat.interior} material={flatMat(PALETTE.hullDark)} />
      <mesh geometry={boat.gunwale} material={flatMat(PALETTE.gunwale)} />

      <mesh material={flatMat(PALETTE.thwart)} position={[0, SEAT_Y - 0.025, 0]}>
        <boxGeometry args={[0.96, 0.05, 0.24]} />
      </mesh>
      {/* Bow thwart, kept ahead of where his feet land and narrow enough for the
          hull to have closed in to ±0.22 by then. */}
      <mesh material={flatMat(PALETTE.thwart)} position={[0, DECK_Y + 0.22, 1.3]}>
        <boxGeometry args={[0.4, 0.05, 0.2]} />
      </mesh>

      {/* The man, seated. Every offset below is measured from his soles, the
          same frame `three/Player.tsx` uses, so the two are directly comparable
          — the group re-bases boat space to it once and nothing after has to
          carry an origin difference in its head. He shares that file's actual
          proportions now, out of `three/figure.ts`, rather than a copy of them
          that promised to match. Only the pose and the shading differ. */}
      <group position={[0, ORIGIN_Y, 0]}>
        {/* The torso leans from the hips, which is where a rower's back works
            from. Two groups, so the coordinates inside stay feet-measured. */}
        <group ref={torso} position={[0, HIP_Y, 0]}>
          <group position={[0, -HIP_Y, 0]}>
            <mesh geometry={BODY.torso} material={flatMat(PALETTE.suit)} />
            {/* Shirt, lapels, collar and tie, set against the torso's own front
                surface — see the same block in three/Player.tsx. The deltoid
                caps that used to sit above these are gone with his: the arms
                overlap the torso block now and there is no join to hide. */}
            <mesh material={flatMat(PALETTE.suitShirt)} position={[0, 1.35, 0.116]}>
              <boxGeometry args={[0.105, 0.22, 0.02]} />
            </mesh>
            {[-0.08, 0.08].map((x) => (
              <mesh
                key={x}
                material={flatMat(PALETTE.suit)}
                position={[x, 1.36, 0.113]}
                rotation={[0, 0, x < 0 ? 0.16 : -0.16]}
              >
                <boxGeometry args={[0.085, 0.24, 0.024]} />
              </mesh>
            ))}
            <mesh material={flatMat(PALETTE.suitShirt)} position={[0, 1.452, 0.088]}>
              <boxGeometry args={[0.15, 0.045, 0.05]} />
            </mesh>
            <mesh material={flatMat(PALETTE.suitTie)} position={[0, 1.423, 0.119]}>
              <boxGeometry args={[0.05, 0.05, 0.032]} />
            </mesh>
            {/* Short tail rather than the meadow tie's full drop — a necktie down
                to the sternum under a sailing jacket reads as the office again. */}
            <mesh material={flatMat(PALETTE.suitTie)} position={[0, 1.365, 0.118]}>
              <boxGeometry args={[0.045, 0.085, 0.028]} />
            </mesh>

            {/* Neck: the walker's, to the centimetre. Short and thick, and
                mostly buried — it spans the 6cm between the top of the torso
                block and the underside of the head, and exists so the two
                don't appear to touch, or, when the boat pitches and he leans
                into the stroke, to float apart. In the torso's frame rather
                than the head's, so it leans with his back and the head nods
                on top of it. */}
            <mesh
              material={flatMat(PALETTE.suitSkin)}
              position={[0, (TORSO_TOP_Y + HEAD_PIVOT_Y) / 2, 0]}
            >
              <cylinderGeometry args={[0.072, 0.078, HEAD_PIVOT_Y - TORSO_TOP_Y + 0.09, 10]} />
            </mesh>

            {/* Head, face and hair on a pivot at the base of the skull — the
                same two-group trick, so the coordinates below stay measured
                from his soles. */}
            <group ref={head} position={[0, HEAD_PIVOT_Y, 0]}>
              <group position={[0, -HEAD_PIVOT_Y, 0]}>
                <mesh
                  material={flatMat(PALETTE.suitSkin)}
                  position={[0, HEAD_CENTER_Y, 0]}
                  scale={HEAD_SCALE}
                >
                  <sphereGeometry args={[HEAD_RADIUS, 10, 7]} />
                </mesh>
                {/* The same sculpted head of hair the walker wears — a real
                    hairline, volume and locks with ends on them, rather than
                    the smooth half-sphere that stood here from before that
                    existed. Pressed flat where the cap covers it and at full
                    height below the band, so it is hair that shows under the
                    brim rather than a painted-on edge. */}
                <mesh
                  geometry={getHairGeometry(CAP_HAT)}
                  material={hairMaterial}
                  position={[0, HEAD_CENTER_Y, 0]}
                  scale={HEAD_CAP_SCALE}
                />

                {/* Peaked sailing cap over the hair, with a navy band and peak —
                    an all-white crown against a bright sky loses its shape.
                    Sized off the head, which just doubled. */}
                <mesh
                  material={flatMat(PALETTE.suitCap)}
                  position={[0, HEAD_CENTER_Y + 0.018, -0.009]}
                  scale={HEAD_CAP_SCALE}
                >
                  <sphereGeometry args={[CAP_RADIUS, 10, 7, 0, Math.PI * 2, 0, CAP_CUT]} />
                </mesh>
                <mesh
                  material={flatMat(PALETTE.suitCapTrim)}
                  position={[0, HEAD_CENTER_Y + 0.062, -0.009]}
                  scale={HEAD_CAP_SCALE}
                >
                  <cylinderGeometry args={[CAP_BAND_RADIUS, CAP_BAND_RADIUS, 0.036, 10]} />
                </mesh>
                <mesh
                  material={flatMat(PALETTE.suitCapTrim)}
                  position={[0, HEAD_CENTER_Y + 0.05, HEAD_RADIUS * 0.98]}
                  rotation={[0.16, 0, 0]}
                >
                  <boxGeometry args={[0.2, 0.022, 0.13]} />
                </mesh>

                {/* Face: two eyes, matching the meadow figure exactly — the
                    brows, nose and mouth went with his. */}
                {[-EYE_X, EYE_X].map((x) => (
                  <mesh
                    key={x}
                    material={flatMat(PALETTE.suitFeature)}
                    position={[x, EYE_Y, EYE_Z]}
                    scale={[1, 1.2, 0.38]}
                  >
                    <sphereGeometry args={[0.034, 10, 8]} />
                  </mesh>
                ))}
              </group>
            </group>

            {/* Arms, angled down and forward so the fists meet the oar handles.
                They keep the meadow figure's elbow, which the old single tube
                did not have — a rower's arm bends, and it is the one limb the
                camera sits directly behind. */}
            {[-1, 1].map((side) => (
              <group
                key={side}
                ref={side === -1 ? armL : armR}
                position={[side * SHOULDER_X, SHOULDER_Y, 0]}
                rotation={[ARM_REST_PITCH, 0, side * 0.22]}
              >
                <mesh geometry={BODY.upperArm} material={flatMat(PALETTE.suit)} />
                <group position={[0, -ELBOW_DROP, 0]}>
                  <mesh material={flatMat(PALETTE.suit)} scale={[1, 0.95, 1.05]}>
                    <sphereGeometry args={[0.065, 8, 6]} />
                  </mesh>
                  <mesh geometry={BODY.forearm} material={flatMat(PALETTE.suit)} />
                  {/* A fist round the handle rather than the open hand he walks
                      with — and sized like one, at half the ball it used to be. */}
                  <mesh
                    material={flatMat(PALETTE.suitSkin)}
                    position={[0, -WRIST_DROP - 0.012, 0]}
                    scale={[1, 1.05, 1.1]}
                  >
                    <sphereGeometry args={[0.06, 8, 6]} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>
        </group>

        {/* Legs stretched forward along the deck. Outside the torso group, so
            they stay put while his back swings through the stroke. */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * LEG_X, 0, 0]}>
            <mesh
              geometry={BODY.thigh}
              material={flatMat(PALETTE.suitTrouser)}
              position={[0, HIP_Y, 0]}
              rotation={limbPitch(THIGH_PITCH)}
            />
            <mesh material={flatMat(PALETTE.suitTrouser)} position={[0, KNEE_Y, KNEE_Z]} scale={[1, 0.92, 1.02]}>
              <sphereGeometry args={[0.077, 8, 6]} />
            </mesh>
            <mesh
              geometry={BODY.shin}
              material={flatMat(PALETTE.suitTrouser)}
              position={[0, KNEE_Y, KNEE_Z]}
              rotation={limbPitch(SHIN_PITCH)}
            />
            <mesh
              material={flatMat(PALETTE.suitShoe)}
              position={[0, DECK_LOCAL + SHOE_HEIGHT / 2, ANKLE_Z + 0.06]}
            >
              <boxGeometry args={[0.113, SHOE_HEIGHT, 0.285]} />
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
