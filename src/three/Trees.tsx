import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createSwayToonMaterial, getSharedGradient } from "../utils/toon";
import { TREE_SPOTS, TREE_RADIUS, angleToPosition } from "./world";
import { Sign } from "./Sign";
import type { SeasonInfo } from "../utils/time";
import type { PanelId } from "../state/useStore";

interface TreeProps {
  id: PanelId;
  label: string;
  position: [number, number, number];
  seasonColor: string;
  leafDensity: number;
}

/** A Japanese maple: trunk + a small cluster of canopy blobs, sign mounted facing the plaza. */
function Tree({ id, label, position, seasonColor, leafDensity }: TreeProps) {
  const canopyMat = useMemo(
    () => createSwayToonMaterial(seasonColor, { swayStrength: 0.05, swayFreq: 0.5 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const trunkMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#4b3a2c", gradientMap: getSharedGradient() }),
    []
  );

  useEffect(() => {
    canopyMat.color.set(seasonColor);
  }, [canopyMat, seasonColor]);

  useFrame((state) => {
    const shader = canopyMat.userData.shader as { uniforms: Record<string, { value: unknown }> } | undefined;
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const blobs = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number }[] = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 0.9 + Math.random() * 0.3;
      arr.push({
        pos: [Math.cos(a) * r, 2.6 + Math.random() * 0.6, Math.sin(a) * r],
        scale: 0.9 + Math.random() * 0.5,
      });
    }
    arr.push({ pos: [0, 3.2, 0], scale: 1.3 });
    return arr;
  }, []);

  const [tx, , tz] = position;
  const toOrigin = useMemo(() => new THREE.Vector2(-tx, -tz).normalize(), [tx, tz]);
  const faceAngle = Math.atan2(toOrigin.x, toOrigin.y);
  const signPos: [number, number, number] = [toOrigin.x * 0.55, 1.4, toOrigin.y * 0.55];
  const canopyScale = 0.8 + leafDensity * 0.2;

  return (
    <group position={position}>
      <mesh material={trunkMat} position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 2.2, 8]} />
      </mesh>
      {leafDensity > 0.05 && (
        <group scale={canopyScale}>
          {blobs.map((b, i) => (
            <mesh key={i} material={canopyMat} position={b.pos} scale={b.scale} castShadow>
              <icosahedronGeometry args={[0.9, 1]} />
            </mesh>
          ))}
        </group>
      )}
      <Sign id={id} label={label} position={signPos} rotationY={faceAngle} />
    </group>
  );
}

export function Trees({ season }: { season: SeasonInfo }) {
  return (
    <>
      {TREE_SPOTS.map((spot) => (
        <Tree
          key={spot.id}
          id={spot.id}
          label={spot.label}
          position={angleToPosition(spot.angle, TREE_RADIUS)}
          seasonColor={season.leafColor}
          leafDensity={season.leafDensity}
        />
      ))}
    </>
  );
}
