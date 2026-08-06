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

/**
 * As imported, the oak's canopy is 0.73 of a 1.23-unit tree — 59% of the
 * height — and it is slightly taller than it is wide. Spreading it outward and
 * stretching it up puts the canopy at ~65% of the tree and makes it read as
 * round rather than upright, so it owns the silhouette.
 */
const CANOPY_SPREAD = 1.45;
const CANOPY_RISE = 1.28;

/**
 * Minimum distance any bark vertex may sit from the trunk axis, in model
 * units. The imported trunk is a ~0.07-radius stick tapering to 0.05 at the
 * branch tips; flooring the radius thickens it and flattens that taper in one
 * pass, while leaving the wider root flare at the base as it is. Sized so the
 * visible trunk stays within the 0.55 collision circle in world.ts.
 */
const TRUNK_MIN_RADIUS = 0.15;

/**
 * The canopy is drawn as a few overlapping copies of the same rounded blob,
 * which is what turns one smooth mass into a lumpy cluster. Offsets are in
 * model units and are multiplied by each tree's own scale; because the canopy
 * geometry is re-origined at its center, a puff's scale grows it in place
 * instead of sliding it down the trunk.
 */
const CANOPY_PUFFS: { offset: [number, number, number]; scale: number; rotationY: number }[] = [
  { offset: [0, 0, 0], scale: 1, rotationY: 0 },
  { offset: [0.31, -0.14, 0.15], scale: 0.7, rotationY: 2.1 },
  { offset: [-0.28, -0.06, -0.19], scale: 0.64, rotationY: 4.3 },
];

interface TreeLayout {
  id: PanelId;
  label: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
  signPos: [number, number, number];
  faceAngle: number;
}

/**
 * Y-range of the vertices a geometry actually indexes. The oak's leaf and bark
 * primitives share one position buffer covering the whole tree, so
 * computeBoundingBox() reports the trunk's base as the canopy's base too.
 */
function indexedRangeY(geometry: THREE.BufferGeometry): { min: number; max: number } {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = position.getY(index ? index.getX(i) : i);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return { min, max };
}

/**
 * Spreads and stretches the canopy, keeps its underside sitting on the trunk,
 * then re-origins it at its own center so each puff scales in place.
 * Returns the center height so callers can place the puffs back up the trunk.
 */
function puffCanopy(source: THREE.BufferGeometry): { geometry: THREE.BufferGeometry; centerY: number } {
  const geometry = source.clone();
  const { min, max } = indexedRangeY(geometry);

  geometry.scale(CANOPY_SPREAD, CANOPY_RISE, CANOPY_SPREAD);
  // The vertical stretch lifts the canopy's underside off the trunk; `lift`
  // puts it back.
  const lift = min - min * CANOPY_RISE;
  const centerY = (min * CANOPY_RISE + max * CANOPY_RISE) / 2 + lift;
  geometry.translate(0, lift - centerY, 0);

  return { geometry, centerY };
}

/** Thickens the trunk and flattens its taper by flooring every vertex's distance from the axis. */
function thickenTrunk(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.clone();
  const position = geometry.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, z);
    if (radius > 0.0001 && radius < TRUNK_MIN_RADIUS) {
      const push = TRUNK_MIN_RADIUS / radius;
      position.setX(i, x * push);
      position.setZ(i, z * push);
    }
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Pulls the leaf/bark geometries out of the imported oak model by material name, restyled. */
function useOakGeometry() {
  const { scene } = useGLTF("/models/tree_oak.glb");
  return useMemo(() => {
    const parts = new Map<string, THREE.BufferGeometry>();
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      parts.set((mesh.material as THREE.Material).name, mesh.geometry);
    });

    const leafSource = parts.get("leafsGreen");
    const barkSource = parts.get("woodBark");
    const canopy = leafSource ? puffCanopy(leafSource) : null;
    return {
      leaf: canopy?.geometry ?? null,
      leafCenterY: canopy?.centerY ?? 0,
      bark: barkSource ? thickenTrunk(barkSource) : null,
    };
  }, [scene]);
}

/** Six oak trees ringing the field, each a GPU-instanced copy of one imported model. */
export function Trees({ season }: { season: SeasonInfo }) {
  const { leaf: leafGeometry, leafCenterY, bark: barkGeometry } = useOakGeometry();

  // Rim strengths here are lower than they were before the trunk was thickened
  // and the canopy spread. The rim is a per-fragment Fresnel term, so on a
  // low-poly shape each facet takes a near-constant amount of it — enlarging
  // these surfaces turned "glow on the silhouette" into whole facets washing
  // out to the rim's cream tint (the same failure documented in utils/toon.ts).
  const barkMaterial = useMemo(() => createRimToonMaterial("#5b4632", { strength: 0.12 }), []);
  // Base color is neutral white — each instance's actual color comes from
  // the `color` prop on <Instance>, multiplied in automatically by three's
  // instancing support.
  const leafMaterial = useMemo(() => {
    const material = createSwayToonMaterial("#ffffff", {
      swayStrength: 0.045,
      swayFreq: 0.6,
      rim: { strength: 0.1 },
    });
    // The imported canopy is an open shell, so with backfaces culled you see
    // straight through its underside to the sky. Barely noticeable at the
    // model's original size; a hole once the canopy is spread this wide.
    material.side = THREE.DoubleSide;
    return material;
  }, []);

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
        <Instances
          geometry={leafGeometry}
          material={leafMaterial}
          limit={trees.length * CANOPY_PUFFS.length}
          castShadow
        >
          <Outlines color={OUTLINE_COLOR} thickness={OUTLINE_THICKNESS} />
          {trees.map((t, i) =>
            CANOPY_PUFFS.map((puff, p) => (
              <Instance
                key={`${t.id}-${p}`}
                position={[
                  t.position[0] + puff.offset[0] * t.scale,
                  t.position[1] + (leafCenterY + puff.offset[1]) * t.scale,
                  t.position[2] + puff.offset[2] * t.scale,
                ]}
                rotation={[0, t.rotationY + puff.rotationY, 0]}
                scale={t.scale * puff.scale}
                color={leafColors[i]}
              />
            ))
          )}
        </Instances>
      )}

      {trees.map((t) => (
        <Sign key={`sign-${t.id}`} id={t.id} label={t.label} position={t.signPos} rotationY={t.faceAngle} />
      ))}
    </>
  );
}
