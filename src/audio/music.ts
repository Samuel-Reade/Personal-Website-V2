/**
 * The hall's music, composed rather than loaded.
 *
 * There is no audio file here for the same reason there is no model file
 * anywhere else on the site: everything below is a few hundred lines of Web
 * Audio, and generating it keeps the "nothing is fetched" rule intact. It also
 * means the piece never has to loop. It is written as a small generative
 * player rather than a recording — a slow chord cycle under a melody that is
 * chosen note by note as it goes — so it can run for an hour and never quite
 * repeat, where a clip would have to be long enough to hide its seam.
 *
 * Three voices, all quiet, all slow:
 *
 *  - Piano. Additive — a handful of sine partials, each with its own decay, the
 *    high ones dying first the way a struck string's do — under a low-pass, so
 *    it lands nearer a felt upright than a grand.
 *  - Plucked strings, harp and guitar. Karplus–Strong: a burst of noise in a
 *    delay line with a two-point average in the loop, rendered once per pitch
 *    into a buffer. Bright and short in the harp's register, softer and lower
 *    for the guitar's bass notes at each chord change.
 *  - Pads. Detuned sawtooth pairs behind a low-pass whose cutoff breathes on a
 *    very slow LFO — the one electronic thing in the room, kept well under the
 *    acoustic voices.
 *
 * All of it goes through one synthesised convolution reverb, which is what
 * makes three separate synths sit in one space rather than three.
 *
 * Nothing here runs before a click. Browsers start an AudioContext suspended
 * until a user gesture, so `initAudio` is called from the loading screen's
 * Enter button — which is exactly the interaction that gesture requirement
 * wants.
 */

const MUTED_KEY = "sr:music-muted";

/** Master level. Soft on purpose: something playing in the room, not over it. */
const LEVEL = 0.5;
/** Fade applied when the music starts, when it stops, and when mute toggles. */
const FADE_IN = 5;
const STOP_FADE = 0.9;
const MUTE_FADE = 0.35;

/* --------------------------------------------------------------------------
   The piece.
   ------------------------------------------------------------------------ */

const BPM = 54;
const BEAT = 60 / BPM;
const BEATS_PER_CHORD = 8;

/**
 * The chord cycle, as MIDI note numbers. D major, eight bars of I–vi–IV–V
 * turned twice with the second turn recoloured — the kind of loop that reads
 * as rest rather than progress. `pad` is the voicing the pads hold; `tones`
 * are the pitch classes the melody leans on while the chord is under it;
 * `bass` is what the guitar plucks at the change.
 */
interface Chord {
  pad: number[];
  tones: number[];
  bass: number;
}

const PROGRESSION: Chord[] = [
  { pad: [50, 57, 61, 64], tones: [2, 6, 9, 1, 4], bass: 38 }, // Dmaj9
  { pad: [47, 54, 57, 62], tones: [11, 2, 6, 9, 1], bass: 35 }, // Bm9
  { pad: [43, 50, 54, 59], tones: [7, 11, 2, 6, 9], bass: 43 }, // Gmaj9
  { pad: [45, 52, 59, 64], tones: [9, 1, 4, 11], bass: 45 }, // Asus2 → A
  { pad: [54, 57, 62, 66], tones: [2, 6, 9, 1, 4], bass: 42 }, // D/F#
  { pad: [52, 55, 59, 66], tones: [4, 7, 11, 2, 6], bass: 40 }, // Em9
  { pad: [43, 50, 54, 62], tones: [7, 11, 2, 6, 9], bass: 43 }, // Gmaj7
  { pad: [45, 52, 57, 62], tones: [9, 1, 4, 11, 2], bass: 45 }, // Asus4
];

/** D major pentatonic: what the melody may use whatever the chord. */
const PENTATONIC = [2, 4, 6, 9, 11];
/** The melody's range: D4 to A5. */
const MELODY_LOW = 62;
const MELODY_HIGH = 81;

/* --------------------------------------------------------------------------
   Context and master.
   ------------------------------------------------------------------------ */

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
    master.gain.value = muted ? 0 : LEVEL;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
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
      lp += (white - lp) * (0.55 - 0.45 * t);
      data[i] = lp * (1 - t) ** 2.4;
    }
  }
  return buffer;
}

/**
 * Karplus–Strong, rendered to a buffer: `periods` samples of noise, then each
 * sample is the average of the two a period back, scaled down a whisker. The
 * average is a low-pass, so the string loses its brightness before its body,
 * which is most of what a pluck sounds like.
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
  plucks: Map<string, AudioBuffer>;
}

/** Track a source so a stop can silence whatever is still sounding. */
function track(voices: Voices, source: AudioScheduledSourceNode): void {
  voices.live.add(source);
  source.onended = () => voices.live.delete(source);
}

/** A piano note: five stretched partials, each decaying at its own rate. */
function piano(voices: Voices, midi: number, time: number, velocity: number, pan: number): void {
  const { context } = voices;
  const hz = midiToHz(midi);
  const out = panner(context, pan);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400 + velocity * 1900;
  filter.Q.value = 0.4;
  filter.connect(out);
  out.connect(voices.dry);
  const send = context.createGain();
  send.gain.value = 0.55;
  out.connect(send).connect(voices.reverb);

  const partials: [number, number][] = [
    [1, 1],
    [2, 0.4],
    [3, 0.18],
    [4, 0.09],
    [5, 0.045],
  ];
  const length = 4.8;
  for (const [n, amplitude] of partials) {
    const osc = context.createOscillator();
    osc.type = "sine";
    // Real strings are stiff, and their partials run slightly sharp of the
    // harmonic series; without this the note is an organ.
    osc.frequency.value = hz * n * (1 + 0.0003 * n * n);
    const gain = context.createGain();
    const peak = amplitude * velocity * 0.26;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.005);
    gain.gain.setTargetAtTime(0, time + 0.005, length / (4 + 2.2 * (n - 1)));
    osc.connect(gain).connect(filter);
    osc.start(time);
    osc.stop(time + length);
    track(voices, osc);
  }
}

/** A plucked string, harp or guitar, from a cached Karplus–Strong render. */
function pluck(
  voices: Voices,
  kind: "harp" | "guitar",
  midi: number,
  time: number,
  velocity: number,
  pan: number
): void {
  const { context } = voices;
  const key = `${kind}:${midi}`;
  let buffer = voices.plucks.get(key);
  if (!buffer) {
    buffer =
      kind === "harp"
        ? pluckBuffer(context, midiToHz(midi), 3.4, 0.6, 2.8)
        : pluckBuffer(context, midiToHz(midi), 4.2, 0.22, 3.4);
    voices.plucks.set(key, buffer);
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = velocity * (kind === "harp" ? 0.6 : 0.85);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = kind === "harp" ? 4200 : 1500;
  const out = panner(context, pan);
  source.connect(gain).connect(filter).connect(out);
  out.connect(voices.dry);
  const send = context.createGain();
  send.gain.value = kind === "harp" ? 0.6 : 0.35;
  out.connect(send).connect(voices.reverb);
  source.start(time);
  track(voices, source);
}

/**
 * A pad chord: for each note, two sawtooths a few cents either side of pitch,
 * one to each side of the stereo field, and a triangle at pitch for body,
 * behind a low-pass that breathes. Swells in over three seconds and takes as
 * long to leave, so one chord is still fading as the next arrives.
 */
function pad(voices: Voices, notes: number[], start: number, release: number): void {
  const { context } = voices;
  const env = context.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(1, start + 3.2);
  env.gain.setValueAtTime(1, release);
  env.gain.setTargetAtTime(0, release, 1.5);
  const end = release + 7;

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 760;
  filter.Q.value = 0.9;
  filter.connect(env);
  env.connect(voices.dry);
  const send = context.createGain();
  send.gain.value = 0.4;
  env.connect(send).connect(voices.reverb);

  // The breath: cutoff wandering ±220 Hz once every fifteen seconds or so.
  const lfo = context.createOscillator();
  lfo.frequency.value = 0.065;
  const depth = context.createGain();
  depth.gain.value = 220;
  lfo.connect(depth).connect(filter.frequency);
  lfo.start(start);
  lfo.stop(end);
  track(voices, lfo);

  const left = panner(context, -0.4);
  const right = panner(context, 0.4);
  const centre = panner(context, 0);
  left.connect(filter);
  right.connect(filter);
  centre.connect(filter);

  for (const midi of notes) {
    const hz = midiToHz(midi);
    const layers: [OscillatorType, number, number, AudioNode][] = [
      ["sawtooth", -6, 0.018, left],
      ["sawtooth", 6, 0.018, right],
      ["triangle", 0, 0.028, centre],
    ];
    for (const [type, detune, level, out] of layers) {
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.value = hz;
      osc.detune.value = detune;
      const gain = context.createGain();
      gain.gain.value = level;
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(end);
      track(voices, osc);
    }
  }
}

/* --------------------------------------------------------------------------
   The player.
   ------------------------------------------------------------------------ */

/**
 * How far ahead events are queued, and how often the queue is topped up.
 * Generous, because a background tab throttles timers to once a second and
 * the music should not stutter for having been tabbed away from.
 */
const LOOKAHEAD = 1.4;
const TICK_MS = 120;

const chance = (p: number): boolean => Math.random() < p;
const between = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

/**
 * The next melody note: every pitch in range whose class is in the chord or the
 * pentatonic, weighted toward chord tones and toward staying near the last
 * note — a random walk that prefers steps and lands on the harmony.
 */
function nextMelodyNote(chord: Chord, previous: number, onDownbeat: boolean): number {
  const candidates: [number, number][] = [];
  for (let midi = MELODY_LOW; midi <= MELODY_HIGH; midi++) {
    const pitchClass = midi % 12;
    const inChord = chord.tones.includes(pitchClass);
    if (!inChord && (onDownbeat || !PENTATONIC.includes(pitchClass))) continue;
    if (midi === previous && chance(0.6)) continue;
    const harmony = inChord ? 1 : 0.4;
    const nearness = Math.exp(-Math.abs(midi - previous) / 3.5);
    candidates.push([midi, harmony * nearness]);
  }
  let total = 0;
  for (const [, weight] of candidates) total += weight;
  let pick = Math.random() * total;
  for (const [midi, weight] of candidates) {
    pick -= weight;
    if (pick <= 0) return midi;
  }
  return candidates[candidates.length - 1]?.[0] ?? previous;
}

/**
 * Starts the music and returns a stop function. Calling it twice without
 * stopping would stack two players, so callers should treat it as owned by one
 * mount.
 */
export function startMusic(): () => void {
  initAudio();
  if (!ctx || !master) return () => {};

  const context = ctx;

  // Bus: everything → gentle compressor → this session's fade → master.
  const bus = context.createGain();
  bus.gain.setValueAtTime(0, context.currentTime);
  bus.gain.linearRampToValueAtTime(1, context.currentTime + FADE_IN);
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.02;
  compressor.release.value = 0.4;
  compressor.connect(bus).connect(master);

  const dry = context.createGain();
  dry.connect(compressor);
  const reverbSend = context.createGain();
  const convolver = context.createConvolver();
  convolver.buffer = impulseResponse(context, 3.6);
  const reverbReturn = context.createGain();
  reverbReturn.gain.value = 0.9;
  reverbSend.connect(convolver).connect(reverbReturn).connect(compressor);

  const voices: Voices = { context, dry, reverb: reverbSend, live: new Set(), plucks: new Map() };

  let beat = 0;
  let nextBeatAt = context.currentTime + 0.2;
  let previousNote = 69;
  let restBeats = 0;

  const scheduleBeat = (time: number) => {
    const chordIndex = Math.floor(beat / BEATS_PER_CHORD) % PROGRESSION.length;
    const chord = PROGRESSION[chordIndex];
    const beatInChord = beat % BEATS_PER_CHORD;
    const downbeat = beatInChord === 0;

    if (downbeat) {
      // The pad starts its swell a moment early so it peaks with the change.
      pad(voices, chord.pad, Math.max(context.currentTime, time - 0.8), time + BEATS_PER_CHORD * BEAT - 0.4);
      // Guitar bass under the change, most times.
      if (chance(0.8)) pluck(voices, "guitar", chord.bass, time, between(0.5, 0.75), -0.15);
      // A harp roll up the chord, some of the time, softening as it climbs.
      if (chance(0.55)) {
        const roll = [...chord.pad.map((n) => n + 12), chord.pad[0] + 24];
        roll.forEach((midi, i) => {
          pluck(voices, "harp", midi, time + i * between(0.07, 0.11), between(0.35, 0.55) - i * 0.03, 0.2 + i * 0.05);
        });
      }
    } else if (beatInChord === 4 && chance(0.3)) {
      // Halfway through the chord: sometimes a fifth from the guitar, or a
      // short harp figure coming back down.
      if (chance(0.5)) pluck(voices, "guitar", chord.bass + 7, time, between(0.4, 0.6), -0.15);
      else {
        const roll = [...chord.pad.map((n) => n + 12)].reverse().slice(0, 3);
        roll.forEach((midi, i) => pluck(voices, "harp", midi, time + i * 0.09, between(0.3, 0.45), 0.25));
      }
    }

    // Melody: sparse, sparser after a note, keener after a silence.
    const noteChance = restBeats === 0 ? 0.32 : restBeats === 1 ? 0.48 : 0.7;
    if (downbeat ? chance(0.75) : chance(noteChance)) {
      previousNote = nextMelodyNote(chord, previousNote, downbeat);
      piano(voices, previousNote, time + between(0, 0.02), between(0.45, 0.85), between(-0.15, 0.15));
      restBeats = 0;
      // Now and then a second, quieter note answers on the off-beat.
      if (chance(0.22)) {
        const answer = nextMelodyNote(chord, previousNote, false);
        piano(voices, answer, time + BEAT * between(0.5, 0.66), between(0.3, 0.5), between(-0.15, 0.15));
        previousNote = answer;
      }
    } else {
      restBeats++;
    }
  };

  const tick = () => {
    while (nextBeatAt < context.currentTime + LOOKAHEAD) {
      scheduleBeat(nextBeatAt);
      beat++;
      nextBeatAt += BEAT;
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
      compressor.disconnect();
      dry.disconnect();
      reverbSend.disconnect();
      convolver.disconnect();
      reverbReturn.disconnect();
    }, (STOP_FADE + 0.15) * 1000);
  };
}
