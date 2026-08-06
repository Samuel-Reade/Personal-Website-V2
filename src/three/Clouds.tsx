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

const CLUSTER_COUNT = 14;
const DRIFT_RANGE = 260;

function buildClusters(texture: THREE.Texture): Cluster[] {
  const clusters: Cluster[] = [];
  for (let i = 0; i < CLUSTER_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 140;
    const height = 45 + Math.random() * 35;
    const puffCount = 4 + Math.floor(Math.random() * 3);
    const puffs: Puff[] = [];
    for (let p = 0; p < puffCount; p++) {
      puffs.push({
        offset: [(Math.random() - 0.5) * 22, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 10],
        scale: 9 + Math.random() * 10,
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

    const dayColor = new THREE.Color("#ffffff");
    const eveColor = new THREE.Color("#f2c9a0");
    const nightColor = new THREE.Color("#3c4560");
    const tint = nightColor.clone().lerp(dayColor, dayStrength).lerp(eveColor, eveningStrength * 0.5);

    clusters.forEach((cluster, i) => {
      const group = groupRefs.current[i];
      if (group) {
        const x = cluster.basePos[0] + (((t * cluster.driftSpeed * 3 + cluster.driftPhase) % DRIFT_RANGE) - DRIFT_RANGE / 2);
        group.position.set(x, cluster.basePos[1], cluster.basePos[2]);
      }
      cluster.material.color.copy(tint);
      cluster.material.opacity = THREE.MathUtils.lerp(0.3, 0.8, dayStrength);
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
