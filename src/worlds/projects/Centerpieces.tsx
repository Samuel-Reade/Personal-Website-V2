import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat, flatMatUnique, seeded } from "./materials";
import type { CenterpieceId } from "./layout";

/**
 * One large themed object per island, built from primitives with deliberately
 * low segment counts — cylinders at 5-8 sides, cones at 5-6 — so the facets stay
 * visible at the distance the boat sits from them.
 *
 * Everything here is modelled standing on y = 0 and is placed on its island's
 * plateau by `Island`, so each piece can be reasoned about on its own.
 */

/** Smoke puffs rising from the factory's stacks. */
const PUFFS_PER_STACK = 5;
const PUFF_RISE = 3.4;
const PUFF_LIFETIME = 4.2;

interface Puff {
  /** Seconds since this puff left the stack; wraps at PUFF_LIFETIME. */
  age: number;
  stack: number;
  drift: number;
  spin: number;
}

/**
 * Rolled-formed aluminum durability — a small works with two stacks, smoking.
 *
 * The puffs are a fixed pool cycled on a phase offset rather than spawned and
 * destroyed: the stream is continuous and never needs to react to anything, so
 * allocating for it would be pure churn.
 */
function Factory({ stackTops }: { stackTops: [number, number, number][] }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  const puffs = useMemo<Puff[]>(() => {
    const out: Puff[] = [];
    for (let s = 0; s < stackTops.length; s++) {
      for (let i = 0; i < PUFFS_PER_STACK; i++) {
        out.push({
          // Evenly spread through the cycle so the stream is continuous from
          // the first frame rather than puffing all at once.
          age: (i / PUFFS_PER_STACK) * PUFF_LIFETIME,
          stack: s,
          drift: (seeded(s * 31 + i * 7) - 0.5) * 1.5,
          spin: seeded(s * 53 + i * 11) * Math.PI,
        });
      }
    }
    return out;
  }, [stackTops.length]);

  const materials = useMemo(
    () => puffs.map(() => flatMatUnique(PALETTE.smoke, { transparent: true, opacity: 0 })),
    [puffs]
  );
  useEffect(() => {
    return () => {
      for (const material of materials) material.dispose();
    };
  }, [materials]);

  useFrame((_state, delta) => {
    for (let i = 0; i < puffs.length; i++) {
      const puff = puffs[i];
      const mesh = meshes.current[i];
      if (!mesh) continue;

      puff.age = (puff.age + delta) % PUFF_LIFETIME;
      const t = puff.age / PUFF_LIFETIME;
      const [sx, sy, sz] = stackTops[puff.stack];

      mesh.position.set(sx + puff.drift * t, sy + 0.2 + t * PUFF_RISE, sz + puff.drift * 0.4 * t);
      mesh.scale.setScalar(0.22 + t * 0.55);
      mesh.rotation.y = puff.spin + t * 0.9;
      // Fades in off the stack lip and out at the top, so neither end pops.
      materials[i].opacity = Math.min(t * 6, 1) * (1 - t) * 0.75;
    }
  });

  return (
    <group>
      {/* Main shed */}
      <mesh material={flatMat(PALETTE.factoryWall)} position={[0, 0.75, 0]}>
        <boxGeometry args={[2.5, 1.5, 1.7]} />
      </mesh>
      <mesh material={flatMat(PALETTE.factoryRoof)} position={[0, 1.55, 0]}>
        <boxGeometry args={[2.62, 0.12, 1.82]} />
      </mesh>
      {/* Lower annex, so the silhouette steps rather than reading as one slab */}
      <mesh material={flatMat(PALETTE.factoryWall)} position={[1.72, 0.45, 0.2]}>
        <boxGeometry args={[1.0, 0.9, 1.2]} />
      </mesh>
      <mesh material={flatMat(PALETTE.factoryRoof)} position={[1.72, 0.95, 0.2]}>
        <boxGeometry args={[1.1, 0.1, 1.3]} />
      </mesh>

      {[-0.8, 0, 0.8].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.factoryWindow)} position={[x, 0.85, 0.86]}>
          <boxGeometry args={[0.5, 0.42, 0.04]} />
        </mesh>
      ))}

      {stackTops.map(([x, y, z], i) => (
        <group key={i}>
          <mesh material={flatMat(PALETTE.stack)} position={[x, y / 2, z]}>
            <cylinderGeometry args={[0.17, 0.21, y, 7]} />
          </mesh>
          <mesh material={flatMat(PALETTE.stackBand)} position={[x, y - 0.22, z]}>
            <cylinderGeometry args={[0.19, 0.19, 0.14, 7]} />
          </mesh>
        </group>
      ))}

      {puffs.map((_, i) => (
        <mesh key={i} ref={(el) => (meshes.current[i] = el)} material={materials[i]}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** ASA DataFest — a bar chart big enough to be architecture. */
function BarChart() {
  const bars: { height: number; color: string }[] = [
    { height: 0.9, color: PALETTE.chartBarA },
    { height: 1.55, color: PALETTE.chartBarB },
    { height: 1.15, color: PALETTE.chartBarC },
    { height: 2.25, color: PALETTE.chartBarD },
    { height: 1.8, color: PALETTE.chartBarA },
    { height: 2.6, color: PALETTE.chartBarB },
  ];
  const spacing = 0.52;
  const offset = ((bars.length - 1) * spacing) / 2;

  return (
    <group>
      <mesh material={flatMat(PALETTE.chartBase)} position={[0, 0.09, 0]}>
        <boxGeometry args={[3.5, 0.18, 1.4]} />
      </mesh>
      {bars.map((bar, i) => (
        <mesh
          key={i}
          material={flatMat(bar.color)}
          position={[i * spacing - offset, 0.18 + bar.height / 2, 0]}
        >
          <boxGeometry args={[0.38, bar.height, 0.52]} />
        </mesh>
      ))}
      {/* A back plate reads as the chart's axis wall and stops the bars from
          floating against open sky from behind. */}
      <mesh material={flatMat(PALETTE.chartBase)} position={[0, 1.45, -0.36]}>
        <boxGeometry args={[3.5, 2.7, 0.1]} />
      </mesh>
    </group>
  );
}

/** COVID-19 misinformation — a phone showing a flagged-content mark. */
function Phone() {
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
      {/* Earpiece slot, so the top of the slab reads as the top of a phone */}
      <mesh material={flatMat(PALETTE.phoneBezel)} position={[0, 3.28, 0.13]}>
        <boxGeometry args={[0.34, 0.06, 0.03]} />
      </mesh>

      {/* The blocked mark: a ring with a bar struck through it. Low tubular
          segments keep it faceted like everything else. */}
      <mesh material={flatMat(PALETTE.flagRed)} position={[0, 1.9, 0.17]}>
        <torusGeometry args={[0.44, 0.1, 5, 14]} />
      </mesh>
      <mesh material={flatMat(PALETTE.flagRed)} position={[0, 1.9, 0.19]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.88, 0.19, 0.08]} />
      </mesh>
    </group>
  );
}

/** Exercise & cortisol — a bench press, mid-set. */
function BenchPress() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.benchPad)} position={[0, 0.68, 0.1]}>
        <boxGeometry args={[0.52, 0.16, 2.1]} />
      </mesh>
      {[-0.85, 0.85].map((z, i) => (
        <mesh key={i} material={flatMat(PALETTE.benchFrame)} position={[0, 0.3, z + 0.1]}>
          <boxGeometry args={[0.42, 0.6, 0.12]} />
        </mesh>
      ))}
      <mesh material={flatMat(PALETTE.benchFrame)} position={[0, 0.06, 0.1]}>
        <boxGeometry args={[0.5, 0.12, 2.0]} />
      </mesh>

      {/* Uprights holding the bar over the head end */}
      {[-0.46, 0.46].map((x, i) => (
        <mesh key={i} material={flatMat(PALETTE.benchFrame)} position={[x, 0.7, -0.82]}>
          <boxGeometry args={[0.12, 1.4, 0.12]} />
        </mesh>
      ))}

      <group position={[0, 1.42, -0.82]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={flatMat(PALETTE.barbell)}>
          <cylinderGeometry args={[0.055, 0.055, 2.9, 6]} />
        </mesh>
        {[-1.15, -0.95, 0.95, 1.15].map((y, i) => (
          <mesh key={i} material={flatMat(PALETTE.plate)} position={[0, y, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.11, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Netflix success — a big set, screen forward. */
function Television() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.tvTrim)} position={[0, 0.22, 0]}>
        <boxGeometry args={[1.5, 0.44, 1.0]} />
      </mesh>
      <mesh material={flatMat(PALETTE.tvBody)} position={[0, 1.45, 0]}>
        <boxGeometry args={[2.7, 2.0, 1.5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.tvScreen)} position={[0, 1.5, 0.77]}>
        <boxGeometry args={[2.1, 1.5, 0.06]} />
      </mesh>
      {/* Control panel down the side of the cabinet */}
      {[1.75, 1.5].map((y, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.tvKnob)}
          position={[1.15, y, 0.77]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.11, 0.11, 0.07, 6]} />
        </mesh>
      ))}
      {/* Rabbit-ear antennae — the fastest way to read "television" in silhouette */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={flatMat(PALETTE.tvTrim)}
          position={[side * 0.42, 3.05, -0.2]}
          rotation={[0.12, 0, side * 0.42]}
        >
          <cylinderGeometry args={[0.032, 0.045, 1.5, 5]} />
        </mesh>
      ))}
    </group>
  );
}

/** Voting — a ballot box with a paper going in. */
function BallotBox() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.ballotLid)} position={[0, 0.12, 0]}>
        <boxGeometry args={[2.0, 0.24, 1.7]} />
      </mesh>
      <mesh material={flatMat(PALETTE.ballotBox)} position={[0, 1.0, 0]}>
        <boxGeometry args={[1.75, 1.6, 1.5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.ballotLid)} position={[0, 1.88, 0]}>
        <boxGeometry args={[1.9, 0.18, 1.62]} />
      </mesh>
      <mesh material={flatMat(PALETTE.ballotSlot)} position={[0, 1.98, 0]}>
        <boxGeometry args={[0.9, 0.06, 0.16]} />
      </mesh>
      {/* A ballot half-posted, so the box reads as in use rather than as a crate */}
      <mesh material={flatMat(PALETTE.ballotPaper)} position={[0.06, 2.14, 0.02]} rotation={[0.16, 0.1, 0.08]}>
        <boxGeometry args={[0.7, 0.5, 0.03]} />
      </mesh>
    </group>
  );
}

const FACTORY_STACKS: [number, number, number][] = [
  [-0.72, 2.5, -0.5],
  [0.12, 2.05, -0.55],
];

/** Picks the themed object for an island. */
export function Centerpiece({ id }: { id: CenterpieceId }) {
  switch (id) {
    case "factory":
      return <Factory stackTops={FACTORY_STACKS} />;
    case "barchart":
      return <BarChart />;
    case "phone":
      return <Phone />;
    case "bench":
      return <BenchPress />;
    case "television":
      return <Television />;
    case "ballot":
      return <BallotBox />;
  }
}
