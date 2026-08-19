import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { displaySize, getDisplayFont } from "../../three/displayFont";
import { getMoonState } from "../../utils/time";
import { Starfield } from "../techstack/Starfield";
import { MainPlanet } from "../techstack/Planets";
import { SHELLS } from "../techstack/layout";
import { CONTACT } from "../../data/contacts";
import { flatMaterial } from "./materials";
import { ContactObject } from "./EyepieceOcean";

/**
 * What the telescope shows by night: the tech-stack world's planet, hanging far
 * off among the stars with its four chip shells still turning around it — the
 * same system the Tech Stack portal drops you into, seen from the balcony the
 * way a real scope sees a real planet: small, patient, and busy.
 *
 * Four chips have drifted near enough to read, and those four are the ways to
 * reach me — the night shift of the day view's anchor, lighthouse, bottle and
 * bell. Same `ContactObject` behaviour, same captions rhythm, same links.
 */

interface SpaceProps {
  /** Reports the hovered chip's caption, or null, up to the overlay chrome. */
  onHover: (caption: string | null) => void;
}

/** Where the planet hangs, chosen to sit left-of-centre in the eyepiece circle. */
const PLANET_POS = new THREE.Vector3(-55, 160, -330);

/** The view axis the eyepiece camera looks along — chip placement hangs off it. */
const VIEW_DIR = new THREE.Vector3(30, 130, -300).normalize();
const VIEW_RIGHT = new THREE.Vector3().crossVectors(VIEW_DIR, new THREE.Vector3(0, 1, 0)).normalize();
const VIEW_UP = new THREE.Vector3().crossVectors(VIEW_RIGHT, VIEW_DIR).normalize();

/** A chip's place in the view: right/up offsets across the axis, and depth along it. */
function anchor(rx: number, ry: number, distance: number): THREE.Vector3 {
  return new THREE.Vector3()
    .addScaledVector(VIEW_DIR, distance)
    .addScaledVector(VIEW_RIGHT, rx)
    .addScaledVector(VIEW_UP, ry);
}

const CHIPS: {
  word: string;
  caption: string;
  href: string;
  plate: string;
  anchor: THREE.Vector3;
  /** Decorrelates each chip's drift. */
  phase: number;
}[] = [
  {
    word: "Email",
    caption: "sam5.reade@gmail.com",
    href: CONTACT.gmail,
    plate: "#c98f83",
    anchor: anchor(-20, 12, 68),
    phase: 0,
  },
  {
    word: "Phone",
    caption: CONTACT.phoneDisplay,
    href: CONTACT.phone,
    plate: "#7ea98b",
    anchor: anchor(17, 15, 74),
    phase: 1.7,
  },
  {
    word: "GitHub",
    caption: "github.com/Samuel-Reade",
    href: CONTACT.github,
    plate: "#9b9bb9",
    anchor: anchor(-13, -11, 74),
    phase: 3.1,
  },
  {
    word: "LinkedIn",
    caption: "linkedin.com/in/samuelreade",
    href: CONTACT.linkedin,
    plate: "#7fa3cc",
    anchor: anchor(21, -7, 66),
    phase: 4.6,
  },
];

/** Cap height of the word on each chip, in world units — see `displaySize`. */
const WORD_CAP_HEIGHT = 2.1;

function roundedPlate(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const w = width / 2;
  const h = height / 2;
  shape.moveTo(-w + radius, -h);
  shape.lineTo(w - radius, -h);
  shape.quadraticCurveTo(w, -h, w, -h + radius);
  shape.lineTo(w, h - radius);
  shape.quadraticCurveTo(w, h, w - radius, h);
  shape.lineTo(-w + radius, h);
  shape.quadraticCurveTo(-w, h, -w, h - radius);
  shape.lineTo(-w, -h + radius);
  shape.quadraticCurveTo(-w, -h, -w + radius, -h);
  return shape;
}

/** One readable chip: a rounded plate carrying its word, drifting on its anchor. */
function ContactChip({
  word,
  caption,
  href,
  plate,
  anchor,
  phase,
  onHover,
}: (typeof CHIPS)[number] & SpaceProps) {
  const drift = useRef<THREE.Group>(null!);

  const { wordGeometry, plateGeometry, hull } = useMemo(() => {
    const text = new TextGeometry(word, {
      font: getDisplayFont(),
      size: displaySize(WORD_CAP_HEIGHT),
      depth: 0.55,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    text.center();
    text.computeBoundingBox();
    const box = text.boundingBox!;
    const width = box.max.x - box.min.x + 2.6;
    const height = WORD_CAP_HEIGHT + 2.4;
    const plateShape = roundedPlate(width, height, 1.1);
    const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
      depth: 0.6,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 2,
    });
    return {
      wordGeometry: text,
      plateGeometry: plateGeo,
      hull: [width + 1.6, height + 1.6, 2.4] as [number, number, number],
    };
  }, [word]);

  const plateMaterial = useMemo(
    () => flatMaterial(plate, { emissive: plate, emissiveIntensity: 0.14 }),
    [plate]
  );
  const wordMaterial = useMemo(
    () => flatMaterial("#f4e8ff", { emissive: "#a855f7", emissiveIntensity: 0.4 }),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.22 + phase;
    // A slow ellipse around the anchor — enough drift to say "in orbit"
    // without ever carrying the chip out of the eyepiece's circle.
    drift.current.position
      .copy(anchor)
      .addScaledVector(VIEW_RIGHT, Math.cos(t) * 2.4)
      .addScaledVector(VIEW_UP, Math.sin(t) * 1.7);
    // Faces the scope, which for extruded text is what keeps it reading
    // forward rather than mirrored.
    drift.current.lookAt(0, 0, 0);
  });

  return (
    <group ref={drift}>
      <ContactObject
        caption={caption}
        href={href}
        hull={hull}
        position={[0, 0, 0]}
        glow={[
          { material: wordMaterial, rest: 0.4, hover: 1.3 },
          { material: plateMaterial, rest: 0.14, hover: 0.5 },
        ]}
        onHover={onHover}
      >
        <mesh geometry={plateGeometry} material={plateMaterial} position={[0, 0, -0.6]} />
        <mesh geometry={wordGeometry} material={wordMaterial} position={[0, 0, 0.35]} />
      </ContactObject>
    </group>
  );
}

/**
 * The planet's four shells, miniaturised to dots. Real radii, tilts, speeds and
 * chip counts from the tech-stack layout — this is that system, not a print of
 * one — but each chip is a half-unit fleck: at three hundred units the swarm is
 * meant to be barely made out, which is what sells the four readable chips in
 * the foreground as the ones that happen to have drifted close.
 */
function MiniatureShells() {
  const spins = useRef<(THREE.Group | null)[]>([]);
  const fleck = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#9aa2c8", toneMapped: false }),
    []
  );

  useFrame((state) => {
    SHELLS.forEach((shell, i) => {
      const spin = spins.current[i];
      if (spin) spin.rotation.y = shell.phase + state.clock.elapsedTime * shell.speed;
    });
  });

  return (
    <>
      {SHELLS.map((shell, i) => (
        <group key={shell.label} rotation={[0, shell.node, 0]}>
          <group rotation={[shell.inclination, 0, 0]}>
            <group ref={(g) => (spins.current[i] = g)}>
              {shell.chips.map((_, j) => {
                const bearing = (j / shell.chips.length) * Math.PI * 2;
                return (
                  <mesh
                    key={j}
                    material={fleck}
                    position={[
                      Math.cos(bearing) * shell.radius,
                      0,
                      Math.sin(bearing) * shell.radius,
                    ]}
                  >
                    <boxGeometry args={[0.7, 0.5, 0.24]} />
                  </mesh>
                );
              })}
            </group>
          </group>
        </group>
      ))}
    </>
  );
}

export function EyepieceSpace({ onHover }: SpaceProps) {
  const stars = useRef<THREE.Group>(null!);
  // Sampled on mount: the moon will not move visibly in one sitting.
  const moonY = useRef(Math.max(50, Math.sin(getMoonState().elevation) * 300)).current;

  useFrame((_, delta) => {
    if (stars.current) stars.current.rotation.y += delta * 0.006;
  });

  return (
    <group>
      {/* The planet and the chips are toon and Lambert surfaces — unlike the
          old bare starfield, this sky has things in it that need lighting. */}
      <ambientLight intensity={0.5} color="#c8d2ee" />
      <directionalLight position={[120, 260, -60]} intensity={1.0} color="#eef2ff" />

      <group ref={stars}>
        <Starfield />
      </group>

      {/* The moon: a flat disc and a halo, both unlit, both facing the scope. */}
      <group position={[70, moonY, -260]} onUpdate={(g) => g.lookAt(0, 0, 0)}>
        <mesh>
          <circleGeometry args={[13, 20]} />
          <meshBasicMaterial color="#e6ebf2" />
        </mesh>
        <mesh position={[0, 0, -1]}>
          <circleGeometry args={[19, 20]} />
          <meshBasicMaterial color="#aabcd8" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      </group>

      <group position={PLANET_POS}>
        <MainPlanet />
        <MiniatureShells />
      </group>

      {CHIPS.map((chip) => (
        <ContactChip key={chip.word} {...chip} onHover={onHover} />
      ))}
    </group>
  );
}
