import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import { MANSION } from "./layout";

/**
 * A marble house on the summit of the range's right-hand peak.
 *
 * Greek Revival rather than a Greek temple proper: a long block along the crest
 * with a giant portico thrown across the middle of its front, pediments on the
 * portico and on both gable ends, and a colonnade repeated on the back so that
 * every face of it is symmetrical about its own middle. A temple is one room
 * with columns round it; this is a house wearing a temple's clothes, which is
 * what the type actually is.
 *
 * All of it is built in the mansion's own frame — local +z is the front, facing
 * the arena, local +x is the right-hand end as the range is first seen — and the
 * group at the bottom of this file puts that frame on the mountain. Heights are
 * absolute, because the group sits at y = 0: `DECK` is a height above sea level
 * and so is everything measured off it.
 *
 * Nothing here is interactive. It is the largest single object in the world and
 * it is scenery, which is the point — the range had four balloons and no reason
 * for anyone to have put them there.
 */

/* -------------------------------------------------------------------------
   The dimensions
   ---------------------------------------------------------------------- */

/** Top of the podium, and the ground for everything above it. */
const DECK = MANSION.deck;

/** The podium's plan. Longer than the house it carries, and offset toward the front to take the portico. */
const PODIUM_X = 21;
const PODIUM_FRONT = 16;
const PODIUM_BACK = -14;

/**
 * The service court, off the western end and a few steps down: the tramway's
 * hall stands on it. Set here rather than on the terrace because the crepidoma
 * takes very nearly the whole of the terrace — see `MANSION.court`.
 */
const COURT = MANSION.court;
const COURT_IN = -PODIUM_X;
const COURT_OUT = -33;
const COURT_BACK = -16;
const COURT_FRONT = -4;
/**
 * How far down the podium's mass goes.
 *
 * Below the lowest ground anywhere under it — the crest falls away east and
 * north, and the north-east corner stands some thirty over its own ground — so
 * that the terrace is a solid block of stone wherever it meets the mountain and
 * never a slab with daylight under one corner. Where the ground is higher it is
 * simply buried, which is most of the west half.
 */
const PODIUM_BASE = 80;

/** Three steps from the deck up to the house. */
const STEP = 0.62;
const STYLOBATE = DECK + STEP * 3;

/** The house: the main block, then what is thrown in front of and behind it. */
const BLOCK_X = 15;
const BLOCK_FRONT = 4;
const BLOCK_BACK = -6;
const WALL_TOP = STYLOBATE + 13;

/** The portico, and the loggia answering it at the back. */
const PORTICO_X = 11;
const PORTICO_FRONT = 10.5;
const LOGGIA_BACK = -9;

/** Architrave, frieze and cornice, as one run round the whole house. */
const ARCH = 1.15;
const FRIEZE = 1.5;
const CORNICE = 0.95;
const ENTAB_TOP = WALL_TOP + ARCH + FRIEZE + CORNICE;

/** Rise of a pediment, and of the roof behind it — the same, so they meet. */
const PEDIMENT_RISE = 4.6;

/** The balcony hung off the right-hand end, out over the drop. */
const BALCONY_IN = PODIUM_X;
const BALCONY_OUT = PODIUM_X + 11;
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

  // The two triangular faces.
  tri([-hx, 0, hz], [hx, 0, hz], [0, rise, hz]);
  tri([hx, 0, -hz], [-hx, 0, -hz], [0, rise, -hz]);
  // The underside.
  tri([-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz]);
  tri([-hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz]);
  // The two rakes.
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
 * The profile of a column, at unit height and unit base radius: plinth, a shaft
 * with entasis, the neck, and an echinus flaring into the capital.
 *
 * Lathed at sixteen segments and flat-shaded, which at any distance anyone will
 * ever see this from reads as fluting — the facets of the revolve do the work
 * that twenty cut grooves would, for a geometry the whole colonnade can share.
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
  /** Where the column stands, and its full height including the abacus. */
  base: number;
  height: number;
  radius: number;
}

/**
 * Every column in the house, in two draws.
 *
 * There are fifty-odd of them and they differ only in where they stand and how
 * big they are, which is exactly the case instancing is for — the alternative
 * is a hundred draw calls for one building in a world that already spends three
 * on twenty thousand trees. The shafts are one instanced lathe scaled per
 * column; the abaci are one instanced box, because a square slab is the one
 * part of a column a revolve cannot make.
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
      <instancedMesh
        ref={shafts}
        args={[shaftGeometry, flatMat(PALETTE.marble), columns.length]}
      />
      <instancedMesh ref={abaci} args={[undefined, flatMat(PALETTE.marbleShade), columns.length]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  );
}

/** A row of columns along x or z, ends included. */
function row(
  count: number,
  from: number,
  to: number,
  fixed: number,
  axis: "x" | "z",
  base: number,
  height: number,
  radius: number
): Column[] {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const along = from + (to - from) * t;
    return {
      x: axis === "x" ? along : fixed,
      z: axis === "x" ? fixed : along,
      base,
      height,
      radius,
    };
  });
}

/* -------------------------------------------------------------------------
   The house
   ---------------------------------------------------------------------- */

/**
 * The terrace the house stands on: a battered wall stepping outward as it goes
 * down, a moulded cap, and buttresses on the two faces that stand clear of the
 * mountain.
 *
 * Its courses widen with depth rather than staying plumb. A vertical wall this
 * tall reads as a screen stood on the hill; a battered one reads as something
 * holding the hill up, which is what it is.
 */
function Podium() {
  const stone = flatMat(PALETTE.marbleDeep);
  const cap = flatMat(PALETTE.marbleShade);
  const width = PODIUM_X * 2;
  const depth = PODIUM_FRONT - PODIUM_BACK;
  const midZ = (PODIUM_FRONT + PODIUM_BACK) / 2;

  /** Each course: how far it stands proud of the deck's plan, and its top and bottom. */
  const courses: [number, number, number][] = [
    [0.4, DECK - 1.4, 117],
    [1.9, 117, 100],
    [3.6, 100, PODIUM_BASE],
  ];

  return (
    <group>
      {/* The cap, oversailing the wall below it — the one moulding that says
          where the terrace ends and the house begins. */}
      <mesh material={cap} position={[0, DECK - 0.7, midZ]}>
        <boxGeometry args={[width + 2.2, 1.4, depth + 2.2]} />
      </mesh>

      {courses.map(([out, top, bottom], i) => (
        <mesh key={i} material={stone} position={[0, (top + bottom) / 2, midZ]}>
          <boxGeometry args={[width + out * 2, top - bottom, depth + out * 2]} />
        </mesh>
      ))}

      {/* Buttresses on the front and the right-hand end — the two faces that
          stand out of the mountain. The back and the left are buried in the
          crest, and a buttress on ground that is already holding the wall up is
          a buttress nobody can see. */}
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
    </group>
  );
}

/**
 * The balcony on the right-hand end, and the only part of the house with
 * nothing under it.
 *
 * East of the summit the ground falls better than two units in every one, so
 * this hangs some sixty over the mountainside — which is what makes it a
 * balcony rather than another terrace. It is carried on stepped corbels off the
 * podium's own wall, the way a real one that size would be, and roofed with a
 * small open pavilion so it reads as somewhere to stand rather than as a shelf.
 *
 * Open on the north side, which is where the far balloons fly: the pavilion's
 * columns are set back and the parapet is low enough to see over, so the whole
 * point of standing on it is in view.
 */
function Balcony() {
  const stone = flatMat(PALETTE.marbleDeep);
  const deck = flatMat(PALETTE.marbleShade);
  const rail = flatMat(PALETTE.marble);
  const midX = (BALCONY_IN + BALCONY_OUT) / 2;
  const midZ = (BALCONY_BACK + BALCONY_FRONT) / 2;
  const width = BALCONY_OUT - BALCONY_IN;
  const depth = BALCONY_FRONT - BALCONY_BACK;

  const pediment = useMemo(() => prismGeometry(width + 0.9, PAVILION_RISE, 0.5), [width]);
  useEffect(() => () => pediment.dispose(), [pediment]);

  /** Parapet runs: the two ends and the outer edge, with the north side left low. */
  const parapets: [number, number, number, number][] = [
    [midX, BALCONY_FRONT - 0.4, width, 0.8],
    [BALCONY_OUT - 0.4, midZ, 0.8, depth],
  ];

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

      {parapets.map(([x, z, w, d], i) => (
        <group key={i}>
          <mesh material={rail} position={[x, DECK + 0.7, z]}>
            <boxGeometry args={[w, 1.4, d]} />
          </mesh>
          <mesh material={deck} position={[x, DECK + 1.5, z]}>
            <boxGeometry args={[w + 0.4, 0.24, d + 0.4]} />
          </mesh>
        </group>
      ))}
      {/* The north side: a low kerb only, so the balloons are in view from the
          floor of it rather than over a wall. */}
      <mesh material={rail} position={[midX, DECK + 0.35, BALCONY_BACK + 0.35]}>
        <boxGeometry args={[width, 0.7, 0.7]} />
      </mesh>

      {/* The pavilion's entablature, and a roof gabled the short way so that the
          triangle it makes faces north — the same front the house shows the
          arena, turned to show it to the balloons instead. Its columns are in
          the house's one colonnade, with the portico's; see `Mansion` below. */}
      <mesh material={flatMat(PALETTE.marble)} position={[midX, DECK + 8.7, midZ]}>
        <boxGeometry args={[width - 1.4, 0.9, depth - 1.4]} />
      </mesh>
      <mesh material={flatMat(PALETTE.marbleStep)} position={[midX, DECK + 9.4, midZ]}>
        <boxGeometry args={[width + 0.9, 0.55, depth + 0.9]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={flatMat(PALETTE.roofLead)}
          position={[midX + (s * (width + 0.9)) / 4, DECK + 10.8, midZ]}
          rotation={[0, 0, s * PAVILION_PITCH]}
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

/** The main block's walls, with the pilasters and openings that break them up. */
function Walls() {
  const wall = flatMat(PALETTE.marble);
  const shade = flatMat(PALETTE.marbleShade);
  const glass = flatMat(PALETTE.windowGlass);
  const depth = BLOCK_FRONT - BLOCK_BACK;
  const midZ = (BLOCK_FRONT + BLOCK_BACK) / 2;

  /** Windows: two storeys of tall openings, on both flanks and both ends. */
  const openings: { x: number; z: number; ry: number }[] = [];
  for (const x of [-11.5, -7, 7, 11.5]) {
    openings.push({ x, z: BLOCK_FRONT, ry: 0 });
    openings.push({ x, z: BLOCK_BACK, ry: 0 });
  }
  for (const z of [-3.5, 0.5]) {
    openings.push({ x: -BLOCK_X, z, ry: Math.PI / 2 });
    openings.push({ x: BLOCK_X, z, ry: Math.PI / 2 });
  }

  return (
    <group>
      <mesh material={wall} position={[0, (STYLOBATE + WALL_TOP) / 2, midZ]}>
        <boxGeometry args={[BLOCK_X * 2, WALL_TOP - STYLOBATE, depth]} />
      </mesh>

      {/* A string course at first-floor level, right round the block. */}
      <mesh material={shade} position={[0, STYLOBATE + 7.2, midZ]}>
        <boxGeometry args={[BLOCK_X * 2 + 0.5, 0.4, depth + 0.5]} />
      </mesh>

      {/* Pilasters, answering the columns of the portico on the faces that have
          none of their own. */}
      {[-13.2, -9.2, 9.2, 13.2].map((x) =>
        [BLOCK_FRONT, BLOCK_BACK].map((z) => (
          <mesh key={`${x}:${z}`} material={wall} position={[x, (STYLOBATE + WALL_TOP) / 2, z]}>
            <boxGeometry args={[1.5, WALL_TOP - STYLOBATE, 0.7]} />
          </mesh>
        ))
      )}

      {openings.map((o, i) => (
        <group key={i} position={[o.x, 0, o.z]} rotation={[0, o.ry, 0]}>
          {[STYLOBATE + 4.2, STYLOBATE + 10].map((y, j) => (
            <mesh key={j} material={glass} position={[0, y, 0.3]}>
              <boxGeometry args={[1.9, j === 0 ? 5.2 : 3.6, 0.26]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* The doorway, under the portico: a bronze pair in a marble surround. */}
      <mesh material={shade} position={[0, STYLOBATE + 4.6, BLOCK_FRONT + 0.25]}>
        <boxGeometry args={[6.4, 9.2, 0.5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.bronze)} position={[0, STYLOBATE + 4.2, BLOCK_FRONT + 0.55]}>
        <boxGeometry args={[5, 8.4, 0.3]} />
      </mesh>
      <mesh material={flatMat(PALETTE.bronzeDark)} position={[0, STYLOBATE + 4.2, BLOCK_FRONT + 0.72]}>
        <boxGeometry args={[0.22, 8.4, 0.12]} />
      </mesh>
    </group>
  );
}

/** Architrave, frieze and cornice, run round the block and out over the portico. */
function Entablature() {
  const arch = flatMat(PALETTE.marbleShade);
  const frieze = flatMat(PALETTE.marble);
  const cornice = flatMat(PALETTE.marbleStep);

  /** [halfWidth, front, back] of each run. */
  const runs: [number, number, number][] = [
    [BLOCK_X + 0.6, BLOCK_FRONT + 0.6, BLOCK_BACK - 0.6],
    [PORTICO_X + 0.9, PORTICO_FRONT + 0.9, BLOCK_FRONT],
    [PORTICO_X - 3, BLOCK_BACK, LOGGIA_BACK - 0.9],
  ];

  return (
    <group>
      {runs.map(([hx, front, back], i) => {
        const mz = (front + back) / 2;
        const d = front - back;
        return (
          <group key={i}>
            <mesh material={arch} position={[0, WALL_TOP + ARCH / 2, mz]}>
              <boxGeometry args={[hx * 2, ARCH, d]} />
            </mesh>
            <mesh material={frieze} position={[0, WALL_TOP + ARCH + FRIEZE / 2, mz]}>
              <boxGeometry args={[hx * 2 - 0.3, FRIEZE, d - 0.3]} />
            </mesh>
            <mesh material={cornice} position={[0, ENTAB_TOP - CORNICE / 2, mz]}>
              <boxGeometry args={[hx * 2 + 1.1, CORNICE, d + 1.1]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * The roof, and the three pediments.
 *
 * The roof is a plain gable running the length of the block, which is what puts
 * a triangle on each end of the house without anything being added: a gable end
 * *is* a pediment, and dressing the two of them with the same raking cornice the
 * portico carries is what ties all three together. The portico's own pediment
 * rises to the same line as the ridge, so the front reads as one silhouette
 * rather than as a temple front leaning on a shed.
 */
function Roof() {
  const slope = flatMat(PALETTE.roofLead);
  const stone = flatMat(PALETTE.marble);
  const shade = flatMat(PALETTE.marbleShade);

  const halfDepth = (BLOCK_FRONT - BLOCK_BACK) / 2 + 0.6;
  const midZ = (BLOCK_FRONT + BLOCK_BACK) / 2;
  const run = Math.hypot(halfDepth, PEDIMENT_RISE);
  const pitch = Math.atan2(PEDIMENT_RISE, halfDepth);

  const gable = useMemo(
    () => prismGeometry(halfDepth * 2, PEDIMENT_RISE, 0.9),
    [halfDepth]
  );
  const portico = useMemo(
    () => prismGeometry((PORTICO_X + 0.9) * 2, PEDIMENT_RISE, 1.6),
    []
  );
  useEffect(
    () => () => {
      gable.dispose();
      portico.dispose();
    },
    [gable, portico]
  );

  return (
    <group>
      {/* The two slopes. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={slope}
          position={[0, ENTAB_TOP + PEDIMENT_RISE / 2, midZ + (s * halfDepth) / 2]}
          rotation={[-s * pitch, 0, 0]}
        >
          <boxGeometry args={[BLOCK_X * 2 + 1.6, 0.5, run]} />
        </mesh>
      ))}
      <mesh material={shade} position={[0, ENTAB_TOP + PEDIMENT_RISE + 0.2, midZ]}>
        <boxGeometry args={[BLOCK_X * 2 + 1.8, 0.5, 1]} />
      </mesh>

      {/* The gable ends, which are the end pediments. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={gable}
          material={stone}
          position={[s * (BLOCK_X + 0.45), ENTAB_TOP, midZ]}
          rotation={[0, Math.PI / 2, 0]}
        />
      ))}

      {/* And the one over the portico. */}
      <mesh
        geometry={portico}
        material={stone}
        position={[0, ENTAB_TOP, PORTICO_FRONT + 0.5]}
      />

      {/* Acroteria: a block at each apex and at the outer corners of the front
          pediment. Small, and the only ornament on the whole building — from
          the arena they are what breaks the roofline out of a clean triangle. */}
      {[
        [0, ENTAB_TOP + PEDIMENT_RISE + 0.4, PORTICO_FRONT + 0.5],
        [-(PORTICO_X + 0.9), ENTAB_TOP + 0.4, PORTICO_FRONT + 0.5],
        [PORTICO_X + 0.9, ENTAB_TOP + 0.4, PORTICO_FRONT + 0.5],
      ].map(([x, y, z], i) => (
        <mesh key={i} material={flatMat(PALETTE.bronze)} position={[x, y + 0.7, z]}>
          <boxGeometry args={[1.1, 1.5, 1.1]} />
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
   * Every column in one list: the portico's six with their two returns, the
   * loggia's four at the back, and the eight of the balcony's pavilion.
   */
  const columns = useMemo<Column[]>(() => {
    const height = WALL_TOP - STYLOBATE;
    const out: Column[] = [
      ...row(6, -PORTICO_X, PORTICO_X, PORTICO_FRONT, "x", STYLOBATE, height, 1.02),
      ...row(2, -PORTICO_X, PORTICO_X, PORTICO_FRONT - 5.5, "x", STYLOBATE, height, 1.02),
      ...row(4, -PORTICO_X + 3, PORTICO_X - 3, LOGGIA_BACK, "x", STYLOBATE, height, 0.94),
    ];
    // The pavilion on the balcony: shorter and slighter, so it reads as an
    // outbuilding of the house rather than a second house.
    const px = [BALCONY_IN + 2.2, (BALCONY_IN + BALCONY_OUT) / 2, BALCONY_OUT - 2.2];
    const pz = [BALCONY_BACK + 2, BALCONY_FRONT - 2];
    for (const x of px)
      for (const z of pz) out.push({ x, z, base: DECK, height: 8.4, radius: 0.72 });
    return out;
  }, []);

  return (
    <group position={[MANSION.x, 0, MANSION.z]} rotation={[0, MANSION.rotationY, 0]}>
      <Podium />
      <Balcony />

      {/* The crepidoma: three steps in from the terrace to the house, run round
          all four sides. Kept inside the podium's own plan with a walkable
          margin left over — steps that oversail the terrace they stand on read
          as a model of a temple set down on a slab. */}
      {[0, 1, 2].map((i) => {
        const inset = (2 - i) * 0.95;
        const front = PORTICO_FRONT + 1.1 + inset;
        const back = LOGGIA_BACK - 1.1 - inset;
        return (
          <mesh
            key={i}
            material={crepidoma}
            position={[0, DECK + STEP * (i + 0.5), (front + back) / 2]}
          >
            <boxGeometry args={[(BLOCK_X + 1.5 + inset) * 2, STEP, front - back]} />
          </mesh>
        );
      })}

      <Walls />
      <Entablature />
      <Roof />
      <Colonnade columns={columns} />
    </group>
  );
}
