import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useStore } from "../../state/useStore";
import { displaySize, getDisplayFont } from "../../three/displayFont";
import { BALCONY_BACK_Z, DOOR_LABEL_CAP_HEIGHT, DOOR_LABEL_Y } from "./layout";

const BOB_HEIGHT = 0.07;
const BOB_SPEED = 2.2;

/**
 * "Connect", riding over the doorway out to the balcony.
 *
 * Deliberately the same object as a portal label rather than a lookalike: the
 * extruded display face, the pale lilac on a purple emissive, the bob, the lift
 * in brightness under the pointer, and the padded invisible plane behind the
 * glyphs so the gaps inside letters aren't holes a click falls through. A
 * visitor has read six of these in the meadow before they ever climb the stair,
 * and this one says the same thing they said: there is something here, and it
 * opens.
 *
 * It hangs on the inside face of the wall, facing back down the gallery, because
 * that is the only side it can be read from — from the balcony you are already
 * through the door it names.
 */
export function ConnectSign() {
  const openPanel = useStore((s) => s.openPanel);
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null!);

  const { geometry, hitSize } = useMemo(() => {
    const text = new TextGeometry("Connect", {
      font: getDisplayFont(),
      size: displaySize(DOOR_LABEL_CAP_HEIGHT),
      depth: 0.13,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.017,
      bevelSize: 0.013,
      bevelSegments: 2,
    });
    // TextGeometry runs glyphs rightward from the origin, so without this the
    // word would hang off one jamb instead of sitting over the opening.
    text.center();
    text.computeBoundingBox();
    const box = text.boundingBox!;
    return {
      geometry: text,
      hitSize: [box.max.x - box.min.x + 0.28, box.max.y - box.min.y + 0.24] as [number, number],
    };
  }, []);

  const material = useMemo(
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

  useFrame((state) => {
    if (group.current) {
      group.current.position.y =
        DOOR_LABEL_Y + Math.sin(state.clock.elapsedTime * BOB_SPEED) * BOB_HEIGHT;
    }
    material.emissiveIntensity = THREE.MathUtils.lerp(
      material.emissiveIntensity,
      hovered ? 2.6 : 1.4,
      0.12
    );
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
      openPanel("connect");
    },
  };

  return (
    <group ref={group} position={[0, DOOR_LABEL_Y, BALCONY_BACK_Z + 0.12]}>
      <mesh geometry={geometry} material={material} {...interaction} />
      <mesh {...interaction}>
        <planeGeometry args={hitSize} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
