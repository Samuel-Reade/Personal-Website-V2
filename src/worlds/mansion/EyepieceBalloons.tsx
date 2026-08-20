import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { displaySize, getDisplayFont } from "../../three/displayFont";
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
 * The purple tag that stands beside a balloon while it is under the pointer.
 *
 * The site's own in-world label, unchanged: extruded display-face letters, pale
 * lilac under a violet emissive — the same treatment the portals and the book
 * carry (see `three/Portals.tsx`). Which is the point. A visitor has read that
 * shape as "this is the name of the thing you are pointing at" in every world
 * before this one, and the telescope should not invent a second vocabulary for
 * the same idea.
 *
 * Two things it does that a portal's label does not, both because this one is
 * seen down a fixed telescope rather than walked up to:
 *
 * It is sized off its distance from the camera rather than in world units, so
 * all four read at one size in the lens. The near balloon is under half the
 * range of the far one, and a tag cut to a fixed height would be twice as big
 * on one as the other — which says something about depth that the balloons
 * themselves already say better.
 *
 * And it turns to face the camera every frame. The four are spread wide enough
 * across the lens that the outer ones sit twenty-odd degrees off its axis, and
 * flat letters at that angle are read through their own foreshortening.
 */

/** Cap height of a tag's letters as a fraction of the frame at its own depth. */
const TAG_HEIGHT = 0.038;
/** How fast a tag fades in and out under the pointer. */
const TAG_FADE_RATE = 9;

function BalloonTag({ text, hovered, drop }: { text: string; hovered: boolean; drop: number }) {
  const group = useRef<THREE.Group>(null!);
  const world = useMemo(() => new THREE.Vector3(), []);

  // Cut at a cap height of one and scaled per frame, rather than rebuilt every
  // time the range changes — TextGeometry is expensive and the letters are the
  // same letters at any size.
  const geometry = useMemo(() => {
    const built = new TextGeometry(text, {
      font: getDisplayFont(),
      size: displaySize(1),
      depth: 0.35,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.035,
      bevelSegments: 2,
    });
    // TextGeometry lays glyphs out rightward from the origin, so without this
    // every tag would hang off to one side of its balloon.
    built.center();
    return built;
  }, [text]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  /**
   * The portals' violet, reached from the other side.
   *
   * Theirs is a near-white face under a violet emissive, which comes out as
   * glowing lilac because the hall they hang in is dark: almost nothing of the
   * pale albedo is lit, so the emissive is what you see. Under this scene's
   * noon — ambient and a sun, half again over full brightness — that same
   * material lights its face to white, the emissive lands on top of it, every
   * channel clips, and the tag reads as a pale smudge on a pale sky.
   *
   * So the face is dark here and the emissive carries the colour outright. It
   * arrives at the same violet by making green the channel that drops, which is
   * what separates it from a bright sky; and enough of the face survives to
   * shade the bevels, so the letters still read as cut rather than printed.
   */
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2c1b4d",
        emissive: new THREE.Color("#a855f7"),
        emissiveIntensity: 1,
        roughness: 0.35,
        metalness: 0,
        transparent: true,
        opacity: 0,
        // Or the letters would punch a hole in the sky they are fading into.
        depthWrite: false,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }, delta) => {
    const settle = 1 - Math.exp(-TAG_FADE_RATE * delta);
    material.opacity = THREE.MathUtils.lerp(material.opacity, hovered ? 1 : 0, settle);
    material.emissiveIntensity = THREE.MathUtils.lerp(
      material.emissiveIntensity,
      hovered ? 1.35 : 1,
      settle
    );

    // Off the tag's own world position, not the balloon's origin, so the two
    // ends of a long tag are sized by where the tag is rather than where the
    // envelope above it happens to be.
    group.current.getWorldPosition(world);
    const height = 2 * Math.tan((camera as THREE.PerspectiveCamera).fov * (Math.PI / 360));
    group.current.scale.setScalar(camera.position.distanceTo(world) * height * TAG_HEIGHT);
    group.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group} position={[0, drop, 0]}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

/**
 * One of the four. The drift lives on a group outside the contact object, so
 * the invisible hull that carries the pointer events travels with the balloon
 * — hovering has to keep working wherever the wind has put it.
 */
function ContactBalloon({
  balloon,
  contact,
  onHover,
}: {
  balloon: FarBalloon;
  contact: ReachTarget;
  onHover: (caption: string | null) => void;
}) {
  const drift = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

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

  useFrame((state) => {
    // The cluster's own wind, not a second one written here — see
    // `farBalloonDrift`. Through a lens at two hundred units this is a slow
    // wander of a few tenths of a degree, which is the whole job: it keeps four
    // balloons from reading as painted on the sky.
    farBalloonDrift(state.clock.elapsedTime, balloon.phase, drift.current.position);
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

        {/* Under the basket rather than over the crown. Over reads better —
            it is where every portal on the site carries its name — but the
            balloons stand high in a round lens with a heavy vignette, and a
            tag above the highest of them lands in the dark at the rim. Under
            the basket is clear sky or open water for all four. */}
        <BalloonTag text={contact.label} hovered={hovered} drop={-1.95 * r} />
      </ContactObject>
    </group>
  );
}

/** The four balloons in the lens. Each one reaches me a different way. */
export function EyepieceBalloons({ onHover }: { onHover: (caption: string | null) => void }) {
  return (
    <>
      {FAR_BALLOONS.map((balloon, i) => (
        <ContactBalloon
          key={CONTACTS[i].key}
          balloon={balloon}
          contact={CONTACTS[i]}
          onHover={onHover}
        />
      ))}
    </>
  );
}
