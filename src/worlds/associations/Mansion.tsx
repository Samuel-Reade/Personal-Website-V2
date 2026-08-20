import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { MANSION, TRAM_TOP_LOCAL } from "./layout";

/**
 * A marble mansion on the crown of the range's great north-western peak.
 *
 * Greek Revival, and a house rather than a temple: a centre block with a giant
 * tetrastyle portico and pediment, a two-storey wing off each side under a
 * balustraded parapet, and chimneys on the ridge. The windows are Reade Hall's
 * own — round-headed, fanlights in the arch, a grid of glazing bars below,
 * dark joinery in a pale surround under a keystone — four of them to a row
 * either side of the pillared entrance, because this is the same estate seen
 * from outside: the Connect balcony hangs off the east wing's first floor, and
 * the tramway's hall is joined to the west end by a gallery.
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

/** Top of the terrace, and the ground for everything above it. */
const DECK = MANSION.deck;

/**
 * The terrace's plan: a walkway's width beyond the house and no more.
 *
 * It has been cut twice. The first was a bastion forty units of wall tall that
 * made the platform the monument and the house its ornament; the second still
 * carried a stepped skirt all the way round the building, which is a temple's
 * crepidoma and pushed the terrace three units wider on every side to hold it.
 * The skirt is gone — the house stands on a plain plinth with a flight only at
 * its door, which is what a house does — and the terrace shrank with it.
 */
const PODIUM_X = 18.2;
const PODIUM_FRONT = 10;
const PODIUM_BACK = -13;
/**
 * How far down the terrace's mass goes: below the lowest ground anywhere under
 * it, so it is solid stone wherever it meets the mountain and never a slab
 * with daylight under one corner. Where the ground is higher it is simply
 * buried, which is most of the western half.
 */
const PODIUM_BASE = 142;
/**
 * The top course is not a plinth but the undercroft storey — seven and a half
 * units between its floor and the terrace over it — so it carries windows.
 * `COURSE_OUT` is how far it stands proud of the deck's plan, which is where
 * its outer face is and so where those windows sit.
 */
const COURSE_OUT = 0.25;
const UNDERCROFT_FLOOR = 174;
const UNDERCROFT_SILL = 176.9;

/** The service court, off the western end, where the tramway's hall stands. */
const COURT = MANSION.court;
const COURT_IN = -PODIUM_X;
const COURT_OUT = -40;
const COURT_BACK = -13;
const COURT_FRONT = 0;

/**
 * The plinth the house itself stands on, and its floor. A plain base course
 * under the walls rather than steps round all four sides.
 */
const PLINTH = 1.7;
const STYLOBATE = DECK + PLINTH;

/** The centre block. */
const CENTRE_X = 6.6;
const CENTRE_FRONT = 4.5;
const CENTRE_BACK = -8;
const CENTRE_TOP = STYLOBATE + 13.6;

/**
 * The wings, and the wall Reade Hall actually has: a panelled base up to the
 * floor band, and one range of tall round-headed windows above it. Two storeys
 * of shorter ones was eight openings to a face and read as an office block —
 * the hall's own wall is four tall lights over a dado, with the sill band
 * marking the floor they are seen from inside.
 */
const WING_IN = CENTRE_X;
const WING_OUT = 17;
const WING_FRONT = 3;
const WING_BACK = -7;
const WING_TOP = STYLOBATE + 11.3;
/** The floor band: the string course, the window sills, and the balcony, all one line. */
const FIRST_FLOOR = STYLOBATE + 5.6;
const UPPER_SILL = STYLOBATE + 5.85;
/** Heads of every tall opening, the balcony's doors included, run on one line. */
const UPPER_HEAD = STYLOBATE + 10.45;

/**
 * Where the four windows sit on a wing's face.
 *
 * Grouped from the inner end at an even pitch, which leaves the outer end a
 * broad blank pier — "four windows and space toward the outside". Spread
 * evenly across the whole face instead they read as a colonnade of holes with
 * no end to the rhythm, and the corner has nothing to turn on.
 */
const BAY_INSET = 1.1;
const BAY_PITCH = 2.0;
const BAY_WIDTH = 1.3;

/** The portico across the centre's front, and the porch answering it behind. */
const PORTICO_X = 5.0;
const PORTICO_FRONT = 8.0;
const PORCH_BACK = -10.8;

/** Architrave, frieze and cornice on the centre block. */
const ARCH = 1.0;
const FRIEZE = 1.3;
const CORNICE = 0.85;
const ENTAB_TOP = CENTRE_TOP + ARCH + FRIEZE + CORNICE;

/** Rise of the roof, and of the portico's pediment — the same, so they meet. */
const ROOF_RISE = 3.0;

/**
 * The Connect balcony: off the east wing's first floor, out over the drop.
 *
 * On the upper storey, not the terrace — it is a balcony, which is a thing you
 * step out onto from a room upstairs, and at ground level it was a jetty. It
 * is carried on stepped corbels off the wing's own end wall, with between
 * twenty-five and forty units of mountain under it (measured, not guessed —
 * the ground falls from 166 to 151 across its own footprint) and nothing else.
 */
const BALCONY_IN = WING_OUT;
const BALCONY_OUT = 22.5;
const BALCONY_BACK = -5;
const BALCONY_FRONT = 2.5;
const BALCONY_SLAB = 1.1;
/** Level with the floor band, which is the floor it is a balcony off. */
const BALCONY_FLOOR = FIRST_FLOOR;

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
  width = 1.45,
  height = 4.2,
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
  const transoms = door ? [rectH * 0.45] : [rectH * 0.33, rectH * 0.66];

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
          a sill — or a threshold, where the window is the balcony's door. The
          sill's overhang is kept inside the bay spacing, or a row of four runs
          into itself. */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={stone} position={[s * (width / 2 + 0.2), y + rectH / 2, 0.12]}>
          <boxGeometry args={[0.24, rectH, 0.14]} />
        </mesh>
      ))}
      <mesh geometry={archPiece("stone", r)} material={stone} position={[0, springY, 0.12]} />
      <mesh material={stone} position={[0, springY + r + 0.24, 0.18]}>
        <boxGeometry args={[0.4, 0.66, 0.2]} />
      </mesh>
      <mesh material={stone} position={[0, y - 0.1, 0.18]}>
        <boxGeometry args={[width + (door ? 0.4 : 0.5), 0.2, door ? 0.3 : 0.4]} />
      </mesh>
    </group>
  );
}

/**
 * The Connect balcony's telescope, seen from outside.
 *
 * The same instrument that stands on that balcony in Reade Hall — a long
 * refractor on a timber tripod, dew shield flaring at the objective, focuser
 * and eyepiece at the back, finder on its rings — rebuilt at a fifth of the
 * detail and in this world's own materials rather than imported. Every world
 * here owns its shading, and the mansion's version is wired to a click that
 * opens an eyepiece view; there is nothing to open from a helicopter eighty
 * units away, so this is the object alone.
 *
 * Small on purpose. At full size it stood taller than the balustrade it is
 * meant to be looking over and read as a cannon; a man's instrument on a
 * balcony is about the height of the rail beside it.
 */
const SCOPE = 0.62;

function BalconyTelescope({
  x,
  y,
  z,
  rotationY,
}: {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}) {
  const wood = flatMat(PALETTE.stake);
  const brass = flatMat(PALETTE.bronze);
  const tube = flatMat(PALETTE.gantry);
  const glass = flatMat(PALETTE.windowGlass);

  /** Pitched a little up: level it reads as aimed at the hillside. */
  const pitch = 0.16;
  const tubeY = 1.62;

  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]} scale={SCOPE}>
      {/* Tripod: three legs leaning in to the hub, brass shoes, a spreader. */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        return (
          <group key={i}>
            <mesh
              material={wood}
              position={[Math.cos(a) * 0.34, 0.66, Math.sin(a) * 0.34]}
              rotation={[-Math.sin(a) * 0.46, 0, Math.cos(a) * 0.46]}
            >
              <cylinderGeometry args={[0.04, 0.05, 1.5, 5]} />
            </mesh>
            <mesh material={brass} position={[Math.cos(a) * 0.63, 0.05, Math.sin(a) * 0.63]}>
              <coneGeometry args={[0.05, 0.12, 5]} />
            </mesh>
            <mesh
              material={wood}
              position={[Math.cos(a) * 0.22, 0.52, Math.sin(a) * 0.22]}
              rotation={[0, -a, 0]}
            >
              <boxGeometry args={[0.46, 0.035, 0.06]} />
            </mesh>
          </group>
        );
      })}

      {/* Mount: hub, column and the altitude yoke. */}
      <mesh material={brass} position={[0, 1.32, 0]}>
        <cylinderGeometry args={[0.13, 0.17, 0.2, 6]} />
      </mesh>
      <mesh material={tube} position={[0, 1.46, 0]}>
        <cylinderGeometry args={[0.055, 0.065, 0.16, 6]} />
      </mesh>
      <mesh material={brass} position={[0, tubeY - 0.04, 0]}>
        <boxGeometry args={[0.12, 0.2, 0.3]} />
      </mesh>

      <group position={[0, tubeY, 0]} rotation={[pitch, 0, 0]}>
        {/* The tube: narrow at the eye end, swelling toward the objective. */}
        <mesh material={tube} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.085, 0.12, 2.0, 8]} />
        </mesh>
        <mesh material={brass} position={[0, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.122, 0.116, 0.06, 8]} />
        </mesh>
        {/* Dew shield, and the objective inside it. */}
        <mesh material={tube} position={[0, 0, -1.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.132, 0.15, 0.46, 8]} />
        </mesh>
        <mesh material={glass} position={[0, 0, -1.26]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.02, 8]} />
        </mesh>
        {/* Focuser and eyepiece at the back. */}
        <mesh material={brass} position={[0, -0.02, 0.98]}>
          <boxGeometry args={[0.17, 0.15, 0.2]} />
        </mesh>
        <mesh material={brass} position={[0, 0, 1.24]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.056, 0.28, 6]} />
        </mesh>
        {/* Finder scope on its rings. */}
        <mesh material={tube} position={[0.14, 0.15, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.038, 0.5, 6]} />
        </mesh>
        {[0.28, 0.68].map((fz) => (
          <mesh key={fz} material={brass} position={[0.14, 0.1, fz]}>
            <boxGeometry args={[0.035, 0.09, 0.05]} />
          </mesh>
        ))}
      </group>
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
 * The terrace the house stands on: a moulded cap and three battered courses
 * stepping back into the rock, each with its own top moulding so the face is
 * banded rather than blank. The bands are the point — the mass under a house
 * on a peak is fixed by the mountain, but a face broken into courses reads as
 * terracing, and one unbroken plane reads as a dam.
 */
function Podium() {
  const stone = flatMat(PALETTE.marbleDeep);
  const cap = flatMat(PALETTE.marbleShade);
  const width = PODIUM_X * 2;
  const depth = PODIUM_FRONT - PODIUM_BACK;
  const midZ = (PODIUM_FRONT + PODIUM_BACK) / 2;

  /** Each course: how far it stands proud of the deck's plan, and its top and bottom. */
  const courses: [number, number, number][] = [
    [COURSE_OUT, DECK - 1.0, UNDERCROFT_FLOOR],
    [1.3, UNDERCROFT_FLOOR, 165],
    [2.5, 165, PODIUM_BASE],
  ];

  /**
   * Windows in the top course, which turns it from a plinth into the storey it
   * is tall enough to be — seven and a half units between its floor and the
   * terrace over it.
   *
   * The run goes all the way round at one pitch, and the mountain covers what
   * it covers. Much of this course is underground — the rock rises to 177
   * across the middle of the front, which is the outcrop breaking through in
   * front of the house — and an earlier version tested each opening against
   * the ground and left the buried ones out. That was the wrong instinct: a
   * window behind rock costs nothing, because the rock is opaque and simply
   * stands in front of it, while a row with gaps cut out of it reads as a
   * building that forgot how to count. A real undercroft is windowed at an
   * even pitch and the hillside banks up against whichever ones it reaches.
   */
  const openings = useMemo(() => {
    const out: { x: number; z: number; ry: number }[] = [];
    const front = PODIUM_FRONT + COURSE_OUT;
    const back = PODIUM_BACK - COURSE_OUT;
    const side = PODIUM_X + COURSE_OUT;
    for (let x = -PODIUM_X + 2.4; x <= PODIUM_X - 2.4; x += 3.5) {
      out.push({ x, z: front, ry: 0 });
      out.push({ x, z: back, ry: Math.PI });
    }
    for (let z = PODIUM_BACK + 2.4; z <= PODIUM_FRONT - 2.4; z += 3.5) {
      out.push({ x: side, z, ry: Math.PI / 2 });
      out.push({ x: -side, z, ry: -Math.PI / 2 });
    }
    return out;
  }, []);

  return (
    <group>
      {/* A light cap: the old one oversailed by nearly two and read as a lip. */}
      <mesh material={cap} position={[0, DECK - 0.5, midZ]}>
        <boxGeometry args={[width + 1.0, 1.0, depth + 1.0]} />
      </mesh>

      {courses.map(([out, top, bottom], i) => (
        <group key={i}>
          <mesh material={stone} position={[0, (top + bottom) / 2, midZ]}>
            <boxGeometry args={[width + out * 2, top - bottom, depth + out * 2]} />
          </mesh>
          {/* A string course capping each band. */}
          <mesh material={cap} position={[0, top - 0.2, midZ]}>
            <boxGeometry args={[width + out * 2 + 0.5, 0.4, depth + out * 2 + 0.5]} />
          </mesh>
        </group>
      ))}

      {/* The undercroft's windows: the house's own arched light, shorter and
          plainer, as a service storey's would be under the principal one. */}
      {openings.map((o, i) => (
        <ArchWindow
          key={i}
          x={o.x}
          y={UNDERCROFT_SILL}
          z={o.z}
          ry={o.ry}
          width={1.15}
          height={2.9}
        />
      ))}

      {/* The service court: a lower terrace off the western end carrying the
          tramway's hall, with a short flight up to the house's level. */}
      <mesh
        material={cap}
        position={[(COURT_IN + COURT_OUT) / 2, COURT - 0.5, (COURT_BACK + COURT_FRONT) / 2]}
      >
        <boxGeometry args={[COURT_IN - COURT_OUT + 1.2, 1.0, COURT_FRONT - COURT_BACK + 1.2]} />
      </mesh>
      <mesh
        material={stone}
        position={[(COURT_IN + COURT_OUT) / 2, (COURT - 1.0 + PODIUM_BASE) / 2, (COURT_BACK + COURT_FRONT) / 2]}
      >
        <boxGeometry args={[COURT_IN - COURT_OUT, COURT - 1.0 - PODIUM_BASE, COURT_FRONT - COURT_BACK]} />
      </mesh>
      {/* The flight between the two levels, stepping *west* out of the
          terrace's edge. Run the other way it climbed into the podium and
          every tread of it was buried in solid stone — the whole stair was
          inside the mass it was supposed to be climbing. */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          material={cap}
          position={[COURT_IN - (4 - i) * 0.85 + 0.425, COURT + 0.44 + i * 0.875, -6.5]}
        >
          <boxGeometry args={[0.85, 0.875, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The Connect balcony: a slab off the east wing's first floor, its French
 * doors on the upper storey's own head line, and a balustraded rail on the
 * three open sides. Reade Hall's balcony seen from outside — which is all this
 * world can do with it.
 */
function Balcony() {
  const stone = flatMat(PALETTE.marbleDeep);
  const deck = flatMat(PALETTE.marbleShade);
  const midX = (BALCONY_IN + BALCONY_OUT) / 2;
  const midZ = (BALCONY_BACK + BALCONY_FRONT) / 2;
  const width = BALCONY_OUT - BALCONY_IN;
  const depth = BALCONY_FRONT - BALCONY_BACK;
  const under = BALCONY_FLOOR - BALCONY_SLAB;

  return (
    <group>
      {/* Corbels off the wing's end wall — the balcony is on the first floor
          now, so nothing under it reaches the terrace. Three stepped brackets,
          each shorter than the one above it. */}
      {[BALCONY_BACK + 1.2, midZ, BALCONY_FRONT - 1.2].map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh material={stone} position={[BALCONY_IN + 2.1, under - 0.75, 0]}>
            <boxGeometry args={[4.6, 1.5, 1.5]} />
          </mesh>
          <mesh material={stone} position={[BALCONY_IN + 1.3, under - 2.0, 0]}>
            <boxGeometry args={[3.0, 1.2, 1.2]} />
          </mesh>
          <mesh material={stone} position={[BALCONY_IN + 0.7, under - 3.0, 0]}>
            <boxGeometry args={[1.8, 1.0, 1.0]} />
          </mesh>
        </group>
      ))}

      <mesh material={deck} position={[midX, BALCONY_FLOOR - BALCONY_SLAB / 2, midZ]}>
        <boxGeometry args={[width, BALCONY_SLAB, depth]} />
      </mesh>

      <Parapet x={midX} y={BALCONY_FLOOR} z={BALCONY_FRONT - 0.25} length={width} />
      <Parapet x={midX} y={BALCONY_FLOOR} z={BALCONY_BACK + 0.25} length={width} />
      <Parapet x={BALCONY_OUT - 0.25} y={BALCONY_FLOOR} z={midZ} length={depth} across />

      {/* The doors out, in the wing's end wall, on the upper head line. */}
      <ArchWindow
        x={WING_OUT}
        y={BALCONY_FLOOR}
        z={midZ}
        ry={Math.PI / 2}
        width={2.1}
        height={UPPER_HEAD - BALCONY_FLOOR}
        door
      />

      {/* And the telescope, set out near the rail and aimed at the far cluster
          of balloons — which from this balcony lies almost straight out over
          the outer balustrade, five degrees off the wing's own axis. That is
          the bearing below, not a guess: the house's frame is turned 50.2° from
          the world's, and the cluster sits at 130.6° in the world. */}
      <BalconyTelescope
        x={BALCONY_OUT - 2.3}
        y={BALCONY_FLOOR}
        z={midZ - 0.4}
        rotationY={-1.74}
      />
    </group>
  );
}

/** The centre block: walls, the door under the portico, and its windows. */
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

      {/* The base and the floor band, on the same lines as the wings' — one
          dado and one floor right across the house. */}
      <mesh material={shade} position={[0, STYLOBATE + 0.3, midZ]}>
        <boxGeometry args={[CENTRE_X * 2 + 0.34, 0.6, depth + 0.34]} />
      </mesh>
      <mesh material={shade} position={[0, FIRST_FLOOR, midZ]}>
        <boxGeometry args={[CENTRE_X * 2 + 0.42, 0.42, depth + 0.42]} />
      </mesh>

      {/* The front door, in the portico's shadow: a bronze pair under a
          transom, with sidelights — the one doorway on the house, and dressed
          like it. */}
      <group position={[0, 0, CENTRE_FRONT]}>
        <mesh material={shade} position={[0, STYLOBATE + 2.6, 0.18]}>
          <boxGeometry args={[5.0, 5.4, 0.36]} />
        </mesh>
        <mesh material={flatMat(PALETTE.bronze)} position={[0, STYLOBATE + 2.3, 0.42]}>
          <boxGeometry args={[2.8, 4.8, 0.22]} />
        </mesh>
        <mesh material={flatMat(PALETTE.bronzeDark)} position={[0, STYLOBATE + 2.3, 0.55]}>
          <boxGeometry args={[0.18, 4.8, 0.1]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={flatMat(PALETTE.windowGlass)} position={[s * 1.9, STYLOBATE + 2.3, 0.42]}>
            <boxGeometry args={[0.7, 4.8, 0.2]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.windowGlass)} position={[0, STYLOBATE + 5.05, 0.42]}>
          <boxGeometry args={[4.5, 0.7, 0.2]} />
        </mesh>
      </group>

      {/* Tall lights over the door, seen between the portico's columns, and
          three more across the back — the same range as the wings', on the
          same sill and the same head. */}
      {[-4.4, 4.4].map((x) => (
        <ArchWindow
          key={`fu${x}`}
          x={x}
          y={UPPER_SILL}
          z={CENTRE_FRONT}
          width={BAY_WIDTH}
          height={UPPER_HEAD - UPPER_SILL}
        />
      ))}
      {[-4.4, 0, 4.4].map((x) => (
        <ArchWindow
          key={`bu${x}`}
          x={x}
          y={UPPER_SILL}
          z={CENTRE_BACK}
          ry={Math.PI}
          width={BAY_WIDTH}
          height={UPPER_HEAD - UPPER_SILL}
        />
      ))}
    </group>
  );
}

/**
 * One wing: two storeys behind Reade Hall's arched windows, four bays to the
 * row — the four either side of the pillared entrance — under an entablature
 * and a balustraded parapet. The upper storey is what the Connect balcony
 * opens off.
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

  /** Four bays from the inner end, leaving the outer corner a broad pier. */
  const bays = [0, 1, 2, 3].map((i) => inX + side * (BAY_INSET + i * BAY_PITCH));
  /** The pier the run ends on, and the pilaster standing on it. */
  const pierX = outX - side * 1.1;

  return (
    <group>
      <mesh material={wall} position={[midX, (STYLOBATE + WING_TOP) / 2, midZ]}>
        <boxGeometry args={[width, WING_TOP - STYLOBATE, depth]} />
      </mesh>

      {/* The panelled base, and the floor band the sills sit on — the two
          horizontals the hall's own wall is built around. */}
      <mesh material={shade} position={[midX, STYLOBATE + 0.3, midZ]}>
        <boxGeometry args={[width + 0.34, 0.6, depth + 0.34]} />
      </mesh>
      <mesh material={flatMat(PALETTE.marbleShade)} position={[midX, STYLOBATE + 3.0, midZ]}>
        <boxGeometry args={[width - 0.5, 4.2, depth + 0.16]} />
      </mesh>
      <mesh material={shade} position={[midX, FIRST_FLOOR, midZ]}>
        <boxGeometry args={[width + 0.42, 0.42, depth + 0.42]} />
      </mesh>

      {/* A pilaster on the blank pier at each outer corner, front and back,
          so the run of windows ends on something. */}
      {[WING_FRONT, WING_BACK].map((z) => (
        <mesh key={z} material={wall} position={[pierX, (FIRST_FLOOR + WING_TOP) / 2 + 0.3, z]}>
          <boxGeometry args={[1.3, WING_TOP - FIRST_FLOOR - 0.6, 0.34]} />
        </mesh>
      ))}

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

      {/* The windows: four tall lights to a face, front and back, standing on
          the floor band. The east end wall carries the balcony's doors (see
          Balcony) and the west end is where the gallery comes in (see
          Gallery), so neither end takes a window. */}
      {bays.map((x) => (
        <ArchWindow
          key={`f${x}`}
          x={x}
          y={UPPER_SILL}
          z={WING_FRONT}
          width={BAY_WIDTH}
          height={UPPER_HEAD - UPPER_SILL}
        />
      ))}
      {bays.map((x) => (
        <ArchWindow
          key={`b${x}`}
          x={x}
          y={UPPER_SILL}
          z={WING_BACK}
          ry={Math.PI}
          width={BAY_WIDTH}
          height={UPPER_HEAD - UPPER_SILL}
        />
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
  const pediment = useMemo(() => prismGeometry((PORTICO_X + 1.5) * 2, ROOF_RISE, 1.4), []);
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
        [PORTICO_X + 1.3, PORTICO_FRONT + 1.0, CENTRE_FRONT],
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
      {[-4.2, 4.2].map((x) => (
        <group key={x} position={[x, ENTAB_TOP + ROOF_RISE, midZ]}>
          <mesh material={stone} position={[0, 1.4, 0]}>
            <boxGeometry args={[1.3, 3.0, 1.3]} />
          </mesh>
          <mesh material={cornice} position={[0, 2.95, 0]}>
            <boxGeometry args={[1.7, 0.5, 1.7]} />
          </mesh>
        </group>
      ))}

      {/* An acroterion at the pediment's apex and its two corners — kept from
          the temple, scaled to the house. */}
      {[
        [0, ENTAB_TOP + ROOF_RISE + 0.4],
        [-(PORTICO_X + 1.5), ENTAB_TOP + 0.4],
        [PORTICO_X + 1.5, ENTAB_TOP + 0.4],
      ].map(([x, y], i) => (
        <mesh key={i} material={flatMat(PALETTE.bronze)} position={[x, y + 0.5, PORTICO_FRONT + 0.4]}>
          <boxGeometry args={[0.85, 1.1, 0.85]} />
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
 *
 * It grew when the hall moved west: the link is the length the ground between
 * them happens to be, which is what a link is.
 */
function Gallery() {
  const wall = flatMat(PALETTE.marble);
  const shade = flatMat(PALETTE.marbleShade);
  const [hallX, hallZ] = TRAM_TOP_LOCAL;
  /** From the wing's end into the hall's near wall, buried a little in each. */
  const from = -WING_OUT + 0.5;
  const to = hallX + 3.5;
  const midX = (from + to) / 2;
  const span = from - to;
  const z = hallZ + 1.5;
  const top = DECK + 4.6;
  const rise = 1.1;
  const pitch = Math.atan2(rise, 1.9);
  const slope = Math.hypot(1.9, rise);

  return (
    <group>
      {/* Down to the court, not to the deck: west of the terrace there is no
          deck under it, and a corridor with three units of daylight beneath is
          a bridge nobody built. */}
      <mesh material={wall} position={[midX, (COURT + top) / 2, z]}>
        <boxGeometry args={[span, top - COURT, 3.4]} />
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
      {/* Lights down its court side, so the gallery reads as a passage rather
          than a wall — small round-headed ones, the house's own. */}
      {[-0.32, -0.11, 0.11, 0.32].map((f, i) => (
        <ArchWindow key={i} x={midX + f * span} y={DECK + 1.1} z={z + 1.7} width={1.0} height={2.6} />
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------
   The whole
   ---------------------------------------------------------------------- */

export function Mansion() {
  const step = flatMat(PALETTE.marbleStep);

  /**
   * Every column on the house: the portico's four with a return pair behind,
   * and the back porch's four.
   */
  const columns = useMemo<Column[]>(() => {
    const height = CENTRE_TOP - STYLOBATE;
    const out: Column[] = [];
    for (let i = 0; i < 4; i++) {
      const x = -PORTICO_X + (2 * PORTICO_X * i) / 3;
      out.push({ x, z: PORTICO_FRONT, base: STYLOBATE, height, radius: 0.84 });
    }
    for (const x of [-PORTICO_X, PORTICO_X])
      out.push({ x, z: PORTICO_FRONT - 3.8, base: STYLOBATE, height, radius: 0.84 });
    // The porch: the wings' height, not the centre's — a working back door,
    // not a second front.
    for (let i = 0; i < 4; i++) {
      const x = -PORTICO_X + (2 * PORTICO_X * i) / 3;
      out.push({ x, z: PORCH_BACK, base: STYLOBATE, height: WING_TOP - STYLOBATE, radius: 0.72 });
    }
    return out;
  }, []);

  return (
    <group position={[MANSION.x, 0, MANSION.z]} rotation={[0, MANSION.rotationY, 0]}>
      <Podium />

      {/* The plinth: one base course under the whole house, where a stepped
          crepidoma round all four sides used to be. That skirt was the last
          temple part of the building, and it was also what forced the terrace
          wide enough to hold it. */}
      <mesh
        material={step}
        position={[0, DECK + PLINTH / 2, (PORTICO_FRONT + PORCH_BACK) / 2]}
      >
        <boxGeometry args={[WING_OUT * 2 + 1.2, PLINTH, PORTICO_FRONT - PORCH_BACK + 1.2]} />
      </mesh>

      {/* And the flight up to the door, in front of the portico only.
          Each tread is a solid block from the terrace up to its own top rather
          than a slab nested inside the one below it: nested treads run their
          bottom step three units past the terrace's front edge, and with the
          terrace cut back that far it was a stair hanging over the drop. */}
      {[0, 1, 2].map((i) => {
        const top = DECK + (PLINTH * (3 - i)) / 3;
        const z0 = PORTICO_FRONT + 0.6 + i * 0.45;
        return (
          <mesh key={i} material={step} position={[0, (DECK + top) / 2, z0 + 0.225]}>
            <boxGeometry args={[(PORTICO_X + 1.8) * 2, top - DECK, 0.45]} />
          </mesh>
        );
      })}

      <Balcony />
      <CentreBlock />
      <Wing side={-1} />
      <Wing side={1} />
      <Roof />
      <Gallery />
      <Colonnade columns={columns} />

      {/* The porch's flat roof, over its four columns. */}
      <mesh material={step} position={[0, WING_TOP + 0.6, (CENTRE_BACK + PORCH_BACK) / 2]}>
        <boxGeometry args={[(PORTICO_X + 0.9) * 2, 0.7, CENTRE_BACK - PORCH_BACK + 1]} />
      </mesh>
    </group>
  );
}
