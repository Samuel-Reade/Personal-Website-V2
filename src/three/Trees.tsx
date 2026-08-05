import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Instances, Instance, Outlines } from "@react-three/drei";
import * as THREE from "three";
import { createSwayToonMaterial, createRimToonMaterial } from "../utils/toon";
import { TREE_SPOTS, TREE_RADIUS, angleToPosition } from "./world";
import { Sign } from "./Sign";
import type { SeasonInfo } from "../utils/time";
import type { PanelId } from "../state/useStore";

// Kenney's Nature Kit (CC0) — https://kenney.nl/assets/nature-kit
// The model's own PBR materials are discarded in favor of our toon
// pipeline; we only use its geometry (split into a "leafsGreen" and a
// "woodBark" mesh, keyed by material name since all three of the pack's
// oak variants share one 324-vertex mesh and differ only in material color).
// Note: this model's UVs are placeholder/degenerate (the pack never used a
// texture map, only flat colors) — don't apply our procedural bark/leaf
// canvas textures to it, they'd sample garbage and wash out to gray.
useGLTF.preload("/models/tree_oak.glb");

const OUTLINE_COLOR = "#1c140d";
const OUTLINE_THICKNESS = 0.05;
const BASE_SCALE = 3.2;
/** Fixed distance from the trunk a sign is mounted at — independent of the tree's own visual scale. */
const SIGN_OFFSET = 0.55;

interface TreeLayout {
  id: PanelId;
  label: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
  signPos: [number, number, number];
  faceAngle: number;
}

/** Pulls the leaf/bark geometries out of the imported oak model by material name. */
function useOakGeometry() {
  const { scene } = useGLTF("/models/tree_oak.glb");
  return useMemo(() => {
    let leaf: THREE.BufferGeometry | null = null;
    let bark: THREE.BufferGeometry | null = null;
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as THREE.Material).name;
      if (name === "leafsGreen") leaf = mesh.geometry;
      else if (name === "woodBark") bark = mesh.geometry;
    });
    return { leaf, bark };
  }, [scene]);
}

/** Six oak trees ringing the field, each a GPU-instanced copy of one imported model. */
export function Trees({ season }: { season: SeasonInfo }) {
  const { leaf: leafGeometry, bark: barkGeometry } = useOakGeometry();

  const barkMaterial = useMemo(() => createRimToonMaterial("#5b4632", { strength: 0.3 }), []);
  // Base color is neutral white — each instance's actual color comes from
  // the `color` prop on <Instance>, multiplied in automatically by three's
  // instancing support.
  const leafMaterial = useMemo(
    () => createSwayToonMaterial("#ffffff", { swayStrength: 0.045, swayFreq: 0.6, rim: { strength: 0.22 } }),
    []
  );

  useFrame((state) => {
    const shader = leafMaterial.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const trees = useMemo<TreeLayout[]>(
    () =>
      TREE_SPOTS.map((spot) => {
        const position = angleToPosition(spot.angle, TREE_RADIUS);
        const [tx, , tz] = position;
        const toOrigin = new THREE.Vector2(-tx, -tz).normalize();
        return {
          id: spot.id,
          label: spot.label,
          position,
          rotationY: Math.random() * Math.PI * 2,
          scale: BASE_SCALE * (0.85 + Math.random() * 0.3),
          signPos: [tx + toOrigin.x * SIGN_OFFSET, 1.4, tz + toOrigin.y * SIGN_OFFSET],
          faceAngle: Math.atan2(toOrigin.x, toOrigin.y),
        };
      }),
    []
  );

  // Each tree's leaf tint is picked once from the season's palette — a
  // color-varied little grove rather than one flat tone — and re-picked
  // whenever the palette itself shifts (a new day).
  const leafColors = useMemo(
    () => trees.map(() => season.leafPalette[Math.floor(Math.random() * season.leafPalette.length)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [season.leafPalette.join(","), trees]
  );

  if (!leafGeometry || !barkGeometry) return null;

  const showLeaves = season.leafDensity > 0.05;

  return (
    <>
      <Instances geometry={barkGeometry} material={barkMaterial} limit={trees.length} castShadow>
        <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} angle={1} />
        {trees.map((t) => (
          <Instance key={t.id} position={t.position} rotation={[0, t.rotationY, 0]} scale={t.scale} />
        ))}
      </Instances>

      {showLeaves && (
        <Instances geometry={leafGeometry} material={leafMaterial} limit={trees.length} castShadow>
          <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} />
          {trees.map((t, i) => (
            <Instance
              key={t.id}
              position={t.position}
              rotation={[0, t.rotationY, 0]}
              scale={t.scale}
              color={leafColors[i]}
            />
          ))}
        </Instances>
      )}

      {trees.map((t) => (
        <Sign key={`sign-${t.id}`} id={t.id} label={t.label} position={t.signPos} rotationY={t.faceAngle} />
      ))}
    </>
  );
}
