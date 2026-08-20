import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { buildIslandGeometry } from "../projects/islandGeometry";
import { ISLANDS } from "../projects/layout";
import { PALETTE } from "../projects/palette";
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
 * bay, it is the bay — the same six `ISLANDS`, the same seeds through the same
 * `buildIslandGeometry`, so every jittered coastline out there is the coastline
 * the boat actually sails past.
 *
 * What it is *not* carrying is the centerpieces, the shoreline boulders or the
 * palms. At this remove a factory is under a pixel across, and mounting six
 * project scenes to render nothing is a cost with no picture at the end of it —
 * the same call the clearing makes over there, where it crosses the strait as
 * bare terrain with neither its balloons nor its forest on it.
 */

/* -------------------------------------------------------------------------
   Where it stands, which is not a decision this file gets to make
   ---------------------------------------------------------------------- */

/**
 * Placement, inverted from the projects world's own.
 *
 * That world already states where these two places stand relative to each
 * other: it draws this clearing at `SCALE` of true size, `DISTANCE` out on
 * `BEARING`, turned by `ROTATION_Y`. Those four numbers are a complete
 * coordinate transform between the two worlds — and a transform has an
 * inverse. So rather than choosing a distance and a size over here and hoping
 * the two stories match, this reads them and runs the map backwards.
 *
 * The transform there is `w = R(rot)·(scale·c) + P`, taking a point `c` in
 * clearing units to a point `w` in the archipelago's. Solving for `c` gives
 * what a group in *this* world needs: scale `1/scale`, rotation `-rot`, and an
 * origin at `-P` carried through both. It comes out at (997, 0, 81) — a round
 * thousand units from the middle of the range, which is the arithmetic
 * agreeing with itself rather than a number anybody picked.
 *
 * The practical consequence: move the clearing over there and this moves with
 * it, in the right direction, by the right amount, for free.
 */
const INVERSE_SCALE = 1 / CLEARING_SCALE;
const INVERSE_ROTATION_Y = -CLEARING_ROTATION_Y;
const POSITION = (() => {
  // Where the clearing stands in the archipelago's world, negated: the vector
  // from the clearing back to the bay, still in the archipelago's units.
  const back = new THREE.Vector3(
    -Math.sin(CLEARING_BEARING) * CLEARING_DISTANCE,
    0,
    Math.cos(CLEARING_BEARING) * CLEARING_DISTANCE
  );
  // Then into this world's frame and units: undo the turn, undo the shrink.
  return back.applyAxisAngle(new THREE.Vector3(0, 1, 0), INVERSE_ROTATION_Y).multiplyScalar(INVERSE_SCALE);
})();

/* -------------------------------------------------------------------------
   Its own haze
   ---------------------------------------------------------------------- */

/**
 * The bay stands at a thousand units and the range's own fog closes at 525, so
 * on the scene's curve every one of these islands would be a flat sheet of
 * horizon grey. It runs on a private curve instead — the same device the
 * clearing uses to stand beyond this world's haze when seen from that one,
 * pointed the other way.
 *
 * A floor, and then a curve on top of it. The floor is the honest part: this
 * is a bay past the edge of the world's own visibility, and nothing out there
 * should ever resolve as though it were in the arena — even the near shore
 * arrives a third dissolved, which is what keeps six green discs from reading
 * as six green discs a short flight away. The curve is what stops the chain
 * being one flat cut-out: the islands are strung across 250 units of depth,
 * and the far ones sitting half again hazier than the near ones is most of
 * what makes the group read as a scatter on open water rather than a painted
 * strip. From the spawn it runs about 0.42 at the nearest shore to 0.63 at
 * the farthest; from the far side of the flight boundary, 0.35 to 0.73.
 *
 * The floor was 0.42 first and that was too much. At this size — the biggest
 * island is fifty pixels across and ten tall, seen from ten degrees above —
 * the only thing separating an island from the sea is its colour, and by 0.6
 * the greens and sands had come close enough to the day haze that the whole
 * chain read as a smudge on the water. Under half is where they stay islands.
 *
 * The curve begins at the scene's own FOG_FAR, imported rather than restated:
 * this world's air stops carrying detail at exactly the distance the bay
 * starts, so the two hand off at a seam instead of overlapping.
 */
const HAZE_FLOOR = 0.28;
const FOG_NEAR = SCENE_FOG_FAR;
const FOG_FAR = 1750;

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

/**
 * All six islands' bands merged into one geometry per band.
 *
 * Six islands times five bands is thirty draw calls for something that
 * occupies a fifteenth of the view; merged it is five. They can merge because
 * every band is non-indexed and position-only — the whole build is a copy with
 * the island's own offset added to each vertex.
 */
function buildArchipelago(): Record<Layer, THREE.BufferGeometry> {
  const merged = {} as Record<Layer, number[]>;
  for (const layer of LAYERS) merged[layer] = [];

  for (const spot of ISLANDS) {
    const island = buildIslandGeometry(spot.radius, spot.height, spot.seed, spot.plateauFraction);
    const [ox, oz] = spot.position;
    for (const layer of LAYERS) {
      const source = island[layer].getAttribute("position") as THREE.BufferAttribute;
      const target = merged[layer];
      for (let i = 0; i < source.count; i++) {
        target.push(source.getX(i) + ox, source.getY(i), source.getZ(i) + oz);
      }
    }
    // The source bands have been copied out; nothing downstream holds them.
    island.dispose();
  }

  const out = {} as Record<Layer, THREE.BufferGeometry>;
  for (const layer of LAYERS) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(merged[layer], 3));
    geometry.computeVertexNormals();
    out[layer] = geometry;
  }
  return out;
}

export function DistantArchipelago() {
  const bands = useMemo(() => buildArchipelago(), []);
  const materials = useMemo(() => {
    const out = {} as Record<Layer, THREE.MeshLambertMaterial>;
    for (const layer of LAYERS) {
      const material = new THREE.MeshLambertMaterial({
        color: LAYER_COLORS[layer],
        flatShading: true,
      });
      // The private fog curve: the stock linear-fog line with this bay's own
      // floor and near/far in place of the scene's. `fogColor` stays the scene
      // uniform, which is how ClearingLighting's day/night tint keeps reaching
      // it — these islands go grey at dusk with the range they are seen from.
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <fog_fragment>",
          `#ifdef USE_FOG
            float bayFog = float(${HAZE_FLOOR}) + float(${1 - HAZE_FLOOR})
              * smoothstep(float(${FOG_NEAR}), float(${FOG_FAR}), vFogDepth);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, bayFog);
          #endif`
        );
      };
      material.customProgramCacheKey = () => "distant-archipelago-fog";
      out[layer] = material;
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

  return (
    <group
      position={POSITION}
      rotation={[0, INVERSE_ROTATION_Y, 0]}
      scale={INVERSE_SCALE}
    >
      {LAYERS.map((layer) => (
        <mesh key={layer} geometry={bands[layer]} material={materials[layer]} />
      ))}
    </group>
  );
}
