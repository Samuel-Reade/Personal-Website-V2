import { PALETTE } from "../palette";
import { flatMat } from "../materials";
import type { CenterpieceId } from "../layout";
import { FactoryScene } from "./FactoryScene";
import { ChartScene } from "./ChartScene";
import { PhoneScene } from "./PhoneScene";
import { GymScene } from "./GymScene";
import { FilmSetScene } from "./FilmSetScene";

/** Voting — a ballot box with a paper half-posted. */
function BallotScene() {
  return (
    <group>
      <mesh material={flatMat(PALETTE.ballotLid)} position={[0, 0.12, 0]}>
        <boxGeometry args={[2.0, 0.24, 1.7]} />
      </mesh>
      <mesh material={flatMat(PALETTE.ballotBox)} position={[0, 1.0, 0]}>
        <boxGeometry args={[1.75, 1.6, 1.5]} />
      </mesh>
      <mesh material={flatMat(PALETTE.ballotLid)} position={[0, 1.88, 0]}>
        <boxGeometry args={[1.9, 0.18, 1.62]} />
      </mesh>
      <mesh material={flatMat(PALETTE.ballotSlot)} position={[0, 1.98, 0]}>
        <boxGeometry args={[0.9, 0.06, 0.16]} />
      </mesh>
      {/* A ballot half-posted, so the box reads as in use rather than as a crate */}
      <mesh
        material={flatMat(PALETTE.ballotPaper)}
        position={[0.06, 2.14, 0.02]}
        rotation={[0.16, 0.1, 0.08]}
      >
        <boxGeometry args={[0.7, 0.5, 0.03]} />
      </mesh>
      {/* A polling booth beside it, so the island has more than one object on it. */}
      <group position={[2.1, 0, -0.9]} rotation={[0, -0.5, 0]}>
        {[-0.6, 0.6].map((x, i) => (
          <mesh key={i} material={flatMat(PALETTE.ballotBox)} position={[x, 1.0, -0.5]}>
            <boxGeometry args={[0.12, 2.0, 1.1]} />
          </mesh>
        ))}
        <mesh material={flatMat(PALETTE.ballotLid)} position={[0, 1.95, -0.5]}>
          <boxGeometry args={[1.32, 0.12, 1.16]} />
        </mesh>
        <mesh material={flatMat(PALETTE.ballotPaper)} position={[0, 0.95, -1.0]}>
          <boxGeometry args={[1.1, 0.7, 0.06]} />
        </mesh>
        <mesh material={flatMat(PALETTE.ballotLid)} position={[0, 0.9, -0.5]}>
          <boxGeometry args={[1.2, 0.08, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}

interface CenterpieceProps {
  id: CenterpieceId;
}

/** Picks the themed scene for an island. */
export function Centerpiece({ id }: CenterpieceProps) {
  switch (id) {
    case "factory":
      return <FactoryScene />;
    case "barchart":
      return <ChartScene />;
    case "phone":
      return <PhoneScene />;
    case "bench":
      return <GymScene />;
    case "television":
      return <FilmSetScene />;
    case "ballot":
      return <BallotScene />;
  }
}
