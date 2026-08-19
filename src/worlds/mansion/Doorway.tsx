import { useMemo } from "react";
import * as THREE from "three";
import { flatMaterial, PALETTE } from "./materials";
import {
  DOOR_HALF_WIDTH,
  DOOR_HEAD,
  DOOR_SILL,
  HALL_MIN_Z,
  WALL_THICKNESS,
} from "./layout";

/**
 * The way out to the Connect balcony, dressed as the front door of the house.
 *
 * It was a hole: two piers, a lintel and a sill, with the "Connect" label
 * floating over it. Every other opening in the hall — the windows — already
 * wore a stone architrave and a keystone, so the one opening you can actually
 * walk through was the plainest thing on the wall. This is the doorcase it
 * should have had: a moulded surround, reeded pilasters carrying an
 * entablature, a keystone breaking through it, a pair of glazed doors standing
 * open, and a fanlight over them.
 *
 * Everything here is decoration and none of it moves the collision. The
 * opening the visitor walks through is exactly the opening that was there
 * before — the ornament stands beside it, above it, and inside the reveal.
 */

/** The wall's two faces. It spans a metre from HALL_MIN_Z inward. */
const OUTER_Z = HALL_MIN_Z;
const INNER_Z = HALL_MIN_Z + WALL_THICKNESS;

/**
 * How far the doorcase stands proud of the wall.
 *
 * Kept shallow deliberately. The gallery's collision line runs along the
 * wall's inner face, so anything projecting into the room is something a
 * visitor hugging the wall can clip through — the dado already projects 0.06
 * for the same reason. A quarter of a unit is enough to catch the candlelight
 * and throw the mouldings into relief without becoming a thing to walk into.
 */
const RELIEF = 0.26;

/** Where the doors' head rail sits, and therefore the foot of the fanlight. */
const TRANSOM_Y = DOOR_HEAD - 0.62;

/**
 * Ceiling for anything above the opening.
 *
 * The "Connect" label bobs at DOOR_HEAD + 0.62 and the back window's sill is
 * at 9.8, so the entablature has to live in the hand's breadth between the
 * head and the label. That is why this doorcase spends its grandeur sideways
 * and forward — wide pilasters, a deep cornice — rather than on the tall
 * pediment a doorway like this would otherwise carry.
 */
const CORNICE_TOP = DOOR_HEAD + 0.44;

/** Half-width of the reeded pilasters flanking the opening, and where they stand. */
const PILASTER_HALF = 0.34;
const PILASTER_X = DOOR_HALF_WIDTH + 0.42;

/** A leaf is half the opening; they meet on the centre line when shut. */
const LEAF_WIDTH = DOOR_HALF_WIDTH;
const LEAF_HEIGHT = TRANSOM_Y - DOOR_SILL;
const LEAF_THICKNESS = 0.1;
/**
 * How far the doors stand open, in radians.
 *
 * Swung outward onto the balcony rather than inward: opened inward they would
 * lie across the pilasters they are meant to be framed by.
 *
 * 115° rather than flat to the wall. Flat is what a propped-open door really
 * does and it hid them completely — from inside the gallery the piers covered
 * both leaves and the doorway read as an unglazed hole again. Standing them
 * out at an angle puts the joinery, the glazing bars and the brass in the view
 * from both sides. The leaves swing clear of the opening either way, and clear
 * of the bench and the telescope out on the balcony.
 */
const LEAF_SWING = THREE.MathUtils.degToRad(115);

/** One reeded pilaster: plinth, reeded shaft, and a moulded capital. */
function Pilaster({
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
  const shaftBottom = DOOR_SILL + 0.46;
  const shaftTop = DOOR_HEAD - 0.34;
  const reeds = [-0.2, -0.067, 0.067, 0.2];

  return (
    <group position={[x, 0, INNER_Z + RELIEF / 2]}>
      {/* Plinth. */}
      <mesh material={trim} position={[0, DOOR_SILL + 0.23, 0.02]}>
        <boxGeometry args={[PILASTER_HALF * 2 + 0.12, 0.46, RELIEF + 0.04]} />
      </mesh>
      {/* Shaft. */}
      <mesh material={stone} position={[0, (shaftBottom + shaftTop) / 2, 0]}>
        <boxGeometry args={[PILASTER_HALF * 2, shaftTop - shaftBottom, RELIEF]} />
      </mesh>
      {/* Reeding: staves standing proud of the shaft, running its full height.
          Proud rather than fluted-hollow because flat shading reads a raised
          edge and loses a recessed one — and left unrotated, because a
          cylinder's axis is already Y. Turned a quarter onto X they became
          two-and-a-half-unit tubes lying through the wall into the room. */}
      {reeds.map((offset, i) => (
        <mesh
          key={i}
          material={trim}
          position={[offset, (shaftBottom + shaftTop) / 2, RELIEF / 2 - 0.01]}
        >
          <cylinderGeometry args={[0.036, 0.036, shaftTop - shaftBottom, 6]} />
        </mesh>
      ))}
      {/* Necking ring under the capital, then the capital itself. */}
      <mesh material={brass} position={[0, shaftTop + 0.04, 0.01]}>
        <boxGeometry args={[PILASTER_HALF * 2 + 0.04, 0.05, RELIEF + 0.02]} />
      </mesh>
      <mesh material={trim} position={[0, shaftTop + 0.17, 0.03]}>
        <boxGeometry args={[PILASTER_HALF * 2 + 0.14, 0.2, RELIEF + 0.06]} />
      </mesh>
      <mesh material={stone} position={[0, shaftTop + 0.3, 0.05]}>
        <boxGeometry args={[PILASTER_HALF * 2 + 0.24, 0.08, RELIEF + 0.1]} />
      </mesh>
      {/* Volute scrolls at the corners of the capital. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={trim}
          position={[s * (PILASTER_HALF + 0.06), shaftTop + 0.17, RELIEF / 2 + 0.04]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.05, 0.022, 4, 8]} />
        </mesh>
      ))}
      {/* Base moulding where the plinth meets the gallery floor. */}
      <mesh material={stone} position={[0, DOOR_SILL + 0.03, 0.04]}>
        <boxGeometry args={[PILASTER_HALF * 2 + 0.2, 0.06, RELIEF + 0.08]} />
      </mesh>
    </group>
  );
}

/**
 * One glazed leaf, built about its hinge so the group can simply be rotated
 * open: the stile the hinges are on sits at local x = 0 and the leaf runs out
 * to +x.
 */
function DoorLeaf({
  timber,
  timberDark,
  glass,
  brass,
}: {
  timber: THREE.Material;
  timberDark: THREE.Material;
  glass: THREE.Material;
  brass: THREE.Material;
}) {
  const half = LEAF_THICKNESS / 2;
  const stile = 0.16;
  /** The lower panel's head, and the foot of the glazing. */
  const railY = DOOR_SILL + 0.82;
  const glazedTop = DOOR_SILL + LEAF_HEIGHT - 0.14;
  const barXs = [LEAF_WIDTH * 0.33, LEAF_WIDTH * 0.66];
  const barYs = [railY + (glazedTop - railY) * 0.34, railY + (glazedTop - railY) * 0.67];

  return (
    <group>
      {/* Frame: two stiles and three rails, so the leaf reads as joinery rather
          than as a slab with a hole in it. */}
      <mesh material={timber} position={[stile / 2, DOOR_SILL + LEAF_HEIGHT / 2, 0]}>
        <boxGeometry args={[stile, LEAF_HEIGHT, LEAF_THICKNESS]} />
      </mesh>
      <mesh material={timber} position={[LEAF_WIDTH - stile / 2, DOOR_SILL + LEAF_HEIGHT / 2, 0]}>
        <boxGeometry args={[stile, LEAF_HEIGHT, LEAF_THICKNESS]} />
      </mesh>
      <mesh material={timber} position={[LEAF_WIDTH / 2, DOOR_SILL + 0.08, 0]}>
        <boxGeometry args={[LEAF_WIDTH, 0.16, LEAF_THICKNESS]} />
      </mesh>
      <mesh material={timber} position={[LEAF_WIDTH / 2, railY, 0]}>
        <boxGeometry args={[LEAF_WIDTH, 0.2, LEAF_THICKNESS]} />
      </mesh>
      <mesh material={timber} position={[LEAF_WIDTH / 2, DOOR_SILL + LEAF_HEIGHT - 0.07, 0]}>
        <boxGeometry args={[LEAF_WIDTH, 0.14, LEAF_THICKNESS]} />
      </mesh>

      {/* Raised-and-fielded panel below the rail. */}
      <mesh material={timberDark} position={[LEAF_WIDTH / 2, (DOOR_SILL + 0.16 + railY) / 2, 0]}>
        <boxGeometry args={[LEAF_WIDTH - stile * 2, railY - DOOR_SILL - 0.26, LEAF_THICKNESS * 0.6]} />
      </mesh>
      <mesh
        material={timber}
        position={[LEAF_WIDTH / 2, (DOOR_SILL + 0.16 + railY) / 2, half * 0.6]}
      >
        <boxGeometry args={[LEAF_WIDTH - stile * 2 - 0.16, railY - DOOR_SILL - 0.42, 0.03]} />
      </mesh>

      {/* Glazing, with muntins dividing it into nine lights. */}
      <mesh material={glass} position={[LEAF_WIDTH / 2, (railY + glazedTop) / 2, 0]}>
        <boxGeometry args={[LEAF_WIDTH - stile * 2, glazedTop - railY, 0.02]} />
      </mesh>
      {barXs.map((bx, i) => (
        <mesh key={`v${i}`} material={timber} position={[bx, (railY + glazedTop) / 2, 0]}>
          <boxGeometry args={[0.035, glazedTop - railY, LEAF_THICKNESS * 0.7]} />
        </mesh>
      ))}
      {barYs.map((by, i) => (
        <mesh key={`h${i}`} material={timber} position={[LEAF_WIDTH / 2, by, 0]}>
          <boxGeometry args={[LEAF_WIDTH - stile * 2, 0.035, LEAF_THICKNESS * 0.7]} />
        </mesh>
      ))}

      {/* Hinges on the hanging stile, and a lever with a backplate on the free
          one — the two details that say which way a door opens. */}
      {[DOOR_SILL + 0.32, DOOR_SILL + LEAF_HEIGHT - 0.32].map((y, i) => (
        <mesh key={i} material={brass} position={[0.02, y, 0]}>
          <boxGeometry args={[0.06, 0.18, LEAF_THICKNESS + 0.03]} />
        </mesh>
      ))}
      <mesh material={brass} position={[LEAF_WIDTH - 0.18, railY + 0.42, half + 0.02]}>
        <boxGeometry args={[0.1, 0.26, 0.03]} />
      </mesh>
      <mesh
        material={brass}
        position={[LEAF_WIDTH - 0.18, railY + 0.42, half + 0.08]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.035, 0.035, 0.06, 8]} />
      </mesh>
      <mesh material={brass} position={[LEAF_WIDTH - 0.29, railY + 0.42, half + 0.09]}>
        <boxGeometry args={[0.22, 0.05, 0.05]} />
      </mesh>
    </group>
  );
}

export function Doorway() {
  const stone = useMemo(() => flatMaterial(PALETTE.windowSurround), []);
  const trim = useMemo(() => flatMaterial(PALETTE.pilasterTrim), []);
  const pale = useMemo(() => flatMaterial(PALETTE.cornice), []);
  const brass = useMemo(() => flatMaterial(PALETTE.brass), []);
  const timber = useMemo(() => flatMaterial(PALETTE.tableTop), []);
  const timberDark = useMemo(() => flatMaterial(PALETTE.tableBase), []);
  const reveal = useMemo(() => flatMaterial(PALETTE.wainscot), []);
  const glass = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: PALETTE.glass,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
      }),
    []
  );
  const lamp = useMemo(
    () => flatMaterial(PALETTE.candle, { emissive: PALETTE.candle, emissiveIntensity: 0.8 }),
    []
  );

  /** Radiating bars of the fanlight, as angles across the half-round. */
  const fanBars = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ((i + 1) / 8) * Math.PI),
    []
  );

  return (
    <group>
      {/* ---- The reveal: the metre of masonry the opening is cut through, ----
          lined on both jambs and the soffit so the wall reads as thick. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={reveal}
          position={[s * (DOOR_HALF_WIDTH - 0.04), (DOOR_SILL + DOOR_HEAD) / 2, (OUTER_Z + INNER_Z) / 2]}
        >
          <boxGeometry args={[0.08, DOOR_HEAD - DOOR_SILL, WALL_THICKNESS]} />
        </mesh>
      ))}
      <mesh
        material={reveal}
        position={[0, DOOR_HEAD - 0.04, (OUTER_Z + INNER_Z) / 2]}
      >
        <boxGeometry args={[DOOR_HALF_WIDTH * 2, 0.08, WALL_THICKNESS]} />
      </mesh>

      {/* Threshold: a stone saddle with a brass strip let into it, which is
          what the eye reads as the line between indoors and out. */}
      <mesh material={stone} position={[0, DOOR_SILL + 0.03, (OUTER_Z + INNER_Z) / 2]}>
        <boxGeometry args={[DOOR_HALF_WIDTH * 2 + 0.3, 0.06, WALL_THICKNESS + 0.1]} />
      </mesh>
      <mesh material={brass} position={[0, DOOR_SILL + 0.065, (OUTER_Z + INNER_Z) / 2]}>
        <boxGeometry args={[DOOR_HALF_WIDTH * 2 + 0.1, 0.02, 0.16]} />
      </mesh>

      {/* ---- Interior doorcase ---- */}
      {/* Architrave: three steps out from the opening, the same moulding the
          windows wear, so the doorway joins the room's own vocabulary. */}
      {[
        { inset: 0.0, width: 0.16, depth: 0.1 },
        { inset: 0.16, width: 0.14, depth: 0.17 },
        { inset: 0.3, width: 0.12, depth: 0.24 },
      ].map((band, i) => {
        const halfW = DOOR_HALF_WIDTH + band.inset + band.width / 2;
        const z = INNER_Z + band.depth / 2;
        return (
          <group key={i}>
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                material={i === 1 ? trim : stone}
                position={[s * halfW, (DOOR_SILL + DOOR_HEAD) / 2 + 0.1, z]}
              >
                <boxGeometry args={[band.width, DOOR_HEAD - DOOR_SILL + 0.2, band.depth]} />
              </mesh>
            ))}
            <mesh
              material={i === 1 ? trim : stone}
              position={[0, DOOR_HEAD + band.inset + band.width / 2, z]}
            >
              <boxGeometry
                args={[(DOOR_HALF_WIDTH + band.inset + band.width) * 2, band.width, band.depth]}
              />
            </mesh>
          </group>
        );
      })}

      {/* Keystone, breaking up through the architrave into the frieze — the one
          piece that stops the head reading as a plain lintel. */}
      <mesh material={pale} position={[0, DOOR_HEAD + 0.16, INNER_Z + 0.2]}>
        <boxGeometry args={[0.46, 0.62, 0.4]} />
      </mesh>
      <mesh material={trim} position={[0, DOOR_HEAD + 0.44, INNER_Z + 0.22]}>
        <boxGeometry args={[0.6, 0.1, 0.44]} />
      </mesh>
      <mesh material={brass} position={[0, DOOR_HEAD + 0.14, INNER_Z + 0.41]}>
        <sphereGeometry args={[0.07, 8, 6]} />
      </mesh>

      <Pilaster x={-PILASTER_X} stone={pale} trim={trim} brass={brass} />
      <Pilaster x={PILASTER_X} stone={pale} trim={trim} brass={brass} />

      {/* Entablature spanning the pilasters: a frieze with rosettes on it and a
          cornice shelf over the top. It stops short of the "Connect" label,
          which hangs above it like a cartouche. */}
      <mesh
        material={stone}
        position={[0, DOOR_HEAD + 0.19, INNER_Z + RELIEF / 2]}
      >
        <boxGeometry args={[(PILASTER_X + PILASTER_HALF + 0.16) * 2, 0.3, RELIEF]} />
      </mesh>
      {[-1.5, -0.75, 0.75, 1.5].map((x, i) => (
        <group key={i} position={[x, DOOR_HEAD + 0.19, INNER_Z + RELIEF]}>
          <mesh material={trim} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.05, 8]} />
          </mesh>
          <mesh material={brass} position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.04, 8]} />
          </mesh>
        </group>
      ))}
      <mesh
        material={pale}
        position={[0, CORNICE_TOP - 0.07, INNER_Z + RELIEF / 2 + 0.06]}
      >
        <boxGeometry args={[(PILASTER_X + PILASTER_HALF + 0.3) * 2, 0.14, RELIEF + 0.12]} />
      </mesh>
      {/* Dentils under the cornice — the detail that makes a shelf read as an
          order rather than as a ledge. */}
      {Array.from({ length: 17 }, (_, i) => -1.92 + i * 0.24).map((x, i) => (
        <mesh
          key={i}
          material={trim}
          position={[x, CORNICE_TOP - 0.19, INNER_Z + RELIEF / 2 + 0.04]}
        >
          <boxGeometry args={[0.1, 0.1, RELIEF + 0.08]} />
        </mesh>
      ))}

      {/* ---- Fanlight ---- fixed glazing over the doors, with bars radiating
          from the centre of the head. It sits above standing height, so it
          never becomes something to duck under. */}
      <mesh material={glass} position={[0, (TRANSOM_Y + DOOR_HEAD) / 2, INNER_Z - 0.1]}>
        <boxGeometry args={[DOOR_HALF_WIDTH * 2 - 0.1, DOOR_HEAD - TRANSOM_Y - 0.1, 0.04]} />
      </mesh>
      <mesh material={timber} position={[0, TRANSOM_Y, INNER_Z - 0.1]}>
        <boxGeometry args={[DOOR_HALF_WIDTH * 2, 0.12, 0.12]} />
      </mesh>
      {fanBars.map((angle, i) => (
        <mesh
          key={i}
          material={timber}
          position={[
            (Math.cos(angle) * (DOOR_HEAD - TRANSOM_Y - 0.1)) / 2,
            TRANSOM_Y + (Math.sin(angle) * (DOOR_HEAD - TRANSOM_Y - 0.1)) / 2,
            INNER_Z - 0.1,
          ]}
          rotation={[0, 0, angle - Math.PI / 2]}
        >
          <boxGeometry args={[0.035, DOOR_HEAD - TRANSOM_Y - 0.1, 0.06]} />
        </mesh>
      ))}

      {/* ---- The doors themselves ---- hung on the outer face and standing
          open onto the balcony. */}
      {/* A leaf is modelled hinge-at-origin running out to +x, so the left one
          is used as built and the right is mirrored to run back toward the
          centre. The mirror reverses the direction the swing has to turn, which
          is why the two rotations are opposite: applied the same way round,
          both leaves rotate back *across* the opening and the doors read shut. */}
      {[
        { x: -DOOR_HALF_WIDTH, turn: LEAF_SWING, mirror: 1 },
        { x: DOOR_HALF_WIDTH, turn: -LEAF_SWING, mirror: -1 },
      ].map((leaf) => (
        <group
          key={leaf.x}
          position={[leaf.x, 0, OUTER_Z]}
          rotation={[0, leaf.turn, 0]}
          scale={[leaf.mirror, 1, 1]}
        >
          <DoorLeaf timber={timber} timberDark={timberDark} glass={glass} brass={brass} />
        </group>
      ))}

      {/* ---- Lanterns ---- one either side, above head height so they are
          never walked into, lighting the way out after dark. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (PILASTER_X + 0.72), DOOR_HEAD - 0.75, INNER_Z + 0.12]}>
          <mesh material={brass} position={[0, 0.34, 0]}>
            <boxGeometry args={[0.06, 0.06, 0.24]} />
          </mesh>
          <mesh material={brass} position={[0, 0.34, 0.2]}>
            <boxGeometry args={[0.05, 0.3, 0.05]} />
          </mesh>
          <mesh material={brass} position={[0, 0.2, 0.2]}>
            <boxGeometry args={[0.26, 0.05, 0.26]} />
          </mesh>
          <mesh material={glass} position={[0, 0.02, 0.2]}>
            <boxGeometry args={[0.2, 0.32, 0.2]} />
          </mesh>
          <mesh material={lamp} position={[0, 0.0, 0.2]}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </mesh>
          <mesh material={brass} position={[0, -0.16, 0.2]}>
            <coneGeometry args={[0.15, 0.12, 4]} />
          </mesh>
          <mesh material={brass} position={[0, 0.19, 0.2]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.19, 0.14, 4]} />
          </mesh>
          <pointLight position={[0, 0.02, 0.34]} color="#ffcf8f" intensity={1.1} distance={5} decay={2} />
        </group>
      ))}

      {/* ---- Exterior surround ---- plainer than the inside, because from the
          balcony the doors themselves are the detail; this just stops the
          opening reading as a hole punched in a cliff-side wall. */}
      {[
        { inset: 0.0, width: 0.18, depth: 0.12 },
        { inset: 0.18, width: 0.14, depth: 0.2 },
      ].map((band, i) => {
        const halfW = DOOR_HALF_WIDTH + band.inset + band.width / 2;
        const z = OUTER_Z - band.depth / 2;
        return (
          <group key={i}>
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                material={i === 0 ? stone : trim}
                position={[s * halfW, (DOOR_SILL + DOOR_HEAD) / 2 + 0.08, z]}
              >
                <boxGeometry args={[band.width, DOOR_HEAD - DOOR_SILL + 0.16, band.depth]} />
              </mesh>
            ))}
            <mesh
              material={i === 0 ? stone : trim}
              position={[0, DOOR_HEAD + band.inset + band.width / 2, z]}
            >
              <boxGeometry
                args={[(DOOR_HALF_WIDTH + band.inset + band.width) * 2, band.width, band.depth]}
              />
            </mesh>
          </group>
        );
      })}
      <mesh material={pale} position={[0, DOOR_HEAD + 0.42, OUTER_Z - 0.16]}>
        <boxGeometry args={[DOOR_HALF_WIDTH * 2 + 1.0, 0.16, 0.34]} />
      </mesh>
    </group>
  );
}
