import { useMemo } from "react";
import { flatMaterial, PALETTE } from "./materials";
import {
  BALCONY_BACK_Z,
  BALCONY_FRONT_Z,
  BALCONY_INNER_X,
  BALCONY_OUTER_X,
  BALCONY_THICKNESS,
  LANDING_Y,
  RISER,
  STAIR_INNER_RADIUS,
  STAIR_OUTER_RADIUS,
  STAIR_PIVOT_X,
  STAIR_PIVOT_Z,
  STAIR_WIDTH,
  stairSteps,
  STEP_COUNT,
} from "./layout";

/** Depth of one tread, measured along the centre line of the curve. */
const TREAD_DEPTH = ((Math.PI / 2) * ((STAIR_INNER_RADIUS + STAIR_OUTER_RADIUS) / 2)) / STEP_COUNT;
const TREAD_THICKNESS = 0.16;
/** Width of the runner carpet down the middle of each flight. */
const RUNNER_WIDTH = STAIR_WIDTH * 0.55;

const RAIL_HEIGHT = 1.05;
const POST_EVERY = 3;

/**
 * One flight: treads and risers swept through a quarter turn, a solid stringer
 * closing the outer edge, and a balustrade along the inner one where it faces
 * the portal.
 *
 * `side` is +1 for the right-hand flight and -1 for the left, mirroring x. The
 * mirror is applied to each step's position and rotation rather than by scaling
 * the whole group by -1, which would invert triangle winding and light the
 * flight from the inside.
 */
function Flight({ side }: { side: 1 | -1 }) {
  const treadMaterial = useMemo(() => flatMaterial(PALETTE.stairTread), []);
  const stringMaterial = useMemo(() => flatMaterial(PALETTE.stairString), []);
  const runnerMaterial = useMemo(() => flatMaterial(PALETTE.stairRunner), []);
  const balusterMaterial = useMemo(() => flatMaterial(PALETTE.baluster), []);
  const railMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);

  const steps = useMemo(() => stairSteps(side), [side]);

  return (
    <group>
      {steps.map((step, i) => {
        const [x, , z] = step.position;
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, step.rotationY, 0]}>
            {/* Tread. */}
            <mesh material={treadMaterial} position={[0, step.top - TREAD_THICKNESS / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[STAIR_WIDTH, TREAD_THICKNESS, TREAD_DEPTH]} />
            </mesh>
            {/* Runner, a shade proud of the tread. */}
            <mesh material={runnerMaterial} position={[0, step.top + 0.012, 0]} receiveShadow>
              <boxGeometry args={[RUNNER_WIDTH, 0.04, TREAD_DEPTH * 0.98]} />
            </mesh>
            {/* Riser, closing the front of the step. */}
            <mesh
              material={stringMaterial}
              position={[0, step.top - TREAD_THICKNESS - RISER / 2, TREAD_DEPTH / 2 - 0.06]}
              castShadow
            >
              <boxGeometry args={[STAIR_WIDTH, RISER, 0.12]} />
            </mesh>
            {/* Outer stringer: a slab from the floor up to this tread, so the
                flight reads as solid masonry from the side rather than as a
                staircase floating on nothing. */}
            <mesh
              material={stringMaterial}
              position={[side * (STAIR_WIDTH / 2 - 0.09), step.top / 2, 0]}
              receiveShadow
            >
              <boxGeometry args={[0.18, step.top, TREAD_DEPTH]} />
            </mesh>

            {/* Balustrade along the inner edge, facing the gap. */}
            {i % POST_EVERY === 0 && (
              <mesh
                material={balusterMaterial}
                position={[-side * (STAIR_WIDTH / 2 - 0.16), step.top + RAIL_HEIGHT / 2, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.07, 0.09, RAIL_HEIGHT, 6]} />
              </mesh>
            )}
            {/* Rail segment. Pitched to meet its neighbours: one riser of climb
                across one tread of run is exactly the flight's slope. */}
            <mesh
              material={railMaterial}
              position={[-side * (STAIR_WIDTH / 2 - 0.16), step.top + RAIL_HEIGHT, 0]}
              rotation={[Math.atan2(RISER, TREAD_DEPTH), 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.16, 0.13, Math.hypot(TREAD_DEPTH, RISER) + 0.02]} />
            </mesh>
          </group>
        );
      })}

      {/* Newel at the foot of the flight, where the balustrade starts. */}
      <group
        position={[
          side * (STAIR_PIVOT_X + STAIR_INNER_RADIUS + 0.2),
          0,
          STAIR_PIVOT_Z + TREAD_DEPTH * 0.6,
        ]}
      >
        <mesh material={railMaterial} position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[0.34, 1.5, 0.34]} />
        </mesh>
        <mesh material={balusterMaterial} position={[0, 1.6, 0]} castShadow>
          <boxGeometry args={[0.42, 0.22, 0.42]} />
        </mesh>
      </group>
    </group>
  );
}

/** The balcony a flight arrives on, running from the gap out to the side wall. */
function Balcony({ side }: { side: 1 | -1 }) {
  const slabMaterial = useMemo(() => flatMaterial(PALETTE.balcony), []);
  const balusterMaterial = useMemo(() => flatMaterial(PALETTE.baluster), []);
  const railMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);

  const width = BALCONY_OUTER_X - BALCONY_INNER_X;
  const depth = BALCONY_FRONT_Z - BALCONY_BACK_Z;
  const centerX = side * (BALCONY_INNER_X + width / 2);
  const centerZ = (BALCONY_FRONT_Z + BALCONY_BACK_Z) / 2;

  /**
   * The run of balustrade along the front edge stops short of the flight's
   * arrival, so the stair opens onto the balcony instead of being fenced off
   * from it.
   */
  const railFrom = BALCONY_INNER_X + 0.2;
  const railTo = BALCONY_OUTER_X - 0.2;
  const posts = useMemo(() => {
    const count = Math.max(2, Math.round((railTo - railFrom) / 0.85));
    return Array.from({ length: count + 1 }, (_, i) => railFrom + ((railTo - railFrom) * i) / count);
  }, [railFrom, railTo]);

  return (
    <group>
      <mesh
        material={slabMaterial}
        position={[centerX, LANDING_Y - BALCONY_THICKNESS / 2, centerZ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, BALCONY_THICKNESS, depth]} />
      </mesh>

      {/* Corbels under the slab, so it isn't a plank hanging in mid-air. */}
      {[0.3, 0.62, 0.9].map((t) => (
        <mesh
          key={t}
          material={slabMaterial}
          position={[side * (BALCONY_INNER_X + width * t), LANDING_Y - 0.75, BALCONY_FRONT_Z - 0.3]}
          castShadow
        >
          <boxGeometry args={[0.5, 0.8, 0.5]} />
        </mesh>
      ))}

      {posts.map((x) => (
        <mesh
          key={x}
          material={balusterMaterial}
          position={[side * x, LANDING_Y + 0.5, BALCONY_FRONT_Z - 0.18]}
          castShadow
        >
          <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
        </mesh>
      ))}
      <mesh
        material={railMaterial}
        position={[side * ((railFrom + railTo) / 2), LANDING_Y + 1.05, BALCONY_FRONT_Z - 0.18]}
        castShadow
      >
        <boxGeometry args={[railTo - railFrom + 0.3, 0.14, 0.2]} />
      </mesh>
    </group>
  );
}

/**
 * The grand double staircase: two quarter-turn flights sweeping up and inward
 * from either side of the hall onto balconies against the back wall, leaving the
 * centre open. That opening is the whole point of the arrangement — it is where
 * the portal stands.
 */
export function Staircases() {
  return (
    <group>
      {([1, -1] as const).map((side) => (
        <group key={side}>
          <Flight side={side} />
          <Balcony side={side} />
        </group>
      ))}
    </group>
  );
}
