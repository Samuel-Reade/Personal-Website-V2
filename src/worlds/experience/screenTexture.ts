import * as THREE from "three";
import { EXPERIENCE } from "../../data/content";

/**
 * The player's monitor, drawn to a canvas and used as its screen map. A canvas
 * rather than 3D text because this needs to wrap, centre, and sit flat against
 * the panel.
 *
 * The screen is a live readout, not a poster. Idle, it lists the five
 * employers — the index of the records the figurines open. While the cursor
 * rests on a figurine, it pulls up that record instead: org, role, dates — the
 * summary line of the panel the click would open. The room's title moved to
 * the corner block every other world wears (`.office-title`), which is what
 * freed the screen to do this.
 *
 * Canvas2D takes a CSS font shorthand, so this is the one place in-world text
 * can use the same webfonts as the HTML chrome — but it can't read a custom
 * property off :root, so the two families are spelled out here and kept in step
 * with `--font-display` / `--font-body` in styles.css by hand.
 */

const WIDTH = 1024;
/** Matches the screen mesh's 0.58 x 0.32 proportions, so nothing is stretched. */
const HEIGHT = 565;

const DISPLAY = '"Space Grotesk", ui-rounded, "SF Pro Rounded", "Avenir Next", sans-serif';
const BODY = '"Inter", "Avenir Next", "Segoe UI", sans-serif';

const BG_TOP = "#d2e2e8";
const BG_BOTTOM = "#b4cad3";
const TITLE_INK = "#33424c";
const BODY_INK = "#4a5a64";
/** Dates, and anything else that should read as the record's small print. */
const MUTED_INK = "#667882";

/** Idle: a small header over the index of employers. */
const IDLE_TITLE_FONT = `700 64px ${DISPLAY}`;
const IDLE_LIST_FONT = `700 40px ${DISPLAY}`;
const IDLE_LIST_LINE_HEIGHT = 58;

/** Focused: one record — org headline, role beneath, dates as small print. */
const ORG_FONT = `700 76px ${DISPLAY}`;
const ORG_LINE_HEIGHT = 88;
const ROLE_FONT = `500 46px ${BODY}`;
const ROLE_LINE_HEIGHT = 58;
const DATES_FONT = `500 36px ${BODY}`;

/** Greedy word wrap against the current `ctx.font`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    // `line &&` so a single word wider than maxWidth still occupies its own
    // line rather than looping forever trying to fit it.
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, BG_TOP);
  background.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawIdle(ctx: CanvasRenderingContext2D): void {
  ctx.font = IDLE_TITLE_FONT;
  ctx.fillStyle = TITLE_INK;
  ctx.fillText("Experience", WIDTH / 2, HEIGHT * 0.17);

  ctx.font = IDLE_LIST_FONT;
  ctx.fillStyle = BODY_INK;
  const start = HEIGHT * 0.37;
  EXPERIENCE.forEach((entry, i) => {
    ctx.fillText(entry.org, WIDTH / 2, start + i * IDLE_LIST_LINE_HEIGHT);
  });
}

function drawFocused(ctx: CanvasRenderingContext2D, org: string): void {
  const entry = EXPERIENCE.find((e) => e.org === org);
  if (!entry) return drawIdle(ctx);

  ctx.font = ORG_FONT;
  const orgLines = wrap(ctx, entry.org, WIDTH * 0.86);
  ctx.font = ROLE_FONT;
  // An entry still waiting on its copy (role and dates empty) simply shows its
  // name — the same graceful fallback the panel's work-in-progress note is.
  const roleLines = entry.role ? wrap(ctx, entry.role, WIDTH * 0.82) : [];

  const orgBlock = orgLines.length * ORG_LINE_HEIGHT;
  const roleBlock = roleLines.length ? 10 + roleLines.length * ROLE_LINE_HEIGHT : 0;
  const datesBlock = entry.dates ? 16 + 44 : 0;
  // Centre the whole record vertically, whatever mix of lines it wraps to.
  let y = (HEIGHT - (orgBlock + roleBlock + datesBlock)) / 2 + ORG_LINE_HEIGHT / 2;

  ctx.font = ORG_FONT;
  ctx.fillStyle = TITLE_INK;
  for (const line of orgLines) {
    ctx.fillText(line, WIDTH / 2, y);
    y += ORG_LINE_HEIGHT;
  }

  if (roleLines.length) {
    y += 10 - ORG_LINE_HEIGHT / 2 + ROLE_LINE_HEIGHT / 2;
    ctx.font = ROLE_FONT;
    ctx.fillStyle = BODY_INK;
    for (const line of roleLines) {
      ctx.fillText(line, WIDTH / 2, y);
      y += ROLE_LINE_HEIGHT;
    }
    y -= ROLE_LINE_HEIGHT / 2;
  } else {
    y -= ORG_LINE_HEIGHT / 2;
  }

  if (entry.dates) {
    ctx.font = DATES_FONT;
    ctx.fillStyle = MUTED_INK;
    ctx.fillText(entry.dates, WIDTH / 2, y + 16 + 22);
  }
}

/** The record on screen: an EXPERIENCE org while a figurine is hovered, else null. */
let focusedOrg: string | null = null;
let cached: THREE.CanvasTexture | null = null;
let context: CanvasRenderingContext2D | null = null;

function draw(ctx: CanvasRenderingContext2D): void {
  drawBackground(ctx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (focusedOrg) drawFocused(ctx, focusedOrg);
  else drawIdle(ctx);
}

/**
 * Points the monitor at one employer's record, or back at the index with null.
 * Called from the figurines' hover handlers — a redraw per hover change, not
 * per frame, and a no-op when nothing changed.
 */
export function setScreenFocus(org: string | null): void {
  if (org === focusedOrg) return;
  focusedOrg = org;
  if (context && cached) {
    draw(context);
    cached.needsUpdate = true;
  }
}

export function getScreenTexture(): THREE.CanvasTexture {
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  context = ctx;

  draw(ctx);
  cached = new THREE.CanvasTexture(canvas);
  cached.colorSpace = THREE.SRGBColorSpace;

  // A texture is drawn once and cached, so unlike the HTML chrome it can't
  // re-flow when the webfonts land — the first draw would be frozen in the
  // fallback face forever. Redraw once they are ready. `load` resolves
  // immediately if they already are, and the whole thing is skipped where
  // document.fonts isn't implemented. Both faces at the weights the screen
  // uses, so neither the index nor a record can land in a fallback.
  if (typeof document !== "undefined" && document.fonts) {
    void Promise.all([document.fonts.load(IDLE_TITLE_FONT), document.fonts.load(ROLE_FONT)])
      .then(() => {
        draw(ctx);
        cached!.needsUpdate = true;
      })
      .catch(() => {
        /* Fallback faces are already on screen and readable; nothing to do. */
      });
  }

  return cached;
}
