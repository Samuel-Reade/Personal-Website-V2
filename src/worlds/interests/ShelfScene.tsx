import * as THREE from "three";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { LookControls } from "../experience/LookControls";
import { PALETTE } from "./palette";
import { Shelf } from "./Shelf";
import { Figurines } from "./Figurines";
import { EYE } from "./layout";

interface ShelfSceneProps {
  onHover: (label: string | null) => void;
}

/**
 * Scene contents for the shelf room: the unit, its dressing, and the ten
 * clickable objects. The camera never leaves EYE — this is a stationary scene,
 * and everything is arranged to be readable without moving.
 *
 * `LookControls` is the office's, imported rather than copied. It is a control
 * scheme with no styling in it, and the per-world isolation this codebase keeps
 * is about *shading* — palettes and materials — not about input. If a third
 * world ever needs it, it should move up to `src/three/` alongside the shared
 * character and camera rig.
 */
export function ShelfScene({ onHover }: ShelfSceneProps) {
  const { scene } = useThree();

  useEffect(() => {
    // A flat wall colour behind everything: the room is enclosed, so there is
    // no sky to show and fog would only grey out a shelf two metres away.
    scene.background = new THREE.Color(PALETTE.wall);
    scene.fog = null;
    return () => {
      scene.background = null;
    };
  }, [scene]);

  return (
    <>
      {/* Soft and even, no shadow maps — same as the office desk. The flat-shaded
          facets already imply their own form, and a shadow map on a scene this
          small buys hard edges the look does not want. */}
      <ambientLight intensity={0.62} color="#fff3e2" />
      <hemisphereLight args={[PALETTE.wall, PALETTE.floor, 0.5]} />
      {/* Key from the front left, as if from a window off-camera. */}
      <directionalLight position={[-3.2, 3.4, 4.2]} intensity={0.78} color="#ffeacc" />
      {/* Cool fill from the opposite side, keeping the deep shelves off black. */}
      <directionalLight position={[3.4, 1.4, 2.2]} intensity={0.26} color="#c8d6e4" />
      {/* A warm point down among the objects, standing in for the candles. */}
      <pointLight position={[0.5, 1.05, 0.35]} intensity={0.5} distance={2.6} color="#ffcf94" />

      <Shelf />
      <Figurines onHover={onHover} />

      <LookControls position={EYE} restPitch={0} />
    </>
  );
}
