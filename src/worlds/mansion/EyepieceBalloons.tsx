import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PROFILE } from "../associations/envelope";
import { PALETTE as CLEARING } from "../associations/palette";
import { BurnerFlame } from "../associations/burner";
import { flatMaterial } from "./materials";
import { CONTACT } from "../../data/contacts";
import { ContactObject, HIGHLIGHT } from "./EyepieceContact";

/**
 * What the telescope picks out by day: four hot air balloons standing off the
 * cliff over open water, one for each way of reaching me.
 *
 * They are the associations clearing's far cluster, seen from the other end of
 * the site. That world flies four balloons out past its flight radius — close
 * enough to be looked at, never close enough to be reached — and this is what
 * happens when you finally get a lens on them: the same profile, the same four
 * colours, and now near enough to point at. The shape comes from that world's
 * `envelope.ts` and the colours from its palette, so the two can never drift
 * apart; only the distance changes.
 *
 * Colour is the whole of how one is told from another — no emblems, no labels
 * — which is why each envelope owns a hue outright and they share only the
 * cream banding between the gores.
 */

interface Contact {
  key: string;
  caption: string;
  href: string;
  /** Envelope colours, alternating gore by gore. */
  a: string;
  b: string;
  /** Where it flies, and how big it is there. */
  position: [number, number, number];
  radius: number;
  /** Decorrelates its drift from the others'. */
  phase: number;
}

/**
 * The four, laid out for the lens rather than for the sea.
 *
 * The eyepiece is a circle with a heavy vignette, so the useful frame is the
 * middle two thirds of it: every balloon sits inside that, none overlaps
 * another even at the ends of its drift, and none is left in a corner the
 * vignette eats. They stand at four depths between forty-five and a hundred and
 * ten units — one real size at four distances, which is what makes the water
 * between them read as deep rather than as a backdrop the four are pinned to.
 *
 * They also all fly clear of the horizon by a basket's height or more. A free
 * balloon whose basket grazes the waterline does not read as far away, it reads
 * as aground, and two of them did before the cluster was lifted.
 */
const BALLOONS: Contact[] = [
  {
    key: "github",
    caption: "Terracotta balloon — GitHub",
    href: CONTACT.github,
    a: CLEARING.farBalloonRust,
    b: CLEARING.farBalloonCream,
    position: [-9.3, 13.5, -44.4],
    radius: 4.5,
    phase: 0,
  },
  {
    key: "linkedin",
    caption: "Gold balloon — LinkedIn",
    href: CONTACT.linkedin,
    a: CLEARING.farBalloonSand,
    b: CLEARING.farBalloonCream,
    position: [4.1, 25.4, -63.7],
    radius: 4.5,
    phase: 1.9,
  },
  {
    key: "gmail",
    caption: "Blue balloon — Gmail",
    href: CONTACT.gmail,
    a: CLEARING.farBalloonSky,
    b: CLEARING.farBalloonCream,
    position: [21.9, 17.1, -84.3],
    radius: 4.5,
    phase: 3.4,
  },
  {
    key: "phone",
    caption: `Green balloon — ${CONTACT.phoneDisplay}`,
    href: CONTACT.phone,
    a: CLEARING.farBalloonMoss,
    b: CLEARING.farBalloonCream,
    position: [1.1, 15.6, -110.4],
    radius: 4.5,
    phase: 5.1,
  },
];

/** Panels around the envelope, and columns across each — the near balloons' own. */
const GORES = 14;
const COLUMNS = 3;

/** Where the basket hangs below the envelope's centre, as a fraction of radius. */
const BASKET_DROP = 1.62;

/**
 * How far a balloon wanders from its stated place, and how slowly.
 *
 * Small on purpose. Four untethered balloons that each swing a few units are
 * alive; four that swing far enough to trade places break the layout the frame
 * was composed for, and at the near end of the cluster a unit of drift is
 * already a visible slide across the lens.
 */
const DRIFT = 1.4;
const DRIFT_SPEED = 0.055;
const BOB = 0.55;
const BOB_SPEED = 0.15;

/**
 * The envelope at unit radius, built once and shared by all four.
 *
 * Every gore carries its own vertices, which is what keeps each panel a single
 * flat tone under flat shading, and the gores are dealt alternately into two
 * material groups — so a two-tone envelope is two draws, and the pair of
 * materials is exactly what the hover glow has to reach.
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
 * Suspension lines, in the same unit space: one from each corner of the basket
 * up to just inside the rim of the envelope's mouth, fanning out as they climb
 * because the mouth is wider than the basket. Measured end to end from the two
 * things they join, so they cannot come apart if the profile is ever retuned.
 */
function buildLines() {
  const [mouthY, mouthWidth] = PROFILE[PROFILE.length - 1];
  const rim = mouthWidth * 0.9;
  const up = new THREE.Vector3(0, 1, 0);
  return [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => {
      const from = new THREE.Vector3(sx * 0.105, -BASKET_DROP + 0.086, sz * 0.088);
      const to = new THREE.Vector3(sx * rim * Math.SQRT1_2, mouthY, sz * rim * Math.SQRT1_2);
      const run = to.clone().sub(from);
      return {
        position: from.clone().add(to).multiplyScalar(0.5),
        quaternion: new THREE.Quaternion().setFromUnitVectors(up, run.clone().normalize()),
        length: run.length(),
      };
    })
  );
}

/**
 * How far the envelope's emissive lifts under the pointer.
 *
 * A quarter of what the things in the water used to take, and the difference is
 * the size of the lit area: an anchor or a bell is a small dark object, where a
 * hard warm lift reads as a highlight. Twenty-odd square metres of pale fabric
 * at the same intensity goes to flat white and the balloon loses the one thing
 * that says which of the four it is. This is a lift, not a lamp — the hue has
 * to survive it.
 */
const SKIN_GLOW = 0.12;

/** Load tapes: the horizontal bands that carry an envelope's weight down. */
const TAPES = [
  { y: 0.32, w: 0.995 },
  { y: -0.16, w: 0.9 },
];

/**
 * One of the four. The drift lives on a group outside the contact object, so
 * the invisible hull that carries the pointer events travels with the balloon
 * — hovering has to keep working wherever the wind has put it.
 */
function ContactBalloon({
  balloon,
  onHover,
}: {
  balloon: Contact;
  onHover: (caption: string | null) => void;
}) {
  const drift = useRef<THREE.Group>(null!);

  const envelope = useMemo(buildEnvelope, []);
  const lines = useMemo(buildLines, []);
  useEffect(() => () => envelope.dispose(), [envelope]);

  /**
   * Per balloon rather than per colour: the two skins are what the hover lifts,
   * and a shared material would light all four at once.
   */
  const materials = useMemo(() => {
    const skins = [balloon.a, balloon.b].map((color) =>
      flatMaterial(color, { emissive: HIGHLIGHT, emissiveIntensity: 0 })
    );
    return {
      skins,
      tape: flatMaterial(CLEARING.tape),
      vent: flatMaterial(CLEARING.vent),
      rope: flatMaterial(CLEARING.rope),
      basket: flatMaterial(CLEARING.basket),
      basketDark: flatMaterial(CLEARING.basketDark),
      burner: flatMaterial(CLEARING.burner),
    };
  }, [balloon.a, balloon.b]);

  useEffect(
    () => () => {
      materials.skins.forEach((m) => m.dispose());
      for (const key of ["tape", "vent", "rope", "basket", "basketDark", "burner"] as const) {
        materials[key].dispose();
      }
    },
    [materials]
  );

  const [x, y, z] = balloon.position;
  const r = balloon.radius;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // A long, slow circle on its own wind, plus a rise and fall: a free balloon
    // is never still, and four that were would read as painted on the sky.
    drift.current.position.set(
      Math.sin(t * DRIFT_SPEED + balloon.phase) * DRIFT,
      Math.sin(t * BOB_SPEED + balloon.phase) * BOB,
      Math.cos(t * DRIFT_SPEED * 0.8 + balloon.phase) * DRIFT
    );
  });

  return (
    <group ref={drift}>
      <ContactObject
        caption={balloon.caption}
        href={balloon.href}
        // Generous on purpose: a balloon is mostly air, and a hull cut to the
        // envelope alone would drop the pointer between the basket and the
        // skirt on the way to it.
        hull={[r * 2.2, r * 2.85, r * 2.2]}
        hullPosition={[0, -r * 0.345, 0]}
        position={[x, y, z]}
        glow={materials.skins.map((material) => ({ material, hover: SKIN_GLOW }))}
        onHover={onHover}
      >
        {/* Everything below is in unit space, scaled here — so the profile, the
            lines and the basket are stated once and hold at any size. */}
        <group scale={r}>
          <mesh geometry={envelope} material={materials.skins} />

          {TAPES.map((tape) => (
            <mesh
              key={tape.y}
              material={materials.tape}
              position={[0, tape.y, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[tape.w, 0.022, 4, GORES]} />
            </mesh>
          ))}
          {/* Crown ring, and the parachute vent capping the apex. */}
          <mesh material={materials.tape} position={[0, 0.93, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.03, 4, 10]} />
          </mesh>
          <mesh material={materials.vent} position={[0, 1.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.17, 10]} />
          </mesh>

          {lines.map((line, i) => (
            <mesh
              key={i}
              material={materials.rope}
              position={line.position}
              quaternion={line.quaternion}
            >
              <cylinderGeometry args={[0.009, 0.009, line.length, 4]} />
            </mesh>
          ))}

          {/* Burner frame. The flame itself hangs off this group in world
              units — see below. */}
          <mesh material={materials.burner} position={[0, -BASKET_DROP + 0.148, 0]}>
            <boxGeometry args={[0.071, 0.071, 0.071]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh
              key={`upright${sx}`}
              material={materials.burner}
              position={[sx * 0.071, -BASKET_DROP + 0.119, 0]}
            >
              <boxGeometry args={[0.011, 0.1, 0.011]} />
            </mesh>
          ))}

          {/* Basket: squared, as a real one is, with a padded rim and corner
              posts. A plain barrel says "there is something under there" and
              nothing else. */}
          <mesh material={materials.basket} position={[0, -BASKET_DROP, 0]}>
            <boxGeometry args={[0.205, 0.148, 0.171]} />
          </mesh>
          <mesh material={materials.basketDark} position={[0, -BASKET_DROP + 0.079, 0]}>
            <boxGeometry args={[0.219, 0.021, 0.186]} />
          </mesh>
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`post${sx}${sz}`}
                material={materials.basketDark}
                position={[sx * 0.105, -BASKET_DROP + 0.005, sz * 0.088]}
              >
                <boxGeometry args={[0.017, 0.157, 0.017]} />
              </mesh>
            ))
          )}
        </group>

        {/* The site's one burner, from the clearing that flies these four.
            Outside the unit-space group on purpose: a flame is about a world
            unit tall wherever it hangs, which is what that module's default
            size means, so it is mounted at the burner's height in world units
            rather than scaled with the envelope. */}
        <group position={[0, (-BASKET_DROP + 0.19) * r, 0]}>
          <BurnerFlame phase={balloon.phase} />
        </group>
      </ContactObject>
    </group>
  );
}

/** The four balloons in the lens. Each one reaches me a different way. */
export function EyepieceBalloons({ onHover }: { onHover: (caption: string | null) => void }) {
  return (
    <>
      {BALLOONS.map((balloon) => (
        <ContactBalloon key={balloon.key} balloon={balloon} onHover={onHover} />
      ))}
    </>
  );
}
