import { PALETTE } from "../palette";
import { flatMat, seeded } from "../materials";

/**
 * ASA DataFest: a genuine 3D bar chart — a grid of bars over two axes, not a
 * single row read from one side. It is also the most saturated thing in the
 * world on purpose; the surrounding islands are pastel, and this is meant to be
 * the object that pulls the eye from across the bay.
 */

const COLS = 6;
const ROWS = 5;
const SPACING = 0.62;
const BAR = 0.44;
const MAX_HEIGHT = 3.1;

const BAR_COLORS = [
  PALETTE.chartBarA,
  PALETTE.chartBarB,
  PALETTE.chartBarC,
  PALETTE.chartBarD,
  PALETTE.chartBarE,
];

const WIDTH = (COLS - 1) * SPACING;
const DEPTH = (ROWS - 1) * SPACING;

/**
 * Heights follow a smooth two-axis surface with a little seeded noise on top,
 * so the grid reads as data with structure in it — a ridge running across the
 * field — rather than as random posts. Pure noise looks like a bug; a pure
 * function looks like a graphics demo.
 */
function barHeight(col: number, row: number): number {
  const u = col / (COLS - 1);
  const v = row / (ROWS - 1);
  const ridge = Math.sin(u * Math.PI) * Math.cos((v - 0.5) * 1.7);
  const noise = seeded(col * 13.7 + row * 41.3) * 0.28;
  return 0.45 + Math.max(0, ridge) * MAX_HEIGHT * 0.82 + noise * MAX_HEIGHT * 0.2;
}

export function ChartScene() {
  const bars: { x: number; z: number; height: number; color: string }[] = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      bars.push({
        x: col * SPACING - WIDTH / 2,
        z: row * SPACING - DEPTH / 2,
        height: barHeight(col, row),
        // Coloured by height rather than by position, so the palette itself
        // encodes the value and the ridge reads as a gradient across the field.
        color: BAR_COLORS[Math.min(BAR_COLORS.length - 1, Math.floor((barHeight(col, row) / MAX_HEIGHT) * BAR_COLORS.length))],
      });
    }
  }

  return (
    <group>
      {/* Plinth */}
      <mesh material={flatMat(PALETTE.chartBase)} position={[0, 0.12, 0]}>
        <boxGeometry args={[WIDTH + 1.2, 0.24, DEPTH + 1.2]} />
      </mesh>
      {/* Grid lines scored into the plinth, along both axes — the fastest way to
          say "this surface has two dimensions of meaning". */}
      {Array.from({ length: COLS }, (_, i) => (
        <mesh
          key={`gx${i}`}
          material={flatMat(PALETTE.chartGrid)}
          position={[i * SPACING - WIDTH / 2, 0.25, 0]}
        >
          <boxGeometry args={[0.05, 0.02, DEPTH + 1.0]} />
        </mesh>
      ))}
      {Array.from({ length: ROWS }, (_, i) => (
        <mesh
          key={`gz${i}`}
          material={flatMat(PALETTE.chartGrid)}
          position={[0, 0.25, i * SPACING - DEPTH / 2]}
        >
          <boxGeometry args={[WIDTH + 1.0, 0.02, 0.05]} />
        </mesh>
      ))}

      {bars.map((bar, i) => (
        <group key={i} position={[bar.x, 0, bar.z]}>
          <mesh material={flatMat(bar.color)} position={[0, 0.24 + bar.height / 2, 0]}>
            <boxGeometry args={[BAR, bar.height, BAR]} />
          </mesh>
          {/* A lighter cap on each bar, so the tops of the field read as a
              surface when seen from the boat's low angle. */}
          <mesh material={flatMat(PALETTE.chartGrid)} position={[0, 0.24 + bar.height + 0.02, 0]}>
            <boxGeometry args={[BAR + 0.04, 0.05, BAR + 0.04]} />
          </mesh>
        </group>
      ))}

      {/* Two axis walls meeting at the back corner, which is what makes the
          whole thing read as a chart rather than as a city block. */}
      <mesh material={flatMat(PALETTE.chartBase)} position={[0, 1.7, -DEPTH / 2 - 0.62]}>
        <boxGeometry args={[WIDTH + 1.2, 3.4, 0.12]} />
      </mesh>
      <mesh material={flatMat(PALETTE.chartBase)} position={[-WIDTH / 2 - 0.62, 1.7, 0]}>
        <boxGeometry args={[0.12, 3.4, DEPTH + 1.2]} />
      </mesh>
      {[0.8, 1.6, 2.4, 3.2].map((y, i) => (
        <mesh key={i} material={flatMat(PALETTE.chartGrid)} position={[0, y, -DEPTH / 2 - 0.55]}>
          <boxGeometry args={[WIDTH + 1.0, 0.04, 0.03]} />
        </mesh>
      ))}
    </group>
  );
}
