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
 * It is one colour throughout, and the surface is the only thing drawing it.
 * The ridges are deep enough that the toon ramp bands them on its own, so a
 * lock reads as a lock without a strand painted on it or a tone varied along
 * it. Two earlier cuts tried otherwise — a painted strand grain, then five
 * browns dealt out across the facets — and both came out as pale streaks lying
 * over the hair rather than as hair, which is the one thing a single colour
 * under this ramp cannot do.
 *
 * A hat presses it down: `getHairGeometry(hat)` is the same head of hair with
 * the rise held to what fits underneath, and let go again below the hat's rim.
 * It has to be the hair that yields rather than the hat that grows, because
 * the locks stand half a head-radius proud — a mortarboard's cap grown to
 * swallow that would come out wider than the board sitting on it, and a
 * sailing cap would stop being a sailing cap. Each hat states its own fit,
 * beside the geometry that draws it, so the two cannot drift apart.
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

/**
 * How far the mass stands off the skull at the crown, as a fraction of
 * HEAD_RADIUS — and, with TUFT and the flick below, how wide the whole cut
 * sits on the head.
 *
 * These all came down together, because the width was never in one number.
 * Measured at the widest point of the silhouette rather than at the hem,
 * which is where the eye reads it and is not the same place: the crests of
 * the locks stand further out than the mass under them, so TUFT multiplied by
 * the flick at the tips was contributing more width than VOLUME was, and
 * halving the volume alone barely moved it. Cutting the hem back while
 * leaving the crests where they were is what left it still looking wide after
 * the first attempt.
 *
 * At the back — which is where a walking figure is seen from, and where the
 * complaint came from — it now stands about 15 per cent proud of the skull,
 * against 35 before. The front keeps the most of its width, at 32 against 57,
 * because that is the fringe and it is meant to have some spike in it.
 */
const VOLUME = 0.095;
/** A little more of that at the back than the front — the crown carries the weight. */
const BACK_VOLUME = 0.12;
/** Height of a strand-clump ridge, as a fraction of HEAD_RADIUS. */
const TUFT = 0.125;
/** Height of the coarse wave the locks ride on — the larger masses of the hair. */
const WAVE = 0.028;
/**
 * How much further the locks stand off the skull at the tips than at the
 * crown. This is the spike: without it the ridges fade into the hairline and
 * the whole thing reads as a smooth dome with a texture on it.
 */
const TIP_FLICK = 0.8;
/** Where a crest sits in the lock field. Below this is parting, and cuts inward. */
const LOCK_FLOOR = 0.38;
/** How far a crest lock reaches past the parting beside it, as a fraction of π. */
const TIP_REACH = 0.1;
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
 * How much of the lock field is flattened away at the back of the head, and
 * how much is added at the crown and the fringe.
 *
 * The locks used to be one field applied evenly all the way round, which is
 * not how a head of hair sits or how anybody wears one. The back is the part
 * that lies down: nothing disturbs it, gravity has it, and it reads as one
 * smooth mass. The spikes belong where hair is short enough or handled enough
 * to stand — the crown, where it is lifted, and the fringe, where it is cut.
 *
 * Evenly spiked, the back of the head came out as the same crest-and-crease
 * corrugation as the front, which at a bob's length reads less like hair than
 * like fur, and it made the silhouette busy exactly where the eye wants
 * somewhere to rest.
 */
const BACK_SMOOTH = 0.86;
/** How much more the crown and fringe stand up, over the field's own height. */
const SPIKE_EMPHASIS = 0.4;
/**
 * Where along a strand the smoothing takes hold. The crown keeps its spikes
 * whichever way round the head it is measured — a flat patch on top would be a
 * bald spot — so the back only settles below it.
 */
const SMOOTH_ONSET = 0.18;
const SMOOTH_FULL = 0.58;

/*
 * The bob's "hang" is gone with the length that needed it.
 *
 * It held the horizontal radius out at the width of the widest part of the
 * skull once the hair passed the ear, so that hair falling below the ear
 * carried on down and out instead of following the skull in toward the neck.
 * That is right for a bob and wrong for this: nothing here now reaches below
 * the ear except the nape, and hair at the nape lies on the neck rather than
 * standing off it. What is left is a shell a distance off a sphere, which is
 * what this file was before the bob and is the correct model for a cut that
 * sits on the head.
 */

/**
 * How strongly the locks stand at a given point: below 1 down the back, above
 * it at the crown and the fringe.
 *
 * Read by both the surface — where it scales the ridge height — and by the
 * hairline, where it scales the raggedness and the reach of the points, so a
 * smooth back gets a clean hem to go with its clean surface rather than a
 * settled mass finishing in a row of spikes.
 *
 * `behind` runs 0 at the brow through about a fifth at the ears to 1 at the
 * nape, so the sides are only lightly settled and the change round the head is
 * a gradient rather than a seam.
 */
function ridgeScale(theta: number, t: number): number {
  const front = Math.max(0, Math.cos(theta));
  const behind = smoothstep(0.35, 1, (1 - Math.cos(theta)) / 2);
  const below = smoothstep(SMOOTH_ONSET, SMOOTH_FULL, t);
  const emphasis = 1 + SPIKE_EMPHASIS * Math.max(front * front, 1 - below);
  return emphasis * (1 - BACK_SMOOTH * behind * below);
}

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
  const behind = Math.max(0, -Math.cos(theta));
  // Three lengths rather than two, because a short cut is not one length round
  // and a bob is: the brow at 0.36π, the sides up at 0.47π where they finish
  // just above the ear, and the nape down at 0.66π.
  //
  // The sides are the change. They sat at 0.62π with everything else, which is
  // past the ear and over it — the reason the figure had no ears to speak of,
  // whatever the head underneath was doing. Cut to 0.45π they finish a few
  // degrees above where an ear starts, which is what lets one show.
  //
  // The nape keeps its own weighting and stays much the longest of the three,
  // as it is on a head: hair grows a long way further down at the back than at
  // the temples, and a cut level all the way round reads as a helmet's rim
  // rather than as a hairline. Squared so the drop is confined to the back of
  // the head instead of creeping forward along the sides.
  //
  // It wants to be nearly as low as the bob's was. A first pass took it to
  // 0.55π, a little past the widest part of the skull, on the reasoning that a
  // short cut is short everywhere — and the back of the head came out bald,
  // because a sphere keeps going a long way below its equator and there is
  // nothing else up there to cover it. What makes a cut short is where it
  // finishes at the *sides*; the back finishes at the neck whatever the length
  // on top.
  const cut = front * front;
  const nape = behind * behind;
  let phi = Math.PI * (0.47 - 0.11 * cut + 0.19 * nape);
  // The fringe is swept: one side rides higher, the other drops. Confined to
  // the front by the cos weight so the nape stays symmetrical.
  phi -= Math.PI * 0.035 * Math.sin(theta) * front * front;
  // Ragged, not ruled — strand tips end where they end. Two scales: the
  // locks, and the odd strand that hangs a little longer than its neighbours.
  // Scaled by the same weight the ridges are, so the settled back finishes on
  // a clean line: a smooth mass ending in a torn hem is the worst of both, and
  // it is the hem that says at a glance which parts of the cut are doing
  // something.
  const scale = ridgeScale(theta, 1);
  phi += Math.PI * 0.026 * (wrapNoise1(theta, 11) - 0.5) * 2 * scale;
  phi += Math.PI * 0.012 * (wrapNoise1(theta + 1.7, 23) - 0.5) * 2 * scale;
  // A crest reaches past the parting beside it, so the rim is a row of points.
  // Read from the same lock field the ridges are, sampled at the tip, so the
  // longest hair is exactly the hair standing proudest — a lock that reached
  // furthest but lay flat would just be a longer hem. Damped across the front:
  // the eyes sit at 0.457π and a fringe is cut, not spiked downward.
  phi += Math.PI * TIP_REACH * (1 - 0.5 * front) * (lockStrength(theta, 1) - LOCK_FLOOR) * scale;
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
  // The old settle — the mass sinking back onto the skull toward the hairline
  // — now applies only where the hair is still lying on the skull. Below the
  // ear it is hanging, and hanging hair does not thin toward its ends; it is
  // the same rope of hair all the way down. Without this the bell built below
  // tapered back to the width of the neck and the cut came out as a cone.
  const settle = smoothstep(1, 0.68, t);
  // Widest across the middle of the fall and easing in again at the very ends.
  // A bob is a rounded mass, not a straight curtain: hair swings out from the
  // crown, reaches its widest around the ear, and comes back in as it runs
  // out of length. Held off the tips alone, so the points along the hem keep
  // their reach — what tucks is the body behind them.
  const bulge = 1 - 0.5 * smoothstep(0.6, 1, t);
  const body = VOLUME * bulge * (1 + BACK_VOLUME * back) * settle;
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
  const flick = 1 + TIP_FLICK * smoothstep(0.2, 1, t) * (1 - 0.45 * skirt);
  // The parting deepens along the strand with everything else: at the crown
  // the locks are barely separated and the hair is one mass, and only by the
  // tips do they part all the way down. Hair does this, and it also keeps the
  // partings from cutting through the scalp where the mass is thinnest.
  const floor = LOCK_FLOOR * (0.45 + 0.55 * t);
  const ridge = TUFT * (lockStrength(theta, t) - floor) * grow * flick * ridgeScale(theta, t);

  // Nothing may sink into the skull while there is still hair below it holding
  // it out: mid-scalp a parting that cuts through reads as a bald patch, not
  // as a parting. Only near the rim, where the mass has settled onto the head
  // anyway, is the surface let inside — and there it is what shows scalp
  // between the spikes, which is the whole point of them.
  const sink = smoothstep(0.82, 1, t);
  return Math.max(EDGE_LIFT - (EDGE_LIFT + 0.16) * sink, EDGE_LIFT + body + wave + ridge);
}

/**
 * How a particular hat sits on the hair: how far down the skull its shell
 * reaches, and how much hair it will take underneath.
 *
 * The wearer supplies this rather than this file holding a list of hats,
 * because the numbers are read off the hat's own geometry — the polar angle
 * its crown is cut at, and the clearance between its shell and the skull. A
 * hat drawn here would be a hat nobody could see.
 */
export interface HatFit {
  /** Polar angle from the crown at which the hat's shell ends. */
  rimPhi: number;
  /** The tallest the hair may stand under it, as a fraction of HEAD_RADIUS. */
  rise: number;
}

const hairGeometry = new Map<string, THREE.BufferGeometry>();

/**
 * The one head of hair, built on first use and shared by everyone wearing it —
 * bare, or pressed down to fit under whichever hat is asked for. One cached
 * head per fit, which in practice is three: bare, under a mortarboard, and
 * under a sailing cap.
 */
export function getHairGeometry(hat?: HatFit): THREE.BufferGeometry {
  const key = hat ? `${hat.rimPhi}:${hat.rise}` : "bare";
  let geometry = hairGeometry.get(key);
  if (!geometry) {
    geometry = buildHairGeometry(hat);
    hairGeometry.set(key, geometry);
  }
  return geometry;
}

/**
 * His hair, one colour everywhere, and the same near-black the suit is cut
 * from. The shading is entirely the surface's own.
 *
 * It reads as one mass with the shoulders below it at any distance, which is
 * the price of the two being the same black — the neck is the only thing
 * between them. Worth knowing before anyone reaches for a lighter brown to
 * "fix" it: this is the colour it is meant to be.
 */
export const HAIR_COLOR = "#181a1f";

/**
 * How far below a hat's rim the hair takes to stand back up, as a polar angle.
 *
 * Shared by every hat, because it is a property of the hair rather than of
 * what is on top of it. Short: the hair has to be at full height by the time
 * it is out from under the brim, or the hat appears to be sitting on a bald
 * head with a fringe of spikes some way below it.
 */
const HAT_RELEASE = Math.PI * 0.06;

function buildHairGeometry(hat?: HatFit): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  // One column per longitude plus a duplicate of the first to close the ring;
  // the crown ring is a real ring of coincident points, which keeps the
  // indexing regular — the triangles it makes are degenerate and left out below.
  for (let j = 0; j <= LATITUDES; j++) {
    const t = j / LATITUDES;
    for (let i = 0; i <= LONGITUDES; i++) {
      const theta = (i / LONGITUDES) * Math.PI * 2;
      // The tip hooks up and away over the last quarter of the lock, and only
      // on the crests — a hook applied to the partings too would just shorten
      // the hairline evenly and cost the spikes their reach.
      const curl = TIP_CURL * lockStrength(theta, t) * smoothstep(0.72, 1, t) * ridgeScale(theta, t);
      const phi = t * hairlinePhi(theta) - curl;

      // Under a hat, the rise is held to what fits beneath it the whole way
      // out to its rim, and released over the few degrees below — so the hair
      // showing under the edge is the hair it always was, and only what the
      // hat actually sits on is flattened. The press is measured on phi rather
      // than t because a rim is a line of latitude and t is not: at the brow
      // t = 1 arrives well above the rim, at the nape well below it.
      const lift = standOff(theta, t, phi);
      const press = hat ? smoothstep(hat.rimPhi + HAT_RELEASE, hat.rimPhi, phi) : 0;
      const held = hat ? Math.min(lift, hat.rise) : lift;
      const r = HEAD_RADIUS * (1 + lift + (held - lift) * press);

      const s = Math.sin(phi);
      const w = s;
      // theta 0 is the brow: local +Z is forward on the figure.
      positions.push(r * w * Math.sin(theta), r * Math.cos(phi), r * w * Math.cos(theta));
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
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
