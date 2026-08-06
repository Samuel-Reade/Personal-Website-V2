import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Chip } from "./Chip";
import { getLogos } from "./logos";
import { SHELLS, chipAngle, type ShellSpec } from "./layout";

/** Opacity of the faint guide ring drawn along each shell's orbit. */
const GUIDE_OPACITY = 0.13;
const GUIDE_THICKNESS = 0.035;

interface ShellProps {
  shell: ShellSpec;
  index: number;
  onHover: (label: string | null) => void;
}

/**
 * One orbital shell: a tilted ring of chips turning about the planet.
 *
 * The rotation lives on the group rather than on each chip, so a shell turns as
 * one rigid ring — chips animating their own orbital angle would drift out of
 * formation under variable frame times, and the ring would slowly smear.
 */
function Shell({ shell, index, onHover }: ShellProps) {
  const spin = useRef<THREE.Group>(null!);
  const logos = getLogos();

  const guideMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#b9a6ff",
        transparent: true,
        opacity: GUIDE_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useFrame((state) => {
    if (spin.current) {
      // Driven from absolute elapsed time rather than accumulated deltas, so a
      // dropped frame shifts nothing permanently.
      spin.current.rotation.y = shell.phase + state.clock.elapsedTime * shell.speed;
    }
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
                group={chip.group}
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

/** All four shells of tech chips orbiting the main planet. */
export function Shells({ onHover }: { onHover: (label: string | null) => void }) {
  return (
    <>
      {SHELLS.map((shell, i) => (
        <Shell key={shell.label} shell={shell} index={i} onHover={onHover} />
      ))}
    </>
  );
}
