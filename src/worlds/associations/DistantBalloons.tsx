import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { BurnerFlame } from "./burner";
import { PROFILE } from "./envelope";
import { MIN_ALTITUDE } from "./layout";

/**
 * Panels around a far envelope. Half the fourteen the tethered balloons carry:
 * at this range a gore is a couple of pixels across, and the silhouette is the
 * only thing of the panelling that survives the distance.
 */
const GORES = 8;
/** Columns across a panel. One, for the same reason. */
const COLUMNS = 1;

export interface FarBalloon {
  /** Where it flies, in world XZ, and how far above the flight floor. */
  x: number;
  z: number;
  aboveFloor: number;
  radius: number;
  /** Envelope colours, alternating gore by gore. */
  a: string;
  b: string;
  /** Decorrelates its drift from the others'. */
  phase: number;
}

/**
 * Four balloons flying together beyond the northern ridges, around 430 units
 * out — well past FLIGHT_RADIUS, so they can be looked at and never reached.
 *
 * Clustered the way balloons actually fly: a group launched together, drifting
 * on one wind, spread over a few tens of units in plan and stacked over three
 * dozen in height, since a flight finds its own altitudes. The spread is set in
 * what it subtends rather than in units — the four fill about eleven degrees
 * from the arena and thirteen from the balcony, which reads as a cluster in one
 * glance without any two of them overlapping into a single blob.
 *
 * Both of those viewpoints are now checked, which is the reason these moved.
 * The cluster used to be laid out against the arena alone, and it was clean
 * from there — but the mansion's balcony sees it from a different corner of
 * the range, and from that corner the rust and sand envelopes stood 3.4
 * degrees apart with 3.1 degrees of envelope between them: touching, and the
 * sand one mostly hidden behind its neighbour. So the four are placed in the
 * balcony's own frame — along its sightline and across it — and then checked
 * back from the arena, and no pair is nearer than 1.9 times the sum of its
 * radii from either eye.
 *
 * They also fly a third further out than they did. From the balcony they were
 * a little over two hundred away, close enough to read as four balloons over
 * the next ridge; a cluster meant to be admired from a mountain house should
 * be a long way off, so it went out past four hundred and lost a third of its
 * apparent size with the distance.
 *
 * A colour each and cream between, no two dominant tones repeated — see the
 * palette's note. It is the only thing that separates them at this range: four
 * silhouettes of the same shape, at the same apparent size, differ by hue and
 * nothing else, and the same four are what the mansion's telescope shows by day.
 *
 * Their heights come off the flight floor, like everything else in this world,
 * so the group rides with the terrain if the range is ever retuned, and they
 * are pitched a little above the helicopter's own spawn altitude — a distant
 * balloon below the eyeline is a speck against a hazy ridge, and above it, a
 * silhouette against the sky.
 */
export const FAR_BALLOONS: FarBalloon[] = [
  { x: 51, z: -413, aboveFloor: 16, radius: 6.4, a: PALETTE.farBalloonRust, b: PALETTE.farBalloonCream, phase: 0 },
  { x: 114, z: -419, aboveFloor: 30, radius: 5.6, a: PALETTE.farBalloonSand, b: PALETTE.farBalloonCream, phase: 1.9 },
  { x: 31, z: -443, aboveFloor: 40, radius: 6.0, a: PALETTE.farBalloonSky, b: PALETTE.farBalloonCream, phase: 3.4 },
  { x: 66, z: -381, aboveFloor: 6, radius: 5.2, a: PALETTE.farBalloonMoss, b: PALETTE.farBalloonCream, phase: 5.1 },
];

/** How far and how slowly one drifts on its own wind. */
const DRIFT = 2.6;
const DRIFT_SPEED = 0.045;
const BOB = 0.9;
const BOB_SPEED = 0.13;

/**
 * How far a balloon has wandered from its stated place at a given moment.
 *
 * Exported because the mansion's telescope shows this same cluster — the
 * balcony looks straight down the line of it — and two copies of this drift
 * would put the four balloons in one place seen from the air and a couple of
 * units off seen through the lens. One of them would be lying, and there is no
 * way to tell which from either end.
 */
export function farBalloonDrift(t: number, phase: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(
    Math.sin(t * DRIFT_SPEED + phase) * DRIFT,
    Math.sin(t * BOB_SPEED + phase) * BOB,
    Math.cos(t * DRIFT_SPEED * 0.8 + phase) * DRIFT
  );
}

/**
 * The envelope, at unit radius, built once and shared by all four.
 *
 * Every gore carries its own vertices — which is what keeps each panel a single
 * flat tone — and the gores are dealt alternately into two material groups, so
 * a two-tone envelope is two draws rather than fourteen meshes. The near
 * balloons do it the other way round because theirs have to glow on proximity,
 * which needs a material per balloon rather than a material per colour.
 */
function buildEnvelope(): THREE.BufferGeometry {
  const phi = (Math.PI * 2) / GORES;
  const rows = PROFILE.length;
  const positions: number[] = [];
  const indices: number[] = [];
  const groups: { start: number; count: number; material: number }[] = [];

  for (let g = 0; g < GORES; g++) {
    const base = g * rows * (COLUMNS + 1);
    for (const [y, w] of PROFILE) {
      for (let c = 0; c <= COLUMNS; c++) {
        const angle = g * phi + (c / COLUMNS) * phi;
        positions.push(Math.cos(angle) * w, y, Math.sin(angle) * w);
      }
    }
    const start = indices.length;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < COLUMNS; c++) {
        const a = base + r * (COLUMNS + 1) + c;
        indices.push(a, a + COLUMNS + 1, a + 1, a + 1, a + COLUMNS + 1, a + COLUMNS + 2);
      }
    }
    groups.push({ start, count: indices.length - start, material: g % 2 });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  for (const { start, count, material } of groups) geometry.addGroup(start, count, material);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Where the basket hangs below the envelope's centre, and how far above it the
 * burner stands — both as fractions of the radius.
 *
 * Exported for the same reason `farBalloonDrift` is: the Connect balcony draws
 * this cluster a second time in the hall's own unlit materials, and a basket
 * hung at one fraction here and another there would be two balloons of
 * different builds claiming to be the same four.
 */
export const BASKET_DROP = 1.62;
export const BURNER_RISE = 0.16;

/**
 * The burner's flame, as a fraction of the radius it hangs under — and a long
 * way over life size.
 *
 * A real burner throws about a metre, which on a six-unit envelope is a tenth
 * of its own width and four hundred units out is well under a pixel: cut to
 * scale these four had no flame at all after dark, which is the one thing a
 * balloon at night is. So the flame is drawn at the size it has to be *seen*
 * at rather than the size it is — the same cheat the interests room's window
 * plays with its treelines, and it costs nothing here because this cluster
 * flies past FLIGHT_RADIUS and can never be come up on and caught at it.
 *
 * Exported alongside the drop above: the balcony sees these four from 316 to
 * 377 out, which is the same argument at the same range, so it burns them at
 * the same size rather than picking its own.
 */
export const FLAME = 0.44;

/** One of the four: envelope, basket, and the four lines between them. */
function FarBalloonMesh({ balloon }: { balloon: FarBalloon }) {
  const group = useRef<THREE.Group>(null!);

  const envelope = useMemo(buildEnvelope, []);
  useEffect(() => () => envelope.dispose(), [envelope]);

  const skins = useMemo(() => [flatMat(balloon.a), flatMat(balloon.b)], [balloon.a, balloon.b]);

  const drop = balloon.radius * BASKET_DROP;
  const baseY = MIN_ALTITUDE + balloon.aboveFloor;

  const offset = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    // Untethered, so they drift as well as rise and fall — a long, slow circle
    // a couple of units wide, which at this range is barely a change of angle.
    // It is not meant to be watched; it is meant to keep them from reading as
    // painted on the sky.
    farBalloonDrift(state.clock.elapsedTime, balloon.phase, offset);
    group.current.position.set(balloon.x + offset.x, baseY + offset.y, balloon.z + offset.z);
  });

  return (
    <group ref={group} position={[balloon.x, baseY, balloon.z]}>
      <mesh geometry={envelope} material={skins} scale={balloon.radius} />
      {/* The lines are what tie the basket to the envelope at this size: without
          them the basket reads as a speck floating under a ball. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            material={flatMat(PALETTE.rope)}
            position={[sx * balloon.radius * 0.16, -drop * 0.55, sz * balloon.radius * 0.16]}
          >
            <boxGeometry args={[0.09, drop * 0.9, 0.09]} />
          </mesh>
        ))
      )}
      <mesh material={flatMat(PALETTE.basket)} position={[0, -drop, 0]}>
        <boxGeometry args={[balloon.radius * 0.26, balloon.radius * 0.22, balloon.radius * 0.26]} />
      </mesh>
      {/* The burner, standing off the top of the basket. There is no frame
          under it and no uprights beside it — at this range they are nothing —
          but the flame itself has to be here: past sunset the moon leaves four
          envelopes as four grey shapes, and it is the burners that say they are
          still flying. */}
      <group position={[0, -drop + balloon.radius * BURNER_RISE, 0]}>
        <BurnerFlame size={balloon.radius * FLAME} phase={balloon.phase} />
      </group>
    </group>
  );
}

/** The far cluster. Scenery only — nothing here is hoverable or reachable. */
export function DistantBalloons() {
  return (
    <>
      {FAR_BALLOONS.map((balloon, i) => (
        <FarBalloonMesh key={i} balloon={balloon} />
      ))}
    </>
  );
}
