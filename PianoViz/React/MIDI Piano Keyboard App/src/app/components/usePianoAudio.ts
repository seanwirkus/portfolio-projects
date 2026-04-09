import { useRef, useCallback, useEffect, useState } from "react";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// Soundfont uses flat naming
const SOUNDFONT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export interface NoteInfo {
  midi: number;
  name: string;
  octave: number;
  frequency: number;
  isBlack: boolean;
}

export function getMidiNoteInfo(midi: number): NoteInfo {
  const octave = Math.floor((midi - 12) / 12);
  const noteIndex = midi % 12;
  const name = NOTE_NAMES[noteIndex];
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  const isBlack = [1, 3, 6, 8, 10].includes(noteIndex);
  return { midi, name, octave, frequency, isBlack };
}

export function generateKeys(startMidi: number, endMidi: number): NoteInfo[] {
  const keys: NoteInfo[] = [];
  for (let i = startMidi; i <= endMidi; i++) {
    keys.push(getMidiNoteInfo(i));
  }
  return keys;
}

// Convert MIDI number to soundfont sample name like "A4", "Db3"
function midiToSoundfontName(midi: number): string {
  const octave = Math.floor((midi - 12) / 12);
  const noteIndex = midi % 12;
  return `${SOUNDFONT_NAMES[noteIndex]}${octave}`;
}

// We sample every 3rd note and pitch-shift for neighbors (like a real piano)
const SAMPLED_NOTES = [
  21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60,
  63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108
];

function findClosestSample(midi: number): number {
  let closest = SAMPLED_NOTES[0];
  let minDist = Math.abs(midi - closest);
  for (const s of SAMPLED_NOTES) {
    const dist = Math.abs(midi - s);
    if (dist < minDist) {
      minDist = dist;
      closest = s;
    }
  }
  return closest;
}

const SOUNDFONT_BASE =
  "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3";

class PianoSampler {
  private ctx: AudioContext;
  private buffers: Map<number, AudioBuffer> = new Map();
  private loading: Map<number, Promise<AudioBuffer | null>> = new Map();
  public ready = false;
  private loadedCount = 0;
  private totalToLoad = SAMPLED_NOTES.length;
  public onProgress?: (loaded: number, total: number) => void;
  private masterGain: GainNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(ctx.destination);
  }

  setVolume(vol: number) {
    this.masterGain.gain.setValueAtTime(
      Math.max(0, Math.min(2.5, vol)),
      this.ctx.currentTime
    );
  }

  async loadAll() {
    const promises = SAMPLED_NOTES.map((midi) => this.loadSample(midi));
    await Promise.allSettled(promises);
    this.ready = true;
  }

  private async loadSample(midi: number): Promise<AudioBuffer | null> {
    if (this.buffers.has(midi)) return this.buffers.get(midi)!;
    if (this.loading.has(midi)) return this.loading.get(midi)!;

    const name = midiToSoundfontName(midi);
    const url = `${SOUNDFONT_BASE}/${name}.mp3`;

    const promise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuf = await response.arrayBuffer();
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
        this.buffers.set(midi, audioBuf);
        this.loadedCount++;
        this.onProgress?.(this.loadedCount, this.totalToLoad);
        return audioBuf;
      } catch {
        return null;
      }
    })();

    this.loading.set(midi, promise);
    return promise;
  }

  play(
    midi: number,
    velocity: number = 0.8
  ): { stop: () => void } | null {
    const sampleMidi = findClosestSample(midi);
    const buffer = this.buffers.get(sampleMidi);
    if (!buffer) return null;

    const now = this.ctx.currentTime;

    // Create source
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Pitch shift if needed
    const semitoneDiff = midi - sampleMidi;
    source.playbackRate.value = Math.pow(2, semitoneDiff / 12);

    // Velocity gain — boosted for louder output
    const gainNode = this.ctx.createGain();
    const vol = 0.5 + velocity * 0.5;
    gainNode.gain.setValueAtTime(vol * 1.8, now);

    // Gentle high-shelf to warm the tone
    const eq = this.ctx.createBiquadFilter();
    eq.type = "highshelf";
    eq.frequency.value = 4000;
    eq.gain.value = -3;

    // Simple reverb via delay feedback
    const dryGain = this.ctx.createGain();
    dryGain.gain.value = 0.9;
    const wetGain = this.ctx.createGain();
    wetGain.gain.value = 0.18;
    const delay = this.ctx.createDelay(0.1);
    delay.delayTime.value = 0.03;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.2;

    source.connect(gainNode);
    gainNode.connect(eq);
    eq.connect(dryGain);
    dryGain.connect(this.masterGain);

    eq.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);
    wetGain.connect(this.masterGain);

    source.start(now);

    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      const t = this.ctx.currentTime;
      // Natural release
      const releaseTime = 0.4;
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(gainNode.gain.value, t);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + releaseTime);
      wetGain.gain.exponentialRampToValueAtTime(0.001, t + releaseTime + 0.2);
      setTimeout(() => {
        try { source.stop(); } catch {}
      }, (releaseTime + 0.3) * 1000);
    };

    // Auto-stop after sample ends
    source.onended = () => {
      stopped = true;
    };

    return { stop };
  }

  /** Play multiple notes at exactly the same time (aligned chord) */
  playChord(
    midiNotes: number[],
    velocity: number = 0.8
  ): Map<number, { stop: () => void }> {
    const now = this.ctx.currentTime;
    const stops = new Map<number, { stop: () => void }>();

    for (const midi of midiNotes) {
      if (midi < 0 || midi > 127) continue;

      const sampleMidi = findClosestSample(midi);
      const buffer = this.buffers.get(sampleMidi);
      if (!buffer) continue;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      const semitoneDiff = midi - sampleMidi;
      source.playbackRate.value = Math.pow(2, semitoneDiff / 12);

      const gainNode = this.ctx.createGain();
      const vol = 0.5 + velocity * 0.5;
      gainNode.gain.setValueAtTime(vol * 1.8, now);

      const eq = this.ctx.createBiquadFilter();
      eq.type = "highshelf";
      eq.frequency.value = 4000;
      eq.gain.value = -3;

      const dryGain = this.ctx.createGain();
      dryGain.gain.value = 0.9;
      const wetGain = this.ctx.createGain();
      wetGain.gain.value = 0.18;
      const delay = this.ctx.createDelay(0.1);
      delay.delayTime.value = 0.03;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.2;

      source.connect(gainNode);
      gainNode.connect(eq);
      eq.connect(dryGain);
      dryGain.connect(this.masterGain);

      eq.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wetGain);
      wetGain.connect(this.masterGain);

      source.start(now);

      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        const t = this.ctx.currentTime;
        const releaseTime = 0.4;
        gainNode.gain.cancelScheduledValues(t);
        gainNode.gain.setValueAtTime(gainNode.gain.value, t);
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + releaseTime);
        wetGain.gain.exponentialRampToValueAtTime(0.001, t + releaseTime + 0.2);
        setTimeout(() => {
          try { source.stop(); } catch {}
        }, (releaseTime + 0.3) * 1000);
      };

      source.onended = () => { stopped = true; };
      stops.set(midi, { stop });
    }

    return stops;
  }
}

/** Helper: build chord from root + intervals (e.g. C major = chordFromRoot(60, [0,4,7])) */
export function chordFromRoot(rootMidi: number, intervals: number[]): number[] {
  return intervals.map((i) => rootMidi + i);
}

/** Helper: common chord voicings */
export const CHORD_HELPERS = {
  major: (root: number) => chordFromRoot(root, [0, 4, 7]),
  minor: (root: number) => chordFromRoot(root, [0, 3, 7]),
  seventh: (root: number) => chordFromRoot(root, [0, 4, 7, 10]),
  maj7: (root: number) => chordFromRoot(root, [0, 4, 7, 11]),
  min7: (root: number) => chordFromRoot(root, [0, 3, 7, 10]),
  sus2: (root: number) => chordFromRoot(root, [0, 2, 7]),
  sus4: (root: number) => chordFromRoot(root, [0, 5, 7]),
} as const;

export function usePianoAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const samplerRef = useRef<PianoSampler | null>(null);
  const activeNotesRef = useRef<Map<number, { stop: () => void }>>(new Map());
  const [loadProgress, setLoadProgress] = useState(0);
  const [samplesReady, setSamplesReady] = useState(false);
  const initRef = useRef(false);

  const getContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const initSampler = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;
    const ctx = getContext();
    const sampler = new PianoSampler(ctx);
    sampler.onProgress = (loaded, total) => {
      setLoadProgress(Math.round((loaded / total) * 100));
    };
    samplerRef.current = sampler;
    await sampler.loadAll();
    setSamplesReady(true);
  }, [getContext]);

  const noteOn = useCallback(
    (midi: number, velocity: number = 0.8) => {
      if (midi < 0 || midi > 127) return;

      // Ensure sampler is initialized on first interaction
      if (!initRef.current) {
        initSampler();
      }

      const ctx = getContext();

      // Stop existing note if playing
      const existing = activeNotesRef.current.get(midi);
      if (existing) {
        existing.stop();
        activeNotesRef.current.delete(midi);
      }

      // Try sampled playback
      const sampler = samplerRef.current;
      if (sampler && sampler.ready) {
        const note = sampler.play(midi, velocity);
        if (note) {
          activeNotesRef.current.set(midi, note);
          return;
        }
      }

      // Fallback: better synthesized piano
      const note = createSynthPiano(ctx, midi, velocity);
      activeNotesRef.current.set(midi, note);
    },
    [getContext, initSampler]
  );

  const noteOff = useCallback((midi: number) => {
    const existing = activeNotesRef.current.get(midi);
    if (existing) {
      existing.stop();
      activeNotesRef.current.delete(midi);
    }
  }, []);

  /** Play multiple notes at exactly the same time (aligned chord) */
  const chordOn = useCallback(
    (midiNotes: number[], velocity: number = 0.8) => {
      const valid = midiNotes.filter((m) => m >= 0 && m <= 127);
      if (valid.length === 0) return;

      if (!initRef.current) {
        initSampler();
      }

      const ctx = getContext();

      // Stop any existing notes first
      valid.forEach((midi) => {
        const existing = activeNotesRef.current.get(midi);
        if (existing) {
          existing.stop();
          activeNotesRef.current.delete(midi);
        }
      });

      const sampler = samplerRef.current;
      if (sampler && sampler.ready) {
        const stops = sampler.playChord(valid, velocity);
        stops.forEach((note, midi) => {
          activeNotesRef.current.set(midi, note);
        });
        return;
      }

      // Fallback: synth for each note (same tick = effectively simultaneous)
      valid.forEach((midi) => {
        const note = createSynthPiano(ctx, midi, velocity);
        activeNotesRef.current.set(midi, note);
      });
    },
    [getContext, initSampler]
  );

  /** Stop multiple notes at once */
  const chordOff = useCallback((midiNotes: number[]) => {
    midiNotes.forEach((midi) => {
      const existing = activeNotesRef.current.get(midi);
      if (existing) {
        existing.stop();
        activeNotesRef.current.delete(midi);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      activeNotesRef.current.forEach((note) => note.stop());
      activeNotesRef.current.clear();
    };
  }, []);

  return {
    noteOn,
    noteOff,
    chordOn,
    chordOff,
    getContext,
    initSampler,
    loadProgress,
    samplesReady,
  };
}

// Improved fallback synth piano (used while samples load)
function createSynthPiano(
  ctx: AudioContext,
  midi: number,
  velocity: number
): { stop: () => void } {
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();

  // EQ to warm tone
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = Math.min(frequency * 8, 15000);
  lowpass.Q.value = 0.7;

  lowpass.connect(masterGain);
  masterGain.connect(ctx.destination);

  // Piano has inharmonic partials — each harmonic slightly sharp
  const inharmonicity = 0.0004; // B coefficient
  const harmonics = [
    { n: 1, amp: 1.0 },
    { n: 2, amp: 0.7 },
    { n: 3, amp: 0.35 },
    { n: 4, amp: 0.2 },
    { n: 5, amp: 0.12 },
    { n: 6, amp: 0.07 },
    { n: 7, amp: 0.04 },
    { n: 8, amp: 0.025 },
  ];

  const oscillators: OscillatorNode[] = [];
  const oscGains: GainNode[] = [];

  harmonics.forEach((h) => {
    // Piano inharmonicity: f_n = n * f0 * sqrt(1 + B * n^2)
    const partialFreq = h.n * frequency * Math.sqrt(1 + inharmonicity * h.n * h.n);
    if (partialFreq > 20000) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Mix of sine and triangle for body
    osc.type = h.n <= 2 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(partialFreq, now);
    // Slight random detune for chorus
    osc.detune.setValueAtTime((Math.random() - 0.5) * 3, now);

    // Higher partials decay faster — boosted amplitude
    const partialDecay = 1.5 / (1 + h.n * 0.3);
    gain.gain.setValueAtTime(h.amp * velocity * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(
      h.amp * velocity * 0.35 * 0.001,
      now + partialDecay + 2
    );

    osc.connect(gain);
    gain.connect(lowpass);
    osc.start(now);

    oscillators.push(osc);
    oscGains.push(gain);
  });

  // Hammer noise burst
  const noiseLen = 0.04;
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
  }
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseGain = ctx.createGain();
  const noiseBand = ctx.createBiquadFilter();
  noiseBand.type = "bandpass";
  noiseBand.frequency.value = frequency * 2;
  noiseBand.Q.value = 2;
  noiseGain.gain.setValueAtTime(velocity * 0.15, now);
  noiseSource.connect(noiseBand);
  noiseBand.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseSource.start(now);

  // Envelope — boosted
  const maxVol = velocity * 0.65;
  const decayBase = Math.max(0.5, 3 - (frequency / 1000));
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(maxVol, now + 0.003);
  masterGain.gain.setTargetAtTime(maxVol * 0.3, now + 0.003, decayBase * 0.4);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const t = ctx.currentTime;
    const release = 0.3;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + release);
    setTimeout(() => {
      oscillators.forEach((o) => { try { o.stop(); } catch {} });
    }, release * 1000 + 50);
  };

  // Auto-stop
  setTimeout(stop, decayBase * 3 * 1000);

  return { stop };
}

// 3 octaves = 36 semitones. Keys map to semitone index 0-35 (relative to displayed range).
// Displayed range = baseMidi to baseMidi+35, where baseMidi = 48 + octaveShift*12
// Piano layout: 3 rows of 12 keys each (chromatic)
export const KEYBOARD_MAP: Record<string, number> = {
  // White keys
  a: 0,  // C
  s: 2,  // D
  d: 4,  // E
  f: 5,  // F
  g: 7,  // G
  h: 9,  // A
  j: 11, // B
  k: 12, // C
  l: 14, // D
  ";": 16, // E
  "'": 17, // F
  
  // Black keys
  w: 1,  // C#
  e: 3,  // D#
  t: 6,  // F#
  y: 8,  // G#
  u: 10, // A#
  o: 13, // C#
  p: 15, // D#
};

// Base MIDI for displayed range (C3 when octaveShift=0)
export const DISPLAY_BASE_MIDI = 48;
export const DISPLAY_OCTAVE_SEMITONES = 18; // 1.5 octaves (matching Musical Typing range)

export function getDisplayRange(octaveShift: number): { startMidi: number; endMidi: number } {
  const startMidi = Math.max(0, Math.min(127 - DISPLAY_OCTAVE_SEMITONES, DISPLAY_BASE_MIDI + octaveShift * 12));
  const endMidi = Math.min(127, startMidi + DISPLAY_OCTAVE_SEMITONES - 1);
  return { startMidi, endMidi };
}

export function keyToMidi(key: string, octaveShift: number): number | undefined {
  const semitoneIndex = KEYBOARD_MAP[key];
  if (semitoneIndex === undefined) return undefined;
  const { startMidi } = getDisplayRange(octaveShift);
  return startMidi + semitoneIndex;
}

export function midiToKey(midi: number, octaveShift: number): string | undefined {
  const { startMidi, endMidi } = getDisplayRange(octaveShift);
  if (midi < startMidi || midi > endMidi) return undefined;
  const semitoneIndex = midi - startMidi;
  const entry = Object.entries(KEYBOARD_MAP).find(([, idx]) => idx === semitoneIndex);
  return entry ? entry[0].toUpperCase() : undefined;
}