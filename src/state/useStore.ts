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
 * Each portal leads to its own world. "mansion" is the entry hall the visitor
 * lands in, "meadow" is the hub of section portals one step beyond it; every
 * other id is a self-contained scene living in its own module.
 */
export type WorldId =
  | "mansion"
  | "meadow"
  | "experience"
  | "education"
  | "projects"
  | "techstack"
  | "interests"
  // The clearing behind the Extracurriculars portal. Named for what the balloons
  // on the hill stand for rather than for the portal, which still reads
  // "Extracurriculars" because that is what the résumé section is called.
  | "associations";

/**
 * What a portal in the meadow is called. Every section portal is named for the
 * panel it stands for; "hall" is the odd one out — it leads back to the room the
 * site opened in, which is a place rather than a résumé section and so has no
 * panel behind it.
 */
export type PortalId = PanelId | "hall";

/**
 * Portals that have a world built behind them. Walking into one of these
 * transports the player; walking into any other portal falls back to opening
 * its content panel, which is what every portal did before worlds existed.
 */
export const WORLD_BY_PORTAL: Partial<Record<PortalId, WorldId>> = {
  experience: "experience",
  education: "education",
  projects: "projects",
  techstack: "techstack",
  interests: "interests",
  extracurriculars: "associations",
  hall: "mansion",
};

/** Where the player stood in the meadow before stepping through a portal. */
export interface ReturnState {
  position: [number, number, number];
  facing: number;
}

interface WorldState {
  world: WorldId;
  /**
   * False until the visitor clicks through the loading screen. The entry hall
   * is mounted and rendering behind that screen the whole time — that is what
   * the progress bar is measuring — so this is what tells the hall's chrome,
   * its ambience and the controls key to hold off until someone is actually
   * looking at the room.
   */
  entered: boolean;
  /** Restored on exit so the player reappears where they left, not at spawn. */
  meadowReturn: ReturnState | null;
  /**
   * False only for the landing — the one arrival in the whole site that isn't
   * through a portal.
   *
   * Reade Hall is the only world that can be reached either way, and it wants a
   * different spawn for each: by the door for the walk down the hall the room is
   * composed around, and in front of its own portal for anyone stepping back
   * through from the meadow. Every other world is portal-only and ignores this.
   */
  arrivedByPortal: boolean;
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
  enter: () => void;
  enterWorld: (world: WorldId, from: ReturnState) => void;
  exitWorld: () => void;
}

/** Global state: which world is loaded, and which content panel is open in it. */
export const useStore = create<WorldState>((set) => ({
  world: "mansion",
  entered: false,
  meadowReturn: null,
  arrivedByPortal: false,
  activePanel: null,
  focusedEntry: null,
  openPanel: (id) => set({ activePanel: id, focusedEntry: null }),
  openEntry: (id, entry) => set({ activePanel: id, focusedEntry: entry }),
  closePanel: () => set({ activePanel: null, focusedEntry: null }),
  enter: () => set({ entered: true }),
  // Any panel left open in the old world is dropped, so arriving somewhere new
  // never starts with someone else's content covering the screen.
  enterWorld: (world, from) =>
    set({ world, meadowReturn: from, arrivedByPortal: true, activePanel: null, focusedEntry: null }),
  exitWorld: () =>
    set({ world: "meadow", arrivedByPortal: true, activePanel: null, focusedEntry: null }),
}));
