import * as THREE from "three";

/**
 * Where everything sits in the tech-stack system, and how fast it goes round.
 *
 * The four shells are a *visual* grouping — four legible rings at four radii.
 * The group each chip opens is a separate field, because the content in
 * `data/content.ts` is grouped by how a tool is actually used, which doesn't
 * line up one-to-one with the rings. Lovable and Base44 orbit in the AI ring
 * (that is what they are) but belong to "Web & Application Development" in the
 * resume (that is what they were used for), and clicking one should open the
 * group it genuinely belongs to rather than the ring it happens to be drawn in.
 */

/** Radius of the main planet the shells orbit. */
export const PLANET_RADIUS = 6;

/** Where the astronaut spawns — outside the outermost shell, facing the planet. */
export const SPAWN_POSITION: [number, number, number] = [0, 1.5, 34];
/** Facing -Z, so the planet and every ring are dead ahead at spawn. */
export const SPAWN_FACING = Math.PI;

/** The way home, behind the player at spawn so they turn around to find it. */
export const RETURN_PORTAL_POSITION: [number, number, number] = [0, 1.4, 44];

/**
 * How far from the origin the player may drift. Generous enough that the black
 * hole and the outer planets read as genuinely distant, tight enough that the
 * player can't fly out to where the system is a dot behind them.
 */
export const WORLD_RADIUS = 74;

export interface ChipSpec {
  /** Key into `getLogos()`. */
  logo: string;
  /**
   * The `TECH_STACK` group label this chip opens, verbatim from
   * `data/content.ts` — `TechStackContent` filters on it.
   */
  group: string;
}

export interface ShellSpec {
  /** Ring name, shown on the HUD legend. */
  label: string;
  radius: number;
  /** Tilt of the orbital plane, radians. */
  inclination: number;
  /**
   * Rotation of the tilt axis about Y. Without this every ring would tip in the
   * same direction and the four would still read as a stack of parallel plates.
   */
  node: number;
  /** Radians per second. Innermost is fastest, the way a real system works. */
  speed: number;
  /** Starting rotation, so the rings don't all begin with a chip at the same bearing. */
  phase: number;
  chips: ChipSpec[];
}

const LANGUAGES = "Languages";
const WEB = "Web & Application Development";
const AI = "AI & LLM Engineering";
const DATA = "Data Science & Machine Learning";
const CLOUD = "Cloud, Infrastructure & Deployment";
const PRODUCT = "Product & Analytics";

/**
 * Four shells, innermost to outermost. Radius, inclination, node and speed are
 * all staggered so no two rings share a plane or a cadence — four rings on the
 * same tilt at evenly-spaced radii read as one flat target, which is exactly
 * what this is meant to avoid.
 */
export const SHELLS: ShellSpec[] = [
  {
    label: "Languages",
    radius: 9.4,
    inclination: 0.1,
    node: 0,
    speed: 0.196,
    phase: 0,
    chips: [
      { logo: "python", group: LANGUAGES },
      { logo: "r", group: LANGUAGES },
      { logo: "typescript", group: LANGUAGES },
      { logo: "sql", group: LANGUAGES },
      // pandas and NumPy ride the languages ring because that is where they were
      // asked for, but they open the data group — they are Python libraries, not
      // languages, and the panel should say so.
      { logo: "pandas", group: DATA },
      { logo: "numpy", group: DATA },
    ],
  },
  {
    label: "Web & 3D",
    radius: 13.2,
    inclination: -0.42,
    node: 1.1,
    speed: 0.138,
    phase: 0.7,
    chips: [
      { logo: "react", group: WEB },
      { logo: "threejs", group: WEB },
      { logo: "vite", group: WEB },
      { logo: "vue", group: WEB },
      { logo: "fastapi", group: WEB },
    ],
  },
  {
    label: "AI & ML",
    radius: 17,
    inclination: 0.66,
    node: -0.8,
    speed: 0.098,
    phase: 1.9,
    chips: [
      { logo: "claude", group: AI },
      { logo: "langchain", group: AI },
      { logo: "catboost", group: DATA },
      { logo: "lovable", group: WEB },
      { logo: "base44", group: WEB },
      { logo: "scikitlearn", group: DATA },
      { logo: "jupyter", group: DATA },
    ],
  },
  {
    label: "Infra & Product",
    radius: 21.4,
    inclination: -0.24,
    node: 2.3,
    speed: 0.067,
    phase: 3.1,
    chips: [
      { logo: "aws", group: CLOUD },
      { logo: "azure", group: CLOUD },
      { logo: "terraform", group: CLOUD },
      { logo: "vercel", group: CLOUD },
      { logo: "github", group: CLOUD },
      { logo: "figma", group: PRODUCT },
      { logo: "amplitude", group: PRODUCT },
      { logo: "docker", group: CLOUD },
    ],
  },
];

/** 21 chips across the four shells. */
export const CHIP_COUNT = SHELLS.reduce((n, shell) => n + shell.chips.length, 0);

/** Evenly spaces a shell's chips around its ring. */
export function chipAngle(shell: ShellSpec, index: number): number {
  return shell.phase + (index / shell.chips.length) * Math.PI * 2;
}

/**
 * Keeps the astronaut inside the system and out of the planet, mutating in
 * place. This is the space equivalent of the meadow's circular boundary — the
 * only two things out here that can be collided with are the outer limit and the
 * planet's surface.
 */
export function resolveFloatMove(next: THREE.Vector3): void {
  const distance = next.length();

  // Outer limit: pull back onto the sphere rather than stopping dead, so
  // skimming the boundary slides along it instead of sticking.
  if (distance > WORLD_RADIUS) {
    next.multiplyScalar(WORLD_RADIUS / distance);
    return;
  }

  // The planet is solid. 1.6 of clearance keeps the third-person camera — which
  // trails behind and below the astronaut — from ending up inside the crust.
  const minimum = PLANET_RADIUS + 1.6;
  if (distance < minimum && distance > 0.0001) {
    next.multiplyScalar(minimum / distance);
  }
}

/** Smaller planets for parallax: closer than the stars, well outside the shells. */
export interface DistantPlanet {
  position: [number, number, number];
  radius: number;
  color: string;
  /** Second tone for the banding, so each body reads as more than a flat ball. */
  accent: string;
  ring?: boolean;
}

export const DISTANT_PLANETS: DistantPlanet[] = [
  { position: [-46, 14, -52], radius: 7.5, color: "#c2745a", accent: "#e0997c" },
  { position: [52, -12, -38], radius: 5.2, color: "#9a86c8", accent: "#bda9e4", ring: true },
  { position: [38, 22, 44], radius: 4.1, color: "#6fae9b", accent: "#8fd0bb" },
  { position: [-58, -18, 30], radius: 6.3, color: "#c9a86a", accent: "#e4c88f" },
  { position: [10, 34, -66], radius: 3.4, color: "#7f9bc4", accent: "#a3bade" },
];

/** The black hole, far off and well clear of anything the player can reach. */
export const BLACK_HOLE_POSITION: [number, number, number] = [-72, 26, -118];
export const BLACK_HOLE_RADIUS = 9;
