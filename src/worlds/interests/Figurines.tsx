import { useRef, useState, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { flatMat } from "./materials";
import {
  OBJECTS,
  TIER_Y,
  haloRadius,
  hoverExpansion,
  objectHalfWidth,
  objectHeight,
  type InterestId,
  type ObjectSpot,
} from "./layout";

/**
 * The ten objects, one per interest. Each is a handful of primitives
 * with deliberately low segment counts — cylinders at 6-8 sides, cones at 5 — so
 * the facets stay visible at the distance the fixed camera sits from them.
 *
 * Everything is modelled standing on y = 0 and placed onto its tier by the
 * layout, so each piece can be reasoned about on its own.
 */

/**
 * A soft radial falloff for the hover halo. A hard-edged disc reads as a decal
 * stuck to the board; this reads as light pooling under the object.
 */
let haloTexture: THREE.CanvasTexture | null = null;
function getHaloTexture(): THREE.CanvasTexture {
  if (haloTexture) return haloTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.28)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  haloTexture = new THREE.CanvasTexture(canvas);
  return haloTexture;
}

interface HighlightProps {
  spot: ObjectSpot;
  onHover: (label: string | null) => void;
  children: ReactNode;
}

/**
 * Hover feedback only — these objects are not clickable. The shelf is something
 * to look at rather than a menu, so pointing at a piece lights it and names it
 * and that is the whole interaction. Nothing here opens a panel, and the cursor
 * deliberately stays as the grab hand the look controls use, so nothing
 * advertises a click that would do nothing.
 *
 * The enlargement is applied to an inner group so the halo pooled on the board
 * stays put rather than growing with the object.
 *
 * How much it enlarges is not a constant here but a question for the layout,
 * which knows how much air the piece has over it — see `hoverExpansion`. The
 * four tallest pieces used to drive their tops straight through the board above
 * on hover, which is a piece answering the pointer by hiding part of itself.
 */
function Highlight({ spot, onHover, children }: HighlightProps) {
  const [hovered, setHovered] = useState(false);
  const inner = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Mesh>(null!);
  const glow = useRef<THREE.Sprite>(null!);
  const amount = useRef(0);

  const height = objectHeight(spot);
  const halfWidth = objectHalfWidth(spot);
  const { grow, lift } = hoverExpansion(spot);

  useFrame((_state, delta) => {
    const t = 1 - Math.exp(-14 * delta);
    amount.current = THREE.MathUtils.lerp(amount.current, hovered ? 1 : 0, t);
    const a = amount.current;

    if (inner.current) {
      inner.current.scale.setScalar(spot.scale * (1 + a * grow));
      // Lifts fractionally off the board as it grows, so the grow reads as the
      // object rising to meet the cursor rather than inflating in place.
      inner.current.position.y = a * height * lift;
    }
    if (halo.current) {
      (halo.current.material as THREE.MeshBasicMaterial).opacity = a * 0.72;
    }
    if (glow.current) {
      (glow.current.material as THREE.SpriteMaterial).opacity = a * 0.5;
    }
  });

  return (
    <group
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        onHover(spot.label);
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(false);
        onHover(null);
      }}
    >
      {/* Light pooling on the board beneath. */}
      <mesh ref={halo} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[haloRadius(spot), 20]} />
        <meshBasicMaterial
          map={getHaloTexture()}
          color={PALETTE.hoverHalo}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* And a soft bloom around the piece itself. Additive and unlit, so it
          reads as the object catching light rather than being repainted — the
          alternative, driving emissive on its materials, would need a unique
          material per mesh since flatMat() hands out shared instances. */}
      <sprite
        ref={glow}
        position={[0, height * 0.5, 0]}
        scale={[halfWidth * 4.4, Math.max(height, halfWidth) * 3.4, 1]}
      >
        <spriteMaterial
          map={getHaloTexture()}
          color={PALETTE.hoverHalo}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <group ref={inner} scale={spot.scale}>
        {children}
      </group>
    </group>
  );
}

/**
 * Travel — a globe in a full meridian ring on a turned stand.
 *
 * The sphere is an icosahedron at one subdivision, which is what gives it the
 * faceted look the rest of the room has; the continents are flattened patches
 * pressed onto it rather than painted on, since nothing in this world carries a
 * texture. Caps at both poles and an equator band, because a bare blue ball
 * with three green blobs reads as a marble.
 */
function Globe() {
  const TILT = 0.41;
  const R = 0.095;
  /** Continents, as [x, y, z on the sphere, spread, squash]. */
  const LAND: [number, number, number, number, number][] = [
    [0.05, 0.03, 0.075, 1.15, 0.8],
    [-0.062, -0.018, 0.06, 0.85, 0.75],
    [0.012, 0.072, 0.05, 0.7, 0.6],
    [-0.045, 0.05, -0.062, 0.75, 0.65],
    [0.07, -0.045, -0.04, 0.9, 0.7],
    [-0.02, -0.07, 0.05, 0.6, 0.55],
  ];

  return (
    <group>
      {/* Stand: a moulded foot, a collar, and the stem between them. */}
      <mesh material={flatMat(PALETTE.globeStand)} position={[0, 0.009, 0]}>
        <cylinderGeometry args={[0.082, 0.09, 0.018, 10]} />
      </mesh>
      <mesh material={flatMat(PALETTE.globeMeridian)} position={[0, 0.024, 0]}>
        <cylinderGeometry args={[0.058, 0.076, 0.014, 10]} />
      </mesh>
      <mesh material={flatMat(PALETTE.globeStand)} position={[0, 0.037, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.014, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.globeStand)} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.011, 0.013, 0.088, 6]} />
      </mesh>
      {/* A knop partway up the stem, the way a turned one has. */}
      <mesh material={flatMat(PALETTE.globeMeridian)} position={[0, 0.072, 0]}>
        <cylinderGeometry args={[0.019, 0.019, 0.014, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.globeStand)} position={[0, 0.126, 0]}>
        <cylinderGeometry args={[0.028, 0.016, 0.018, 8]} />
      </mesh>

      <group position={[0, 0.185, 0]} rotation={[0, 0, TILT]}>
        {/* Meridian ring, open at the top so the sphere reads as held in it. */}
        <mesh material={flatMat(PALETTE.globeStand)} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.108, 0.008, 4, 16, Math.PI * 1.45]} />
        </mesh>
        {/* The graduated band up its outer face — the degrees, as one strip. */}
        <mesh material={flatMat(PALETTE.globeMeridian)} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.113, 0.003, 3, 16, Math.PI * 1.45]} />
        </mesh>

        <mesh material={flatMat(PALETTE.globeSea)}>
          <icosahedronGeometry args={[R, 1]} />
        </mesh>

        {/* The axis the sphere turns on, out through both poles. */}
        <mesh material={flatMat(PALETTE.globeStand)}>
          <cylinderGeometry args={[0.005, 0.005, R * 2.24, 5]} />
        </mesh>
        {[1, -1].map((end) => (
          <mesh key={end} material={flatMat(PALETTE.globeMeridian)} position={[0, end * R * 1.09, 0]}>
            <icosahedronGeometry args={[0.011, 0]} />
          </mesh>
        ))}

        {/* Ice at both poles, flattened onto the sphere. */}
        {[1, -1].map((end) => (
          <mesh
            key={end}
            material={flatMat(PALETTE.globeIce)}
            position={[0, end * R * 0.86, 0]}
            scale={[1, 0.42, 1]}
          >
            <icosahedronGeometry args={[0.036, 0]} />
          </mesh>
        ))}

        {/* Equator, as a thin band standing barely proud of the sea. */}
        <mesh material={flatMat(PALETTE.globeMeridian)} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R * 0.995, 0.0022, 3, 18]} />
        </mesh>

        {/* Landmasses as flattened patches rather than painted detail. */}
        {LAND.map(([x, y, z, spread, squash], i) => (
          <mesh
            key={i}
            material={flatMat(PALETTE.globeLand)}
            position={[x, y, z]}
            scale={[spread, spread * squash, 0.35]}
          >
            <icosahedronGeometry args={[0.05, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Skiing — a pair of skis on their tails with poles beside them, leaning back
 * against the shelf.
 *
 * The ski is built as a real one is read from across a room: a topsheet with a
 * stripe up it, steel edges down both sides, a kicked tip and a shorter kicked
 * tail, and a binding that is a toe piece and a heel piece with the rail
 * between them rather than one block in the middle.
 */
function Skis() {
  const LENGTH = 0.48;
  const WIDTH = 0.045;

  return (
    <group rotation={[0.16, 0, 0]}>
      {[-0.035, 0.035].map((x, i) => (
        <group key={i} position={[x, 0, 0]} rotation={[0, 0, i === 0 ? 0.05 : -0.03]}>
          {/* Topsheet, and the stripe up the middle of it. */}
          <mesh material={flatMat(PALETTE.skiTop)} position={[0, 0.24, 0]}>
            <boxGeometry args={[WIDTH, LENGTH, 0.014]} />
          </mesh>
          <mesh material={flatMat(PALETTE.skiStripe)} position={[0, 0.28, 0.0075]}>
            <boxGeometry args={[WIDTH * 0.36, LENGTH * 0.62, 0.002]} />
          </mesh>
          {/* Steel edges down both sides. */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              material={flatMat(PALETTE.skiEdge)}
              position={[side * WIDTH * 0.5, 0.24, 0]}
            >
              <boxGeometry args={[0.0035, LENGTH * 0.96, 0.0145]} />
            </mesh>
          ))}
          {/* Upturned tip: a short section kicked forward at the top. */}
          <mesh material={flatMat(PALETTE.skiTop)} position={[0, 0.5, 0.018]} rotation={[0.6, 0, 0]}>
            <boxGeometry args={[WIDTH, 0.075, 0.014]} />
          </mesh>
          <mesh material={flatMat(PALETTE.skiEdge)} position={[0, 0.522, 0.03]} rotation={[0.6, 0, 0]}>
            <boxGeometry args={[WIDTH * 0.8, 0.012, 0.015]} />
          </mesh>
          {/* And a shallower kick on the tail it is standing on. */}
          <mesh material={flatMat(PALETTE.skiTop)} position={[0, 0.012, 0.007]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[WIDTH, 0.04, 0.014]} />
          </mesh>
          {/* Binding: toe piece, heel piece, and the rail joining them. */}
          <mesh material={flatMat(PALETTE.poleGrip)} position={[0, 0.215, 0.011]}>
            <boxGeometry args={[WIDTH * 0.62, 0.09, 0.006]} />
          </mesh>
          <mesh material={flatMat(PALETTE.skiBase)} position={[0, 0.175, 0.015]}>
            <boxGeometry args={[WIDTH * 1.02, 0.03, 0.016]} />
          </mesh>
          <mesh material={flatMat(PALETTE.skiBase)} position={[0, 0.258, 0.016]}>
            <boxGeometry args={[WIDTH * 0.94, 0.034, 0.018]} />
          </mesh>
          {/* The brake arms, folded down either side of the heel. */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              material={flatMat(PALETTE.poleGrip)}
              position={[side * WIDTH * 0.56, 0.248, 0.012]}
              rotation={[0, 0, side * 0.2]}
            >
              <boxGeometry args={[0.004, 0.05, 0.004]} />
            </mesh>
          ))}
        </group>
      ))}

      {[-0.1, 0.1].map((x, i) => (
        <group key={i} position={[x, 0, -0.02]} rotation={[0, 0, i === 0 ? 0.08 : -0.06]}>
          <mesh material={flatMat(PALETTE.poleShaft)} position={[0, 0.23, 0]}>
            <cylinderGeometry args={[0.007, 0.005, 0.46, 5]} />
          </mesh>
          <mesh material={flatMat(PALETTE.poleGrip)} position={[0, 0.475, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.06, 6]} />
          </mesh>
          {/* Grip ridges, and the wrist strap looped off the top. */}
          {[0.46, 0.487].map((y, r) => (
            <mesh key={r} material={flatMat(PALETTE.poleShaft)} position={[0, y, 0]}>
              <cylinderGeometry args={[0.0135, 0.0135, 0.005, 6]} />
            </mesh>
          ))}
          <mesh
            material={flatMat(PALETTE.poleStrap)}
            position={[i === 0 ? -0.016 : 0.016, 0.498, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.016, 0.0028, 3, 8, Math.PI * 1.2]} />
          </mesh>
          {/* Basket near the tip, on its spokes, and the spike below it. */}
          <mesh material={flatMat(PALETTE.poleGrip)} position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.026, 0.026, 0.006, 7]} />
          </mesh>
          <mesh material={flatMat(PALETTE.poleGrip)} position={[0, 0.068, 0]}>
            <cylinderGeometry args={[0.011, 0.019, 0.014, 7]} />
          </mesh>
          <mesh material={flatMat(PALETTE.skiEdge)} position={[0, 0.008, 0]}>
            <coneGeometry args={[0.005, 0.02, 5]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Ancient History — a fluted column, broken off at the capital, on a stepped
 * base with its own rubble around it.
 *
 * Broken rather than intact on purpose: a whole column at this size reads as a
 * candlestick. The volutes are what say Ionic and not a table leg, and the
 * drum joints are what say it was built in pieces.
 */
function Column() {
  const FLUTES = 12;
  const SHAFT_BOTTOM = 0.057;
  const SHAFT_TOP = 0.317;

  return (
    <group>
      {/* Stylobate: two steps, the lower one wider, both a shade off square. */}
      <mesh material={flatMat(PALETTE.stoneDeep)} position={[0, 0.011, 0]}>
        <boxGeometry args={[0.145, 0.022, 0.145]} />
      </mesh>
      <mesh material={flatMat(PALETTE.stoneShadow)} position={[0, 0.03, 0]} rotation={[0, 0.05, 0]}>
        <boxGeometry args={[0.118, 0.018, 0.118]} />
      </mesh>
      {/* Torus base moulding, then the shaft. */}
      <mesh material={flatMat(PALETTE.stone)} position={[0, 0.048, 0]}>
        <cylinderGeometry args={[0.052, 0.058, 0.018, 10]} />
      </mesh>
      <mesh material={flatMat(PALETTE.stone)} position={[0, 0.187, 0]}>
        <cylinderGeometry args={[0.043, 0.05, 0.26, 10]} />
      </mesh>

      {/* Fluting: shallow ribs standing off the shaft, tapering with it. */}
      {Array.from({ length: FLUTES }, (_, i) => {
        const angle = (i / FLUTES) * Math.PI * 2;
        return (
          <mesh
            key={i}
            material={flatMat(PALETTE.stoneShadow)}
            position={[Math.cos(angle) * 0.045, 0.187, Math.sin(angle) * 0.045]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.006, 0.25, 0.011]} />
          </mesh>
        );
      })}

      {/* Drum joints — the shaft was quarried in sections, and the seams show. */}
      {[0.115, 0.235].map((y, i) => (
        <mesh key={i} material={flatMat(PALETTE.stoneDeep)} position={[0, y, 0]}>
          <cylinderGeometry args={[0.0475, 0.0475, 0.004, 10]} />
        </mesh>
      ))}
      {/* A crack running up out of the lower joint. */}
      <mesh
        material={flatMat(PALETTE.stoneDeep)}
        position={[0.03, 0.155, 0.033]}
        rotation={[0.06, -0.8, 0.13]}
      >
        <boxGeometry args={[0.004, 0.07, 0.006]} />
      </mesh>

      {/* Astragal under the capital, then the echinus and the abacus over it. */}
      <mesh material={flatMat(PALETTE.stone)} position={[0, SHAFT_TOP + 0.006, 0]}>
        <cylinderGeometry args={[0.046, 0.044, 0.012, 10]} />
      </mesh>
      <mesh material={flatMat(PALETTE.stone)} position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.058, 0.046, 0.026, 10]} />
      </mesh>
      {/* Volutes: the two scrolls that make it Ionic rather than a plain drum. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={flatMat(PALETTE.stoneShadow)}
          position={[side * 0.046, 0.348, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.016, 0.007, 4, 9]} />
        </mesh>
      ))}
      {/* Abacus, sitting askew — it is the piece that took the blow. */}
      <mesh material={flatMat(PALETTE.stone)} position={[0, 0.368, 0]} rotation={[0.03, 0.2, 0.05]}>
        <boxGeometry args={[0.115, 0.018, 0.115]} />
      </mesh>
      <mesh
        material={flatMat(PALETTE.stoneShadow)}
        position={[0.006, 0.379, -0.004]}
        rotation={[0.03, 0.2, 0.05]}
      >
        <boxGeometry args={[0.086, 0.008, 0.086]} />
      </mesh>

      {/* What came off it, on the board. A drum on its side, a wedge, and chips. */}
      <mesh
        material={flatMat(PALETTE.stoneShadow)}
        position={[0.098, 0.024, 0.052]}
        rotation={[0.3, 0.6, 1.5]}
      >
        <cylinderGeometry args={[0.026, 0.029, 0.058, 8]} />
      </mesh>
      <mesh
        material={flatMat(PALETTE.stoneDeep)}
        position={[-0.082, 0.013, 0.062]}
        rotation={[0.2, -0.5, 0.4]}
      >
        <icosahedronGeometry args={[0.022, 0]} />
      </mesh>
      {[
        [0.062, 0.007, -0.06, 0.011],
        [-0.05, 0.006, -0.05, 0.009],
        [0.03, 0.005, 0.082, 0.008],
      ].map(([x, y, z, r], i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.stoneShadow)}
          position={[x, y, z]}
          rotation={[i * 0.7, i * 1.1, i * 0.5]}
        >
          <icosahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One Piece — a straw hat beside a small treasure chest. A generic
 * pirate-adventure motif on purpose: no character, insignia or logo.
 */
function StrawHatAndChest() {
  return (
    <group>
      {/* Hat, resting on its brim and tipped slightly. */}
      <group position={[-0.09, 0, 0.02]} rotation={[0.1, 0.3, -0.06]}>
        {/* Brim in two courses, the outer one turned up, the way a straw one sits. */}
        <mesh material={flatMat(PALETTE.straw)} position={[0, 0.016, 0]}>
          <cylinderGeometry args={[0.104, 0.11, 0.011, 12]} />
        </mesh>
        <mesh material={flatMat(PALETTE.straw)} position={[0, 0.022, 0]}>
          <cylinderGeometry args={[0.126, 0.104, 0.009, 12]} />
        </mesh>
        {/* The weave, as a few concentric courses standing barely proud. Laid
            flat: a torus is built in the XY plane, so without this it stands on
            edge and cuts down through the brim and out under the board. */}
        {[0.06, 0.085].map((r, i) => (
          <mesh
            key={i}
            material={flatMat(PALETTE.strawBand)}
            position={[0, 0.0245, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[r, 0.0022, 3, 14]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.straw)} position={[0, 0.052, 0]}>
          <cylinderGeometry args={[0.058, 0.07, 0.062, 10]} />
        </mesh>
        {/* Band, and the tail of it hanging off the back. */}
        <mesh material={flatMat(PALETTE.strawBand)} position={[0, 0.034, 0]}>
          <cylinderGeometry args={[0.072, 0.072, 0.016, 10]} />
        </mesh>
        <mesh
          material={flatMat(PALETTE.strawBand)}
          position={[-0.06, 0.03, -0.04]}
          rotation={[0.2, 0.6, 0.35]}
        >
          <boxGeometry args={[0.014, 0.034, 0.004]} />
        </mesh>
        {/* Crown, with the crease across the top a felt-blocked one has. */}
        <mesh material={flatMat(PALETTE.straw)} position={[0, 0.082, 0]}>
          <cylinderGeometry args={[0.056, 0.058, 0.006, 10]} />
        </mesh>
        <mesh material={flatMat(PALETTE.strawBand)} position={[0, 0.0845, 0]}>
          <boxGeometry args={[0.09, 0.003, 0.016]} />
        </mesh>
      </group>

      {/* Chest, lid ajar. */}
      <group position={[0.1, 0, -0.01]} rotation={[0, -0.24, 0]}>
        <mesh material={flatMat(PALETTE.chestWood)} position={[0, 0.048, 0]}>
          <boxGeometry args={[0.17, 0.096, 0.115]} />
        </mesh>
        {/* Plank seams down the front, so the box reads as boarded. */}
        {[-0.043, 0.043].map((x, i) => (
          <mesh key={i} material={flatMat(PALETTE.chestGold)} position={[x, 0.048, 0.0585]}>
            <boxGeometry args={[0.004, 0.094, 0.002]} />
          </mesh>
        ))}
        {/* Iron straps, with rivets down each. */}
        {[-0.05, 0.05].map((x, i) => (
          <group key={i}>
            <mesh material={flatMat(PALETTE.chestIron)} position={[x, 0.048, 0]}>
              <boxGeometry args={[0.014, 0.1, 0.119]} />
            </mesh>
            {[0.014, 0.048, 0.082].map((y, r) => (
              <mesh key={r} material={flatMat(PALETTE.chestIron)} position={[x, y, 0.0605]}>
                <cylinderGeometry args={[0.004, 0.004, 0.004, 6]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* Corner brackets. */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`${sx}-${sz}`}
              material={flatMat(PALETTE.chestIron)}
              position={[sx * 0.082, 0.048, sz * 0.054]}
            >
              <boxGeometry args={[0.008, 0.1, 0.01]} />
            </mesh>
          ))
        )}
        {/* Barrel lid, hinged open at the back, with its own iron over the top. */}
        <group position={[0, 0.096, -0.057]} rotation={[-0.75, 0, 0]}>
          <mesh material={flatMat(PALETTE.chestWood)} position={[0, 0, 0.057]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.058, 0.058, 0.17, 8, 1, false, 0, Math.PI]} />
          </mesh>
          {[-0.05, 0.05].map((x, i) => (
            <mesh
              key={i}
              material={flatMat(PALETTE.chestIron)}
              position={[x, 0, 0.057]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.0605, 0.0605, 0.013, 8, 1, true, 0, Math.PI]} />
            </mesh>
          ))}
        </group>
        {/* Hasp plate and the keyhole in it. */}
        <mesh material={flatMat(PALETTE.chestGold)} position={[0, 0.086, 0.06]}>
          <boxGeometry args={[0.03, 0.026, 0.008]} />
        </mesh>
        <mesh material={flatMat(PALETTE.chestWood)} position={[0, 0.084, 0.0645]}>
          <cylinderGeometry args={[0.005, 0.005, 0.003, 6]} />
        </mesh>

        {/* What is inside, showing over the rim: coins on edge and two stones. */}
        {[
          [-0.036, 0.1, 0.012, 0.4],
          [-0.008, 0.104, -0.012, -0.25],
          [0.026, 0.101, 0.016, 0.7],
          [0.052, 0.098, -0.006, 0.1],
        ].map(([x, y, z, turn], i) => (
          <mesh
            key={i}
            material={flatMat(PALETTE.chestGold)}
            position={[x, y, z]}
            rotation={[Math.PI / 2, 0, turn]}
          >
            <cylinderGeometry args={[0.019, 0.019, 0.005, 8]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.chestGem)} position={[0.012, 0.106, 0.026]}>
          <icosahedronGeometry args={[0.015, 0]} />
        </mesh>
        <mesh material={flatMat(PALETTE.chestGemRed)} position={[-0.052, 0.102, -0.02]}>
          <icosahedronGeometry args={[0.012, 0]} />
        </mesh>
      </group>

      {/* Two coins that missed the chest. */}
      {[
        [0.005, 0.058, 0.3],
        [0.03, -0.062, -0.6],
      ].map(([x, z, turn], i) => (
        <mesh
          key={i}
          material={flatMat(PALETTE.chestGold)}
          position={[x, 0.0025, z]}
          rotation={[0, turn, 0]}
        >
          <cylinderGeometry args={[0.017, 0.017, 0.005, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Reading — a stack of books with one lying open across the top, a ribbon out
 * of the middle one, and a pair of glasses folded on the board beside it.
 *
 * Each volume gets a spine with raised bands and a label between them, which is
 * what separates a book from a coloured box at this size.
 */
function BookStack() {
  const stack = [
    { h: 0.032, w: 0.19, d: 0.135, color: PALETTE.bookB, turn: 0 },
    { h: 0.028, w: 0.175, d: 0.125, color: PALETTE.bookA, turn: 0.14 },
    { h: 0.034, w: 0.185, d: 0.13, color: PALETTE.bookC, turn: -0.1 },
  ];
  let y = 0;
  const placed = stack.map((book) => {
    const at = y + book.h / 2;
    y += book.h;
    return { ...book, y: at };
  });

  return (
    <group>
      {placed.map((book, i) => (
        <group key={i} rotation={[0, book.turn, 0]}>
          <mesh material={flatMat(book.color)} position={[0, book.y, 0]}>
            <boxGeometry args={[book.w, book.h, book.d]} />
          </mesh>
          <mesh material={flatMat(PALETTE.bookPages)} position={[0.004, book.y, 0]}>
            <boxGeometry args={[book.w * 0.94, book.h * 0.68, book.d * 1.01]} />
          </mesh>
          {/* Raised bands across the spine, and the label between them. */}
          {[-0.3, 0.3].map((f, b) => (
            <mesh
              key={b}
              material={flatMat(book.color)}
              position={[-book.w / 2 - 0.002, book.y, f * book.d]}
            >
              <boxGeometry args={[0.005, book.h * 0.92, 0.008]} />
            </mesh>
          ))}
          <mesh
            material={flatMat(PALETTE.bookBand)}
            position={[-book.w / 2 - 0.002, book.y, 0]}
          >
            <boxGeometry args={[0.003, book.h * 0.5, 0.03]} />
          </mesh>
          {/* Head and tail caps at the ends of the spine. */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              material={flatMat(PALETTE.bookPages)}
              position={[-book.w / 2 + 0.001, book.y, (side * book.d) / 2]}
            >
              <boxGeometry args={[0.006, book.h * 0.3, 0.004]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* A ribbon marker out of the middle volume, down over the one below. */}
      <group rotation={[0, placed[1].turn, 0]}>
        <mesh material={flatMat(PALETTE.bookRibbon)} position={[0.086, placed[1].y, 0.03]}>
          <boxGeometry args={[0.024, 0.004, 0.008]} />
        </mesh>
        <mesh
          material={flatMat(PALETTE.bookRibbon)}
          position={[0.101, placed[1].y - 0.016, 0.03]}
          rotation={[0, 0, 0.3]}
        >
          <boxGeometry args={[0.004, 0.03, 0.008]} />
        </mesh>
      </group>

      {/* Open book: two leaves tented over the stack, spine along the middle. */}
      <group position={[0, y + 0.012, 0]} rotation={[0, 0.28, 0]}>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh
              material={flatMat(PALETTE.bookPages)}
              position={[side * 0.052, 0.012, 0]}
              rotation={[0, 0, side * 0.17]}
            >
              <boxGeometry args={[0.105, 0.008, 0.13]} />
            </mesh>
            {/* The board of the cover, just under the page block. */}
            <mesh
              material={flatMat(PALETTE.openBook)}
              position={[side * 0.053, 0.0055, 0]}
              rotation={[0, 0, side * 0.17]}
            >
              <boxGeometry args={[0.11, 0.004, 0.136]} />
            </mesh>
            {/* A leaf caught mid-turn on the outer edge. */}
            <mesh
              material={flatMat(PALETTE.bookPages)}
              position={[side * 0.086, 0.021, 0.004]}
              rotation={[0, side * 0.06, side * 0.42]}
            >
              <boxGeometry args={[0.042, 0.0025, 0.118]} />
            </mesh>
          </group>
        ))}
        <mesh material={flatMat(PALETTE.openBook)} position={[0, 0.004, 0]}>
          <boxGeometry args={[0.03, 0.01, 0.132]} />
        </mesh>
      </group>

      {/* Reading glasses, folded, on the board at the foot of the stack. */}
      <group position={[0.088, 0.004, 0.072]} rotation={[0, -0.5, 0]}>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            material={flatMat(PALETTE.reelDark)}
            position={[side * 0.019, 0, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.016, 0.0022, 3, 10]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.reelDark)}>
          <boxGeometry args={[0.01, 0.0035, 0.0035]} />
        </mesh>
        <mesh
          material={flatMat(PALETTE.reelDark)}
          position={[0.028, 0.001, 0.022]}
          rotation={[0, -0.5, 0]}
        >
          <boxGeometry args={[0.055, 0.0035, 0.0035]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Film — a reel standing on edge, leaning, with a loose loop of film spilling
 * off it and a flat can beside it.
 *
 * The tail is drawn as three short sections at slightly different angles rather
 * than one straight strip, so it reads as film that has been unwound rather
 * than as a plank; the sprocket holes down its edges are what name it as film
 * at all.
 */
function FilmReel() {
  return (
    <group>
      {/* Only the reel leans. The tail and the can are lying on the board, and
          inside the lean they tipped through it — the can by 28mm, which at
          this piece's scale is half of it under the shelf. */}
      <group rotation={[0, 0, 0.12]}>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            material={flatMat(PALETTE.reelMetal)}
            position={[side * 0.026, 0.115, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.112, 0.112, 0.01, 12]} />
          </mesh>
          {/* Rolled rim round the outside of each flange. */}
          <mesh
            material={flatMat(PALETTE.reelDark)}
            position={[side * 0.026, 0.115, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <torusGeometry args={[0.111, 0.005, 4, 14]} />
          </mesh>
        </group>
      ))}
      {/* Hub, with the square keyway through the middle of it. */}
      <mesh material={flatMat(PALETTE.reelDark)} position={[0, 0.115, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.052, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.filmStrip)} position={[0, 0.115, 0]} rotation={[Math.PI / 4, 0, 0]}>
        <boxGeometry args={[0.056, 0.017, 0.017]} />
      </mesh>
      {/* Wound film between the flanges, and the end of the roll standing proud. */}
      <mesh material={flatMat(PALETTE.filmStrip)} position={[0, 0.115, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.096, 0.096, 0.044, 12]} />
      </mesh>
      <mesh
        material={flatMat(PALETTE.filmSprocket)}
        position={[0, 0.115, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0965, 0.0965, 0.006, 12]} />
      </mesh>

      {/* Spokes, cut through the flange so it reads as a reel not a disc. */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI;
        return [-1, 1].map((side) => (
          <mesh
            key={`${i}-${side}`}
            material={flatMat(PALETTE.reelDark)}
            position={[side * 0.027, 0.115, 0]}
            rotation={[angle, 0, Math.PI / 2]}
          >
            <boxGeometry args={[0.012, 0.012, 0.18]} />
          </mesh>
        ));
      })}
      {/* And the lightening holes between them, in the colour of the film they
          look through onto rather than the flange's, so they read as openings. */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return [-1, 1].map((side) => (
          <mesh
            key={`${i}-${side}`}
            material={flatMat(PALETTE.filmStrip)}
            position={[side * 0.0315, 0.115 + Math.sin(angle) * 0.066, Math.cos(angle) * 0.066]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.017, 0.017, 0.003, 7]} />
          </mesh>
        ));
      })}

      </group>

      {/* A tail of film spilling onto the board, in three sections so it bends. */}
      {[
        [0.088, 0.006, 0.044, 0.42, 0.06, 0.075],
        [0.148, 0.005, 0.076, 0.9, 0.02, 0.065],
        [0.176, 0.004, 0.122, 1.35, -0.03, 0.055],
      ].map(([x, y, z, turn, tip, len], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, turn, tip]}>
          <mesh material={flatMat(PALETTE.filmStrip)}>
            <boxGeometry args={[len, 0.005, 0.03]} />
          </mesh>
          {/* Sprocket holes down both edges of the strip. */}
          {[-1, 1].map((edge) =>
            [-1, 0, 1].map((n) => (
              <mesh
                key={`${edge}-${n}`}
                material={flatMat(PALETTE.filmSprocket)}
                position={[n * len * 0.3, 0.003, edge * 0.011]}
              >
                <boxGeometry args={[0.006, 0.002, 0.005]} />
              </mesh>
            ))
          )}
        </group>
      ))}

      {/* The can it lives in, lying flat with the lid set beside it. */}
      <group position={[-0.112, 0, 0.052]} rotation={[0, 0.3, 0]}>
        <mesh material={flatMat(PALETTE.reelMetal)} position={[0, 0.011, 0]}>
          <cylinderGeometry args={[0.068, 0.068, 0.022, 12]} />
        </mesh>
        <mesh material={flatMat(PALETTE.reelDark)} position={[0, 0.023, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.004, 12]} />
        </mesh>
        <mesh material={flatMat(PALETTE.bookPages)} position={[0, 0.026, 0.012]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.05, 0.001, 0.024]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Stellar Masses — a small refractor on a tripod, tilted at the sky.
 *
 * Built as an equatorial mount rather than a stick on three legs: the tube sits
 * in two rings on a head, the head carries a counterweight out the other side,
 * and the legs are braced to a spreader with pads on their feet. The focuser
 * and its knobs at the low end, and the dew shield at the high one, are what
 * make it a telescope rather than a tube.
 */
function Telescope() {
  const LEG_TILT = 0.4;

  return (
    <group>
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2 + 0.4;
        return (
          <group key={i}>
            <mesh
              material={flatMat(PALETTE.scopeTripod)}
              position={[Math.cos(angle) * 0.05, 0.11, Math.sin(angle) * 0.05]}
              // Leaning outward on the way down: the three tops gather under the
              // mount at radius 0.004 and the feet splay to 0.097 on the board.
              // Inverting both signs is what stood the whole tripod on a single
              // point with its legs opening at the head.
              rotation={[-Math.sin(angle) * LEG_TILT, 0, Math.cos(angle) * LEG_TILT]}
            >
              <cylinderGeometry args={[0.008, 0.008, 0.24, 5]} />
            </mesh>
            {/* Pad on the foot, so the leg meets the board on something. */}
            <mesh
              material={flatMat(PALETTE.scopeFoot)}
              position={[Math.cos(angle) * 0.097, 0.006, Math.sin(angle) * 0.097]}
            >
              <cylinderGeometry args={[0.014, 0.011, 0.012, 6]} />
            </mesh>
            {/* Brace out to the spreader in the middle. */}
            <mesh
              material={flatMat(PALETTE.scopeFoot)}
              position={[Math.cos(angle) * 0.039, 0.062, Math.sin(angle) * 0.039]}
              rotation={[0, -angle, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.004, 0.004, 0.055, 4]} />
            </mesh>
          </group>
        );
      })}
      {/* Spreader / accessory tray the braces meet at. */}
      <mesh material={flatMat(PALETTE.scopeFoot)} position={[0, 0.062, 0]}>
        <cylinderGeometry args={[0.026, 0.024, 0.008, 6]} />
      </mesh>

      {/* Head: a collar on the legs, the polar block, and the counterweight. */}
      <mesh material={flatMat(PALETTE.scopeBrass)} position={[0, 0.235, 0]}>
        <cylinderGeometry args={[0.026, 0.03, 0.038, 7]} />
      </mesh>
      <mesh material={flatMat(PALETTE.scopeDark)} position={[0, 0.262, 0]} rotation={[0, 0.3, 0.34]}>
        <boxGeometry args={[0.034, 0.05, 0.03]} />
      </mesh>
      <group position={[0, 0.256, 0]} rotation={[0, 0.3, 0.34]}>
        <mesh material={flatMat(PALETTE.scopeBrass)} position={[0.052, -0.03, 0]} rotation={[0, 0, 1.05]}>
          <cylinderGeometry args={[0.005, 0.005, 0.075, 5]} />
        </mesh>
        <mesh material={flatMat(PALETTE.scopeDark)} position={[0.086, -0.049, 0]}>
          <cylinderGeometry args={[0.019, 0.019, 0.018, 7]} />
        </mesh>
        {/* Slow-motion knob off the side of the head. */}
        <mesh material={flatMat(PALETTE.scopeBrass)} position={[-0.03, -0.014, 0.024]} rotation={[1.2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.026, 6]} />
        </mesh>
      </group>

      {/* Tube, on an equatorial tilt, held in two rings. */}
      <group position={[0, 0.27, 0]} rotation={[-0.62, 0.3, 0]}>
        <mesh material={flatMat(PALETTE.scopeTube)}>
          <cylinderGeometry args={[0.031, 0.036, 0.29, 8]} />
        </mesh>
        {/* Rings clamping it to the head. */}
        {[-0.05, 0.045].map((y, i) => (
          <mesh key={i} material={flatMat(PALETTE.scopeDark)} position={[0, y, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.014, 8]} />
          </mesh>
        ))}
        {/* Dew shield over the objective, and the objective cell inside it. */}
        <mesh material={flatMat(PALETTE.scopeBrass)} position={[0, 0.153, 0]}>
          <cylinderGeometry args={[0.038, 0.034, 0.022, 8]} />
        </mesh>
        <mesh material={flatMat(PALETTE.scopeDark)} position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.006, 8]} />
        </mesh>
        {/* Focuser barrel at the low end, its two knobs, and the eyepiece. */}
        <mesh material={flatMat(PALETTE.scopeBrass)} position={[0, -0.152, 0]}>
          <cylinderGeometry args={[0.02, 0.024, 0.03, 8]} />
        </mesh>
        <mesh material={flatMat(PALETTE.scopeDark)} position={[0, -0.176, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.02, 7]} />
        </mesh>
        <mesh material={flatMat(PALETTE.scopeBrass)} position={[0, -0.19, 0]}>
          <cylinderGeometry args={[0.011, 0.009, 0.012, 7]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            material={flatMat(PALETTE.scopeDark)}
            position={[side * 0.027, -0.15, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.012, 6]} />
          </mesh>
        ))}
        {/* Finder scope riding on the tube in its own bracket. */}
        <mesh material={flatMat(PALETTE.scopeBrass)} position={[0.042, 0.05, 0]} rotation={[0, 0, -0.06]}>
          <cylinderGeometry args={[0.011, 0.012, 0.1, 6]} />
        </mesh>
        {[0.018, 0.082].map((y, i) => (
          <mesh key={i} material={flatMat(PALETTE.scopeDark)} position={[0.038, y, 0]}>
            <boxGeometry args={[0.018, 0.008, 0.008]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.scopeDark)} position={[0.042, 0.104, 0]}>
          <cylinderGeometry args={[0.009, 0.009, 0.008, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Sports — a two-handled cup on a stepped plinth, with a plaque on the front.
 * Reads clearer than a ball, which at this scale is just a sphere.
 */
function Trophy() {
  return (
    <group>
      {/* Plinth in three courses, each set back from the one below. */}
      <mesh material={flatMat(PALETTE.trophyBase)} position={[0, 0.012, 0]}>
        <boxGeometry args={[0.125, 0.024, 0.125]} />
      </mesh>
      <mesh material={flatMat(PALETTE.trophyBase)} position={[0, 0.034, 0]}>
        <boxGeometry args={[0.108, 0.022, 0.108]} />
      </mesh>
      <mesh material={flatMat(PALETTE.trophyBase)} position={[0, 0.052, 0]}>
        <boxGeometry args={[0.09, 0.02, 0.09]} />
      </mesh>
      {/* The plaque, and a bead of gold round the top course. */}
      <mesh material={flatMat(PALETTE.trophyPlaque)} position={[0, 0.034, 0.0555]}>
        <boxGeometry args={[0.072, 0.016, 0.003]} />
      </mesh>
      <mesh material={flatMat(PALETTE.trophyGold)} position={[0, 0.0625, 0]}>
        <boxGeometry args={[0.094, 0.005, 0.094]} />
      </mesh>

      {/* Stem, with a knop partway up it. */}
      <mesh material={flatMat(PALETTE.trophyGold)} position={[0, 0.082, 0]}>
        <cylinderGeometry args={[0.014, 0.03, 0.042, 8]} />
      </mesh>
      <mesh material={flatMat(PALETTE.trophyGold)} position={[0, 0.088, 0]}>
        <cylinderGeometry args={[0.021, 0.021, 0.012, 8]} />
      </mesh>

      {/* Bowl: a cone opening upward, banded, capped by a rim. */}
      <mesh material={flatMat(PALETTE.trophyGold)} position={[0, 0.138, 0]}>
        <cylinderGeometry args={[0.062, 0.022, 0.075, 10]} />
      </mesh>
      <mesh material={flatMat(PALETTE.trophyPlaque)} position={[0, 0.126, 0]}>
        <cylinderGeometry args={[0.0505, 0.0505, 0.008, 10]} />
      </mesh>
      <mesh material={flatMat(PALETTE.trophyGold)} position={[0, 0.178, 0]}>
        <cylinderGeometry args={[0.066, 0.062, 0.012, 10]} />
      </mesh>
      {/* The inside, so the cup reads as open rather than solid. */}
      <mesh material={flatMat(PALETTE.trophyPlaque)} position={[0, 0.174, 0]}>
        <cylinderGeometry args={[0.058, 0.03, 0.008, 10]} />
      </mesh>

      {/* Handles, on their own bosses where they meet the bowl. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            material={flatMat(PALETTE.trophyGold)}
            position={[side * 0.072, 0.142, 0]}
            rotation={[Math.PI / 2, 0, side * -0.3]}
          >
            <torusGeometry args={[0.028, 0.007, 4, 8, Math.PI * 1.1]} />
          </mesh>
          {[0.17, 0.116].map((y, i) => (
            <mesh
              key={i}
              material={flatMat(PALETTE.trophyGold)}
              position={[side * 0.05, y, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.008, 0.008, 0.012, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * LEGO — a few generic interlocking bricks part-built on a plate, with loose
 * ones beside it. Plain studded blocks: no branding, no logo on the studs.
 *
 * The stack is deliberately not a tower of identical bricks. Different plan
 * sizes, a round one, and a couple of pieces still lying on the board are what
 * make it read as a build in progress rather than as a stack of boxes.
 */
function Bricks() {
  const PLATE_H = 0.01;
  const BRICK_H = 0.042;
  const STUD_PITCH = 0.043;
  const STUD_R = 0.013;
  const STUD_H = 0.012;

  /** A brick's top studs, laid out on the standard pitch. */
  const studs = (w: number, d: number, y: number, color: string) => {
    const cols = Math.max(1, Math.round(w / STUD_PITCH));
    const rows = Math.max(1, Math.round(d / STUD_PITCH));
    return Array.from({ length: cols }, (_, c) =>
      Array.from({ length: rows }, (_, r) => (
        <mesh
          key={`${c}-${r}`}
          material={flatMat(color)}
          position={[
            (c - (cols - 1) / 2) * STUD_PITCH,
            y + STUD_H / 2,
            (r - (rows - 1) / 2) * STUD_PITCH,
          ]}
        >
          <cylinderGeometry args={[STUD_R, STUD_R, STUD_H, 8]} />
        </mesh>
      ))
    );
  };

  const bricks = [
    { w: 0.172, d: 0.13, h: PLATE_H, color: PALETTE.brickGrey, turn: 0, x: 0, z: 0 },
    { w: 0.13, d: 0.085, h: BRICK_H, color: PALETTE.brickRed, turn: 0.06, x: 0.004, z: 0.008 },
    { w: 0.105, d: 0.085, h: BRICK_H, color: PALETTE.brickBlue, turn: 0.2, x: 0.012, z: 0.002 },
    { w: 0.085, d: 0.062, h: BRICK_H, color: PALETTE.brickYellow, turn: -0.12, x: -0.008, z: -0.008 },
  ];
  let y = 0;
  const placed = bricks.map((brick) => {
    const at = y;
    y += brick.h;
    return { ...brick, base: at };
  });

  return (
    <group>
      {placed.map((brick, i) => (
        <group key={i} position={[brick.x, brick.base, brick.z]} rotation={[0, brick.turn, 0]}>
          <mesh material={flatMat(brick.color)} position={[0, brick.h / 2, 0]}>
            <boxGeometry args={[brick.w, brick.h, brick.d]} />
          </mesh>
          {/* The plate at the bottom keeps its studs; the bricks above it only
              show the ones the next piece up does not cover, but at this size
              drawing them all and letting the stack hide its own is cheaper to
              read than working out which. */}
          {studs(brick.w, brick.d, brick.h, brick.color)}
        </group>
      ))}
      {/* A 1x1 round on top, the piece that finishes a build. */}
      <group position={[0.048, y, -0.026]}>
        <mesh material={flatMat(PALETTE.brickWhite)} position={[0, 0.012, 0]}>
          <cylinderGeometry args={[0.019, 0.019, 0.024, 8]} />
        </mesh>
        <mesh material={flatMat(PALETTE.brickWhite)} position={[0, 0.03, 0]}>
          <cylinderGeometry args={[STUD_R, STUD_R, STUD_H, 8]} />
        </mesh>
      </group>

      {/* Loose on the board: one on its side showing the tubes underneath, one
          flat, and a single stray. */}
      {/* Lifted by half its own length, which is the face it now stands on —
          tipping it without raising it buried half the brick in the board. */}
      <group position={[0.104, 0.0425, 0.07]} rotation={[0, 0.7, Math.PI / 2]}>
        <mesh material={flatMat(PALETTE.brickGreen)} position={[0, BRICK_H / 2, 0]}>
          <boxGeometry args={[0.085, BRICK_H, 0.062]} />
        </mesh>
        {[-1, 1].map((c) => (
          <mesh
            key={c}
            material={flatMat(PALETTE.brickGreen)}
            position={[c * 0.021, BRICK_H + STUD_H / 2, 0]}
          >
            <cylinderGeometry args={[STUD_R, STUD_R, STUD_H, 8]} />
          </mesh>
        ))}
        {/* The tubes on the underside, which is the face now pointing out. */}
        <mesh material={flatMat(PALETTE.brickGreen)} position={[0, 0.002, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.03, 8]} />
        </mesh>
      </group>
      <group position={[-0.096, 0, 0.062]} rotation={[0, -0.4, 0]}>
        <mesh material={flatMat(PALETTE.brickWhite)} position={[0, 0.005, 0]}>
          <boxGeometry args={[0.088, PLATE_H, 0.045]} />
        </mesh>
        {studs(0.088, 0.045, PLATE_H, PALETTE.brickWhite)}
      </group>
      <group position={[-0.05, 0, 0.092]} rotation={[0, 0.9, 0]}>
        <mesh material={flatMat(PALETTE.brickBlue)} position={[0, BRICK_H / 2, 0]}>
          <boxGeometry args={[0.042, BRICK_H, 0.042]} />
        </mesh>
        {studs(0.042, 0.042, BRICK_H, PALETTE.brickBlue)}
      </group>
    </group>
  );
}

/**
 * Archery — a recurve bow leaning against a quiver of arrows.
 *
 * The bow is drawn as the parts an archer would name: limbs, a riser thick
 * enough for a hand with the arrow shelf cut into it, a wrapped grip, nocks at
 * both tips, and a string with the serving whipped round its middle. The quiver
 * carries five arrows rather than three, at mixed heights, with one lying on
 * the board beside it so the heads are visible somewhere.
 */
function BowAndQuiver() {
  return (
    <group>
      {/* Bow, standing on one limb tip and leaning back. */}
      <group position={[-0.05, 0, 0]} rotation={[0.14, 0, 0.06]}>
        <mesh material={flatMat(PALETTE.bowWood)} position={[0, 0.25, 0]}>
          <torusGeometry args={[0.2, 0.009, 4, 14, Math.PI * 0.95]} />
        </mesh>
        {/* A lighter lamination down the belly of the limbs. */}
        <mesh material={flatMat(PALETTE.arrowShaft)} position={[0, 0.25, 0]}>
          <torusGeometry args={[0.207, 0.0035, 3, 14, Math.PI * 0.95]} />
        </mesh>
        {/* Riser, thickening the middle where a hand would go. */}
        <mesh material={flatMat(PALETTE.bowWood)} position={[-0.198, 0.25, 0]}>
          <boxGeometry args={[0.022, 0.09, 0.02]} />
        </mesh>
        {/* Grip wrap, and the arrow shelf cut above it. */}
        <mesh material={flatMat(PALETTE.quiverTrim)} position={[-0.199, 0.238, 0]}>
          <boxGeometry args={[0.025, 0.038, 0.023]} />
        </mesh>
        <mesh material={flatMat(PALETTE.bowWood)} position={[-0.193, 0.264, 0.011]}>
          <boxGeometry args={[0.016, 0.005, 0.008]} />
        </mesh>
        {/* Nocks at both limb tips. */}
        {[1, -1].map((end) => (
          <mesh
            key={end}
            material={flatMat(PALETTE.quiverTrim)}
            position={[0.0, 0.25 + end * 0.199, 0]}
          >
            <boxGeometry args={[0.014, 0.012, 0.012]} />
          </mesh>
        ))}
        {/* String, chord across the limb tips, with the serving at its middle. */}
        <mesh material={flatMat(PALETTE.bowString)} position={[0.006, 0.25, 0]}>
          <boxGeometry args={[0.004, 0.398, 0.004]} />
        </mesh>
        <mesh material={flatMat(PALETTE.quiverTrim)} position={[0.006, 0.25, 0]}>
          <boxGeometry args={[0.006, 0.05, 0.006]} />
        </mesh>
        <mesh material={flatMat(PALETTE.fletching)} position={[0.006, 0.262, 0]}>
          <boxGeometry args={[0.007, 0.006, 0.007]} />
        </mesh>
      </group>

      {/* Quiver, tipped back with arrows standing out of it. */}
      <group position={[0.085, 0, -0.01]} rotation={[0.2, 0, -0.16]}>
        <mesh material={flatMat(PALETTE.quiver)} position={[0, 0.105, 0]}>
          <cylinderGeometry args={[0.043, 0.036, 0.21, 8]} />
        </mesh>
        {/* Base cap and mouth band. */}
        <mesh material={flatMat(PALETTE.quiverTrim)} position={[0, 0.008, 0]}>
          <cylinderGeometry args={[0.038, 0.034, 0.018, 8]} />
        </mesh>
        <mesh material={flatMat(PALETTE.chestIron)} position={[0, 0.17, 0]}>
          <cylinderGeometry args={[0.046, 0.046, 0.014, 8]} />
        </mesh>
        {/* Stitched seam up the side, and the strap across the body. */}
        <mesh material={flatMat(PALETTE.quiverTrim)} position={[0, 0.105, 0.041]}>
          <boxGeometry args={[0.008, 0.19, 0.006]} />
        </mesh>
        <mesh material={flatMat(PALETTE.quiverTrim)} position={[0, 0.128, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.045, 0.045, 0.012, 8]} />
        </mesh>
        <mesh material={flatMat(PALETTE.quiverTrim)} position={[0, 0.06, 0]} rotation={[0, 0, -0.08]}>
          <cylinderGeometry args={[0.041, 0.041, 0.012, 8]} />
        </mesh>

        {[
          [0.014, 0.012, 0.05, 0.15],
          [-0.016, -0.01, -0.04, 0.13],
          [0.004, -0.018, 0.02, 0.16],
          [-0.006, 0.02, -0.02, 0.12],
          [0.02, -0.004, 0.08, 0.14],
        ].map(([x, z, lean, len], i) => (
          <group key={i} position={[x, 0.2, z]} rotation={[0, 0, lean]}>
            <mesh material={flatMat(PALETTE.arrowShaft)} position={[0, len / 2, 0]}>
              <cylinderGeometry args={[0.004, 0.004, len, 5]} />
            </mesh>
            {/* Nock at the top of the shaft. */}
            <mesh material={flatMat(PALETTE.quiverTrim)} position={[0, len + 0.004, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.008, 5]} />
            </mesh>
            {[0, 1, 2].map((f) => (
              <mesh
                key={f}
                material={flatMat(f === 0 ? PALETTE.fletchingAlt : PALETTE.fletching)}
                position={[0, len - 0.018, 0]}
                rotation={[0, (f / 3) * Math.PI * 2, 0]}
              >
                <boxGeometry args={[0.016, 0.03, 0.002]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* One arrow on the board, so the heads are visible somewhere. */}
      <group position={[0.03, 0.005, 0.088]} rotation={[0, 0.42, Math.PI / 2]}>
        <mesh material={flatMat(PALETTE.arrowShaft)}>
          <cylinderGeometry args={[0.004, 0.004, 0.2, 5]} />
        </mesh>
        <mesh material={flatMat(PALETTE.arrowHead)} position={[0, 0.113, 0]}>
          <coneGeometry args={[0.008, 0.026, 4]} />
        </mesh>
        <mesh material={flatMat(PALETTE.quiverTrim)} position={[0, -0.102, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.008, 5]} />
        </mesh>
        {[0, 1, 2].map((f) => (
          <mesh
            key={f}
            material={flatMat(f === 0 ? PALETTE.fletchingAlt : PALETTE.fletching)}
            position={[0, -0.082, 0]}
            rotation={[0, (f / 3) * Math.PI * 2, 0]}
          >
            <boxGeometry args={[0.016, 0.03, 0.002]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const FIGURINE: Record<InterestId, () => JSX.Element> = {
  travel: Globe,
  skiing: Skis,
  history: Column,
  onepiece: StrawHatAndChest,
  reading: BookStack,
  film: FilmReel,
  stellar: Telescope,
  sports: Trophy,
  lego: Bricks,
  archery: BowAndQuiver,
};

interface FigurinesProps {
  onHover: (label: string | null) => void;
}

/** The ten interest objects, placed onto their tiers at their own scale. */
export function Figurines({ onHover }: FigurinesProps) {
  return (
    <>
      {OBJECTS.map((spot) => {
        const Figurine = FIGURINE[spot.id];
        return (
          <group
            key={spot.id}
            position={[spot.x, TIER_Y[spot.tier], spot.z]}
            rotation={[0, spot.rotationY, 0]}
          >
            <Highlight spot={spot} onHover={onHover}>
              <Figurine />
            </Highlight>
          </group>
        );
      })}
    </>
  );
}
