import {
  siClaude,
  siDocker,
  siFastapi,
  siFigma,
  siGithub,
  siJupyter,
  siNumpy,
  siPandas,
  siPython,
  siR,
  siReact,
  siTerraform,
  siThreedotjs,
  siTypescript,
  siVercel,
  siVite,
  siVuedotjs,
  type SimpleIcon,
} from "simple-icons";

/**
 * The brand marks that ride on the orbiting chips.
 *
 * Most come straight from the `simple-icons` package, which ships each mark as
 * a single SVG path on a 24x24 viewBox plus the brand's official hex — so the
 * logo geometry and its color come from one source of truth rather than being
 * transcribed by hand.
 *
 * The rest are authored below, on the same 24x24 grid so they extrude through
 * the identical pipeline and land at the same size as the real ones. They fall
 * into three kinds:
 *
 * - Marks Simple Icons doesn't carry, drawn as clean glyphs: SQL (a language,
 *   no brand mark), CatBoost, Lovable, Azure and Amazon (both pulled from the
 *   set over trademark policy — a search across all 3,453 icons returns
 *   nothing for either), Base44 and Amplitude.
 * - Marks it carries in a form that doesn't work here. Its LangChain is the
 *   retired chain-link, so the current pinwheel is vendored from svgl instead;
 *   its scikit-learn is a monochrome trace of the lockup, so the blobs and
 *   "learn" come from the project's own SVG in the same frame.
 * - Marks that are more than one color. A mark here is a list of *layers* —
 *   filled paths on one shared viewBox, each with its own fill — so AWS's white
 *   wordmark sits over its orange smile, Amplitude's white wave sits on its
 *   blue disc, and Hugging Face's face keeps its dark eyes and orange cheeks.
 *   Every layer of a mark is normalised together (see `logoGeometry.ts`), which
 *   is what keeps a coloured detail exactly where the original has it.
 */

/** One filled path of a mark. */
export interface LogoLayer {
  /** SVG path data on the mark's shared 24x24 viewBox. */
  path: string;
  /** Fill, `#rrggbb`. Rendered unlit so this is the exact on-screen hue. */
  color: string;
}

export interface LogoSpec {
  /** Display name — the hover label. */
  label: string;
  /**
   * Brand color, `#rrggbb`. The puck body takes a dimmed, desaturated cast of
   * it (see `Chip.tsx`), so a chip stays tied to its mark even when the mark
   * itself is several colors.
   */
  color: string;
  /** The mark, drawn back to front. Single-color marks are one layer. */
  layers: LogoLayer[];
  /**
   * Marks whose silhouette alone is unreadable at chip size get a light disc
   * behind them instead of sitting directly on the chip face. Set for the very
   * dark marks (GitHub, Vercel, Three.js) which would otherwise vanish into the
   * chip's own shadow side.
   */
  needsBacking?: boolean;
}

/**
 * Adapts a simple-icons record to a chip spec, taking the brand hex with it.
 *
 * The icons are imported by name rather than pulled off a namespace by string.
 * A namespace import with a dynamic lookup is unshakeable by the bundler — it
 * cannot prove which keys are read, so all 3,453 icons end up in the bundle,
 * which measured at roughly 4MB of dead weight. Naming the seventeen lets Rollup
 * drop the rest, and turns a brand that disappears in a future major into a
 * build error instead of a blank chip at runtime.
 */
function fromSimpleIcons(icon: SimpleIcon, label?: string, needsBacking?: boolean): LogoSpec {
  const color = `#${icon.hex}`;
  return {
    label: label ?? icon.title,
    color,
    layers: [{ path: icon.path, color }],
    needsBacking,
  };
}

/** A single-color mark authored by hand. */
function mono(label: string, color: string, path: string): LogoSpec {
  return { label, color, layers: [{ path, color }] };
}

/**
 * Marks that don't come from Simple Icons, on the same 24x24 grid.
 *
 * The glyph-style ones (SQL, CatBoost, Lovable, Azure) are deliberately simple,
 * legible-at-distance shapes rather than attempts at pixel-exact brand
 * reproductions: a chip is a couple of hundred pixels on screen at best, and an
 * inexact trace of a logo reads worse than a clean abstraction of it. The rest
 * are the real marks — vendored, traced from the brand's own artwork, or built
 * from measured geometry — because each of those is recognisable only as
 * itself.
 */
const HAND_DRAWN: Record<string, LogoSpec> = {
  // Stacked database platters — the universal shorthand for a relational store.
  sql: mono(
    "SQL",
    "#e38c00",
    "M12 2c-4.4 0-8 1.1-8 2.5v3C4 8.9 7.6 10 12 10s8-1.1 8-2.5v-3C20 3.1 16.4 2 12 2zm0 1.6c3.7 0 6.4.9 6.4 1.4S15.7 6.4 12 6.4 5.6 5.5 5.6 5 8.3 3.6 12 3.6zM4 9.4v3.1c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V9.4c-1.7 1.1-4.7 1.7-8 1.7s-6.3-.6-8-1.7zm0 5.1v3c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-3c-1.7 1.1-4.7 1.7-8 1.7s-6.3-.6-8-1.7z"
  ),
  // Three ascending bars under a boosted trend line — trees getting better. The
  // arrow is one closed outline, shaft and head together, and passes clear above
  // the bars rather than cutting across their tops.
  catboost: mono(
    "CatBoost",
    "#ffcc00",
    "M2.4 15.4L6.8 15.4L6.8 21.4L2.4 21.4Z" +
      "M9.8 11.9L14.2 11.9L14.2 21.4L9.8 21.4Z" +
      "M17.2 8.4L21.6 8.4L21.6 21.4L17.2 21.4Z" +
      "M2.99 13.36L18.58 5.39L19.33 6.86L21.4 3L17.06 2.41L17.81 3.88L2.21 11.84Z"
  ),
  // A heart, for the app builder whose whole identity is one.
  lovable: mono(
    "Lovable",
    "#ff4d82",
    "M12 21.4l-1.5-1.35C5.2 15.3 2 12.4 2 8.8 2 5.9 4.3 3.6 7.2 3.6c1.6 0 3.2.76 4.2 1.97 1-1.21 2.6-1.97 4.2-1.97C18.7 3.6 21 5.9 21 8.8c0 3.6-3.2 6.5-8.5 11.26L12 21.4z"
  ),
  // Base44's sun: an orange disc with three horizontal cuts through its lower
  // half, so the bottom reads as a sunset over water. Measured off the brand
  // artwork — the cuts sit at 8–21%, 38–51% and 68–81% of the radius below
  // centre — and built as four disc slices whose sides follow the circle, so the
  // gaps between them are the negative space rather than shapes of their own.
  base44: mono(
    "Base44",
    "#fd9846",
    "M0.04 12.99C-0.33 8.48 1.86 4.14 5.72 1.78C9.57 -0.59 14.43 -0.59 18.28 1.78" +
      "C22.14 4.14 24.33 8.48 23.96 12.99ZM0.26 14.47L23.74 14.47C23.59 15.2 23.37 15.91 23.08 16.6" +
      "L0.92 16.6C0.63 15.91 0.41 15.2 0.26 14.47ZM1.66 18.08L22.34 18.08" +
      "C21.89 18.85 21.35 19.57 20.74 20.22L3.26 20.22C2.65 19.57 2.11 18.85 1.66 18.08ZM19.07 21.7" +
      "C14.86 24.77 9.14 24.77 4.93 21.7Z"
  ),
  // The Azure trapezoid: the "A" chevron reduced to its two folded planes. The
  // larger plane's fold used to double back across its own right edge, which
  // triangulated into a stray shard hanging off the bottom corner.
  azure: mono(
    "Azure",
    "#0089d6",
    "M8.9 2.6L13.1 2.6L6.7 16.5L2.3 16.5Z" + "M14.1 4.9L22.3 21.1L7.2 21.1L16.2 19.3L11.5 13.7Z"
  ),
  // LangChain's current mark — the four-blade pinwheel it moved to in 2025 —
  // vendored from svgl (svgl.app/library/langchain-logo.svg), on its native
  // 24x24 grid and in the brand's own #7fc8ff. Simple Icons still ships the
  // retired chain-link under this name.
  langchain: mono(
    "LangChain",
    "#7fc8ff",
    "M7.531 15.976a7.534 7.534 0 0 0 0-10.651L2.206 0A7.54 7.54 0 0 0 0 5.326" +
      "c0 1.996.794 3.913 2.206 5.325zm11.143.493a7.535 7.535 0 0 0-10.65 0l5.325 5.325" +
      "a7.536 7.536 0 0 0 10.651 0zM2.218 21.782a7.54 7.54 0 0 0 5.326 2.206v-7.531H.012" +
      "c0 1.996.795 3.914 2.206 5.325M20.73 8.595a7.534 7.534 0 0 0-10.651.001l5.325 5.326z"
  ),
  // The AWS lockup: the lowercase wordmark over the smile-arrow, taken from
  // svgl's on-dark variant so the wordmark is white — on the puck's navy that is
  // the version AWS itself uses against dark ground. The smile and its arrowhead
  // are one orange layer; the wordmark is a second, white one.
  aws: {
    label: "AWS",
    color: "#232f3e",
    layers: [
      {
        color: "#ffffff",
        path:
          "M6.71 10.01L6.87 10.73C6.87 10.97 6.95 11.13 7.11 11.37L7.11 11.53L7.03 11.77L6.47 12.09L6.31 12.17" +
          "L6.07 12.09L5.75 11.69L5.51 11.21C4.87 11.93 4.07 12.33 3.19 12.33C2.47 12.33 1.91 12.09 1.59 11.69" +
          "C1.19 11.37 0.95 10.81 0.95 10.17C0.95 9.53 1.19 8.97 1.67 8.58C2.15 8.1 2.79 7.94 3.67 7.94" +
          "C4.27 7.93 4.86 8.01 5.43 8.18L5.43 7.62C5.43 6.98 5.27 6.58 5.03 6.34C4.79 6.02 4.39 5.94 3.75 5.94" +
          "L2.87 6.02C2.49 6.12 2.11 6.25 1.75 6.42L1.59 6.42C1.51 6.42 1.43 6.34 1.43 6.18L1.43 5.78L1.51 5.54" +
          "C1.51 5.46 1.59 5.38 1.75 5.38L2.71 4.98L3.99 4.82C4.95 4.82 5.59 5.06 6.07 5.46" +
          "C6.47 5.94 6.71 6.58 6.71 7.46L6.71 10.01ZM3.51 11.29L4.31 11.13C4.63 11.05 4.87 10.81 5.11 10.57" +
          "L5.35 10.09L5.43 9.37L5.43 9.05C4.93 8.94 4.42 8.89 3.91 8.89C3.43 8.89 3.03 8.97 2.71 9.21" +
          "C2.47 9.37 2.39 9.69 2.39 10.09C2.39 10.49 2.47 10.73 2.63 10.97C2.87 11.13 3.11 11.29 3.51 11.29Z" +
          "M9.91 12.09L9.59 12.01L9.43 11.77L7.59 5.54L7.51 5.22L7.67 5.06L8.47 5.06L8.79 5.14L8.95 5.46" +
          "L10.31 10.73L11.51 5.46L11.67 5.14L11.99 5.06L12.62 5.06L12.94 5.14L13.1 5.46L14.38 10.81L15.74 5.46" +
          "L15.9 5.14L16.22 5.06L16.94 5.06C17.1 5.06 17.18 5.14 17.18 5.22L17.18 5.38L17.1 5.54L15.18 11.77" +
          "L15.02 12.09L14.7 12.17L13.98 12.17L13.66 12.09L13.58 11.77L12.31 6.58L11.11 11.69L10.95 12.01" +
          "L10.63 12.09L9.91 12.09ZM20.22 12.33C19.47 12.33 18.74 12.16 18.06 11.85L17.82 11.61L17.74 11.45" +
          "L17.74 11.05C17.74 10.89 17.82 10.81 17.9 10.81L18.06 10.81L18.3 10.89" +
          "C18.88 11.16 19.51 11.3 20.14 11.29C20.62 11.29 21.02 11.13 21.26 10.97" +
          "C21.58 10.81 21.66 10.57 21.66 10.25L21.5 9.69L20.7 9.29L19.5 8.89C18.94 8.74 18.46 8.42 18.22 8.1" +
          "C17.91 7.68 17.77 7.16 17.85 6.65C17.92 6.14 18.2 5.68 18.62 5.38L19.42 4.98" +
          "C19.93 4.8 20.48 4.75 21.02 4.82C21.34 4.88 21.66 4.96 21.98 5.06L22.3 5.22L22.54 5.38L22.62 5.7" +
          "L22.62 6.02C22.62 6.26 22.54 6.34 22.46 6.34L22.14 6.18C21.66 6.02 21.18 5.94 20.62 5.94" +
          "C20.14 5.94 19.74 5.94 19.5 6.1C19.26 6.26 19.18 6.5 19.18 6.82C19.18 7.06 19.26 7.22 19.42 7.38" +
          "C19.58 7.54 19.82 7.7 20.3 7.86L21.42 8.18C21.98 8.42 22.38 8.66 22.62 8.97" +
          "C22.86 9.29 23.02 9.69 23.02 10.09L22.78 11.05L22.22 11.69C21.98 11.93 21.66 12.09 21.34 12.17" +
          "L20.22 12.33Z",
      },
      {
        color: "#ff9900",
        path:
          "M21.74 16.25C15.03 20.73 6.13 20.07 0.15 14.65C-0.17 14.41 0.07 14.17 0.31 14.33" +
          "C6.75 17.98 14.51 18.45 21.34 15.61C21.74 15.45 22.14 15.93 21.74 16.25ZM22.78 14.97" +
          "C22.46 14.57 20.54 14.73 19.74 14.89C19.42 14.89 19.42 14.65 19.66 14.49" +
          "C21.18 13.45 23.66 13.77 23.9 14.09C24.22 14.49 23.82 16.97 22.46 18.17" +
          "C22.22 18.33 21.98 18.25 22.06 18.01C22.46 17.21 23.1 15.37 22.78 14.97Z",
      },
    ],
  },
  // Amplitude's mark is a white "A" that is also a wave — one rounded peak, a
  // trough that hooks back up, and a bar through the middle — set on a blue
  // disc. The wave was traced from the brand artwork: its centreline fitted as
  // a smoothing spline through the stroke and swept out at the measured stroke
  // width with round caps, the bar as a stadium of the same weight. Disc, wave
  // and bar are three layers so the two white strokes can cross without a
  // coplanar seam.
  amplitude: {
    label: "Amplitude",
    color: "#14159d",
    layers: [
      {
        color: "#14159d",
        path:
          "M24 12C24 18.63 18.63 24 12 24C5.37 24 0 18.63 0 12C0 5.37 5.37 0 12 0C18.63 0 24 5.37 24 12Z",
      },
      {
        color: "#ffffff",
        path:
          "M6.49 15.53L8.84 7.95L9.53 6.24L9.95 5.5L10.26 5.16L10.2 5.16L10.73 5.82L11.33 7.11L12.04 9.15" +
          "L14.24 16.23L14.94 17.91L15.63 18.96L16.3 19.41L16.7 19.49L17.1 19.45L17.81 19.04L18.46 18.19" +
          "L19.34 16.23L19.94 14.36L20.01 13.93L19.92 13.67L19.74 13.45L19.5 13.32L19.22 13.3L18.95 13.38" +
          "L18.74 13.56L18.61 13.81L17.62 16.68L17.14 17.6L16.73 18.07L16.18 17.18L15.55 15.66L13.29 8.34" +
          "L12.35 5.84L11.79 4.82L11.24 4.16L10.69 3.82L10.09 3.74L9.69 3.85L9.27 4.11L8.84 4.59L8.43 5.25" +
          "L7.63 7.1L6.65 10.05L5.1 15.38L5.17 15.65L5.35 15.86L5.59 16L5.87 16.03L6.14 15.95L6.35 15.78Z",
      },
      {
        color: "#ffffff",
        path:
          "M3.84 12.28L20.2 12.35L20.49 12.29L20.73 12.13L20.89 11.89L20.95 11.61L20.9 11.32L20.74 11.08" +
          "L20.5 10.92L20.21 10.86L3.84 10.79L3.56 10.84L3.32 11L3.15 11.24L3.1 11.53L3.15 11.81L3.31 12.06" +
          "L3.55 12.22Z",
      },
    ],
  },
  // scikit-learn's full lockup, in color: the orange and blue blobs and the
  // black "learn" script are the project's own SVG (doc/logos in the
  // scikit-learn repo) normalised into Simple Icons' frame — the two agree to a
  // hundredth — and the small white "scikit" is Simple Icons' letterforms,
  // which land exactly where the original's live text does. Simple Icons' own
  // path is a one-color trace with the lettering carved out as holes, which is
  // why it isn't used whole. Wide (24 by 13), so it sits as a lockup on the
  // face rather than filling it.
  scikitlearn: {
    label: "scikit-learn",
    color: "#f7931e",
    layers: [
      {
        color: "#f89939",
        path:
          "M18.408 16.527C21.34 13.595 21.827 9.331 19.497 7C17.167 4.671 12.902 5.158 9.971 8.089" +
          "C7.04 11.019 7.888 16.619 8.883 17.615C9.687 18.419 15.478 19.457 18.408 16.527Z",
      },
      {
        color: "#3499cd",
        path:
          "M6.381 12.291C4.681 10.591 2.206 10.308 0.854 11.66C-0.498 13.012 -0.215 15.487 1.485 17.187" +
          "C3.186 18.888 6.435 18.396 7.012 17.818C7.479 17.352 8.082 13.992 6.381 12.291Z",
      },
      {
        color: "#111111",
        path:
          "M12.248 15.808C11.948 16.085 11.685 16.289 11.458 16.42C11.232 16.551 11.016 16.617 10.81 16.617" +
          "C10.574 16.617 10.383 16.525 10.238 16.342C10.093 16.158 10.021 15.912 10.021 15.603" +
          "C10.021 15.139 10.122 14.582 10.323 13.932C10.524 13.282 10.768 12.683 11.055 12.135L11.897 11.824" +
          "C11.924 11.815 11.944 11.81 11.957 11.81C12.021 11.81 12.074 11.857 12.114 11.951" +
          "C12.155 12.045 12.176 12.172 12.176 12.331C12.176 12.782 12.072 13.218 11.864 13.64" +
          "C11.656 14.063 11.331 14.513 10.89 14.993C10.872 15.223 10.863 15.38 10.863 15.467" +
          "C10.863 15.659 10.898 15.811 10.969 15.924C11.04 16.037 11.134 16.093 11.251 16.093" +
          "C11.37 16.093 11.497 16.05 11.632 15.964C11.767 15.878 11.972 15.699 12.248 15.427L12.248 15.808Z" +
          "M10.979 14.512C11.26 14.2 11.487 13.85 11.662 13.463C11.836 13.076 11.924 12.743 11.924 12.464" +
          "C11.924 12.382 11.912 12.316 11.887 12.267C11.863 12.217 11.832 12.192 11.794 12.192" +
          "C11.713 12.192 11.594 12.395 11.438 12.803C11.282 13.21 11.129 13.78 10.979 14.512ZM14.728 15.808" +
          "C14.448 16.085 14.196 16.289 13.972 16.42C13.749 16.551 13.503 16.617 13.233 16.617" +
          "C12.933 16.617 12.69 16.521 12.505 16.329C12.321 16.136 12.229 15.883 12.229 15.57" +
          "C12.229 15.101 12.391 14.677 12.716 14.298C13.041 13.919 13.401 13.73 13.797 13.73" +
          "C14.002 13.73 14.167 13.783 14.291 13.889C14.415 13.995 14.476 14.134 14.476 14.307" +
          "C14.476 14.764 13.99 15.135 13.018 15.42C13.106 15.851 13.337 16.067 13.711 16.067" +
          "C13.857 16.067 13.996 16.028 14.128 15.949C14.261 15.871 14.461 15.697 14.728 15.427L14.728 15.808Z" +
          "M12.991 15.195C13.557 15.036 13.84 14.742 13.84 14.313C13.84 14.101 13.762 13.995 13.608 13.995" +
          "C13.462 13.995 13.323 14.106 13.19 14.328C13.057 14.55 12.991 14.839 12.991 15.195ZM18.268 15.808" +
          "C17.915 16.144 17.662 16.363 17.509 16.465C17.357 16.566 17.211 16.617 17.072 16.617" +
          "C16.723 16.617 16.558 16.309 16.578 15.692C16.357 16.008 16.153 16.241 15.966 16.392" +
          "C15.78 16.542 15.587 16.617 15.388 16.617C15.193 16.617 15.028 16.526 14.892 16.344" +
          "C14.756 16.161 14.688 15.938 14.688 15.672C14.688 15.341 14.779 15.025 14.962 14.724" +
          "C15.144 14.424 15.378 14.181 15.663 13.995C15.948 13.81 16.2 13.717 16.418 13.717" +
          "C16.695 13.717 16.888 13.844 16.999 14.098L17.676 13.723L17.862 13.723L17.57 14.695" +
          "C17.419 15.183 17.344 15.518 17.344 15.699C17.344 15.889 17.411 15.984 17.546 15.984" +
          "C17.632 15.984 17.727 15.938 17.831 15.846C17.935 15.755 18.08 15.615 18.268 15.427L18.268 15.808Z" +
          "M15.842 15.991C16.063 15.991 16.271 15.802 16.467 15.426C16.663 15.049 16.76 14.701 16.76 14.383" +
          "C16.76 14.259 16.732 14.162 16.677 14.093C16.622 14.023 16.548 13.988 16.455 13.988" +
          "C16.234 13.988 16.025 14.176 15.827 14.552C15.63 14.928 15.53 15.274 15.53 15.589" +
          "C15.53 15.709 15.56 15.805 15.618 15.88C15.677 15.954 15.751 15.991 15.842 15.991ZM20.745 15.808" +
          "C20.19 16.352 19.762 16.624 19.462 16.624C19.327 16.624 19.213 16.567 19.12 16.453" +
          "C19.028 16.339 18.981 16.198 18.981 16.03C18.981 15.719 19.148 15.301 19.482 14.777" +
          "C19.318 14.861 19.139 14.92 18.945 14.953C18.801 15.218 18.576 15.503 18.268 15.808L18.192 15.808" +
          "L18.192 15.51C18.365 15.331 18.52 15.139 18.66 14.933C18.469 14.849 18.375 14.724 18.375 14.559" +
          "C18.375 14.388 18.432 14.207 18.549 14.013C18.665 13.82 18.824 13.723 19.028 13.723" +
          "C19.2 13.723 19.286 13.811 19.286 13.988C19.286 14.128 19.236 14.326 19.137 14.585" +
          "C19.504 14.545 19.824 14.265 20.098 13.743L20.4 13.73L20.092 14.578" +
          "C19.963 14.936 19.881 15.18 19.843 15.309C19.806 15.438 19.787 15.553 19.787 15.652" +
          "C19.787 15.745 19.808 15.82 19.851 15.874C19.894 15.93 19.952 15.957 20.025 15.957" +
          "C20.105 15.957 20.181 15.93 20.254 15.876C20.327 15.822 20.491 15.672 20.745 15.427L20.745 15.808Z" +
          "M24 15.808C23.49 16.348 23.052 16.617 22.687 16.617C22.539 16.617 22.42 16.565 22.329 16.461" +
          "C22.238 16.357 22.193 16.218 22.193 16.044C22.193 15.807 22.291 15.446 22.485 14.96" +
          "C22.589 14.699 22.641 14.533 22.641 14.463C22.641 14.392 22.613 14.356 22.558 14.356" +
          "C22.527 14.356 22.486 14.372 22.435 14.403C22.389 14.434 22.335 14.477 22.273 14.532" +
          "C22.218 14.583 22.156 14.645 22.087 14.718C22.027 14.78 21.963 14.851 21.895 14.93L21.709 15.146" +
          "C21.628 15.245 21.577 15.35 21.557 15.46C21.524 15.648 21.502 15.821 21.49 15.978" +
          "C21.484 16.095 21.48 16.252 21.48 16.452L20.748 16.624C20.724 16.325 20.711 16.103 20.711 15.958" +
          "C20.711 15.602 20.753 15.265 20.836 14.947C20.919 14.628 21.052 14.27 21.235 13.872L22.044 13.717" +
          "C21.874 14.174 21.762 14.534 21.709 14.797C22.072 14.393 22.359 14.113 22.572 13.957" +
          "C22.785 13.801 22.974 13.723 23.139 13.723C23.252 13.723 23.346 13.766 23.421 13.851" +
          "C23.496 13.936 23.533 14.042 23.533 14.17C23.533 14.382 23.438 14.731 23.249 15.218" +
          "C23.118 15.551 23.053 15.768 23.053 15.868C23.053 16.001 23.107 16.067 23.216 16.067" +
          "C23.377 16.067 23.639 15.854 24 15.427Z",
      },
      {
        color: "#ffffff",
        path:
          "M15.401 11.164L15.567 11.164L15.567 11.374L15.4 11.374ZM15.828 11.164L15.994 11.164L15.994 12.029" +
          "L16.454 11.574L16.649 11.574L16.285 11.936L16.713 12.62L16.515 12.62L16.158 12.045L15.994 12.211" +
          "L15.994 12.621L15.828 12.621ZM16.844 11.164L17.01 11.164L17.01 11.374L16.844 11.374ZM17.325 11.286" +
          "L17.491 11.286L17.491 11.574L17.663 11.574L17.663 11.709L17.491 11.709L17.491 12.426" +
          "C17.491 12.463 17.497 12.488 17.511 12.501C17.523 12.514 17.548 12.521 17.585 12.521" +
          "C17.611 12.522 17.638 12.519 17.663 12.511L17.663 12.652C17.618 12.661 17.573 12.665 17.527 12.666" +
          "C17.474 12.67 17.42 12.654 17.377 12.623C17.341 12.592 17.322 12.547 17.325 12.5L17.325 11.71" +
          "L17.184 11.71L17.184 11.574L17.325 11.574ZM13.763 11.544C13.844 11.544 13.913 11.556 13.97 11.582" +
          "C14.027 11.606 14.07 11.643 14.1 11.692C14.13 11.741 14.145 11.798 14.145 11.865L13.969 11.865" +
          "C13.963 11.754 13.894 11.698 13.761 11.698C13.703 11.695 13.646 11.709 13.597 11.739" +
          "C13.558 11.765 13.535 11.809 13.537 11.856C13.537 11.891 13.552 11.921 13.582 11.944" +
          "C13.612 11.968 13.662 11.988 13.732 12.004L13.892 12.043C13.975 12.057 14.052 12.094 14.116 12.148" +
          "C14.163 12.194 14.186 12.256 14.186 12.334C14.187 12.396 14.169 12.457 14.134 12.509" +
          "C14.096 12.562 14.043 12.602 13.982 12.625C13.91 12.653 13.833 12.667 13.756 12.666" +
          "C13.62 12.666 13.516 12.636 13.447 12.578C13.378 12.519 13.342 12.429 13.338 12.309L13.514 12.309" +
          "C13.518 12.346 13.524 12.374 13.531 12.393C13.539 12.413 13.55 12.431 13.565 12.447" +
          "C13.609 12.49 13.677 12.512 13.769 12.512C13.831 12.515 13.893 12.499 13.946 12.467" +
          "C13.988 12.442 14.013 12.397 14.013 12.348C14.014 12.314 14 12.281 13.975 12.258" +
          "C13.939 12.23 13.896 12.211 13.851 12.203L13.695 12.165C13.641 12.152 13.588 12.135 13.536 12.115" +
          "C13.5 12.1 13.467 12.079 13.438 12.054C13.412 12.031 13.393 12.003 13.38 11.971" +
          "C13.369 11.936 13.363 11.9 13.364 11.863C13.364 11.767 13.4 11.689 13.473 11.631" +
          "C13.557 11.569 13.659 11.539 13.763 11.544ZM14.798 11.544C14.868 11.543 14.937 11.558 15 11.587" +
          "C15.089 11.628 15.157 11.705 15.187 11.799C15.199 11.84 15.207 11.882 15.21 11.925L15.042 11.925" +
          "C15.038 11.861 15.01 11.801 14.964 11.757C14.917 11.716 14.856 11.694 14.794 11.697" +
          "C14.738 11.696 14.684 11.713 14.639 11.747C14.592 11.784 14.558 11.834 14.539 11.891" +
          "C14.515 11.963 14.503 12.039 14.505 12.115C14.503 12.188 14.515 12.261 14.54 12.329" +
          "C14.56 12.383 14.595 12.43 14.641 12.464C14.687 12.496 14.742 12.513 14.798 12.512" +
          "C14.94 12.512 15.025 12.428 15.054 12.26L15.221 12.26C15.216 12.337 15.194 12.412 15.156 12.48" +
          "C15.122 12.539 15.071 12.587 15.01 12.618C14.943 12.651 14.869 12.668 14.794 12.666" +
          "C14.707 12.668 14.622 12.645 14.548 12.6C14.477 12.553 14.421 12.486 14.387 12.408" +
          "C14.347 12.316 14.328 12.216 14.33 12.115C14.33 12.03 14.34 11.952 14.362 11.882" +
          "C14.381 11.816 14.414 11.754 14.457 11.7C14.497 11.65 14.548 11.609 14.607 11.583" +
          "C14.667 11.556 14.732 11.542 14.798 11.543ZM15.401 11.574L15.567 11.574L15.567 12.62L15.4 12.62Z" +
          "M16.844 11.574L17.01 11.574L17.01 12.62L16.844 12.62Z",
      },
    ],
  },
  // Hugging Face's face, from Simple Icons' path split into its parts and
  // recolored: face and hands in the brand yellow, the cheeks in its deeper
  // orange, and the eyes and open mouth in the dark it draws them in. As one
  // yellow layer the features would be holes onto the puck; on their own layer
  // they are the same shapes, filled.
  huggingface: {
    label: "Hugging Face",
    color: "#ffd21e",
    layers: [
      {
        color: "#ffd21e",
        path:
          "M12.025 1.13C6.255 1.13 1.576 5.777 1.576 11.508C1.576 12.62 1.754 13.689 2.079 14.693" +
          "C2.143 14.471 2.282 14.249 2.495 14.116C2.652 14.016 2.834 13.964 3.019 13.966" +
          "C3.312 13.966 3.603 14.09 3.859 14.25C4.137 14.423 4.339 14.658 4.569 14.944" +
          "C4.795 15.226 5.027 15.555 5.253 15.895L5.253 15.881C5.27 15.557 5.359 15.259 5.517 15.007" +
          "C5.675 14.755 5.92 14.52 6.279 14.464C6.579 14.417 6.875 14.524 7.066 14.667" +
          "C7.257 14.81 7.376 14.98 7.466 15.134C7.616 15.391 7.678 15.602 7.699 15.676" +
          "C7.709 15.702 8.352 17.228 9.356 18.216C9.972 18.821 10.366 19.439 10.438 20.128" +
          "C10.493 20.665 10.342 21.187 10.058 21.7C10.695 21.821 11.352 21.887 12.025 21.887" +
          "C12.682 21.887 13.323 21.824 13.946 21.709C13.659 21.192 13.506 20.668 13.562 20.128" +
          "C13.632 19.438 14.027 18.821 14.643 18.215C15.647 17.228 16.29 15.702 16.3 15.676" +
          "C16.321 15.602 16.383 15.391 16.533 15.134C16.623 14.98 16.741 14.811 16.933 14.667" +
          "C17.159 14.499 17.441 14.427 17.72 14.464C18.079 14.52 18.324 14.754 18.482 15.007" +
          "C18.64 15.26 18.729 15.557 18.747 15.881L18.747 15.896C18.972 15.556 19.204 15.226 19.43 14.944" +
          "C19.66 14.658 19.862 14.424 20.14 14.25C20.397 14.09 20.687 13.966 20.98 13.965" +
          "C21.166 13.964 21.347 14.017 21.504 14.116C21.732 14.259 21.877 14.504 21.934 14.741L21.94 14.781" +
          "C22.294 13.726 22.474 12.621 22.474 11.508C22.474 5.777 17.796 1.13 12.025 1.13ZM9.325 21.812" +
          "C10.149 20.622 10.091 19.73 8.96 18.618C7.83 17.506 7.171 15.88 7.171 15.88" +
          "C7.171 15.88 6.925 14.935 6.365 15.022C5.805 15.109 5.395 16.521 6.567 17.384" +
          "C7.74 18.248 6.334 18.834 5.882 18.024C5.432 17.212 4.199 15.128 3.56 14.729" +
          "C2.921 14.33 2.471 14.554 2.622 15.376C2.773 16.198 5.444 18.189 5.184 18.62" +
          "C4.924 19.051 4.008 18.114 4.008 18.114C4.008 18.114 1.142 15.547 0.518 16.216" +
          "C-0.106 16.885 0.991 17.446 2.555 18.376C4.119 19.308 4.241 19.554 4.019 19.906" +
          "C3.797 20.258 0.344 17.395 0.019 18.609C-0.304 19.823 3.543 20.176 3.306 21.014" +
          "C3.068 21.853 0.596 19.427 0.09 20.372C-0.416 21.318 3.58 22.428 3.612 22.436" +
          "C4.902 22.766 8.18 23.464 9.325 21.812ZM14.674 21.812C13.85 20.622 13.908 19.73 15.039 18.618" +
          "C16.169 17.506 16.828 15.88 16.828 15.88C16.828 15.88 17.074 14.935 17.634 15.022" +
          "C18.194 15.109 18.604 16.521 17.432 17.384C16.259 18.248 17.665 18.834 18.117 18.024" +
          "C18.568 17.212 19.8 15.128 20.439 14.729C21.078 14.33 21.528 14.554 21.377 15.376" +
          "C21.226 16.198 18.555 18.189 18.815 18.62C19.075 19.051 19.991 18.114 19.991 18.114" +
          "C19.991 18.114 22.857 15.547 23.481 16.216C24.105 16.885 23.008 17.446 21.444 18.376" +
          "C19.88 19.308 19.758 19.554 19.98 19.906C20.202 20.258 23.655 17.395 23.98 18.609" +
          "C24.303 19.823 20.456 20.176 20.693 21.014C20.931 21.853 23.403 19.427 23.909 20.372" +
          "C24.415 21.318 20.419 22.428 20.387 22.436C19.097 22.766 15.819 23.464 14.674 21.812Z",
      },
      {
        color: "#ffac03",
        path:
          "M5.134 8.133C5.664 8.133 6.094 8.563 6.094 9.093C6.094 9.624 5.664 10.054 5.134 10.054" +
          "C4.604 10.054 4.174 9.624 4.174 9.094C4.174 8.564 4.604 8.134 5.134 8.134ZM18.972 8.134" +
          "C19.502 8.134 19.932 8.564 19.932 9.094C19.932 9.624 19.502 10.054 18.972 10.054" +
          "C18.442 10.054 18.012 9.624 18.012 9.094C18.012 8.564 18.442 8.134 18.972 8.134Z",
      },
      {
        color: "#3a3b45",
        path:
          "M8.327 6.583C8.575 6.581 8.82 6.641 9.04 6.757C9.389 6.942 9.65 7.258 9.766 7.636" +
          "C9.882 8.013 9.843 8.421 9.657 8.77C9.474 9.113 8.895 8.556 8.555 8.676" +
          "C8.175 8.81 8.023 9.59 7.638 9.386C7.033 9.068 6.723 8.378 6.886 7.715" +
          "C7.05 7.051 7.645 6.584 8.328 6.583ZM15.814 6.583C16.497 6.585 17.092 7.052 17.255 7.715" +
          "C17.418 8.379 17.108 9.068 16.503 9.386C16.118 9.59 15.967 8.81 15.587 8.676" +
          "C15.247 8.556 14.667 9.113 14.484 8.77C14.298 8.421 14.259 8.013 14.375 7.636" +
          "C14.491 7.258 14.752 6.942 15.101 6.757C15.321 6.641 15.566 6.581 15.814 6.583ZM8.489 11.458" +
          "C9.077 11.468 10.454 12.615 12.061 12.622C13.668 12.615 15.045 11.467 15.633 11.458" +
          "C15.829 11.455 15.938 11.578 15.938 11.912C15.938 12.798 15.514 14.24 14.375 15.114" +
          "C14.155 14.358 12.979 13.748 12.745 13.794C12.738 13.795 12.731 13.797 12.725 13.8L12.681 13.826" +
          "L12.671 13.834L12.641 13.858C12.629 13.869 12.617 13.881 12.606 13.894L12.574 13.934" +
          "C12.553 13.963 12.534 13.993 12.516 14.024L12.502 14.049C12.469 14.108 12.433 14.171 12.392 14.239" +
          "C12.367 14.28 12.339 14.318 12.309 14.355C12.258 14.421 12.2 14.481 12.136 14.535" +
          "C12.113 14.554 12.088 14.574 12.061 14.593C11.967 14.524 11.882 14.442 11.81 14.35" +
          "C11.782 14.316 11.757 14.28 11.734 14.243C11.61 14.05 11.557 13.88 11.397 13.799" +
          "C11.363 13.783 11.293 13.791 11.197 13.821C11.134 13.841 11.062 13.87 10.981 13.908" +
          "C10.941 13.927 10.899 13.948 10.856 13.971L10.726 14.045C10.681 14.072 10.636 14.1 10.59 14.131" +
          "C10.544 14.162 10.499 14.194 10.455 14.227C10.364 14.295 10.277 14.368 10.195 14.446" +
          "C10.153 14.485 10.113 14.525 10.075 14.567C10.038 14.608 10.003 14.651 9.969 14.695L9.967 14.697" +
          "C9.935 14.74 9.905 14.784 9.877 14.829L9.876 14.83C9.834 14.897 9.799 14.968 9.771 15.042" +
          "C9.762 15.066 9.754 15.09 9.747 15.115C8.608 14.24 8.184 12.798 8.184 11.912" +
          "C8.184 11.578 8.293 11.455 8.489 11.458Z",
      },
    ],
  },
};

/**
 * Every chip's mark, keyed by the id the orbital layout refers to. Resolved
 * lazily on first access so a missing simple-icons export throws while the world
 * is mounting — where the stack trace names the brand — rather than at import
 * time for the whole app.
 */
let cache: Record<string, LogoSpec> | null = null;

export function getLogos(): Record<string, LogoSpec> {
  if (cache) return cache;
  cache = {
    // Shell 1 — Languages
    python: fromSimpleIcons(siPython),
    r: fromSimpleIcons(siR),
    typescript: fromSimpleIcons(siTypescript),
    sql: HAND_DRAWN.sql,
    pandas: fromSimpleIcons(siPandas, "pandas", true),
    numpy: fromSimpleIcons(siNumpy, "NumPy", true),

    // Shell 2 — Web & 3D
    react: fromSimpleIcons(siReact),
    threejs: fromSimpleIcons(siThreedotjs, "Three.js", true),
    vite: fromSimpleIcons(siVite),
    vue: fromSimpleIcons(siVuedotjs, "Vue"),
    fastapi: fromSimpleIcons(siFastapi),

    // Shell 3 — AI & ML
    claude: fromSimpleIcons(siClaude),
    langchain: HAND_DRAWN.langchain,
    huggingface: HAND_DRAWN.huggingface,
    catboost: HAND_DRAWN.catboost,
    lovable: HAND_DRAWN.lovable,
    base44: HAND_DRAWN.base44,
    scikitlearn: HAND_DRAWN.scikitlearn,
    jupyter: fromSimpleIcons(siJupyter),

    // Shell 4 — Infra & Product
    aws: HAND_DRAWN.aws,
    azure: HAND_DRAWN.azure,
    terraform: fromSimpleIcons(siTerraform),
    vercel: fromSimpleIcons(siVercel, "Vercel", true),
    github: fromSimpleIcons(siGithub, "GitHub", true),
    figma: fromSimpleIcons(siFigma),
    amplitude: HAND_DRAWN.amplitude,
    docker: fromSimpleIcons(siDocker),
  };
  return cache;
}
