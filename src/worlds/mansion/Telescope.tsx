import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../state/useStore";
import { flatMaterial, PALETTE } from "./materials";
import { LANDING_Y, TELESCOPE_X, TELESCOPE_Z } from "./layout";

/**
 * The telescope on the balcony: a long brass-and-bronze refractor on a timber
 * tripod, aimed out over the rail at the sea and the sky above it. Clicking it
 * — or pressing Space beside it — raises the eyepiece view, which is the
 * balcony's whole reason to exist.
 *
 * Built like a real instrument rather than a toy of one: a dew shield flaring
 * at the objective, a rack-and-pinion focuser with knobs at the back, a finder
 * scope on ring mounts, a slow-motion control hanging from the yoke, and legs
 * held by a spreader. All of it still the site's flat-shaded low-poly language
 * — realism here is proportions and parts, not polish.
 */

/** Matches the book's glow language, value for value — see Centrepiece.tsx. */
const GLOW_REST = 0.55;
const GLOW_HOVER = 1.35;
const GLOW_RATE = 7;

/** Upward pitch of the tube. Enough to hold both the horizon and the sky. */
const TUBE_PITCH = 0.4;
/** Slight yaw toward the centre of the view, since it stands right of it. */
const TUBE_YAW = 0.12;

/** Where the tube pivots on the mount. */
const TUBE_Y = 1.62;

export function Telescope() {
  const openTelescope = useStore((s) => s.openTelescope);
  const [hovered, setHovered] = useState(false);

  const woodMaterial = useMemo(() => flatMaterial(PALETTE.tableBase), []);
  const tubeMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);
  const brassMaterial = useMemo(() => flatMaterial(PALETTE.brass), []);
  const glassMaterial = useMemo(() => flatMaterial("#2e3a4a"), []);
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
      <mesh position={[0, 1.15, 0]} {...interaction}>
        <boxGeometry args={[1.7, 2.4, 2.0]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Tripod: three timber legs splayed from a brass hub, brass-shod feet,
          and a spreader holding them at their stance — legs without one read
          as sticks leant together.

          The tilt leans each leg's top INTO the centre, so the three meet
          under the mount hub and the feet land on their brass shoes. With the
          signs the other way round the stand was upside down — legs converging
          at the floor and splaying at the sky, shoes floating unattached — a
          sawhorse falling over rather than a tripod standing up. */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        return (
          <group key={i}>
            <mesh
              material={woodMaterial}
              position={[Math.cos(a) * 0.34, 0.66, Math.sin(a) * 0.34]}
              rotation={[-Math.sin(a) * 0.46, 0, Math.cos(a) * 0.46]}
            >
              <cylinderGeometry args={[0.038, 0.05, 1.5, 5]} />
            </mesh>
            <mesh
              material={brassMaterial}
              position={[Math.cos(a) * 0.63, 0.05, Math.sin(a) * 0.63]}
            >
              <coneGeometry args={[0.05, 0.12, 5]} />
            </mesh>
            {/* Spreader arm out to this leg. */}
            <mesh
              material={woodMaterial}
              position={[Math.cos(a) * 0.22, 0.52, Math.sin(a) * 0.22]}
              rotation={[0, -a, 0]}
            >
              <boxGeometry args={[0.46, 0.035, 0.06]} />
            </mesh>
          </group>
        );
      })}
      <mesh material={brassMaterial} position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.06, 6]} />
      </mesh>

      {/* The mount: hub, column, altitude yoke and its tension knob. */}
      <mesh material={brassMaterial} position={[0, 1.32, 0]}>
        <cylinderGeometry args={[0.13, 0.17, 0.2, 6]} />
      </mesh>
      <mesh material={tubeMaterial} position={[0, 1.46, 0]}>
        <cylinderGeometry args={[0.055, 0.065, 0.16, 6]} />
      </mesh>
      <mesh material={brassMaterial} position={[0, TUBE_Y - 0.04, 0]}>
        <boxGeometry args={[0.12, 0.2, 0.3]} />
      </mesh>
      <mesh material={brassMaterial} position={[0.1, TUBE_Y - 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.07, 6]} />
      </mesh>
      {/* Slow-motion control rod, hanging back toward the observer's hand. */}
      <mesh material={brassMaterial} position={[0.07, 1.24, 0.5]} rotation={[0.75, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.8, 5]} />
      </mesh>
      <mesh material={brassMaterial} position={[0.07, 0.95, 0.83]} rotation={[0.75, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.05, 6]} />
      </mesh>

      {/* The tube, pitched so the objective clears the rail and the eyepiece
          drops to standing height at the back. */}
      <group position={[0, TUBE_Y, 0]} rotation={[TUBE_PITCH, 0, 0]}>
        {/* Main tube — narrow at the eye end, swelling toward the objective. */}
        <mesh material={tubeMaterial} rotation={[Math.PI / 2, 0, 0]}>
          {/* Top of the cylinder maps to +z after the rotation, which is the
              house side — so the narrow end is the eyepiece's. */}
          <cylinderGeometry args={[0.085, 0.12, 2.0, 8]} />
        </mesh>
        {/* Brass bands where a real tube is joined. */}
        <mesh material={brassMaterial} position={[0, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.122, 0.116, 0.06, 8]} />
        </mesh>
        <mesh material={brassMaterial} position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.101, 0.095, 0.06, 8]} />
        </mesh>
        {/* Dew shield flaring at the mouth, and the objective glass inside. */}
        <mesh material={tubeMaterial} position={[0, 0, -1.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.132, 0.15, 0.46, 8]} />
        </mesh>
        <mesh material={brassMaterial} position={[0, 0, -1.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.152, 0.148, 0.05, 8]} />
        </mesh>
        <mesh material={glassMaterial} position={[0, 0, -1.26]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.02, 8]} />
        </mesh>

        {/* Rack-and-pinion focuser: housing, drawtube, and a knob each side. */}
        <mesh material={brassMaterial} position={[0, -0.02, 0.98]}>
          <boxGeometry args={[0.17, 0.15, 0.2]} />
        </mesh>
        {([1, -1] as const).map((side) => (
          <mesh
            key={side}
            material={tubeMaterial}
            position={[side * 0.11, -0.04, 0.98]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.052, 0.052, 0.05, 6]} />
          </mesh>
        ))}
        <mesh material={brassMaterial} position={[0, 0, 1.14]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.048, 0.052, 0.24, 6]} />
        </mesh>
        {/* Eyepiece cup, and the glowing lens in it. */}
        <mesh material={brassMaterial} position={[0, 0, 1.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.056, 0.1, 6]} />
        </mesh>
        <mesh material={lensMaterial} position={[0, 0, 1.36]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.052, 0.052, 0.02, 8]} />
        </mesh>

        {/* Finder scope on two ring mounts, with its own tiny objective. */}
        {[0.28, 0.68].map((z) => (
          <mesh key={z} material={brassMaterial} position={[0.14, 0.1, z]}>
            <boxGeometry args={[0.035, 0.09, 0.05]} />
          </mesh>
        ))}
        <mesh material={tubeMaterial} position={[0.14, 0.15, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.038, 0.5, 6]} />
        </mesh>
        <mesh material={glassMaterial} position={[0.14, 0.15, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.015, 6]} />
        </mesh>
      </group>

      {/* Spills the lens glow onto the tripod and the slab under it. */}
      <pointLight
        ref={glowRef}
        position={[0, 1.35, 1.05]}
        color="#ffcf8f"
        intensity={1.5}
        distance={5}
        decay={2}
      />
    </group>
  );
}
