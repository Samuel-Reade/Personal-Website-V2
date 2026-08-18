import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useStore, WORLD_BY_PORTAL } from "../state/useStore";
import { displaySize, getDisplayFont } from "./displayFont";
import {
  createPortalMaterial,
  PORTAL_SURFACE_FRACTION,
  PORTAL_SURFACE_RADIUS,
} from "./portalMaterial";
import { ALL_PORTALS, clickReturnState, type PortalSpot } from "./world";

/** Gap between the top of the portal surface and the baseline of its label. */
const LABEL_CLEARANCE = 0.72;
/** Cap height of a label's letters, in world units — see `displaySize`. */
const LABEL_CAP_HEIGHT = 0.4;
const LABEL_BOB_HEIGHT = 0.09;
const LABEL_BOB_SPEED = 2.2;

function Portal({ spot }: { spot: PortalSpot }) {
  const openPanel = useStore((s) => s.openPanel);
  const enterWorld = useStore((s) => s.enterWorld);
  const [hovered, setHovered] = useState(false);
  const labelRef = useRef<THREE.Group>(null!);

  // Decorrelates this portal's swirl, pulse, and bob from its neighbours'.
  const seed = useMemo(() => Math.random() * Math.PI * 2, []);
  const material = useMemo(() => createPortalMaterial(seed), [seed]);

  const { labelGeometry, labelHitSize } = useMemo(() => {
    const geometry = new TextGeometry(spot.label, {
      font: getDisplayFont(),
      size: displaySize(LABEL_CAP_HEIGHT),
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
      // A section portal reads its panel without travelling — the behaviour
      // every portal had before the worlds existed. Reade Hall has no panel to
      // read, so clicking it does what walking into it does and takes you there.
      const world = WORLD_BY_PORTAL[spot.id];
      if (spot.panel) openPanel(spot.panel);
      else if (world) enterWorld(world, clickReturnState(spot));
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

/**
 * One swirling portal per content section plus the one back to Reade Hall, each
 * with its own floating label.
 */
export function Portals() {
  return (
    <>
      {ALL_PORTALS.map((spot) => (
        <Portal key={spot.id} spot={spot} />
      ))}
    </>
  );
}
