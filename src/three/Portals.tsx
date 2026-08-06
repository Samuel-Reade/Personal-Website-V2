import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FontLoader, type Font, type FontData } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import helvetikerBold from "three/examples/fonts/helvetiker_bold.typeface.json";
import { useStore } from "../state/useStore";
import { createPortalMaterial, PORTAL_SURFACE_FRACTION } from "./portalMaterial";
import { ALL_PORTALS, type PortalSpot } from "./world";

/** Radius of a full-size portal's visible surface, in world units. */
const PORTAL_SURFACE_RADIUS = 1.6;
/** Gap between the top of the portal surface and the baseline of its label. */
const LABEL_CLEARANCE = 0.72;
const LABEL_SIZE = 0.4;
const LABEL_BOB_HEIGHT = 0.09;
const LABEL_BOB_SPEED = 2.2;

/**
 * The font ships inside the three package, so it is bundled rather than
 * fetched — no loading state, and nothing to 404 in production.
 */
let cachedFont: Font | null = null;
function getFont(): Font {
  if (!cachedFont) cachedFont = new FontLoader().parse(helvetikerBold as unknown as FontData);
  return cachedFont;
}

function Portal({ spot }: { spot: PortalSpot }) {
  const openPanel = useStore((s) => s.openPanel);
  const [hovered, setHovered] = useState(false);
  const labelRef = useRef<THREE.Group>(null!);

  // Decorrelates this portal's swirl, pulse, and bob from its neighbours'.
  const seed = useMemo(() => Math.random() * Math.PI * 2, []);
  const material = useMemo(() => createPortalMaterial(seed), [seed]);

  const { labelGeometry, labelHitSize } = useMemo(() => {
    const geometry = new TextGeometry(spot.label, {
      font: getFont(),
      size: LABEL_SIZE,
      depth: 0.14,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.014,
      bevelSegments: 2,
    });
    // TextGeometry lays glyphs out rightward from the origin, so without this
    // every label would hang off to one side of its portal.
    geometry.center();

    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    return {
      labelGeometry: geometry,
      // Padded, because raycasting the glyphs themselves means every gap
      // between and inside letters is a hole the click falls straight through.
      labelHitSize: [box.max.x - box.min.x + 0.28, box.max.y - box.min.y + 0.24] as [number, number],
    };
  }, [spot.label]);

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

  const surfaceRadius = PORTAL_SURFACE_RADIUS * spot.scale;
  // The disc geometry runs past the portal surface so the glow has room to
  // fade out across it; scale up to compensate and keep the surface on-size.
  const discScale = surfaceRadius / PORTAL_SURFACE_FRACTION;
  const labelBaseY = surfaceRadius + LABEL_CLEARANCE * spot.scale;

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
      openPanel(spot.id);
    },
  };

  return (
    <group position={spot.position} rotation={[0, spot.rotationY, 0]}>
      <mesh material={material} scale={discScale} {...interaction}>
        <circleGeometry args={[1, 96]} />
      </mesh>

      <group ref={labelRef} position={[0, labelBaseY, 0]}>
        <mesh geometry={labelGeometry} material={labelMaterial} scale={spot.scale} {...interaction} />
        {/* Invisible but still raycast, so the whole label reads as one click
            target instead of only the solid strokes of the glyphs. */}
        <mesh scale={spot.scale} {...interaction}>
          <planeGeometry args={labelHitSize} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** One swirling portal per content section, each with its own floating label. */
export function Portals() {
  return (
    <>
      {ALL_PORTALS.map((spot) => (
        <Portal key={spot.id} spot={spot} />
      ))}
    </>
  );
}
