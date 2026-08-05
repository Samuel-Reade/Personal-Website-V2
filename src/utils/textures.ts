import * as THREE from "three";

/**
 * Procedural, self-contained (no external image fetch) surface textures —
 * generated once on a canvas and shared across every material that uses them.
 */

let barkTexture: THREE.CanvasTexture | null = null;

/** Streaky, noisy wood-grain bark, tileable along a branch's length. */
export function getBarkTexture(): THREE.CanvasTexture {
  if (barkTexture) return barkTexture;

  const w = 128;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // A bright, roughly neutral base so this multiplies against the bark
  // material's actual (dark) color as a lightness/grain modulator, rather
  // than compounding two dark colors into flat black.
  ctx.fillStyle = "#b8b0a6";
  ctx.fillRect(0, 0, w, h);

  // Vertical grain streaks, each wandering slightly as it runs the height of the canvas.
  const streakCount = 55;
  for (let i = 0; i < streakCount; i++) {
    const lighter = Math.random() > 0.45;
    const alpha = 0.12 + Math.random() * 0.28;
    const v = lighter ? 205 + Math.random() * 45 : 35 + Math.random() * 45;
    ctx.strokeStyle = `rgba(${v}, ${v}, ${v}, ${alpha})`;
    ctx.lineWidth = 0.8 + Math.random() * 2.2;
    ctx.beginPath();
    let x = Math.random() * w;
    ctx.moveTo(x, 0);
    for (let y = 0; y <= h; y += 14) {
      x += (Math.random() - 0.5) * 9;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // A handful of horizontal "knot band" scars for extra gnarl.
  for (let i = 0; i < 5; i++) {
    const y = Math.random() * h;
    ctx.strokeStyle = `rgba(30, 30, 30, ${0.15 + Math.random() * 0.15})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) {
      ctx.lineTo(x, y + (Math.random() - 0.5) * 10);
    }
    ctx.stroke();
  }

  // Fine speckle noise so it doesn't read as a clean vector drawing.
  const imgData = ctx.getImageData(0, 0, w, h);
  for (let p = 0; p < imgData.data.length; p += 4) {
    const n = (Math.random() - 0.5) * 24;
    imgData.data[p] = Math.max(0, Math.min(255, imgData.data[p] + n));
    imgData.data[p + 1] = Math.max(0, Math.min(255, imgData.data[p + 1] + n));
    imgData.data[p + 2] = Math.max(0, Math.min(255, imgData.data[p + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  texture.needsUpdate = true;
  barkTexture = texture;
  return texture;
}

let leafTexture: THREE.CanvasTexture | null = null;

/**
 * A mottled, blotchy grayscale texture centered around a bright mid-tone —
 * multiplies against a leaf material's flat palette color to break it up
 * into a hand-painted, textured surface instead of a solid blob.
 */
export function getLeafTexture(): THREE.CanvasTexture {
  if (leafTexture) return leafTexture;

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, size, size);

  const blobCount = 70;
  for (let i = 0; i < blobCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2.5 + Math.random() * 7;
    const dark = Math.random() > 0.5;
    const v = Math.round(dark ? 90 + Math.random() * 50 : 210 + Math.random() * 45);
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, ${0.2 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  leafTexture = texture;
  return texture;
}
