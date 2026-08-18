import * as THREE from "three";

/**
 * The soft disc a lit chip's halo is drawn with: white at the centre falling
 * off to nothing at the edge, on a canvas, tinted by the sprite that uses it.
 *
 * A canvas rather than a shader for the same reason as everything else out here
 * — no assets, and a 128px radial gradient is all a glow needs. Shared by every
 * chip and built on first use, so the world pays for one texture, not thirty.
 */

const SIZE = 128;

let texture: THREE.CanvasTexture | null = null;

export function getGlowTexture(): THREE.CanvasTexture {
  if (texture) return texture;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  const half = SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  // Bright core, long soft tail: additive against black, the tail is what
  // reads as light spilling into space rather than a disc pasted behind the chip.
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.72)");
  gradient.addColorStop(0.62, "rgba(255,255,255,0.22)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Frees the shared texture. Called when the world unmounts. */
export function disposeGlowTexture(): void {
  texture?.dispose();
  texture = null;
}
