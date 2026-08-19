import * as THREE from "three";
import { HEAD_RADIUS } from "./figure";

/**
 * The walker's hair.
 *
 * It used to be a skullcap: the top half of a sphere a hair's breadth proud of
 * the crown, one flat colour, ending on a clean circle just below the equator
 * — which is to say a bowl, or a helmet. This is a haircut instead. It is
 * built the way the rest of him is built, from a low-resolution surface whose
 * facets are the drawing, so it stays his; the realism is in three things a
 * bowl doesn't have:
 *
 * - a hairline: high across the brow so there is a forehead, dipping over the
 *   temples, and lowest at the nape, ragged rather than ruled, and swept a
 *   little to one side at the front;
 * - volume: the mass stands proud of the skull — most at the crown and the
 *   back — and settles back onto it at the hairline, so the edge lies flat
 *   against the skin instead of hovering off it;
 * - grain: clumps run from the crown down to the tips, and each one is a
 *   ridge in the surface the flat shading catches as a strand — sharp-crested,
 *   deep enough to break the silhouette, and carried right to the tips so the
 *   hairline is a row of locks rather than a hem — on top of a strand-grain
 *   texture in the colour itself. The first cut had the ridges at a third of
 *   this depth and faded out at the tips, and it read as a smooth dome.
 *
 * Everything is a function of two angles — azimuth round the head and polar
 * angle down from the crown — so the whole thing is one open shell over the
 * head sphere, sized off HEAD_RADIUS like everything else on him.
 */

/**
 * Longitudes round the head, and rings from crown to hairline. Dense enough
 * to resolve the finer of the two ridge octaves below — about two columns per
 * clump — while staying a low-resolution surface next to the rest of him.
 */
const LONGITUDES = 60;
const LATITUDES = 20;

/** How far the mass stands off the skull at the crown, as a fraction of HEAD_RADIUS. */
const VOLUME = 0.11;
/** A little more of that at the back than the front — the crown carries the weight. */
const BACK_VOLUME = 0.3;
/** Height of a strand-clump ridge, as a fraction of HEAD_RADIUS. */
const TUFT = 0.1;
/** How far the front clumps drift sideways from crown to tip — the sweep of the fringe. */
const SWEEP = 0.16;
/** The edge never quite touches the skin — this is the clearance that stops z-fighting. */
const EDGE_LIFT = 0.02;

/**
 * Where the hairline runs, as a polar angle from the crown, by azimuth — 0 is
 * the brow, π the nape. 0.50π is the equator.
 */
function hairlinePhi(theta: number): number {
  const front = Math.max(0, Math.cos(theta));
  // Brow at 0.34π — a forehead of a few centimetres above the eyes — down to
  // 0.64π at the nape, sides a shade above the equator, over where the ears
  // would be.
  let phi = Math.PI * (0.49 - 0.15 * Math.cos(theta));
  // The fringe is swept: one side rides higher, the other drops. Confined to
  // the front by the cos weight so the nape stays symmetrical.
  phi -= Math.PI * 0.035 * Math.sin(theta) * front * front;
  // Ragged, not ruled — strand tips end where they end. Two scales: the
  // locks, and the odd strand that hangs a little longer than its neighbours.
  phi += Math.PI * 0.026 * (wrapNoise1(theta, 11) - 0.5) * 2;
  phi += Math.PI * 0.012 * (wrapNoise1(theta + 1.7, 23) - 0.5) * 2;
  return phi;
}

/**
 * How far the surface stands off the skull: the volume, held for the upper
 * part of the mass and settling to EDGE_LIFT at the hairline, plus the ridges.
 * `t` runs 0 at the crown to 1 at the hairline.
 */
function standOff(theta: number, t: number): number {
  // The extra weight at the back is faded in below the crown, so the crown
  // itself is one height whichever way round the head you measure it — the
  // pole is a single point, not a ring of slightly different ones.
  const back = Math.max(0, -Math.cos(theta)) * smoothstep(0, 0.35, t);
  const body = VOLUME * (1 + BACK_VOLUME * back) * smoothstep(1, 0.7, t);
  // Clumps: long along the strand (little change in t) and narrow across it
  // (fast change in theta), which is what makes them read as hair rather than
  // as bumps. Ridged noise rather than plain — folded about its middle, so
  // every clump has a crest and a crease beside it, which is what a facet can
  // catch — in two octaves, the locks and the finer strands riding on them.
  // The front ones drift sideways from crown to tip, which is the sweep of
  // the fringe. Faded in below the crown, where every ridge would meet in a
  // spike, and kept almost to full depth at the tips, so the hairline is
  // locks rather than a hem.
  const front = Math.max(0, Math.cos(theta));
  const swept = theta + SWEEP * t * front;
  const ridge = (ridged(wrapNoise2(swept, t, 12, 3)) + ridged(wrapNoise2(swept, t, 26, 6)) * 0.55) * TUFT;
  const ridgeWeight = smoothstep(0, 0.15, t) * (1 - 0.3 * smoothstep(0.85, 1, t));
  return EDGE_LIFT + body + ridge * ridgeWeight;
}

let hairGeometry: THREE.BufferGeometry | null = null;
let hairTexture: THREE.CanvasTexture | null = null;

/** The one head of hair, built on first use and shared by every walker mounted after. */
export function getHairGeometry(): THREE.BufferGeometry {
  return (hairGeometry ??= buildHairGeometry());
}

/** Likewise the grain — a canvas draw, so it waits for a document. */
export function getHairTexture(): THREE.CanvasTexture {
  return (hairTexture ??= createHairTexture());
}

function buildHairGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // One column per longitude plus a duplicate of the first to close the UV
  // seam; the crown ring is a real ring of coincident points, which keeps the
  // indexing regular — the triangles it makes are degenerate and dropped below.
  for (let j = 0; j <= LATITUDES; j++) {
    const t = j / LATITUDES;
    for (let i = 0; i <= LONGITUDES; i++) {
      const theta = (i / LONGITUDES) * Math.PI * 2;
      const phi = t * hairlinePhi(theta);
      const r = HEAD_RADIUS * (1 + standOff(theta, t));
      const s = Math.sin(phi);
      // theta 0 is the brow: local +Z is forward on the figure.
      positions.push(r * s * Math.sin(theta), r * Math.cos(phi), r * s * Math.cos(theta));
      uvs.push(i / LONGITUDES, t);
    }
  }

  const stride = LONGITUDES + 1;
  for (let j = 0; j < LATITUDES; j++) {
    for (let i = 0; i < LONGITUDES; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // Wound so the faces look outward.
      if (j > 0) indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Hair colour, and the strand tones the grain is drawn in: dark brown, with
 * strands running from near-black up to a warm mid-brown, so under the toon
 * bands the surface breaks into hair rather than lying flat as one tone.
 */
export const HAIR_COLOR = "#2d241c";
const STRAND_TONES = ["#4a382b", "#5e4a38", "#6b5541", "#3d2e24", "#1a1410", "#120d09", "#33271e", "#544131"];

/**
 * The strand grain: fine, slightly wavy strokes running down the map — which
 * on the shell is crown to tips — over the base colour, some a shade lighter
 * and some a shade darker, so the toon bands break up into hair rather than
 * lying flat across a helmet. Repeated three times round the head, so the
 * strokes stay fine at his scale.
 */
function createHairTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = HAIR_COLOR;
  ctx.fillRect(0, 0, size, size);

  // Seeded, so every visit draws the same head of hair.
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  ctx.lineCap = "round";
  for (let n = 0; n < 3400; n++) {
    const x = rand() * size;
    const y0 = rand() * size;
    const length = 30 + rand() * 170;
    const wave = 1.5 + rand() * 2.5;
    const phase = rand() * Math.PI * 2;
    ctx.strokeStyle = STRAND_TONES[Math.floor(rand() * STRAND_TONES.length)];
    ctx.globalAlpha = 0.3 + rand() * 0.55;
    ctx.lineWidth = 0.8 + rand() * 2.0;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    for (let k = 1; k <= 6; k++) {
      const y = y0 + (length * k) / 6;
      ctx.lineTo(x + Math.sin(phase + k * 0.9) * wave, y);
    }
    ctx.stroke();
    // Wrap the ones that run off the bottom so the crown-to-tip seam is clean
    // when the map is repeated; horizontally the strokes are near-vertical so
    // the side seam looks after itself.
    if (y0 + length > size) {
      ctx.beginPath();
      ctx.moveTo(x, y0 - size);
      for (let k = 1; k <= 6; k++) {
        const y = y0 - size + (length * k) / 6;
        ctx.lineTo(x + Math.sin(phase + k * 0.9) * wave, y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.anisotropy = 4;
  return texture;
}

/* ---- deterministic noise, wrapping round the head ------------------------ */

function hash(i: number, j: number): number {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Folds value noise about its middle into a crest: 1 on the ridge, 0 in the crease, then centred on 0. */
function ridged(n: number): number {
  return (1 - Math.abs(2 * n - 1)) - 0.5;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Value noise round the circle: `cells` lattice points over 2π, wrapping. */
function wrapNoise1(theta: number, cells: number): number {
  const x = ((theta / (Math.PI * 2)) % 1) * cells;
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i % cells, 0);
  const b = hash((i + 1) % cells, 0);
  return a + (b - a) * u;
}

/** Value noise on the shell: `cellsX` round, `cellsY` from crown to hairline. */
function wrapNoise2(theta: number, t: number, cellsX: number, cellsY: number): number {
  const x = ((theta / (Math.PI * 2)) % 1) * cellsX;
  const y = t * cellsY;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const i0 = i % cellsX;
  const i1 = (i + 1) % cellsX;
  const top = hash(i0, j) + (hash(i1, j) - hash(i0, j)) * ux;
  const bottom = hash(i0, j + 1) + (hash(i1, j + 1) - hash(i0, j + 1)) * ux;
  return top + (bottom - top) * uy;
}
