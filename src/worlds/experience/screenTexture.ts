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
 * It also runs its own pointer. Holding the desk mouse drags an arrow across
 * this canvas, and the row that arrow rests on lights up here *and* glows on
 * the desk — the same index read the other way round, from the screen back to
 * the object. So this module is the whole of the monitor: what it shows, where
 * its cursor is, and which record letting go would open.
 *
 * Canvas2D takes a CSS font shorthand, so this is the one place in-world text
 * can use the same webfonts as the HTML chrome — but it can't read a custom
 * property off :root, so the two families are spelled out here and kept in step
 * with `--font-display` / `--font-body` in styles.css by hand.
 */

const WIDTH = 1024;
/** Matches the screen mesh's 0.58 x 0.32 proportions, so nothing is stretched. */
const HEIGHT = 565;

/**
 * A pixel of pointer drag has to move the cursor the same visible distance
 * across the screen whichever way it goes, and the screen's two axes are not
 * the same length. The desk mouse scales its vertical rate by this.
 */
export const SCREEN_ASPECT = WIDTH / HEIGHT;

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
const IDLE_LIST_START = HEIGHT * 0.37;
/** The box a row answers to, a little shy of the line height so rows don't touch. */
const IDLE_ROW_HEIGHT = 48;
const IDLE_ROW_PAD_X = 30;

/** Focused: one record — org headline, role beneath, dates as small print. */
const ORG_FONT = `700 76px ${DISPLAY}`;
const ORG_LINE_HEIGHT = 88;
const ROLE_FONT = `500 46px ${BODY}`;
const ROLE_LINE_HEIGHT = 58;
const DATES_FONT = `500 36px ${BODY}`;

/** The pill behind the row the on-screen cursor is resting on. */
const ROW_FILL = "rgba(255, 255, 255, 0.62)";

const CURSOR_FILL = "#fbfeff";
/** Blows the arrow below up to screen pixels — about the cap height of a row. */
const CURSOR_SCALE = 2;
/** A plain arrow with its tip at the origin, so the tip is the hot spot. */
const CURSOR_ARROW: readonly [number, number][] = [
  [0, 0],
  [0, 18],
  [4.4, 13.9],
  [7.2, 20.6],
  [10.6, 19.2],
  [7.9, 12.7],
  [13.2, 12.3],
];
/** Where the cursor first appears: clear of the list, up by the header. */
const CURSOR_HOME = { x: 0.5, y: 0.14 };
/** Kept off the very edge, so the arrow never half-leaves the panel. */
const CURSOR_MARGIN = 0.02;

/** The record on screen: an EXPERIENCE org while a figurine is hovered, else null. */
let focusedOrg: string | null = null;
/** The on-screen cursor, in screen-normalized coordinates. Null until first used. */
let cursor: { x: number; y: number } | null = null;
/** Whether the desk mouse is being held right now. */
let cursorHeld = false;
/** The row the cursor is resting on, which is also the figurine that glows. */
let cursorTarget: string | null = null;
/**
 * Cursor moves arrive per pointer event, which can outrun the display. Marking
 * dirty and redrawing once a frame keeps a fast drag to one canvas repaint and
 * one texture upload per frame instead of one per event.
 */
let dirty = false;
let cached: THREE.CanvasTexture | null = null;
let context: CanvasRenderingContext2D | null = null;

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

/** Path for a fully rounded-ended pill. Left as a path; the caller fills it. */
function pillPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, BG_TOP);
  background.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** One row of the index, and the box the cursor has to be inside to pick it. */
interface Row {
  org: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Baseline the text is centred on. */
  cy: number;
}

/**
 * Where the rows sit. Boxes are measured rather than fixed-width: the org names
 * differ by a factor of three in length, and a cursor has to hit what it looks
 * like it is over.
 */
function listRows(ctx: CanvasRenderingContext2D): Row[] {
  ctx.font = IDLE_LIST_FONT;
  return EXPERIENCE.map((entry, i) => {
    const cy = IDLE_LIST_START + i * IDLE_LIST_LINE_HEIGHT;
    const half = ctx.measureText(entry.org).width / 2 + IDLE_ROW_PAD_X;
    return {
      org: entry.org,
      x0: WIDTH / 2 - half,
      x1: WIDTH / 2 + half,
      y0: cy - IDLE_ROW_HEIGHT / 2,
      y1: cy + IDLE_ROW_HEIGHT / 2,
      cy,
    };
  });
}

function drawIdle(ctx: CanvasRenderingContext2D): void {
  ctx.font = IDLE_TITLE_FONT;
  ctx.fillStyle = TITLE_INK;
  ctx.fillText("Experience", WIDTH / 2, HEIGHT * 0.17);

  for (const row of listRows(ctx)) {
    const lit = row.org === cursorTarget;
    if (lit) {
      ctx.fillStyle = ROW_FILL;
      pillPath(ctx, row.x0, row.y0, row.x1 - row.x0, row.y1 - row.y0);
      ctx.fill();
    }
    ctx.font = IDLE_LIST_FONT;
    ctx.fillStyle = lit ? TITLE_INK : BODY_INK;
    ctx.fillText(row.org, WIDTH / 2, row.cy);
  }
}

function drawCursor(ctx: CanvasRenderingContext2D): void {
  if (!cursor) return;
  ctx.save();
  ctx.translate(cursor.x * WIDTH, cursor.y * HEIGHT);
  ctx.scale(CURSOR_SCALE, CURSOR_SCALE);
  ctx.beginPath();
  CURSOR_ARROW.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = CURSOR_FILL;
  ctx.fill();
  // Outlined, because a white arrow on the pale end of the gradient is a white
  // arrow on white. Line width is in the scaled space, hence the fraction.
  ctx.lineWidth = 1.4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = TITLE_INK;
  ctx.stroke();
  ctx.restore();
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

function draw(ctx: CanvasRenderingContext2D): void {
  drawBackground(ctx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // A hovered figurine wins: the real pointer is on the desk, not on the mouse,
  // and the record it pulls up replaces the index the cursor navigates.
  if (focusedOrg) drawFocused(ctx, focusedOrg);
  else {
    drawIdle(ctx);
    drawCursor(ctx);
  }
  dirty = false;
}

function repaint(): void {
  if (!context || !cached) return;
  draw(context);
  cached.needsUpdate = true;
}

/** Which row the cursor is inside, if the index is the thing on screen. */
function hitTest(): string | null {
  if (!cursor || !context || focusedOrg) return null;
  const x = cursor.x * WIDTH;
  const y = cursor.y * HEIGHT;
  for (const row of listRows(context)) {
    if (x >= row.x0 && x <= row.x1 && y >= row.y0 && y <= row.y1) return row.org;
  }
  return null;
}

/**
 * Points the monitor at one employer's record, or back at the index with null.
 * Called from the figurines' hover handlers — a redraw per hover change, not
 * per frame, and a no-op when nothing changed.
 */
export function setScreenFocus(org: string | null): void {
  if (org === focusedOrg) return;
  focusedOrg = org;
  repaint();
}

/**
 * The desk mouse went down. The cursor wakes where it was left — or up by the
 * header on the first ever press, deliberately clear of the list so a press
 * with no drag behind it can't open a record the visitor never aimed at.
 */
export function pressScreenCursor(): void {
  cursorHeld = true;
  if (!cursor) {
    cursor = { ...CURSOR_HOME };
    cursorTarget = hitTest();
  }
  dirty = true;
}

/** Drags the cursor by a fraction of the screen's width and height. */
export function moveScreenCursor(dx: number, dy: number): void {
  // The cursor moves only while the mouse is actually held. The listeners that
  // feed this are torn down a commit after the release, so without the guard a
  // pointer that keeps travelling through that gap drags the cursor off the row
  // it was just dropped on — and the desk stops glowing on its own.
  if (!cursor || !cursorHeld) return;
  cursor.x = THREE.MathUtils.clamp(cursor.x + dx, CURSOR_MARGIN, 1 - CURSOR_MARGIN);
  cursor.y = THREE.MathUtils.clamp(cursor.y + dy, CURSOR_MARGIN, 1 - CURSOR_MARGIN);
  cursorTarget = hitTest();
  dirty = true;
}

/**
 * The desk mouse came back up, which is the click: whatever the cursor is
 * resting on is what was pressed. The cursor stays where it was let go, the
 * way a pointer does.
 */
export function releaseScreenCursor(): string | null {
  cursorHeld = false;
  dirty = true;
  return cursorTarget;
}

/** True while the desk mouse is held — the pointer belongs to the screen, not the desk. */
export function isScreenCursorHeld(): boolean {
  return cursorHeld;
}

/** The org the on-screen cursor is resting on, for the figurine that mirrors it. */
export function getScreenTarget(): string | null {
  return focusedOrg ? null : cursorTarget;
}

/** Redraws at most once a frame, and only if something moved. Called from the desk mouse. */
export function flushScreen(): void {
  if (dirty) repaint();
}

/** Leaving the world: nothing should still be lit or pointed at on the way back in. */
export function resetScreen(): void {
  focusedOrg = null;
  cursor = null;
  cursorHeld = false;
  cursorTarget = null;
  repaint();
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
