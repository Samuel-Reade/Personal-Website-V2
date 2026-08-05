import { useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { useStore, type PanelId } from "../state/useStore";
import { getSharedGradient } from "../utils/toon";

interface SignProps {
  id: PanelId;
  label: string;
  position: [number, number, number];
  rotationY: number;
}

/** A clickable wooden sign — post + plank + label. Opens its content panel on click. */
export function Sign({ id, label, position, rotationY }: SignProps) {
  const [hovered, setHovered] = useState(false);
  const openPanel = useStore((s) => s.openPanel);

  const postMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#5b4632", gradientMap: getSharedGradient() }),
    []
  );
  const plankMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: "#8a6b47", gradientMap: getSharedGradient() }),
    []
  );
  const baseColor = useMemo(() => new THREE.Color("#8a6b47"), []);
  const hoverColor = useMemo(() => new THREE.Color("#cda868"), []);

  useFrame(() => {
    plankMat.color.lerp(hovered ? hoverColor : baseColor, 0.15);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh material={postMat} position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
      </mesh>
      <mesh
        material={plankMat}
        position={[0, 1.15, 0]}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = "default";
        }}
        onClick={(e) => {
          e.stopPropagation();
          openPanel(id);
        }}
      >
        <boxGeometry args={[1.1, 0.5, 0.08]} />
      </mesh>
      <Text
        position={[0, 1.15, 0.045]}
        fontSize={0.16}
        color="#2c2117"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.95}
        textAlign="center"
      >
        {label}
      </Text>
    </group>
  );
}
