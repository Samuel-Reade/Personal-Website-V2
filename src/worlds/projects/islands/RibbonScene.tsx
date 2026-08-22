import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../palette";
import { flatMat, flatMatUnique, seeded } from "../materials";

/**
 * Prancer: a machine with a belt running in either side of it. A tangle of red
 * ribbon rides in on the left, the machine takes it, and a straight green
 * ribbon runs out on the right.
 *
 * The tool rewrites a stream-of-consciousness dump into a structured prompt, and
 * that is a hard thing to put on an island — the input and the output are both
 * text, and text does not read from a boat. Ribbon does: crumpled against
 * straight is the same difference in one glance, at any distance, with nothing
 * to read. The two belts are what make it a process rather than two props, and
 * the housing between them is deliberately a plain grey box, because the box is
 * not the point. What goes in and what comes out is.
 */

/** The whole piece, end to end. Its half-diagonal has to clear the plateau's tight side — see layout.ts. */
const BASE_W = 7.8;
const BASE_D = 2.4;
const BASE_H = 0.22;

/** The housing. Width sets where the belts start, since they butt against its sides. */
const HOUSE_W = 2.6;
const HOUSE_H = 2.5;
const HOUSE_D = 2.2;

/** Belt geometry. `BELT_IN`/`BELT_OUT` are the x of the mouth and of the far roller. */
const BELT_IN = HOUSE_W / 2;
const BELT_OUT = BASE_W / 2;
const BELT_LEN = BELT_OUT - BELT_IN;
const BELT_D = 1.2;
/** Top surface of the belt — the height everything rides at. */
const BELT_TOP = 1.0;
const BELT_THICK = 0.14;

/** Slats crossing the belt, so a running belt reads as running rather than as a plank. */
const SLAT_SPACING = 0.52;
const SLAT_COUNT = Math.ceil(BELT_LEN / SLAT_SPACING) + 1;
/** World units per second the belts travel. */
const BELT_SPEED = 0.62;

/** One pass of the machine, in seconds. */
const CYCLE = 4.6;

/**
 * The cycle, as fractions of it. The two ribbons never share the belt: the
 * tangle is gone before the clean one appears, which is what makes the machine
 * look like it is doing the work rather than passing something along.
 */
const IN_TRAVEL_END = 0.38;
const SWALLOW_START = 0.31;
const SWALLOW_END = 0.4;
const OUT_START = 0.44;
const OUT_GROWN = 0.68;
const EXIT_START = 0.74;

/**
 * The tangle: short flats of ribbon at scattered angles with two loose coils
 * through them. Built from a seed rather than from hand-placed numbers, because
 * the one thing a crumple must not look like is arranged — and pinned to a seed
 * rather than to Math.random so it survives a re-render as the same crumple.
 */
const TANGLE_FLATS = Array.from({ length: 9 }, (_, i) => ({
  position: [
    (seeded(i * 1.7 + 4.1) - 0.5) * 0.52,
    (seeded(i * 2.3 + 8.7) - 0.5) * 0.4,
    (seeded(i * 3.1 + 12.9) - 0.5) * 0.4,
  ] as [number, number, number],
  rotation: [
    seeded(i * 4.7 + 1.3) * Math.PI,
    seeded(i * 5.9 + 6.1) * Math.PI,
    seeded(i * 7.3 + 9.7) * Math.PI,
  ] as [number, number, number],
  length: 0.34 + seeded(i * 8.9 + 3.3) * 0.22,
}));

const TANGLE_COILS = [
  { position: [-0.14, 0.04, 0.05] as [number, number, number], rotation: [1.1, 0.4, 0.3] as [number, number, number] },
  { position: [0.18, -0.02, -0.07] as [number, number, number], rotation: [0.5, 1.2, -0.6] as [number, number, number] },
];

/**
 * Height of the wad's centre above the belt. The pieces above are laid out
 * around the group's origin rather than above it, so this is what stands the
 * crumple on the belt instead of half-sunk into it. Set against the wad's
 * typical reach rather than its worst case: a flat pointing straight down from
 * the furthest offset would graze the bed, and a height that cleared even that
 * left the crumple visibly hovering for the whole ride.
 */
const TANGLE_RIDE = 0.46;

/**
 * The straight run: flat, wide and level, the opposite of the tangle in every
 * dimension. Both numbers have been up twice. A ribbon's real proportions —
 * a couple of centimetres thick against a hand's width — vanish at this scale
 * against a grey belt, and the pairing only works if the green weighs as much
 * in the eye as the red wad does.
 */
const CLEAN_THICK = 0.13;
const CLEAN_WIDTH = 0.7;

/** One conveyor, from the housing mouth outward. `side` is -1 for the intake, +1 for the output. */
function Belt({
  side,
  slatRefs,
}: {
  side: -1 | 1;
  slatRefs: React.MutableRefObject<(THREE.Mesh | null)[]>;
}) {
  const mid = side * (BELT_IN + BELT_LEN / 2);
  return (
    <group position={[mid, 0, 0]}>
      {/* Undercarriage. One skirt rather than four legs: at this size a leg is
          two pixels of grey, and four of them read as noise under the belt. */}
      <mesh material={flatMat(PALETTE.machineDark)} position={[0, (BASE_H + BELT_TOP - BELT_THICK) / 2, 0]}>
        <boxGeometry args={[BELT_LEN * 0.82, BELT_TOP - BELT_THICK - BASE_H, BELT_D * 0.66]} />
      </mesh>

      {/* The bed the ribbon rides on. */}
      <mesh material={flatMat(PALETTE.beltSurface)} position={[0, BELT_TOP - BELT_THICK / 2, 0]}>
        <boxGeometry args={[BELT_LEN, BELT_THICK, BELT_D]} />
      </mesh>

      {/* Side rails. Kept below the top of the clean ribbon on purpose: at the
          boat's low angle the near rail is between the eye and the belt, and a
          rail even slightly taller than what it carries hides the whole run. */}
      {[-1, 1].map((z) => (
        <mesh
          key={z}
          material={flatMat(PALETTE.beltFrame)}
          position={[0, BELT_TOP - 0.06, z * (BELT_D / 2 + 0.05)]}
        >
          <boxGeometry args={[BELT_LEN, 0.16, 0.1]} />
        </mesh>
      ))}

      {/* End rollers, lying across the belt. */}
      {[-1, 1].map((x) => (
        <mesh
          key={x}
          material={flatMat(PALETTE.beltRoller)}
          position={[x * (BELT_LEN / 2 - 0.02), BELT_TOP - BELT_THICK / 2, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[BELT_THICK * 0.72, BELT_THICK * 0.72, BELT_D, 8]} />
        </mesh>
      ))}

      {/* The moving part. Positions are driven in the scene's frame loop; what
          is set here is only their spacing along the belt. */}
      {Array.from({ length: SLAT_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(node) => {
            slatRefs.current[(side === -1 ? 0 : SLAT_COUNT) + i] = node;
          }}
          material={flatMat(PALETTE.beltSlat)}
          position={[0, BELT_TOP + 0.015, 0]}
        >
          <boxGeometry args={[0.1, 0.05, BELT_D - 0.08]} />
        </mesh>
      ))}
    </group>
  );
}

export function RibbonScene() {
  const slats = useRef<(THREE.Mesh | null)[]>([]);
  const tangle = useRef<THREE.Group>(null!);
  const clean = useRef<THREE.Group>(null!);

  // Driven every frame, so it cannot come from the shared cache.
  const lampMat = useMemo(
    () => flatMatUnique(PALETTE.machineLamp, { emissive: PALETTE.machineLamp, emissiveIntensity: 0 }),
    []
  );
  useEffect(() => () => lampMat.dispose(), [lampMat]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Belts run whether or not anything is on them — a mill idles, it doesn't
    // stop. Each slat wraps the belt's length independently of the cycle below.
    const scroll = (time * BELT_SPEED) % SLAT_SPACING;
    for (let i = 0; i < slats.current.length; i++) {
      const slat = slats.current[i];
      if (!slat) continue;
      const index = i % SLAT_COUNT;
      slat.position.x = ((index * SLAT_SPACING + scroll) % BELT_LEN) - BELT_LEN / 2;
    }

    const t = (time % CYCLE) / CYCLE;

    // The tangle, riding in. Scale carries both the arrival at the far roller
    // and the swallow at the mouth, so the ribbon is never half inside the wall.
    const ride = THREE.MathUtils.clamp(t / IN_TRAVEL_END, 0, 1);
    const arrive = THREE.MathUtils.smoothstep(t, 0, 0.05);
    const swallow = 1 - THREE.MathUtils.smoothstep(t, SWALLOW_START, SWALLOW_END);
    const tangleScale = Math.min(arrive, swallow);
    tangle.current.visible = tangleScale > 0.01;
    tangle.current.position.x = THREE.MathUtils.lerp(-BELT_OUT + 0.2, -BELT_IN + 0.1, ride);
    tangle.current.position.y = BELT_TOP + TANGLE_RIDE + Math.sin(time * 3.1) * 0.015;
    tangle.current.scale.setScalar(tangleScale);
    // A shift on the belt rather than a tumble. A belt carries what is on it; a
    // wad that rolls end over end all the way to the mouth is a wad on a slope,
    // and it would swing its far pieces down through the bed on every turn.
    tangle.current.rotation.set(
      Math.sin(time * 1.9) * 0.07,
      0.6 + Math.sin(time * 1.5) * 0.13,
      Math.sin(time * 2.2) * 0.1
    );

    /**
     * The clean run, as two ends rather than as a position and a length. The
     * leading end leaves the mouth first and stops at the far roller; then the
     * trailing end follows it off the end of the belt. Driving both ends is what
     * lets the ribbon extrude and then run off without ever overhanging the
     * island — a fixed-length strip translated the same distance would finish
     * two units out over the water.
     */
    const lead = THREE.MathUtils.lerp(
      BELT_IN,
      BELT_OUT,
      THREE.MathUtils.smoothstep(t, OUT_START, OUT_GROWN)
    );
    const tail = THREE.MathUtils.lerp(BELT_IN, BELT_OUT, THREE.MathUtils.smoothstep(t, EXIT_START, 0.94));
    const span = lead - tail;
    clean.current.visible = span > 0.02;
    clean.current.position.x = tail;
    clean.current.scale.x = Math.max(span / BELT_LEN, 0.0001);

    // The lamp is lit across the working window — from the moment the tangle
    // reaches the mouth to the moment the clean run is fully out — with a flicker
    // on it, so the machine looks like it is straining rather than idling.
    const working = THREE.MathUtils.smoothstep(t, SWALLOW_START, SWALLOW_START + 0.04) *
      (1 - THREE.MathUtils.smoothstep(t, OUT_GROWN, OUT_GROWN + 0.05));
    lampMat.emissiveIntensity = working * (0.55 + Math.sin(time * 11) * 0.18);
  });

  return (
    <group>
      {/* Base slab, tying the housing and both belts into one machine instead of
          three objects standing near each other on a hilltop. */}
      <mesh material={flatMat(PALETTE.machineDark)} position={[0, BASE_H / 2, 0]}>
        <boxGeometry args={[BASE_W, BASE_H, BASE_D]} />
      </mesh>

      <Belt side={-1} slatRefs={slats} />
      <Belt side={1} slatRefs={slats} />

      {/* The housing. */}
      <mesh material={flatMat(PALETTE.machineBody)} position={[0, BASE_H + HOUSE_H / 2, 0]}>
        <boxGeometry args={[HOUSE_W, HOUSE_H, HOUSE_D]} />
      </mesh>
      <mesh material={flatMat(PALETTE.machineTrim)} position={[0, BASE_H + HOUSE_H + 0.07, 0]}>
        <boxGeometry args={[HOUSE_W + 0.22, 0.14, HOUSE_D + 0.22]} />
      </mesh>
      {/* Louvres across the roof. They were two upright boxes first, which broke
          the silhouette and read as chimneys doing it — and the works across the
          bay already has chimneys. Laid flat and run the other way they read as
          what a machine has on top of it instead. */}
      {[-0.62, 0, 0.62].map((z) => (
        <mesh key={z} material={flatMat(PALETTE.machineDark)} position={[0, BASE_H + HOUSE_H + 0.25, z]}>
          <boxGeometry args={[HOUSE_W - 0.5, 0.22, 0.28]} />
        </mesh>
      ))}

      {/* Intake and output mouths, set slightly proud of the walls so the dark
          reads as an opening rather than as paint. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={flatMat(PALETTE.machineMouth)}
          position={[side * (HOUSE_W / 2 + 0.02), BELT_TOP + 0.34, 0]}
        >
          <boxGeometry args={[0.08, 0.8, BELT_D - 0.1]} />
        </mesh>
      ))}

      {/* The face, turned toward spawn: a readout panel and the working lamp. */}
      <mesh material={flatMat(PALETTE.machinePanel)} position={[-0.28, BASE_H + 1.72, HOUSE_D / 2 + 0.03]}>
        <boxGeometry args={[1.4, 0.86, 0.08]} />
      </mesh>
      <mesh material={lampMat} position={[0.78, BASE_H + 1.72, HOUSE_D / 2 + 0.05]}>
        <sphereGeometry args={[0.16, 8, 6]} />
      </mesh>

      {/* Ribbon in: a crumple. Positioned and tumbled in the frame loop; the
          group here only holds its shape. */}
      <group ref={tangle} position={[-BELT_OUT + 0.2, BELT_TOP + TANGLE_RIDE, 0]}>
        {TANGLE_FLATS.map((flat, i) => (
          <mesh
            key={i}
            material={flatMat(i % 3 === 0 ? PALETTE.ribbonMessyDark : PALETTE.ribbonMessy)}
            position={flat.position}
            rotation={flat.rotation}
          >
            <boxGeometry args={[flat.length, 0.045, 0.24]} />
          </mesh>
        ))}
        {TANGLE_COILS.map((coil, i) => (
          <mesh
            key={i}
            material={flatMat(PALETTE.ribbonMessy)}
            position={coil.position}
            rotation={coil.rotation}
          >
            <torusGeometry args={[0.26, 0.05, 3, 7]} />
          </mesh>
        ))}
      </group>

      {/* Ribbon out. The mesh is offset half a length so the group's origin is
          the ribbon's trailing end, which is what the frame loop drives. */}
      <group ref={clean} position={[BELT_IN, BELT_TOP + CLEAN_THICK / 2 + 0.02, 0]}>
        <mesh material={flatMat(PALETTE.ribbonClean)} position={[BELT_LEN / 2, 0, 0]}>
          <boxGeometry args={[BELT_LEN, CLEAN_THICK, CLEAN_WIDTH]} />
        </mesh>
        {/* Edge lines, so a flat strip seen end-on from the water still has two
            sides to it rather than being one green line. */}
        {[-1, 1].map((z) => (
          <mesh
            key={z}
            material={flatMat(PALETTE.ribbonCleanDark)}
            position={[BELT_LEN / 2, 0.012, z * (CLEAN_WIDTH / 2 - 0.03)]}
          >
            <boxGeometry args={[BELT_LEN, CLEAN_THICK, 0.08]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
