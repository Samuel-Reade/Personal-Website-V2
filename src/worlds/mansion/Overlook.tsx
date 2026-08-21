import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BEACH_TOP,
  canopy,
  SEA_LEVEL,
  TERRAIN_EXTENT,
  TREE_LINE,
  terrainColor,
  terrainHeight,
  terrainSlope,
  VEGETATION_MAX_SLOPE,
  treeLineAt,
} from "../associations/terrain";
import { MANSION, MIN_ALTITUDE, mansionPoint, underBuildings } from "../associations/layout";
import { seeded } from "../associations/materials";
import { PALETTE } from "../associations/palette";
import {
  BASKET_DROP,
  BURNER_RISE,
  FAR_BALLOONS,
  FLAME,
  farBalloonDrift,
} from "../associations/DistantBalloons";
import { BurnerFlame } from "../associations/burner";
import { PROFILE } from "../associations/envelope";
import { DAY_SKY } from "../../three/celestial";
import { NOON_TINT } from "./materials";
import { LANDING_Y, OUTSIDE_BACK_Z, OUTSIDE_FRONT_Z } from "./layout";

/**
 * What the Connect balcony actually looks out on.
 *
 * The fourth time the site draws one world from inside another, and the same
 * rule as the other three: this is not a view *like* the associations range,
 * it is that range — the same `terrainHeight` the clearing builds its
 * mountains from, the same `terrainColor` bands, the same four `FAR_BALLOONS`
 * on the same `farBalloonDrift`, sampled from the exact spot on the exact
 * mountain this balcony hangs off.
 *
 * It replaces an invented seascape: a cliff dropping forty-six units to open
 * water, gulls, and a sailboat crossing. It read well and it was a lie, and
 * the telescope standing three units away had already said so — `EyepieceRange`
 * threw out its own hand-built cliffs for this same range, with a comment
 * explaining that the balcony "hangs off a mansion on a mountain, two hundred
 * units of forested ridge and a strait of open water short of anything it
 * claimed to show". The naked-eye view went on claiming it anyway. Now the two
 * agree, because they are the same mountain.
 *
 * The real overlook is nothing like the old one. Reade Hall stands on the
 * great peak north-west of the flyable arena, and the balcony is off the east
 * wing's first floor at 189.75 — so the ground does not sit forty-six below,
 * it *falls*: 53 units down at ten out, still 44 degrees below the eye at a
 * hundred, and it does not reach the water until some five hundred. What the
 * balcony has is a mountainside, the range beyond it, and the sea a long way
 * past that.
 */

/* -------------------------------------------------------------------------
   Standing the hall's balcony on the mountain the exterior puts it on
   ---------------------------------------------------------------------- */

/**
 * The balcony's centre in the exterior mansion's own frame — the mid-point of
 * the slab `associations/Mansion.tsx` cantilevers off the east wing, whose
 * corners are local x 17 to 22.5 and z -5 to 2.5.
 *
 * Stated here rather than imported because those four numbers are private to
 * that module and describe how the *model* is built; what this file needs is
 * the one point the two representations of the balcony have in common. If the
 * slab is ever moved along the wing, this follows it by hand — which is the
 * honest cost of the two worlds modelling the same balcony twice.
 */
const REAL_BALCONY_LOCAL: [number, number] = [(17 + 22.5) / 2, (-5 + 2.5) / 2];
/** Its floor: the exterior's FIRST_FLOOR, which is STYLOBATE + 5.6. */
const REAL_BALCONY_FLOOR = 189.75;

/** The same point in world XZ, off the exterior's own placement of the house. */
const EYE_WORLD = (() => {
  const [x, z] = mansionPoint(...REAL_BALCONY_LOCAL);
  return new THREE.Vector3(x, REAL_BALCONY_FLOOR, z);
})();

/** And where that point sits in the hall's own frame. */
const EYE_HALL = new THREE.Vector3(0, LANDING_Y, (OUTSIDE_FRONT_Z + OUTSIDE_BACK_Z) / 2);

/**
 * How far the group has to be turned to bring the two frames into line.
 *
 * The balcony faces outward along the exterior mansion's local +x — that is
 * the end of the wing it hangs off — and outward from the hall's balcony is
 * -Z, the way you face stepping through the Connect doorway. So the rotation
 * is whatever takes the first direction onto the second.
 *
 * Rotating a direction (sin a, cos a) about Y by an angle p yields
 * (sin(a + p), cos(a + p)); the hall's outward is (0, -1), which is a = PI. So
 * the turn wanted is PI minus the world bearing of the balcony's own outward.
 */
const VIEW_ROTATION = (() => {
  const outX = Math.cos(MANSION.rotationY);
  const outZ = -Math.sin(MANSION.rotationY);
  return Math.PI - Math.atan2(outX, outZ);
})();

/**
 * The whole view is drawn at true scale — a mountainside six hundred units
 * deep, standing beyond a doorway in a room forty across.
 *
 * The alternative was to shrink it, the way the projects world shrinks this
 * same range to two-fifths (`DistantClearing`), which would have kept it
 * inside the hall camera's old 160-unit reach. It is not worth it here. A
 * uniform shrink holds every angle in the view exactly right but multiplies
 * parallax by its own reciprocal, and unlike the archipelago's horizon this
 * range is something the visitor walks a nine-unit balcony in front of — at
 * a quarter scale, four paths along the rail would swing the mountains four
 * times as far as they should swing.
 *
 * Drawing it at true size costs only the far plane, and a far plane is nearly
 * free: depth precision is set by the *near* plane, which stays at 0.1. See
 * `MansionWorld`, where far went from 160 to 900 to clear the sky shell below.
 */
const HORIZON_SHELL = 700;

/** Where the land is sampled from and to, measured from the eye. */
const NEAR_RADIUS = 4;
const FAR_RADIUS = TERRAIN_EXTENT;
/**
 * The ground is built all the way round, not as a fan.
 *
 * It was a fan of 78 degrees either side of straight out, on the reasoning
 * that the balustrade and the wing's wall take over past there. They do not.
 * The chase camera swings wide when the walker turns along the rail, and at
 * the ends of that swing the fan showed its own cut edge — a dead straight
 * diagonal where the forested hillside stopped and the sea behind it carried
 * on, which reads as the world running out rather than as a hill.
 *
 * There is no angle at which that edge is safely off screen, because the
 * camera is not fixed to the doorway. So the sweep closed into a full circle:
 * a third more rings' worth of triangles for a view with no seam in it
 * anywhere, built once at load and never touched again.
 */
const FAN_HALF_ANGLE = Math.PI;

/**
 * Rings out from the eye, and sectors across the fan.
 *
 * The rings are spaced geometrically rather than evenly — each one a fixed
 * ratio further out than the last — so that every ring subtends roughly the
 * same angle from the eye. An even spacing spends the same number of vertices
 * on the last hundred units, where the range is a haze-blue silhouette, as on
 * the first ten, where the mountainside falls away directly under the rail.
 * This is a view from one fixed point, which is the one case where sampling in
 * polar beats the square grid `layout.ts` argues for.
 */
const RINGS = 96;
const SECTORS = 288;

/**
 * The haze the range fades into, in the associations world's own numbers.
 *
 * Thinner than the associations world's own 165 and 525. Those are set for a
 * helicopter down in the arena, where haze is what keeps the far ridges from
 * crowding the flight; from a balcony most of a mountain up, the same curve
 * put the whole middle distance behind milk and left the range a pale
 * suggestion of itself. Clear air is also what altitude actually buys you.
 * The ceiling stays short of 1 so the furthest summits keep a silhouette
 * rather than dissolving into the sky outright.
 *
 * Thinned twice. 260 and 760 under a ceiling of 0.8 still read as weather
 * rather than air, and the range past the rail came back as one pale wash with
 * a single green hill surviving in it. Most of that was not this curve at all
 * — see `buildSea`, which was ramping the water to sky colour in a straight
 * line from the viewer's own feet — but the land was in the same fog. At 380
 * and a ceiling of 0.45 the near mountainside is untouched, the forest and the
 * rock bands read across the whole middle distance, and the furthest ridge
 * gives up a little under half its colour, which is enough to sit it behind
 * the ones in front without erasing it.
 *
 * Baked into vertex colours instead of scene fog, because the hall sets
 * `scene.fog = null` on purpose and every light in this world is indoors. A
 * chandelier does not light a mountain, so the outside is drawn unlit and
 * carries its own distance in its colours, exactly as the cliff it replaces
 * did — see `Outside.tsx` on why the exterior is MeshBasic throughout.
 */
const HAZE_NEAR = 380;
const HAZE_FAR = 760;
/**
 * And the colour it fades to: the shared DAY_SKY the associations world lerps
 * its own fog toward, not a blue picked to look like distance.
 *
 * This was `#8fa9c4` — the old backdrop's sky, which was a good sky and much
 * too saturated to be haze. Rendered against the real range it was worse than
 * wrong, it was misleading: a forested col two hundred units out came back a
 * flat mid-blue and read as an inlet of the sea, so the view invented water in
 * the middle of a mountainside. Caught by rendering this range twice from the
 * same eye — once here and once out of the associations world's own
 * components — and holding the two up against each other.
 */
/**
 * One exposure for everything past the rail, and a haze base solved backwards
 * from it.
 *
 * The outside is unlit, so each material carries a brightness multiplier that
 * stands in for the daylight the hall's candles cannot supply — the cliff this
 * replaced used 2.4, its sea 2.6, its sky 1.6. Those could differ freely while
 * the backdrop was invented. They cannot now: haze has to *converge* on the
 * sky, and a ridge fading toward a colour multiplied by 2.4 against a sky
 * multiplied by 1.6 arrives somewhere brighter than the sky it is fading into.
 * Both clipped past white and the furthest range came back whiter than the air
 * above it, which reads as a ridge of snow lying along every distant summit.
 *
 * So there is one number, and the haze colour is whatever renders *as* the
 * shared DAY_SKY once the clock's noon tint and that number have been through
 * it. Stated as the solve rather than as the answer, so the two cannot drift:
 * change the exposure and the haze re-solves to the same sky.
 */
const EXPOSURE = 2.1;
const HAZE_COLOR = new THREE.Color(
  DAY_SKY.r / (NOON_TINT.r * EXPOSURE),
  DAY_SKY.g / (NOON_TINT.g * EXPOSURE),
  DAY_SKY.b / (NOON_TINT.b * EXPOSURE)
);
/**
 * How far toward the haze the furthest ground is allowed to go. Short of 1 on
 * purpose: a summit that reaches the sky exactly has no silhouette left, and
 * the far range should still be *there*, faintly, rather than gone.
 */
const HAZE_CEILING = 0.45;

const SEA_COLOR = new THREE.Color("#2d4f6b");

/** Tree colours, straight off the range's own palette. */
const PINE = new THREE.Color(PALETTE.pine);
const PINE_DARK = new THREE.Color(PALETTE.pineDark);
const LEAF = new THREE.Color(PALETTE.leaf);
const LEAF_DARK = new THREE.Color(PALETTE.leafDark);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The mountainside and the range beyond it.
 *
 * A fan of quads in world coordinates — the transform group above puts them
 * where the balcony can see them — each corner sampled off `terrainHeight` and
 * each face coloured by `terrainColor`, which is what carries the snow line,
 * the treeline shading and the rock. Faces wholly under the sea are dropped;
 * the water plane covers that ground.
 */
function buildRange(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];

  const outward = Math.atan2(Math.cos(MANSION.rotationY), -(-Math.sin(MANSION.rotationY)));
  const step = Math.pow(FAR_RADIUS / NEAR_RADIUS, 1 / RINGS);

  // Corner samples shared between neighbouring cells, so a vertex is sampled
  // once rather than four times — 16k cells would otherwise be 64k lookups
  // into a function that sums every peak in the range.
  const radii: number[] = [];
  for (let i = 0; i <= RINGS; i++) radii.push(NEAR_RADIUS * Math.pow(step, i));
  const angles: number[] = [];
  for (let j = 0; j <= SECTORS; j++)
    angles.push(outward - FAN_HALF_ANGLE + (2 * FAN_HALF_ANGLE * j) / SECTORS);

  const px: number[] = [];
  const py: number[] = [];
  const pz: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i <= RINGS; i++) {
    for (let j = 0; j <= SECTORS; j++) {
      const x = EYE_WORLD.x + Math.sin(angles[j]) * radii[i];
      const z = EYE_WORLD.z - Math.cos(angles[j]) * radii[i];
      px.push(x);
      pz.push(z);
      py.push(terrainHeight(x, z));
      slopes.push(terrainSlope(x, z));
    }
  }
  const at = (i: number, j: number) => i * (SECTORS + 1) + j;

  const color: [number, number, number] = [0, 0, 0];
  const tri = (a: number, b: number, c: number) => {
    const hs = [py[a], py[b], py[c]];
    if (hs[0] <= SEA_LEVEL && hs[1] <= SEA_LEVEL && hs[2] <= SEA_LEVEL) return;
    positions.push(px[a], py[a], pz[a], px[b], py[b], pz[b], px[c], py[c], pz[c]);
    const mx = (px[a] + px[b] + px[c]) / 3;
    const mz = (pz[a] + pz[b] + pz[c]) / 3;
    const mh = (hs[0] + hs[1] + hs[2]) / 3;
    const ms = (slopes[a] + slopes[b] + slopes[c]) / 3;
    const [r, g, bl] = terrainColor(mh, ms, mx, mz);
    // Distance is taken from the eye rather than from the origin: this is a
    // view, and what dissolves a ridge is how far it is from the person
    // looking at it.
    const d = Math.hypot(mx - EYE_WORLD.x, mz - EYE_WORLD.z);
    const haze = smoothstep(HAZE_NEAR, HAZE_FAR, d) * HAZE_CEILING;
    color[0] = r + (HAZE_COLOR.r - r) * haze;
    color[1] = g + (HAZE_COLOR.g - g) * haze;
    color[2] = bl + (HAZE_COLOR.b - bl) * haze;
    for (let k = 0; k < 3; k++) colors.push(color[0], color[1], color[2]);
  };

  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SECTORS; j++) {
      const a = at(i, j);
      const b = at(i, j + 1);
      const c = at(i + 1, j + 1);
      const d = at(i + 1, j);
      // Wound so the face normal points up, out of the hillside. The fan runs
      // clockwise seen from above — bearing increases from -Z toward +X — so
      // the ring-then-sector order that reads naturally is the one that faces
      // every triangle *down*, and the whole range is then culled away as
      // backfaces. It cost a while to find, because it does not look like
      // missing ground: the sea plane lies behind the hole, so the mountainside
      // came back as water with the forest still standing on it.
      tri(a, c, d);
      tri(a, b, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

/** How far out the water is drawn, just inside the sky it hands off to. */
const SEA_RADIUS = HORIZON_SHELL * 0.98;
/**
 * Water starts fading nearer than the land does, and finishes at the rim.
 *
 * Its own number rather than HAZE_NEAR because the two are fading different
 * things. A ridge at four hundred is a shape, and haze there only greys it;
 * the sea is one flat colour over the whole middle distance, so holding it at
 * full strength that far out lands a slab of navy against the pale hillside
 * ending in front of it. Starting the fade early keeps the water blue where it
 * is close enough to read as water and lets it give the colour up gradually.
 */
const SEA_HAZE_NEAR = 200;

/**
 * The sea, where the land finally runs out of height.
 *
 * A disc at SEA_LEVEL rather than the associations world's own `Ocean`, which
 * is a lit, animated surface with foam lines and a sea floor under it: none of
 * that survives being five hundred units away and none of it can be lit from
 * indoors. What is left is the one thing the balcony can actually see of the
 * water — a band of it, fading out as it reaches the horizon.
 *
 * Ringed rather than a plain `CircleGeometry`, which is what that was and what
 * made the whole middle distance milky. A circle has exactly two rings of
 * vertices, the centre and the rim, so a haze baked into its vertex colours is
 * not the curve below at all — it is a straight ramp from nothing at the
 * viewer's own feet to full haze at the horizon, and water four hundred out
 * came back half sky. With rings the colour is sampled along the way and the
 * curve is the one that was written.
 *
 * The curve finishes at the rim rather than at HAZE_FAR, and that is the one
 * thing here that must not be relaxed: the disc stops fifteen degrees below
 * where a real horizon would be, so any water colour still left at its edge
 * draws a hard, too-near, false horizon. Reaching the sky exactly is what hides
 * the seam.
 */
function buildSea(): THREE.BufferGeometry {
  const geometry = new THREE.RingGeometry(0, SEA_RADIUS, 64, 32);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(EYE_WORLD.x, SEA_LEVEL, EYE_WORLD.z);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const pos = geometry.attributes.position;
  for (let i = 0; i < count; i++) {
    const d = Math.hypot(pos.getX(i) - EYE_WORLD.x, pos.getZ(i) - EYE_WORLD.z);
    const haze = smoothstep(SEA_HAZE_NEAR, SEA_RADIUS, d);
    colors[i * 3] = SEA_COLOR.r + (HAZE_COLOR.r - SEA_COLOR.r) * haze;
    colors[i * 3 + 1] = SEA_COLOR.g + (HAZE_COLOR.g - SEA_COLOR.g) * haze;
    colors[i * 3 + 2] = SEA_COLOR.b + (HAZE_COLOR.b - SEA_COLOR.b) * haze;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}


/* -------------------------------------------------------------------------
   The forest on it
   ---------------------------------------------------------------------- */

/**
 * The same trees the range itself grows.
 *
 * Not a forest *like* that one — the identical scatter. `Forest.tsx` places
 * its stands by walking a fixed `seeded` sequence through 1900 cluster centres
 * and filtering each candidate against the ground's own predicates, and every
 * one of those inputs is exported, so walking the same sequence here yields the
 * same trees at the same points on the same hillsides. Only the shading is
 * local, for the reason everything past the wall is: that module shades with
 * Lambert, and a Lambert pine three hundred units outside a candlelit hall is
 * black.
 *
 * Without them this view was a smooth green heightfield with grey caps, which
 * against the real range read as a model of it rather than as it. The forest is
 * most of what the eye actually reads at this distance.
 */
const CLUSTERS = 1900;
const PER_CLUSTER = 44;
const CLUSTER_SPREAD = 34;
const TREE_MAX_SLOPE = VEGETATION_MAX_SLOPE - 0.9;
const BROADLEAF_TOP = 42;

/**
 * How far out trees are still drawn.
 *
 * Past this the haze has taken them to within a few per cent of the ridge they
 * stand on and each one is under a pixel, so they cost a matrix and buy
 * nothing. It sits beyond HAZE_FAR, so the cut happens where there is nothing
 * left to cut.
 */
const TREE_REACH = 560;

interface Tree {
  x: number;
  y: number;
  z: number;
  height: number;
  rotationY: number;
  dark: boolean;
  broad: boolean;
}

function scatterTrees(): Tree[] {
  const out: Tree[] = [];
  const outward = Math.atan2(Math.cos(MANSION.rotationY), Math.sin(MANSION.rotationY));

  for (let c = 0; c < CLUSTERS; c++) {
    const cx = (seeded(c * 3.7) - 0.5) * 2 * (TERRAIN_EXTENT - 40);
    const cz = (seeded(c * 9.1 + 4) - 0.5) * 2 * (TERRAIN_EXTENT - 40);
    // A cluster wholly out of the fan or past the reach is skipped whole,
    // which is what keeps this to one pass over the same sequence rather than
    // 83,600 terrain lookups for a view that can see perhaps a third of them.
    const cd = Math.hypot(cx - EYE_WORLD.x, cz - EYE_WORLD.z);
    if (cd > TREE_REACH + CLUSTER_SPREAD) continue;
    if (cd > CLUSTER_SPREAD * 2) {
      let bearing =
        Math.atan2(cx - EYE_WORLD.x, -(cz - EYE_WORLD.z)) - outward;
      bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
      if (Math.abs(bearing) > FAN_HALF_ANGLE + CLUSTER_SPREAD / cd + 0.1) continue;
    }
    const density = 0.45 + seeded(c * 5.3) * 0.55;

    for (let i = 0; i < PER_CLUSTER; i++) {
      if (seeded(c * 100 + i * 1.7) > density) continue;
      const angle = seeded(c * 31 + i * 2.9) * Math.PI * 2;
      const radius = Math.sqrt(seeded(c * 17 + i * 4.1)) * CLUSTER_SPREAD;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;

      const height = terrainHeight(x, z);
      if (height < BEACH_TOP + 1.5 || height > treeLineAt(x, z)) continue;
      if (underBuildings(x, z)) continue;
      if (terrainSlope(x, z, 6) > TREE_MAX_SLOPE) continue;
      if (seeded(c * 41 + i * 6.1) > 0.4 + 0.6 * canopy(x, z)) continue;

      const broad = height < BROADLEAF_TOP && seeded(c * 53 + i * 7.3) > 0.55;
      out.push({
        x,
        y: height,
        z,
        height:
          (broad ? 6 + seeded(c * 13 + i) * 3.5 : 7 + seeded(c * 13 + i) * 5) *
          (1 - (height / TREE_LINE) * 0.35),
        rotationY: seeded(c * 7 + i * 3.3) * Math.PI * 2,
        dark: seeded(c * 23 + i * 5.9) > 0.5,
        broad,
      });
    }
  }
  return out;
}

/**
 * Crowns only, no trunks.
 *
 * `Forest.tsx` draws a trunk under every tree because its player flies among
 * them at fifty units. The nearest tree this balcony can see is the better
 * part of a hundred out and the median is past two hundred, where a trunk is a
 * third of a pixel of brown behind a crown that covers it — so the whole
 * instanced mesh would be a draw call spent on nothing. Cutting it halves the
 * geometry here.
 */
function TreeCover({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  const trees = useMemo(scatterTrees, []);
  const pines = useMemo(() => trees.filter((t) => !t.broad), [trees]);
  const broadleaves = useMemo(() => trees.filter((t) => t.broad), [trees]);
  const pineRef = useRef<THREE.InstancedMesh>(null!);
  const broadRef = useRef<THREE.InstancedMesh>(null!);

  // White, and coloured per instance — the same trap `Forest.tsx` documents:
  // a material already in pine green under a pine-green instance colour draws
  // every crown at pine squared, which is very nearly black.
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffffff", vertexColors: false }),
    []
  );
  const lastTint = useRef(new THREE.Color());
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const paint = (list: Tree[], mesh: THREE.InstancedMesh, lit: THREE.Color, dark: THREE.Color, broad: boolean) => {
      const colors = new Float32Array(list.length * 3);
      const c = new THREE.Color();
      list.forEach((t, i) => {
        dummy.position.set(t.x, t.y + t.height * (broad ? 0.62 : 0.56), t.z);
        dummy.rotation.set(0, t.rotationY, 0);
        if (broad) dummy.scale.set(t.height * 0.42, t.height * 0.4, t.height * 0.42);
        else dummy.scale.set(t.height * 0.3, t.height * 0.78, t.height * 0.3);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // Each crown carries its own distance, so a stand on a far ridge sits
        // in the same haze as the ridge and a near one keeps its green.
        const d = Math.hypot(t.x - EYE_WORLD.x, t.z - EYE_WORLD.z);
        const haze = smoothstep(HAZE_NEAR, HAZE_FAR, d) * HAZE_CEILING;
        c.copy(t.dark ? dark : lit).lerp(HAZE_COLOR, haze);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    paint(pines, pineRef.current, PINE, PINE_DARK, false);
    paint(broadleaves, broadRef.current, LEAF, LEAF_DARK, true);
  }, [pines, broadleaves]);

  useFrame(() => {
    if (lastTint.current.equals(tintRef.current)) return;
    lastTint.current.copy(tintRef.current);
    material.color.copy(tintRef.current).multiplyScalar(EXPOSURE);
  });

  return (
    <group>
      <instancedMesh ref={pineRef} args={[undefined, undefined, pines.length]} material={material}>
        <coneGeometry args={[1, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={broadRef} args={[undefined, undefined, broadleaves.length]} material={material}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </group>
  );
}

/**
 * One far balloon, in the hall's materials.
 *
 * The shape is the distant cluster's own — eight gores off the shared
 * `PROFILE`, a basket under it — but rebuilt unlit here rather than imported,
 * for the reason the whole exterior is unlit: `DistantBalloons` shades with
 * Lambert, and Lambert three hundred units outside a candlelit hall is black.
 * What is *not* rebuilt is where they are or how they move: position, radius,
 * colour and drift all come from the associations world, so the four seen from
 * this rail are the four the telescope magnifies and the four the helicopter
 * flies under.
 *
 * Nor is the burner. `BurnerFlame` is already unlit — additive cones and a
 * sprite, out of the fog, reading the clock itself — which is exactly what this
 * view needs, so it hangs here whole rather than in a second version. It was
 * the one part of a balloon this file left out, and leaving it out made the
 * balcony the only place on the site that shows this cluster without fire: the
 * telescope three units along the rail magnifies the same four *with* their
 * burners lit, and after sunset the naked-eye view had four grey shapes over a
 * dark range with nothing to say they were still flying.
 */
function buildFarEnvelope(): THREE.BufferGeometry {
  const GORES = 8;
  const phi = (Math.PI * 2) / GORES;
  const positions: number[] = [];
  const indices: number[] = [];
  const groups: { start: number; count: number; material: number }[] = [];
  const rows = PROFILE.length;

  for (let g = 0; g < GORES; g++) {
    const base = g * rows * 2;
    for (const [y, w] of PROFILE) {
      for (let c = 0; c <= 1; c++) {
        const angle = g * phi + c * phi;
        positions.push(Math.cos(angle) * w, y, Math.sin(angle) * w);
      }
    }
    const start = indices.length;
    for (let r = 0; r < rows - 1; r++) {
      const a = base + r * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    groups.push({ start, count: indices.length - start, material: g % 2 });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  for (const { start, count, material } of groups) geometry.addGroup(start, count, material);
  return geometry;
}

function ConnectBalloons({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const envelope = useMemo(buildFarEnvelope, []);

  /**
   * Two materials a balloon, plus one shared for the baskets. Hazed at build
   * time off the range's own curve, so a balloon is always in the same air as
   * the ridge behind it rather than in front of the whole view.
   *
   * At the moment that comes to no haze at all: the four fly 316 to 377 out
   * from this eye and the curve does not start until 380. That is the curve
   * doing its job, not an exemption — the hillside they float over is just as
   * clear at that range — and it follows HAZE_NEAR wherever it goes next.
   */
  const skins = useMemo(
    () =>
      FAR_BALLOONS.map((b) => {
        const d = Math.hypot(b.x - EYE_WORLD.x, b.z - EYE_WORLD.z);
        const haze = smoothstep(HAZE_NEAR, HAZE_FAR, d);
        const mix = (hex: string) =>
          new THREE.Color(hex).lerp(HAZE_COLOR, haze);
        return [
          new THREE.MeshBasicMaterial({ color: mix(b.a) }),
          new THREE.MeshBasicMaterial({ color: mix(b.b) }),
        ];
      }),
    []
  );
  const basketMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color("#6f5a41").lerp(HAZE_COLOR, 0.5) }),
    []
  );
  const bases = useMemo(() => skins.map((pair) => pair.map((m) => m.color.clone())), [skins]);
  const basketBase = useMemo(() => basketMat.color.clone(), [basketMat]);

  useEffect(
    () => () => {
      envelope.dispose();
      skins.flat().forEach((m) => m.dispose());
      basketMat.dispose();
    },
    [envelope, skins, basketMat]
  );

  const offset = useMemo(() => new THREE.Vector3(), []);
  const lastTint = useRef(new THREE.Color());

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    FAR_BALLOONS.forEach((b, i) => {
      const group = groups.current[i];
      if (!group) return;
      // The world's own drift function, not a copy of it: two implementations
      // would put these four in one place from the air and a couple of units
      // off from this rail, and nothing could say which was lying.
      farBalloonDrift(t, b.phase, offset);
      group.position.set(
        b.x + offset.x,
        MIN_ALTITUDE + b.aboveFloor + offset.y,
        b.z + offset.z
      );
    });

    if (lastTint.current.equals(tintRef.current)) return;
    lastTint.current.copy(tintRef.current);
    skins.forEach((pair, i) =>
      pair.forEach((m, k) => m.color.copy(bases[i][k]).multiply(tintRef.current).multiplyScalar(EXPOSURE))
    );
    basketMat.color.copy(basketBase).multiply(tintRef.current).multiplyScalar(EXPOSURE);
  });

  return (
    <group>
      {FAR_BALLOONS.map((b, i) => (
        <group
          key={i}
          ref={(node) => {
            groups.current[i] = node;
          }}
          position={[b.x, MIN_ALTITUDE + b.aboveFloor, b.z]}
        >
          <mesh geometry={envelope} material={skins[i]} scale={b.radius} />
          <mesh material={basketMat} position={[0, -b.radius * BASKET_DROP, 0]}>
            <boxGeometry args={[b.radius * 0.3, b.radius * 0.26, b.radius * 0.3]} />
          </mesh>
          {/* Standing off the top of the basket, at the cluster's own drop and
              rise and its own over-life-size flame — see `DistantBalloons`,
              which argues that size for this exact range. No tint and no
              EXPOSURE on it, unlike everything else past this rail: those two
              stand in for daylight falling on a surface, and a flame is not a
              lit surface, it is the light. */}
          <group position={[0, b.radius * (BURNER_RISE - BASKET_DROP), 0]}>
            <BurnerFlame size={b.radius * FLAME} phase={b.phase} />
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * The sky the range stands against.
 *
 * A shell rather than the flat panel the old backdrop used. That panel was
 * sized for a view that finished 150 out; this one has to close over a fan
 * 156 degrees wide and 600 deep, and no plane covers that without being
 * enormous and obviously flat at the edges.
 */
function SkyShell({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: HAZE_COLOR.clone(),
        side: THREE.BackSide,
        depthWrite: false,
      }),
    []
  );
  const base = useMemo(() => HAZE_COLOR.clone(), []);
  const lastTint = useRef(new THREE.Color());
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    if (lastTint.current.equals(tintRef.current)) return;
    lastTint.current.copy(tintRef.current);
    material.color.copy(base).multiply(tintRef.current).multiplyScalar(EXPOSURE);
  });

  return (
    <mesh material={material} position={[EYE_WORLD.x, 0, EYE_WORLD.z]} renderOrder={-1}>
      <sphereGeometry args={[HORIZON_SHELL, 24, 16]} />
    </mesh>
  );
}

/** The range, the water past it, the four balloons over it, and the sky behind. */
function View({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  const range = useMemo(buildRange, []);
  const sea = useMemo(buildSea, []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: true }),
    []
  );
  const lastTint = useRef(new THREE.Color());
  useEffect(
    () => () => {
      range.dispose();
      sea.dispose();
      material.dispose();
    },
    [range, sea, material]
  );

  useFrame(() => {
    if (lastTint.current.equals(tintRef.current)) return;
    lastTint.current.copy(tintRef.current);
    // The clock's tint multiplies the baked colours, the same contract the
    // cliff and the sea kept before: the terrain keeps its own greens and
    // greys, and the hour only pushes them warm at dusk or blue after dark.
    material.color.copy(tintRef.current).multiplyScalar(EXPOSURE);
  });

  return (
    <group>
      <SkyShell tintRef={tintRef} />
      <mesh geometry={sea} material={material} />
      <mesh geometry={range} material={material} />
      <TreeCover tintRef={tintRef} />
      <ConnectBalloons tintRef={tintRef} />
    </group>
  );
}

/**
 * The view, stood on the mountain the exterior puts this balcony on.
 *
 * Two nested groups: the inner one carries the world to the eye, the outer
 * turns it onto the hall's own axes and sets it down on the hall's balcony.
 * Everything inside is therefore written in the associations world's real
 * coordinates and can be sampled straight out of that world's own functions,
 * which is the whole point — nothing in here restates a number that world
 * already owns.
 */
export function Overlook({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  return (
    <group position={EYE_HALL.toArray()} rotation={[0, VIEW_ROTATION, 0]}>
      <group position={[-EYE_WORLD.x, -EYE_WORLD.y, -EYE_WORLD.z]}>
        <View tintRef={tintRef} />
      </group>
    </group>
  );
}
