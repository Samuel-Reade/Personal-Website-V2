import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { createRimToonMaterial } from "../../utils/toon";
import { buildLogoGeometries } from "./logoGeometry";
import type { LogoLayer, LogoSpec } from "./logos";

/** Chip body, in world units. Flat enough to read as a badge rather than a box. */
const BODY = { width: 1.5, height: 1.5, depth: 0.22 };
const CORNER_RADIUS = 0.28;
const CORNER_SMOOTHNESS = 4;

/** Matches the meadow character's outline treatment. */
const OUTLINE_COLOR = "#2b2440";
const OUTLINE_THICKNESS = 0.024;
const OUTLINE_HOVER_COLOR = "#fff2c4";
const OUTLINE_HOVER_THICKNESS = 0.055;

/** Radius of the pale disc placed behind marks too dark to read unaided. */
const BACKING_RADIUS = 0.62;

/**
 * How much taller each successive layer of a multi-color mark is extruded than
 * the one beneath it, as a fraction of the extrusion depth. Layers share a base
 * on the chip face, so a layer that overlaps the one under it (Amplitude's wave
 * on its disc, the "learn" script on scikit-learn's blob) is a hair proud of it
 * rather than coplanar with it — coplanar top faces would z-fight into a
 * shimmer wherever two colors met.
 */
const LAYER_LIFT = 0.18;

const HOVER_SCALE = 1.22;
/** Exponential rate for the hover scale, so the pop eases rather than snaps. */
const HOVER_RATE = 11;

/**
 * Tumble rates, in radians per second.
 *
 * Slower than they were when the mark billboarded. A mark mounted on the body
 * turns with it, so the rate that read as lively on a puck whose face always
 * pointed at you is too fast to read a logo off — these are set so a face is
 * square to the camera for long enough to take in.
 */
const TUMBLE = { x: 0.19, y: 0.28, z: 0.16 };

interface ChipProps {
  logo: LogoSpec;
  /** Fixed position on its shell's ring — the shell group does the orbiting. */
  position: [number, number, number];
  /** Decorrelates this chip's tumble from its neighbours'. */
  seed: number;
  onHover: (label: string | null) => void;
}

/**
 * One orbiting tech chip: a toon-shaded rounded puck that tumbles, with its
 * brand mark struck into both faces. It is a thing to look at, not a control:
 * hovering names it (the world shows the label at the foot of the screen) and
 * that is all — the chip doesn't open anything.
 *
 * The mark is mounted on the body rather than billboarded to the camera, so a
 * chip is a physical two-sided badge: whichever face is turned toward you
 * carries the logo, and the mark rolls with the puck instead of sliding around
 * on it. The back copy is rotated a half-turn about Y rather than simply
 * mirrored, so it reads the right way round from behind instead of backwards.
 *
 * The mark is also the one thing in this world outside the toon pipeline. Brand
 * colors have to render true, and `MeshToonMaterial` quantises lighting into
 * three flat bands — which turns Python's yellow olive and React's cyan a muddy
 * teal depending on where the mark happens to be facing. `MeshBasicMaterial` is
 * unlit, so `#3776AB` on screen is `#3776AB`.
 */
export function Chip({ logo, position, seed, onHover }: ChipProps) {
  const [hovered, setHovered] = useState(false);

  const body = useRef<THREE.Group>(null!);
  const root = useRef<THREE.Group>(null!);
  const scale = useRef(1);

  // The mark for each face. Almost every chip strikes the same mark into both;
  // the HTML / CSS chip carries one on the front and the other on the back.
  const front = useMark(logo.layers);
  const back = useMark(logo.back ?? logo.layers);

  /**
   * The puck itself takes a dimmed, desaturated cast of its own brand color
   * rather than one shared neutral — it ties each chip to its mark without
   * competing with it, and a ring of identical grey pucks reads as far more
   * uniform than the stack actually is.
   */
  const bodyMaterial = useMemo(() => {
    const tint = new THREE.Color(logo.color);
    const hsl = { h: 0, s: 0, l: 0 };
    tint.getHSL(hsl);
    tint.setHSL(hsl.h, Math.min(hsl.s, 0.3), 0.24);
    return createRimToonMaterial(tint, { strength: 0.3 });
  }, [logo.color]);

  const backingMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#f2eefb", toneMapped: false }),
    []
  );

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;

    // Tumble: three incommensurate rates, so the puck never settles into an
    // obvious repeating loop the way a single-axis spin does.
    if (body.current) {
      body.current.rotation.x = elapsed * TUMBLE.x + seed;
      body.current.rotation.y = elapsed * TUMBLE.y + seed * 1.7;
      body.current.rotation.z = Math.sin(elapsed * TUMBLE.z + seed) * 0.35;
    }

    if (!root.current) return;

    // Hover pop, applied to the whole chip so the outline grows with it.
    const target = hovered ? HOVER_SCALE : 1;
    scale.current = THREE.MathUtils.lerp(
      scale.current,
      target,
      1 - Math.exp(-HOVER_RATE * delta)
    );
    root.current.scale.setScalar(scale.current);

    // A slow drift about the chip's own orbital position, so a ring at rest
    // still has life in it.
    root.current.position.set(
      position[0] + Math.sin(elapsed * 0.7 + seed) * 0.06,
      position[1] + Math.sin(elapsed * 0.53 + seed * 2.1) * 0.06,
      position[2]
    );
  });

  // Hover only. No click handler and no pointer cursor: a pointer cursor
  // promises a click does something, and here it doesn't.
  const interaction = {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(true);
      onHover(logo.label);
    },
    onPointerOut: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(false);
      onHover(null);
    },
  };

  return (
    <group ref={root} position={position}>
      <group ref={body}>
        <RoundedBox
          args={[BODY.width, BODY.height, BODY.depth]}
          radius={CORNER_RADIUS}
          smoothness={CORNER_SMOOTHNESS}
          material={bodyMaterial}
        >
          <Outlines
            color={hovered ? OUTLINE_HOVER_COLOR : OUTLINE_COLOR}
            thickness={hovered ? OUTLINE_HOVER_THICKNESS : OUTLINE_THICKNESS}
            angle={1}
          />
        </RoundedBox>

        {/* The mark, struck into both faces so the chip reads from either side.
            Each copy sits on its own face and extrudes outward from it; the
            back copy is turned a half-turn about Y rather than mirrored, which
            is what keeps it the right way round for a viewer behind the chip
            instead of reversed. */}
        {[1, -1].map((side) => {
          const mark = side === 1 ? front : back;
          return (
            <group
              key={side}
              position={[0, 0, (side * BODY.depth) / 2]}
              rotation={[0, side === 1 ? 0 : Math.PI, 0]}
            >
              {/* Very dark marks (GitHub, Three.js) are near-invisible against
                  the puck's own dark cast, so they get a pale disc to sit on. */}
              {logo.needsBacking && (
                <mesh material={backingMaterial} position={[0, 0, 0.002]}>
                  <circleGeometry args={[BACKING_RADIUS, 32]} />
                </mesh>
              )}
              {/* Every layer starts on the face and each is extruded a little
                  taller than the last, so the mark's colors stack front-to-back
                  without any two top faces sharing a plane. */}
              {mark.geometries.map((geometry, i) => (
                <mesh
                  key={i}
                  geometry={geometry}
                  material={mark.materials[i]}
                  position={[0, 0, 0.004]}
                  scale={[1, 1, 1 + i * LAYER_LIFT]}
                />
              ))}
            </group>
          );
        })}
      </group>

      {/* One invisible sphere carries every pointer event. Raycasting the mark
          itself would mean the gaps inside and between its glyphs are holes the
          cursor falls through, and raycasting the tumbling body would make the
          hit target flicker in size as it turns. Sized to the body's half
          diagonal so the whole chip is grabbable at any orientation. */}
      <mesh {...interaction} visible={false}>
        <sphereGeometry args={[1.12, 12, 10]} />
      </mesh>
    </group>
  );
}

/**
 * One geometry and one unlit material per layer of a mark. Single-color marks
 * are one layer; the multi-color ones (AWS, Amplitude, Hugging Face,
 * scikit-learn) are several, built together so they share one scale and centre
 * — see `logoGeometry.ts`. The geometries are cached across chips there; the
 * materials are this chip's own and go with it.
 */
function useMark(layers: LogoLayer[]) {
  const geometries = useMemo(() => buildLogoGeometries(layers), [layers]);
  const materials = useMemo(
    () => layers.map((layer) => new THREE.MeshBasicMaterial({ color: layer.color, toneMapped: false })),
    [layers]
  );
  useEffect(
    () => () => {
      for (const material of materials) material.dispose();
    },
    [materials]
  );
  return { geometries, materials };
}
