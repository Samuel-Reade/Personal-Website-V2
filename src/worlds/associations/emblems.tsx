import { useEffect, useMemo } from "react";
import { flatMat } from "./materials";
import type { AssociationId } from "./layout";
import { MARKS } from "./marks";
import { buildMarkGeometries } from "./markGeometry";

/**
 * The association's mark on the front of its envelope.
 *
 * What is drawn lives in `marks.ts`; how it is fitted to the balloon lives in
 * `markGeometry.ts`. This just builds the one for this envelope's radius and
 * hangs a mesh per layer, shaded like everything else on the hill — the marks
 * take the same light the gores do rather than glowing on their own, so a
 * balloon at dusk is a balloon at dusk all over.
 *
 * Built per mount rather than cached across the world: four marks of a few
 * thousand triangles are milliseconds, and owning them here means they go when
 * the balloon does.
 */
export function Emblem({ id, radius }: { id: AssociationId; radius: number }) {
  const spec = MARKS[id];
  const geometries = useMemo(() => buildMarkGeometries(spec, radius), [spec, radius]);
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);

  return (
    <group>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={flatMat(spec.layers[index].color)} />
      ))}
    </group>
  );
}
