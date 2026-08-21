/**
 * The site's music, composed rather than loaded. It plays through every world;
 * App starts it once the visitor is in and stops it never, and the toggle for
 * it sits beside the speed slider.
 *
 * There is no audio file here for the same reason there is no model file
 * anywhere else on the site: everything below is a few hundred lines of Web
 * Audio, and generating it keeps the "nothing is fetched" rule intact.
 *
 * One piece, and deliberately not much of one: a warm pad holding a slow
 * chord cycle in D, a low piano note under each bar, a harp turning the same
 * chord over underneath, and a handful of quiet piano notes above it with a
 * great deal of room between them. Sixteen bars at 54, a little over a
 * minute, and then round again.
 *
 * It used to be a composition — an A section heard twice, a B section where
 * the harp came in, the A section again with the tune doubled an octave up.
 * That is a nice shape for a piece somebody sits and listens to and the wrong
 * shape entirely for this, which somebody has on for twenty minutes while
 * reading about a Kaggle competition. Sections arriving and leaving is the
 * music asking to be noticed, and a texture that thins to the pad alone and
 * then thickens again reads as the music stopping and starting rather than as
 * one thing going on. So the texture is now the same in every bar of the
 * loop: the pad, the bass, the harp and the tune are all always there, and
 * what changes from bar to bar is only which chord they are on.
 *
 * Quiet, too. It sits low enough to be a room the visitor is in rather than
 * something being played at them, and every voice is softer than it was — see
 * LEVEL, and the velocities in `scheduleBar`.
 *
 * The voices:
 *
 *  - Piano. Additive — a handful of sine partials, each with its own decay,
 *    the high ones dying first the way a struck string's do — under a
 *    low-pass, so it lands nearer a felt upright than a grand.
 *  - Harp. Karplus–Strong: a burst of noise in a delay line with a two-point
 *    average in the loop, rendered once per pitch into a buffer.
 *  - Pads. Detuned sawtooth pairs and a triangle behind a slow low-pass,
 *    with a shimmer of two triangles an octave above and a sine at the root
 *    for warmth. Each chord swells in before its bar and lets go after the
 *    next has begun, so the bed never breaks.
 *
 * All of it goes through one synthesised convolution reverb, which is what
 * makes three separate synths sit in one room rather than three.
 *
 * Nothing here runs before a click. Browsers start an AudioContext suspended
 * until a user gesture, so `initAudio` is called from the loading screen's
 * Enter button — which is exactly the interaction that gesture requirement
 * wants. If the context is suspended anyway (Safari after a hot reload, the
 * dev preview that enters without a click), the next pointer or key press
 * resumes it.
 */

const MUTED_KEY = "sr:music-muted";

/**
 * Master level. Under the old 0.52, which sat the piece in front of the
 * visitor rather than behind them: at that level the piano's attacks carried
 * over everything else on the page, and music you cannot help attending to is
 * not background music however calm the notes are.
 */
const LEVEL = 0.3;
/** Fade applied when the music starts, when it stops, and when mute toggles. */
const FADE_IN = 6;
const STOP_FADE = 0.9;
const MUTE_FADE = 0.35;

/* --------------------------------------------------------------------------
   The piece.
   ------------------------------------------------------------------------ */

const BPM = 54;
const BEAT = 60 / BPM;

/**
 * One bar of the score. `pad` is the chord the pads hold, as MIDI notes;
 * `bass` the note the piano's left hand puts under it; `melody` the tune's
 * notes as [beat within the bar (from 1), MIDI note, length in beats]. Every
 * bar is four beats, and every bar gets the harp — there is no flag for it,
 * because a voice that comes and goes is the thing this piece was changed to
 * stop doing.
 */
interface Bar {
  pad: number[];
  bass: number;
  melody: [number, number, number][];
}

const BEATS_PER_BAR = 4;
const BAR = BEATS_PER_BAR * BEAT;

const Dmaj7 = [50, 54, 57, 61];
const Bm7 = [47, 50, 54, 57];
const G6 = [43, 47, 50, 52];
const Aadd9 = [45, 52, 57, 59];
const Em7 = [40, 47, 50, 55];
const DoverFs = [42, 50, 54, 57];

/**
 * The turn: eight chords, gone round twice.
 *
 * The cycle closes on its own — the last bar is the dominant and the first is
 * the tonic — so the loop point is a cadence the ear was expecting rather than
 * a seam it has to forgive. Nothing is reserved for a second half and nothing
 * is withheld for a first, which is what lets it be entered and left at any
 * point without sounding like an interruption.
 *
 * Two turns of the eight rather than one, at a shade over a minute, because a
 * thirty-second cycle announces itself: the ear learns it inside two passes
 * and then hears the repeat instead of the music. The chords are the same both
 * times; only the tune's placing differs, which is enough to keep the second
 * pass from being heard as a rewind and far short of being a second section.
 *
 * The tune is deliberately thin — one or two notes a bar, several bars with
 * none at all, nothing quick. What fills the space is the harp and the pad,
 * which are steady, and silence between piano notes is calm where an unbroken
 * melody is company.
 */
const CYCLE_ONE: Bar[] = [
  { pad: Dmaj7, bass: 38, melody: [[1, 69, 3]] },
  { pad: Bm7, bass: 35, melody: [[3, 74, 2]] },
  { pad: G6, bass: 43, melody: [[1, 73, 4]] },
  { pad: Aadd9, bass: 45, melody: [] },
  { pad: DoverFs, bass: 42, melody: [[1, 76, 3]] },
  { pad: Em7, bass: 40, melody: [[3, 74, 2]] },
  { pad: G6, bass: 43, melody: [[1, 71, 4]] },
  { pad: Aadd9, bass: 45, melody: [] },
];

const CYCLE_TWO: Bar[] = [
  { pad: Dmaj7, bass: 38, melody: [[2, 66, 3]] },
  { pad: Bm7, bass: 35, melody: [] },
  { pad: G6, bass: 43, melody: [[1, 69, 2], [3, 71, 2]] },
  { pad: Aadd9, bass: 45, melody: [[3, 73, 2]] },
  { pad: DoverFs, bass: 42, melody: [[1, 74, 4]] },
  { pad: Em7, bass: 40, melody: [] },
  { pad: G6, bass: 43, melody: [[2, 71, 3]] },
  { pad: Aadd9, bass: 45, melody: [[3, 69, 2]] },
];

const FORM: Bar[] = [...CYCLE_ONE, ...CYCLE_TWO];

/* --------------------------------------------------------------------------
   Context and master.
   ------------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
let gestureArmed = false;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    // Private mode and blocked storage both throw here; unmuted is the default.
    return false;
  }
}

/**
 * Resume the context on the next gesture, for the cases where it was created
 * or resumed outside one and the browser left it suspended. A capture-phase
 * listener on the window sees the gesture whatever element it lands on, and
 * is itself the gesture handler the strictest browsers want the resume in.
 */
function armGestureResume(): void {
  if (gestureArmed) return;
  gestureArmed = true;
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const onGesture = () => {
    for (const event of events) window.removeEventListener(event, onGesture, true);
    gestureArmed = false;
    if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
  };
  for (const event of events) window.addEventListener(event, onGesture, true);
}

/**
 * Creates the context, or resumes it if the browser started it suspended. Safe
 * to call more than once. Best called from inside a user gesture; if it isn't,
 * or the browser declines anyway, the next gesture is caught and used.
 */
export function initAudio(): void {
  if (!ctx) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    // No Web Audio at all: every function here stays a no-op rather than throwing.
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : LEVEL;
    master.connect(ctx.destination);
  }
  if (ctx.state !== "running") {
    ctx.resume().catch(() => {});
    armGestureResume();
  }
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

/* --------------------------------------------------------------------------
   Instruments.
   ------------------------------------------------------------------------ */

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
const between = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

/**
 * A stereo panner where the browser has one, a plain gain where it doesn't
 * (older Safari). Position is the only thing lost.
 */
function panner(context: AudioContext, pan: number): AudioNode {
  if (typeof context.createStereoPanner === "function") {
    const node = context.createStereoPanner();
    node.pan.value = pan;
    return node;
  }
  return context.createGain();
}

/**
 * The room: a few seconds of noise dying away, darkening as it goes — a
 * one-pole low-pass whose coefficient falls along the buffer, so the tail
 * loses its top the way a real reflection does. Two channels of different
 * noise is what makes it stereo.
 */
function impulseResponse(context: AudioContext, seconds: number): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      lp += (white - lp) * (0.5 - 0.42 * t);
      data[i] = lp * (1 - t) ** 2.6;
    }
  }
  return buffer;
}

/**
 * Karplus–Strong, rendered to a buffer: one period of noise, then each sample
 * is the average of the two a period back, scaled down a whisker. The average
 * is a low-pass, so the string loses its brightness before its body, which is
 * most of what a pluck sounds like.
 *
 * `soften` low-passes the initial noise — a fingertip rather than a nail —
 * and `decay` is how long the note takes to fall 60 dB, held constant across
 * pitch by scaling the per-period loss to the frequency.
 */
function pluckBuffer(
  context: AudioContext,
  hz: number,
  seconds: number,
  soften: number,
  decay: number
): AudioBuffer {
  const rate = context.sampleRate;
  const period = Math.max(2, Math.round(rate / hz));
  const length = Math.floor(rate * seconds);
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);

  let lp = 0;
  for (let i = 0; i < period; i++) {
    const white = Math.random() * 2 - 1;
    lp += (white - lp) * soften;
    data[i] = lp;
  }
  const loss = 0.001 ** (1 / (decay * hz));
  for (let i = period; i < length; i++) {
    data[i] = loss * 0.5 * (data[i - period] + data[i - period - 1]);
  }
  // A few milliseconds of attack: a fingertip leaves a string, it doesn't
  // strike it, and without this each note begins on a spike.
  const attack = Math.min(length, Math.floor(rate * 0.003));
  for (let i = 0; i < attack; i++) data[i] *= i / attack;
  // Fade the last tenth of a second so a stopped buffer never ends on a step.
  const fade = Math.min(length, Math.floor(rate * 0.1));
  for (let i = 0; i < fade; i++) data[length - 1 - i] *= i / fade;
  return buffer;
}

interface Voices {
  context: AudioContext;
  dry: GainNode;
  reverb: GainNode;
  live: Set<AudioScheduledSourceNode>;
  strings: Map<number, AudioBuffer>;
}

/** Track a source so a stop can silence whatever is still sounding. */
function track(voices: Voices, source: AudioScheduledSourceNode): void {
  voices.live.add(source);
  source.onended = () => voices.live.delete(source);
}

/** Wire a voice's output to the dry bus and, at `wet`, to the reverb. */
function route(voices: Voices, out: AudioNode, wet: number): void {
  out.connect(voices.dry);
  const send = voices.context.createGain();
  send.gain.value = wet;
  out.connect(send).connect(voices.reverb);
}

/**
 * A piano note: five stretched partials, each decaying at its own rate, plus
 * a second fundamental a few cents off for warmth. `beats` is how long the
 * note is meant to sing; the decay is scaled to it, so a held whole note
 * lasts and a passing quaver doesn't.
 */
function piano(voices: Voices, midi: number, time: number, velocity: number, beats: number): void {
  const { context } = voices;
  const hz = midiToHz(midi);
  const out = panner(context, Math.max(-0.35, Math.min(0.35, (midi - 64) / 40)));
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1100 + velocity * 1500;
  filter.Q.value = 0.4;
  filter.connect(out);
  route(voices, out, 0.5);

  const length = Math.min(7, 1.8 + beats * 1.15);
  const partials: [number, number, number][] = [
    [1, 1, 0],
    [1, 0.4, 4],
    [2, 0.36, 0],
    [3, 0.15, 0],
    [4, 0.06, 0],
    [5, 0.03, 0],
  ];
  for (const [n, amplitude, detune] of partials) {
    const osc = context.createOscillator();
    osc.type = "sine";
    // Real strings are stiff, and their partials run slightly sharp of the
    // harmonic series; without this the note is an organ.
    osc.frequency.value = hz * n * (1 + 0.0003 * n * n);
    osc.detune.value = detune;
    const gain = context.createGain();
    const peak = amplitude * velocity * 0.17;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.006);
    gain.gain.setTargetAtTime(0, time + 0.006, length / (3.2 + 2 * (n - 1)));
    osc.connect(gain).connect(filter);
    osc.start(time);
    osc.stop(time + length + 0.5);
    track(voices, osc);
  }
}

/** One harp string, from a cached Karplus–Strong render. */
function harp(voices: Voices, midi: number, time: number, velocity: number): void {
  const { context } = voices;
  let buffer = voices.strings.get(midi);
  if (!buffer) {
    const ring = Math.min(4, Math.max(1.6, 2.4 + (66 - midi) * 0.06));
    buffer = pluckBuffer(context, midiToHz(midi), ring + 0.6, 0.4, ring);
    voices.strings.set(midi, buffer);
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = velocity * 0.63;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2600 + velocity * 1600;
  const out = panner(context, Math.max(-0.5, Math.min(0.5, (midi - 62) / 40)));
  source.connect(gain).connect(filter).connect(out);
  route(voices, out, 0.55);
  source.start(time);
  track(voices, source);
}

/**
 * A pad chord, from `start` to `release`. Three layers: the body — for each
 * note two sawtooths a few cents either side of pitch, one to each side of the
 * stereo field, and a triangle at pitch — behind a low-pass that breathes on
 * a slow LFO; a shimmer of two detuned triangles an octave above the top
 * note; and a sine at the root for warmth. Attack and release both run
 * seconds long, so consecutive chords cross-fade rather than meet.
 */
function pad(voices: Voices, notes: number[], start: number, release: number): void {
  const { context } = voices;
  const env = context.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(1, start + 2.2);
  env.gain.setValueAtTime(1, release);
  env.gain.setTargetAtTime(0, release, 1.1);
  const end = release + 6;
  route(voices, env, 0.35);

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 640;
  filter.Q.value = 0.7;
  filter.connect(env);
  const lfo = context.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = context.createGain();
  depth.gain.value = 160;
  lfo.connect(depth).connect(filter.frequency);
  lfo.start(start);
  lfo.stop(end);
  track(voices, lfo);

  const voice = (type: OscillatorType, hz: number, detune: number, level: number, to: AudioNode) => {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    osc.detune.value = detune;
    const gain = context.createGain();
    gain.gain.value = level;
    osc.connect(gain).connect(to);
    osc.start(start);
    osc.stop(end);
    track(voices, osc);
  };

  const left = panner(context, -0.45);
  const right = panner(context, 0.45);
  const centre = panner(context, 0);
  left.connect(filter);
  right.connect(filter);
  centre.connect(filter);
  for (const midi of notes) {
    const hz = midiToHz(midi);
    voice("sawtooth", hz, -5, 0.016, left);
    voice("sawtooth", hz, 5, 0.016, right);
    voice("triangle", hz, 0, 0.022, centre);
  }

  // Shimmer: an octave above the top note, wide, soft, no filter.
  const top = midiToHz(notes[notes.length - 1] + 12);
  const shimmerL = panner(context, -0.6);
  const shimmerR = panner(context, 0.6);
  shimmerL.connect(env);
  shimmerR.connect(env);
  voice("triangle", top, -7, 0.005, shimmerL);
  voice("triangle", top, 7, 0.005, shimmerR);

  // Warmth: a sine on the root.
  voice("sine", midiToHz(notes[0]), 0, 0.03, env);
}

/* --------------------------------------------------------------------------
   The player.
   ------------------------------------------------------------------------ */

/**
 * How far ahead events are queued, and how often the queue is topped up.
 * Generous, because a background tab throttles timers to once a second and
 * the music should not stutter for having been tabbed away from.
 */
const LOOKAHEAD = 4;
const TICK_MS = 120;

/**
 * Starts the music and returns a stop function. Calling it twice without
 * stopping would stack two players, so callers should treat it as owned by one
 * mount.
 */
export function startMusic(): () => void {
  initAudio();
  if (!ctx || !master) return () => {};

  const context = ctx;

  // Bus: everything → gentle compressor → fast limiter → this session's fade
  // → master. The compressor evens the phrases out; the limiter catches the
  // moments when the piano, the harp and a fresh pad all land together.
  const bus = context.createGain();
  bus.gain.setValueAtTime(0, context.currentTime);
  bus.gain.linearRampToValueAtTime(1, context.currentTime + FADE_IN);
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -26;
  compressor.knee.value = 14;
  compressor.ratio.value = 2.5;
  compressor.attack.value = 0.02;
  compressor.release.value = 0.35;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 2;
  limiter.ratio.value = 14;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  compressor.connect(limiter).connect(bus).connect(master);

  const dry = context.createGain();
  dry.connect(compressor);
  const reverbSend = context.createGain();
  const convolver = context.createConvolver();
  convolver.buffer = impulseResponse(context, 4.2);
  const reverbReturn = context.createGain();
  reverbReturn.gain.value = 0.85;
  reverbSend.connect(convolver).connect(reverbReturn).connect(compressor);

  const voices: Voices = { context, dry, reverb: reverbSend, live: new Set(), strings: new Map() };

  let barIndex = 0;
  let nextBarAt = context.currentTime + 0.3;

  const scheduleBar = (bar: Bar, time: number) => {
    const barEnd = time + BAR;

    // The pad swells in ahead of the bar and lets go once the next has begun.
    pad(voices, bar.pad, Math.max(context.currentTime, time - 0.9), barEnd + 0.3);

    // Left hand: one low note under the bar. The fifth that used to fall
    // halfway through it is gone — it only ever appeared in the bars without
    // the harp, so it was a voice that came and went, and at this level the
    // bar does not need refilling in the middle.
    piano(voices, bar.bass, time, between(0.2, 0.26), BEATS_PER_BAR);

    // The tune, well under what it was. It carries no octave double any more:
    // that was the last section's way of lifting the final pass, and a piece
    // meant to stay level has no final pass to lift.
    for (const [beat, midi, length] of bar.melody) {
      const at = time + (beat - 1) * BEAT + between(0, 0.02);
      piano(voices, midi, at, between(0.27, 0.35), length);
    }

    // The harp, on every bar, turning the chord over in crotchets rather than
    // the quavers it used to run in. Half the notes at half the level: what is
    // wanted underneath is movement, and quavers at this tempo are a figure
    // the ear follows instead.
    const notes = bar.pad.map((n) => n + 12);
    [0, 2, 1, 3].forEach((index, i) => {
      harp(voices, notes[index], time + i * BEAT + between(0, 0.012), between(0.15, 0.21));
    });
  };

  const tick = () => {
    const now = context.currentTime;

    // If the queue was starved — a hidden tab whose timers were throttled
    // past the lookahead — skip whatever went by rather than scheduling it.
    // The loop below queues every bar between `nextBarAt` and the horizon, so
    // without this a starved player wakes and schedules the whole backlog at
    // times already in the past, and the Web Audio API obliges by firing all
    // of them at once. That is not a stall, which is what it sounds like it
    // would be; it is every missed bar arriving in one chord. Stepping the
    // index on as it skips keeps the loop's place, so it comes back in on the
    // bar it would have been on.
    while (nextBarAt < now) {
      nextBarAt += BAR;
      barIndex = (barIndex + 1) % FORM.length;
    }

    while (nextBarAt < now + LOOKAHEAD) {
      scheduleBar(FORM[barIndex], nextBarAt);
      nextBarAt += BAR;
      barIndex = (barIndex + 1) % FORM.length;
    }
  };
  tick();
  const timer = window.setInterval(tick, TICK_MS);

  // A tab coming back to the front tops the queue up immediately rather than
  // waiting on the next interval, which the browser may have been throttling
  // to once a second or worse while it was away.
  const onVisible = () => {
    if (document.visibilityState === "visible") tick();
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
    const stopAt = context.currentTime;
    bus.gain.cancelScheduledValues(stopAt);
    bus.gain.setValueAtTime(bus.gain.value, stopAt);
    bus.gain.linearRampToValueAtTime(0, stopAt + STOP_FADE);
    // Silence after the fade rather than on the spot, so leaving the hall
    // doesn't end in a click. Anything already queued past this simply never
    // gets heard.
    window.setTimeout(() => {
      for (const source of voices.live) {
        try {
          source.stop();
        } catch {
          // Already stopped, or never started: nothing to do.
        }
      }
      voices.live.clear();
      bus.disconnect();
      limiter.disconnect();
      compressor.disconnect();
      dry.disconnect();
      reverbSend.disconnect();
      convolver.disconnect();
      reverbReturn.disconnect();
    }, (STOP_FADE + 0.15) * 1000);
  };
}
