import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PROFILE } from "../associations/envelope";
import { FAR_BALLOONS, farBalloonDrift, type FarBalloon } from "../associations/DistantBalloons";
import { MIN_ALTITUDE } from "../associations/layout";
import { PALETTE as CLEARING } from "../associations/palette";
import { BurnerFlame } from "../associations/burner";
import { flatMaterial } from "./materials";
import { REACH_TARGETS, type ReachKey, type ReachTarget } from "./reach";
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

/**
 * Which balloon in the cluster carries which destination.
 *
 * This is the whole of what the day view gets to decide for itself. The words
 * — the tag, the caption line, the spoken label, the URL — come from
 * `reach.ts`, which the night sky reads too, so hovering GitHub says
 * "github.com/Samuel-Reade" whether the clock has put balloons or planets in
 * the lens.
 *
 * The captions used to be written here and named the upholstery: "Terracotta
 * balloon — GitHub", where the night view gave the address. Two names for one
 * destination twelve hours apart, and the visitor left to work out they were
 * the same door. The colour is still how one balloon is told from another —
 * that has not changed and is why this order is written in the palette's
 * order, terracotta, gold, blue, green — but the colour is a thing you can
 * already see. The caption is for the thing you cannot.
 *
 * Nothing here says where a balloon is, how big it is, or what colour — that
 * is `FAR_BALLOONS`, and this is the only file that asks it for anything. The
 * telescope does not get its own four balloons parked at flattering angles; it
 * gets the four that world already flies, and if that world moves them the
 * lens finds them moved.
 */
const CONTACTS: (ReachTarget & { key: ReachKey })[] = (
  ["github", "linkedin", "email", "phone"] as ReachKey[]
).map((key) => ({ key, ...REACH_TARGETS[key] }));

if (CONTACTS.length !== FAR_BALLOONS.length) {
  // Loud on purpose. A fifth balloon added to the cluster with no contact
  // behind it is a thing in the lens that lights up and goes nowhere.
  throw new Error(
    `The far cluster flies ${FAR_BALLOONS.length} balloons and ${CONTACTS.length} contacts are wired to them.`
  );
}

/** Panels around the envelope, and columns across each — the near balloons' own. */
const GORES = 14;
const COLUMNS = 3;

/** Where the basket hangs below the envelope's centre, as a fraction of radius. */
const BASKET_DROP = 1.62;

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
 * The tag that names a balloon while it is under the pointer.
 *
 * The same pill the night sky puts beside a planet: the same markup, the same
 * rule in `styles.css`, the same word out of `reach.ts`. It is a DOM element
 * parked over the lens rather than anything in the scene, and the balloon
 * steers it from the frame loop by projecting itself into the eyepiece —
 * exactly how `EyepieceSpace` steers its four anchors.
 *
 * It was an extruded violet tag cut in the display face, the site's in-world
 * label, the one the portals and the book carry. The reasoning was that a
 * visitor has read that shape as "this is the name of the thing you are
 * pointing at" in every world before this one. True, and not true of this one:
 * the telescope is not a world, it is one instrument showing two scenes, and
 * the other scene had already answered the same question with a pill. Hovering
 * a destination is now the same gesture with the same answer in the same
 * typeface whichever way the clock has gone — which is what `reach.ts` set out
 * to do for the words and stopped short of doing for the shape.
 *
 * The old tag hung under the basket, and that goes with it. It hung there
 * because the balloons stand high in a round lens with a heavy vignette and a
 * tag over the highest of them landed in the dark at the rim. The pill's own
 * rule — always on the side facing the middle of the lens — keeps it clear of
 * the rim from every direction rather than only from above.
 */

/** One per balloon, owned by the overlay chrome and steered from the scene. */
export type BalloonTagElements = Partial<Record<ReachKey, HTMLSpanElement | null>>;

/** The gap the night pills keep off a planet, kept off an envelope here. */
const TAG_PAD_PX = 8;
/** Floor on the wrapper, so the pill never crowds a balloon that reads small. */
const TAG_MIN_PX = 44;

/**
 * One of the four. The drift lives on a group outside the contact object, so
 * the invisible hull that carries the pointer events travels with the balloon
 * — hovering has to keep working wherever the wind has put it.
 */
function ContactBalloon({
  balloon,
  contact,
  tagEls,
  onHover,
}: {
  balloon: FarBalloon;
  contact: ReachTarget & { key: ReachKey };
  tagEls: React.MutableRefObject<BalloonTagElements>;
  onHover: (caption: string | null) => void;
}) {
  const drift = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

  /** Scratch for the projection: the balloon's centre, and a point one radius up. */
  const centre = useMemo(() => new THREE.Vector3(), []);
  const edge = useMemo(() => new THREE.Vector3(), []);
  const lastHot = useRef<boolean | null>(null);

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

  const x = balloon.x;
  const y = MIN_ALTITUDE + balloon.aboveFloor;
  const z = balloon.z;
  const r = balloon.radius;

  useFrame(({ camera, clock, size }) => {
    // The cluster's own wind, not a second one written here — see
    // `farBalloonDrift`. Through a lens at two hundred units this is a slow
    // wander of a few tenths of a degree, which is the whole job: it keeps four
    // balloons from reading as painted on the sky.
    farBalloonDrift(clock.elapsedTime, balloon.phase, drift.current.position);

    const el = tagEls.current[contact.key];
    if (!el) return;

    // Park the wrapper over the balloon, sized to the balloon. The radius is
    // measured rather than divided out of the field: project a second point one
    // radius above the centre and take the gap. A balloon twenty degrees off
    // the lens axis is further from the camera than it is deep into the scene,
    // and dividing by depth would size the outer two a little small.
    centre.set(balloon.x, y, balloon.z).add(drift.current.position).project(camera);
    edge.set(balloon.x, y + r, balloon.z).add(drift.current.position).project(camera);
    const px = (centre.x * 0.5 + 0.5) * size.width;
    const py = (-centre.y * 0.5 + 0.5) * size.height;
    const radius = Math.abs(py - (-edge.y * 0.5 + 0.5) * size.height);
    const diameter = Math.max(TAG_MIN_PX, radius * 2 + TAG_PAD_PX);

    el.style.width = `${diameter}px`;
    el.style.height = `${diameter}px`;
    el.style.transform = `translate(-50%, -50%) translate(${px}px, ${py}px)`;
    el.style.visibility = "visible";
    // Toward the middle of the lens, which is the night view's rule and the
    // only side the vignette cannot eat.
    el.dataset.labelSide = px < size.width / 2 ? "right" : "left";

    // Guarded because this runs every frame and the fade is a CSS transition:
    // rewriting the attribute at 60Hz would restart it.
    if (lastHot.current !== hovered) {
      lastHot.current = hovered;
      el.dataset.hot = hovered ? "true" : "false";
    }
  });

  return (
    <group ref={drift}>
      <ContactObject
        caption={contact.caption}
        href={contact.href}
        // Generous on purpose: a balloon is mostly air, and a hull cut to the
        // envelope alone would drop the pointer between the basket and the
        // skirt on the way to it.
        hull={[r * 2.2, r * 2.85, r * 2.2]}
        hullPosition={[0, -r * 0.345, 0]}
        position={[x, y, z]}
        glow={materials.skins.map((material) => ({ material, hover: SKIN_GLOW }))}
        onHover={onHover}
        onHoverChange={setHovered}
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
export function EyepieceBalloons({
  tagEls,
  onHover,
}: {
  tagEls: React.MutableRefObject<BalloonTagElements>;
  onHover: (caption: string | null) => void;
}) {
  return (
    <>
      {FAR_BALLOONS.map((balloon, i) => (
        <ContactBalloon
          key={CONTACTS[i].key}
          balloon={balloon}
          contact={CONTACTS[i]}
          tagEls={tagEls}
          onHover={onHover}
        />
      ))}
    </>
  );
}

/**
 * The four tags, over the lens rather than in it. The scene positions them;
 * this component owns everything about them that is markup — which is the
 * split `EyepieceSpaceContacts` already keeps for the night sky.
 *
 * Hidden from assistive tech: the pill is a visual echo of where the pointer
 * is, and there is no pointer to echo without a mouse. What a screen reader
 * gets in this view is the caption line under the lens, the same as any other
 * visitor.
 */
export function EyepieceBalloonTags({
  tagEls,
}: {
  tagEls: React.MutableRefObject<BalloonTagElements>;
}) {
  return (
    <>
      {CONTACTS.map((contact) => (
        <span
          key={contact.key}
          ref={(el) => (tagEls.current[contact.key] = el)}
          className="eyepiece-tag"
          aria-hidden="true"
        >
          <span className="eyepiece-body-label">{contact.label}</span>
        </span>
      ))}
    </>
  );
}
