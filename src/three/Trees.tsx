import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createSwayToonMaterial, getSharedGradient, setFlatShading } from "../utils/toon";
import { TREE_SPOTS, TREE_RADIUS, angleToPosition } from "./world";
import { Sign } from "./Sign";
import type { SeasonInfo } from "../utils/time";
import type { PanelId } from "../state/useStore";

const BRANCH_GEOMETRY = new THREE.CylinderGeometry(0.62, 1, 1, 6);
const LEAF_GEOMETRY = new THREE.IcosahedronGeometry(1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const TREE_SCALE = 1.3;

interface Segment {
  mid: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  radius: number;
}

interface LeafAnchor {
  pos: THREE.Vector3;
}

function alignedSegment(start: THREE.Vector3, end: THREE.Vector3, radius: number): Segment {
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = Math.max(dir.length(), 0.001);
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  return { mid, quaternion, length, radius };
}

function jitterDir(dir: THREE.Vector3, spread: number): THREE.Vector3 {
  return dir
    .clone()
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * spread)
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), (Math.random() - 0.5) * spread)
    .applyAxisAngle(UP, (Math.random() - 0.5) * spread)
    .normalize();
}

/** A small, gnarled trunk-and-branch skeleton, built once per tree instance. */
function buildSkeleton(): { segments: Segment[]; leaves: LeafAnchor[] } {
  const segments: Segment[] = [];
  const leaves: LeafAnchor[] = [];

  // Trunk: two chained, slightly bent segments.
  let pos = new THREE.Vector3(0, 0, 0);
  let dir = new THREE.Vector3(0, 1, 0);
  let radius = 0.2;
  for (let i = 0; i < 2; i++) {
    dir = jitterDir(dir, 0.5);
    const len = 0.6 + Math.random() * 0.3;
    const next = pos.clone().addScaledVector(dir, len);
    segments.push(alignedSegment(pos, next, radius));
    pos = next;
    radius *= 0.8;
  }

  // Primary limbs: several gnarled branches, each two chained (bent) segments.
  const primaryCount = 3 + Math.floor(Math.random() * 2);
  for (let p = 0; p < primaryCount; p++) {
    let bPos = pos.clone();
    let bDir = jitterDir(new THREE.Vector3(dir.x, dir.y + 0.4, dir.z).normalize(), 1.6);
    let bRadius = radius * (0.6 + Math.random() * 0.2);
    for (let s = 0; s < 2; s++) {
      bDir = jitterDir(bDir, 0.7);
      const len = 0.7 + Math.random() * 0.4;
      const next = bPos.clone().addScaledVector(bDir, len);
      segments.push(alignedSegment(bPos, next, bRadius));
      bPos = next;
      bRadius *= 0.75;
    }
    leaves.push({ pos: bPos.clone() });

    // Secondary twigs off this limb's tip.
    const twigCount = 1 + Math.floor(Math.random() * 2);
    for (let t = 0; t < twigCount; t++) {
      const tDir = jitterDir(bDir, 1.2);
      const len = 0.4 + Math.random() * 0.3;
      const tEnd = bPos.clone().addScaledVector(tDir, len);
      segments.push(alignedSegment(bPos, tEnd, bRadius * 0.7));
      leaves.push({ pos: tEnd.clone() });
    }
  }

  return { segments, leaves };
}

interface TreeProps {
  id: PanelId;
  label: string;
  position: [number, number, number];
  leafMaterials: THREE.MeshToonMaterial[];
  leafDensity: number;
}

/** A gnarled Japanese maple: branching trunk + scattered leaf clusters, sign facing the clearing. */
function Tree({ id, label, position, leafMaterials, leafDensity }: TreeProps) {
  const { segments, leaves } = useMemo(() => buildSkeleton(), []);

  const barkMaterial = useMemo(() => {
    const m = new THREE.MeshToonMaterial({ color: "#241a13", gradientMap: getSharedGradient() });
    setFlatShading(m);
    return m;
  }, []);

  const leafBlobs = useMemo(() => {
    if (leafDensity <= 0.05) return [];
    const blobs: { pos: [number, number, number]; scale: number; materialIndex: number }[] = [];
    for (const anchor of leaves) {
      // Thin the canopy out at low density (spring budding / late fall) instead
      // of just shrinking it, for a sparser, more textured in-between look.
      if (Math.random() > Math.max(leafDensity, 0.2)) continue;
      const blobCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < blobCount; i++) {
        blobs.push({
          pos: [
            anchor.pos.x + (Math.random() - 0.5) * 0.5,
            anchor.pos.y + (Math.random() - 0.5) * 0.5 + 0.15,
            anchor.pos.z + (Math.random() - 0.5) * 0.5,
          ],
          scale: 0.55 + Math.random() * 0.4,
          materialIndex: Math.floor(Math.random() * leafMaterials.length),
        });
      }
    }
    return blobs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, leafDensity, leafMaterials.length]);

  const [tx, , tz] = position;
  const toOrigin = useMemo(() => new THREE.Vector2(-tx, -tz).normalize(), [tx, tz]);
  const faceAngle = Math.atan2(toOrigin.x, toOrigin.y);
  const signPos: [number, number, number] = [toOrigin.x * 0.55, 1.4, toOrigin.y * 0.55];

  return (
    <group position={position}>
      <group scale={TREE_SCALE}>
        {segments.map((seg, i) => (
          <mesh
            key={i}
            geometry={BRANCH_GEOMETRY}
            material={barkMaterial}
            position={seg.mid}
            quaternion={seg.quaternion}
            scale={[seg.radius, seg.length, seg.radius]}
            castShadow
          />
        ))}
        {leafBlobs.map((b, i) => (
          <mesh
            key={i}
            geometry={LEAF_GEOMETRY}
            material={leafMaterials[b.materialIndex]}
            position={b.pos}
            scale={b.scale}
            castShadow
          />
        ))}
      </group>
      <Sign id={id} label={label} position={signPos} rotationY={faceAngle} />
    </group>
  );
}

export function Trees({ season }: { season: SeasonInfo }) {
  const leafMaterials = useMemo(
    () => season.leafPalette.map((c) => createSwayToonMaterial(c, { swayStrength: 0.05, swayFreq: 0.5 + Math.random() * 0.3 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [season.leafPalette.join(",")]
  );

  useFrame((state) => {
    for (const m of leafMaterials) {
      const shader = m.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
      if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <>
      {TREE_SPOTS.map((spot) => (
        <Tree
          key={spot.id}
          id={spot.id}
          label={spot.label}
          position={angleToPosition(spot.angle, TREE_RADIUS)}
          leafMaterials={leafMaterials}
          leafDensity={season.leafDensity}
        />
      ))}
    </>
  );
}
