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
 * A station: a marble hall with an open front, a steel gantry over the rope,
 * and the sheave the rope runs on.
 *
 * The upper one stands on the house's own terrace and is built of the house's
 * marble; the lower one is the same building in the same stone, which is what
 * says one estate built both ends of it.
 */
function Station({
  head,
  ground,
  facing,
  size,
}: {
  head: THREE.Vector3;
  /** Floor level: the terrace up top, the valley floor at the bottom. */
  ground: number;
  /** Y rotation that puts the building square to the line. */
  facing: number;
  size: number;
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
      <mesh material={stone} position={[0, height * 0.42, -d * 0.28]}>
        <boxGeometry args={[w, height * 0.84, d * 0.55]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={stone} position={[(s * w) / 2 - s * 0.5, height * 0.42, d * 0.18]}>
          <boxGeometry args={[1.2, height * 0.84, d * 0.4]} />
        </mesh>
      ))}
      {/* Cornice, matching the house's, and a shallow gabled roof over it —
          the same building the house is, one storey of it, doing a job. */}
      <mesh material={shade} position={[0, height * 0.86, -d * 0.1]}>
        <boxGeometry args={[w + 1.4, height * 0.09, d * 0.95]} />
      </mesh>
      {/* -s: rotation.z = +pitch lifts a box's +x edge, so the left slope
          needs the positive angle to rise toward the ridge, not fall from it. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={flatMat(PALETTE.roofLead)}
          position={[(s * (w + 1.4)) / 4, height * 0.95 + 0.6, -d * 0.1]}
          rotation={[0, 0, -s * Math.atan2(1.5, (w + 1.4) / 2)]}
        >
          <boxGeometry args={[Math.hypot((w + 1.4) / 2, 1.5), 0.35, d * 0.95]} />
        </mesh>
      ))}
      {/* Apron under the floor, so the building meets sloping ground. */}
      <mesh material={deep} position={[0, -3, -d * 0.28]}>
        <boxGeometry args={[w + 1, 8, d * 0.6]} />
      </mesh>

      {/* The gantry: two legs and a beam, carrying the sheave the rope runs
          over. This is the piece that says what the building is for. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={steel}
          position={[(s * TRACK_GAP) / 2, (height + height * 0.86) / 2 - 0.6, d * 0.3]}
          rotation={[0, 0, s * 0.06]}
        >
          <boxGeometry args={[0.7, height * 0.4, 0.7]} />
        </mesh>
      ))}
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
      <Station head={TOP} ground={MANSION.court} facing={facing} size={9} />
      <Station head={BOTTOM} ground={TRAMWAY.bottomGround} facing={facing + Math.PI} size={8} />
      <Car side={-1} offset={0} />
      <Car side={1} offset={1} />
    </group>
  );
}
