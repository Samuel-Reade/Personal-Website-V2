import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE } from "../palette";
import { flatMat, flatMatUnique, seeded } from "../materials";

/**
 * COVID-19 misinformation: a phone showing a flagged-content mark, with a
 * constant stream of speech bubbles pouring off it — the posts the study
 * classified, some of them flagged.
 */

/** Enough that the stream never visibly thins, few enough to stay one object. */
const BUBBLE_COUNT = 26;
const BUBBLE_LIFETIME = 6.5;
const BUBBLE_RISE = 5.4;
/** Fraction of bubbles carrying the flagged mark. */
const FLAGGED_SHARE = 0.3;

const BUBBLE_DEPTH = 0.09;
const CORNER_RADIUS = 0.15;
/** Padding from the balloon's edge to the text block inside it. */
const TEXT_PAD = 0.13;
const LINE_THICKNESS = 0.055;
const LINE_SPACING = 0.115;

interface BubbleVariant {
  width: number;
  height: number;
  /** Line lengths as a fraction of the usable width, top line first. */
  lines: number[];
}

/**
 * Three balloon shapes rather than one scaled three ways. A stream of one
 * silhouette at different sizes reads as the same post repeated; different
 * proportions and different numbers of lines read as different posts.
 */
const VARIANTS: BubbleVariant[] = [
  { width: 0.92, height: 0.5, lines: [0.78, 0.44] },
  { width: 1.26, height: 0.62, lines: [0.84, 0.66, 0.36] },
  { width: 1.02, height: 0.76, lines: [0.72, 0.86, 0.58, 0.3] },
];

/**
 * The balloon outline, tail included, as one closed path.
 *
 * The tail is a notch in the bottom edge of the same shape rather than a
 * separate cone parked against the side. That join is the whole reason the
 * silhouette reads as speech: a rounded body and a tail that plainly belong to
 * one another point at a speaker, where a blob with a spike near it reads as two
 * objects. It is also why the body is a rounded rectangle now — the squashed
 * icosahedron this replaces was a lump, and lumps read as rocks or clouds.
 */
function balloonShape(width: number, height: number): THREE.Shape {
  const x0 = -width / 2;
  const x1 = width / 2;
  const y0 = -height / 2;
  const y1 = height / 2;
  const r = Math.min(CORNER_RADIUS, height / 2 - 0.02, width / 2 - 0.02);

  // Tail sits a quarter in from the left and sweeps outward, the way a drawn
  // one does — centred and symmetrical it reads as a funnel.
  const tailBase = x0 + width * 0.24;
  const tailWidth = 0.2;
  const tailDrop = 0.26;

  const shape = new THREE.Shape();
  // Counter-clockwise from the bottom-left corner.
  shape.moveTo(x0 + r, y0);
  shape.lineTo(tailBase, y0);
  shape.lineTo(tailBase - tailWidth * 0.55, y0 - tailDrop);
  shape.lineTo(tailBase + tailWidth, y0);
  shape.lineTo(x1 - r, y0);
  shape.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x1, y1 - r);
  shape.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x0 + r, y1);
  shape.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x0, y0 + r);
  shape.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** The lines of "text", merged into a single geometry so a balloon stays one extra draw. */
function textGeometry(variant: BubbleVariant): THREE.BufferGeometry {
  const usable = variant.width - TEXT_PAD * 2;
  const top = ((variant.lines.length - 1) * LINE_SPACING) / 2;

  const lines = variant.lines.map((fraction, i) => {
    const lineWidth = usable * fraction;
    const box = new THREE.BoxGeometry(lineWidth, LINE_THICKNESS, 0.02);
    // Left-aligned like real text, not centred — a stack of centred bars reads
    // as a logo, a ragged right edge reads as writing.
    box.translate(
      -variant.width / 2 + TEXT_PAD + lineWidth / 2,
      top - i * LINE_SPACING,
      BUBBLE_DEPTH / 2 + 0.012
    );
    return box;
  });

  const merged = mergeGeometries(lines)!;
  for (const line of lines) line.dispose();
  return merged;
}

/** The strike across a flagged post, matching the slash on the phone's screen. */
function strikeGeometry(variant: BubbleVariant): THREE.BufferGeometry {
  const length = Math.hypot(variant.width, variant.height) * 0.82;
  const bar = new THREE.BoxGeometry(length, 0.06, 0.02);
  bar.rotateZ(-Math.atan2(variant.height, variant.width));
  bar.translate(0, 0, BUBBLE_DEPTH / 2 + 0.03);
  return bar;
}

function useBubbleGeometry() {
  return useMemo(
    () =>
      VARIANTS.map((variant) => ({
        body: new THREE.ExtrudeGeometry(balloonShape(variant.width, variant.height), {
          depth: BUBBLE_DEPTH,
          bevelEnabled: false,
          // Low on purpose: the corners should read as a few flat facets, in
          // keeping with everything else in the bay.
          curveSegments: 3,
        }).translate(0, 0, -BUBBLE_DEPTH / 2),
        text: textGeometry(variant),
        strike: strikeGeometry(variant),
      })),
    []
  );
}

interface Bubble {
  age: number;
  variant: number;
  /** Where it leaves the phone, in the phone's local XZ. */
  originX: number;
  originZ: number;
  /** Horizontal drift over its life. */
  driftX: number;
  driftZ: number;
  scale: number;
  /** Resting lean, in radians — applied in screen space, so it stays a lean. */
  tilt: number;
  bobPhase: number;
  flagged: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

function SpeechBubbles() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const variants = useBubbleGeometry();

  const bubbles = useMemo<Bubble[]>(
    () =>
      Array.from({ length: BUBBLE_COUNT }, (_, i) => {
        const angle = seeded(i * 7.3) * Math.PI * 2;
        return {
          // Spread through the cycle so the stream is already full on frame one.
          age: (i / BUBBLE_COUNT) * BUBBLE_LIFETIME,
          variant: Math.floor(seeded(i * 41.3) * VARIANTS.length),
          originX: Math.cos(angle) * (0.3 + seeded(i * 11.9) * 0.5),
          originZ: Math.sin(angle) * (0.2 + seeded(i * 13.1) * 0.35),
          driftX: (seeded(i * 17.7) - 0.5) * 3.4,
          driftZ: (seeded(i * 19.3) - 0.5) * 2.2,
          scale: 0.62 + seeded(i * 23.1) * 0.5,
          tilt: (seeded(i * 29.7) - 0.5) * 0.34,
          bobPhase: seeded(i * 31.3) * Math.PI * 2,
          flagged: seeded(i * 37.9) < FLAGGED_SHARE,
        };
      }),
    []
  );

  /**
   * Up to three materials per balloon: the body, the grey ink of its text, and
   * a red one for the strike if it is flagged.
   *
   * The writing stays grey on a flagged post rather than turning red with the
   * strike. Red on red is the one thing that stopped this reading — four red
   * lines under a red slash is a scribble, where grey writing with one red mark
   * through it is plainly a post that got caught.
   *
   * All unique per balloon because each fades on its own schedule; the ink used
   * to come from the shared cache, which left the writing at full strength while
   * the balloon faded out from under it.
   */
  const materials = useMemo(
    () =>
      bubbles.map((bubble) => ({
        body: flatMatUnique(
          bubble.flagged
            ? PALETTE.bubbleFlagged
            : bubble.variant % 2 === 0
              ? PALETTE.bubble
              : PALETTE.bubbleAlt,
          { transparent: true, opacity: 0 }
        ),
        ink: flatMatUnique(PALETTE.bubbleText, { transparent: true, opacity: 0 }),
        flag: bubble.flagged
          ? flatMatUnique(PALETTE.flagRed, { transparent: true, opacity: 0 })
          : null,
      })),
    [bubbles]
  );

  useEffect(() => {
    return () => {
      for (const variant of variants) {
        variant.body.dispose();
        variant.text.dispose();
        variant.strike.dispose();
      }
      for (const material of materials) {
        material.body.dispose();
        material.ink.dispose();
        material.flag?.dispose();
      }
    };
  }, [variants, materials]);

  // Scratch objects, so billboarding 26 balloons a frame allocates nothing.
  const scratch = useMemo(
    () => ({
      world: new THREE.Vector3(),
      parentInverse: new THREE.Quaternion(),
      face: new THREE.Quaternion(),
      lean: new THREE.Quaternion(),
    }),
    []
  );

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const camera = state.camera;

    // Every balloon shares a parent, so its inverse is worth computing once.
    const parent = groups.current[0]?.parent;
    if (parent) {
      parent.getWorldQuaternion(scratch.parentInverse).invert();
    }

    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      const group = groups.current[i];
      if (!group) continue;

      bubble.age = (bubble.age + delta) % BUBBLE_LIFETIME;
      const t = bubble.age / BUBBLE_LIFETIME;

      group.position.set(
        bubble.originX + bubble.driftX * t + Math.sin(time * 0.8 + bubble.bobPhase) * 0.18 * t,
        3.1 + t * BUBBLE_RISE,
        bubble.originZ + bubble.driftZ * t
      );
      // Pops to full size quickly and then holds, the way a notification lands.
      group.scale.setScalar(bubble.scale * Math.min(1, t * 7));

      /**
       * Turned to face the camera about the vertical only. A balloon is a flat
       * card with writing on it, so seen edge-on it is a sliver and the text is
       * nothing — the old free rotation spent much of each life exactly there.
       * Yaw alone keeps the writing readable from anywhere in the bay while
       * leaving the tail hanging downward, still pointing back at the phone.
       */
      group.getWorldPosition(scratch.world);
      scratch.face.setFromAxisAngle(
        UP,
        Math.atan2(camera.position.x - scratch.world.x, camera.position.z - scratch.world.z)
      );
      group.quaternion.multiplyQuaternions(scratch.parentInverse, scratch.face);
      // Applied after the facing, so the lean happens in screen space and reads
      // as a jaunty tilt rather than swinging the balloon away from the viewer.
      scratch.lean.setFromAxisAngle(FORWARD, bubble.tilt + Math.sin(time * 0.6 + bubble.bobPhase) * 0.05);
      group.quaternion.multiply(scratch.lean);

      const opacity = Math.min(t * 7, 1) * (1 - t * t) * 0.94;
      materials[i].body.opacity = opacity;
      materials[i].ink.opacity = opacity;
      if (materials[i].flag) materials[i].flag!.opacity = opacity;
    }
  });

  return (
    <>
      {bubbles.map((bubble, i) => {
        const variant = variants[bubble.variant];
        return (
          <group key={i} ref={(el) => (groups.current[i] = el)}>
            <mesh geometry={variant.body} material={materials[i].body} />
            <mesh geometry={variant.text} material={materials[i].ink} />
            {/* Flagged posts keep their writing and take a strike across it, the
                same slash the phone's screen carries. */}
            {bubble.flagged && <mesh geometry={variant.strike} material={materials[i].flag!} />}
          </group>
        );
      })}
    </>
  );
}

export function PhoneScene() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.phoneBezel)} position={[0, 0.16, 0]}>
        <boxGeometry args={[1.5, 0.32, 0.72]} />
      </mesh>
      <mesh material={flatMat(PALETTE.phoneBody)} position={[0, 1.85, 0]}>
        <boxGeometry args={[1.5, 3.1, 0.22]} />
      </mesh>
      <mesh material={flatMat(PALETTE.phoneScreen)} position={[0, 1.9, 0.13]}>
        <boxGeometry args={[1.28, 2.6, 0.03]} />
      </mesh>
      <mesh material={flatMat(PALETTE.phoneBezel)} position={[0, 3.28, 0.13]}>
        <boxGeometry args={[0.34, 0.06, 0.03]} />
      </mesh>

      {/* The blocked mark: a ring with a bar struck through it. */}
      <mesh material={flatMat(PALETTE.flagRed)} position={[0, 1.9, 0.17]}>
        <torusGeometry args={[0.44, 0.1, 5, 14]} />
      </mesh>
      <mesh material={flatMat(PALETTE.flagRed)} position={[0, 1.9, 0.19]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.88, 0.19, 0.08]} />
      </mesh>

      <SpeechBubbles />
    </group>
  );
}
