import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Chip } from "./Chip";
import { getLogos } from "./logos";
import { SHELLS, chipAngle, type ShellSpec } from "./layout";

/** Opacity of the faint guide ring drawn along each shell's orbit. */
const GUIDE_OPACITY = 0.13;
/** ...and the opacity it lifts to once its legend entry is selected. */
const GUIDE_SELECTED_OPACITY = 0.9;
const GUIDE_THICKNESS = 0.035;

/** The rings' resting lavender. The legend's index badges are set to match it. */
const GUIDE_COLOR = new THREE.Color("#b9a6ff");
/** Near-white, so a selected ring reads as lit rather than merely less transparent. */
const GUIDE_GLOW_COLOR = new THREE.Color("#e6dcff");

/**
 * A wide, soft ring that fades in behind the selected orbit. The guide line
 * alone is a single hairline — brightening it makes it *visible*, but a hairline
 * at any opacity still doesn't glow. The spill around it is what does.
 */
const HALO_THICKNESS = GUIDE_THICKNESS * 9;
const HALO_SELECTED_OPACITY = 0.22;
/** Exponential ease on the glow, so selecting a ring fades it up rather than snapping. */
const GLOW_RATE = 7;

interface ShellProps {
  shell: ShellSpec;
  index: number;
  onHover: (label: string | null) => void;
  /** True while this shell's entry in the HUD legend is the selected one. */
  selected: boolean;
}

/**
 * One orbital shell: a tilted ring of chips turning about the planet.
 *
 * The rotation lives on the group rather than on each chip, so a shell turns as
 * one rigid ring — chips animating their own orbital angle would drift out of
 * formation under variable frame times, and the ring would slowly smear.
 */
function Shell({ shell, index, onHover, selected }: ShellProps) {
  const spin = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Mesh>(null!);
  /** Eased 0→1 selection, so the ring lights up over a few frames. */
  const glow = useRef(0);
  const logos = getLogos();

  const guideMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: GUIDE_COLOR.clone(),
        transparent: true,
        opacity: GUIDE_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  const haloMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: GUIDE_GLOW_COLOR.clone(),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
        // Additive against the black of space, so the spill reads as emitted
        // light rather than as a translucent grey band laid over the stars.
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame((state, delta) => {
    if (spin.current) {
      // Driven from absolute elapsed time rather than accumulated deltas, so a
      // dropped frame shifts nothing permanently.
      spin.current.rotation.y = shell.phase + state.clock.elapsedTime * shell.speed;
    }

    // exp form keeps the ease frame-rate independent, as elsewhere on the site.
    glow.current = THREE.MathUtils.lerp(glow.current, selected ? 1 : 0, 1 - Math.exp(-GLOW_RATE * delta));

    guideMaterial.opacity = THREE.MathUtils.lerp(GUIDE_OPACITY, GUIDE_SELECTED_OPACITY, glow.current);
    guideMaterial.color.lerpColors(GUIDE_COLOR, GUIDE_GLOW_COLOR, glow.current);

    // A slow breath on the halo only — pulsing the guide line as well would read
    // as the ring flickering rather than as it being lit.
    const pulse = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 2.2);
    haloMaterial.opacity = glow.current * HALO_SELECTED_OPACITY * pulse;
    // Skip the draw entirely once it has faded out, which is the usual case for
    // three of the four rings.
    if (halo.current) halo.current.visible = glow.current > 0.001;
  });

  return (
    // Node first, then inclination — tilting about a rotated axis is what gives
    // each ring its own orientation instead of four parallel plates.
    <group rotation={[0, shell.node, 0]}>
      <group rotation={[shell.inclination, 0, 0]}>
        {/* The orbit itself, drawn faintly. Without it a chip crossing in front
            of the planet has nothing to say it is on a track. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={guideMaterial}>
          <ringGeometry args={[shell.radius - GUIDE_THICKNESS, shell.radius + GUIDE_THICKNESS, 128]} />
        </mesh>

        {/* The glow, hidden until selected. It is exactly coplanar with the guide
            line, so the draw order between the two would otherwise come down to
            however three happened to sort them; renderOrder pins the halo
            underneath, which is the way round the additive spill is meant to
            sit. Neither writes depth, so there is nothing to z-fight. */}
        <mesh
          ref={halo}
          rotation={[-Math.PI / 2, 0, 0]}
          material={haloMaterial}
          renderOrder={-1}
          visible={false}
        >
          <ringGeometry args={[shell.radius - HALO_THICKNESS, shell.radius + HALO_THICKNESS, 128]} />
        </mesh>

        <group ref={spin}>
          {shell.chips.map((chip, i) => {
            const angle = chipAngle(shell, i);
            const logo = logos[chip.logo];
            if (!logo) {
              throw new Error(`No logo registered for "${chip.logo}" — see worlds/techstack/logos.ts`);
            }
            return (
              <Chip
                key={chip.logo}
                logo={logo}
                position={[Math.cos(angle) * shell.radius, 0, Math.sin(angle) * shell.radius]}
                seed={index * 2.7 + i * 1.31}
                onHover={onHover}
              />
            );
          })}
        </group>
      </group>
    </group>
  );
}

interface ShellsProps {
  onHover: (label: string | null) => void;
  /** Index into SHELLS of the ring picked in the HUD legend, or null for none. */
  selectedShell: number | null;
}

/** All four shells of tech chips orbiting the main planet. */
export function Shells({ onHover, selectedShell }: ShellsProps) {
  return (
    <>
      {SHELLS.map((shell, i) => (
        <Shell
          key={shell.label}
          shell={shell}
          index={i}
          onHover={onHover}
          selected={selectedShell === i}
        />
      ))}
    </>
  );
}
