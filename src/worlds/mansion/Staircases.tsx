import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { flatMaterial, PALETTE } from "./materials";
import {
  BALCONY_BACK_Z,
  BALCONY_FRONT_Z,
  BALCONY_OUTER_X,
  BALCONY_THICKNESS,
  LANDING_Y,
  RISER,
  STAIR_INNER_RADIUS,
  STAIR_OUTER_RADIUS,
  STAIR_PIVOT_X,
  STAIR_PIVOT_Z,
  STAIR_WIDTH,
  STEP_ANGLE,
  STEP_COUNT,
  WING_FRONT_Z,
  WING_INNER_X,
  WING_OUTER_X,
} from "./layout";

const R_MID = (STAIR_INNER_RADIUS + STAIR_OUTER_RADIUS) / 2;
/** A stone tread: thin, with a small nosing over the riser below it. */
const TREAD_THICKNESS = 0.06;
const NOSING = 0.035;
const NOSE_ANGLE = NOSING / R_MID;
/**
 * How far below the line of the nosings the underside of the flight runs. The
 * flight is a ribbon of stone this thick, swept up the quarter turn, rather
 * than a solid block down to the floor — which is what makes it read as a
 * staircase you could stand under, and not as a wall with steps cut in it.
 */
const SOFFIT_DROP = 0.62;
/** Width of the runner carpet down the middle of each flight. */
const RUNNER_WIDTH = STAIR_WIDTH * 0.5;
const RUNNER_THICKNESS = 0.02;

/** Balusters stand this far in from each edge of the tread, one per tread. */
const BALUSTER_INSET = 0.2;
const RAIL_HEIGHT = 0.92;
const RAIL_RADIUS = 0.05;
/** How far in from the gallery's front edge its rail line runs. */
const RAIL_INSET = 0.18;
/**
 * The head newels: the inner one on the top tread just inside the head line
 * (the landing's front rail dies into it), the outer one on the gallery slab
 * itself, on the gallery's rail line — it is the post the gallery's front
 * rail starts from, and the flight's outer rail sweeps up into the same
 * post, so the balustrade reads as one run from the hall floor to the wall.
 */
const HEAD_NEWEL_DX = 0.15;
/**
 * The outer head newel stands just past the top tread's outer corner, so the
 * tread's end still opens straight onto the slab with no rail across it —
 * that half-metre is the second way off the flight, beside the landing.
 */
const OUTER_HEAD_NEWEL_DX = 0.5;
const GALLERY_RAIL_Z = BALCONY_FRONT_Z - RAIL_INSET;

type Vec = [number, number, number];

/** The height of the line through the nosings at angle `a` up the sweep. */
const nosingLine = (a: number): number => RISER * (a / STEP_ANGLE + 1);
/** The underside of the flight at angle `a`; it meets the floor near the foot. */
const soffit = (a: number): number => Math.max(0, nosingLine(a) - SOFFIT_DROP);
/** Where the handrail runs: a constant height over the tread centres. */
const railLine = (a: number): number => RISER * (a / STEP_ANGLE + 0.5) + RAIL_HEIGHT;

/**
 * The flight's own geometry, built by hand: every part is a wedge of an
 * annulus — a sector between two angles and two radii — because that is what a
 * step on a curved stair is. The first version placed rectangular boxes along
 * the arc, and a rectangle on a curve gaps at the outer edge and overlaps at
 * the inner one, so the outside of each flight was a wall of slots.
 *
 * Three buffers, one per material: the treads, the body under them (risers,
 * sides and soffit), and the runner. Non-indexed, so `computeVertexNormals`
 * gives one normal per facet — the flat shading everything in the hall wears.
 *
 * `side` is +1 for the right-hand flight and -1 for the left. It is folded into
 * the point function rather than applied as a negative scale on the group,
 * which would invert triangle winding and light the flight from the inside;
 * each face's winding is checked against the direction it should face instead,
 * so mirroring costs nothing.
 */
function buildFlight(side: 1 | -1) {
  const P = (r: number, a: number, y: number): Vec => [
    side * (STAIR_PIVOT_X + r * Math.cos(a)),
    y,
    STAIR_PIVOT_Z - r * Math.sin(a),
  ];
  /** Unit vector away from the pivot at angle `a`. */
  const radial = (a: number): Vec => [side * Math.cos(a), 0, -Math.sin(a)];
  /** Unit vector along the sweep, in the direction of climbing. */
  const tangent = (a: number): Vec => [-side * Math.sin(a), 0, -Math.cos(a)];
  const neg = (v: Vec): Vec => [-v[0], -v[1], -v[2]];

  const treads: number[] = [];
  const body: number[] = [];
  const runner: number[] = [];

  /** A quad, wound so its normal agrees with `expect`. Non-planar quads fold along p1–p3. */
  const quad = (out: number[], p1: Vec, p2: Vec, p3: Vec, p4: Vec, expect: Vec) => {
    const ux = p2[0] - p1[0], uy = p2[1] - p1[1], uz = p2[2] - p1[2];
    const vx = p3[0] - p1[0], vy = p3[1] - p1[1], vz = p3[2] - p1[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const flip = nx * expect[0] + ny * expect[1] + nz * expect[2] < 0;
    const [a, b, c, d] = flip ? [p1, p4, p3, p2] : [p1, p2, p3, p4];
    out.push(...a, ...b, ...c, ...a, ...c, ...d);
  };

  interface Faces {
    top?: boolean;
    bottom?: boolean;
    inner?: boolean;
    outer?: boolean;
    front?: boolean;
    back?: boolean;
  }
  /**
   * A sector box between angles a0..a1 and radii rIn..rOut, its bottom at yB0
   * (at a0) rising to yB1 (at a1), its top likewise yT0..yT1 — helical faces
   * where the two differ, flat where they don't. Only the faces asked for.
   */
  const wedge = (
    out: number[],
    rIn: number, rOut: number, a0: number, a1: number,
    yB0: number, yB1: number, yT0: number, yT1: number,
    faces: Faces
  ) => {
    const fiB = P(rIn, a0, yB0), foB = P(rOut, a0, yB0), fiT = P(rIn, a0, yT0), foT = P(rOut, a0, yT0);
    const biB = P(rIn, a1, yB1), boB = P(rOut, a1, yB1), biT = P(rIn, a1, yT1), boT = P(rOut, a1, yT1);
    const am = (a0 + a1) / 2;
    if (faces.top) quad(out, fiT, foT, boT, biT, [0, 1, 0]);
    if (faces.bottom) quad(out, fiB, foB, boB, biB, [0, -1, 0]);
    if (faces.inner) quad(out, fiB, fiT, biT, biB, neg(radial(am)));
    if (faces.outer) quad(out, foB, foT, boT, boB, radial(am));
    if (faces.front) quad(out, fiB, foB, foT, fiT, neg(tangent(a0)));
    if (faces.back) quad(out, biB, boB, boT, biT, tangent(a1));
  };

  const rIn = STAIR_INNER_RADIUS;
  const rOut = STAIR_OUTER_RADIUS;
  const runIn = R_MID - RUNNER_WIDTH / 2;
  const runOut = R_MID + RUNNER_WIDTH / 2;

  for (let i = 0; i < STEP_COUNT; i++) {
    const a0 = i * STEP_ANGLE;
    const a1 = (i + 1) * STEP_ANGLE;
    const top = (i + 1) * RISER;
    const previousTop = i * RISER;
    const under = top - TREAD_THICKNESS;
    const s0 = soffit(a0);
    const s1 = soffit(a1);

    const nose = a0 - NOSE_ANGLE;

    // The tread: a thin slab with its nosing overhanging the riser.
    wedge(treads, rIn, rOut, nose, a1, under, under, top, top, {
      top: true, bottom: true, inner: true, outer: true, front: true,
    });

    // The body under it, down to the soffit: its sides show the stair's
    // profile, its underside is the sweep. No top — the tread covers it — and
    // no bottom where it stands on the floor.
    wedge(body, rIn, rOut, a0, a1, s0, s1, under, under, {
      bottom: s0 > 0 || s1 > 0, inner: true, outer: true, back: i === STEP_COUNT - 1,
    });
    // The riser: the body's front, from the tread below up to this one.
    quad(body, P(rIn, a0, previousTop), P(rOut, a0, previousTop), P(rOut, a0, under), P(rIn, a0, under), neg(tangent(a0)));

    // The runner: over the tread, and down the riser and nosing in front of it.
    wedge(runner, runIn, runOut, nose, a1, top, top, top + RUNNER_THICKNESS, top + RUNNER_THICKNESS, {
      top: true, inner: true, outer: true,
    });
    wedge(runner, runIn, runOut, nose - RUNNER_THICKNESS / R_MID, nose, previousTop + RUNNER_THICKNESS, previousTop + RUNNER_THICKNESS, top + RUNNER_THICKNESS, top + RUNNER_THICKNESS, {
      front: true, inner: true, outer: true,
    });
  }

  const toGeometry = (positions: number[]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  };
  return { treads: toGeometry(treads), body: toGeometry(body), runner: toGeometry(runner) };
}

/** The handrail's path: a helix at one radius, holding RAIL_HEIGHT over the treads. */
class RailCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private side: 1 | -1,
    private radius: number,
    private from: number,
    private to: number
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = this.from + (this.to - this.from) * t;
    return target.set(
      this.side * (STAIR_PIVOT_X + this.radius * Math.cos(a)),
      railLine(a),
      STAIR_PIVOT_Z - this.radius * Math.sin(a)
    );
  }
}

/**
 * A newel post: an octagonal shaft on a plinth, a square cap and a ball, in
 * the same dark bronze and white the gallery's posts wear. `height` is shaft
 * top above the base.
 */
function Newel({
  position,
  height,
  postMaterial,
  capMaterial,
}: {
  position: Vec;
  height: number;
  postMaterial: THREE.Material;
  capMaterial: THREE.Material;
}) {
  return (
    <group position={position}>
      <mesh material={postMaterial} position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.34, 0.12, 0.34]} />
      </mesh>
      <mesh material={postMaterial} position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.13, height, 8]} />
      </mesh>
      <mesh material={capMaterial} position={[0, height + 0.05, 0]} castShadow>
        <boxGeometry args={[0.32, 0.1, 0.32]} />
      </mesh>
      <mesh material={postMaterial} position={[0, height + 0.2, 0]} castShadow>
        <sphereGeometry args={[0.1, 8, 6]} />
      </mesh>
    </group>
  );
}

/**
 * One flight: thirty wedge-shaped stone treads swept through a quarter turn on
 * a ribbon of stone with a soffit under it, a runner down the middle, and a
 * balustrade along both edges the whole way — a baluster on every tread, a
 * handrail sweeping up as one helix on each side, a newel on the floor at
 * each foot and one at each head where the rails hand over to the landing's
 * and the gallery's.
 *
 * `side` is +1 for the right-hand flight and -1 for the left, mirroring x.
 */
function Flight({ side }: { side: 1 | -1 }) {
  const treadMaterial = useMemo(() => flatMaterial(PALETTE.stairTread), []);
  const stringMaterial = useMemo(() => flatMaterial(PALETTE.stairString), []);
  const runnerMaterial = useMemo(() => flatMaterial(PALETTE.stairRunner), []);
  const balusterMaterial = useMemo(() => flatMaterial(PALETTE.baluster), []);
  const railMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);

  const geometry = useMemo(() => buildFlight(side), [side]);

  const railRadii = useMemo(
    () => [STAIR_INNER_RADIUS + BALUSTER_INSET, STAIR_OUTER_RADIUS - BALUSTER_INSET],
    []
  );
  /** Both rails run from just before the first riser to the head line. */
  const railFrom = -1.2 * STEP_ANGLE;
  const railTo = Math.PI / 2 - 0.6 * STEP_ANGLE;

  const at = (r: number, a: number, y: number): Vec => [
    side * (STAIR_PIVOT_X + r * Math.cos(a)),
    y,
    STAIR_PIVOT_Z - r * Math.sin(a),
  ];
  const topTread = STEP_COUNT * RISER;
  /** The inner head newel: on the top tread, just inside the head line. */
  const innerHeadNewel: Vec = [side * (STAIR_PIVOT_X + HEAD_NEWEL_DX), topTread, WING_FRONT_Z - RAIL_INSET - 0.12];
  /** The outer head newel: on the gallery slab, on its rail line — the gallery's own corner post. */
  const outerHeadNewel: Vec = [side * (STAIR_PIVOT_X + OUTER_HEAD_NEWEL_DX), LANDING_Y, GALLERY_RAIL_Z];

  const rails = useMemo(() => {
    const [inner, outer] = railRadii;
    const helix = (radius: number) =>
      new THREE.TubeGeometry(new RailCurve(side, radius, railFrom, railTo), 48, RAIL_RADIUS, 6, false);
    // The outer rail's last piece: from the top of the helix up into the outer
    // head newel, which stands a little further back on the gallery's rail
    // line — the wreath a handrail turns through where it meets a landing.
    const end = at(outer, railTo, railLine(railTo));
    const wreath = new THREE.TubeGeometry(
      new THREE.LineCurve3(
        new THREE.Vector3(...end),
        new THREE.Vector3(outerHeadNewel[0], LANDING_Y + 1.05, outerHeadNewel[2])
      ),
      1,
      RAIL_RADIUS,
      6,
      false
    );
    return [helix(inner), helix(outer), wreath];
    // `at` and the newel positions are pure functions of side; listing them
    // would only re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, railRadii, railFrom, railTo]);

  useEffect(
    () => () => {
      geometry.treads.dispose();
      geometry.body.dispose();
      geometry.runner.dispose();
      rails.forEach((r) => r.dispose());
    },
    [geometry, rails]
  );

  return (
    <group>
      <mesh geometry={geometry.treads} material={treadMaterial} castShadow receiveShadow />
      <mesh geometry={geometry.body} material={stringMaterial} castShadow receiveShadow />
      <mesh geometry={geometry.runner} material={runnerMaterial} receiveShadow />

      {/* Balusters: one per tread at each edge, standing on the tread. */}
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const a = (i + 0.5) * STEP_ANGLE;
        const top = (i + 1) * RISER;
        return railRadii.map((radius) => (
          <mesh key={`${i}:${radius}`} material={balusterMaterial} position={at(radius, a, top + RAIL_HEIGHT / 2)} castShadow>
            <cylinderGeometry args={[0.04, 0.052, RAIL_HEIGHT, 6]} />
          </mesh>
        ));
      })}
      {rails.map((rail, i) => (
        <mesh key={i} geometry={rail} material={railMaterial} castShadow />
      ))}

      {/* Newels: one at each foot, on the floor before the first riser, the
          two in line; and one at each head — the inner on the top tread where
          the landing's front rail arrives, the outer on the gallery slab where
          the gallery's front rail starts — both sized so their tops and caps
          sit where the gallery's newels put theirs. */}
      {railRadii.map((radius) => (
        <Newel
          key={`foot${radius}`}
          position={at(radius, railFrom, 0)}
          height={railLine(railFrom) + 0.16}
          postMaterial={railMaterial}
          capMaterial={balusterMaterial}
        />
      ))}
      <Newel
        position={innerHeadNewel}
        height={LANDING_Y + 1.24 - topTread}
        postMaterial={railMaterial}
        capMaterial={balusterMaterial}
      />
      <Newel position={outerHeadNewel} height={1.24} postMaterial={railMaterial} capMaterial={balusterMaterial} />
    </group>
  );
}

/**
 * The gallery both flights arrive on: one slab running the full width of the
 * back of the hall, wall to wall, with a narrow shelf running forward along
 * each stair head so the flight meets the balcony at its last step — the
 * shelf's side face sits exactly on the head line, one riser above the top
 * tread (see WING_OUTER_X in layout.ts).
 *
 * The balustrade follows the slab's outline: a run across the middle between
 * the shelves, a stub across each shelf's front dying into the flight's head
 * newel, and a run from past each stair mouth out to the wall. The mouth
 * itself — the stretch of front edge one riser above the top tread — carries
 * no rail, because a rail there would fence the flight off from the gallery
 * it climbs to. Every cut end gets a newel, so the runs read as finished
 * rather than broken.
 */
function Gallery() {
  const slabMaterial = useMemo(() => flatMaterial(PALETTE.balcony), []);
  const balusterMaterial = useMemo(() => flatMaterial(PALETTE.baluster), []);
  const railMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);

  const width = BALCONY_OUTER_X * 2;
  const depth = BALCONY_FRONT_Z - BALCONY_BACK_Z;
  const centerZ = (BALCONY_FRONT_Z + BALCONY_BACK_Z) / 2;
  /** The two rail lines: along the main front edge, and along the wings'. */
  const railZ = GALLERY_RAIL_Z;
  const wingRailZ = WING_FRONT_Z - RAIL_INSET;

  const railTo = BALCONY_OUTER_X - 0.2;
  /** The shelf's inner rail line, just inside its walkable edge. */
  const wingInnerRail = WING_INNER_X + 0.2;
  /**
   * The short run across the landing's front dies into the flight's own inner
   * head newel, which stands on the top tread just past the head line — the
   * stub reaches to its centre so the two read as one piece of joinery.
   */
  const stubTo = STAIR_PIVOT_X + HEAD_NEWEL_DX;
  /**
   * The outer runs start from the flight's outer head newel, which stands on
   * this slab on the rail line at the same x — the flight's outer rail sweeps
   * up into that post and the gallery's rail leaves it, one balustrade from
   * the hall floor to the wall.
   */
  const outerRunFrom = STAIR_PIVOT_X + OUTER_HEAD_NEWEL_DX;

  /** Runs along x: centre, the stub across each shelf's front, each outer stretch. */
  const runs = useMemo<Array<{ from: number; to: number; z: number }>>(
    () => [
      { from: -wingInnerRail, to: wingInnerRail, z: railZ },
      { from: wingInnerRail, to: stubTo, z: wingRailZ },
      { from: -stubTo, to: -wingInnerRail, z: wingRailZ },
      { from: outerRunFrom, to: railTo, z: railZ },
      { from: -railTo, to: -outerRunFrom, z: railZ },
    ],
    [railTo, wingInnerRail, stubTo, outerRunFrom, railZ, wingRailZ]
  );
  /**
   * Returns along z: only the wings' *inner* sides, joining their front rail
   * back to the centre run — that edge hangs over the hall. The outer side gets
   * no return: one riser below it is the flight itself, and a rail there would
   * fence the landing off from its own stair.
   */
  const returns = useMemo<Array<{ x: number; from: number; to: number }>>(
    () =>
      ([1, -1] as const).map((side) => ({
        x: side * wingInnerRail,
        from: railZ,
        to: wingRailZ,
      })),
    [wingInnerRail, railZ, wingRailZ]
  );
  /**
   * A newel at every cut end and corner of the landings' rail, so the runs
   * read as finished. The outer runs' starting posts are the flights' own
   * outer head newels, drawn by Flight.
   */
  const newels = useMemo<Array<[number, number]>>(
    () =>
      ([1, -1] as const).flatMap((side): Array<[number, number]> => [
        [side * wingInnerRail, railZ],
        [side * wingInnerRail, wingRailZ],
      ]),
    [wingInnerRail, railZ, wingRailZ]
  );

  return (
    <group>
      <mesh
        material={slabMaterial}
        position={[0, LANDING_Y - BALCONY_THICKNESS / 2, centerZ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, BALCONY_THICKNESS, depth]} />
      </mesh>

      {/* The wing landings, butted exactly against the main slab's front edge —
          overlapping it would put two top faces on one plane and z-fight. */}
      {([1, -1] as const).map((side) => (
        <mesh
          key={`wing${side}`}
          material={slabMaterial}
          position={[
            side * ((WING_INNER_X + WING_OUTER_X) / 2),
            LANDING_Y - BALCONY_THICKNESS / 2,
            (BALCONY_FRONT_Z + WING_FRONT_Z) / 2,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[WING_OUTER_X - WING_INNER_X, BALCONY_THICKNESS, WING_FRONT_Z - BALCONY_FRONT_Z]}
          />
        </mesh>
      ))}

      {/* Corbels under the front edge, so it isn't a plank hanging in mid-air.
          Mirrored about the centre, and none at the middle itself — that is
          where the portal below stands, and a bracket would hang in its face. */}
      {([1, -1] as const).flatMap((side) =>
        [0.32, 0.62, 0.92].map((t) => (
          <mesh
            key={`${side}-${t}`}
            material={slabMaterial}
            position={[side * BALCONY_OUTER_X * t, LANDING_Y - 0.75, BALCONY_FRONT_Z - 0.3]}
            castShadow
          >
            <boxGeometry args={[0.5, 0.8, 0.5]} />
          </mesh>
        ))
      )}

      {runs.map(({ from, to, z }) => {
        const count = Math.max(1, Math.round((to - from) / 0.85));
        const posts = Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count);
        return (
          <group key={`${from}:${z}`}>
            {posts.map((x) => (
              <mesh
                key={x}
                material={balusterMaterial}
                position={[x, LANDING_Y + 0.5, z]}
                castShadow
              >
                <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
              </mesh>
            ))}
            <mesh
              material={railMaterial}
              position={[(from + to) / 2, LANDING_Y + 1.05, z]}
              castShadow
            >
              <boxGeometry args={[to - from + 0.1, 0.14, 0.2]} />
            </mesh>
          </group>
        );
      })}

      {returns.map(({ x, from, to }) => {
        const count = Math.max(1, Math.round(Math.abs(to - from) / 0.85));
        const posts = Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count);
        return (
          <group key={`r${x}`}>
            {posts.map((z) => (
              <mesh
                key={z}
                material={balusterMaterial}
                position={[x, LANDING_Y + 0.5, z]}
                castShadow
              >
                <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
              </mesh>
            ))}
            <mesh
              material={railMaterial}
              position={[x, LANDING_Y + 1.05, (from + to) / 2]}
              castShadow
            >
              <boxGeometry args={[0.2, 0.14, Math.abs(to - from) + 0.1]} />
            </mesh>
          </group>
        );
      })}

      {/* Newels at every corner of the wings' rail, finishing the joins. */}
      {newels.map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh material={railMaterial} position={[0, LANDING_Y + 0.62, 0]} castShadow>
            <boxGeometry args={[0.28, 1.24, 0.28]} />
          </mesh>
          <mesh material={balusterMaterial} position={[0, LANDING_Y + 1.32, 0]} castShadow>
            <boxGeometry args={[0.36, 0.18, 0.36]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The grand double staircase: two quarter-turn flights sweeping up and inward
 * from either side of the hall onto a single gallery along the back wall.
 *
 * The two runs used to arrive on separate balconies with the portal's opening
 * between them, which left each flight a dead end. They meet now — the gallery
 * carries across the middle — so either flight leads to the doorway at its
 * centre and to the other flight beyond it. The portal still stands in the
 * clear, three and a half units under the slab.
 */
export function Staircases() {
  return (
    <group>
      {([1, -1] as const).map((side) => (
        <Flight key={side} side={side} />
      ))}
      <Gallery />
    </group>
  );
}
