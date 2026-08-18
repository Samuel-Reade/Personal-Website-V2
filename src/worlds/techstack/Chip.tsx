import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { createRimToonMaterial } from "../../utils/toon";
import { getGlowTexture } from "./glowTexture";
import { buildLogoGeometries } from "./logoGeometry";
import type { LogoLayer, LogoSpec } from "./logos";
import type { ChipProximity } from "./proximity";

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
 * rather than coplanar with it.
 */
const LAYER_LIFT = 0.18;

/**
 * Where the mark's stack starts above the puck face, and where the pale
 * backing disc sits under it, in world units.
 */
const BACKING_HEIGHT = 0.004;
const MARK_HEIGHT = 0.008;

/**
 * Depth-buffer offset per stacked surface, in resolvable depth units and slope
 * factor. The physical lifts above are a few thousandths of a unit, and with
 * the camera's near plane at 0.1 the depth buffer can't tell surfaces that
 * close apart once a chip is thirty-odd units off — the pale disc against the
 * puck face, or a white numeral on its shield, would resolve to whichever
 * fragment came last and shimmer as the chip turned. Polygon offset settles it
 * in depth-buffer terms instead of world ones: each surface up the stack is
 * pushed a step nearer than the one it sits on, at any distance, so the top
 * layer is always the one that wins.
 */
const STACK_OFFSET = 1;

const HOVER_SCALE = 1.22;
/** Exponential rate for the hover scale, so the pop eases rather than snaps. */
const HOVER_RATE = 11;

/**
 * The halo behind a lit chip: an additive sprite of the shared glow texture,
 * in the outline's own warm white so the two read as one light. It is set back
 * from the chip along the line of sight by more than the chip's popped
 * half-diagonal, so the puck always sits wholly in front of it and the glow
 * spills around the silhouette rather than washing over the mark.
 */
const HALO_COLOR = OUTLINE_HOVER_COLOR;
const HALO_SIZE = 4.6;
const HALO_OPACITY = 0.75;
const HALO_SETBACK = 1.45;
/** Slower than the pop, so the light swells up behind the chip rather than snapping on. */
const HALO_RATE = 6;

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
  /** Key into `getLogos()`; also how the proximity resolver knows this chip. */
  id: string;
  logo: LogoSpec;
  /** Fixed position on its shell's ring — the shell group does the orbiting. */
  position: [number, number, number];
  /** Decorrelates this chip's tumble from its neighbours'. */
  seed: number;
  onHover: (label: string | null) => void;
  /** The shared resolver that says which chip the astronaut is up close to. */
  proximity: ChipProximity;
}

/**
 * One orbiting tech chip: a toon-shaded rounded puck that tumbles, with its
 * brand mark struck into both faces. It is a thing to look at, not a control:
 * fly up to it (or hover it) and it lights — outline, pop and a halo behind —
 * while the world names it at the foot of the screen, and that is all; the
 * chip doesn't open anything.
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
export function Chip({ id, logo, position, seed, onHover, proximity }: ChipProps) {
  const [hovered, setHovered] = useState(false);
  /**
   * True while this is the chip the astronaut is up close to. Mirrors the
   * resolver's ref into state only when it changes, since the outline's color
   * and thickness are props and need a render to move.
   */
  const [near, setNear] = useState(false);
  const lit = hovered || near;

  const body = useRef<THREE.Group>(null!);
  const root = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Sprite>(null!);
  const scale = useRef(1);
  const glow = useRef(0);

  useEffect(() => {
    proximity.register(id, root.current);
    return () => proximity.register(id, null);
  }, [id, proximity]);

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
    () =>
      new THREE.MeshBasicMaterial({
        color: "#f2eefb",
        toneMapped: false,
        // One step nearer than the puck face it lies on — see STACK_OFFSET.
        polygonOffset: true,
        polygonOffsetFactor: -STACK_OFFSET,
        polygonOffsetUnits: -STACK_OFFSET,
      }),
    []
  );

  const haloMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: HALO_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        // Additive against the black of space, so it reads as light rather
        // than as a pale disc laid behind the chip.
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    []
  );
  useEffect(() => () => haloMaterial.dispose(), [haloMaterial]);

  // Scratch vectors for the halo set-back, kept off the per-frame heap.
  const scratch = useMemo(() => ({ chip: new THREE.Vector3(), eye: new THREE.Vector3() }), []);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;

    // Up close? The resolver already picked one winner for the whole system;
    // this only mirrors its answer into state on the frame it changes.
    const isNear = proximity.nearest.current === id;
    if (isNear !== near) setNear(isNear);

    // Tumble: three incommensurate rates, so the puck never settles into an
    // obvious repeating loop the way a single-axis spin does.
    if (body.current) {
      body.current.rotation.x = elapsed * TUMBLE.x + seed;
      body.current.rotation.y = elapsed * TUMBLE.y + seed * 1.7;
      body.current.rotation.z = Math.sin(elapsed * TUMBLE.z + seed) * 0.35;
    }

    if (!root.current) return;

    // Pop, applied to the whole chip so the outline grows with it.
    const target = lit ? HOVER_SCALE : 1;
    scale.current = THREE.MathUtils.lerp(
      scale.current,
      target,
      1 - Math.exp(-HOVER_RATE * delta)
    );
    root.current.scale.setScalar(scale.current);

    // The halo swells up behind a lit chip and dies away after. Skipped
    // entirely once dark, which is every chip but one nearly all the time.
    glow.current = THREE.MathUtils.lerp(glow.current, lit ? 1 : 0, 1 - Math.exp(-HALO_RATE * delta));
    if (halo.current) {
      const visible = glow.current > 0.001;
      halo.current.visible = visible;
      if (visible) {
        haloMaterial.opacity = glow.current * HALO_OPACITY;
        // Sit the sprite behind the chip along the line of sight, so the puck
        // is wholly in front of it whatever way it has tumbled.
        root.current.getWorldPosition(scratch.chip);
        state.camera.getWorldPosition(scratch.eye);
        scratch.chip.sub(scratch.eye).normalize().multiplyScalar(HALO_SETBACK);
        root.current.getWorldPosition(scratch.eye).add(scratch.chip);
        halo.current.position.copy(root.current.worldToLocal(scratch.eye));
      }
    }

    // A slow drift about the chip's own orbital position, so a ring at rest
    // still has life in it.
    root.current.position.set(
      position[0] + Math.sin(elapsed * 0.7 + seed) * 0.06,
      position[1] + Math.sin(elapsed * 0.53 + seed * 2.1) * 0.06,
      position[2]
    );
  });

  // Hover, as a second way to light a chip besides flying up to it. No click
  // handler and no pointer cursor: a pointer cursor promises a click does
  // something, and here it doesn't.
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
            color={lit ? OUTLINE_HOVER_COLOR : OUTLINE_COLOR}
            thickness={lit ? OUTLINE_HOVER_THICKNESS : OUTLINE_THICKNESS}
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
                <mesh material={backingMaterial} position={[0, 0, BACKING_HEIGHT]}>
                  <circleGeometry args={[BACKING_RADIUS, 32]} />
                </mesh>
              )}
              {/* Every layer starts on the face and each is extruded a little
                  taller than the last, so the mark's colors stack front-to-back
                  without any two top faces sharing a plane — and each layer's
                  material is offset a step nearer in depth than the last, so
                  the stack holds together at any distance (see STACK_OFFSET). */}
              {mark.geometries.map((geometry, i) => (
                <mesh
                  key={i}
                  geometry={geometry}
                  material={mark.materials[i]}
                  position={[0, 0, MARK_HEIGHT]}
                  scale={[1, 1, 1 + i * LAYER_LIFT]}
                />
              ))}
            </group>
          );
        })}
      </group>

      {/* The halo, hidden until lit; positioned each frame in useFrame. */}
      <sprite ref={halo} material={haloMaterial} scale={[HALO_SIZE, HALO_SIZE, 1]} visible={false} />

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
    () =>
      layers.map(
        (layer, i) =>
          new THREE.MeshBasicMaterial({
            color: layer.color,
            toneMapped: false,
            // Two steps clear of the puck face and its backing disc, then one
            // more per layer up the stack — see STACK_OFFSET.
            polygonOffset: true,
            polygonOffsetFactor: -STACK_OFFSET * (i + 2),
            polygonOffsetUnits: -STACK_OFFSET * (i + 2),
          })
      ),
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
