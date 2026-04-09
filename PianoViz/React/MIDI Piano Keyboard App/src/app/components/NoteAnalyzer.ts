/**
 * Smart Note Analyzer
 * Cleans up MIDI notes for piano playback and learning.
 *
 * - Clamps notes to piano range (with octave shifting)
 * - Removes percussion (channel 10 / drum tracks)
 * - Removes duplicate/overlapping notes
 * - Quantizes timing to a beat grid for cleaner playback
 * - Labels voices for color-coding (melody/bass/harmony)
 */

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface AnalyzedNote {
  midi: number;
  time: number; // seconds
  duration: number; // seconds
  velocity: number;
  voice: "melody" | "bass" | "harmony";
  hand: "left" | "right";
  originalTrack: number;
}

interface RawNote {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  trackIndex: number;
}

// Common percussion instrument names
const DRUM_KEYWORDS = [
  "drum",
  "percussion",
  "kit",
  "cymbal",
  "snare",
  "kick",
  "hi-hat",
  "hihat",
  "tom",
  "clap",
  "cowbell",
  "tambourine",
  "bongo",
  "conga",
];

/**
 * Determine if a track is likely percussion.
 * MIDI channel 10 (index 9) is standard drums, but we also check names.
 */
function isDrumTrack(track: any, trackIndex: number): boolean {
  if (track.channel === 9) return true;

  const name = (track.name || "").toLowerCase();
  const instrument = (track.instrument?.name || "").toLowerCase();

  for (const kw of DRUM_KEYWORDS) {
    if (name.includes(kw) || instrument.includes(kw)) return true;
  }

  // Heuristic: very short average durations likely drums
  if (track.notes.length > 10) {
    const avgDuration =
      track.notes.reduce((s: number, n: any) => s + n.duration, 0) /
      track.notes.length;
    if (avgDuration < 0.08) return true;
  }

  return false;
}

/**
 * Quantize a time value to the nearest grid position.
 */
function quantize(time: number, gridSize: number): number {
  return Math.round(time / gridSize) * gridSize;
}

/**
 * Speed multiplier for each difficulty level.
 * Beginner is slowest, advanced is full speed.
 */
export const DIFFICULTY_SPEED: Record<Difficulty, number> = {
  beginner: 0.5,
  intermediate: 0.75,
  advanced: 1.0,
};

/**
 * Analyze and clean up MIDI data.
 * All difficulties get the same notes — difficulty only changes speed.
 */
export function analyzeMidi(
  midiData: any, // Midi from @tonejs/midi
  difficulty: Difficulty,
  startMidi: number = 36,
  endMidi: number = 96,
  enabledTracks?: boolean[]
): AnalyzedNote[] {
  if (!midiData || !midiData.tracks) return [];

  // Get BPM for quantization grid
  const bpm = midiData.header?.tempos?.[0]?.bpm || 120;
  const beatDuration = 60 / bpm; // seconds per beat

  // Light quantization grid — 16th note resolution to tidy timing
  const gridSize = beatDuration / 4;

  // 1. Collect all raw notes from non-drum, enabled tracks
  const rawNotes: RawNote[] = [];

  midiData.tracks.forEach((track: any, trackIdx: number) => {
    if (enabledTracks && !enabledTracks[trackIdx]) return;
    if (isDrumTrack(track, trackIdx)) return;

    track.notes.forEach((note: any) => {
      let midi = note.midi;
      // Clamp to piano range via octave shifting
      if (midi < startMidi || midi > endMidi) {
        while (midi < startMidi) midi += 12;
        while (midi > endMidi) midi -= 12;
        if (midi < startMidi || midi > endMidi) return;
      }

      rawNotes.push({
        midi,
        time: note.time,
        duration: Math.max(note.duration, 0.05), // min duration
        velocity: note.velocity,
        trackIndex: trackIdx,
      });
    });
  });

  if (rawNotes.length === 0) return [];

  // Sort by time, then pitch descending
  rawNotes.sort((a, b) => a.time - b.time || b.midi - a.midi);

  // 2. Light quantization — snap to 16th-note grid to clean up sloppy timing
  const quantized = rawNotes.map((n) => ({
    ...n,
    time: quantize(n.time, gridSize),
  }));

  // 3. Deduplicate: remove notes at the same quantized time + same pitch
  const deduped: RawNote[] = [];
  const seen = new Set<string>();
  for (const note of quantized) {
    const key = `${note.time.toFixed(4)}-${note.midi}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(note);
    }
  }

  // 4. Remove overlapping notes on the same pitch
  //    (if a note starts before the previous same-pitch note ends, trim it)
  const byPitch = new Map<number, RawNote[]>();
  for (const note of deduped) {
    if (!byPitch.has(note.midi)) byPitch.set(note.midi, []);
    byPitch.get(note.midi)!.push(note);
  }
  const cleaned: RawNote[] = [];
  byPitch.forEach((notes) => {
    notes.sort((a, b) => a.time - b.time);
    for (let i = 0; i < notes.length; i++) {
      const note = { ...notes[i] };
      // Trim duration if next note on same pitch starts before this ends
      if (i + 1 < notes.length) {
        const gap = notes[i + 1].time - note.time;
        if (note.duration > gap && gap > 0) {
          note.duration = gap - 0.01; // tiny gap so noteOff fires before next noteOn
        }
      }
      if (note.duration > 0.01) {
        cleaned.push(note);
      }
    }
  });

  // Re-sort by time
  cleaned.sort((a, b) => a.time - b.time || b.midi - a.midi);

  // 5. Label voices (for color-coding only, not filtering)
  //    Group into time windows, highest = melody, lowest = bass, rest = harmony
  const windowSize = beatDuration / 4;
  const timeSlots = new Map<number, RawNote[]>();
  for (const note of cleaned) {
    const slot = Math.round(note.time / windowSize);
    if (!timeSlots.has(slot)) timeSlots.set(slot, []);
    timeSlots.get(slot)!.push(note);
  }

  const analyzed: AnalyzedNote[] = [];

  timeSlots.forEach((slotNotes) => {
    const sorted = [...slotNotes].sort((a, b) => b.midi - a.midi);
    sorted.forEach((note, idx) => {
      let voice: "melody" | "bass" | "harmony";
      if (idx === 0) {
        voice = "melody";
      } else if (idx === sorted.length - 1 && sorted.length > 1) {
        voice = "bass";
      } else {
        voice = "harmony";
      }

      const hand: "left" | "right" = note.midi >= 60 ? "right" : "left";

      analyzed.push({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: Math.max(0.3, Math.min(0.95, note.velocity)),
        voice,
        hand,
        originalTrack: note.trackIndex,
      });
    });
  });

  analyzed.sort((a, b) => a.time - b.time);
  return analyzed;
}

/**
 * Get summary stats about analyzed notes
 */
export function getAnalysisSummary(notes: AnalyzedNote[]) {
  const melodyCount = notes.filter((n) => n.voice === "melody").length;
  const bassCount = notes.filter((n) => n.voice === "bass").length;
  const harmonyCount = notes.filter((n) => n.voice === "harmony").length;
  const rightHand = notes.filter((n) => n.hand === "right").length;
  const leftHand = notes.filter((n) => n.hand === "left").length;
  const uniquePitches = new Set(notes.map((n) => n.midi)).size;

  const duration =
    notes.length > 0
      ? notes[notes.length - 1].time - notes[0].time
      : 0;
  const notesPerSecond = duration > 0 ? notes.length / duration : 0;

  return {
    totalNotes: notes.length,
    melodyCount,
    bassCount,
    harmonyCount,
    rightHand,
    leftHand,
    uniquePitches,
    notesPerSecond: Math.round(notesPerSecond * 10) / 10,
  };
}
