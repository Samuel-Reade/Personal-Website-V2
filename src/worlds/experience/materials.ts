import * as THREE from "three";

/**
 * Flat-shaded Lambert materials, cached by color. Lambert rather than Standard
 * because the look wants light to land in broad even washes — a roughness /
 * metalness response would put specular highlights on surfaces whose whole
 * point is to read as flat facets.
 *
 * `flatShading` is what produces the faceted look: it discards the smoothed
 * vertex normals three.js generates and lights each triangle by its own face
 * normal, so every facet stays a single solid tone.
 */
const cache = new Map<string, THREE.MeshLambertMaterial>();

export function flatMat(color: string): THREE.MeshLambertMaterial {
  let material = cache.get(color);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, flatShading: true });
    cache.set(color, material);
  }
  return material;
}

const emissiveCache = new Map<string, THREE.MeshLambertMaterial>();

/** Flat material that also emits — ceiling panels, screen glow, window light. */
export function glowMat(color: string, intensity = 1): THREE.MeshLambertMaterial {
  const key = `${color}:${intensity}`;
  let material = emissiveCache.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: intensity,
      flatShading: true,
    });
    emissiveCache.set(key, material);
  }
  return material;
}

/**
 * Deterministic pseudo-random in [0, 1). The office set dressing needs jitter
 * that survives re-renders — Math.random() would reshuffle every desk in the
 * room on each React commit.
 */
export function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Flat Lambert carrying one of the generated textures below, cached by key. */
const texturedCache = new Map<string, THREE.MeshLambertMaterial>();

export function texturedMat(key: string, map: THREE.Texture, tint = "#ffffff"): THREE.MeshLambertMaterial {
  let material = texturedCache.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color: tint, map, flatShading: true });
    texturedCache.set(key, material);
  }
  return material;
}

/**
 * A soft radial falloff: the pool of light under anything this room calls
 * interactive. A hard-edged disc reads as a decal lying on the desk; this reads
 * as light. It sits here rather than beside either consumer because there are
 * now two — the figurines light one on hover, and the desk mouse wears a dimmer
 * one all the time, so that the one control on the desk looks like a control.
 */
let halo: THREE.CanvasTexture | null = null;

export function haloTexture(): THREE.CanvasTexture {
  if (halo) return halo;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.28)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  halo = new THREE.CanvasTexture(canvas);
  return halo;
}

/* ---------------------------------------------------------------------------
   Generated surface textures.

   The room's big planes — carpet, ceiling, desk tops — used to be single flat
   colors, and at their size a flat color reads as a rendering rather than a
   material. Each generator below paints the surface's real construction onto a
   small canvas (carpet tiles, ceiling grid, wood grain) in tones a few percent
   apart, so the surfaces read as built from parts without breaking the
   pastel flat-shaded look. All cached: one canvas each for the room's life.
   ------------------------------------------------------------------------- */

const textureCache = new Map<string, THREE.CanvasTexture>();

function makeTexture(
  key: string,
  size: [number, number],
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  let texture = textureCache.get(key);
  if (texture) return texture;
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = size;
  paint(canvas.getContext("2d")!, canvas.width, canvas.height);
  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, texture);
  return texture;
}

/** Nudge a hex color's lightness by `amount` (-1..1), returning a CSS color. */
function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
  return `#${c.getHexString()}`;
}

/**
 * Carpet tiles: a 4x4 block of half-metre squares, each a couple of percent off
 * its neighbours with a fine speckle, seams a shade darker. The caller sets
 * `repeat` so a tile lands at 0.5 world units.
 */
export function carpetTexture(base: string): THREE.CanvasTexture {
  return makeTexture(`carpet:${base}`, [256, 256], (ctx, w, h) => {
    const tile = w / 4;
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const jitter = (seeded(tx * 7 + ty * 13) - 0.5) * 0.045;
        ctx.fillStyle = shade(base, jitter);
        ctx.fillRect(tx * tile, ty * tile, tile, tile);
        // Pile direction: alternate tiles carry a faint directional wash, the
        // checkerboard sheen real carpet tiles show.
        if ((tx + ty) % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.03)";
          ctx.fillRect(tx * tile, ty * tile, tile, tile);
        }
        for (let i = 0; i < 90; i++) {
          const sx = tx * tile + seeded(tx * 31 + ty * 17 + i * 3) * tile;
          const sy = ty * tile + seeded(tx * 11 + ty * 41 + i * 7) * tile;
          ctx.fillStyle =
            seeded(i * 13 + tx + ty) > 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.strokeRect(i * tile + 0.5, 0, 0.001, h);
      ctx.strokeRect(0, i * tile + 0.5, w, 0.001);
    }
  });
}

/** Suspended-ceiling grid: 2x2 tiles per canvas, recessed seams. */
export function ceilingTexture(base: string): THREE.CanvasTexture {
  return makeTexture(`ceiling:${base}`, [128, 128], (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const tile = w / 2;
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        ctx.fillStyle = shade(base, (seeded(tx * 3 + ty * 5) - 0.5) * 0.02);
        ctx.fillRect(tx * tile + 2, ty * tile + 2, tile - 4, tile - 4);
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tile, 0);
      ctx.lineTo(i * tile, h);
      ctx.moveTo(0, i * tile);
      ctx.lineTo(w, i * tile);
      ctx.stroke();
    }
  });
}

/** Desk-top wood: long soft grain streaks with a plank seam, kept low-contrast. */
export function woodTexture(base: string): THREE.CanvasTexture {
  return makeTexture(`wood:${base}`, [256, 128], (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const y = seeded(i * 5 + 1) * h;
      const length = 40 + seeded(i * 9 + 2) * 160;
      const x = seeded(i * 3 + 4) * w;
      ctx.strokeStyle =
        seeded(i * 7) > 0.5 ? "rgba(90, 62, 30, 0.07)" : "rgba(255, 240, 214, 0.08)";
      ctx.lineWidth = 1 + seeded(i * 11) * 1.6;
      ctx.beginPath();
      ctx.moveTo(x - length / 2, y);
      // A slow bow rather than a straight rule, so the grain reads as grown.
      ctx.quadraticCurveTo(x, y + (seeded(i * 13) - 0.5) * 7, x + length / 2, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(70, 48, 24, 0.16)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  });
}

/**
 * A soft dark ellipse for under furniture and people. This world has no shadow
 * maps by design, and without any grounding everything floats a hair above the
 * carpet; a faded contact patch is the flat-shaded stand-in for occlusion.
 */
export function contactShadowTexture(): THREE.CanvasTexture {
  return makeTexture("contact-shadow", [128, 128], (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, "rgba(60, 50, 38, 0.42)");
    gradient.addColorStop(0.55, "rgba(60, 50, 38, 0.2)");
    gradient.addColorStop(1, "rgba(60, 50, 38, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Faintly ruled paper for loose sheets — reads as printed without being legible. */
export function paperTexture(base: string): THREE.CanvasTexture {
  return makeTexture(`paper:${base}`, [64, 96], (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(70, 80, 100, 0.22)";
    ctx.lineWidth = 1.5;
    for (let y = 14; y < h - 8; y += 9) {
      ctx.beginPath();
      ctx.moveTo(9, y);
      // Ragged right edges, the shape of set type rather than a striped box.
      ctx.lineTo(w - 9 - seeded(y) * 22, y);
      ctx.stroke();
    }
  });
}
