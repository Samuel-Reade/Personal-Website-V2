import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FontLoader, type Font, type FontData } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import helvetikerBold from "three/examples/fonts/helvetiker_bold.typeface.json";
import { useStore } from "../state/useStore";
import { createPortalMaterial, PORTAL_SURFACE_FRACTION } from "./portalMaterial";

/** Radius of the portal surface at scale 1, matching the meadow's ring portals. */
const SURFACE_RADIUS = 1.6;
const LABEL_CLEARANCE = 0.72;
const LABEL_SIZE = 0.4;
const LABEL_BOB_HEIGHT = 0.09;
const LABEL_BOB_SPEED = 2.2;

/** The font ships inside the three package, so it is bundled rather than fetched. */
let cachedFont: Font | null = null;
function getFont(): Font {
  if (!cachedFont) cachedFont = new FontLoader().parse(helvetikerBold as unknown as FontData);
  return cachedFont;
}

interface ReturnPortalProps {
  /** The world's player/vehicle position, read each frame to test the trigger. */
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  position: [number, number, number];
  /** Y rotation that turns the portal's face toward wherever the player approaches from. */
  rotationY?: number;
  scale?: number;
  /**
   * Radius of the walk-in trigger. Worlds with momentum want this wider than the
   * meadow's — a boat carrying speed can cross a tight circle inside one frame's
   * step and never register as inside it.
   */
  triggerRadius?: number;
  label?: string;
}

/**
 * The way back out of a world: the same swirling disc that brought the player
 * in, standing in the world it leads out of. Walking (or rowing) into it returns
 * to the meadow, and so does clicking it.
 *
 * This is deliberately additive rather than a replacement — every world keeps
 * its Escape key and its back button. The portal exists because those two are
 * chrome, and a world you entered by walking through something should be
 * leavable the same way.
 */
export function ReturnPortal({
  playerPosRef,
  position,
  rotationY = Math.PI,
  scale = 1,
  triggerRadius = 1.4,
  label = "Meadow",
}: ReturnPortalProps) {
  const exitWorld = useStore((s) => s.exitWorld);
  const [hovered, setHovered] = useState(false);
  const labelRef = useRef<THREE.Group>(null!);
  /**
   * Starts disarmed and only arms once the player is clear of the trigger, the
   * same guard the meadow's portals use — otherwise a world that happened to
   * spawn the player inside the circle would bounce them straight back out.
   */
  const armed = useRef(false);

  const seed = useMemo(() => Math.random() * Math.PI * 2, []);
  const material = useMemo(() => createPortalMaterial(seed), [seed]);

  const { labelGeometry, labelHitSize } = useMemo(() => {
    const geometry = new TextGeometry(label, {
      font: getFont(),
      size: LABEL_SIZE,
      depth: 0.14,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.014,
      bevelSegments: 2,
    });
    geometry.center();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    return {
      labelGeometry: geometry,
      // Padded, because raycasting the glyphs themselves means every gap between
      // and inside letters is a hole the click falls straight through.
      labelHitSize: [box.max.x - box.min.x + 0.28, box.max.y - box.min.y + 0.24] as [number, number],
    };
  }, [label]);

  const labelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f4e8ff",
        emissive: new THREE.Color("#a855f7"),
        emissiveIntensity: 1.4,
        roughness: 0.35,
        metalness: 0,
      }),
    []
  );

  // Leaving the world with a hover still active would strand the cursor as a pointer.
  useEffect(() => () => {
    document.body.style.cursor = "default";
  }, []);

  const surfaceRadius = SURFACE_RADIUS * scale;
  const discScale = surfaceRadius / PORTAL_SURFACE_FRACTION;
  const labelBaseY = surfaceRadius + LABEL_CLEARANCE * scale;

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    material.uniforms.uTime.value = elapsed;

    if (labelRef.current) {
      labelRef.current.position.y =
        labelBaseY + Math.sin(elapsed * LABEL_BOB_SPEED + seed) * LABEL_BOB_HEIGHT;
    }
    labelMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      labelMaterial.emissiveIntensity,
      hovered ? 2.6 : 1.4,
      0.12
    );

    const player = playerPosRef.current;
    const distance = Math.hypot(player.x - position[0], player.z - position[2]);

    if (distance > triggerRadius) {
      armed.current = true;
      return;
    }
    if (!armed.current) return;
    // Read non-reactively: subscribing would re-render this component on every
    // panel open. Walking out from under an open panel would yank the reader out
    // of what they were reading, so the trigger waits until it's closed.
    if (useStore.getState().activePanel) return;

    armed.current = false;
    exitWorld();
  });

  const interaction = {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(false);
      document.body.style.cursor = "default";
    },
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      exitWorld();
    },
  };

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh material={material} scale={discScale} {...interaction}>
        <circleGeometry args={[1, 96]} />
      </mesh>

      <group ref={labelRef} position={[0, labelBaseY, 0]}>
        <mesh geometry={labelGeometry} material={labelMaterial} scale={scale} {...interaction} />
        <mesh scale={scale} {...interaction}>
          <planeGeometry args={labelHitSize} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
