import { create } from "zustand";

/**
 * What the loading screen is actually waiting on.
 *
 * Every one of these is a real piece of work that has to finish before the hall
 * is ready to look at, reported by whoever finishes it — there is no timer here
 * pretending to be a download. Nothing is fetched from disk (see the 3D assets
 * note in the README), so the wait is type, geometry construction and shader
 * compilation rather than bytes over the wire.
 *
 * Only the entry hall is measured. The five worlds behind the meadow's portals
 * are separate lazy chunks that fetch on the way through a portal, so counting
 * them here would hold the door shut on rooms the visitor may never open.
 */
export const LOADING_STEPS = [
  { id: "fonts", label: "Setting the type" },
  { id: "geometry", label: "Building the hall" },
  { id: "shaders", label: "Compiling shaders" },
  { id: "frame", label: "Lighting the room" },
] as const;

export type LoadingStepId = (typeof LOADING_STEPS)[number]["id"];

interface LoadingState {
  done: Partial<Record<LoadingStepId, true>>;
  markDone: (id: LoadingStepId) => void;
}

export const useLoading = create<LoadingState>((set) => ({
  done: {},
  // Idempotent: `fonts` in particular can resolve twice under StrictMode's
  // double-mounted effects, and a step finishing again is not progress.
  markDone: (id) => set((state) => (state.done[id] ? state : { done: { ...state.done, [id]: true } })),
}));

/** 0 → 1 across the steps above. */
export function useLoadingProgress(): number {
  const done = useLoading((s) => s.done);
  return LOADING_STEPS.filter((step) => done[step.id]).length / LOADING_STEPS.length;
}

/**
 * The step being worked on — i.e. the first unfinished one. Steps don't
 * strictly run in order, but they do finish roughly in this order, and naming
 * the earliest outstanding one is what makes the bar legible rather than
 * flickering between whichever finished last.
 */
export function useLoadingLabel(): string {
  const done = useLoading((s) => s.done);
  return LOADING_STEPS.find((step) => !done[step.id])?.label ?? "Ready";
}
