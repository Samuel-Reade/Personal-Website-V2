import { useMemo } from "react";
import * as THREE from "three";
import { getSharedGradient, setFlatShading } from "../utils/toon";

interface RingConfig {
  radius: number;
  jitter: number;
  count: number;
  heightRange: [number, number];
  radiusRange: [number, number];
  color: string;
}

// Two layered ridgelines: a nearer, greener one and a farther, hazier one —
// the same layered-depth trick behind the "huge open space" look of the
// reference art, sold mostly by the scene fog fading the far ring out.
const RINGS: RingConfig[] = [
  { radius: 130, jitter: 14, count: 34, heightRange: [26, 46], radiusRange: [16, 30], color: "#5f6f57" },
  { radius: 185, jitter: 18, count: 40, heightRange: [34, 62], radiusRange: [22, 42], color: "#8fa0ac" },
];

function MountainRing({ config }: { config: RingConfig }) {
  const material = useMemo(() => {
    const m = new THREE.MeshToonMaterial({ color: config.color, gradientMap: getSharedGradient(), fog: true });
    setFlatShading(m);
    return m;
  }, [config.color]);
  const geometry = useMemo(() => new THREE.ConeGeometry(1, 1, 6), []);

  const instances = useMemo(() => {
    const arr: { position: [number, number, number]; radiusXZ: number; height: number; rotation: number }[] = [];
    for (let i = 0; i < config.count; i++) {
      const angle = (i / config.count) * Math.PI * 2 + (Math.random() - 0.5) * ((Math.PI * 2) / config.count) * 0.7;
      const r = config.radius + (Math.random() - 0.5) * config.jitter;
      const h = THREE.MathUtils.lerp(config.heightRange[0], config.heightRange[1], Math.random());
      const rad = THREE.MathUtils.lerp(config.radiusRange[0], config.radiusRange[1], Math.random());
      arr.push({
        position: [Math.sin(angle) * r, h / 2 - 1.5, Math.cos(angle) * r],
        radiusXZ: rad,
        height: h,
        rotation: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [config]);

  return (
    <>
      {instances.map((inst, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={material}
          position={inst.position}
          rotation={[0, inst.rotation, 0]}
          scale={[inst.radiusXZ, inst.height, inst.radiusXZ]}
          raycast={() => null}
        />
      ))}
    </>
  );
}

/** Low-poly, hazy mountain silhouettes ringing the horizon for a sense of huge open space. */
export function Mountains() {
  return (
    <>
      {RINGS.map((ring, i) => (
        <MountainRing key={i} config={ring} />
      ))}
    </>
  );
}
