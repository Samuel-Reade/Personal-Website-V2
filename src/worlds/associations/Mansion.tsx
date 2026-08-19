import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { MANSION } from "./layout";

/**
 * A marble mansion on the crown of the range's great north-western peak.
 *
 * Greek Revival, and a house rather than a temple: a two-storey centre block
 * with a giant tetrastyle portico and pediment, a lower wing off each side
 * under a balustraded parapet, sash windows in surrounds on every face, and
 * chimneys on the ridge — the plan of an estate house wearing the temple's
 * clothes, which is what the style is. Every face is symmetrical about its own
 * middle: the wings answer each other, the back carries a porch where the
 * front carries the portico, and the ends match window for window.
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

/** The podium's plan. */
const PODIUM_X = 22;
const PODIUM_FRONT = 16;
const PODIUM_BACK = -15;
/**
 * How far down the podium's mass goes: below the lowest ground anywhere under
 * it, so the terrace is solid stone wherever it meets the mountain and never a
 * slab with daylight under one corner. Where the ground is higher it is simply
 * buried, which is most of the western half.
 */
const PODIUM_BASE = 138;

/**
 * The service court, off the western end and a few steps down: the tramway's
 * hall stands on it — see `MANSION.court`.
 */
const COURT = MANSION.court;
const COURT_IN = -PODIUM_X;
const COURT_OUT = -34;
const COURT_BACK = -16;
const COURT_FRONT = -4;

/** Three steps from the terrace up to the house. */
const STEP = 0.62;
const STYLOBATE = DECK + STEP * 3;

/** The centre block: two tall storeys. */
const CENTRE_X = 8;
const CENTRE_FRONT = 5;
const CENTRE_BACK = -9;
const CENTRE_TOP = STYLOBATE + 12.6;

/** The wings: one storey lower, one bay shallower, one each side. */
const WING_IN = CENTRE_X;
const WING_OUT = 19;
const WING_FRONT = 3.5;
const WING_BACK = -7.5;
const WING_TOP = STYLOBATE + 8.8;

/** The portico across the centre's front, and the porch answering it behind. */
const PORTICO_X = 5.8;
const PORTICO_FRONT = 9.6;
const PORCH_BACK = -12.6;

/** Architrave, frieze and cornice on the centre block. */
const ARCH = 1.0;
const FRIEZE = 1.3;
const CORNICE = 0.85;
const ENTAB_TOP = CENTRE_TOP + ARCH + FRIEZE + CORNICE;

/** Rise of the roof, and of the portico's pediment — the same, so they meet. */
const ROOF_RISE = 3.4;

/** The balcony hung off the right-hand end, out over the drop. */
const BALCONY_IN = PODIUM_X;
const BALCONY_OUT = 33;
const BALCONY_BACK = -9;
const BALCONY_FRONT = 7;
const BALCONY_SLAB = 1.7;
/** The pavilion's roof, gabled across the balcony's narrow way. */
const PAVILION_RISE = 2.3;
const PAVILION_RUN = Math.hypot((BALCONY_OUT - BALCONY_IN + 0.9) / 2, PAVILION_RISE);
const PAVILION_PITCH = Math.atan2(PAVILION_RISE, (BALCONY_OUT - BALCONY_IN + 0.9) / 2);

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
 * There are a dozen and a half of them and they differ only in placement and
 * size, which is exactly what instancing is for.
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
 * A sash window in a moulded surround, with a sill and a lintel standing proud
 * of the wall. The surrounds are what turn a block with holes in it into a
 * house: a temple has none, and a mansion is made of them.
 */
function Window({
  x,
  y,
  z,
  ry = 0,
  width = 1.9,
  height = 3.2,
}: {
  x: number;
  y: number;
  z: number;
  ry?: number;
  width?: number;
  height?: number;
}) {
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
      <mesh material={flatMat(PALETTE.marbleShade)} position={[0, 0, 0.14]}>
        <boxGeometry args={[width + 0.55, height + 0.5, 0.28]} />
      </mesh>
      <mesh material={flatMat(PALETTE.windowGlass)} position={[0, 0, 0.24]}>
        <boxGeometry args={[width, height, 0.18]} />
      </mesh>
      {/* Glazing bar and sill. */}
      <mesh material={flatMat(PALETTE.marble)} position={[0, 0, 0.3]}>
        <boxGeometry args={[width, 0.14, 0.1]} />
      </mesh>
      <mesh material={flatMat(PALETTE.marbleStep)} position={[0, -height / 2 - 0.28, 0.26]}>
        <boxGeometry args={[width + 0.8, 0.22, 0.5]} />
      </mesh>
      {/* Lintel, oversailing like a small cornice. */}
      <mesh material={flatMat(PALETTE.marbleStep)} position={[0, height / 2 + 0.36, 0.26]}>
        <boxGeometry args={[width + 0.9, 0.3, 0.5]} />
      </mesh>
    </group>
  );
}

/**
 * A balustraded parapet along one edge: a plinth, a rail, and the balusters
 * between them as one instanced mesh per run would be overkill — at the
 * distances this house is seen from, piers at intervals under a continuous
 * rail read as balustrade for a fraction of the geometry.
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
 * The terrace the house stands on: a battered wall stepping outward as it goes
 * down, a moulded cap, and buttresses on the faces that stand clear of the
 * mountain. Its courses widen with depth rather than staying plumb — a
 * vertical wall this tall reads as a screen stood on the hill; a battered one
 * reads as something holding the hill up, which is what it is.
 */
function Podium() {
  const stone = flatMat(PALETTE.marbleDeep);
  const cap = flatMat(PALETTE.marbleShade);
  const width = PODIUM_X * 2;
  const depth = PODIUM_FRONT - PODIUM_BACK;
  const midZ = (PODIUM_FRONT + PODIUM_BACK) / 2;

  /** Each course: how far it stands proud of the deck's plan, and its top and bottom. */
  const courses: [number, number, number][] = [
    [0.4, DECK - 1.4, 172],
    [1.9, 172, 156],
    [3.6, 156, PODIUM_BASE],
  ];

  return (
    <group>
      <mesh material={cap} position={[0, DECK - 0.7, midZ]}>
        <boxGeometry args={[width + 2.2, 1.4, depth + 2.2]} />
      </mesh>

      {courses.map(([out, top, bottom], i) => (
        <mesh key={i} material={stone} position={[0, (top + bottom) / 2, midZ]}>
          <boxGeometry args={[width + out * 2, top - bottom, depth + out * 2]} />
        </mesh>
      ))}

      {/* Buttresses on the front and the right-hand end — the faces that stand
          out of the mountain. The back and the left are buried in the crest. */}
      {[-15, -5, 5, 15].map((x) => (
        <mesh key={`f${x}`} material={stone} position={[x, (DECK - 2 + PODIUM_BASE) / 2, PODIUM_FRONT + 2.6]}>
          <boxGeometry args={[3.4, DECK - 2 - PODIUM_BASE, 5.2]} />
        </mesh>
      ))}
      {[-8, 2, 11].map((z) => (
        <mesh key={`e${z}`} material={stone} position={[PODIUM_X + 2.6, (DECK - 2 + PODIUM_BASE) / 2, z]}>
          <boxGeometry args={[5.2, DECK - 2 - PODIUM_BASE, 3.4]} />
        </mesh>
      ))}

      {/* The service court: a lower terrace off the western end, carrying the
          tramway's hall, with a short flight up to the house's own level. */}
      <mesh
        material={cap}
        position={[(COURT_IN + COURT_OUT) / 2, COURT - 0.7, (COURT_BACK + COURT_FRONT) / 2]}
      >
        <boxGeometry args={[COURT_IN - COURT_OUT + 1.6, 1.4, COURT_FRONT - COURT_BACK + 1.6]} />
      </mesh>
      <mesh
        material={stone}
        position={[(COURT_IN + COURT_OUT) / 2, (COURT - 1.4 + PODIUM_BASE) / 2, (COURT_BACK + COURT_FRONT) / 2]}
      >
        <boxGeometry args={[COURT_IN - COURT_OUT, COURT - 1.4 - PODIUM_BASE, COURT_FRONT - COURT_BACK]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          material={cap}
          position={[COURT_IN + 1 + i * 0.9, COURT + 0.44 + i * 0.88, -10]}
        >
          <boxGeometry args={[0.9, 0.88, 7]} />
        </mesh>
      ))}

      {/* A parapet along the terrace's exposed edges, so the deck reads as a
          place a person could stand rather than as the top of a wall. Left
          open where the crepidoma meets it, which is the way in. */}
      <Parapet x={-14} y={DECK} z={PODIUM_FRONT + 0.8} length={16} />
      <Parapet x={14} y={DECK} z={PODIUM_FRONT + 0.8} length={16} />
    </group>
  );
}

/**
 * The balcony on the right-hand end, and the only part of the house with
 * nothing under it — east of the summit the drop is fifty, so it is carried on
 * stepped corbels off the podium's own wall the way a real one that size would
 * be. Roofed with a small open pavilion so it reads as somewhere to stand.
 *
 * Its long side faces the range's far north, where the other cluster of
 * balloons flies: that side is a low kerb rather than a parapet, so from the
 * floor of the pavilion the cluster sits in view between the columns.
 */
function Balcony() {
  const stone = flatMat(PALETTE.marbleDeep);
  const deck = flatMat(PALETTE.marbleShade);
  const midX = (BALCONY_IN + BALCONY_OUT) / 2;
  const midZ = (BALCONY_BACK + BALCONY_FRONT) / 2;
  const width = BALCONY_OUT - BALCONY_IN;
  const depth = BALCONY_FRONT - BALCONY_BACK;

  const pediment = useMemo(() => prismGeometry(width + 0.9, PAVILION_RISE, 0.5), [width]);
  useEffect(() => () => pediment.dispose(), [pediment]);

  return (
    <group>
      {/* Corbels, stepping out of the wall to catch the slab. */}
      {[-7, -2.5, 2, 5.5].map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh material={stone} position={[BALCONY_IN + 2.2, DECK - 3.2, 0]}>
            <boxGeometry args={[6.4, 2.2, 2.6]} />
          </mesh>
          <mesh material={stone} position={[BALCONY_IN + 4.2, DECK - 5, 0]}>
            <boxGeometry args={[3.4, 1.8, 2.2]} />
          </mesh>
        </group>
      ))}

      <mesh material={deck} position={[midX, DECK - BALCONY_SLAB / 2, midZ]}>
        <boxGeometry args={[width, BALCONY_SLAB, depth]} />
      </mesh>

      {/* Balustrades on the south end and the outer edge; the north side is a
          kerb only, so the far balloons are in view from the floor. */}
      <Parapet x={midX} y={DECK} z={BALCONY_FRONT - 0.35} length={width} />
      <Parapet x={BALCONY_OUT - 0.35} y={DECK} z={midZ} length={depth} across />
      <mesh material={flatMat(PALETTE.marble)} position={[midX, DECK + 0.35, BALCONY_BACK + 0.35]}>
        <boxGeometry args={[width, 0.7, 0.7]} />
      </mesh>

      {/* The pavilion's entablature, and a roof gabled the short way so the
          triangle it makes faces the balloons. Its columns are in the house's
          one colonnade — see `Mansion` below. */}
      <mesh material={flatMat(PALETTE.marble)} position={[midX, DECK + 8.7, midZ]}>
        <boxGeometry args={[width - 1.4, 0.9, depth - 1.4]} />
      </mesh>
      <mesh material={flatMat(PALETTE.marbleStep)} position={[midX, DECK + 9.4, midZ]}>
        <boxGeometry args={[width + 0.9, 0.55, depth + 0.9]} />
      </mesh>
      {/* rotation.z = +pitch lifts a box's +x edge, so the left slope (s = -1)
          needs the positive angle to rise toward the ridge. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={flatMat(PALETTE.roofLead)}
          position={[midX + (s * (width + 0.9)) / 4, DECK + 10.8, midZ]}
          rotation={[0, 0, -s * PAVILION_PITCH]}
        >
          <boxGeometry args={[PAVILION_RUN, 0.4, depth + 0.9]} />
        </mesh>
      ))}
      {[BALCONY_BACK - 0.15, BALCONY_FRONT + 0.15].map((z, i) => (
        <mesh
          key={i}
          geometry={pediment}
          material={flatMat(PALETTE.marble)}
          position={[midX, DECK + 9.7, z]}
        />
      ))}
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

      {/* A string course between the storeys, right round the block. */}
      <mesh material={shade} position={[0, STYLOBATE + 6.4, midZ]}>
        <boxGeometry args={[CENTRE_X * 2 + 0.4, 0.36, depth + 0.4]} />
      </mesh>

      {/* The front door, in the portico's shadow: a bronze pair under a
          transom, with sidelights — the one doorway on the house, and dressed
          like it. */}
      <group position={[0, 0, CENTRE_FRONT]}>
        <mesh material={shade} position={[0, STYLOBATE + 3.6, 0.18]}>
          <boxGeometry args={[5.6, 7.2, 0.36]} />
        </mesh>
        <mesh material={flatMat(PALETTE.bronze)} position={[0, STYLOBATE + 3.2, 0.42]}>
          <boxGeometry args={[3.2, 6.4, 0.22]} />
        </mesh>
        <mesh material={flatMat(PALETTE.bronzeDark)} position={[0, STYLOBATE + 3.2, 0.55]}>
          <boxGeometry args={[0.18, 6.4, 0.1]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={flatMat(PALETTE.windowGlass)} position={[s * 2.15, STYLOBATE + 3.2, 0.42]}>
            <boxGeometry args={[0.9, 6.4, 0.2]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.windowGlass)} position={[0, STYLOBATE + 6.95, 0.42]}>
          <boxGeometry args={[5.2, 0.9, 0.2]} />
        </mesh>
      </group>

      {/* Windows: the upper storey across the front, both storeys on the back
          — the porch shades the lower back windows the way the portico shades
          the door — and both storeys inside the portico's returns. */}
      {[-5.6, 5.6].map((x) => (
        <Window key={`fu${x}`} x={x} y={STYLOBATE + 9.4} z={CENTRE_FRONT} height={2.7} />
      ))}
      {[-5.6, 0, 5.6].map((x) => (
        <Window key={`bu${x}`} x={x} y={STYLOBATE + 9.4} z={CENTRE_BACK} ry={Math.PI} height={2.7} />
      ))}
      {[-5.6, 5.6].map((x) => (
        <Window key={`bl${x}`} x={x} y={STYLOBATE + 3.4} z={CENTRE_BACK} ry={Math.PI} height={3.4} />
      ))}
    </group>
  );
}

/** One wing: walls, windows on three faces, entablature and parapet. */
function Wing({ side }: { side: number }) {
  const wall = flatMat(PALETTE.marble);
  const shade = flatMat(PALETTE.marbleShade);
  const inX = side * WING_IN;
  const outX = side * WING_OUT;
  const midX = (inX + outX) / 2;
  const midZ = (WING_FRONT + WING_BACK) / 2;
  const width = Math.abs(outX - inX);
  const depth = WING_FRONT - WING_BACK;

  /** Window bays across the wing's front and back. */
  const bays = [midX - side * width * 0.22, midX + side * width * 0.22];

  return (
    <group>
      <mesh material={wall} position={[midX, (STYLOBATE + WING_TOP) / 2, midZ]}>
        <boxGeometry args={[width, WING_TOP - STYLOBATE, depth]} />
      </mesh>
      <mesh material={shade} position={[midX, STYLOBATE + 4.7, midZ]}>
        <boxGeometry args={[width + 0.4, 0.32, depth + 0.4]} />
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

      {/* Windows: two bays and two storeys on the front and the back, and one
          of each on the outer end. */}
      {bays.map((x) => (
        <Window key={`f${x}`} x={x} y={STYLOBATE + 2.9} z={WING_FRONT} height={3.0} />
      ))}
      {bays.map((x) => (
        <Window key={`fu${x}`} x={x} y={STYLOBATE + 6.9} z={WING_FRONT} height={2.3} />
      ))}
      {bays.map((x) => (
        <Window key={`b${x}`} x={x} y={STYLOBATE + 2.9} z={WING_BACK} ry={Math.PI} height={3.0} />
      ))}
      {bays.map((x) => (
        <Window key={`bu${x}`} x={x} y={STYLOBATE + 6.9} z={WING_BACK} ry={Math.PI} height={2.3} />
      ))}
      <Window x={outX} y={STYLOBATE + 2.9} z={midZ} ry={(side * Math.PI) / 2} height={3.0} />
      <Window x={outX} y={STYLOBATE + 6.9} z={midZ} ry={(side * Math.PI) / 2} height={2.3} />
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
      {/* Architrave, frieze, cornice — run round the centre block and out over
          the portico and the back porch. */}
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
          portico's. */}
      {/* rotation.x = +pitch drops a box's +z edge: the front slope (s = 1)
          tips its eaves down and its ridge line up. The sign was flipped once,
          and the pair met in a valley — a butterfly roof on a Greek house. */}
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
      {[-4.8, 4.8].map((x) => (
        <group key={x} position={[x, ENTAB_TOP + ROOF_RISE, midZ]}>
          <mesh material={stone} position={[0, 1.5, 0]}>
            <boxGeometry args={[1.5, 3.4, 1.5]} />
          </mesh>
          <mesh material={cornice} position={[0, 3.25, 0]}>
            <boxGeometry args={[1.9, 0.5, 1.9]} />
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

/* -------------------------------------------------------------------------
   The whole
   ---------------------------------------------------------------------- */

export function Mansion() {
  const crepidoma = flatMat(PALETTE.marbleStep);

  /**
   * Every column on the house: the portico's four with a return pair behind,
   * the back porch's four, and the six of the balcony's pavilion.
   */
  const columns = useMemo<Column[]>(() => {
    const height = CENTRE_TOP - STYLOBATE;
    const out: Column[] = [];
    for (let i = 0; i < 4; i++) {
      const x = -PORTICO_X + (2 * PORTICO_X * i) / 3;
      out.push({ x, z: PORTICO_FRONT, base: STYLOBATE, height, radius: 0.92 });
    }
    for (const x of [-PORTICO_X, PORTICO_X])
      out.push({ x, z: PORTICO_FRONT - 4.4, base: STYLOBATE, height, radius: 0.92 });
    // The porch: the wings' height, not the centre's — a working back door,
    // not a second front.
    for (let i = 0; i < 4; i++) {
      const x = -PORTICO_X + (2 * PORTICO_X * i) / 3;
      out.push({ x, z: PORCH_BACK, base: STYLOBATE, height: WING_TOP - STYLOBATE, radius: 0.78 });
    }
    const px = [BALCONY_IN + 2.2, (BALCONY_IN + BALCONY_OUT) / 2, BALCONY_OUT - 2.2];
    for (const x of px)
      for (const z of [BALCONY_BACK + 2, BALCONY_FRONT - 2])
        out.push({ x, z, base: DECK, height: 8.4, radius: 0.72 });
    return out;
  }, []);

  return (
    <group position={[MANSION.x, 0, MANSION.z]} rotation={[0, MANSION.rotationY, 0]}>
      <Podium />
      <Balcony />

      {/* The crepidoma: three steps up to the house, out past the portico so
          the front flight is the way in, and wide enough that the wings stand
          on the same platform. */}
      {[0, 1, 2].map((i) => {
        const inset = (2 - i) * 0.95;
        const front = PORTICO_FRONT + 2.2 + inset;
        const back = PORCH_BACK - 1.4 - inset;
        return (
          <mesh
            key={i}
            material={crepidoma}
            position={[0, DECK + STEP * (i + 0.5), (front + back) / 2]}
          >
            <boxGeometry args={[(WING_OUT + 1.2 + inset) * 2, STEP, front - back]} />
          </mesh>
        );
      })}

      <CentreBlock />
      <Wing side={-1} />
      <Wing side={1} />
      <Roof />
      <Colonnade columns={columns} />

      {/* The porch's flat roof, over its four columns. */}
      <mesh material={flatMat(PALETTE.marbleStep)} position={[0, WING_TOP + 0.6, (CENTRE_BACK + PORCH_BACK) / 2]}>
        <boxGeometry args={[(PORTICO_X + 0.9) * 2, 0.7, CENTRE_BACK - PORCH_BACK + 1]} />
      </mesh>
    </group>
  );
}
