import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "../palette";
import { flatMat } from "../materials";
import type { CenterpieceId } from "../layout";
import { FactoryScene } from "./FactoryScene";
import { ChartScene } from "./ChartScene";
import { PhoneScene } from "./PhoneScene";
import { GymScene } from "./GymScene";
import { FilmSetScene } from "./FilmSetScene";
import { RibbonScene } from "./RibbonScene";

/**
 * The queue to the ballot box, from the slot outward.
 *
 * The path bows to the side instead of running straight out, because the
 * island's plateau is only four units around and a straight line of six would
 * march the last of them off the edge. Each voter faces the one ahead — which
 * is what a queue is — and the head of the line faces the box itself, ballot
 * raised toward the slot.
 */
const QUEUE_PATH: [number, number][] = [
  [0, 1.15],
  [0.18, 1.98],
  [0.55, 2.72],
  [1.15, 3.25],
  [1.9, 3.1],
  [2.5, 2.55],
];

const VOTER_COATS = [
  PALETTE.voterCoatA,
  PALETTE.voterCoatB,
  PALETTE.voterCoatC,
  PALETTE.voterCoatB,
  PALETTE.voterCoatA,
  PALETTE.voterCoatC,
] as const;

/** People vary; clones don't. Overall height multipliers down the line. */
const VOTER_SCALES = [1, 0.93, 1.05, 0.9, 1.0, 0.96] as const;

const VOTERS = QUEUE_PATH.map(([x, z], i) => {
  // Face the previous point in the path — the person ahead — and at the head
  // of the line, the box at the origin.
  const [ax, az] = i === 0 ? [0, 0] : QUEUE_PATH[i - 1];
  return {
    x,
    z,
    rotationY: Math.atan2(ax - x, az - z),
    coat: VOTER_COATS[i],
    scale: VOTER_SCALES[i],
  };
});

interface VoterProps {
  coat: string;
  /** True for the head of the line, whose ballot is up at the slot. */
  posting?: boolean;
}

/**
 * One voter, in the bay's faceted language: cylinder legs and coat, a
 * low-segment head, arms at the sides — and at the head of the line, one arm
 * up with the ballot. About two-thirds the player's height, so the box keeps
 * its monument scale over the crowd it serves.
 */
function Voter({ coat, posting }: VoterProps) {
  return (
    <group>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} material={flatMat(PALETTE.voterTrouser)} position={[x, 0.29, 0]}>
          <cylinderGeometry args={[0.048, 0.055, 0.58, 5]} />
        </mesh>
      ))}
      {/* Coat, flaring a little at the hem. */}
      <mesh material={flatMat(coat)} position={[0, 0.87, 0]}>
        <cylinderGeometry args={[0.135, 0.185, 0.64, 6]} />
      </mesh>
      {/* Arms hang at the sides; the posting arm swings up toward the slot. */}
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 0.19, 1.12, 0]}
          rotation={posting && side === 1 ? [2.25, 0, -0.18] : [0, 0, side * 0.22]}
        >
          <mesh material={flatMat(coat)} position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.04, 0.045, 0.44, 5]} />
          </mesh>
          {posting && side === 1 && (
            <mesh material={flatMat(PALETTE.ballotPaper)} position={[0, -0.5, 0]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[0.34, 0.26, 0.02]} />
            </mesh>
          )}
        </group>
      ))}
      {/* Head, with the hair cap the player himself wears. */}
      <mesh material={flatMat(PALETTE.suitSkin)} position={[0, 1.34, 0]}>
        <sphereGeometry args={[0.145, 8, 6]} />
      </mesh>
      <mesh material={flatMat(PALETTE.suitHair)} position={[0, 1.35, -0.008]}>
        <sphereGeometry args={[0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
      </mesh>
    </group>
  );
}

/** Voting — a ballot box with a paper half-posted, and the line to reach it. */
function BallotScene() {
  const voters = useRef<(THREE.Group | null)[]>([]);

  // Nobody stands perfectly still in a queue: each voter sways on their feet
  // at their own phase, decorrelated so the line never rocks in unison.
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    voters.current.forEach((voter, i) => {
      if (!voter) return;
      voter.rotation.z = Math.sin(t * 1.05 + i * 1.9) * 0.038;
      voter.rotation.x = Math.sin(t * 0.83 + i * 2.6) * 0.022;
    });
  });

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

      {/* The line of voters. Placement on the outer group, sway on the inner
          one, so the idle lean happens in each voter's own facing rather than
          the island's. */}
      {VOTERS.map((voter, i) => (
        <group
          key={i}
          position={[voter.x, 0, voter.z]}
          rotation={[0, voter.rotationY, 0]}
          scale={voter.scale}
        >
          <group
            ref={(node) => {
              voters.current[i] = node;
            }}
          >
            <Voter coat={voter.coat} posting={i === 0} />
          </group>
        </group>
      ))}
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
    case "ribbon":
      return <RibbonScene />;
  }
}
