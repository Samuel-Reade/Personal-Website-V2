import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flatMaterial, PALETTE } from "./materials";
import {
  BALCONY_THICKNESS,
  HALL_MIN_Z,
  LANDING_Y,
  OUTSIDE_FRONT_Z,
  OUTSIDE_HALF_WIDTH,
} from "./layout";

/**
 * Everything past the back wall: the balcony itself, the cliff it stands on, the
 * sea below and the sky behind.
 *
 * This is the first exterior the hall has ever had. Every window in the room is
 * a flat panel drawn on the masonry — `Windows.tsx` says so plainly, that
 * nothing outside is ever seen — so until the doorway was cut there was
 * genuinely nothing out there. What is modelled here is only what the doorway
 * can frame: a cone of view roughly straight out from the back of the house.
 * There is no coastline to the sides and none behind, because none of it can be
 * reached or seen.
 */

/** Sea level, far enough below the balcony that the drop reads as a cliff. */
const SEA_Y = -46;
/**
 * How far out the water runs before the sky takes over.
 *
 * Kept inside the hall camera's 160-unit far plane rather than out at a true
 * horizon distance. Past it the backdrop is simply clipped away and the doorway
 * frames black — and widening the frustum instead would stretch the depth
 * buffer across the whole room to buy sea nobody can tell is further off. From
 * the balcony this sits about 125 out, which is comfortably inside.
 */
const HORIZON_Z = -150;
/**
 * Half-width of the backdrop. At the horizon's distance a 52° lens sees about 63
 * units to either side, so this is already twice what can be framed.
 */
const SKY_HALF_WIDTH = 120;

const CLIFF_COLOR = "#6b6259";
const CLIFF_SHADOW = "#544c45";

/**
 * The balcony slab and its balustrade, cantilevered off the back of the house.
 *
 * Railed on three sides and open on the fourth, which is the doorway — the one
 * edge you are meant to cross.
 */
function Terrace() {
  const slabMaterial = useMemo(() => flatMaterial(PALETTE.balcony), []);
  const balusterMaterial = useMemo(() => flatMaterial(PALETTE.baluster), []);
  const railMaterial = useMemo(() => flatMaterial(PALETTE.handrail), []);

  const depth = HALL_MIN_Z - OUTSIDE_FRONT_Z;
  const centerZ = (HALL_MIN_Z + OUTSIDE_FRONT_Z) / 2;
  const width = OUTSIDE_HALF_WIDTH * 2;

  /** Post positions along the front edge, and down each side. */
  const frontPosts = useMemo(() => {
    const count = Math.round(width / 0.9);
    return Array.from(
      { length: count + 1 },
      (_, i) => -OUTSIDE_HALF_WIDTH + (width * i) / count
    );
  }, [width]);
  const sidePosts = useMemo(() => {
    const count = Math.round(depth / 0.9);
    return Array.from(
      { length: count },
      (_, i) => OUTSIDE_FRONT_Z + (depth * (i + 0.5)) / count
    );
  }, [depth]);

  return (
    <group>
      <mesh
        material={slabMaterial}
        position={[0, LANDING_Y - BALCONY_THICKNESS / 2, centerZ]}
        receiveShadow
      >
        <boxGeometry args={[width, BALCONY_THICKNESS, depth]} />
      </mesh>

      {/* Corbels, carrying the slab back into the cliff face. */}
      {[-0.62, 0, 0.62].map((t) => (
        <mesh
          key={t}
          material={slabMaterial}
          position={[t * OUTSIDE_HALF_WIDTH, LANDING_Y - 0.95, OUTSIDE_FRONT_Z + 0.4]}
        >
          <boxGeometry args={[0.55, 1.1, 0.55]} />
        </mesh>
      ))}

      {frontPosts.map((x) => (
        <mesh
          key={`f${x}`}
          material={balusterMaterial}
          position={[x, LANDING_Y + 0.5, OUTSIDE_FRONT_Z + 0.18]}
        >
          <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
        </mesh>
      ))}
      <mesh
        material={railMaterial}
        position={[0, LANDING_Y + 1.05, OUTSIDE_FRONT_Z + 0.18]}
      >
        <boxGeometry args={[width, 0.14, 0.2]} />
      </mesh>

      {([1, -1] as const).map((side) => (
        <group key={side}>
          {sidePosts.map((z) => (
            <mesh
              key={`s${side}${z}`}
              material={balusterMaterial}
              position={[side * (OUTSIDE_HALF_WIDTH - 0.18), LANDING_Y + 0.5, z]}
            >
              <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
            </mesh>
          ))}
          <mesh
            material={railMaterial}
            position={[side * (OUTSIDE_HALF_WIDTH - 0.18), LANDING_Y + 1.05, centerZ]}
          >
            <boxGeometry args={[0.2, 0.14, depth]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The headland the house stands on, dropping to the water.
 *
 * Built from a handful of tilted blocks rather than a heightfield: it is seen
 * from one fixed side, from above, and never walked on, so what it has to do is
 * read as broken rock in silhouette. Two values only — a lit face and a shadowed
 * one — which is the same trick the mountains in the associations world use to
 * suggest bulk without any real relief.
 */
function Cliff({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  /**
   * Unlit, like the sea and the sky and for exactly the same reason.
   *
   * These were Lambert, which meant the headland was lit by whatever reached it
   * — and every light in this world is inside the hall. A chandelier and six
   * candles do not illuminate a cliff sixty units out through a metre of
   * masonry, so it rendered pure black under the balcony rail. The outside is
   * lit by the sky, and the honest way to say that here is to take the shading
   * off and let the clock's tint be the light.
   */
  const rockMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: CLIFF_COLOR }), []);
  const shadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: CLIFF_SHADOW }), []);
  const rockBase = useMemo(() => new THREE.Color(CLIFF_COLOR), []);
  const shadowBase = useMemo(() => new THREE.Color(CLIFF_SHADOW), []);
  const lastTint = useRef(new THREE.Color());

  useFrame(() => {
    if (lastTint.current.equals(tintRef.current)) return;
    lastTint.current.copy(tintRef.current);
    // Scaled up harder than the sea is: rock is the darkest thing out there and
    // at night the tint alone takes it to almost nothing.
    rockMaterial.color.copy(rockBase).multiply(tintRef.current).multiplyScalar(2.4);
    shadowMaterial.color.copy(shadowBase).multiply(tintRef.current).multiplyScalar(2.2);
  });

  /**
   * Crown height, held well under the balcony slab it carries.
   *
   * The 2.2 of headroom is for the tilts below: a nine-wide block leaned an
   * eighth of a radian lifts its high corner most of a unit, and without the
   * clearance that corner comes up through the deck you are standing on.
   */
  const drop = LANDING_Y - SEA_Y - 2.2;

  /**
   * [x, z, width, depth, tilt, dark] — the faces of the headland.
   *
   * Every one of these has to finish behind the back wall, which stands at
   * z = -22. They did not: two of them were pitched at OUTSIDE_FRONT_Z + 4 and
   * nine deep, which put their near faces at -19, a good two units *inside* the
   * hall. From the floor that read as a pair of black masses either side of the
   * portal, and no amount of light was ever going to fix it, because the fault
   * was rock standing in the room. Each one now ends at -23.5 or further out.
   *
   * The yaw is small for the same reason. A sixteen-wide block turned four
   * tenths of a radian swings its corner nearly six units along z, which is
   * enough to walk a block back through the wall however carefully its centre
   * was placed.
   */
  const blocks: [number, number, number, number, number, boolean][] = [
    [0, OUTSIDE_FRONT_Z + 1.1, 16, 6, 0.06, false],
    [-9.5, OUTSIDE_FRONT_Z - 0.4, 11, 7, -0.12, true],
    [9.5, OUTSIDE_FRONT_Z - 0.9, 12, 7, 0.14, true],
    [-4, OUTSIDE_FRONT_Z - 5.4, 9, 7, 0.18, false],
    [5, OUTSIDE_FRONT_Z - 6.4, 8, 7, -0.16, true],
  ];

  return (
    <group>
      {blocks.map(([x, z, w, d, tilt, dark], i) => (
        <mesh
          key={i}
          material={dark ? shadowMaterial : rockMaterial}
          position={[x, SEA_Y + drop / 2, z]}
          rotation={[0, i * 0.12, tilt]}
        >
          <boxGeometry args={[w, drop, d]} />
        </mesh>
      ))}

      {/* A few stacks standing out of the water at the foot, so the base of the
          drop isn't a clean line where rock meets sea. */}
      {[
        [-13, OUTSIDE_FRONT_Z - 16, 3.4, 9],
        [11, OUTSIDE_FRONT_Z - 22, 2.6, 13],
        [-4, OUTSIDE_FRONT_Z - 30, 2.0, 7],
      ].map(([x, z, r, h], i) => (
        <mesh
          key={`stack${i}`}
          material={i % 2 ? shadowMaterial : rockMaterial}
          position={[x, SEA_Y + h / 2, z]}
          rotation={[0, i * 0.7, 0]}
        >
          <cylinderGeometry args={[r * 0.7, r, h, 5]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Sea and sky, both unlit and both tinted by the clock.
 *
 * Unlit for the same reason the window glass is: these are the light out there
 * rather than surfaces catching the light in here, and shading them would have
 * the candle rig in the hall deciding how bright the horizon is. Taking the tint
 * from the same ref the windows read means the view through the doorway and the
 * daylight through the glass can never disagree about the time of day.
 */
function SeaAndSky({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  const seaMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#2d4f6b" }),
    []
  );
  const skyMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#8fa9c4", side: THREE.DoubleSide }),
    []
  );
  const lastTint = useRef(new THREE.Color());
  const seaBase = useMemo(() => new THREE.Color("#2d4f6b"), []);
  const skyBase = useMemo(() => new THREE.Color("#8fa9c4"), []);

  useFrame(() => {
    if (lastTint.current.equals(tintRef.current)) return;
    lastTint.current.copy(tintRef.current);
    // Multiplied rather than replaced: the sea keeps its own deep blue and the
    // sky its pale one, and the clock only pushes both warm at dusk or blue at
    // night. Replacing outright would turn the sea orange at sunset.
    skyMaterial.color.copy(skyBase).multiply(tintRef.current).multiplyScalar(1.6);
    seaMaterial.color.copy(seaBase).multiply(tintRef.current).multiplyScalar(2.6);
  });

  return (
    <group>
      <mesh material={seaMaterial} position={[0, SEA_Y, (OUTSIDE_FRONT_Z + HORIZON_Z) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SKY_HALF_WIDTH * 2, OUTSIDE_FRONT_Z - HORIZON_Z]} />
      </mesh>

      {/* A flat backdrop rather than a dome. The doorway frames a narrow cone of
          this and nothing else can see it, so a hemisphere would be geometry
          spent on a view that does not exist. */}
      <mesh material={skyMaterial} position={[0, 40, HORIZON_Z]}>
        <planeGeometry args={[SKY_HALF_WIDTH * 2, 180]} />
      </mesh>
    </group>
  );
}

/** The balcony, the headland under it, and the sea and sky beyond. */
export function Outside({ tintRef }: { tintRef: React.MutableRefObject<THREE.Color> }) {
  return (
    <group>
      <Terrace />
      <Cliff tintRef={tintRef} />
      <SeaAndSky tintRef={tintRef} />
    </group>
  );
}
