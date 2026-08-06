import * as si from "simple-icons";

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

/** Pulls a mark out of simple-icons by export name, with the brand hex. */
function fromSimpleIcons(exportName: string, label?: string, needsBacking?: boolean): LogoSpec {
  const icon = (si as unknown as Record<string, si.SimpleIcon | undefined>)[exportName];
  if (!icon) {
    throw new Error(
      `simple-icons has no export "${exportName}". The package's contents shift between ` +
        `majors — add a hand-drawn path to HAND_DRAWN below rather than silently ` +
        `shipping a blank chip.`
    );
  }
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
  // Two ascending gradient-boosted steps under an arrow — trees getting better.
  catboost: {
    label: "CatBoost",
    color: "#ffcc00",
    path:
      "M3 20h5v-6H3v6zm6.5 0h5V9h-5v11zM16 20h5V4h-5v16zM4.8 11.6l1.1 1.1 5.4-5.4 3.1 3.1 6.4-6.4-1.1-1.1-5.3 5.3-3.1-3.1-6.5 6.5z",
  },
  // A heart, for the app builder whose whole identity is one.
  lovable: {
    label: "Lovable",
    color: "#ff4d82",
    path:
      "M12 21.4l-1.5-1.35C5.2 15.3 2 12.4 2 8.8 2 5.9 4.3 3.6 7.2 3.6c1.6 0 3.2.76 4.2 1.97 1-1.21 2.6-1.97 4.2-1.97C18.7 3.6 21 5.9 21 8.8c0 3.6-3.2 6.5-8.5 11.26L12 21.4z",
  },
  // A stylized "44" block — the platform's own numeral is its whole mark.
  base44: {
    label: "Base44",
    color: "#1f6feb",
    path:
      "M2 2h20v20H2V2zm5.9 13.4h1.6v2.3h1.9v-2.3h1.1v-1.6h-1.1V6.5H9.2l-3.9 7.1v1.8h2.6zm0-1.6H7.2l1.6-3v3h-.9zm7.1 1.6h1.6v2.3h1.9v-2.3h1.1v-1.6h-1.1V6.5h-2.2l-3.9 7.1v1.8H15zm0-1.6h-1.6l1.6-3v3z",
  },
  // The AWS smile-arrow, on its own. The wordmark it normally sits under is
  // unreadable at chip size, but the orange swoosh carries the brand by itself.
  aws: {
    label: "AWS",
    color: "#ff9900",
    path:
      "M1.6 11.2C5.4 17.8 12.8 20.8 19.4 18.2L18.5 16.1C12.9 18.3 6.6 15.7 3.4 10.1Z M17.4 13.9L22.4 16.6L16.9 19.4Z",
  },
  // The Azure trapezoid: the "A" chevron reduced to its two folded planes.
  azure: {
    label: "Azure",
    color: "#0089d6",
    path: "M13.05 3.4L6.6 16.9l-4.6.08L8.7 3.4h4.35zM14.2 5.2L22 20.6H7.3l8.9-1.55-4.6-5.45 2.6-8.4z",
  },
  // Amplitude's mark is a peak rising out of a chart — an event spiking, which
  // is exactly what the product measures. Reduced to the peak itself.
  amplitude: {
    label: "Amplitude",
    color: "#1f8ded",
    path: "M12 2.2L22.6 21.4L18.2 21.4L12 9.8L5.8 21.4L1.4 21.4Z",
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
    python: fromSimpleIcons("siPython"),
    r: fromSimpleIcons("siR"),
    typescript: fromSimpleIcons("siTypescript"),
    sql: HAND_DRAWN.sql,

    // Shell 2 — Web & 3D
    react: fromSimpleIcons("siReact"),
    threejs: fromSimpleIcons("siThreedotjs", "Three.js", true),
    vite: fromSimpleIcons("siVite"),
    vue: fromSimpleIcons("siVuedotjs", "Vue"),
    fastapi: fromSimpleIcons("siFastapi"),

    // Shell 3 — AI & ML
    claude: fromSimpleIcons("siClaude"),
    langchain: fromSimpleIcons("siLangchain"),
    catboost: HAND_DRAWN.catboost,
    lovable: HAND_DRAWN.lovable,
    base44: HAND_DRAWN.base44,

    // Shell 4 — Infra & Product
    aws: HAND_DRAWN.aws,
    azure: HAND_DRAWN.azure,
    terraform: fromSimpleIcons("siTerraform"),
    vercel: fromSimpleIcons("siVercel", "Vercel", true),
    github: fromSimpleIcons("siGithub", "GitHub", true),
    figma: fromSimpleIcons("siFigma"),
    amplitude: HAND_DRAWN.amplitude,
  };
  return cache;
}
