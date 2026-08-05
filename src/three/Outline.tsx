import * as THREE from "three";

let outlineMaterial: THREE.MeshBasicMaterial | null = null;

/**
 * Shared material for the inverted-hull outline technique: render a
 * BackSide, slightly-enlarged, unlit dark copy of a mesh behind the mesh
 * itself. Only the enlarged shell's back faces poke out past the original
 * silhouette, reading as a subtle dark outline.
 */
export function getOutlineMaterial(): THREE.MeshBasicMaterial {
  if (!outlineMaterial) {
    outlineMaterial = new THREE.MeshBasicMaterial({ color: "#15100b", side: THREE.BackSide });
  }
  return outlineMaterial;
}
