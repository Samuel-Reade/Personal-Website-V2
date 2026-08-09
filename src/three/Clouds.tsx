import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { elevationFraction, getSunState } from "../utils/time";

/** A soft radial-gradient puff, generated on a canvas — no external texture fetch. */
function createPuffTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.65)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface Puff {
  offset: [number, number, number];
  scale: number;
}

interface Cluster {
  basePos: [number, number, number];
  puffs: Puff[];
  driftSpeed: number;
  driftPhase: number;
  material: THREE.SpriteMaterial;
}

/**
 * How much sky the cover fills, and where it sits.
 *
 * All of this was drawn much smaller and much further up before, which is why
 * the sky read as empty even though the clouds were mounted the whole time:
 * fourteen clusters of nine-unit puffs, scattered as high as eighty units and as
 * far out as a hundred and ninety, are a handful of pale smudges near the top of
 * frame that a bright sky swallows whole. Brought down and out, they cross the
 * part of the sky the camera actually looks at.
 */
const CLUSTER_COUNT = 24;
const DRIFT_RANGE = 260;
const MIN_DIST = 42;
const DIST_SPREAD = 120;
const MIN_HEIGHT = 30;
const HEIGHT_SPREAD = 30;
const MIN_PUFF = 13;
const PUFF_SPREAD = 13;

function buildClusters(texture: THREE.Texture): Cluster[] {
  const clusters: Cluster[] = [];
  for (let i = 0; i < CLUSTER_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = MIN_DIST + Math.random() * DIST_SPREAD;
    const height = MIN_HEIGHT + Math.random() * HEIGHT_SPREAD;
    const puffCount = 4 + Math.floor(Math.random() * 3);
    const puffs: Puff[] = [];
    for (let p = 0; p < puffCount; p++) {
      puffs.push({
        // Spread to match the larger puffs — kept at the old offsets they
        // overlapped into one lump rather than reading as a bank.
        offset: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 14],
        scale: MIN_PUFF + Math.random() * PUFF_SPREAD,
      });
    }
    clusters.push({
      basePos: [Math.sin(angle) * dist, height, Math.cos(angle) * dist],
      puffs,
      driftSpeed: 0.4 + Math.random() * 0.6,
      driftPhase: i * 37,
      material: new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: 0.6,
      }),
    });
  }
  return clusters;
}

/**
 * Cloud colour through the day. Hoisted out of the frame loop: these are four
 * fixed colours and a scratch to mix them into, and rebuilding all five every
 * frame in two mounted scenes is exactly the steady garbage `celestial.ts` calls
 * out for the body vectors.
 */
const DAY_TINT = new THREE.Color("#ffffff");
const EVENING_TINT = new THREE.Color("#f2c9a0");
const NIGHT_TINT = new THREE.Color("#3c4560");
const scratchTint = new THREE.Color();

/** Soft painterly cloud puffs drifting slowly overhead, tinted by time of day. */
export function Clouds() {
  const texture = useMemo(() => createPuffTexture(), []);
  const clusters = useMemo(() => buildClusters(texture), [texture]);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const sun = getSunState();
    const height = elevationFraction(sun.elevation);
    const dayStrength = THREE.MathUtils.clamp(height + 0.15, 0, 1);
    const eveningStrength = THREE.MathUtils.clamp(1 - Math.abs(height) * 2.2, 0, 1);

    const tint = scratchTint
      .copy(NIGHT_TINT)
      .lerp(DAY_TINT, dayStrength)
      .lerp(EVENING_TINT, eveningStrength * 0.5);

    clusters.forEach((cluster, i) => {
      const group = groupRefs.current[i];
      if (group) {
        const x = cluster.basePos[0] + (((t * cluster.driftSpeed * 3 + cluster.driftPhase) % DRIFT_RANGE) - DRIFT_RANGE / 2);
        group.position.set(x, cluster.basePos[1], cluster.basePos[2]);
      }
      cluster.material.color.copy(tint);
      // Denser than the old 0.3–0.8. White at two-thirds opacity against a pale
      // daylight sky is very close to not being there.
      cluster.material.opacity = THREE.MathUtils.lerp(0.35, 0.92, dayStrength);
    });
  });

  return (
    <>
      {clusters.map((cluster, i) => (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)} position={cluster.basePos}>
          {cluster.puffs.map((puff, p) => (
            <sprite key={p} material={cluster.material} position={puff.offset} scale={[puff.scale, puff.scale * 0.6, 1]} />
          ))}
        </group>
      ))}
    </>
  );
}
