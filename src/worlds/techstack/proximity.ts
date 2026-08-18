import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Which chip the astronaut is up close to.
 *
 * Flying up to a chip is how the world says you look at one: the nearest chip
 * within reach lights up (see `Chip.tsx`) and the label at the foot of the
 * screen names it. Every chip registers its root object here; once a frame the
 * astronaut's distance to each is measured and a single winner picked. Only
 * ever one — where two chips are both in reach the closer wins outright, so a
 * pass between neighbours hands the light from one to the other rather than
 * lighting both.
 */

/** How close, in world units, the astronaut has to be for a chip to light. */
export const NEAR_RADIUS = 4.5;
/**
 * ...and how far it has to drift before the chip goes dark again. Wider than
 * the reach so a chip hovering right at the edge doesn't blink on and off as
 * the astronaut bobs.
 */
const LEAVE_RADIUS = 5.2;
/**
 * A rival chip has to be this much closer than the lit one to take over. Two
 * chips passing at the same distance would otherwise trade the light every few
 * frames.
 */
const SWITCH_MARGIN = 0.2;

export interface ChipProximity {
  /** Called by each chip with its root object on mount, and with null on unmount. */
  register(id: string, object: THREE.Object3D | null): void;
  /**
   * The id of the chip currently in reach, or null. A ref rather than state:
   * chips read it inside their own frame loop, and the one frame a hand-over
   * happens on is the only frame anything re-renders.
   */
  nearest: { readonly current: string | null };
}

/**
 * Runs the per-frame resolution. `onChange` fires only when the lit chip
 * changes (or clears), with the winning chip's id.
 */
export function useChipProximity(
  playerPosRef: MutableRefObject<THREE.Vector3>,
  onChange: (id: string | null) => void
): ChipProximity {
  const objects = useRef(new Map<string, THREE.Object3D>());
  const nearest = useRef<string | null>(null);
  const world = useMemo(() => new THREE.Vector3(), []);

  // Latest callback without re-subscribing the frame loop for it.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useFrame(() => {
    const player = playerPosRef.current;
    let bestId: string | null = null;
    let bestDistance = Infinity;
    // Distance to the chip currently lit; Infinity if it has gone (unmounted).
    let currentDistance = Infinity;

    for (const [id, object] of objects.current) {
      object.getWorldPosition(world);
      const distance = world.distanceTo(player);
      if (id === nearest.current) currentDistance = distance;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }

    let next = nearest.current;
    if (next !== null && currentDistance > LEAVE_RADIUS) next = null;
    if (
      bestId !== null &&
      bestDistance <= NEAR_RADIUS &&
      (next === null || bestDistance < currentDistance - SWITCH_MARGIN)
    ) {
      next = bestId;
    }

    if (next !== nearest.current) {
      nearest.current = next;
      onChangeRef.current(next);
    }
  });

  return useMemo<ChipProximity>(
    () => ({
      register(id, object) {
        if (object) objects.current.set(id, object);
        else objects.current.delete(id);
      },
      nearest,
    }),
    []
  );
}
