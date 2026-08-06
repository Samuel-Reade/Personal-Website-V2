import { create } from "zustand";

/** Every clickable sign in the world maps to one of these panel ids. */
export type PanelId =
  | "rundown"
  | "connect"
  | "education"
  | "experience"
  | "projects"
  | "techstack"
  | "extracurriculars"
  | "interests";

/**
 * Each portal leads to its own world. "meadow" is the hub the player spawns
 * into; every other id is a self-contained scene living in its own module.
 */
export type WorldId = "meadow" | "experience" | "education" | "projects";

/**
 * Portals that have a world built behind them. Walking into one of these
 * transports the player; walking into any other portal falls back to opening
 * its content panel, which is what every portal did before worlds existed.
 */
export const WORLD_BY_PORTAL: Partial<Record<PanelId, WorldId>> = {
  experience: "experience",
  education: "education",
  projects: "projects",
};

/** Where the player stood in the meadow before stepping through a portal. */
export interface ReturnState {
  position: [number, number, number];
  facing: number;
}

interface WorldState {
  world: WorldId;
  /** Restored on exit so the player reappears where they left, not at spawn. */
  meadowReturn: ReturnState | null;
  activePanel: PanelId | null;
  /**
   * When set, a section panel narrows to the single entry matching this key.
   * The desk objects in the office each open one role rather than the whole
   * Experience list.
   */
  focusedEntry: string | null;
  openPanel: (id: PanelId) => void;
  openEntry: (id: PanelId, entry: string) => void;
  closePanel: () => void;
  enterWorld: (world: WorldId, from: ReturnState) => void;
  exitWorld: () => void;
}

/** Global state: which world is loaded, and which content panel is open in it. */
export const useStore = create<WorldState>((set) => ({
  world: "meadow",
  meadowReturn: null,
  activePanel: null,
  focusedEntry: null,
  openPanel: (id) => set({ activePanel: id, focusedEntry: null }),
  openEntry: (id, entry) => set({ activePanel: id, focusedEntry: entry }),
  closePanel: () => set({ activePanel: null, focusedEntry: null }),
  // Any panel left open in the old world is dropped, so arriving somewhere new
  // never starts with someone else's content covering the screen.
  enterWorld: (world, from) =>
    set({ world, meadowReturn: from, activePanel: null, focusedEntry: null }),
  exitWorld: () => set({ world: "meadow", activePanel: null, focusedEntry: null }),
}));
