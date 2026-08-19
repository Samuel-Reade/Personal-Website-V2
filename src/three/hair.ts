import * as THREE from "three";
import { HEAD_RADIUS } from "./figure";

/**
 * The walker's hair.
 *
 * It used to be a skullcap: the top half of a sphere a hair's breadth proud of
 * the crown, one flat colour, ending on a clean circle just below the equator
 * — which is to say a bowl, or a helmet. This is a haircut instead. It is
 * built the way the rest of him is built, from a low-resolution surface whose
 * facets are the drawing, so it stays his; the realism is in four things a
 * bowl doesn't have:
 *
 * - a hairline: high across the brow so there is a forehead, dipping over the
 *   temples, and lowest at the nape, ragged rather than ruled, and swept a
 *   little to one side at the front;
 * - volume: the mass stands proud of the skull — most at the crown and the
 *   back — and settles back onto it toward the hairline, so what is left
 *   standing off at the rim is the locks themselves rather than the whole
 *   shell hovering off the skin;
 * - flow: strands leave the crown almost straight and bend as they run out,
 *   raked one way at the fringe and wandering slowly round the rest of the
 *   head, so no two locks lie parallel for their whole length. The mass they
 *   ride on has its own coarse wave, which is what keeps the silhouette from
 *   closing back into a dome between the locks;
 * - spike: a lock is a narrow crest with a deep parting either side of it,
 *   and it *ends* — reaching further than the parting beside it, standing
 *   further off the skull the further down it goes, and hooking up at the very
 *   tip. So the hairline is a row of points with scalp showing between them,
 *   which is what separates spiked hair from a corrugated helmet.
 *
 * Everything is a function of two angles — azimuth round the head and polar
 * angle down from the crown — so the whole thing is one open shell over the
 * head sphere, sized off HEAD_RADIUS like everything else on him. Open, and
 * meant to be: the tips stand off the skull, so the underside of a lock is a
 * real surface the viewer can get round to. `Player` hangs it on a
 * double-sided material for exactly that reason.
 */

/**
 * Longitudes round the head, and rings from crown to hairline. Set by the
 * locks rather than by taste: LOCK_CELLS crests round the head want six or so
 * columns each to come to a point instead of a plateau, and the flow needs
 * enough rings to bend along rather than crease. Still coarse enough that the
 * facets are the drawing — the ridges are deep, so they stay visible as facets
 * at any resolution the silhouette can afford.
 */
const LONGITUDES = 132;
const LATITUDES = 26;

/** How far the mass stands off the skull at the crown, as a fraction of HEAD_RADIUS. */
const VOLUME = 0.12;
/** A little more of that at the back than the front — the crown carries the weight. */
const BACK_VOLUME = 0.3;
/** Height of a strand-clump ridge, as a fraction of HEAD_RADIUS. */
const TUFT = 0.19;
/** Height of the coarse wave the locks ride on — the larger masses of the hair. */
const WAVE = 0.05;
/**
 * How much further the locks stand off the skull at the tips than at the
 * crown. This is the spike: without it the ridges fade into the hairline and
 * the whole thing reads as a smooth dome with a texture on it.
 */
const TIP_FLICK = 1.3;
/** Where a crest sits in the lock field. Below this is parting, and cuts inward. */
const LOCK_FLOOR = 0.38;
/** How far a crest lock reaches past the parting beside it, as a fraction of π. */
const TIP_REACH = 0.075;
/** Radians the very tip of a lock hooks back up, away from the skull. */
const TIP_CURL = 0.12;
/** Radians a strand at the fringe drifts round the head between crown and tip. */
const SWEEP = 0.5;
/** How much that drift varies round the head, so the locks aren't all raked alike. */
const WANDER = 0.26;
/** Crests round the head. The second octave rides at twice this. */
const LOCK_CELLS = 20;
/**
 * Narrows the crests and widens the partings. At 1 the lock field is a
 * triangle wave — corrugation, every point equally on a ridge. Above it the
 * ridges become separate locks with flats between them.
 */
const LOCK_SHARPNESS = 2.6;
/** The parting floor never quite touches the skin — clearance against z-fighting. */
const EDGE_LIFT = 0.02;

/**
 * How far round the head a strand has drifted by the time it reaches `t`.
 *
 * Accumulating as t² rather than linearly is the whole of it: a strand leaves
 * the crown going almost straight down and bends as it runs out, which is a
 * curve, where a linear drift is a rake. The fringe takes most of the sweep —
 * that is the part — and a slow wander round the rest of the head keeps any
 * two neighbouring locks from lying parallel.
 */
function flowDrift(theta: number, t: number): number {
  const front = Math.max(0, Math.cos(theta));
  const sweep = SWEEP * (0.4 + 0.6 * front * front);
  const wander = WANDER * (wrapNoise1(theta + 4.1, 5) - 0.5) * 2;
  return (sweep + wander) * t * t;
}

/**
 * How much of a lock this point is on: 1 on the crest, 0 in the parting beside
 * it.
 *
 * Two octaves of ridged noise — folded about their middle, so every clump has
 * a crest and a crease next to it, which is what a facet can catch — sampled
 * along the flow rather than straight down, so a lock follows its own strand
 * instead of running down a meridian. Long along the strand (few cells in t)
 * and narrow across it (many round), which is what makes them read as hair
 * rather than as bumps.
 */
function lockStrength(theta: number, t: number): number {
  const swept = theta + flowDrift(theta, t);
  // Three cells down the length against twenty round: long enough that a lock
  // reads as one strand running from the crown to its tip, short enough that it
  // changes as it goes. Stretched much further than this the locks turn into
  // smooth panels and the whole head reads as cloth; packed much tighter and
  // they stop being strands and start being crumple.
  const coarse = ridged(wrapNoise2(swept, t, LOCK_CELLS, 3));
  const fine = ridged(wrapNoise2(swept + 2.3, t, LOCK_CELLS * 2, 6));
  // Sharpened harder the further down the strand: at the crown the field is
  // a soft corrugation and the locks are still one mass, and by the tips it is
  // a few narrow crests with wide flats between them. That taper is the
  // difference between a lock that ends in a point and one that ends in a
  // lump, and it is where the scalp between the spikes comes from.
  const sharpness = LOCK_SHARPNESS * (0.7 + 0.9 * t);
  return Math.pow(Math.min(1, coarse * 0.8 + fine * 0.36), sharpness);
}

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
  // A crest reaches past the parting beside it, so the rim is a row of points.
  // Read from the same lock field the ridges are, sampled at the tip, so the
  // longest hair is exactly the hair standing proudest — a lock that reached
  // furthest but lay flat would just be a longer hem. Damped across the front:
  // the eyes sit at 0.457π and a fringe is cut, not spiked downward.
  phi += Math.PI * TIP_REACH * (1 - 0.5 * front) * (lockStrength(theta, 1) - LOCK_FLOOR);
  return phi;
}

/**
 * How far the surface stands off the skull: the volume, held for the upper
 * part of the mass and settling to EDGE_LIFT at the hairline, plus the coarse
 * wave and the locks on top of it. `t` runs 0 at the crown to 1 at the
 * hairline; `phi` is where that has actually put the point, which the flick
 * needs and `t` can't tell it — see below.
 */
function standOff(theta: number, t: number, phi: number): number {
  // The extra weight at the back is faded in below the crown, so the crown
  // itself is one height whichever way round the head you measure it — the
  // pole is a single point, not a ring of slightly different ones. Everything
  // else that varies with theta is faded from the pole by `grow` for the same
  // reason, and because at the pole every lock would otherwise meet in a spike.
  const back = Math.max(0, -Math.cos(theta)) * smoothstep(0, 0.35, t);
  const body = VOLUME * (1 + BACK_VOLUME * back) * smoothstep(1, 0.68, t);
  const grow = smoothstep(0, 0.13, t);

  const swept = theta + flowDrift(theta, t);
  // The larger masses: a slow swell across several locks at once, which is
  // what keeps the surface between the ridges from settling back into a dome.
  const wave = WAVE * (wrapNoise2(swept, t, 4, 2) - 0.5) * 2 * grow;

  // The locks themselves, centred on LOCK_FLOOR so the partings cut inward
  // rather than merely being lower ridges — below the skin at the rim, where
  // that reads as scalp between the spikes — and standing further off the
  // further down they run, which is the flick at the tips.
  //
  // Held back past the equator, and that is why this needs `phi` and not just
  // `t`: a lock standing off the skull above the equator points up and away,
  // which is a spike, while the same lock at the nape points sideways into a
  // flared skirt. Both are t = 1. Undamped, the back of his head grew a
  // mushroom.
  const skirt = smoothstep(0.47, 0.68, phi / Math.PI);
  const flick = 1 + TIP_FLICK * smoothstep(0.2, 1, t) * (1 - 0.7 * skirt);
  // The parting deepens along the strand with everything else: at the crown
  // the locks are barely separated and the hair is one mass, and only by the
  // tips do they part all the way down. Hair does this, and it also keeps the
  // partings from cutting through the scalp where the mass is thinnest.
  const floor = LOCK_FLOOR * (0.45 + 0.55 * t);
  const ridge = TUFT * (lockStrength(theta, t) - floor) * grow * flick;

  // Nothing may sink into the skull while there is still hair below it holding
  // it out: mid-scalp a parting that cuts through reads as a bald patch, not
  // as a parting. Only near the rim, where the mass has settled onto the head
  // anyway, is the surface let inside — and there it is what shows scalp
  // between the spikes, which is the whole point of them.
  const sink = smoothstep(0.82, 1, t);
  return Math.max(EDGE_LIFT - (EDGE_LIFT + 0.16) * sink, EDGE_LIFT + body + wave + ridge);
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
      // The tip hooks up and away over the last quarter of the lock, and only
      // on the crests — a hook applied to the partings too would just shorten
      // the hairline evenly and cost the spikes their reach.
      const curl = TIP_CURL * lockStrength(theta, t) * smoothstep(0.72, 1, t);
      const phi = t * hairlinePhi(theta) - curl;
      const r = HEAD_RADIUS * (1 + standOff(theta, t, phi));
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
 * The strand grain: fine strokes running down the map — which on the shell is
 * crown to tips — over the base colour, some a shade lighter and some a shade
 * darker, so the toon bands break up into hair rather than lying flat across a
 * helmet. Repeated four times round the head, so the strokes stay fine at his
 * scale.
 *
 * Each strand curves and tapers rather than running straight at one width: it
 * leans, bends the way the geometry's flow bends, and comes to a point at its
 * end, so it reads as a hair with a tip on it. The first cut drew them as
 * even-width waves and read as corduroy.
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

  /**
   * One strand, from (x, y0) downward: a lean that grows along its length —
   * the same t² bend the geometry flows on — with a slow wave over the top of
   * it, drawn as a ribbon that narrows to a point at the tip.
   *
   * Filled as one polygon rather than stroked segment by segment. Both taper,
   * but a stroked taper costs a canvas call per segment, and at three thousand
   * strands that is forty thousand of them on a texture built while the
   * loading screen is still up. This is one call each, and the point at the
   * end is cleaner for being geometry rather than a shrinking line width.
   *
   * Drawn twice where it runs off the bottom, so the crown-to-tip seam stays
   * clean when the map repeats; horizontally the strokes are near enough
   * vertical that the side seam looks after itself.
   */
  const STEPS = 8;
  const strand = (
    x: number,
    y0: number,
    length: number,
    lean: number,
    wave: number,
    phase: number,
    width: number,
    alpha: number,
    tone: string
  ) => {
    for (const offset of y0 + length > size ? [0, -size] : [0]) {
      const spine: [number, number, number][] = [];
      for (let k = 0; k <= STEPS; k++) {
        const u = k / STEPS;
        spine.push([
          x + lean * u * u * length + Math.sin(phase + u * 5) * wave,
          y0 + offset + length * u,
          // Half-width, full at the root and nothing at the tip.
          width * 0.5 * (1 - u),
        ]);
      }
      ctx.fillStyle = tone;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(spine[0][0] - spine[0][2], spine[0][1]);
      for (let k = 1; k <= STEPS; k++) ctx.lineTo(spine[k][0] - spine[k][2], spine[k][1]);
      for (let k = STEPS; k >= 0; k--) ctx.lineTo(spine[k][0] + spine[k][2], spine[k][1]);
      ctx.closePath();
      ctx.fill();
    }
  };

  for (let n = 0; n < 3000; n++) {
    strand(
      rand() * size,
      rand() * size,
      30 + rand() * 150,
      (rand() - 0.35) * 0.22,
      1.5 + rand() * 3,
      rand() * Math.PI * 2,
      1 + rand() * 2.2,
      0.3 + rand() * 0.5,
      STRAND_TONES[Math.floor(rand() * STRAND_TONES.length)]
    );
  }

  // A handful of long, pale flyaways over the top: the strands that catch the
  // light and don't lie with the rest. Few enough to read as stray hairs
  // rather than as a second grain.
  for (let n = 0; n < 120; n++) {
    strand(
      rand() * size,
      rand() * size,
      140 + rand() * 110,
      (rand() - 0.35) * 0.4,
      3 + rand() * 5,
      rand() * Math.PI * 2,
      1.3,
      0.4 + rand() * 0.35,
      STRAND_TONES[2]
    );
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

/** Folds value noise about its middle into a crest: 1 on the ridge, 0 in the crease. */
function ridged(n: number): number {
  return 1 - Math.abs(2 * n - 1);
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
  const i0 = ((i % cellsX) + cellsX) % cellsX;
  const i1 = (i0 + 1) % cellsX;
  const top = hash(i0, j) + (hash(i1, j) - hash(i0, j)) * ux;
  const bottom = hash(i0, j + 1) + (hash(i1, j + 1) - hash(i0, j + 1)) * ux;
  return top + (bottom - top) * uy;
}
