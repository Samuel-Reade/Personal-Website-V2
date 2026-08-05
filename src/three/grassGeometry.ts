import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A small clump of a few crossed blades, used as instanced grass geometry.
 * `heightScale` lets shorter, trampled-down grass (path/plaza) reuse the
 * exact same blade shape as the tall field grass.
 */
export function buildClumpGeometry(heightScale = 1): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const bladeCount = 3;
  for (let i = 0; i < bladeCount; i++) {
    const height = (0.42 + Math.random() * 0.16) * heightScale;
    const width = 0.05;
    const blade = new THREE.PlaneGeometry(width, height, 1, 3);
    blade.translate(0, height / 2, 0);
    const pos = blade.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v);
      const t = y / height;
      pos.setX(v, pos.getX(v) + t * t * 0.06 * heightScale);
    }
    blade.computeVertexNormals();
    blade.rotateY((i / bladeCount) * Math.PI + Math.random() * 0.3);
    blades.push(blade);
  }
  return mergeGeometries(blades);
}
