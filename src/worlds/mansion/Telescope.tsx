import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { flatMaterial, PALETTE } from "./materials";
import { LANDING_Y, TELESCOPE_X, TELESCOPE_Z } from "./layout";

/**
 * The telescope on the balcony: a full-size brass refractor on a timber tripod,
 * aimed out over the rail at the sea and the sky above it. Clicking it raises
 * the eyepiece view — the balcony's whole reason to exist, since what the
 * telescope frames is how a visitor reaches me.
 *
 * The design is the Interests shelf's "Stellar Masses" figurine grown to
 * human scale — same tripod, same tapered tube, same brass fittings — so
 * anyone who has browsed the shelf recognises it at a glance.
 */

/** Matches the book's glow language, value for value — see Centrepiece.tsx. */
const GLOW_REST = 0.55;
const GLOW_HOVER = 1.35;
const GLOW_RATE = 7;

/** Upward pitch of the tube. Enough to hold both the horizon and the sky. */
const TUBE_PITCH = 0.4;
/** Slight yaw toward the centre of the view, since it stands right of it. */
const TUBE_YAW = 0.12;

export function Telescope() {
  const openTelescope = useStore((s) => s.openTelescope);
  const [hovered, setHovered] = useState(false);

  const woodMaterial = useMemo(() => flatMaterial(PALETTE.tableBase), []);
  const tubeMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);
  const brassMaterial = useMemo(() => flatMaterial(PALETTE.brass), []);
  // The lens is the invite: the one glowing surface, facing whoever walks out
  // of the doorway, pulsing gently the way the book's pages do.
  const lensMaterial = useMemo(
    () => flatMaterial(PALETTE.candle, { emissive: PALETTE.candle, emissiveIntensity: GLOW_REST }),
    []
  );
  const glowRef = useRef<THREE.PointLight>(null!);

  useFrame((state, delta) => {
    const settle = 1 - Math.exp(-GLOW_RATE * delta);
    const breathing = GLOW_REST + Math.sin(state.clock.elapsedTime * 1.3) * 0.09;
    const target = hovered ? GLOW_HOVER : breathing;

    lensMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      lensMaterial.emissiveIntensity,
      target,
      settle
    );
    if (glowRef.current) {
      glowRef.current.intensity = THREE.MathUtils.lerp(glowRef.current.intensity, target * 2.6, settle);
    }
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
      openTelescope();
    },
  };

  return (
    <group position={[TELESCOPE_X, LANDING_Y, TELESCOPE_Z]} rotation={[0, TUBE_YAW, 0]}>
      {/* One generous hull carrying the events, the same trick as the book:
          matched to the tripod's spread, not the tube's silhouette. */}
      <mesh position={[0, 1, 0]} {...interaction}>
        <boxGeometry args={[1.5, 2.1, 1.7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Tripod: three timber legs splayed to a brass hub. */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        return (
          <mesh
            key={i}
            material={woodMaterial}
            position={[Math.cos(a) * 0.3, 0.56, Math.sin(a) * 0.3]}
            rotation={[Math.sin(a) * 0.48, 0, -Math.cos(a) * 0.48]}
          >
            <cylinderGeometry args={[0.035, 0.045, 1.24, 5]} />
          </mesh>
        );
      })}
      <mesh material={brassMaterial} position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.18, 6]} />
      </mesh>
      {/* Altitude yoke and its tightening knob. */}
      <mesh material={brassMaterial} position={[0, 1.26, 0]}>
        <boxGeometry args={[0.1, 0.16, 0.22]} />
      </mesh>
      <mesh material={brassMaterial} position={[0.09, 1.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.06, 6]} />
      </mesh>

      {/* The tube, pitched so the objective clears the rail and the eyepiece
          drops to standing height at the back. */}
      <group position={[0, 1.38, 0]} rotation={[TUBE_PITCH, 0, 0]}>
        <mesh material={tubeMaterial} rotation={[Math.PI / 2, 0, 0]}>
          {/* Top of the cylinder maps to +z after the rotation, which is the
              house side — so the narrow end is the eyepiece's. */}
          <cylinderGeometry args={[0.075, 0.105, 1.6, 8]} />
        </mesh>
        {/* Objective ring at the seaward mouth. */}
        <mesh material={brassMaterial} position={[0, 0, -0.82]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.118, 0.108, 0.09, 8]} />
        </mesh>
        {/* Drawtube and eyepiece cup. */}
        <mesh material={brassMaterial} position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.048, 0.052, 0.24, 6]} />
        </mesh>
        <mesh material={brassMaterial} position={[0, 0, 1.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.066, 0.054, 0.09, 6]} />
        </mesh>
        {/* The glowing lens in the cup. */}
        <mesh material={lensMaterial} position={[0, 0, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
        </mesh>
        {/* Finder scope riding the tube. */}
        <mesh material={brassMaterial} position={[0.13, 0.08, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.03, 0.34, 6]} />
        </mesh>
      </group>

      {/* Spills the lens glow onto the tripod and the slab under it. */}
      <pointLight
        ref={glowRef}
        position={[0, 1.3, 0.9]}
        color="#ffcf8f"
        intensity={1.5}
        distance={5}
        decay={2}
      />
    </group>
  );
}
