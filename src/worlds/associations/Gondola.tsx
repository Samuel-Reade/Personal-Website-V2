import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { MANSION, TRAMWAY } from "./layout";

/**
 * The cable car down the back of the mountain.
 *
 * A reversible tramway: two cars on two ropes, tied together so that as one
 * comes up the other goes down and they pass at the middle of the span. That is
 * how a mountain of this shape is actually served, and it is also what makes
 * the thing read as machinery from a distance — one car creeping down a wire is
 * a dot, two of them crossing is a working railway.
 *
 * One free span, no pylons between the stations. The north face falls a hundred
 * and twenty units in the first sixty of the run, so a line of towers down it
 * would have to be forty and fifty units tall to hold the rope off the rock;
 * this span clears the ground by nearly sixty at its middle and needs nothing
 * under it. The reasoning is with the numbers, on TRAMWAY in `layout.ts`.
 */

/** Where the ropes hang, and how far apart the two tracks are. */
const TOP = new THREE.Vector3(...TRAMWAY.top);
const BOTTOM = new THREE.Vector3(...TRAMWAY.bottom);
const TRACK_GAP = 4.4;

/**
 * How deep the ropes sag at the middle of the span.
 *
 * A rope hangs in a catenary and a straight line between two towers is the one
 * thing that never happens. Over ninety units this is about right for a track
 * cable under tension — enough to see against the sky, not enough to read as
 * washing line.
 */
const SAG = 4.2;

/** How long a car takes to run the span, and how long it waits at each end. */
const RUN_SECONDS = 26;
const DWELL_SECONDS = 4;

/** Sideways offset of a track, in the horizontal normal to the line. */
const acrossLine = (() => {
  const along = new THREE.Vector3().subVectors(BOTTOM, TOP);
  return new THREE.Vector3(-along.z, 0, along.x).normalize();
})();

/**
 * A point on one track at 0 (top) to 1 (bottom), sag included.
 *
 * The sag is a parabola rather than a true catenary. Over a single span at this
 * size the two differ by less than the width of the rope, and a parabola is one
 * multiply.
 */
function trackPoint(t: number, side: number, out = new THREE.Vector3()): THREE.Vector3 {
  out.lerpVectors(TOP, BOTTOM, t);
  out.addScaledVector(acrossLine, (side * TRACK_GAP) / 2);
  out.y -= SAG * 4 * t * (1 - t);
  return out;
}

/** The rope itself: a tube down the sagging line. */
function cableGeometry(side: number): THREE.BufferGeometry {
  const points = Array.from({ length: 33 }, (_, i) => trackPoint(i / 32, side));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.14, 5, false);
}

/**
 * A station: a marble hall with an open mouth facing down the line, and a
 * steel headframe rising out of it to carry the sheaves the ropes run over.
 *
 * The hall and the headframe are sized separately. The rope has to be hung
 * where the mountain demands — high enough that the cars clear the shoulder
 * the line crosses — and a hall built up to that height would be a keep, not
 * a hut. So the hall stays a storey tall in the house's own marble, and the
 * steel does the reaching, which is how a real tramway divides the job.
 *
 * The upper one stands on the mansion's court and is joined to the house by
 * its gallery; the lower one is the same building in the same stone, which is
 * what says one estate built both ends of it.
 */
function Station({
  head,
  ground,
  facing,
  size,
  hallHeight,
}: {
  head: THREE.Vector3;
  /** Floor level: the court up top, the valley floor at the bottom. */
  ground: number;
  /** Y rotation that puts the building square to the line. */
  facing: number;
  size: number;
  /** The marble hall's height; the steel continues up to the head. */
  hallHeight: number;
}) {
  const stone = flatMat(PALETTE.marble);
  const shade = flatMat(PALETTE.marbleShade);
  const steel = flatMat(PALETTE.gantry);
  const deep = flatMat(PALETTE.marbleDeep);

  const height = head.y - ground;
  const w = size;
  const d = size * 1.25;

  return (
    <group position={[head.x, ground, head.z]} rotation={[0, facing, 0]}>
      {/* The hall: three closed sides and an open mouth facing down the line. */}
      <mesh material={stone} position={[0, hallHeight * 0.5, -d * 0.28]}>
        <boxGeometry args={[w, hallHeight, d * 0.55]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={stone} position={[(s * w) / 2 - s * 0.5, hallHeight * 0.5, d * 0.18]}>
          <boxGeometry args={[1.2, hallHeight, d * 0.4]} />
        </mesh>
      ))}
      {/* Cornice, matching the house's, and a shallow gabled roof over it —
          the same building the house is, one storey of it, doing a job. */}
      <mesh material={shade} position={[0, hallHeight + 0.4, -d * 0.1]}>
        <boxGeometry args={[w + 1.4, 0.8, d * 0.95]} />
      </mesh>
      {/* -s: rotation.z = +pitch lifts a box's +x edge, so the left slope
          needs the positive angle to rise toward the ridge, not fall from it. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={flatMat(PALETTE.roofLead)}
          position={[(s * (w + 1.4)) / 4, hallHeight + 1.4, -d * 0.1]}
          rotation={[0, 0, -s * Math.atan2(1.5, (w + 1.4) / 2)]}
        >
          <boxGeometry args={[Math.hypot((w + 1.4) / 2, 1.5), 0.35, d * 0.95]} />
        </mesh>
      ))}
      {/* Apron under the floor, so the building meets sloping ground. */}
      <mesh material={deep} position={[0, -3, -d * 0.28]}>
        <boxGeometry args={[w + 1, 8, d * 0.6]} />
      </mesh>

      {/* The headframe: two braced steel legs and a beam over the mouth,
          carrying the sheaves. This is the piece that says what the building
          is for, and the only piece allowed taller than the hall. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={steel}
          position={[(s * TRACK_GAP) / 2, height / 2, d * 0.3]}
          rotation={[0, 0, s * 0.04]}
        >
          <boxGeometry args={[0.7, height, 0.7]} />
        </mesh>
      ))}
      <mesh material={steel} position={[0, height * 0.62, d * 0.3]}>
        <boxGeometry args={[TRACK_GAP + 1.2, 0.5, 0.5]} />
      </mesh>
      <mesh material={steel} position={[0, height - 0.4, d * 0.3]}>
        <boxGeometry args={[TRACK_GAP + 2.4, 0.8, 1.1]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={flatMat(PALETTE.cable)}
          position={[(s * TRACK_GAP) / 2, height - 1.1, d * 0.3]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[1.1, 1.1, 0.5, 10]} />
        </mesh>
      ))}

      {/*
        There was a boarding platform and a flight of steps in here and they
        are gone, because both were wrong and neither could be made right at
        this size. The cars dock seven and a third under the rope, which at the
        upper station is most of two storeys over the hall's floor; the steps
        ran out sideways through the hall's own side wall, and the lowest tread
        stopped three and a quarter units up in mid-air. Getting it honest
        needs an internal stair of fourteen treads inside a hut nine units
        across, seen from eighty-five units away — geometry nobody can ever
        resolve, to fix a mistake nobody could see either. The mouth and the
        headframe say what the building is; the boarding is left to the
        imagination, which is where it was always going to happen.
      */}
    </group>
  );
}

/** One car: a hanger arm off the rope, a body, a roof and a band of glass. */
function Car({ side, offset }: { side: number; offset: number }) {
  const group = useRef<THREE.Group>(null!);
  const point = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const cycle = (RUN_SECONDS + DWELL_SECONDS) * 2;
    const phase = (state.clock.elapsedTime + offset * cycle * 0.5) % cycle;
    /** A run down, a wait, a run back, a wait — so the two cars pass mid-span. */
    const half = RUN_SECONDS + DWELL_SECONDS;
    const inRun = phase % half;
    const going = phase < half;
    const t = THREE.MathUtils.clamp(inRun / RUN_SECONDS, 0, 1);
    // Eased at both ends: a car that starts and stops at full speed reads as a
    // bead pulled along a string.
    const eased = t * t * (3 - 2 * t);
    const along = going ? eased : 1 - eased;

    trackPoint(along, side, point);
    group.current.position.copy(point);
    // Hung level whatever the rope is doing, and swung a little as it goes — a
    // car on a rope is never quite still.
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.7 + offset * 3) * 0.035;
  });

  const body = flatMat(PALETTE.heliAccent);
  const trim = flatMat(PALETTE.heliBody);
  const glass = flatMat(PALETTE.heliGlass);
  const steel = flatMat(PALETTE.gantry);

  return (
    <group ref={group}>
      {/* The bogie on the rope, and the arm down to the cabin. */}
      <mesh material={steel} position={[0, -0.35, 0]}>
        <boxGeometry args={[1.1, 0.7, 2.6]} />
      </mesh>
      <mesh material={steel} position={[0, -2.2, 0]}>
        <boxGeometry args={[0.5, 3.4, 0.5]} />
      </mesh>
      <group position={[0, -5.6, 0]}>
        <mesh material={body}>
          <boxGeometry args={[3.6, 3.4, 5]} />
        </mesh>
        {/* A band of glass right round it, and a red roof and skirt so the two
            cars read as the same fleet as the helicopter. */}
        <mesh material={glass} position={[0, 0.5, 0]}>
          <boxGeometry args={[3.75, 1.7, 5.15]} />
        </mesh>
        <mesh material={trim} position={[0, 1.85, 0]}>
          <boxGeometry args={[4.1, 0.5, 5.5]} />
        </mesh>
        <mesh material={trim} position={[0, -1.75, 0]}>
          <boxGeometry args={[3.8, 0.4, 5.2]} />
        </mesh>
      </group>
    </group>
  );
}

export function Gondola() {
  const cables = useMemo(() => [cableGeometry(-1), cableGeometry(1)], []);
  useEffect(() => () => cables.forEach((c) => c.dispose()), [cables]);

  /** Both stations face along the line, which is the bearing from top to bottom. */
  const facing = useMemo(
    () => Math.atan2(BOTTOM.x - TOP.x, BOTTOM.z - TOP.z),
    []
  );

  return (
    <group>
      {cables.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={flatMat(PALETTE.cable)} />
      ))}
      <Station head={TOP} ground={MANSION.court} facing={facing} size={9} hallHeight={7.2} />
      <Station head={BOTTOM} ground={TRAMWAY.bottomGround} facing={facing + Math.PI} size={8} hallHeight={6.6} />
      <Car side={-1} offset={0} />
      <Car side={1} offset={1} />
    </group>
  );
}
