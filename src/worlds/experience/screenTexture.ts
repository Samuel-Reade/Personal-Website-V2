import * as THREE from "three";

/**
 * The player's monitor, drawn to a canvas and used as its screen map. A canvas
 * rather than 3D text because this needs to wrap, centre, and sit flat against
 * the panel.
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

const TITLE = "Experience";
const COPY = "Five objects on the desk represent where I've worked. Click on them!";

const BG_TOP = "#d2e2e8";
const BG_BOTTOM = "#b4cad3";
const TITLE_INK = "#33424c";
const BODY_INK = "#4a5a64";

const TITLE_SIZE = 104;
const BODY_SIZE = 46;
const BODY_LINE_HEIGHT = 60;

const TITLE_FONT = `700 ${TITLE_SIZE}px ${DISPLAY}`;
const BODY_FONT = `500 ${BODY_SIZE}px ${BODY}`;

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

function draw(ctx: CanvasRenderingContext2D): void {
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, BG_TOP);
  background.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = TITLE_FONT;
  ctx.fillStyle = TITLE_INK;
  ctx.fillText(TITLE, WIDTH / 2, HEIGHT * 0.33);

  ctx.font = BODY_FONT;
  ctx.fillStyle = BODY_INK;
  const lines = wrap(ctx, COPY, WIDTH * 0.78);
  // Centre the block on a fixed point rather than growing downward from one, so
  // the copy stays balanced whether it wraps to two lines or three.
  const start = HEIGHT * 0.63 - ((lines.length - 1) * BODY_LINE_HEIGHT) / 2;
  lines.forEach((line, i) => ctx.fillText(line, WIDTH / 2, start + i * BODY_LINE_HEIGHT));
}

let cached: THREE.CanvasTexture | null = null;

export function getScreenTexture(): THREE.CanvasTexture {
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  draw(ctx);
  cached = new THREE.CanvasTexture(canvas);
  cached.colorSpace = THREE.SRGBColorSpace;

  // A texture is drawn once and cached, so unlike the HTML chrome it can't
  // re-flow when the webfonts land — the first draw would be frozen in the
  // fallback face forever. Redraw once they are ready. `load` resolves
  // immediately if they already are, and the whole thing is skipped where
  // document.fonts isn't implemented.
  if (typeof document !== "undefined" && document.fonts) {
    void Promise.all([document.fonts.load(TITLE_FONT), document.fonts.load(BODY_FONT)])
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
