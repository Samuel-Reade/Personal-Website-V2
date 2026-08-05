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

interface WorldState {
  activePanel: PanelId | null;
  openPanel: (id: PanelId) => void;
  closePanel: () => void;
}

/** Lightweight global state — only concerned with which content panel is open. */
export const useStore = create<WorldState>((set) => ({
  activePanel: null,
  openPanel: (id) => set({ activePanel: id }),
  closePanel: () => set({ activePanel: null }),
}));
