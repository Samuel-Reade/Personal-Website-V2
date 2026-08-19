import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { MANSION, TRAM_TOP_LOCAL } from "./layout";

/**
 * A marble mansion on the crown of the range's great north-western peak.
 *
 * Greek Revival, and a house rather than a temple: a two-storey centre block
 * with a giant tetrastyle portico and pediment, a lower wing off each side
 * under a balustraded parapet, and chimneys on the ridge. The windows are
 * Reade Hall's own — round-headed, fanlights in the arch, a grid of glazing
 * bars below, dark joinery in a pale surround under a keystone — four of them
 * either side of the pillared entrance, because this is the same estate seen
 * from outside: the balcony on the east end is the Connect balcony, and the
 * tramway's hall is grown onto the west end the way a service range grows onto
 * a house.
 *
 * All of it is built in the mansion's own frame — local +z is the front,
 * facing the arena, local +x the right-hand end as the range is first seen —
 * and the group at the bottom of this file puts that frame on the mountain.
 * Heights are absolute, because the group sits at y = 0: `DECK` is a height
 * above sea level and so is everything measured off it.
 *
 * Nothing here is interactive. It is the largest single object in the world
 * and it is scenery, which is the point — the range had four balloons and no
 * reason for anyone to have put them there.
 */

/* -------------------------------------------------------------------------
   The dimensions
   ---------------------------------------------------------------------- */

/** Top of the podium, and the ground for everything above it. */
const DECK = MANSION.deck;

/**
 * The podium's plan: a walkway's width beyond the house and no more. The first
 * one oversailed the crown by ten units a side on a wall forty tall, and read
 * as a fortress with a house on top — the platform was the object and the
 * house its ornament. This one is the house's own base: the deck is less than
 * a metre over the sampled summit, the front face shows about twelve units of
 * battered stone, and the mountain does the rest.
 */
const PODIUM_X = 19.5;
const PODIUM_FRONT = 12;
const PODIUM_BACK = -14.5;
/**
 * How far down the podium's mass goes: below the lowest ground anywhere under
 * it, so the terrace is solid stone wherever it meets the mountain and never a
 * slab with daylight under one corner. Where the ground is higher it is simply
 * buried, which is most of the western half.
 */
const PODIUM_BASE = 145;

/** The service court, off the western end, where the tramway's hall stands. */
const COURT = MANSION.court;
const COURT_IN = -PODIUM_X;
const COURT_OUT = -31;
const COURT_BACK = -13;
const COURT_FRONT = 0;

/** Three steps from the terrace up to the house. */
const STEP = 0.62;
const STYLOBATE = DECK + STEP * 3;

/** The centre block: two tall storeys. */
const CENTRE_X = 7;
const CENTRE_FRONT = 4.5;
const CENTRE_BACK = -8;
const CENTRE_TOP = STYLOBATE + 11.6;

/** The wings: one tall storey of arched windows, one each side. */
const WING_IN = CENTRE_X;
const WING_OUT = 17;
const WING_FRONT = 3;
const WING_BACK = -7;
const WING_TOP = STYLOBATE + 8.6;

/** The portico across the centre's front, and the porch answering it behind. */
const PORTICO_X = 5.2;
const PORTICO_FRONT = 8.6;
const PORCH_BACK = -11.4;

/** Architrave, frieze and cornice on the centre block. */
const ARCH = 1.0;
const FRIEZE = 1.3;
const CORNICE = 0.85;
const ENTAB_TOP = CENTRE_TOP + ARCH + FRIEZE + CORNICE;

/** Rise of the roof, and of the portico's pediment — the same, so they meet. */
const ROOF_RISE = 3.0;

/**
 * The Connect balcony, off the east wing's end wall and out over the drop —
 * an attachment of the house, exactly as it is in Reade Hall: a slab at the
 * house's own floor, French doors from the wing, a rail round it, and sixty
 * units of air underneath. Its outward face is toward the range's far north,
 * where the other cluster of balloons flies.
 */
const BALCONY_IN = WING_OUT;
const BALCONY_OUT = 25.5;
const BALCONY_BACK = -6;
const BALCONY_FRONT = 3.5;
const BALCONY_SLAB = 1.2;

/* -------------------------------------------------------------------------
   Pieces that are built rather than boxed
   ---------------------------------------------------------------------- */

/**
 * A triangular prism: the pediments, and the gables of the roof.
 *
 * Base at y = 0, apex at `rise`, spanning ±width/2 in x and ±depth/2 in z.
 * Written out rather than extruded from a Shape because it is nine triangles
 * and the whole of ExtrudeGeometry is a great deal of machinery for that.
 */
function prismGeometry(width: number, rise: number, depth: number): THREE.BufferGeometry {
  const hx = width / 2;
  const hz = depth / 2;
  const v: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => v.push(...a, ...b, ...c);

  tri([-hx, 0, hz], [hx, 0, hz], [0, rise, hz]);
  tri([hx, 0, -hz], [-hx, 0, -hz], [0, rise, -hz]);
  tri([-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz]);
  tri([-hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz]);
  tri([hx, 0, hz], [hx, 0, -hz], [0, rise, -hz]);
  tri([hx, 0, hz], [0, rise, -hz], [0, rise, hz]);
  tri([-hx, 0, -hz], [-hx, 0, hz], [0, rise, hz]);
  tri([-hx, 0, -hz], [0, rise, hz], [0, rise, -hz]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The profile of a column, at unit height and unit base radius: plinth, a
 * shaft with entasis, the neck, and an echinus flaring into the capital.
 *
 * Lathed at sixteen segments and flat-shaded, which at any distance anyone
 * will ever see this from reads as fluting — the facets of the revolve do the
 * work that twenty cut grooves would, for a geometry every column shares.
 */
const COLUMN_PROFILE: [number, number][] = [
  [0.0, 0.0],
  [0.0, 1.24],
  [0.028, 1.24],
  [0.042, 1.06],
  [0.055, 1.0],
  [0.34, 0.98],
  [0.68, 0.91],
  [0.86, 0.84],
  [0.878, 0.83],
  [0.892, 0.96],
  [0.93, 1.09],
  [0.952, 1.13],
  [0.96, 1.13],
];

interface Column {
  x: number;
  z: number;
  base: number;
  height: number;
  radius: number;
}

/**
 * Every column on the house, in two draws: one instanced lathe for the shafts,
 * one instanced box for the abaci — the square slab a revolve cannot make.
 */
function Colonnade({ columns }: { columns: Column[] }) {
  const shafts = useRef<THREE.InstancedMesh>(null!);
  const abaci = useRef<THREE.InstancedMesh>(null!);

  const shaftGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        COLUMN_PROFILE.map(([y, r]) => new THREE.Vector2(r, y)),
        16
      ),
    []
  );
  useEffect(() => () => shaftGeometry.dispose(), [shaftGeometry]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    columns.forEach((c, i) => {
      dummy.position.set(c.x, c.base, c.z);
      dummy.scale.set(c.radius, c.height, c.radius);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      shafts.current.setMatrixAt(i, dummy.matrix);

      dummy.position.set(c.x, c.base + c.height * 0.98, c.z);
      dummy.scale.set(c.radius * 2.6, c.height * 0.04, c.radius * 2.6);
      dummy.updateMatrix();
      abaci.current.setMatrixAt(i, dummy.matrix);
    });
    shafts.current.instanceMatrix.needsUpdate = true;
    abaci.current.instanceMatrix.needsUpdate = true;
    shafts.current.computeBoundingSphere();
    abaci.current.computeBoundingSphere();
  }, [columns]);

  return (
    <>
      <instancedMesh ref={shafts} args={[shaftGeometry, flatMat(PALETTE.marble), columns.length]} />
      <instancedMesh ref={abaci} args={[undefined, flatMat(PALETTE.marbleShade), columns.length]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  );
}

/**
 * The arched pieces of a window are shared by every window of the same size:
 * a couple of dozen windows each lathing their own three tori would be sixty
 * geometries saying four things. Cached forever, like `flatMat` — the house
 * mounts once per visit and the cache is the size of the window catalogue.
 */
const archCache = new Map<string, THREE.BufferGeometry>();
function archPiece(kind: "pane" | "frame" | "stone", radius: number): THREE.BufferGeometry {
  const key = `${kind}:${radius.toFixed(3)}`;
  let geometry = archCache.get(key);
  if (!geometry) {
    geometry =
      kind === "pane"
        ? new THREE.CircleGeometry(radius, 12, 0, Math.PI)
        : kind === "frame"
          ? new THREE.TorusGeometry(radius + 0.04, 0.08, 6, 12, Math.PI)
          : new THREE.TorusGeometry(radius + 0.24, 0.13, 6, 12, Math.PI);
    archCache.set(key, geometry);
  }
  return geometry;
}

/**
 * A round-headed window, built to match Reade Hall's: dark jambs and glazing
 * bars over pale panes, a fanlight of radiating spokes in the arch, and a
 * marble surround rising to a keystone. `y` is the sill; the arch's radius is
 * half the width, so the full opening stands `height` tall.
 *
 * The same joinery serves as the balcony's French doors with `door` set: the
 * grid gives way to two tall glazed leaves around a centre stile, and the sill
 * to a threshold.
 */
function ArchWindow({
  x,
  y,
  z,
  ry = 0,
  width = 1.6,
  height = 5.7,
  door = false,
}: {
  x: number;
  y: number;
  z: number;
  ry?: number;
  width?: number;
  height?: number;
  door?: boolean;
}) {
  const frame = flatMat(PALETTE.windowFrame);
  const pane = flatMat(PALETTE.windowPane);
  const stone = flatMat(PALETTE.marbleStep);

  const r = width / 2;
  const rectH = height - r;
  const springY = y + rectH;

  /** The fanlight's spokes, and the grid over the lower glass. */
  const spokes = [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
  const mullions = door ? [0] : [-width / 6, width / 6];
  const transoms = door ? [rectH * 0.42] : [rectH * 0.33, rectH * 0.66];

  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* The glass: the rectangular lower light and the half-disc in the arch. */}
      <mesh material={pane} position={[0, y + rectH / 2, 0.2]}>
        <boxGeometry args={[width, rectH, 0.1]} />
      </mesh>
      <mesh geometry={archPiece("pane", r)} material={pane} position={[0, springY, 0.25]} />

      {/* Joinery: jambs, the springline bar, and the ring round the arch. */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={frame} position={[s * (width / 2 + 0.04), y + rectH / 2, 0.26]}>
          <boxGeometry args={[0.1, rectH, 0.12]} />
        </mesh>
      ))}
      <mesh material={frame} position={[0, springY, 0.26]}>
        <boxGeometry args={[width + 0.18, 0.1, 0.12]} />
      </mesh>
      <mesh geometry={archPiece("frame", r)} material={frame} position={[0, springY, 0.28]} />

      {/* The grid — or the door's stile and lock rail. */}
      {mullions.map((mx) => (
        <mesh key={`m${mx}`} material={frame} position={[mx, y + rectH / 2, 0.27]}>
          <boxGeometry args={[door ? 0.12 : 0.07, rectH, 0.08]} />
        </mesh>
      ))}
      {transoms.map((ty) => (
        <mesh key={`t${ty}`} material={frame} position={[0, y + ty, 0.27]}>
          <boxGeometry args={[width, 0.07, 0.08]} />
        </mesh>
      ))}

      {/* The fanlight. */}
      {spokes.map((a) => (
        <mesh
          key={a}
          material={frame}
          position={[Math.cos(a) * r * 0.45, springY + Math.sin(a) * r * 0.45, 0.29]}
          rotation={[0, 0, a - Math.PI / 2]}
        >
          <boxGeometry args={[0.06, r * 0.9, 0.07]} />
        </mesh>
      ))}

      {/* The surround: marble jambs, the ring over the arch, the keystone, and
          a sill — or a threshold, where the window is the balcony's door. */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={stone} position={[s * (width / 2 + 0.22), y + rectH / 2, 0.12]}>
          <boxGeometry args={[0.26, rectH, 0.14]} />
        </mesh>
      ))}
      <mesh geometry={archPiece("stone", r)} material={stone} position={[0, springY, 0.12]} />
      <mesh material={stone} position={[0, springY + r + 0.26, 0.18]}>
        <boxGeometry args={[0.44, 0.72, 0.2]} />
      </mesh>
      <mesh material={stone} position={[0, y - 0.1, 0.18]}>
        <boxGeometry args={[width + (door ? 0.6 : 0.8), 0.2, door ? 0.3 : 0.44]} />
      </mesh>
    </group>
  );
}

/**
 * A balustraded rail along one edge: a plinth, a rail, and piers at intervals
 * under it — at the distances this house is seen from, that reads as
 * balustrade for a fraction of the geometry the balusters themselves would
 * cost.
 */
function Parapet({
  x,
  y,
  z,
  length,
  across = false,
}: {
  x: number;
  y: number;
  z: number;
  length: number;
  across?: boolean;
}) {
  const piers = Math.max(2, Math.round(length / 2.6));
  return (
    <group position={[x, y, z]} rotation={[0, across ? Math.PI / 2 : 0, 0]}>
      <mesh material={flatMat(PALETTE.marbleShade)} position={[0, 0.09, 0]}>
        <boxGeometry args={[length, 0.18, 0.42]} />
      </mesh>
      <mesh material={flatMat(PALETTE.marble)} position={[0, 1.0, 0]}>
        <boxGeometry args={[length, 0.2, 0.38]} />
      </mesh>
      {Array.from({ length: piers }, (_, i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.marble)}
          position={[-length / 2 + (length * (i + 0.5)) / piers, 0.55, 0]}
        >
          <boxGeometry args={[0.3, 0.75, 0.3]} />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------
   The house
   ---------------------------------------------------------------------- */

/**
 * The base the house stands on: a moulded cap at the deck and two battered
 * courses stepping out as they go down into the rock. No buttresses and no
 * apron — the first version's forty-unit bastion made the platform the
 * monument, and a house resting on a mountain wants a plinth, not a dam. The
 * courses are buried wherever the crown rises to meet them, which is most of
 * the west; the front shows about twelve units of stone and the east corner —
 * where the ground falls away under the balcony — the most of it.
 */
function Podium() {
  const stone = flatMat(PALETTE.marbleDeep);
  const cap = flatMat(PALETTE.marbleShade);
  const width = PODIUM_X * 2;
  const depth = PODIUM_FRONT - PODIUM_BACK;
  const midZ = (PODIUM_FRONT + PODIUM_BACK) / 2;

  /** Each course: how far it stands proud of the deck's plan, and its top and bottom. */
  const courses: [number, number, number][] = [
    [0.35, DECK - 1.2, 168],
    [1.7, 168, PODIUM_BASE],
  ];

  return (
    <group>
      <mesh material={cap} position={[0, DECK - 0.6, midZ]}>
        <boxGeometry args={[width + 1.8, 1.2, depth + 1.8]} />
      </mesh>

      {courses.map(([out, top, bottom], i) => (
        <mesh key={i} material={stone} position={[0, (top + bottom) / 2, midZ]}>
          <boxGeometry args={[width + out * 2, top - bottom, depth + out * 2]} />
        </mesh>
      ))}

      {/* The service court: a lower terrace off the western end carrying the
          tramway's hall, with a short flight up to the house's level. */}
      <mesh
        material={cap}
        position={[(COURT_IN + COURT_OUT) / 2, COURT - 0.6, (COURT_BACK + COURT_FRONT) / 2]}
      >
        <boxGeometry args={[COURT_IN - COURT_OUT + 1.4, 1.2, COURT_FRONT - COURT_BACK + 1.4]} />
      </mesh>
      <mesh
        material={stone}
        position={[(COURT_IN + COURT_OUT) / 2, (COURT - 1.2 + PODIUM_BASE) / 2, (COURT_BACK + COURT_FRONT) / 2]}
      >
        <boxGeometry args={[COURT_IN - COURT_OUT, COURT - 1.2 - PODIUM_BASE, COURT_FRONT - COURT_BACK]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          material={cap}
          position={[COURT_IN + 0.9 + i * 0.85, COURT + 0.44 + i * 0.875, -6.5]}
        >
          <boxGeometry args={[0.85, 0.875, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The Connect balcony, carried on corbels off the podium's east face: the
 * slab at the house's own floor, French doors from the wing, and a
 * balustraded rail on its three open sides. Reade Hall's balcony, seen from
 * the outside — which is all this world can do with it.
 */
function Balcony() {
  const stone = flatMat(PALETTE.marbleDeep);
  const deck = flatMat(PALETTE.marbleShade);
  const midX = (BALCONY_IN + BALCONY_OUT) / 2;
  const midZ = (BALCONY_BACK + BALCONY_FRONT) / 2;
  const width = BALCONY_OUT - BALCONY_IN;
  const depth = BALCONY_FRONT - BALCONY_BACK;

  return (
    <group>
      {/* Corbels, stepping out of the podium to catch the slab. */}
      {[-4.5, -1, 2.5].map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh material={stone} position={[PODIUM_X + 1.6, STYLOBATE - 2.4, 0]}>
            <boxGeometry args={[5.4, 1.9, 2.2]} />
          </mesh>
          <mesh material={stone} position={[PODIUM_X + 3.1, STYLOBATE - 3.9, 0]}>
            <boxGeometry args={[2.8, 1.5, 1.8]} />
          </mesh>
        </group>
      ))}

      <mesh material={deck} position={[midX, STYLOBATE - BALCONY_SLAB / 2, midZ]}>
        <boxGeometry args={[width, BALCONY_SLAB, depth]} />
      </mesh>

      <Parapet x={midX} y={STYLOBATE} z={BALCONY_FRONT - 0.25} length={width} />
      <Parapet x={midX} y={STYLOBATE} z={BALCONY_BACK + 0.25} length={width} />
      <Parapet x={BALCONY_OUT - 0.25} y={STYLOBATE} z={midZ} length={depth} across />

      {/* The doors out, in the wing's end wall. */}
      <ArchWindow
        x={WING_OUT}
        y={STYLOBATE}
        z={midZ}
        ry={Math.PI / 2}
        width={2.3}
        height={5.6}
        door
      />
    </group>
  );
}

/** The centre block: walls, the door under the portico, and the back windows. */
function CentreBlock() {
  const wall = flatMat(PALETTE.marble);
  const shade = flatMat(PALETTE.marbleShade);
  const midZ = (CENTRE_FRONT + CENTRE_BACK) / 2;
  const depth = CENTRE_FRONT - CENTRE_BACK;

  return (
    <group>
      <mesh material={wall} position={[0, (STYLOBATE + CENTRE_TOP) / 2, midZ]}>
        <boxGeometry args={[CENTRE_X * 2, CENTRE_TOP - STYLOBATE, depth]} />
      </mesh>

      {/* A string course between the storeys, right round the block. */}
      <mesh material={shade} position={[0, STYLOBATE + 6.2, midZ]}>
        <boxGeometry args={[CENTRE_X * 2 + 0.4, 0.36, depth + 0.4]} />
      </mesh>

      {/* The front door, in the portico's shadow: a bronze pair under a
          transom, with sidelights — the one doorway on the house, and dressed
          like it. */}
      <group position={[0, 0, CENTRE_FRONT]}>
        <mesh material={shade} position={[0, STYLOBATE + 3.5, 0.18]}>
          <boxGeometry args={[5.4, 7.0, 0.36]} />
        </mesh>
        <mesh material={flatMat(PALETTE.bronze)} position={[0, STYLOBATE + 3.1, 0.42]}>
          <boxGeometry args={[3.0, 6.2, 0.22]} />
        </mesh>
        <mesh material={flatMat(PALETTE.bronzeDark)} position={[0, STYLOBATE + 3.1, 0.55]}>
          <boxGeometry args={[0.18, 6.2, 0.1]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={flatMat(PALETTE.windowGlass)} position={[s * 2.0, STYLOBATE + 3.1, 0.42]}>
            <boxGeometry args={[0.85, 6.2, 0.2]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.windowGlass)} position={[0, STYLOBATE + 6.7, 0.42]}>
          <boxGeometry args={[4.9, 0.85, 0.2]} />
        </mesh>
      </group>

      {/* The back: arched windows in both storeys, the upper row over the
          porch the way the front's pediment stands over the door. */}
      {[-4.6, 0, 4.6].map((x) => (
        <ArchWindow key={`u${x}`} x={x} y={STYLOBATE + 7.1} z={CENTRE_BACK} ry={Math.PI} width={1.3} height={3.4} />
      ))}
      {[-4.6, 4.6].map((x) => (
        <ArchWindow key={`l${x}`} x={x} y={STYLOBATE + 1.1} z={CENTRE_BACK} ry={Math.PI} width={1.5} height={4.4} />
      ))}
    </group>
  );
}

/**
 * One wing: a single tall storey behind Reade Hall's arched windows, four to
 * the row on the front and four on the back — the four either side of the
 * pillared entrance — under an entablature and a balustraded parapet.
 */
function Wing({ side }: { side: number }) {
  const wall = flatMat(PALETTE.marble);
  const shade = flatMat(PALETTE.marbleShade);
  const inX = side * WING_IN;
  const outX = side * WING_OUT;
  const midX = (inX + outX) / 2;
  const midZ = (WING_FRONT + WING_BACK) / 2;
  const width = Math.abs(outX - inX);
  const depth = WING_FRONT - WING_BACK;

  /** Four bays, evenly across the wing. */
  const bays = [0, 1, 2, 3].map((i) => inX + side * (width * (i + 0.5)) / 4);

  return (
    <group>
      <mesh material={wall} position={[midX, (STYLOBATE + WING_TOP) / 2, midZ]}>
        <boxGeometry args={[width, WING_TOP - STYLOBATE, depth]} />
      </mesh>

      {/* Entablature and the balustraded parapet over it — the flat-roofed
          wings under balustrades are the piece of the silhouette that says
          mansion rather than temple. */}
      <mesh material={shade} position={[midX, WING_TOP + 0.5, midZ]}>
        <boxGeometry args={[width, 1.0, depth]} />
      </mesh>
      <mesh material={flatMat(PALETTE.marbleStep)} position={[midX, WING_TOP + 1.25, midZ]}>
        <boxGeometry args={[width + 0.9, 0.5, depth + 0.9]} />
      </mesh>
      <mesh material={flatMat(PALETTE.roofLead)} position={[midX, WING_TOP + 1.56, midZ]}>
        <boxGeometry args={[width - 0.6, 0.12, depth - 0.6]} />
      </mesh>
      <Parapet x={midX} y={WING_TOP + 1.5} z={WING_FRONT + 0.2} length={width + 0.9} />
      <Parapet x={midX} y={WING_TOP + 1.5} z={WING_BACK - 0.2} length={width + 0.9} />
      <Parapet x={outX + side * 0.2} y={WING_TOP + 1.5} z={midZ} length={depth + 0.9} across />

      {/* The windows: Reade Hall's, four to the row, front and back. The east
          end wall carries the balcony's doors instead (see Balcony) and the
          west end is where the tramway's gallery comes in (see Mansion). */}
      {bays.map((x) => (
        <ArchWindow key={`f${x}`} x={x} y={STYLOBATE + 1.0} z={WING_FRONT} />
      ))}
      {bays.map((x) => (
        <ArchWindow key={`b${x}`} x={x} y={STYLOBATE + 1.0} z={WING_BACK} ry={Math.PI} />
      ))}
    </group>
  );
}

/** The centre's entablature, roof, pediment, and chimneys. */
function Roof() {
  const slope = flatMat(PALETTE.roofLead);
  const stone = flatMat(PALETTE.marble);
  const shade = flatMat(PALETTE.marbleShade);
  const cornice = flatMat(PALETTE.marbleStep);

  const midZ = (CENTRE_FRONT + CENTRE_BACK) / 2;
  const depth = CENTRE_FRONT - CENTRE_BACK;
  const halfDepth = depth / 2 + 0.5;
  const run = Math.hypot(halfDepth, ROOF_RISE);
  const pitch = Math.atan2(ROOF_RISE, halfDepth);

  const gable = useMemo(() => prismGeometry(halfDepth * 2, ROOF_RISE, 0.8), [halfDepth]);
  const pediment = useMemo(() => prismGeometry((PORTICO_X + 1.6) * 2, ROOF_RISE, 1.4), []);
  useEffect(
    () => () => {
      gable.dispose();
      pediment.dispose();
    },
    [gable, pediment]
  );

  return (
    <group>
      {/* Architrave, frieze, cornice — round the centre block and out over the
          portico. */}
      {([
        [CENTRE_X + 0.5, CENTRE_FRONT + 0.5, CENTRE_BACK - 0.5],
        [PORTICO_X + 1.4, PORTICO_FRONT + 1.0, CENTRE_FRONT],
      ] as const).map(([hx, front, back], i) => {
        const mz = (front + back) / 2;
        const d = front - back;
        return (
          <group key={i}>
            <mesh material={shade} position={[0, CENTRE_TOP + ARCH / 2, mz]}>
              <boxGeometry args={[hx * 2, ARCH, d]} />
            </mesh>
            <mesh material={stone} position={[0, CENTRE_TOP + ARCH + FRIEZE / 2, mz]}>
              <boxGeometry args={[hx * 2 - 0.25, FRIEZE, d - 0.25]} />
            </mesh>
            <mesh material={cornice} position={[0, ENTAB_TOP - CORNICE / 2, mz]}>
              <boxGeometry args={[hx * 2 + 1.0, CORNICE, d + 1.0]} />
            </mesh>
          </group>
        );
      })}

      {/* The roof: a low gable running the block's length, so each end shows a
          triangle over the wings — the house's own pediments, answering the
          portico's. rotation.x = +pitch drops a box's +z edge: the front slope
          (s = 1) tips its eaves down and its ridge line up. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={slope}
          position={[0, ENTAB_TOP + ROOF_RISE / 2, midZ + (s * halfDepth) / 2]}
          rotation={[s * pitch, 0, 0]}
        >
          <boxGeometry args={[CENTRE_X * 2 + 1.2, 0.45, run]} />
        </mesh>
      ))}
      <mesh material={shade} position={[0, ENTAB_TOP + ROOF_RISE + 0.16, midZ]}>
        <boxGeometry args={[CENTRE_X * 2 + 1.4, 0.42, 0.9]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={gable}
          material={stone}
          position={[s * (CENTRE_X + 0.4), ENTAB_TOP, midZ]}
          rotation={[0, Math.PI / 2, 0]}
        />
      ))}

      {/* The portico's pediment, rising to the same line as the ridge. */}
      <mesh geometry={pediment} material={stone} position={[0, ENTAB_TOP, PORTICO_FRONT + 0.4]} />

      {/* Chimneys astride the ridge — the plainest signal that people live
          under this roof, and the one thing no temple has. */}
      {[-4.4, 4.4].map((x) => (
        <group key={x} position={[x, ENTAB_TOP + ROOF_RISE, midZ]}>
          <mesh material={stone} position={[0, 1.4, 0]}>
            <boxGeometry args={[1.4, 3.2, 1.4]} />
          </mesh>
          <mesh material={cornice} position={[0, 3.05, 0]}>
            <boxGeometry args={[1.8, 0.5, 1.8]} />
          </mesh>
        </group>
      ))}

      {/* An acroterion at the pediment's apex and its two corners — kept from
          the temple, scaled to the house. */}
      {[
        [0, ENTAB_TOP + ROOF_RISE + 0.4],
        [-(PORTICO_X + 1.6), ENTAB_TOP + 0.4],
        [PORTICO_X + 1.6, ENTAB_TOP + 0.4],
      ].map(([x, y], i) => (
        <mesh key={i} material={flatMat(PALETTE.bronze)} position={[x, y + 0.55, PORTICO_FRONT + 0.4]}>
          <boxGeometry args={[0.9, 1.2, 0.9]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The gallery joining the west wing to the tramway's hall: an enclosed marble
 * link with its own low gable, running from the wing's end wall across the
 * court to the hall's side. It is what makes the hut a room of the house — a
 * station standing free on the court was an outbuilding, and the whole point
 * of a mountaintop tramway is that you step out of your own hall into it.
 */
function Gallery() {
  const wall = flatMat(PALETTE.marble);
  const shade = flatMat(PALETTE.marbleShade);
  const [hallX] = TRAM_TOP_LOCAL;
  /** From the wing's end into the hall's near wall, buried a little in each. */
  const from = -WING_OUT + 0.5;
  const to = hallX + 3.5;
  const midX = (from + to) / 2;
  const span = from - to;
  const z = TRAM_TOP_LOCAL[1] + 1.5;
  const top = DECK + 4.6;
  const rise = 1.1;
  const pitch = Math.atan2(rise, 1.9);
  const slope = Math.hypot(1.9, rise);

  return (
    <group>
      <mesh material={wall} position={[midX, (DECK + top) / 2, z]}>
        <boxGeometry args={[span, top - DECK, 3.4]} />
      </mesh>
      <mesh material={shade} position={[midX, top + 0.25, z]}>
        <boxGeometry args={[span, 0.5, 3.8]} />
      </mesh>
      {/* rotation.x = +pitch drops the +z edge, so s = 1 is the front slope. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={flatMat(PALETTE.roofLead)}
          position={[midX, top + 0.5 + rise / 2, z + (s * 1.9) / 2]}
          rotation={[s * pitch, 0, 0]}
        >
          <boxGeometry args={[span, 0.3, slope]} />
        </mesh>
      ))}
      {/* Portholes down its court side, so the gallery reads as a passage
          rather than a wall — small round-headed lights, the house's own. */}
      {[midX - 2.2, midX + 2.2].map((x) => (
        <ArchWindow key={x} x={x} y={DECK + 1.1} z={z + 1.7} width={1.0} height={2.6} />
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------
   The whole
   ---------------------------------------------------------------------- */

export function Mansion() {
  const crepidoma = flatMat(PALETTE.marbleStep);

  /**
   * Every column on the house: the portico's four with a return pair behind,
   * and the back porch's four.
   */
  const columns = useMemo<Column[]>(() => {
    const height = CENTRE_TOP - STYLOBATE;
    const out: Column[] = [];
    for (let i = 0; i < 4; i++) {
      const x = -PORTICO_X + (2 * PORTICO_X * i) / 3;
      out.push({ x, z: PORTICO_FRONT, base: STYLOBATE, height, radius: 0.88 });
    }
    for (const x of [-PORTICO_X, PORTICO_X])
      out.push({ x, z: PORTICO_FRONT - 4.1, base: STYLOBATE, height, radius: 0.88 });
    // The porch: the wings' height, not the centre's — a working back door,
    // not a second front.
    for (let i = 0; i < 4; i++) {
      const x = -PORTICO_X + (2 * PORTICO_X * i) / 3;
      out.push({ x, z: PORCH_BACK, base: STYLOBATE, height: WING_TOP - STYLOBATE, radius: 0.74 });
    }
    return out;
  }, []);

  return (
    <group position={[MANSION.x, 0, MANSION.z]} rotation={[0, MANSION.rotationY, 0]}>
      <Podium />
      <Balcony />

      {/* The crepidoma: three steps up to the house, out past the portico so
          the front flight is the way in, kept inside the podium's own plan. */}
      {[0, 1, 2].map((i) => {
        const inset = (2 - i) * 0.7;
        const front = PORTICO_FRONT + 1.2 + inset;
        const back = PORCH_BACK - 1.2 - inset;
        return (
          <mesh
            key={i}
            material={crepidoma}
            position={[0, DECK + STEP * (i + 0.5), (front + back) / 2]}
          >
            <boxGeometry args={[(WING_OUT + 0.6 + inset) * 2, STEP, front - back]} />
          </mesh>
        );
      })}

      <CentreBlock />
      <Wing side={-1} />
      <Wing side={1} />
      <Roof />
      <Gallery />
      <Colonnade columns={columns} />

      {/* The porch's flat roof, over its four columns. */}
      <mesh material={flatMat(PALETTE.marbleStep)} position={[0, WING_TOP + 0.6, (CENTRE_BACK + PORCH_BACK) / 2]}>
        <boxGeometry args={[(PORTICO_X + 0.9) * 2, 0.7, CENTRE_BACK - PORCH_BACK + 1]} />
      </mesh>
    </group>
  );
}
