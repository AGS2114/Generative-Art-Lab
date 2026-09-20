"use client";

import type { NoteEvent } from "./SonicField";

export type ScaleName =
  | "major"
  | "minor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "pentatonic"
  | "wholeTone";

export type MoodName = "calm" | "bright" | "tense" | "dark" | "playful";

export interface SynthParams {
  bpm: number;
  rootNote: number;
  scale: ScaleName;
  mood: MoodName;
}

const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  pentatonic: [0, 2, 4, 7, 9],
  wholeTone: [0, 2, 4, 6, 8, 10],
};

// Scale-degree triads used for the chord progression, expressed as scale steps (not semitones) from each degree: root, third-ish, fifth-ish within
// the active scale. For 5-note or 6-note scales these still resolve to sensible stacks via modulo indexing
const TRIAD_STEP_OFFSETS = [0, 2, 4];

// A handful of common diatonic progressions, expressed as scale degree indices (0-based). Picked per phrase rather than per bar, so the harmony
// has a clear arc instead of wandering
const PROGRESSIONS: number[][] = [
  [0, 3, 4, 0], // I - IV - V - I
  [0, 5, 3, 4], // I - vi - IV - V
  [0, 4, 5, 3], // I - V - vi - IV
  [0, 3, 0, 4], // I - IV - I - V
  [5, 3, 0, 4], // vi - IV - I - V
];

interface MoodProfile {
  octaveSpread: number;
  waveform: OscillatorType;
  chordWaveform: OscillatorType;
  bassWaveform: OscillatorType;
  noteLengthBeats: number;
  gain: number;
  chordGain: number;
  bassGain: number;
  leapChance: number;
  rhythmDensity: "sparse" | "medium" | "dense";
  beatsPerChord: number;
  bassPattern: "whole" | "walking" | "syncopated";
}

const MOOD_PROFILES: Record<MoodName, MoodProfile> = {
  calm: {
    octaveSpread: 1,
    waveform: "sine",
    chordWaveform: "sine",
    bassWaveform: "sine",
    noteLengthBeats: 1.5,
    gain: 0.6,
    chordGain: 0.35,
    bassGain: 0.5,
    leapChance: 0.15,
    rhythmDensity: "sparse",
    beatsPerChord: 4,
    bassPattern: "whole",
  },
  bright: {
    octaveSpread: 2,
    waveform: "triangle",
    chordWaveform: "triangle",
    bassWaveform: "triangle",
    noteLengthBeats: 0.75,
    gain: 0.7,
    chordGain: 0.3,
    bassGain: 0.45,
    leapChance: 0.3,
    rhythmDensity: "medium",
    beatsPerChord: 2,
    bassPattern: "walking",
  },
  tense: {
    octaveSpread: 1.5,
    waveform: "sawtooth",
    chordWaveform: "sawtooth",
    bassWaveform: "sawtooth",
    noteLengthBeats: 0.4,
    gain: 0.55,
    chordGain: 0.28,
    bassGain: 0.55,
    leapChance: 0.45,
    rhythmDensity: "dense",
    beatsPerChord: 2,
    bassPattern: "syncopated",
  },
  dark: {
    octaveSpread: 1,
    waveform: "sine",
    chordWaveform: "sine",
    bassWaveform: "sine",
    noteLengthBeats: 2,
    gain: 0.65,
    chordGain: 0.4,
    bassGain: 0.6,
    leapChance: 0.1,
    rhythmDensity: "sparse",
    beatsPerChord: 4,
    bassPattern: "whole",
  },
  playful: {
    octaveSpread: 2.5,
    waveform: "square",
    chordWaveform: "triangle",
    bassWaveform: "triangle",
    noteLengthBeats: 0.5,
    gain: 0.5,
    chordGain: 0.25,
    bassGain: 0.4,
    leapChance: 0.5,
    rhythmDensity: "dense",
    beatsPerChord: 1,
    bassPattern: "syncopated",
  },
};

// Bass rhythm patterns, 16 steps per bar, 1 = note may play. "whole" holds the root for most of the bar, "walking" steps more regularly, and
// "syncopated" leaves gaps on strong beats for a more active feel
const BASS_PATTERNS: Record<MoodProfile["bassPattern"], number[]> = {
  whole: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  walking: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  syncopated: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
};

// Rhythmic cells: 16 steps per bar, 1 = note may play, 0 = rest. Several cells per density bucket so phrases don't all sound identical; picked
// once per phrase and repeated across all 4 bars rather than rolled fresh every step, so the melody reads as composed instead of wandering
const RHYTHM_CELLS: Record<MoodProfile["rhythmDensity"], number[][]> = {
  sparse: [
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  ],
  medium: [
    [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0],
    [1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0],
    [1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1],
  ],
  dense: [
    [1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0],
    [1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1],
    [1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1],
  ],
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Small seeded PRNG (mulberry32) so a phrase can be regenerated identically from its seed - lets a specific generated passage be shared/reproduced
 * rather than being gone the moment it plays
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** One diatonic degree index resolved to an absolute MIDI note for a given octave offset */
function degreeToMidi(
  degree: number,
  octaveOffset: number,
  intervals: number[],
  rootNote: number,
): number {
  const len = intervals.length;
  const wrappedDegree = ((degree % len) + len) % len;
  const extraOctaves = Math.floor(degree / len);
  return (
    rootNote + intervals[wrappedDegree] + (octaveOffset + extraOctaves) * 12
  );
}

interface PhraseState {
  seed: number;
  progression: number[];
  rhythmCell: number[];
  melodyDegrees: number[];
  repeatCount: number;
}

const PHRASE_BARS = 4;
const STEPS_PER_BAR = 16;

// How many loops of the same phrase before it settles into its "resting" dynamic - repeats gradually change density and loudness rather than
// looping byte-for-identical forever, so the same 4 bars still feel alive on their 3rd or 4th pass
const EVOLUTION_REPEATS = 3;

/**
 * SynthEngine - a small generative sequencer built on Web Audio. It never plays back real recordings; it synthesizes an original piece from tempo/key/scale/mood parameters and
 * exposes the resulting note onsets (lead melody, chord tones, AND bass, all as NoteEvents) plus a smoothed low-frequency energy reading, so a visual can react to it frame-by-frame
 * without polling the audio graph directly on the render path.
 *
 * Structure: a chord progression, rhythmic cell, and melody walk are all derived from a single seed once per phrase and repeated rather than re-rolled every step, so the result reads as a
 * composed passage instead of an independent-random walk - and the same seed always reproduces the same phrase, so a specific generated passage can be captured and revisited. On strong
 * beats the melody snaps to a chord tone; on weak beats it's free to walk the scale. A bass voice plays the chord root an octave down in a mood-specific pattern (held whole notes,
 * a walking line, or a syncopated pattern), and each repeat of the phrase nudges dynamics and density slightly so a loop doesn't feel frozen even before "new phrase" is pressed. Chord and
 * bass tones are voiced as sustained notes under the melody, each one pushed through the same NoteEvent pluck queue as the lead line (at lower velocity) so the harmony visibly ripples the
 * field too, not just the tune on top of it. A user's own pointer plucks (relayed in via `injectPluck`) are layered into the same queue so playing along with the generator and the
 * generator's own notes share one visual language.
 */
export class SynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;

  private params: SynthParams = {
    bpm: 96,
    rootNote: 60,
    scale: "major",
    mood: "calm",
  };

  private playing = false;
  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;

  private phrase: PhraseState | null = null;
  private lastChordSlot = -1;
  private pendingSeed: number | null = null;

  private pendingNotes: NoteEvent[] = [];
  private ambientEnergy = 0;

  setParams(params: Partial<SynthParams>) {
    const scaleOrMoodChanged =
      (params.scale !== undefined && params.scale !== this.params.scale) ||
      (params.mood !== undefined && params.mood !== this.params.mood);
    this.params = { ...this.params, ...params };
    if (scaleOrMoodChanged) {
      this.phrase = null;
    }
  }

  getParams(): SynthParams {
    return this.params;
  }

  isPlaying() {
    return this.playing;
  }

  /** The seed of the phrase currently playing, if any - for sharing/reproducing it */
  getCurrentSeed(): number | null {
    return this.phrase?.seed ?? null;
  }

  /** Force a fresh chord progression + rhythm cell + melody walk on the next step */
  newPhrase() {
    this.phrase = null;
  }

  /** Force a specific phrase to regenerate deterministically from this seed*/
  loadSeed(seed: number) {
    this.pendingSeed = seed;
    this.phrase = null;
  }

  injectPluck(pitch: number, velocity: number, pan: number) {
    this.pendingNotes.push({
      pitch: Math.max(0, Math.min(1, pitch)),
      velocity: Math.max(0, Math.min(1, velocity)),
      pan: Math.max(0, Math.min(1, pan)),
      voice: "manual",
    });
  }

  async start() {
    if (this.playing) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0001;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(
        new ArrayBuffer(this.analyser.frequencyBinCount),
      );
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.masterGain!.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.4);

    this.playing = true;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.stepIndex = 0;
    this.lastChordSlot = -1;
    this.phrase = null;
    this.scheduleLoop();
  }

  stop() {
    this.playing = false;
    if (this.schedulerId !== null) {
      window.clearTimeout(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    }
  }

  drainNotes(): NoteEvent[] {
    if (this.pendingNotes.length === 0) return [];
    const notes = this.pendingNotes;
    this.pendingNotes = [];
    return notes;
  }

  getAmbientEnergy(): number {
    if (!this.analyser || !this.freqData || !this.playing) return 0;
    this.analyser.getByteFrequencyData(this.freqData);
    let sum = 0;
    const bins = Math.min(8, this.freqData.length);
    for (let i = 0; i < bins; i++) sum += this.freqData[i];
    const avg = sum / bins / 255;
    this.ambientEnergy += (avg - this.ambientEnergy) * 0.15;
    return this.ambientEnergy;
  }

  private scheduleLoop = () => {
    if (!this.playing || !this.ctx) return;
    const lookaheadSec = 0.15;
    while (this.nextStepTime < this.ctx.currentTime + lookaheadSec) {
      this.scheduleStep(this.nextStepTime, this.stepIndex);
      const secondsPerBeat = 60 / this.params.bpm;
      const secondsPerStep = secondsPerBeat / 4;
      this.nextStepTime += secondsPerStep;
      this.stepIndex++;
    }
    this.schedulerId = window.setTimeout(this.scheduleLoop, 40);
  };

  private ensurePhrase(): PhraseState {
    if (this.phrase) return this.phrase;

    const seed = this.pendingSeed ?? makeSeed();
    this.pendingSeed = null;
    const rng = mulberry32(seed);

    const profile = MOOD_PROFILES[this.params.mood];
    const intervals = SCALE_INTERVALS[this.params.scale];
    const rhythmCell = pickRandom(RHYTHM_CELLS[profile.rhythmDensity], rng);
    const progression = pickRandom(PROGRESSIONS, rng);

    // Precompute a melody degree per step across the whole phrase, walking near the current chord tone rather than a totally free random walk -
    // this is what makes the tune agree with the harmony instead of clashing against it
    const totalSteps = PHRASE_BARS * STEPS_PER_BAR;
    const stepsPerChord = profile.beatsPerChord * 4;
    const maxDegree = intervals.length * profile.octaveSpread - 1;
    const melodyDegrees: number[] = [];
    let current = 0;

    for (let step = 0; step < totalSteps; step++) {
      const chordSlot = Math.floor(step / stepsPerChord) % progression.length;
      const chordRootDegree = progression[chordSlot];
      const isStrongBeat = step % 4 === 0;

      if (isStrongBeat) {
        current = chordRootDegree + pickRandom(TRIAD_STEP_OFFSETS, rng);
      } else if (rng() < profile.leapChance) {
        current = Math.floor(rng() * (maxDegree + 1));
      } else {
        const dir = rng() < 0.5 ? -1 : 1;
        current = Math.max(0, Math.min(maxDegree, current + dir));
      }
      melodyDegrees.push(current);
    }

    this.phrase = {
      seed,
      progression,
      rhythmCell,
      melodyDegrees,
      repeatCount: 0,
    };
    return this.phrase;
  }

  private scheduleStep(time: number, stepIndex: number) {
    const profile = MOOD_PROFILES[this.params.mood];
    const intervals = SCALE_INTERVALS[this.params.scale];
    const phrase = this.ensurePhrase();

    const totalSteps = PHRASE_BARS * STEPS_PER_BAR;
    const phraseStep = stepIndex % totalSteps;
    const barStep = stepIndex % STEPS_PER_BAR;

    // Bump the repeat count each time the phrase loops back to its start, capped so the evolution below settles rather than drifting forever
    if (phraseStep === 0 && stepIndex > 0) {
      phrase.repeatCount = Math.min(phrase.repeatCount + 1, EVOLUTION_REPEATS);
    }

    // Evolution factor 0..1 across the capped repeat count: the first pass is calmest, later passes gradually open up in density and
    // loudness so a loop doesn't feel frozen even before "new phrase" is pressed. Resets to 0 automatically whenever ensurePhrase() builds a
    // fresh phrase, since repeatCount starts at 0 there
    const evo = phrase.repeatCount / EVOLUTION_REPEATS;
    const densityBoost = 1 + evo * 0.35;
    const gainBoost = 1 + evo * 0.2;

    // Chord change + voicing: fires once at the start of each chord's span, not every step, and pushes each chord tone through both the audio
    // graph and the pluck queue so the harmony visibly ripples the field
    const stepsPerChord = profile.beatsPerChord * 4;
    const chordSlot = Math.floor(phraseStep / stepsPerChord);
    if (phraseStep % stepsPerChord === 0 && chordSlot !== this.lastChordSlot) {
      this.lastChordSlot = chordSlot;
      const chordRootDegree =
        phrase.progression[chordSlot % phrase.progression.length];
      const chordDurationSec =
        stepsPerChord * (60 / this.params.bpm / 4) * 0.95;

      TRIAD_STEP_OFFSETS.forEach((offset, i) => {
        const degree = chordRootDegree + offset;
        const midi = degreeToMidi(degree, -1, intervals, this.params.rootNote);
        this.playTone(
          midiToFreq(midi),
          time,
          chordDurationSec,
          profile.chordGain * (i === 0 ? 1 : 0.75) * gainBoost,
          profile.chordWaveform,
        );
        this.pendingNotes.push({
          pitch: Math.max(0, Math.min(1, degree / (intervals.length * 2))),
          velocity: 0.28 + i * 0.05,
          pan: 0.15 + i * 0.25,
          voice: "chord",
        });
      });

      // Bass voice: the chord root, two octaves down, in a mood-specific rhythm pattern rather than every chord change - gives the harmony
      // a foundation distinct from the chord pad sitting above it
      const bassPattern = BASS_PATTERNS[profile.bassPattern];
      for (let s = 0; s < stepsPerChord; s++) {
        if (bassPattern[s % bassPattern.length] !== 1) continue;
        const bassTime = time + s * (60 / this.params.bpm / 4);
        const bassMidi = degreeToMidi(
          chordRootDegree,
          -2,
          intervals,
          this.params.rootNote,
        );
        const bassDurationSec = Math.min(
          (60 / this.params.bpm / 4) * 0.9,
          chordDurationSec - s * (60 / this.params.bpm / 4),
        );
        if (bassDurationSec <= 0) continue;
        this.playTone(
          midiToFreq(bassMidi),
          bassTime,
          bassDurationSec,
          profile.bassGain * gainBoost,
          profile.bassWaveform,
        );
        this.pendingNotes.push({
          pitch: 0,
          velocity: 0.35,
          pan: 0.5,
          voice: "bass",
        });
      }
    }

    // Lead melody voice: only plays on steps the phrase's rhythm cell marks active (or, as the phrase evolves, on some of the otherwise-silent
    // steps too - densityBoost fills in gaps rather than swapping to a whole new pattern, so it still reads as the same phrase, just fuller)
    const cellActive = phrase.rhythmCell[barStep] === 1;
    const fillsGap =
      !cellActive && evo > 0 && Math.random() < (densityBoost - 1) * 0.5;
    if (cellActive || fillsGap) {
      const degree = phrase.melodyDegrees[phraseStep];
      const midi = degreeToMidi(degree, 0, intervals, this.params.rootNote);
      const velocity = (0.55 + Math.random() * 0.4) * (fillsGap ? 0.7 : 1);
      const isStrongBeat = barStep % 4 === 0;

      this.playTone(
        midiToFreq(midi),
        time,
        profile.noteLengthBeats *
          (60 / this.params.bpm) *
          (isStrongBeat ? 1.1 : 0.85),
        velocity * profile.gain * gainBoost,
        profile.waveform,
      );

      const maxDegree = intervals.length * profile.octaveSpread - 1;
      this.pendingNotes.push({
        pitch: Math.max(0, Math.min(1, degree / maxDegree)),
        velocity,
        pan: (barStep % 16) / 16,
        voice: "lead",
      });
    }
  }

  private playTone(
    freq: number,
    time: number,
    durationSec: number,
    gain: number,
    waveform: OscillatorType,
  ) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(freq, time);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, time + durationSec);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + durationSec + 0.05);
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
