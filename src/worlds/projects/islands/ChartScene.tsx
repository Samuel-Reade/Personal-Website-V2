import { PALETTE } from "../palette";
import { flatMat } from "../materials";

/**
 * ASA DataFest: a single row of four bars on a plinth, climbing left to right.
 *
 * It was a 6×5 grid of thirty bars — a genuine two-axis field, which is the more
 * honest picture of the work but reads as a city block from any distance, and
 * from the water that is all you ever see of it. Four bars is the shape a bar
 * chart has in everyone's head, and at this size it is legible from clear across
 * the bay, which is the job this island actually has to do.
 *
 * It has since lost both of its axis planes — a full-width panel behind the
 * bars, then the vertical axis at the low end. Both were there to say the
 * heights were measured against something, and both ended up competing with the
 * thing they were framing: flat slabs are the largest surfaces on the island,
 * and under its real-clock lighting they go to grey and take the eye first. The
 * bars carry it alone now, with open sky on every side, which is what the
 * saturated palette needs to be seen against.
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
 *
 * With nothing behind the bars to measure them against, this is now the only
 * thing carrying that read, which is the argument for keeping the steps uneven.
 */
const HEIGHTS = [3.2, 5.0, 7.6, 11.4];

/**
 * Cool to warm up the series, so the climb is carried by the colour as well as
 * the height and survives being seen as a silhouette against the sky.
 */
const BAR_COLORS = [PALETTE.chartBarA, PALETTE.chartBarB, PALETTE.chartBarC, PALETTE.chartBarE];

const SPAN = (HEIGHTS.length - 1) * SPACING + BAR;

/**
 * The plinth, and with it the whole footprint.
 *
 * Sized against the *narrowest* the plateau gets rather than its nominal radius:
 * the island's rings are jittered per side by as much as ±16%, so a piece laid
 * out against the average overhangs wherever the coastline pinches in. At the
 * island's radius of 11 and a plateau fraction of 0.6 the tight side comes in at
 * about 5.55, and this plinth's half-diagonal is 5.13.
 */
const PLINTH_W = 9.6;
const PLINTH_D = 3.6;
const PLINTH_H = 0.34;

export function ChartScene() {
  return (
    <group>
      {/* Plinth. The last flat surface here, and the one that earns it — it is
          what stops the bars reading as four posts driven into a hilltop. */}
      <mesh material={flatMat(PALETTE.chartBase)} position={[0, PLINTH_H / 2, 0]}>
        <boxGeometry args={[PLINTH_W, PLINTH_H, PLINTH_D]} />
      </mesh>

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
