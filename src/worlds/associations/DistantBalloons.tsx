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

interface FarBalloon {
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
 * Four balloons flying together beyond the northern ridges, around 290 units
 * out — well past FLIGHT_RADIUS, so they can be looked at and never reached.
 *
 * Clustered the way balloons actually fly: a group launched together, drifting
 * on one wind, spread over a few tens of units in plan and stacked over three
 * dozen in height, since a flight finds its own altitudes. The spread is set in
 * what it subtends rather than in units — at this range the four fill about
 * eight degrees, which reads as a cluster in one glance without any two of them
 * overlapping into a single blob.
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
const FAR_BALLOONS: FarBalloon[] = [
  { x: 12, z: -286, aboveFloor: 16, radius: 6.4, a: PALETTE.farBalloonRust, b: PALETTE.farBalloonCream, phase: 0 },
  { x: 38, z: -300, aboveFloor: 28, radius: 5.6, a: PALETTE.farBalloonSand, b: PALETTE.farBalloonCream, phase: 1.9 },
  { x: -14, z: -305, aboveFloor: 36, radius: 6.0, a: PALETTE.farBalloonSky, b: PALETTE.farBalloonCream, phase: 3.4 },
  { x: 26, z: -272, aboveFloor: 8, radius: 5.2, a: PALETTE.farBalloonMoss, b: PALETTE.farBalloonCream, phase: 5.1 },
];

/** How far and how slowly one drifts on its own wind. */
const DRIFT = 2.6;
const DRIFT_SPEED = 0.045;
const BOB = 0.9;
const BOB_SPEED = 0.13;

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

/** Where the basket hangs below the envelope's centre, as a fraction of radius. */
const BASKET_DROP = 1.62;

/**
 * The burner's flame, as a fraction of the radius it hangs under — and a long
 * way over life size.
 *
 * A real burner throws about a metre, which on a six-unit envelope is a tenth
 * of its own width and three hundred units out is well under a pixel: cut to
 * scale these four had no flame at all after dark, which is the one thing a
 * balloon at night is. So the flame is drawn at the size it has to be *seen*
 * at rather than the size it is — the same cheat the interests room's window
 * plays with its treelines, and it costs nothing here because this cluster
 * flies past FLIGHT_RADIUS and can never be come up on and caught at it.
 */
const FLAME = 0.44;

/** One of the four: envelope, basket, and the four lines between them. */
function FarBalloonMesh({ balloon }: { balloon: FarBalloon }) {
  const group = useRef<THREE.Group>(null!);

  const envelope = useMemo(buildEnvelope, []);
  useEffect(() => () => envelope.dispose(), [envelope]);

  const skins = useMemo(() => [flatMat(balloon.a), flatMat(balloon.b)], [balloon.a, balloon.b]);

  const drop = balloon.radius * BASKET_DROP;
  const baseY = MIN_ALTITUDE + balloon.aboveFloor;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Untethered, so they drift as well as rise and fall — a long, slow circle
    // a couple of units wide, which at this range is barely a change of angle.
    // It is not meant to be watched; it is meant to keep them from reading as
    // painted on the sky.
    group.current.position.set(
      balloon.x + Math.sin(t * DRIFT_SPEED + balloon.phase) * DRIFT,
      baseY + Math.sin(t * BOB_SPEED + balloon.phase) * BOB,
      balloon.z + Math.cos(t * DRIFT_SPEED * 0.8 + balloon.phase) * DRIFT
    );
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
      <group position={[0, -drop + balloon.radius * 0.16, 0]}>
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
