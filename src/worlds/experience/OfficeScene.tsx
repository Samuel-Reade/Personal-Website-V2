import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { getOfficeSky, createWindowGradient } from "./officeSky";
import { OfficeFloor } from "./OfficeFloor";
import { Figurines } from "./Figurines";
import { LookControls } from "./LookControls";
import {
  DESK_HEIGHT,
  Desk,
  DeskLamp,
  Keyboard,
  Monitor,
  Mouse,
  Mug,
  Notebook,
  PottedPlant,
} from "./DeskProps";

/** Seated eye position, a little back from the desk's front edge. */
const EYE: [number, number, number] = [0, 1.2, 0.86];

interface OfficeSceneProps {
  onHover: (org: string | null) => void;
}

export function OfficeScene({ onHover }: OfficeSceneProps) {
  const { scene } = useThree();
  // Polled rather than read per frame: the sky only meaningfully moves over
  // minutes, and every consumer of it rebuilds a material when it changes.
  const [sky, setSky] = useState(() => getOfficeSky());

  const glazing = useMemo(() => createWindowGradient(), []);

  useEffect(() => {
    const id = window.setInterval(() => setSky(getOfficeSky()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    glazing.paint(sky);
  }, [glazing, sky]);

  useEffect(() => {
    scene.background = sky.horizon.clone();
    return () => {
      scene.background = null;
    };
  }, [scene, sky]);

  return (
    <>
      {/* Soft and even by design: no shadow maps anywhere in this world, so
          nothing casts the hard edges the flat-shaded facets already imply. */}
      <ambientLight intensity={sky.ambientIntensity} color={sky.light} />
      <hemisphereLight args={[sky.top.getHex(), new THREE.Color(PALETTE.carpet).getHex(), 0.5]} />
      {/* Stands in for daylight through the two glazed walls. */}
      <directionalLight position={[9, 6, -13]} intensity={sky.lightIntensity} color={sky.light} />
      <directionalLight position={[-6, 5, 4]} intensity={0.18} color={PALETTE.wall} />

      <OfficeFloor sky={sky} windowTexture={glazing.texture} />

      {/* The player's own desk. No chair — the camera is sitting in it. */}
      <group>
        <Desk />
        <group position={[0, DESK_HEIGHT, -0.32]}>
          <Monitor lit />
        </group>
        <group position={[0, DESK_HEIGHT, 0.24]}>
          <Keyboard />
        </group>
        <group position={[0.44, DESK_HEIGHT, 0.26]}>
          <Mouse />
        </group>
        <group position={[-0.46, DESK_HEIGHT, 0.26]}>
          <Mug />
        </group>
        <group position={[-0.88, DESK_HEIGHT, -0.24]}>
          <PottedPlant />
        </group>
        <group position={[0.86, DESK_HEIGHT, -0.26]}>
          <DeskLamp />
        </group>
        <group position={[-0.82, DESK_HEIGHT, 0.2]}>
          <Notebook />
        </group>
        <group position={[0, DESK_HEIGHT, 0]}>
          <Figurines onHover={onHover} />
        </group>
      </group>

      <LookControls position={EYE} />
    </>
  );
}
