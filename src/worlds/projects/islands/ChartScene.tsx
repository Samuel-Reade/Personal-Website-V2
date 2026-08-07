import { PALETTE } from "../palette";
import { flatMat } from "../materials";

/**
 * ASA DataFest: a single row of four bars, climbing left to right.
 *
 * It was a 6×5 grid of thirty bars — a genuine two-axis field, which is the more
 * honest picture of the work but reads as a city block from any distance, and
 * from the water that is all you ever see of it. Four bars is the shape a bar
 * chart has in everyone's head, and at this size it is legible from clear across
 * the bay, which is the job this island actually has to do.
 *
 * The bars carry no encoded values. The project's real figures live in the
 * content panel a click away, and inventing a four-way breakdown to hang on
 * these would be making data up about a data project.
 */

/** Footprint of each bar. Square, so it reads as a solid from any bearing. */
const BAR = 1.8;
const SPACING = 2.3;

/**
 * Climbing, and deliberately not in equal steps — a chart whose bars rise by the
 * same amount each time reads as a staircase, which is a shape, not a
 * measurement. The gaps widen instead, so it reads as growth.
 */
const HEIGHTS = [3.2, 5.0, 7.6, 11.4];

/**
 * Cool to warm up the series, so the climb is carried by the colour as well as
 * the height and survives being seen as a silhouette against the sky.
 */
const BAR_COLORS = [PALETTE.chartBarA, PALETTE.chartBarB, PALETTE.chartBarC, PALETTE.chartBarE];

const SPAN = (HEIGHTS.length - 1) * SPACING + BAR;
const TALLEST = Math.max(...HEIGHTS);

/**
 * The plinth, and with it the whole footprint.
 *
 * Sized against the *narrowest* the plateau gets rather than its nominal radius:
 * the island's rings are jittered per side by as much as ±16%, so a piece laid
 * out against the average overhangs wherever the coastline pinches in. At the
 * island's radius of 11 and a plateau fraction of 0.6 the tight side comes in at
 * about 5.54, and this plinth's half-diagonal is 5.13.
 */
const PLINTH_W = 9.6;
const PLINTH_D = 3.6;
const PLINTH_H = 0.34;

/**
 * The vertical axis, standing just clear of the tallest bar.
 *
 * There was a back panel across the full width behind the bars as well. It read
 * as a billboard rather than as a backdrop — the largest single surface in the
 * frame, and at night, when this island's real-clock lighting mutes the bars to
 * browns and greys, it was the loudest thing on the island. Gone, so the bars
 * stand against open sky and the colour has something to be seen against.
 */
const WALL_H = TALLEST + 0.9;
const WALL_T = 0.16;
/** Ticks up the axis, which is what reads the bars as measured rather than piled. */
const GRID_STEP = 2;

export function ChartScene() {
  const gridLines = Math.floor((WALL_H - 0.4) / GRID_STEP);

  return (
    <group>
      {/* Plinth */}
      <mesh material={flatMat(PALETTE.chartBase)} position={[0, PLINTH_H / 2, 0]}>
        <boxGeometry args={[PLINTH_W, PLINTH_H, PLINTH_D]} />
      </mesh>

      {/* The one remaining axis, standing at the low end of the series so the
          climb reads away from it. Four boxes on a slab are just four boxes;
          something to measure against is what makes them a chart. */}
      <mesh
        material={flatMat(PALETTE.chartBase)}
        position={[-PLINTH_W / 2 + WALL_T / 2, PLINTH_H + WALL_H / 2, 0]}
      >
        <boxGeometry args={[WALL_T, WALL_H, PLINTH_D]} />
      </mesh>

      {/* Ticks up the axis, proud of both its faces so they read from either
          side — the island is approached from one bearing but rowed around. */}
      {Array.from({ length: gridLines }, (_, i) => (
        <mesh
          key={`tick${i}`}
          material={flatMat(PALETTE.chartGrid)}
          position={[-PLINTH_W / 2 + WALL_T / 2, PLINTH_H + (i + 1) * GRID_STEP, 0]}
        >
          <boxGeometry args={[WALL_T + 0.09, 0.07, PLINTH_D - 0.3]} />
        </mesh>
      ))}

      {HEIGHTS.map((height, i) => {
        const x = i * SPACING - SPAN / 2 + BAR / 2;
        return (
          <group key={i} position={[x, PLINTH_H, 0]}>
            <mesh material={flatMat(BAR_COLORS[i])} position={[0, height / 2, 0]}>
              <boxGeometry args={[BAR, height, BAR]} />
            </mesh>
            {/* A lighter cap, so the tops still read as tops from the boat's low
                angle — side-on, an uncapped bar loses its end entirely. */}
            <mesh material={flatMat(PALETTE.chartGrid)} position={[0, height + 0.06, 0]}>
              <boxGeometry args={[BAR + 0.09, 0.12, BAR + 0.09]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
