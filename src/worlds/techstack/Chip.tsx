import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Outlines, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { createRimToonMaterial } from "../../utils/toon";
import { buildLogoGeometry } from "./logoGeometry";
import type { LogoSpec } from "./logos";

/** Chip body, in world units. Flat enough to read as a badge rather than a box. */
const BODY = { width: 1.02, height: 1.02, depth: 0.16 };
const CORNER_RADIUS = 0.2;
const CORNER_SMOOTHNESS = 4;

/** Matches the meadow character's outline treatment. */
const OUTLINE_COLOR = "#2b2440";
const OUTLINE_THICKNESS = 0.024;
const OUTLINE_HOVER_COLOR = "#fff2c4";
const OUTLINE_HOVER_THICKNESS = 0.055;

/** Clearance between the body's silhouette and the logo sitting on it. */
const FACE_GAP = 0.012;
/** Radius of the pale disc placed behind marks too dark to read unaided. */
const BACKING_RADIUS = 0.42;

const HOVER_SCALE = 1.22;
/** Exponential rate for the hover scale, so the pop eases rather than snaps. */
const HOVER_RATE = 11;

interface ChipProps {
  logo: LogoSpec;
  /** The `TECH_STACK` group this chip opens. */
  group: string;
  /** Fixed position on its shell's ring — the shell group does the orbiting. */
  position: [number, number, number];
  /** Decorrelates this chip's tumble from its neighbours'. */
  seed: number;
  onHover: (label: string | null) => void;
}

/**
 * One orbiting tech chip: a toon-shaded rounded puck that tumbles, with its
 * brand mark billboarded flat to the camera so it stays readable no matter how
 * the puck happens to be turned.
 *
 * The mark is deliberately *not* part of the tumbling body. It rides on a second
 * group that faces the camera every frame and sits exactly on the body's
 * silhouette along the view axis — see the support-distance calculation below,
 * which is what keeps the mark flush against a rotating box instead of either
 * sinking into it or floating off it.
 *
 * The mark is also the one thing in this world outside the toon pipeline. Brand
 * colors have to render true, and `MeshToonMaterial` quantises lighting into
 * three flat bands — which turns Python's yellow olive and React's cyan a muddy
 * teal depending on where the mark happens to be facing. `MeshBasicMaterial` is
 * unlit, so `#3776AB` on screen is `#3776AB`.
 */
export function Chip({ logo, group, position, seed, onHover }: ChipProps) {
  const openEntry = useStore((s) => s.openEntry);
  const [hovered, setHovered] = useState(false);

  const body = useRef<THREE.Group>(null!);
  const billboard = useRef<THREE.Group>(null!);
  const face = useRef<THREE.Group>(null!);
  const root = useRef<THREE.Group>(null!);
  const scale = useRef(1);

  const logoGeometry = useMemo(() => buildLogoGeometry(logo.path), [logo.path]);
  const logoMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: logo.color, toneMapped: false }),
    [logo.color]
  );

  /**
   * The puck itself takes a dimmed, desaturated cast of its own brand color
   * rather than one shared neutral — it ties each chip to its mark without
   * competing with it, and a ring of twenty-one identical grey pucks reads as
   * far more uniform than the stack actually is.
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

  // Reused across frames — allocating vectors inside useFrame churns the heap at
  // 21 chips x 60fps.
  const toCamera = useMemo(() => new THREE.Vector3(), []);
  const localDir = useMemo(() => new THREE.Vector3(), []);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const bodyQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;

    // Tumble: three incommensurate rates, so the puck never settles into an
    // obvious repeating loop the way a single-axis spin does.
    if (body.current) {
      body.current.rotation.x = elapsed * 0.34 + seed;
      body.current.rotation.y = elapsed * 0.51 + seed * 1.7;
      body.current.rotation.z = Math.sin(elapsed * 0.29 + seed) * 0.4;
    }

    if (!billboard.current || !face.current || !root.current) return;

    // Face the camera. `lookAt` accounts for the parent shell's rotation, so the
    // mark stays square to the lens even as the whole ring turns.
    root.current.getWorldPosition(worldPosition);
    billboard.current.lookAt(state.camera.position);

    // Sit the mark exactly on the body's silhouette along the view axis.
    //
    // For a box with half-extents h rotated by R, the distance from its centre to
    // its surface along a unit direction d is |d·Rx|hx + |d·Ry|hy + |d·Rz|hz —
    // the support function of the box. Evaluating it every frame is what lets the
    // mark stay flush against a freely tumbling puck: a fixed offset would have
    // to clear the box's half-diagonal, leaving the mark visibly detached
    // whenever the puck turned face-on.
    toCamera.copy(state.camera.position).sub(worldPosition).normalize();
    if (body.current) {
      body.current.getWorldQuaternion(bodyQuaternion);
      localDir.copy(toCamera).applyQuaternion(bodyQuaternion.invert());
      const support =
        Math.abs(localDir.x) * (BODY.width / 2) +
        Math.abs(localDir.y) * (BODY.height / 2) +
        Math.abs(localDir.z) * (BODY.depth / 2);
      face.current.position.z = support + FACE_GAP;
    }

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
    axis.set(
      Math.sin(elapsed * 0.7 + seed) * 0.06,
      Math.sin(elapsed * 0.53 + seed * 2.1) * 0.06,
      0
    );
    root.current.position.set(position[0] + axis.x, position[1] + axis.y, position[2]);
  });

  const interaction = {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(true);
      onHover(logo.label);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(false);
      onHover(null);
      document.body.style.cursor = "default";
    },
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      openEntry("techstack", group);
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
      </group>

      <group ref={billboard}>
        <group ref={face}>
          {/* Very dark marks (GitHub, Vercel, Three.js) are near-invisible against
              the puck's own dark cast, so they get a pale disc to sit on. */}
          {logo.needsBacking && (
            <mesh material={backingMaterial} position={[0, 0, -0.008]}>
              <circleGeometry args={[BACKING_RADIUS, 32]} />
            </mesh>
          )}
          <mesh geometry={logoGeometry} material={logoMaterial} />
        </group>
      </group>

      {/* One invisible sphere carries every pointer event. Raycasting the mark
          itself would mean the gaps inside and between its glyphs are holes the
          cursor falls through, and raycasting the tumbling body would make the
          hit target flicker in size as it turns. */}
      <mesh {...interaction} visible={false}>
        <sphereGeometry args={[0.78, 12, 10]} />
      </mesh>
    </group>
  );
}
