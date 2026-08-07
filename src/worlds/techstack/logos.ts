import {
  siClaude,
  siDocker,
  siFastapi,
  siFigma,
  siGithub,
  siJupyter,
  siLangchain,
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
 * Seven do not. Simple Icons carries no Amazon or Microsoft marks at all (both
 * were removed over trademark policy — a search across all 3,453 icons returns
 * nothing for either), CatBoost / Lovable / Base44 were never in the set, and
 * "SQL" is a language rather than a brand so it has no mark to ship. Those get
 * hand-drawn paths below, authored on the same 24x24 grid so they extrude
 * through the identical pipeline and land at the same size as the real ones.
 */

export interface LogoSpec {
  /** Display name — also the hover label and the `openEntry` key. */
  label: string;
  /** SVG path data on a 24x24 viewBox. */
  path: string;
  /** Brand color, `#rrggbb`. Rendered unlit so this is the exact on-screen hue. */
  color: string;
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
 * which measured at roughly 4MB of dead weight. Naming the fourteen lets Rollup
 * drop the rest, and turns a brand that disappears in a future major into a
 * build error instead of a blank chip at runtime.
 */
function fromSimpleIcons(icon: SimpleIcon, label?: string, needsBacking?: boolean): LogoSpec {
  return {
    label: label ?? icon.title,
    path: icon.path,
    color: `#${icon.hex}`,
    needsBacking,
  };
}

/**
 * Marks Simple Icons doesn't carry, drawn on the same 24x24 grid.
 *
 * These are deliberately simple, legible-at-distance glyphs rather than attempts
 * at pixel-exact brand reproductions: a chip is a couple of hundred pixels on
 * screen at best, and an inexact trace of a logo reads worse than a clean
 * abstraction of it. Each one is a single path so it extrudes identically to the
 * real marks.
 */
const HAND_DRAWN: Record<string, LogoSpec> = {
  // Stacked database platters — the universal shorthand for a relational store.
  sql: {
    label: "SQL",
    color: "#e38c00",
    path:
      "M12 2c-4.4 0-8 1.1-8 2.5v3C4 8.9 7.6 10 12 10s8-1.1 8-2.5v-3C20 3.1 16.4 2 12 2zm0 1.6c3.7 0 6.4.9 6.4 1.4S15.7 6.4 12 6.4 5.6 5.5 5.6 5 8.3 3.6 12 3.6zM4 9.4v3.1c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V9.4c-1.7 1.1-4.7 1.7-8 1.7s-6.3-.6-8-1.7zm0 5.1v3c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-3c-1.7 1.1-4.7 1.7-8 1.7s-6.3-.6-8-1.7z",
  },
  // Three ascending bars under a boosted trend line — trees getting better. The
  // arrow is one closed outline, shaft and head together, and passes clear above
  // the bars rather than cutting across their tops.
  catboost: {
    label: "CatBoost",
    color: "#ffcc00",
    path:
      "M2.4 15.4L6.8 15.4L6.8 21.4L2.4 21.4Z" +
      "M9.8 11.9L14.2 11.9L14.2 21.4L9.8 21.4Z" +
      "M17.2 8.4L21.6 8.4L21.6 21.4L17.2 21.4Z" +
      "M2.99 13.36L18.58 5.39L19.33 6.86L21.4 3L17.06 2.41L17.81 3.88L2.21 11.84Z",
  },
  // A heart, for the app builder whose whole identity is one.
  lovable: {
    label: "Lovable",
    color: "#ff4d82",
    path:
      "M12 21.4l-1.5-1.35C5.2 15.3 2 12.4 2 8.8 2 5.9 4.3 3.6 7.2 3.6c1.6 0 3.2.76 4.2 1.97 1-1.21 2.6-1.97 4.2-1.97C18.7 3.6 21 5.9 21 8.8c0 3.6-3.2 6.5-8.5 11.26L12 21.4z",
  },
  // The numeral on its own — the platform's own digits are its whole mark. The
  // solid square they used to sit in filled the entire 24x24 box, so on a
  // rounded chip face it read as a blue tile with the puck's corners poking out
  // from behind it. Each digit's counter is wound against its outer contour, so
  // the triangle inside the 4 reads as a hole rather than filling in solid.
  base44: {
    label: "Base44",
    color: "#1f6feb",
    path:
      "M7.2 5.5L10.9 5.5L10.9 18.5L8 18.5L8 17.2L2.5 17.2L2.5 15Z" +
      "M8 15L8 9.52L5.29 15Z" +
      "M17.8 5.5L21.5 5.5L21.5 18.5L18.6 18.5L18.6 17.2L13.1 17.2L13.1 15Z" +
      "M18.6 15L18.6 9.52L15.89 15Z",
  },
  // The AWS smile-arrow, on its own. The wordmark it normally sits under is
  // unreadable at chip size, but the orange swoosh carries the brand by itself.
  // Swoosh and arrowhead are a single closed contour — as two shapes the head
  // sat detached beside the curve with daylight between them.
  aws: {
    label: "AWS",
    color: "#ff9900",
    path:
      "M1.61 12.68C4.04 15.28 7.35 16.88 10.89 17.16C14.43 17.43 17.94 16.38 20.74 14.19" +
      "L21.6 15.29L22.79 11.13L18.46 11.27L19.33 12.38" +
      "C16.98 14.21 14.03 15.1 11.07 14.86C8.1 14.63 5.33 13.29 3.3 11.12Z",
  },
  // The Azure trapezoid: the "A" chevron reduced to its two folded planes. The
  // larger plane's fold used to double back across its own right edge, which
  // triangulated into a stray shard hanging off the bottom corner.
  azure: {
    label: "Azure",
    color: "#0089d6",
    path:
      "M8.9 2.6L13.1 2.6L6.7 16.5L2.3 16.5Z" +
      "M14.1 4.9L22.3 21.1L7.2 21.1L16.2 19.3L11.5 13.7Z",
  },
  // Amplitude's mark is a peak rising out of a chart — an event spiking, which
  // is exactly what the product measures. A peak and its echo: one bare
  // triangle read as a generic mountain, and it is the repeat that makes the
  // shape a signal.
  amplitude: {
    label: "Amplitude",
    color: "#1f8ded",
    path:
      "M12 2.6L21.8 21.2L19.1 21.2L12 8.39L4.9 21.2L2.2 21.2Z" +
      "M12 10.2L17 21.2L14.6 21.2L12 16L9.4 21.2L7 21.2Z",
  },
  // scikit-learn is the one mark here that Simple Icons *does* carry but that
  // can't be used: its path is the full lockup including the wordmark, 24.5
  // units wide against 14 tall, so normalising it to a chip face leaves the
  // lettering a couple of pixels high and the whole thing reads as a smudge.
  // This is the node-and-link half of the mark on its own — a hub and three
  // satellites, which is what survives at chip scale. Circles are written as
  // four cubics each rather than arcs, so nothing depends on how compact arc
  // flags are tokenised. The links run centre to centre and are wound the same
  // way as the discs: wound the other way each one cancels against the disc it
  // overlaps and bites a notch out of the joint.
  scikitlearn: {
    label: "scikit-learn",
    color: "#f7931e",
    path:
      "M11.37 12.91L3.97 6.31L5.23 4.89L12.63 11.49Z" +
      "M11.49 11.4L19.09 6.6L20.11 8.2L12.51 13Z" +
      "M12.93 11.99L14.83 20.19L12.97 20.61L11.07 12.41Z" +
      "M15.5 12.2C15.5 13.13 15.13 14.02 14.47 14.67C13.82 15.33 12.93 15.7 12 15.7C11.07 15.7 10.18 15.33 9.53 14.67C8.87 14.02 8.5 13.13 8.5 12.2C8.5 11.27 8.87 10.38 9.53 9.73C10.18 9.07 11.07 8.7 12 8.7C12.93 8.7 13.82 9.07 14.47 9.73C15.13 10.38 15.5 11.27 15.5 12.2Z" +
      "M7.1 5.6C7.1 6.26 6.84 6.9 6.37 7.37C5.9 7.84 5.26 8.1 4.6 8.1C3.94 8.1 3.3 7.84 2.83 7.37C2.36 6.9 2.1 6.26 2.1 5.6C2.1 4.94 2.36 4.3 2.83 3.83C3.3 3.36 3.94 3.1 4.6 3.1C5.26 3.1 5.9 3.36 6.37 3.83C6.84 4.3 7.1 4.94 7.1 5.6Z" +
      "M21.9 7.4C21.9 8.01 21.66 8.6 21.23 9.03C20.8 9.46 20.21 9.7 19.6 9.7C18.99 9.7 18.4 9.46 17.97 9.03C17.54 8.6 17.3 8.01 17.3 7.4C17.3 6.79 17.54 6.2 17.97 5.77C18.4 5.34 18.99 5.1 19.6 5.1C20.21 5.1 20.8 5.34 21.23 5.77C21.66 6.2 21.9 6.79 21.9 7.4Z" +
      "M16.3 20.4C16.3 21.04 16.05 21.65 15.6 22.1C15.15 22.55 14.54 22.8 13.9 22.8C13.26 22.8 12.65 22.55 12.2 22.1C11.75 21.65 11.5 21.04 11.5 20.4C11.5 19.76 11.75 19.15 12.2 18.7C12.65 18.25 13.26 18 13.9 18C14.54 18 15.15 18.25 15.6 18.7C16.05 19.15 16.3 19.76 16.3 20.4Z",
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
    langchain: fromSimpleIcons(siLangchain),
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
