/**
 * The site's music, composed rather than loaded. It plays through every world;
 * App starts it once the visitor is in and stops it never, and the toggle for
 * it sits beside the speed slider.
 *
 * There is no audio file here for the same reason there is no model file
 * anywhere else on the site: everything below is a few hundred lines of Web
 * Audio, and generating it keeps the "nothing is fetched" rule intact.
 *
 * One piece, in the manner of a video game's calm music: a warm pad that is
 * always there, holding a slow chord cycle in D, and over it a soft piano
 * playing a simple theme in long notes with room between them, a low bass
 * note under each bar, and in the second half a harp arpeggiating gently
 * beneath the tune. The theme is written out below as data — an A section
 * heard twice, a B section, the A section again with the tune doubled an
 * octave up, then a couple of bars of pad alone before it comes round. About
 * two and a quarter minutes a turn, and it turns for as long as anyone stays;
 * only the touch varies from one turn to the next.
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

/** Master level. Present, not loud: something playing in the room, not over it. */
const LEVEL = 0.52;
/** Fade applied when the music starts, when it stops, and when mute toggles. */
const FADE_IN = 3;
const STOP_FADE = 0.9;
const MUTE_FADE = 0.35;

/* --------------------------------------------------------------------------
   The piece.
   ------------------------------------------------------------------------ */

const BPM = 60;
const BEAT = 60 / BPM;

/**
 * One bar of the score. `pad` is the chord the pads hold, as MIDI notes;
 * `bass` the note the piano's left hand puts under it; `melody` the tune's
 * notes as [beat within the bar (from 1), MIDI note, length in beats]; `arp`
 * whether the harp arpeggiates the chord beneath; `doubled` whether the tune
 * is shadowed an octave up; `beats` the bar's length when it isn't four.
 */
interface Bar {
  pad: number[];
  bass: number;
  melody: [number, number, number][];
  arp?: boolean;
  doubled?: boolean;
  beats?: number;
}

const Dmaj7 = [50, 54, 57, 61];
const AoverCs = [49, 52, 57, 59];
const Bm7 = [47, 50, 54, 57];
const Gmaj7 = [43, 47, 50, 54];
const DoverFs = [42, 50, 54, 57];
const G6 = [43, 47, 50, 52];
const Aadd9 = [45, 52, 57, 59];
const Em7 = [40, 47, 50, 55];

/** The theme, first time through: it rises, and ends leaning forward. */
const A_FIRST: Bar[] = [
  { pad: Dmaj7, bass: 38, melody: [[1, 69, 2], [3, 74, 2]] },
  { pad: AoverCs, bass: 37, melody: [[1, 76, 3], [4, 73, 1]] },
  { pad: Bm7, bass: 35, melody: [[1, 74, 2], [3, 78, 2]] },
  { pad: Gmaj7, bass: 43, melody: [[1, 76, 4]] },
  { pad: DoverFs, bass: 42, melody: [[1, 78, 2], [3, 81, 1], [4, 79, 1]] },
  { pad: G6, bass: 43, melody: [[1, 78, 3], [4, 74, 1]] },
  { pad: Aadd9, bass: 45, melody: [[1, 76, 2], [3, 73, 2]] },
  { pad: Bm7, bass: 35, melody: [[1, 74, 4]] },
];

/** The theme again, settling home at the end instead. */
const A_SECOND: Bar[] = [
  ...A_FIRST.slice(0, 4),
  { pad: DoverFs, bass: 42, melody: [[1, 78, 2], [3, 76, 2]] },
  { pad: G6, bass: 43, melody: [[1, 74, 2], [3, 71, 2]] },
  { pad: Aadd9, bass: 45, melody: [[1, 73, 2], [3, 76, 1], [4, 74, 1]] },
  { pad: Dmaj7, bass: 38, melody: [[1, 69, 4]] },
];

/** The middle: higher, more open, the harp moving underneath. */
const B_SECTION: Bar[] = [
  { pad: Bm7, bass: 35, melody: [[1, 78, 2], [3, 81, 2]], arp: true },
  { pad: Gmaj7, bass: 43, melody: [[1, 83, 3], [4, 81, 1]], arp: true },
  { pad: DoverFs, bass: 42, melody: [[1, 78, 4]], arp: true },
  { pad: Aadd9, bass: 45, melody: [[1, 76, 2], [3, 73, 2]], arp: true },
  { pad: Bm7, bass: 35, melody: [[1, 74, 2], [3, 78, 2]], arp: true },
  { pad: Gmaj7, bass: 43, melody: [[1, 79, 3], [4, 78, 1]], arp: true },
  { pad: Em7, bass: 40, melody: [[1, 76, 2], [3, 74, 1], [4, 71, 1]], arp: true },
  { pad: Aadd9, bass: 45, melody: [[1, 73, 4]], arp: true },
];

/** The theme once more, harp still going, tune doubled an octave above. */
const A_LAST: Bar[] = A_SECOND.map((bar) => ({ ...bar, arp: true, doubled: true }));

/** Two bars of the pad alone before it comes round again. */
const REST: Bar[] = [{ pad: Dmaj7, bass: 38, melody: [], beats: 8 }];

const FORM: Bar[] = [...A_FIRST, ...A_SECOND, ...B_SECTION, ...A_LAST, ...REST];

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
const LOOKAHEAD = 1.5;
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
    const beats = bar.beats ?? 4;
    const barEnd = time + beats * BEAT;

    // The pad swells in ahead of the bar and lets go once the next has begun.
    pad(voices, bar.pad, Math.max(context.currentTime, time - 0.9), barEnd + 0.3);

    // Left hand: the bass under the bar and, in the plainer bars, its fifth
    // halfway through.
    piano(voices, bar.bass, time, between(0.32, 0.42), 4);
    if (beats === 4 && !bar.arp) piano(voices, bar.bass + 7, time + 2 * BEAT, between(0.2, 0.28), 2);

    // The tune, and its soft octave when the form asks for it.
    for (const [beat, midi, length] of bar.melody) {
      const at = time + (beat - 1) * BEAT + between(0, 0.015);
      piano(voices, midi, at, between(0.5, 0.68), length);
      if (bar.doubled) piano(voices, midi + 12, at + 0.01, between(0.2, 0.28), length);
    }

    if (bar.arp) {
      // The harp, arpeggiating the chord in quavers an octave up.
      const notes = bar.pad.map((n) => n + 12);
      const pattern = [0, 1, 2, 3, 2, 1, 0, 1];
      pattern.forEach((index, i) => {
        harp(voices, notes[index], time + i * BEAT * 0.5 + between(0, 0.01), between(0.3, 0.42));
      });
    } else if (bar.melody.length === 0) {
      // The rest: one slow roll of the chord, and the pad on its own.
      bar.pad.forEach((n, i) => harp(voices, n + 12, time + 1 + i * 0.16, between(0.3, 0.4)));
    }
  };

  const tick = () => {
    while (nextBarAt < context.currentTime + LOOKAHEAD) {
      const bar = FORM[barIndex];
      scheduleBar(bar, nextBarAt);
      nextBarAt += (bar.beats ?? 4) * BEAT;
      barIndex = (barIndex + 1) % FORM.length;
    }
  };
  tick();
  const timer = window.setInterval(tick, TICK_MS);

  return () => {
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
