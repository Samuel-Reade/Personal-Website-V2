import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildIslandGeometry, type IslandGeometry } from "../projects/islandGeometry";
import { FOG_FAR as BAY_FOG_FAR, ISLANDS, SEA_RADIUS } from "../projects/layout";
import { PALETTE } from "../projects/palette";
import { Centerpiece } from "../projects/islands";
import {
  BEARING as CLEARING_BEARING,
  DISTANCE as CLEARING_DISTANCE,
  ROTATION_Y as CLEARING_ROTATION_Y,
  SCALE as CLEARING_SCALE,
} from "../projects/DistantClearing";
import { FOG_FAR as SCENE_FOG_FAR } from "./layout";

/**
 * The projects world's archipelago, standing far off the east coast.
 *
 * The other half of `projects/DistantClearing`, and the same rule as every
 * other place this site reaches across worlds: this is not a painting of that
 * bay, it is the bay. The same seven `ISLANDS`, the same seeds through the same
 * `buildIslandGeometry`, and — since it now carries them — the same seven
 * `Centerpiece` scenes the boat rows up to: the works and its runway, the
 * chart on its plinth, the film set, the gym floor, the phone, the machine
 * between its belts, and the queue at the ballot box. Every one the actual
 * scene rather than a stand-in.
 *
 * One island out here is this world's alone: an empty rock standing well clear
 * of the chain. It is the single exception to the rule above, and the section
 * on it below is where it has to be earned.
 *
 * They are meant to be almost too far to make out, and they are. At this
 * remove a chimney is a few pixels and a voter is a fraction of one, so what
 * arrives is the suggestion that each island is inhabited by something
 * particular — which is the whole of what a bay across the water gives you.
 * They also carry a deeper haze than the land under them (below), because
 * fine detail is the first thing distance takes.
 *
 * The cost of that honesty is worth stating: the centerpieces are a couple of
 * hundred small meshes, none instanced, drawn for a tenth of the view. It is
 * the same trade the mansion on the north peak makes, for the same reason — a
 * world that reaches across to another should show what is actually over there.
 */

/* -------------------------------------------------------------------------
   Where it stands
   ---------------------------------------------------------------------- */

/**
 * Placement, inverted from the projects world's own.
 *
 * That world already states where these two places stand relative to each
 * other: it draws this clearing at `SCALE` of true size, `DISTANCE` out on
 * `BEARING`, turned by `ROTATION_Y`. Those four numbers are a complete
 * coordinate transform between the two worlds — and a transform has an
 * inverse. So rather than choosing a bearing and a size over here and hoping
 * the two stories match, this reads them and runs the map backwards.
 *
 * The transform there is `w = R(rot)·(scale·c) + P`, taking a point `c` in
 * clearing units to a point `w` in the archipelago's. Solving for `c` gives
 * what a group in *this* world needs: scale `1/scale`, rotation `-rot`, and an
 * origin at `-P` carried through both. That comes out at (997, 0, 81) — a
 * round thousand units from the middle of the range, which is the arithmetic
 * agreeing with itself rather than a number anybody picked.
 *
 * Move the clearing over there and the bearing, the turn and the size all
 * follow, in the right direction, by the right amount.
 */
const INVERSE_SCALE = 1 / CLEARING_SCALE;
const INVERSE_ROTATION_Y = -CLEARING_ROTATION_Y;

/**
 * How much further out than that it actually stands — a judgement rather than
 * a derivation, and so the one number here that has to argue for itself.
 *
 * At the derived thousand the bay sat close enough to read as somewhere you
 * might reach, which is the wrong impression: there is no flying to it, the
 * boundary holds at 110, and an island whose shape you can make out but can
 * never arrive at reads as a tease rather than as distance. Half again as far
 * puts it at 1500 — for a world whose own haze gives out at 525 and whose land
 * ends at 600. The chain narrows from fifteen degrees of the view to under
 * ten, its shores drop to under seven degrees below the eye, and the whole
 * thing settles onto the horizon as something across the water rather than
 * across the bay.
 *
 * The honest cost: with this in, the two worlds no longer agree about the
 * distance between them — the projects world's clearing implies a thousand,
 * this stands at fifteen hundred. Direction and relative size still come
 * straight off that transform, so the disagreement is exactly one number and
 * it is written down here. Nothing can show the seam; you cannot see both
 * skies at once.
 */
const STANDOFF = 1.5;

const POSITION = (() => {
  // Where the clearing stands in the archipelago's world, negated: the vector
  // from the clearing back to the bay, still in the archipelago's units.
  const back = new THREE.Vector3(
    -Math.sin(CLEARING_BEARING) * CLEARING_DISTANCE,
    0,
    Math.cos(CLEARING_BEARING) * CLEARING_DISTANCE
  );
  // Then into this world's frame and units: undo the turn, undo the shrink,
  // and stand it off.
  return back
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), INVERSE_ROTATION_Y)
    .multiplyScalar(INVERSE_SCALE * STANDOFF);
})();

/* -------------------------------------------------------------------------
   The island past that bay's own fog
   ---------------------------------------------------------------------- */

/**
 * One more island, standing well off the chain, and the only land out here the
 * boat has no name for.
 *
 * The seven are the projects, one apiece, and there is no eighth project. What
 * this is instead is the thing a bay across the water nearly always has and
 * this one did not: land that carries nothing. Seven islands each holding one
 * work read as a display of seven islands; a bare rock off to one side, useful
 * to nobody, is most of what turns the same seven into a coast.
 *
 * It is placed rather than derived, so it owes two arguments: how far out, and
 * which way.
 */

/**
 * How far out: the exact distance at which the projects world's own air erases
 * it.
 *
 * This island is not in `ISLANDS`, and the rule this file opens with allows
 * nothing over here that is absent over there. It keeps that rule by standing
 * where the projects world could not show it if it tried. That sea's haze
 * finishes at `BAY_FOG_FAR`, measured from the boat, and the boat may travel
 * `SEA_RADIUS` from its origin — so anything at or past the sum is solid fog
 * from every vantage in that world, the nearest one included. Drawing it there
 * would be drawing fog, which is why it is not drawn there.
 *
 * Written as the sum rather than as the 207 it comes to: move that boundary or
 * that haze and this island moves with them, staying exactly at the edge of
 * what the boat could ever see.
 */
const OUTLIER_DISTANCE = BAY_FOG_FAR + SEA_RADIUS;

/**
 * Which way: square across the line of sight, so the distance buys separation
 * instead of depth.
 *
 * 207 is a long way in that bay's units — five ring radii — and it has to be
 * spent somewhere. Spent along the sightline it would put the rock 490 units
 * beyond the chain, where the curve below reaches 0.78 and this file's own
 * warning applies: past 0.6 an island stops reading as an island. Spent
 * sideways it costs almost no depth at all, 1579 against the chain's 1500, and
 * lands at 0.59 — the weight of the chain's own far shore.
 *
 * So it sits about eighteen degrees off the middle of the group, better than a
 * chain's width of open water clear of the nearest island: far enough that
 * nobody counts it as the eighth of anything, close enough that it is plainly
 * the same water.
 *
 * The quarter turn is taken off `POSITION` rather than written down, for the
 * reason everything here is: the line of sight is whatever the two worlds'
 * transform makes it, and a hand-set bearing would drift the moment the
 * clearing moved. North as the clearing sees it, which is the side the bay's
 * own southward lean leaves the emptier — south would read much the same, and
 * there is nothing else out there to prefer either.
 */
const OUTLIER_POSITION = (() => {
  // The clearing's line of sight, brought into the bay's own frame — undoing
  // the group's turn is the whole of it, since a scale cannot tilt a direction.
  const sight = POSITION.clone()
    .normalize()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), -INVERSE_ROTATION_Y);
  return sight
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    .multiplyScalar(OUTLIER_DISTANCE);
})();

/**
 * The rock itself.
 *
 * Sized to the middle of the chain rather than under it: alone and a little
 * hazier than its neighbours, a small island would go to nothing, and the
 * point of it is to be seen and to be plainly empty. The seed carries on the
 * chain's own run, and the plateau fraction is the one number that says what
 * it is — nothing stands on it, so it keeps its slope and comes up a dome
 * where the working islands are tables.
 */
const OUTLIER = {
  radius: 12,
  height: 2.6,
  seed: 127,
  plateauFraction: 0.34,
};

/* -------------------------------------------------------------------------
   Its own haze
   ---------------------------------------------------------------------- */

/**
 * The bay stands at fifteen hundred units and the range's own fog closes at
 * 525, so on the scene's curve every one of these islands would be a flat
 * sheet of horizon grey. It runs on a private curve instead — the same device
 * the clearing uses to stand beyond this world's haze when seen from that one,
 * pointed the other way.
 *
 * A floor, and then a curve on top of it. The floor is the honest part: this
 * is a bay past the edge of the world's own visibility, and nothing out there
 * should resolve as though it were in the arena. The curve is what stops the
 * chain being one flat cut-out — the islands are strung across 250 units of
 * depth, and the far ones sitting a little hazier than the near ones is most
 * of what makes the group read as a scatter on open water rather than as a
 * painted strip. From the spawn it runs about 0.50 at the nearest shore to
 * 0.61 at the farthest.
 *
 * The floor was 0.42 once and that was too much. At this size the only thing
 * separating an island from the sea is its colour, and past about 0.6 the
 * greens and sands close on the day haze until the chain reads as a smudge on
 * the water. Under half is where they stay islands.
 *
 * FOG_NEAR is the scene's own FOG_FAR, imported rather than restated: this
 * world's air stops carrying detail at exactly the distance the bay starts, so
 * the two hand off at a seam instead of overlapping. FOG_FAR grew from 1750
 * with the standoff — on the old curve the far islands sat past its end, which
 * is not haze but deletion.
 */
const HAZE_FLOOR = 0.28;
const FOG_NEAR = SCENE_FOG_FAR;
const FOG_FAR = 2850;

/**
 * The centerpieces stand a step deeper into the same air.
 *
 * Not a stylistic dimmer — it is what distance does. A hundred kilometres of
 * haze takes the contrast out of a small object long before it takes the shape
 * out of the landmass behind it, which is why a far coast still reads as a
 * coast while everything standing on it has gone. At 0.44 the works and the
 * chart and the queue sit about ten points hazier than the island under them:
 * still there, still identifiably something, never sharp.
 */
const CENTERPIECE_HAZE_FLOOR = 0.44;

/** GLSL float literal. `525` has to reach the shader as `525.0000`, not `525`. */
const glsl = (n: number) => n.toFixed(4);

/**
 * Swaps the stock linear-fog line for this bay's own curve, in place.
 *
 * `fogColor` stays the scene uniform, which is how ClearingLighting's day and
 * night tint keeps reaching it — these islands go grey at dusk with the range
 * they are seen from.
 */
function applyBayHaze<T extends THREE.Material>(material: T, floor: number): T {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <fog_fragment>",
      `#ifdef USE_FOG
        float bayFog = ${glsl(floor)} + ${glsl(1 - floor)}
          * smoothstep(${glsl(FOG_NEAR)}, ${glsl(FOG_FAR)}, vFogDepth);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, bayFog);
      #endif`
    );
  };
  // Keyed on the floor: the two curves compile to two different programs, and
  // three would otherwise hand the second one the first one's shader.
  material.customProgramCacheKey = () => `bay-haze-${floor}`;
  return material;
}

/* -------------------------------------------------------------------------
   Geometry
   ---------------------------------------------------------------------- */

/** The five bands every island is built from, outermost first. */
type Layer = "shore" | "beach" | "lower" | "upper" | "cap";
const LAYERS: Layer[] = ["shore", "beach", "lower", "upper", "cap"];

/** The archipelago's own colours, one per band — the islands as the boat sees them. */
const LAYER_COLORS: Record<Layer, string> = {
  shore: PALETTE.sandDark,
  beach: PALETTE.sand,
  lower: PALETTE.slope,
  upper: PALETTE.grassDark,
  cap: PALETTE.grass,
};

interface Archipelago {
  /** The seven islands and the outlier, merged one geometry per band. */
  bands: Record<Layer, THREE.BufferGeometry>;
  /**
   * Where each island's plateau sits, in ISLANDS order — read off the geometry
   * that built it rather than recomputed, so the centerpiece cannot drift off
   * the ground it is supposed to stand on.
   */
  plateauYs: number[];
}

/**
 * The eight island bodies, merged into one geometry per band.
 *
 * Eight islands times five bands is forty draw calls for the land alone;
 * merged it is five. They merge because every band is non-indexed and
 * position-only — the whole build is a copy with the island's own offset added
 * to each vertex. The centerpieces cannot be folded in the same way: they are
 * React scenes with their own animation, so they stay real objects.
 */
function buildArchipelago(): Archipelago {
  const merged = {} as Record<Layer, number[]>;
  for (const layer of LAYERS) merged[layer] = [];
  const plateauYs: number[] = [];

  /** Copies one body's bands into the merge, offset to where it stands. */
  const collect = (island: IslandGeometry, ox: number, oz: number) => {
    for (const layer of LAYERS) {
      const source = island[layer].getAttribute("position") as THREE.BufferAttribute;
      const target = merged[layer];
      for (let i = 0; i < source.count; i++) {
        target.push(source.getX(i) + ox, source.getY(i), source.getZ(i) + oz);
      }
    }
  };

  for (const spot of ISLANDS) {
    const island = buildIslandGeometry(spot.radius, spot.height, spot.seed, spot.plateauFraction);
    collect(island, spot.position[0], spot.position[1]);
    plateauYs.push(island.plateauY);
    // The source bands have been copied out; nothing downstream holds them.
    island.dispose();
  }

  // The outlier joins the same merge and nothing else. Its plateau height is
  // never recorded because nothing is ever placed on it — `plateauYs` is read
  // by index against `ISLANDS`, and an eighth entry here would be an eighth
  // island for a seventh centerpiece to stand on.
  const outlier = buildIslandGeometry(
    OUTLIER.radius,
    OUTLIER.height,
    OUTLIER.seed,
    OUTLIER.plateauFraction
  );
  collect(outlier, OUTLIER_POSITION.x, OUTLIER_POSITION.z);
  outlier.dispose();

  const bands = {} as Record<Layer, THREE.BufferGeometry>;
  for (const layer of LAYERS) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(merged[layer], 3));
    geometry.computeVertexNormals();
    bands[layer] = geometry;
  }
  return { bands, plateauYs };
}

export function DistantArchipelago() {
  const { bands, plateauYs } = useMemo(() => buildArchipelago(), []);
  const materials = useMemo(() => {
    const out = {} as Record<Layer, THREE.MeshLambertMaterial>;
    for (const layer of LAYERS) {
      out[layer] = applyBayHaze(
        new THREE.MeshLambertMaterial({ color: LAYER_COLORS[layer], flatShading: true }),
        HAZE_FLOOR
      );
    }
    return out;
  }, []);

  useEffect(
    () => () => {
      for (const layer of LAYERS) {
        bands[layer].dispose();
        materials[layer].dispose();
      }
    },
    [bands, materials]
  );

  /**
   * The centerpieces arrive wearing the archipelago's own shared materials —
   * `flatMat` hands the same cached instance to every mesh in every project
   * scene, and to the boat. Those must not be patched: a fog curve written
   * into one of them would follow the visitor back through the portal and haze
   * the island they were standing on.
   *
   * So each distinct material is cloned once for this group and the curve goes
   * on the clone. Per source rather than per mesh — a couple of hundred meshes
   * share a dozen or so colours between them, and compiling two hundred
   * programs for a dozen shaders is the kind of thing that shows up as a stall
   * on arrival.
   *
   * Done in an effect rather than declaratively because these are another
   * world's components: the honest way to reach into a subtree you do not own
   * is after it has mounted, and effects run children-first, so by here it
   * has.
   *
   * Each mesh keeps its original on `userData.baySource`, and the swap is
   * always made *from* that rather than from whatever the mesh is wearing now.
   * That is what makes the pass symmetric, which StrictMode requires: it mounts
   * effects, tears them down and mounts them again, so a version that read the
   * live material would clone its own clone, and a cleanup that disposed
   * without restoring would leave the second pass holding disposed materials
   * and the real unmount leaking them.
   */
  const centerpieces = useRef<THREE.Group>(null!);
  useEffect(() => {
    const root = centerpieces.current;
    if (!root) return;
    const clones = new Map<THREE.Material, THREE.Material>();
    const swapped: THREE.Mesh[] = [];
    const haze = (source: THREE.Material) => {
      let clone = clones.get(source);
      if (!clone) {
        clone = applyBayHaze(source.clone(), CENTERPIECE_HAZE_FLOOR);
        clones.set(source, clone);
      }
      return clone;
    };

    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = (mesh.userData.baySource ?? mesh.material) as THREE.Mesh["material"];
      mesh.userData.baySource = source;
      mesh.material = Array.isArray(source) ? source.map(haze) : haze(source);
      swapped.push(mesh);
    });

    return () => {
      for (const mesh of swapped) mesh.material = mesh.userData.baySource;
      clones.forEach((clone) => clone.dispose());
    };
  }, []);

  return (
    <group position={POSITION} rotation={[0, INVERSE_ROTATION_Y, 0]} scale={INVERSE_SCALE}>
      {LAYERS.map((layer) => (
        <mesh key={layer} geometry={bands[layer]} material={materials[layer]} />
      ))}

      {/* Each island's own scene, on its plateau and turned the way the bay
          turns it — the same placement `projects/Island` uses, minus the
          proximity glow and the click target, neither of which means anything
          from fifteen hundred units away in another world. */}
      <group ref={centerpieces}>
        {ISLANDS.map((spot, i) => (
          <group
            key={spot.id}
            position={[spot.position[0], plateauYs[i], spot.position[1]]}
            rotation={[0, spot.rotationY, 0]}
          >
            <Centerpiece id={spot.id} />
          </group>
        ))}
      </group>
    </group>
  );
}
