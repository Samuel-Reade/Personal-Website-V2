/**
 * The hall's room tone, synthesised rather than loaded.
 *
 * There is no audio file here for the same reason there is no model file
 * anywhere else on the site: a low drone and a band of filtered noise are a few
 * lines of Web Audio, and generating them keeps the "nothing is fetched" rule
 * intact. It also means the bed can be any length without costing anything,
 * where a looped clip would need to be long enough not to hear the seam.
 *
 * Nothing here runs before a click. Browsers start an AudioContext suspended
 * until a user gesture, so `initAudio` is called from the loading screen's Enter
 * button — which is exactly the interaction that gesture requirement wants.
 */

const MUTED_KEY = "sr:ambience-muted";

/** Master level. Deliberately near the floor — this is room tone, not music. */
const LEVEL = 0.055;
/** Fade applied when the bed starts, and when mute is toggled. */
const FADE_IN = 4;
const MUTE_FADE = 0.35;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    // Private mode and blocked storage both throw here; unmuted is the default.
    return false;
  }
}

/**
 * Creates the context, or resumes it if the browser started it suspended. Safe
 * to call more than once. Must be called from inside a user gesture.
 */
export function initAudio(): void {
  if (!ctx) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    // No Web Audio at all: every function here stays a no-op rather than throwing.
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

/** ~2s of brown noise, looped. Brown rather than white: white noise reads as hiss. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Leaky integrator — the running sum is what tilts the spectrum downward,
    // and the 0.98 leak stops it wandering off into DC over two seconds.
    last = (last * 0.98 + white * 0.04) / 1.02;
    data[i] = last * 8;
  }
  return buffer;
}

/**
 * Starts the bed and returns a stop function. Calling it twice without stopping
 * would stack two beds, so callers should treat it as owned by one mount.
 */
export function startAmbience(): () => void {
  initAudio();
  if (!ctx || !master) return () => {};

  const context = ctx;
  const out = master;
  const nodes: { disconnect: () => void }[] = [];
  const sources: AudioScheduledSourceNode[] = [];

  // A quiet low fifth, the sound of a big empty room's resonance. Detuned a few
  // cents so the two never phase-lock into a single flat tone.
  const droneGain = context.createGain();
  droneGain.gain.value = 0.5;
  droneGain.connect(out);
  nodes.push(droneGain);

  for (const [frequency, detune] of [
    [55, -4],
    [82.5, 5],
  ]) {
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    const gain = context.createGain();
    gain.gain.value = frequency === 55 ? 0.6 : 0.32;
    osc.connect(gain).connect(droneGain);
    osc.start();
    sources.push(osc);
    nodes.push(gain);
  }

  // The air in the room: noise rolled off hard, so what's left is body rather
  // than hiss.
  const noise = context.createBufferSource();
  noise.buffer = noiseBuffer(context);
  noise.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 320;
  filter.Q.value = 0.7;
  const noiseGain = context.createGain();
  noiseGain.gain.value = 0.5;
  noise.connect(filter).connect(noiseGain).connect(out);
  noise.start();
  sources.push(noise);
  nodes.push(filter, noiseGain);

  // A slow breath on the cutoff. Without it the bed is dead still, which after
  // a few seconds stops reading as a room and starts reading as a fault.
  const lfo = context.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoDepth = context.createGain();
  lfoDepth.gain.value = 90;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();
  sources.push(lfo);
  nodes.push(lfoDepth);

  const now = context.currentTime;
  out.gain.cancelScheduledValues(now);
  out.gain.setValueAtTime(out.gain.value, now);
  out.gain.linearRampToValueAtTime(muted ? 0 : LEVEL, now + FADE_IN);

  return () => {
    const stopAt = context.currentTime;
    out.gain.cancelScheduledValues(stopAt);
    out.gain.setValueAtTime(out.gain.value, stopAt);
    out.gain.linearRampToValueAtTime(0, stopAt + MUTE_FADE);
    // Stop after the fade rather than on the spot, so leaving the hall doesn't
    // end in a click.
    for (const source of sources) source.stop(stopAt + MUTE_FADE + 0.05);
    window.setTimeout(() => {
      for (const node of nodes) node.disconnect();
    }, (MUTE_FADE + 0.2) * 1000);
  };
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTED_KEY, next ? "1" : "0");
  } catch {
    // Preference just doesn't persist; the toggle still works this session.
  }
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(next ? 0 : LEVEL, now + MUTE_FADE);
}
