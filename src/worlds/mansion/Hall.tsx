import { useMemo } from "react";
import { flatMaterial, PALETTE } from "./materials";
import {
  CEILING_HEIGHT,
  HALL_CENTER_Z,
  HALL_DEPTH,
  HALL_MAX_X,
  HALL_MAX_Z,
  HALL_MIN_X,
  HALL_MIN_Z,
  HALL_WIDTH,
  PILASTER_Z,
  WALL_THICKNESS,
} from "./layout";

/** Side of one floor tile. Divides the hall's 30 x 30 footprint evenly. */
const TILE = 2.5;
/** Width of the plain border band the checkerboard is inset from. */
const BORDER = 2.5;

const RUG_WIDTH = 11;
const RUG_DEPTH = 13;
const RUG_CENTER_Z = -3;

const WAINSCOT_HEIGHT = 3.4;
const CHAIR_RAIL_Y = WAINSCOT_HEIGHT;
const CORNICE_Y = CEILING_HEIGHT - 0.9;

/**
 * A checkerboard laid as one mesh per tile.
 *
 * ~100 small boxes is more draw calls than a texture would cost, but the site
 * has no textures anywhere and this keeps that rule — and at this count it is
 * still far cheaper than the 30,000 instanced grass blades the meadow runs.
 */
function Floor() {
  const lightMaterial = useMemo(() => flatMaterial(PALETTE.tileLight), []);
  const darkMaterial = useMemo(() => flatMaterial(PALETTE.tileDark), []);
  const borderMaterial = useMemo(() => flatMaterial(PALETTE.tileBorder), []);
  const rugMaterial = useMemo(() => flatMaterial(PALETTE.rug), []);
  const rugFieldMaterial = useMemo(() => flatMaterial(PALETTE.rugField), []);
  const rugTrimMaterial = useMemo(() => flatMaterial(PALETTE.rugTrim), []);

  const tiles = useMemo(() => {
    const minX = HALL_MIN_X + BORDER;
    const maxX = HALL_MAX_X - BORDER;
    const minZ = HALL_MIN_Z + BORDER;
    const maxZ = HALL_MAX_Z - BORDER;
    const columns = Math.round((maxX - minX) / TILE);
    const rows = Math.round((maxZ - minZ) / TILE);

    const out: { key: string; x: number; z: number; dark: boolean }[] = [];
    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < rows; r++) {
        out.push({
          key: `${c}-${r}`,
          x: minX + TILE * (c + 0.5),
          z: minZ + TILE * (r + 0.5),
          dark: (c + r) % 2 === 1,
        });
      }
    }
    return out;
  }, []);

  return (
    <group>
      {/* The border band doubles as the slab under the tiles, so the seams
          between them never open onto nothing.

          Its top face is held 15mm below the tiles' rather than level with them.
          Flush, the two are exactly coplanar over the whole checkerboard — both
          landed on y = 0 — and the depth buffer cannot separate them, so the
          floor flickers between border and tile as the camera moves. Dropping
          the slab is the fix that keeps the look: the border still reads as one
          plain band, and the tiles now sit proud of it the way tiles actually
          sit on a screed. */}
      <mesh material={borderMaterial} position={[0, -0.215, HALL_CENTER_Z]} receiveShadow>
        <boxGeometry args={[HALL_WIDTH, 0.4, HALL_DEPTH]} />
      </mesh>

      {/* The walking surface is y = 0, matching the meadow's ground plane — the
          shared character controller puts the character's soles just above it. */}
      {tiles.map(({ key, x, z, dark }) => (
        <mesh
          key={key}
          material={dark ? darkMaterial : lightMaterial}
          position={[x, -0.02, z]}
          receiveShadow
        >
          {/* Slightly under the pitch, so a thin dark grout line reads between tiles. */}
          <boxGeometry args={[TILE * 0.96, 0.04, TILE * 0.96]} />
        </mesh>
      ))}

      {/* Sits a centimetre proud of the tiles, the way a rug actually lies. */}
      <group position={[0, 0.01, RUG_CENTER_Z]}>
        <mesh material={rugMaterial} receiveShadow>
          <boxGeometry args={[RUG_WIDTH, 0.04, RUG_DEPTH]} />
        </mesh>
        <mesh material={rugTrimMaterial} position={[0, 0.012, 0]} receiveShadow>
          <boxGeometry args={[RUG_WIDTH - 0.7, 0.04, RUG_DEPTH - 0.7]} />
        </mesh>
        <mesh material={rugFieldMaterial} position={[0, 0.024, 0]} receiveShadow>
          <boxGeometry args={[RUG_WIDTH - 1.5, 0.04, RUG_DEPTH - 1.5]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Walls in three bands: dark panelled wainscot to chair-rail height, plaster
 * above it, and a cornice under the ceiling. Solid slabs — the windows are
 * recessed frames applied to them rather than openings cut through, since
 * nothing outside the hall is ever seen through one.
 */
function Walls() {
  const wallMaterial = useMemo(() => flatMaterial(PALETTE.wall), []);
  const upperMaterial = useMemo(() => flatMaterial(PALETTE.wallUpper), []);
  const wainscotMaterial = useMemo(() => flatMaterial(PALETTE.wainscot), []);
  const panelMaterial = useMemo(() => flatMaterial(PALETTE.wainscotPanel), []);
  const railMaterial = useMemo(() => flatMaterial(PALETTE.chairRail), []);
  const corniceMaterial = useMemo(() => flatMaterial(PALETTE.cornice), []);

  const sideX = [HALL_MIN_X + WALL_THICKNESS / 2, HALL_MAX_X - WALL_THICKNESS / 2];
  const endZ = [HALL_MIN_Z + WALL_THICKNESS / 2, HALL_MAX_Z - WALL_THICKNESS / 2];

  /** Panel centres along a wall of the given span. */
  const panels = (min: number, max: number) => {
    const count = Math.floor((max - min) / 3.2);
    const pitch = (max - min) / count;
    return Array.from({ length: count }, (_, i) => ({ at: min + pitch * (i + 0.5), size: pitch * 0.72 }));
  };

  const sidePanels = useMemo(() => panels(HALL_MIN_Z, HALL_MAX_Z), []);
  const endPanels = useMemo(() => panels(HALL_MIN_X, HALL_MAX_X), []);

  return (
    <group>
      {sideX.map((x, side) => {
        const inward = side === 0 ? 1 : -1;
        return (
          <group key={`side-${side}`}>
            <mesh material={upperMaterial} position={[x, CEILING_HEIGHT / 2, HALL_CENTER_Z]} receiveShadow>
              <boxGeometry args={[WALL_THICKNESS, CEILING_HEIGHT, HALL_DEPTH]} />
            </mesh>
            <mesh
              material={wainscotMaterial}
              position={[x + inward * 0.06, WAINSCOT_HEIGHT / 2, HALL_CENTER_Z]}
              receiveShadow
            >
              <boxGeometry args={[WALL_THICKNESS, WAINSCOT_HEIGHT, HALL_DEPTH]} />
            </mesh>
            {sidePanels.map((panel, i) => (
              <mesh
                key={i}
                material={panelMaterial}
                position={[x + inward * 0.12, WAINSCOT_HEIGHT / 2, panel.at]}
                receiveShadow
              >
                <boxGeometry args={[WALL_THICKNESS, WAINSCOT_HEIGHT - 1, panel.size]} />
              </mesh>
            ))}
            <mesh material={railMaterial} position={[x + inward * 0.1, CHAIR_RAIL_Y, HALL_CENTER_Z]}>
              <boxGeometry args={[WALL_THICKNESS + 0.3, 0.26, HALL_DEPTH]} />
            </mesh>
            <mesh material={corniceMaterial} position={[x + inward * 0.1, CORNICE_Y, HALL_CENTER_Z]}>
              <boxGeometry args={[WALL_THICKNESS + 0.5, 0.6, HALL_DEPTH]} />
            </mesh>
          </group>
        );
      })}

      {endZ.map((z, side) => {
        const inward = side === 0 ? 1 : -1;
        return (
          <group key={`end-${side}`}>
            <mesh material={wallMaterial} position={[0, CEILING_HEIGHT / 2, z]} receiveShadow>
              <boxGeometry args={[HALL_WIDTH, CEILING_HEIGHT, WALL_THICKNESS]} />
            </mesh>
            <mesh
              material={wainscotMaterial}
              position={[0, WAINSCOT_HEIGHT / 2, z + inward * 0.06]}
              receiveShadow
            >
              <boxGeometry args={[HALL_WIDTH, WAINSCOT_HEIGHT, WALL_THICKNESS]} />
            </mesh>
            {endPanels.map((panel, i) => (
              <mesh
                key={i}
                material={panelMaterial}
                position={[panel.at, WAINSCOT_HEIGHT / 2, z + inward * 0.12]}
                receiveShadow
              >
                <boxGeometry args={[panel.size, WAINSCOT_HEIGHT - 1, WALL_THICKNESS]} />
              </mesh>
            ))}
            <mesh material={railMaterial} position={[0, CHAIR_RAIL_Y, z + inward * 0.1]}>
              <boxGeometry args={[HALL_WIDTH, 0.26, WALL_THICKNESS + 0.3]} />
            </mesh>
            <mesh material={corniceMaterial} position={[0, CORNICE_Y, z + inward * 0.1]}>
              <boxGeometry args={[HALL_WIDTH, 0.6, WALL_THICKNESS + 0.5]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Ceiling() {
  const ceilingMaterial = useMemo(() => flatMaterial(PALETTE.ceiling), []);
  const beamMaterial = useMemo(() => flatMaterial(PALETTE.beam), []);

  const crossZ = [10, 4, -2, -8, -14, -20];

  return (
    <group>
      <mesh material={ceilingMaterial} position={[0, CEILING_HEIGHT + 0.3, HALL_CENTER_Z]}>
        <boxGeometry args={[HALL_WIDTH, 0.6, HALL_DEPTH]} />
      </mesh>

      {crossZ.map((z) => (
        <mesh key={z} material={beamMaterial} position={[0, CEILING_HEIGHT - 0.35, z]} castShadow>
          <boxGeometry args={[HALL_WIDTH, 0.7, 0.55]} />
        </mesh>
      ))}

      {/* Two runs down the hall, so the ceiling reads as a coffered grid rather
          than as ribs. */}
      {[-6, 6].map((x) => (
        <mesh key={x} material={beamMaterial} position={[x, CEILING_HEIGHT - 0.25, HALL_CENTER_Z]}>
          <boxGeometry args={[0.5, 0.5, HALL_DEPTH]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Half-columns standing against the side walls. Flush to the wall rather than
 * free-standing so the walk boundary alone keeps the visitor out of them — a
 * column out in the room would need its own collision circle for no gain in a
 * hall this size.
 */
function Pilasters() {
  const shaftMaterial = useMemo(() => flatMaterial(PALETTE.pilaster), []);
  const trimMaterial = useMemo(() => flatMaterial(PALETTE.pilasterTrim), []);

  const xs = [HALL_MIN_X + WALL_THICKNESS / 2 + 0.35, HALL_MAX_X - WALL_THICKNESS / 2 - 0.35];
  const shaftHeight = CORNICE_Y - WAINSCOT_HEIGHT - 1.2;

  return (
    <group>
      {xs.map((x) =>
        PILASTER_Z.map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh material={trimMaterial} position={[0, WAINSCOT_HEIGHT + 0.25, 0]} castShadow>
              <boxGeometry args={[0.9, 0.5, 1.7]} />
            </mesh>
            {/* 6 sides, flat shaded — a faceted half-shaft rather than a smooth one. */}
            <mesh
              material={shaftMaterial}
              position={[0, WAINSCOT_HEIGHT + 0.5 + shaftHeight / 2, 0]}
              rotation={[0, Math.PI / 6, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.6, 0.68, shaftHeight, 6]} />
            </mesh>
            <mesh
              material={trimMaterial}
              position={[0, WAINSCOT_HEIGHT + 0.5 + shaftHeight + 0.3, 0]}
              castShadow
            >
              <boxGeometry args={[1.05, 0.6, 1.9]} />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

/** Floor, walls, coffered ceiling and the pilaster rhythm down the sides. */
export function Hall() {
  return (
    <group>
      <Floor />
      <Walls />
      <Ceiling />
      <Pilasters />
    </group>
  );
}
