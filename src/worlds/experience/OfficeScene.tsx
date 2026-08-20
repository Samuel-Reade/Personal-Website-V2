import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { getOfficeSky, createWindowGradient } from "./officeSky";
import { isWorkHours } from "./Coworkers";
import { OfficeFloor } from "./OfficeFloor";
import { Figurines } from "./Figurines";
import { LookControls } from "./LookControls";
import { ScreenMouse } from "./ScreenMouse";
import {
  ContactShadow,
  DESK_HEIGHT,
  Desk,
  DeskLamp,
  DeskMat,
  HeadphoneStand,
  Keyboard,
  Monitor,
  Mug,
  Notebook,
  Pen,
  Phone,
  PottedPlant,
  StickyNotes,
} from "./DeskProps";

/** Seated eye position, a little back from the desk's front edge. */
const EYE: [number, number, number] = [0, 1.2, 0.86];

interface OfficeSceneProps {
  onHover: (org: string | null) => void;
}

export function OfficeScene({ onHover }: OfficeSceneProps) {
  const { scene } = useThree();
  // One polled clock drives both the sky and whether the floor is staffed, so
  // the two can't disagree by straddling a boundary between separate reads.
  // Polled rather than read per frame: neither moves meaningfully inside 30s,
  // and every consumer of the sky rebuilds a material when it changes.
  const [now, setNow] = useState(() => new Date());

  const glazing = useMemo(() => createWindowGradient(), []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const sky = useMemo(() => getOfficeSky(now), [now]);
  const staffed = useMemo(() => isWorkHours(now), [now]);

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
      {/* The ceiling panels are emissive planes — they read as lit but cast
          nothing. This is the light they stand in for, so it rises as the
          daylight falls and does most of the work after dark. */}
      <directionalLight
        position={[0, 9, 1]}
        intensity={0.55 * sky.interiorIntensity}
        color={PALETTE.ceilingLight}
      />

      <OfficeFloor sky={sky} windowTexture={glazing.texture} staffed={staffed} />

      {/* The player's own desk. No chair — the camera is sitting in it. This is
          the most-looked-at square metre on the site, so it gets the full kit:
          mat under the inputs, phone by the keyboard, headphones on their
          stand, a pen on the notebook, sticky notes on the monitor's chin. */}
      <group>
        <ContactShadow width={2.5} depth={1.7} opacity={0.55} />
        <Desk />
        <group position={[0, DESK_HEIGHT, 0]}>
          <DeskMat />
        </group>
        <group position={[0, DESK_HEIGHT, -0.32]}>
          <Monitor lit />
          <StickyNotes />
        </group>
        <group position={[0, DESK_HEIGHT, 0.24]}>
          <Keyboard />
        </group>
        {/* Not set dressing: holding this one drives the cursor on the
            monitor, which is the desk's other way into the same records. */}
        <group position={[0.44, DESK_HEIGHT, 0.26]}>
          <ScreenMouse />
        </group>
        <group position={[0.63, DESK_HEIGHT, 0.3]}>
          <Phone />
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
        <group position={[0.62, DESK_HEIGHT, -0.3]}>
          <HeadphoneStand />
        </group>
        <group position={[-0.82, DESK_HEIGHT, 0.2]}>
          <Notebook />
          <group position={[0.05, 0.024, -0.05]}>
            <Pen />
          </group>
        </group>
        <group position={[0, DESK_HEIGHT, 0]}>
          <Figurines onHover={onHover} />
        </group>
      </group>

      <LookControls position={EYE} />
    </>
  );
}
