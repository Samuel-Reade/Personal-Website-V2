import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSharedGradient, setFlatShading } from "../../utils/toon";
import { WAVE_AMPLITUDE, WAVE_GLSL, waveHeight } from "../projects/waveField";
import { PALETTE as SEA } from "../projects/palette";
import { flatMaterial, PALETTE } from "./materials";
import { CONTACT } from "../../data/contacts";

/**
 * What the telescope shows by day: open water under a pale sky, and four things
 * in it that each reach me one way — an anchor in the shallows for GitHub, a
 * lighthouse on its rock for LinkedIn, a bottled message for Gmail, and a bell
 * buoy for the phone.
 *
 * The water is deliberately the archipelago's: the same wave field, the same
 * four stepped tones, the same shared toon ramp. This is the second place the
 * site reaches across worlds for a look (the archipelago itself borrows the
 * meadow's gradient), and for the same reason — the sea through the eyepiece
 * should read as *that* sea, not a third rendering of water.
 */

interface OceanProps {
  /** Reports the hovered object's caption, or null, up to the overlay chrome. */
  onHover: (caption: string | null) => void;
}

/** Where the sand shelf under the shallows sits. The anchor rests on it. */
const SAND_Y = -2.05;
/** Warm lift the objects take under the pointer. */
const HIGHLIGHT = "#ffd9a0";
const HOVER_RATE = 8;
const HOVER_SCALE = 1.09;

/**
 * One clickable thing in the water: an invisible hull carrying the events, a
 * scale lift and an emissive glow while hovered, and the link on click — the
 * same interaction language as the book, the islands and the shelf.
 */
function ContactObject({
  caption,
  href,
  hull,
  hullPosition = [0, 0, 0],
  position,
  glow,
  onHover,
  children,
}: {
  caption: string;
  href: string;
  hull: [number, number, number];
  hullPosition?: [number, number, number];
  position: [number, number, number];
  /** Materials whose emissive lifts under the pointer, from rest to hover. */
  glow: { material: THREE.MeshLambertMaterial; rest?: number; hover?: number }[];
  onHover: (caption: string | null) => void;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    const settle = 1 - Math.exp(-HOVER_RATE * delta);
    const scale = THREE.MathUtils.lerp(group.current.scale.x, hovered ? HOVER_SCALE : 1, settle);
    group.current.scale.setScalar(scale);
    for (const { material, rest = 0, hover = 0.9 } of glow) {
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        hovered ? hover : rest,
        settle
      );
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh
        position={hullPosition}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(caption);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          onHover(null);
          document.body.style.cursor = "default";
        }}
        onClick={(e) => {
          e.stopPropagation();
          // "#" is contacts.ts's "not wired yet" — a no-op beats a blank tab.
          if (href === "#") return;
          if (href.startsWith("http")) window.open(href, "_blank", "noopener,noreferrer");
          else window.location.href = href;
        }}
      >
        <boxGeometry args={hull} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {children}
    </group>
  );
}

/**
 * The archipelago's banded water, static and semi-transparent. Transparency is
 * the one departure, and it is what makes the shallows work: the near water has
 * a sand shelf and an anchor under it, and clear water you can see the bottom
 * through says "shallow" the way no opaque surface can. Out past the shelf the
 * bed drops to a dark underlay, so the same surface reads as deep again.
 */
function Water() {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(380, 230, 150, 90);
    // Both baked in, not set on the mesh, for the same reason the archipelago
    // bakes its rotation: the shader displaces in local coordinates, and the
    // floating objects sample the JS wave field in world coordinates. With the
    // geometry itself rotated and pushed out to sea, local *is* world, and the
    // two can never disagree.
    plane.rotateX(-Math.PI / 2);
    plane.translate(0, 0, -85);
    return plane;
  }, []);

  const material = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({
      color: "#ffffff",
      gradientMap: getSharedGradient(),
      transparent: true,
      opacity: 0.62,
    });
    setFlatShading(mat);

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uAmplitude = { value: WAVE_AMPLITUDE };
      shader.uniforms.uBandA = { value: new THREE.Color(SEA.waterDeep) };
      shader.uniforms.uBandB = { value: new THREE.Color(SEA.waterMid) };
      shader.uniforms.uBandC = { value: new THREE.Color(SEA.waterLight) };
      shader.uniforms.uBandD = { value: new THREE.Color(SEA.waterCrest) };

      shader.vertexShader = `uniform float uTime;\nvarying float vWaveHeight;\n${WAVE_GLSL}\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWaveHeight = waveHeight(transformed.xz, uTime);
        transformed.y += vWaveHeight;`
      );

      shader.fragmentShader =
        `uniform vec3 uBandA;\nuniform vec3 uBandB;\nuniform vec3 uBandC;\nuniform vec3 uBandD;\nuniform float uAmplitude;\nvarying float vWaveHeight;\n` +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float band = clamp((vWaveHeight / uAmplitude) * 0.5 + 0.5, 0.0, 0.999);
        band = floor(band * 4.0);
        vec3 seaColor = band < 1.0 ? uBandA : (band < 2.0 ? uBandB : (band < 3.0 ? uBandC : uBandD));
        diffuseColor.rgb *= seaColor;`
      );

      mat.userData.shader = shader;
    };
    mat.customProgramCacheKey = () => "eyepiece-water-toon";
    return mat;
  }, []);

  useFrame((state) => {
    const shader = material.userData.shader as
      | { uniforms: { uTime: { value: number } } }
      | undefined;
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <mesh geometry={geometry} material={material} />;
}

/** The bottom the water is seen against: sand up close, darkness further out. */
function Seabed() {
  const sandMaterial = useMemo(() => flatMaterial(SEA.sand), []);
  const rockMaterial = useMemo(() => flatMaterial(SEA.rockDark), []);
  // Unlit near-dark blue: this is depth, not a surface anyone should read.
  const deepMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#31485a" }), []);

  return (
    <group>
      <mesh material={sandMaterial} position={[0, SAND_Y, -3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[64, 36]} />
      </mesh>
      {/* A few stones so the shelf reads as seabed rather than a floor. */}
      {([
        [-5.4, 1.8, 0.5],
        [2.8, -2.4, 0.7],
        [-0.8, -6.5, 0.45],
      ] as const).map(([x, z, r], i) => (
        <mesh key={i} material={rockMaterial} position={[x, SAND_Y + r * 0.35, z]} rotation={[0, i * 1.3, 0]}>
          <icosahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
      <mesh material={deepMaterial} position={[0, -5.5, -100]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 260]} />
      </mesh>
    </group>
  );
}

/** Sky, haze, drifting clouds, and the far coastline the brief asked for. */
function SkyAndCoast() {
  const skyMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#a3c2d6" }), []);
  const hazeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#d3e2ea" }), []);
  const cloudMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#eef4f6" }), []);
  const coastMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#8ea6b6" }), []);
  const coastFarMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#9fb4c2" }), []);
  const clouds = useRef<THREE.Group>(null!);

  useFrame((state) => {
    // A drift of a few units over a minute: visible if watched, still if not.
    if (clouds.current) clouds.current.position.x = Math.sin(state.clock.elapsedTime * 0.012) * 6;
  });

  return (
    <group>
      <mesh material={skyMaterial} position={[0, 60, -178]}>
        <planeGeometry args={[520, 260]} />
      </mesh>
      {/* Pale band where sky meets water — haze is what says the sea keeps
          going rather than stopping at a wall. */}
      <mesh material={hazeMaterial} position={[0, 7, -177]}>
        <planeGeometry args={[520, 26]} />
      </mesh>

      {/* The coastline, hazed toward the sky's tones: a headland running off
          the left of the view, and a fainter ridge behind it. */}
      <mesh material={coastMaterial} position={[-70, 3, -168]} rotation={[0, 0.1, 0]} scale={[1, 1, 0.2]}>
        <coneGeometry args={[52, 14, 4]} />
      </mesh>
      <mesh material={coastMaterial} position={[-116, 2, -166]} scale={[1, 1, 0.2]}>
        <coneGeometry args={[40, 9, 4]} />
      </mesh>
      <mesh material={coastFarMaterial} position={[-38, 2, -172]} rotation={[0, -0.15, 0]} scale={[1, 1, 0.2]}>
        <coneGeometry args={[34, 7, 4]} />
      </mesh>

      <group ref={clouds}>
        {([
          [-40, 34, -150, 7],
          [22, 42, -158, 9],
          [66, 30, -146, 6],
        ] as const).map(([x, y, z, s], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh material={cloudMaterial} scale={[s, s * 0.34, s * 0.6]}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
            <mesh material={cloudMaterial} position={[s * 0.7, -s * 0.06, 0]} scale={[s * 0.6, s * 0.24, s * 0.5]}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** The anchor in the shallows, seen through the clear water. Links to GitHub. */
function Anchor({ onHover }: OceanProps) {
  const ironMaterial = useMemo(
    () => flatMaterial("#575249", { emissive: HIGHLIGHT, emissiveIntensity: 0 }),
    []
  );

  return (
    <ContactObject
      caption="Anchor — GitHub"
      href={CONTACT.github}
      hull={[2.4, 2.6, 1.6]}
      hullPosition={[0, 0.7, 0]}
      position={[-2.6, SAND_Y, 0.4]}
      glow={[{ material: ironMaterial }]}
      onHover={onHover}
    >
      {/* Leant against its own fluke the way a set anchor settles. */}
      <group rotation={[0.12, 0.5, -0.3]}>
        {/* Shank. */}
        <mesh material={ironMaterial} position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 1.5, 6]} />
        </mesh>
        {/* Ring at the head, and the stock across under it. */}
        <mesh material={ironMaterial} position={[0, 1.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.05, 4, 8]} />
        </mesh>
        <mesh material={ironMaterial} position={[0, 1.32, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 1.1, 5]} />
        </mesh>
        {/* Crown and arms: a half-torus opening upward. */}
        <mesh material={ironMaterial} position={[0, 0.18, 0]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.55, 0.07, 4, 10, Math.PI]} />
        </mesh>
        {/* Flukes at the arm tips. */}
        {([1, -1] as const).map((side) => (
          <mesh
            key={side}
            material={ironMaterial}
            position={[side * 0.58, 0.34, 0]}
            rotation={[0, 0, side * -0.5]}
          >
            <coneGeometry args={[0.16, 0.42, 4]} />
          </mesh>
        ))}
      </group>
    </ContactObject>
  );
}

/** The bottled message riding the swell. Links to Gmail. */
function Bottle({ onHover }: OceanProps) {
  const glassMaterial = useMemo(() => {
    const mat = flatMaterial("#79a98f", { emissive: HIGHLIGHT, emissiveIntensity: 0 });
    mat.transparent = true;
    mat.opacity = 0.72;
    return mat;
  }, []);
  const corkMaterial = useMemo(() => flatMaterial(SEA.sand), []);
  const paperMaterial = useMemo(() => flatMaterial("#f2ecd9"), []);
  const bob = useRef<THREE.Group>(null!);

  const X = -4.9;
  const Z = -7.5;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!bob.current) return;
    // Riding the same swell the shader draws, plus a slow roll of its own.
    bob.current.position.y = waveHeight(X, Z, t) * 0.85;
    bob.current.rotation.z = 1.42 + Math.sin(t * 0.7) * 0.1;
    bob.current.rotation.y = 0.5 + Math.sin(t * 0.23) * 0.3;
  });

  return (
    <ContactObject
      caption="Message in a bottle — Gmail"
      href={CONTACT.gmail}
      hull={[2.2, 2.0, 2.2]}
      position={[X, 0, Z]}
      glow={[{ material: glassMaterial }]}
      onHover={onHover}
    >
      {/* Lying on its side, nearly horizontal. */}
      <group ref={bob} rotation={[0, 0.5, 1.42]}>
        <mesh material={glassMaterial}>
          <cylinderGeometry args={[0.34, 0.38, 1.1, 7]} />
        </mesh>
        <mesh material={glassMaterial} position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.13, 0.24, 0.4, 7]} />
        </mesh>
        <mesh material={corkMaterial} position={[0, 0.98, 0]}>
          <cylinderGeometry args={[0.12, 0.11, 0.18, 6]} />
        </mesh>
        {/* The rolled letter, visible through the glass. */}
        <mesh material={paperMaterial}>
          <cylinderGeometry args={[0.14, 0.14, 0.85, 6]} />
        </mesh>
      </group>
    </ContactObject>
  );
}

/** The bell buoy, rocking with the water. Links to the phone. */
function BellBuoy({ onHover }: OceanProps) {
  const floatMaterial = useMemo(() => flatMaterial(SEA.flagRed), []);
  const frameMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);
  const bellMaterial = useMemo(
    () => flatMaterial(PALETTE.brass, { emissive: HIGHLIGHT, emissiveIntensity: 0 }),
    []
  );
  const rock = useRef<THREE.Group>(null!);
  const bell = useRef<THREE.Group>(null!);

  const X = 5.6;
  const Z = -11;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (rock.current) {
      rock.current.position.y = waveHeight(X, Z, t) * 0.9;
      rock.current.rotation.x = Math.sin(t * 0.6) * 0.06;
      rock.current.rotation.z = Math.cos(t * 0.47) * 0.08;
    }
    // The bell swings a beat behind the buoy that carries it.
    if (bell.current) bell.current.rotation.z = Math.sin(t * 0.6 + 0.9) * 0.16;
  });

  return (
    <ContactObject
      caption={`Ship's bell — ${CONTACT.phoneDisplay}`}
      href={CONTACT.phone}
      hull={[2.4, 3.6, 2.4]}
      hullPosition={[0, 1.2, 0]}
      position={[X, 0, Z]}
      glow={[{ material: bellMaterial }]}
      onHover={onHover}
    >
      <group ref={rock}>
        {/* The float: a faceted bicone with a deck. */}
        <mesh material={floatMaterial} position={[0, -0.35, 0]}>
          <coneGeometry args={[0.95, 0.9, 7]} />
        </mesh>
        <mesh material={floatMaterial} position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.8, 0.95, 0.5, 7]} />
        </mesh>
        <mesh material={frameMaterial} position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.72, 0.8, 0.08, 7]} />
        </mesh>
        {/* Three legs meeting at the head, the bell hung under it. */}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh
              key={i}
              material={frameMaterial}
              position={[Math.cos(a) * 0.34, 1.05, Math.sin(a) * 0.34]}
              rotation={[-Math.sin(a) * 0.32, 0, Math.cos(a) * 0.32]}
            >
              <cylinderGeometry args={[0.035, 0.045, 1.35, 5]} />
            </mesh>
          );
        })}
        <mesh material={frameMaterial} position={[0, 1.78, 0]}>
          <cylinderGeometry args={[0.14, 0.18, 0.12, 6]} />
        </mesh>
        <group ref={bell} position={[0, 1.68, 0]}>
          <mesh material={bellMaterial} position={[0, -0.16, 0]}>
            <cylinderGeometry args={[0.2, 0.3, 0.34, 7]} />
          </mesh>
          <mesh material={bellMaterial} position={[0, -0.36, 0]}>
            <cylinderGeometry args={[0.33, 0.35, 0.08, 7]} />
          </mesh>
          <mesh material={frameMaterial} position={[0, -0.48, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.14, 5]} />
          </mesh>
        </group>
      </group>
    </ContactObject>
  );
}

/** The lighthouse on its rock at the edge of the view. Links to LinkedIn. */
function Lighthouse({ onHover }: OceanProps) {
  const rockMaterial = useMemo(() => flatMaterial("#7d8fa0"), []);
  const towerMaterial = useMemo(() => flatMaterial("#e9e5da"), []);
  const bandMaterial = useMemo(() => flatMaterial("#b8776f"), []);
  const ironMaterial = useMemo(() => flatMaterial("#5a626e"), []);
  // The lamp rests lit — a lighthouse that only glowed when hovered would just
  // be a tower — and lifts brighter under the pointer.
  const lampMaterial = useMemo(
    () => flatMaterial("#ffe3a8", { emissive: "#ffe3a8", emissiveIntensity: 0.55 }),
    []
  );

  return (
    <ContactObject
      caption="Lighthouse — LinkedIn"
      href={CONTACT.linkedin}
      hull={[16, 30, 14]}
      hullPosition={[0, 8, 0]}
      position={[22, 0, -90]}
      glow={[{ material: lampMaterial, rest: 0.55, hover: 1.5 }]}
      onHover={onHover}
    >
      {/* The outcrop, broad enough at the waterline to hide the join. */}
      <mesh material={rockMaterial} position={[0, 0.6, 0]}>
        <coneGeometry args={[7.4, 10, 5]} />
      </mesh>
      <mesh material={rockMaterial} position={[3.6, -0.4, 2.4]} rotation={[0, 0.8, 0]}>
        <coneGeometry args={[3.2, 5, 4]} />
      </mesh>

      <group position={[0, 5.4, 0]}>
        <mesh material={towerMaterial} position={[0, 4, 0]}>
          <cylinderGeometry args={[1.35, 2.1, 8, 7]} />
        </mesh>
        {/* Two hazed-red bands. */}
        <mesh material={bandMaterial} position={[0, 2.4, 0]}>
          <cylinderGeometry args={[1.95, 2.02, 1.1, 7]} />
        </mesh>
        <mesh material={bandMaterial} position={[0, 5.6, 0]}>
          <cylinderGeometry args={[1.58, 1.66, 1.1, 7]} />
        </mesh>
        {/* Gallery, lamp room, and the light itself. */}
        <mesh material={ironMaterial} position={[0, 8.2, 0]}>
          <cylinderGeometry args={[1.9, 1.9, 0.3, 7]} />
        </mesh>
        <mesh material={lampMaterial} position={[0, 9, 0]}>
          <cylinderGeometry args={[1.05, 1.05, 1.4, 7]} />
        </mesh>
        <mesh material={ironMaterial} position={[0, 10.1, 0]}>
          <coneGeometry args={[1.35, 1.1, 7]} />
        </mesh>
      </group>
    </ContactObject>
  );
}

/** The full daytime scene behind the eyepiece. */
export function EyepieceOcean({ onHover }: OceanProps) {
  return (
    <group>
      {/* Bright, even, and shadowless: a calm noon at sea. */}
      <ambientLight intensity={0.85} color="#f4f7f8" />
      <directionalLight position={[30, 50, 10]} intensity={1.0} color="#fff4e2" />

      <SkyAndCoast />
      <Seabed />
      <Water />

      <Anchor onHover={onHover} />
      <Bottle onHover={onHover} />
      <BellBuoy onHover={onHover} />
      <Lighthouse onHover={onHover} />
    </group>
  );
}
