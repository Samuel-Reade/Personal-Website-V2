import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useStore } from "../state/useStore";
import { displaySize, getDisplayFont } from "./displayFont";
import { PLAYER_RADIUS } from "./figure";
import {
  createPortalMaterial,
  PORTAL_SURFACE_FRACTION,
  PORTAL_SURFACE_RADIUS,
} from "./portalMaterial";
import { touchesPortalDisc } from "./portalTrigger";

const LABEL_CLEARANCE = 0.72;
/** Cap height of the label's letters, in world units — see `displaySize`. */
const LABEL_CAP_HEIGHT = 0.4;
const LABEL_BOB_HEIGHT = 0.09;
const LABEL_BOB_SPEED = 2.2;

interface ReturnPortalProps {
  /** The world's player/vehicle position, read each frame to test the trigger. */
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  position: [number, number, number];
  /** Y rotation that turns the portal's face toward wherever the player approaches from. */
  rotationY?: number;
  scale?: number;
  /**
   * Left unset, the trigger is contact: the portal fires the moment any part of
   * the walker touches any part of the disc, exactly as the meadow's portals do
   * (`portalTrigger.ts`), with the path across each frame swept so no stride can
   * skip it.
   *
   * Set, it replaces that with a plain cylinder of this radius about the
   * centre. That is for the vehicles — the boat, the suit, the helicopter —
   * whose hulls are not the walker's footprint and which carry enough speed that
   * a wide, forgiving circle reads better than a precise edge.
   */
  triggerRadius?: number;
  /**
   * How far short of the disc contact still counts, in front of it and behind,
   * across its full width — see `reach` in `portalTrigger.ts`. Zero by default:
   * the walker has to touch the disc. Only for a disc the room's own geometry
   * keeps the walker from ever reaching.
   */
  triggerReach?: number;
  /**
   * Vertical half-height of the trigger. Unlimited by default, because in every
   * world built on a ground plane the player's Y is fixed and a horizontal test
   * is the whole story.
   *
   * Worlds the player can move through vertically have to set it. In the
   * tech-stack system the player flies freely, and without a bound the trigger
   * is an infinite column: passing high above the portal on the way to an outer
   * shell would silently drop them back into the meadow.
   */
  triggerHeight?: number;
  label?: string;
}

/**
 * The way back out of a world: the same swirling disc that brought the player
 * in, standing in the world it leads out of. Walking (or rowing) into it returns
 * to the meadow, and so does clicking it.
 *
 * This is deliberately additive rather than a replacement — every world keeps
 * its Escape key and its back button. The portal exists because those two are
 * chrome, and a world you entered by walking through something should be
 * leavable the same way.
 */
export function ReturnPortal({
  playerPosRef,
  position,
  rotationY = Math.PI,
  scale = 1,
  triggerRadius,
  triggerReach = 0,
  triggerHeight = Infinity,
  label = "Meadow",
}: ReturnPortalProps) {
  const exitWorld = useStore((s) => s.exitWorld);
  const [hovered, setHovered] = useState(false);
  const labelRef = useRef<THREE.Group>(null!);
  /**
   * Starts disarmed and only arms once the player is clear of the trigger, the
   * same guard the meadow's portals use — otherwise a world that happened to
   * spawn the player inside the circle would bounce them straight back out.
   */
  const armed = useRef(false);
  /**
   * Where the player stood last frame, so the contact test can sweep the step
   * between then and now. Null until the first frame has been seen.
   */
  const lastPos = useRef<THREE.Vector3 | null>(null);
  /**
   * The disc as the trigger sees it. Keyed on the tuple's elements rather than
   * the tuple, which callers are free to write fresh on every render.
   */
  const disc = useMemo(
    () => ({ position, rotationY, scale }),
    [position[0], position[1], position[2], rotationY, scale]
  );

  const seed = useMemo(() => Math.random() * Math.PI * 2, []);
  const material = useMemo(() => createPortalMaterial(seed), [seed]);

  const { labelGeometry, labelHitSize } = useMemo(() => {
    const geometry = new TextGeometry(label, {
      font: getDisplayFont(),
      size: displaySize(LABEL_CAP_HEIGHT),
      depth: 0.14,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.014,
      bevelSegments: 2,
    });
    geometry.center();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    return {
      labelGeometry: geometry,
      // Padded, because raycasting the glyphs themselves means every gap between
      // and inside letters is a hole the click falls straight through.
      labelHitSize: [box.max.x - box.min.x + 0.28, box.max.y - box.min.y + 0.24] as [number, number],
    };
  }, [label]);

  const labelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f4e8ff",
        emissive: new THREE.Color("#a855f7"),
        emissiveIntensity: 1.4,
        roughness: 0.35,
        metalness: 0,
      }),
    []
  );

  // Leaving the world with a hover still active would strand the cursor as a pointer.
  useEffect(() => () => {
    document.body.style.cursor = "default";
  }, []);

  const surfaceRadius = PORTAL_SURFACE_RADIUS * scale;
  const discScale = surfaceRadius / PORTAL_SURFACE_FRACTION;
  const labelBaseY = surfaceRadius + LABEL_CLEARANCE * scale;

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    material.uniforms.uTime.value = elapsed;

    if (labelRef.current) {
      labelRef.current.position.y =
        labelBaseY + Math.sin(elapsed * LABEL_BOB_SPEED + seed) * LABEL_BOB_HEIGHT;
    }
    labelMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      labelMaterial.emissiveIntensity,
      hovered ? 2.6 : 1.4,
      0.12
    );

    const player = playerPosRef.current;
    const from = lastPos.current ?? player;
    const touching =
      triggerRadius === undefined
        ? touchesPortalDisc(disc, from.x, from.z, player.x, player.z, PLAYER_RADIUS, triggerReach)
        : Math.hypot(player.x - position[0], player.z - position[2]) <= triggerRadius;
    const rise = Math.abs(player.y - position[1]);
    if (lastPos.current) lastPos.current.copy(player);
    else lastPos.current = player.clone();

    if (!touching || rise > triggerHeight) {
      armed.current = true;
      return;
    }
    if (!armed.current) return;
    // Read non-reactively: subscribing would re-render this component on every
    // panel open. Walking out from under an open panel would yank the reader out
    // of what they were reading, so the trigger waits until it's closed.
    if (useStore.getState().activePanel) return;

    armed.current = false;
    exitWorld();
  });

  const interaction = {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHovered(false);
      document.body.style.cursor = "default";
    },
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      exitWorld();
    },
  };

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh material={material} scale={discScale} {...interaction}>
        <circleGeometry args={[1, 96]} />
      </mesh>

      <group ref={labelRef} position={[0, labelBaseY, 0]}>
        <mesh geometry={labelGeometry} material={labelMaterial} scale={scale} {...interaction} />
        <mesh scale={scale} {...interaction}>
          <planeGeometry args={labelHitSize} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
