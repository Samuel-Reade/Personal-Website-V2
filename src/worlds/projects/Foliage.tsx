import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import type { ScatterKind } from "./islandGeometry";

/**
 * Small vegetation scattered over the island slopes. All three are a handful of
 * primitives each — they exist in the dozens per island, so the budget per prop
 * is tiny, and at the distance the boat sits from them only the silhouette reads
 * anyway.
 */

function Palm() {
  // Fronds are cones laid almost flat and splayed around the crown; a cone tilted
  // past horizontal reads as a drooping leaf, which is the whole palm silhouette.
  const fronds = [0, 1, 2, 3, 4, 5];
  return (
    <group>
      <mesh material={flatMat(PALETTE.palmTrunk)} position={[0.06, 0.62, 0]} rotation={[0, 0, -0.12]}>
        <cylinderGeometry args={[0.045, 0.075, 1.25, 5]} />
      </mesh>
      <group position={[0.14, 1.24, 0]}>
        {fronds.map((i) => {
          const angle = (i / fronds.length) * Math.PI * 2;
          return (
            <mesh
              key={i}
              material={flatMat(i % 2 === 0 ? PALETTE.palmFrond : PALETTE.palmFrondDark)}
              position={[Math.cos(angle) * 0.3, -0.04, Math.sin(angle) * 0.3]}
              rotation={[Math.PI / 2 - 0.32, 0, -angle]}
            >
              <coneGeometry args={[0.14, 0.72, 4]} />
            </mesh>
          );
        })}
        <mesh material={flatMat(PALETTE.palmTrunk)}>
          <icosahedronGeometry args={[0.09, 0]} />
        </mesh>
      </group>
    </group>
  );
}

function Bush() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.bush)} position={[0, 0.22, 0]} scale={[1.2, 0.9, 1.1]}>
        <icosahedronGeometry args={[0.28, 0]} />
      </mesh>
      <mesh material={flatMat(PALETTE.bushDark)} position={[0.2, 0.14, 0.12]}>
        <icosahedronGeometry args={[0.18, 0]} />
      </mesh>
      <mesh material={flatMat(PALETTE.bushDark)} position={[-0.17, 0.13, -0.1]}>
        <icosahedronGeometry args={[0.15, 0]} />
      </mesh>
    </group>
  );
}

function Tuft() {
  const blades: [number, number, number][] = [
    [0, 0, 0],
    [0.09, 0.4, 0.05],
    [-0.08, -0.35, 0.04],
    [0.03, 0.15, -0.09],
  ];
  return (
    <group>
      {blades.map(([x, tilt, z], i) => (
        <mesh
          key={i}
          material={flatMat(i % 2 === 0 ? PALETTE.tuft : PALETTE.bush)}
          position={[x, 0.13, z]}
          rotation={[0, i * 1.2, tilt]}
        >
          <coneGeometry args={[0.06, 0.28, 4]} />
        </mesh>
      ))}
    </group>
  );
}

export function ScatterProp({ kind }: { kind: ScatterKind }) {
  switch (kind) {
    case "palm":
      return <Palm />;
    case "bush":
      return <Bush />;
    case "tuft":
      return <Tuft />;
  }
}
