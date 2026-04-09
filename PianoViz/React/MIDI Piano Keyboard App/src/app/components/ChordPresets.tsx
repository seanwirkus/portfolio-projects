import React, { useState, useRef, useCallback } from "react";
import { Music, ChevronDown, ChevronUp } from "lucide-react";

interface ChordDef {
  name: string;
  label: string;
  notes: number[];
  color: string;
}

const ROOT_NOTES = [
  { name: "C", midi: 60 },
  { name: "C#", midi: 61 },
  { name: "D", midi: 62 },
  { name: "D#", midi: 63 },
  { name: "E", midi: 64 },
  { name: "F", midi: 65 },
  { name: "F#", midi: 66 },
  { name: "G", midi: 67 },
  { name: "G#", midi: 68 },
  { name: "A", midi: 69 },
  { name: "A#", midi: 70 },
  { name: "B", midi: 71 },
];

// Intervals from root for each chord type
const CHORD_TYPES: {
  name: string;
  intervals: number[];
  suffix: string;
  color: string;
}[] = [
  { name: "Major", intervals: [0, 4, 7], suffix: "", color: "#4dabf7" },
  { name: "Minor", intervals: [0, 3, 7], suffix: "m", color: "#748ffc" },
  { name: "7th", intervals: [0, 4, 7, 10], suffix: "7", color: "#ffa94d" },
  { name: "Maj7", intervals: [0, 4, 7, 11], suffix: "maj7", color: "#69db7c" },
  { name: "Min7", intervals: [0, 3, 7, 10], suffix: "m7", color: "#9775fa" },
  { name: "Dim", intervals: [0, 3, 6], suffix: "dim", color: "#ff6b6b" },
  { name: "Aug", intervals: [0, 4, 8], suffix: "aug", color: "#da77f2" },
  { name: "Sus2", intervals: [0, 2, 7], suffix: "sus2", color: "#38d9a9" },
  { name: "Sus4", intervals: [0, 5, 7], suffix: "sus4", color: "#3bc9db" },
  { name: "Add9", intervals: [0, 4, 7, 14], suffix: "add9", color: "#ffd43b" },
  { name: "Dim7", intervals: [0, 3, 6, 9], suffix: "dim7", color: "#ff8e72" },
  { name: "9th", intervals: [0, 4, 7, 10, 14], suffix: "9", color: "#a9e34b" },
];

// Common chord progressions
const PROGRESSIONS = [
  {
    name: "I - V - vi - IV (Pop)",
    chords: [
      { root: 0, type: 0 },
      { root: 7, type: 0 },
      { root: 9, type: 1 },
      { root: 5, type: 0 },
    ],
  },
  {
    name: "ii - V - I (Jazz)",
    chords: [
      { root: 2, type: 4 },
      { root: 7, type: 2 },
      { root: 0, type: 3 },
    ],
  },
  {
    name: "I - IV - V - I (Classical)",
    chords: [
      { root: 0, type: 0 },
      { root: 5, type: 0 },
      { root: 7, type: 0 },
      { root: 0, type: 0 },
    ],
  },
  {
    name: "vi - IV - I - V (Emotional)",
    chords: [
      { root: 9, type: 1 },
      { root: 5, type: 0 },
      { root: 0, type: 0 },
      { root: 7, type: 0 },
    ],
  },
  {
    name: "i - VI - III - VII (Epic)",
    chords: [
      { root: 0, type: 1 },
      { root: 8, type: 0 },
      { root: 3, type: 0 },
      { root: 10, type: 0 },
    ],
  },
];

interface ChordPresetsProps {
  onPlayChord: (notes: number[], duration?: number) => void;
  onStopChord: (notes: number[]) => void;
  onPlayProgression: (
    chords: { notes: number[]; duration: number }[]
  ) => void;
  startMidi?: number;
  endMidi?: number;
}

export function ChordPresets({
  onPlayChord,
  onStopChord,
  onPlayProgression,
  startMidi = 36,
  endMidi = 96,
}: ChordPresetsProps) {
  const [selectedRoot, setSelectedRoot] = useState(0); // C
  const [selectedType, setSelectedType] = useState(0); // Major
  const [expanded, setExpanded] = useState(true);
  const [playingChord, setPlayingChord] = useState<string | null>(null);
  const chordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getChordNotes = useCallback(
    (rootOffset: number, typeIndex: number, octaveMidi: number = 60) => {
      const root = octaveMidi + rootOffset;
      const intervals = CHORD_TYPES[typeIndex].intervals;

      // Build a proper piano voicing:
      // 1. Bass note one octave below the root
      // 2. Root + chord tones spread naturally
      const bass = root - 12; // bass note one octave down
      const voicing: number[] = [bass];

      // For triads (3 notes), spread: root, fifth, third+octave
      // For 7ths/extended (4+ notes), use a rootless or shell voicing above bass
      if (intervals.length <= 3) {
        // Triad: bass, root, third, fifth (open voicing)
        voicing.push(root);
        intervals.forEach((i) => {
          if (i > 0) voicing.push(root + i);
        });
      } else {
        // 7th+ chords: bass, then 3rd/7th shell, then extensions
        voicing.push(root); // root
        voicing.push(root + intervals[1]); // 3rd (or 2nd for sus)
        if (intervals.length >= 3) voicing.push(root + intervals[2]); // 5th
        if (intervals.length >= 4) voicing.push(root + intervals[3]); // 7th
        if (intervals.length >= 5) voicing.push(root + intervals[4]); // 9th/extension
      }

      // Fit notes to the piano range — octave-shift rather than discard
      const fitted = voicing.map((n) => {
        while (n < startMidi) n += 12;
        while (n > endMidi) n -= 12;
        return n;
      });

      // Remove duplicates and sort
      return [...new Set(fitted)].sort((a, b) => a - b);
    },
    [startMidi, endMidi]
  );

  const handleChordClick = useCallback(
    (rootIdx: number, typeIdx: number, label: string) => {
      const notes = getChordNotes(
        ROOT_NOTES[rootIdx].midi - 60,
        typeIdx,
        60
      );
      setPlayingChord(label);
      onPlayChord(notes);

      if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current);
      chordTimeoutRef.current = setTimeout(() => {
        onStopChord(notes);
        setPlayingChord(null);
      }, 1200);
    },
    [getChordNotes, onPlayChord, onStopChord]
  );

  const handleProgressionClick = useCallback(
    (progIdx: number) => {
      const prog = PROGRESSIONS[progIdx];
      const rootMidi = ROOT_NOTES[selectedRoot].midi;
      const chords = prog.chords.map((c) => {
        const chordRoot = rootMidi + c.root;
        const intervals = CHORD_TYPES[c.type].intervals;
        // Use same wide voicing as individual chords
        const bass = chordRoot - 12;
        const voicing: number[] = [bass];
        if (intervals.length <= 3) {
          voicing.push(chordRoot);
          intervals.forEach((i) => {
            if (i > 0) voicing.push(chordRoot + i);
          });
        } else {
          voicing.push(chordRoot);
          voicing.push(chordRoot + intervals[1]);
          if (intervals.length >= 3) voicing.push(chordRoot + intervals[2]);
          if (intervals.length >= 4) voicing.push(chordRoot + intervals[3]);
          if (intervals.length >= 5) voicing.push(chordRoot + intervals[4]);
        }

        // Fit notes to the piano range
        const fitted = voicing.map((n) => {
          while (n < startMidi) n += 12;
          while (n > endMidi) n -= 12;
          return n;
        });

        return {
          notes: [...new Set(fitted)].sort((a, b) => a - b),
          duration: 1000,
        };
      });
      onPlayProgression(chords);
    },
    [selectedRoot, onPlayProgression, startMidi, endMidi]
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 transition-colors"
      >
        <Music size={14} className="text-purple-400" />
        <span className="text-xs text-gray-300">Chord Presets</span>
        <span className="flex-1" />
        {expanded ? (
          <ChevronUp size={12} className="text-gray-500" />
        ) : (
          <ChevronDown size={12} className="text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 px-1">
          {/* Root Note Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              Root Note
            </span>
            <div className="flex gap-1 flex-wrap">
              {ROOT_NOTES.map((root, idx) => (
                <button
                  key={root.name}
                  onClick={() => setSelectedRoot(idx)}
                  className={`px-2 py-1 rounded text-[10px] transition-all ${
                    selectedRoot === idx
                      ? "bg-purple-500/30 text-purple-300 border border-purple-500/50"
                      : "bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10"
                  }`}
                >
                  {root.name}
                </button>
              ))}
            </div>
          </div>

          {/* Chord Type Grid */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              Chords in {ROOT_NOTES[selectedRoot].name}
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {CHORD_TYPES.map((type, typeIdx) => {
                const label = `${ROOT_NOTES[selectedRoot].name}${type.suffix}`;
                const isPlaying = playingChord === label;
                return (
                  <button
                    key={type.name}
                    onClick={() =>
                      handleChordClick(selectedRoot, typeIdx, label)
                    }
                    className="relative px-2 py-2 rounded-lg text-xs transition-all overflow-hidden"
                    style={{
                      background: isPlaying
                        ? `${type.color}25`
                        : "rgba(255,255,255,0.03)",
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor: isPlaying
                        ? `${type.color}60`
                        : "rgba(255,255,255,0.06)",
                      color: isPlaying ? type.color : "#9ca3af",
                      boxShadow: isPlaying
                        ? `0 0 12px ${type.color}20`
                        : "none",
                    }}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[11px]">{label}</span>
                      <span
                        className="text-[8px] opacity-50"
                        style={{ color: isPlaying ? type.color : "#6b7280" }}
                      >
                        {type.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progressions */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              Progressions (Key of {ROOT_NOTES[selectedRoot].name})
            </span>
            <div className="flex flex-col gap-1">
              {PROGRESSIONS.map((prog, idx) => (
                <button
                  key={prog.name}
                  onClick={() => handleProgressionClick(idx)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 hover:bg-white/6 border border-white/5 hover:border-white/10 transition-all text-left"
                >
                  <span className="text-[10px] text-blue-400/70">
                    ▶
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {prog.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}