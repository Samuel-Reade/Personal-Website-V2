import { useMemo } from "react";
import * as THREE from "three";
import { flatMaterial, PALETTE } from "./materials";
import { HALL_MAX_Z, WALL_THICKNESS } from "./layout";

/**
 * The front doors, on the wall the visitor spawns with their back to.
 *
 * The hall's whole composition faces the other way — the table, the portal, the
 * doorway to the balcony — so this wall was left blank, and turning round on
 * arrival found nothing but marble. These are what the visitor is meant to have
 * just walked through: a pair of tall doors, shut behind them, under the
 * grandest doorcase in the room.
 *
 * Shut, and staying shut. There is no opening cut in the wall here and nothing
 * to interact with: the way out of Reade Hall is the portal at the far end, and
 * a door that looked usable and wasn't would be a worse lie than a blank wall.
 * What it has to do is make the arrival read as an arrival.
 */

/** Inner face of the entry wall — the slab runs a metre back from HALL_MAX_Z. */
const WALL_Z = HALL_MAX_Z - WALL_THICKNESS;
/**
 * How far the doorcase stands off that face.
 *
 * Further than the balcony doorway's, because nothing here has to stay out of
 * a walking line: the dado already runs proud of this wall and the visitor
 * spawns eight units in front of it facing away.
 */
const RELIEF = 0.4;
/**
 * Where the leaves hang, in the group's own local space.
 *
 * The whole doorcase is built facing +z locally and then turned to face the
 * room (see the group at the end), which is what makes "further out" mean the
 * same thing everywhere in here. Built the other way round, every offset that
 * should have carried a moulding into the room carried it back into the
 * masonry instead — the doors ended up standing in front of their own
 * architrave, and the lantern lights inside the wall, lighting nothing.
 *
 * 0.2 clears the dado, which runs proud of this wall by 0.06.
 */
const LEAF_Z = 0.2;

const DOOR_HALF_WIDTH = 2.5;
const DOOR_HEIGHT = 6.6;
/** Where the leaves stop and the fanlight begins. */
const TRANSOM_Y = 5.4;
const LEAF_THICKNESS = 0.16;

/** Plinth the whole order stands on, so it meets the chequered floor properly. */
const PLINTH_HEIGHT = 0.34;

/** Column centres, outside the architrave. */
const COLUMN_X = DOOR_HALF_WIDTH + 0.92;
const COLUMN_RADIUS = 0.36;

/**
 * One engaged column: a moulded base, a fluted drum, and a capital. Round
 * rather than the flat pilasters the balcony doorway wears — this is the
 * ceremonial face of the room and it should be the richer of the two.
 */
function Column({
  x,
  stone,
  trim,
  brass,
}: {
  x: number;
  stone: THREE.Material;
  trim: THREE.Material;
  brass: THREE.Material;
}) {
  const baseTop = PLINTH_HEIGHT + 0.62;
  const capBottom = DOOR_HEIGHT + 0.42;
  const flutes = useMemo(
    () => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2),
    []
  );

  return (
    <group position={[x, 0, LEAF_Z + RELIEF]}>
      {/* Pedestal and base mouldings. */}
      <mesh material={trim} position={[0, PLINTH_HEIGHT / 2 + 0.12, 0]}>
        <boxGeometry args={[COLUMN_RADIUS * 2.5, PLINTH_HEIGHT + 0.24, COLUMN_RADIUS * 2.5]} />
      </mesh>
      <mesh material={stone} position={[0, baseTop - 0.14, 0]}>
        <cylinderGeometry args={[COLUMN_RADIUS + 0.1, COLUMN_RADIUS + 0.18, 0.28, 12]} />
      </mesh>

      {/* Shaft, with flutes standing proud around it. */}
      <mesh material={stone} position={[0, (baseTop + capBottom) / 2, 0]}>
        <cylinderGeometry args={[COLUMN_RADIUS, COLUMN_RADIUS + 0.03, capBottom - baseTop, 12]} />
      </mesh>
      {flutes.map((angle, i) => (
        <mesh
          key={i}
          material={trim}
          position={[
            Math.sin(angle) * COLUMN_RADIUS,
            (baseTop + capBottom) / 2,
            Math.cos(angle) * COLUMN_RADIUS,
          ]}
        >
          <cylinderGeometry args={[0.035, 0.035, capBottom - baseTop, 5]} />
        </mesh>
      ))}

      {/* Capital: astragal, bell, and a square abacus over it. */}
      <mesh material={brass} position={[0, capBottom + 0.05, 0]}>
        <cylinderGeometry args={[COLUMN_RADIUS + 0.04, COLUMN_RADIUS + 0.04, 0.1, 12]} />
      </mesh>
      <mesh material={stone} position={[0, capBottom + 0.26, 0]}>
        <cylinderGeometry args={[COLUMN_RADIUS + 0.24, COLUMN_RADIUS + 0.06, 0.32, 12]} />
      </mesh>
      <mesh material={trim} position={[0, capBottom + 0.5, 0]}>
        <boxGeometry args={[COLUMN_RADIUS * 2.9, 0.16, COLUMN_RADIUS * 2.9]} />
      </mesh>
      {/* Volutes on the two faces that read from the room. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={trim}
          position={[s * (COLUMN_RADIUS + 0.16), capBottom + 0.26, COLUMN_RADIUS * 0.4]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.09, 0.035, 5, 10]} />
        </mesh>
      ))}
    </group>
  );
}

/** One leaf, modelled from its hanging stile at local x = 0 out to +x. */
function Leaf({
  width,
  timber,
  timberDark,
  brass,
}: {
  width: number;
  timber: THREE.Material;
  timberDark: THREE.Material;
  brass: THREE.Material;
}) {
  const stile = 0.26;
  /** Three panels up the leaf: a tall one, a square one, and a low one. */
  const rails = [PLINTH_HEIGHT + 0.2, 2.5, 4.0, TRANSOM_Y - 0.18];

  return (
    <group>
      {/* Slab, then the framing over it. */}
      <mesh material={timberDark} position={[width / 2, (PLINTH_HEIGHT + TRANSOM_Y) / 2, 0]}>
        <boxGeometry args={[width, TRANSOM_Y - PLINTH_HEIGHT, LEAF_THICKNESS]} />
      </mesh>
      {[stile / 2, width - stile / 2].map((sx, i) => (
        <mesh
          key={i}
          material={timber}
          position={[sx, (PLINTH_HEIGHT + TRANSOM_Y) / 2, LEAF_THICKNESS * 0.2]}
        >
          <boxGeometry args={[stile, TRANSOM_Y - PLINTH_HEIGHT, LEAF_THICKNESS * 0.7]} />
        </mesh>
      ))}
      {rails.map((y, i) => (
        <mesh key={i} material={timber} position={[width / 2, y, LEAF_THICKNESS * 0.2]}>
          <boxGeometry args={[width, 0.22, LEAF_THICKNESS * 0.7]} />
        </mesh>
      ))}

      {/* Raised-and-fielded panels between the rails, each with a bolection
          moulding round it and a brass boss in the middle of the tall one. */}
      {[0, 1, 2].map((i) => {
        const bottom = rails[i] + 0.11;
        const top = rails[i + 1] - 0.11;
        const height = top - bottom;
        if (height <= 0.1) return null;
        return (
          <group key={i} position={[width / 2, (bottom + top) / 2, 0]}>
            <mesh material={timber} position={[0, 0, LEAF_THICKNESS * 0.34]}>
              <boxGeometry args={[width - stile * 2, height, LEAF_THICKNESS * 0.3]} />
            </mesh>
            <mesh material={timberDark} position={[0, 0, LEAF_THICKNESS * 0.5]}>
              <boxGeometry args={[width - stile * 2 - 0.26, height - 0.26, LEAF_THICKNESS * 0.24]} />
            </mesh>
            {i === 1 && (
              <mesh material={brass} position={[0, 0, LEAF_THICKNESS * 0.62]}>
                <sphereGeometry args={[0.1, 10, 8]} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Strap hinges on the hanging stile — the detail that says these are
          heavy and that they open outward, away from the room. */}
      {[PLINTH_HEIGHT + 0.7, TRANSOM_Y / 2 + 0.4, TRANSOM_Y - 0.7].map((y, i) => (
        <group key={i}>
          <mesh material={brass} position={[0.04, y, LEAF_THICKNESS * 0.4]}>
            <boxGeometry args={[0.12, 0.3, LEAF_THICKNESS * 0.9]} />
          </mesh>
          <mesh material={brass} position={[width * 0.24, y, LEAF_THICKNESS * 0.5]}>
            <boxGeometry args={[width * 0.42, 0.11, 0.04]} />
          </mesh>
        </group>
      ))}

      {/* A ring handle on a rosette, at the meeting stile. */}
      <mesh material={brass} position={[width - 0.3, 3.15, LEAF_THICKNESS * 0.5]}>
        <cylinderGeometry args={[0.17, 0.17, 0.05, 12]} />
      </mesh>
      <mesh
        material={brass}
        position={[width - 0.3, 3.0, LEAF_THICKNESS * 0.62]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.15, 0.032, 6, 14]} />
      </mesh>
    </group>
  );
}

export function EntryDoors() {
  const stone = useMemo(() => flatMaterial(PALETTE.cornice), []);
  const trim = useMemo(() => flatMaterial(PALETTE.pilasterTrim), []);
  const surround = useMemo(() => flatMaterial(PALETTE.windowSurround), []);
  const brass = useMemo(() => flatMaterial(PALETTE.brass), []);
  const timber = useMemo(() => flatMaterial(PALETTE.tableTop), []);
  const timberDark = useMemo(() => flatMaterial(PALETTE.tableBase), []);
  const flame = useMemo(
    () => flatMaterial(PALETTE.candle, { emissive: PALETTE.candle, emissiveIntensity: 1.1 }),
    []
  );
  const lampGlass = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: PALETTE.candle,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
      }),
    []
  );

  /** Radiating bars of the fanlight over the doors. */
  const fanBars = useMemo(() => Array.from({ length: 9 }, (_, i) => ((i + 1) / 10) * Math.PI), []);
  const fanRadius = DOOR_HALF_WIDTH - 0.16;

  const entablatureY = DOOR_HEIGHT + 1.28;
  const corniceY = entablatureY + 0.42;

  return (
    // Built facing +z and turned to face the room, so every offset in here
    // reads as "further into the hall". The mirror in x that the turn also
    // performs costs nothing: the doorcase is symmetric about its centre.
    <group position={[0, 0, WALL_Z]} rotation={[0, Math.PI, 0]}>
      {/* Plinth running under the whole order. */}
      <mesh material={surround} position={[0, PLINTH_HEIGHT / 2, LEAF_Z + RELIEF / 2]}>
        <boxGeometry args={[(COLUMN_X + 0.9) * 2, PLINTH_HEIGHT, RELIEF + 1.0]} />
      </mesh>

      {/* The doors, hung either side of the centre line and shut. */}
      {[
        { x: -DOOR_HALF_WIDTH, mirror: 1 },
        { x: DOOR_HALF_WIDTH, mirror: -1 },
      ].map((leaf) => (
        <group key={leaf.x} position={[leaf.x, 0, LEAF_Z]} scale={[leaf.mirror, 1, 1]}>
          <Leaf width={DOOR_HALF_WIDTH} timber={timber} timberDark={timberDark} brass={brass} />
        </group>
      ))}

      {/* Threshold under them. */}
      <mesh material={surround} position={[0, PLINTH_HEIGHT + 0.04, LEAF_Z - 0.08]}>
        <boxGeometry args={[DOOR_HALF_WIDTH * 2 + 0.3, 0.08, 0.5]} />
      </mesh>

      {/* Architrave: three steps around the opening, as the balcony doorway
          wears, so the two doorcases read as the same hand. */}
      {[
        { inset: 0.0, width: 0.2, depth: 0.16 },
        { inset: 0.2, width: 0.16, depth: 0.26 },
        { inset: 0.36, width: 0.14, depth: 0.36 },
      ].map((band, i) => {
        const halfW = DOOR_HALF_WIDTH + band.inset + band.width / 2;
        const z = LEAF_Z - band.depth / 2;
        const material = i === 1 ? trim : surround;
        return (
          <group key={i}>
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                material={material}
                position={[s * halfW, (PLINTH_HEIGHT + DOOR_HEIGHT) / 2 + 0.2, z]}
              >
                <boxGeometry args={[band.width, DOOR_HEIGHT - PLINTH_HEIGHT + 0.4, band.depth]} />
              </mesh>
            ))}
            <mesh
              material={material}
              position={[0, DOOR_HEIGHT + 0.2 + band.inset + band.width / 2, z]}
            >
              <boxGeometry
                args={[(DOOR_HALF_WIDTH + band.inset + band.width) * 2, band.width, band.depth]}
              />
            </mesh>
          </group>
        );
      })}

      {/* Fanlight over the doors: an open half-round of bars, like the balcony
          doorway's and unglazed for the same reason.

          Backed by a dark tympanum, because there is no opening cut behind
          these doors — left open the fan showed the lit marble of the wall
          through it, which read as a pale panel rather than as a window onto
          the night the visitor has just come in out of. */}
      <mesh material={timberDark} position={[0, TRANSOM_Y + 0.9, LEAF_Z + 0.16]}>
        <boxGeometry args={[DOOR_HALF_WIDTH * 2 - 0.1, 2.0, 0.08]} />
      </mesh>
      <mesh material={timber} position={[0, TRANSOM_Y, LEAF_Z + 0.02]}>
        <boxGeometry args={[DOOR_HALF_WIDTH * 2, 0.18, 0.16]} />
      </mesh>
      {/* Brass rather than timber, unlike the balcony doorway's: those read as
          dark bars against a bright sky, and these have a dark tympanum behind
          them, so only metal catching the lanterns makes the fan visible. */}
      {fanBars.map((angle, i) => (
        <mesh
          key={i}
          material={brass}
          position={[
            (Math.cos(angle) * fanRadius) / 2,
            TRANSOM_Y + (Math.sin(angle) * fanRadius) / 2,
            LEAF_Z + 0.02,
          ]}
          rotation={[0, 0, angle - Math.PI / 2]}
        >
          <boxGeometry args={[0.05, fanRadius, 0.09]} />
        </mesh>
      ))}
      <mesh material={brass} position={[0, TRANSOM_Y + 0.06, LEAF_Z + 0.06]}>
        <cylinderGeometry args={[0.14, 0.14, 0.06, 10]} />
      </mesh>

      <Column x={-COLUMN_X} stone={stone} trim={trim} brass={brass} />
      <Column x={COLUMN_X} stone={stone} trim={trim} brass={brass} />

      {/* Lanterns flanking the doors.

          Not decoration — this end of the hall has no light in it. The
          chandelier hangs over the table twenty units away and the nearest
          sconce is six back down the side wall, so the doorcase's pale stone
          caught the ambient and the timber went to flat black: an extravagant
          pair of doors that could not be seen at all. These are what make the
          joinery read. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (COLUMN_X + 1.15), 4.5, LEAF_Z + 0.34]}>
          {/* Bracket off the wall. */}
          <mesh material={brass} position={[0, 0.62, -0.2]}>
            <boxGeometry args={[0.08, 0.08, 0.42]} />
          </mesh>
          <mesh material={brass} position={[0, 0.62, 0]}>
            <boxGeometry args={[0.07, 0.5, 0.07]} />
          </mesh>
          {/* Lantern body: a glazed case under a capped roof. */}
          <mesh material={brass} position={[0, 0.36, 0]}>
            <boxGeometry args={[0.36, 0.07, 0.36]} />
          </mesh>
          <mesh material={lampGlass} position={[0, 0.02, 0]}>
            <boxGeometry args={[0.3, 0.62, 0.3]} />
          </mesh>
          {[-1, 1].map((cx) =>
            [-1, 1].map((cz) => (
              <mesh key={`${cx}${cz}`} material={brass} position={[cx * 0.15, 0.02, cz * 0.15]}>
                <boxGeometry args={[0.04, 0.64, 0.04]} />
              </mesh>
            ))
          )}
          <mesh material={flame} position={[0, -0.04, 0]}>
            <sphereGeometry args={[0.1, 10, 8]} />
          </mesh>
          <mesh material={brass} position={[0, -0.36, 0]}>
            <coneGeometry args={[0.22, 0.18, 4]} />
          </mesh>
          <mesh material={brass} position={[0, 0.46, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.3, 0.24, 4]} />
          </mesh>
          <pointLight position={[0, 0, 0.3]} color="#ffcf8f" intensity={5.5} distance={11} decay={2} />
        </group>
      ))}

      {/* Entablature over the columns: frieze, dentils, cornice. */}
      <mesh material={surround} position={[0, entablatureY, LEAF_Z + RELIEF / 2 + 0.1]}>
        <boxGeometry args={[(COLUMN_X + 0.72) * 2, 0.52, RELIEF + 0.5]} />
      </mesh>
      {[-2.55, -1.7, -0.85, 0.85, 1.7, 2.55].map((x, i) => (
        <group key={i} position={[x, entablatureY, LEAF_Z + RELIEF + 0.36]}>
          <mesh material={trim} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.06, 8]} />
          </mesh>
          <mesh material={brass} position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.05, 8]} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 25 }, (_, i) => -3.6 + i * 0.3).map((x, i) => (
        <mesh key={i} material={trim} position={[x, entablatureY + 0.36, LEAF_Z + RELIEF / 2 + 0.16]}>
          <boxGeometry args={[0.13, 0.14, RELIEF + 0.6]} />
        </mesh>
      ))}
      <mesh material={stone} position={[0, corniceY + 0.14, LEAF_Z + RELIEF / 2 + 0.22]}>
        <boxGeometry args={[(COLUMN_X + 1.0) * 2, 0.2, RELIEF + 0.8]} />
      </mesh>

      {/* Broken pediment: two raking cornices climbing toward the middle and
          stopping short of it, with an urn standing in the gap. The one piece
          of the room that is pure ceremony. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={stone}
          position={[s * 1.9, corniceY + 0.82, LEAF_Z + RELIEF / 2 + 0.16]}
          rotation={[0, 0, s * -0.42]}
        >
          <boxGeometry args={[3.5, 0.24, RELIEF + 0.6]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={trim}
          position={[s * (COLUMN_X + 0.86), corniceY + 0.36, LEAF_Z + RELIEF / 2 + 0.16]}
        >
          <boxGeometry args={[0.34, 0.34, RELIEF + 0.62]} />
        </mesh>
      ))}
      <group position={[0, corniceY + 0.32, LEAF_Z + RELIEF / 2 + 0.1]}>
        <mesh material={surround} position={[0, 0.1, 0]}>
          <boxGeometry args={[0.7, 0.2, 0.6]} />
        </mesh>
        <mesh material={stone} position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.34, 0.2, 0.54, 12]} />
        </mesh>
        <mesh material={brass} position={[0, 0.74, 0]}>
          <cylinderGeometry args={[0.38, 0.34, 0.08, 12]} />
        </mesh>
        <mesh material={stone} position={[0, 0.92, 0]}>
          <sphereGeometry args={[0.17, 10, 8]} />
        </mesh>
      </group>
    </group>
  );
}
