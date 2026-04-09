import React, { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { Midi } from "@tonejs/midi";
import type { SavedProject, ProjectSettings } from "../hooks/useProjects";
import {
  Upload,
  Play,
  Pause,
  Square,
  SkipBack,
  ChevronDown,
  ChevronUp,
  FileMusic,
  GraduationCap,
  Zap,
  Brain,
  Music,
  Target,
  BarChart3,
  TrendingDown,
} from "lucide-react";
import {
  analyzeMidi,
  getAnalysisSummary,
  Difficulty,
  AnalyzedNote,
  DIFFICULTY_SPEED,
} from "./NoteAnalyzer";

interface MidiTrackInfo {
  name: string;
  noteCount: number;
  instrument: string;
  enabled: boolean;
  isDrum: boolean;
}

export interface MidiSaveData {
  midi: Midi;
  fileName: string;
  settings: ProjectSettings;
}

interface MidiFilePlayerProps {
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
  onAllNotesOff: () => void;
  startMidi?: number;
  endMidi?: number;
  // Tutorial mode callbacks
  onTutorialStart?: (notes: AnalyzedNote[], duration: number) => void;
  onTutorialStop?: () => void;
  onAnalyzedNotesChange?: (notes: AnalyzedNote[]) => void;
  activeNotes?: Set<number>;
  onTempoScaleChange?: (scale: number) => void;
  // Project load (when user loads a saved project)
  loadProjectData?: { midi: Midi; project: SavedProject } | null;
  onMidiLoadChange?: (hasMidi: boolean) => void;
  onProjectLoaded?: () => void;
}

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; icon: any; color: string; desc: string }
> = {
  beginner: {
    label: "Beginner",
    icon: Music,
    color: "#69db7c",
    desc: "0.5x speed - take it slow",
  },
  intermediate: {
    label: "Intermediate",
    icon: Brain,
    color: "#ffa94d",
    desc: "0.75x speed - steady pace",
  },
  advanced: {
    label: "Advanced",
    icon: Zap,
    color: "#ff6b6b",
    desc: "Full speed - original tempo",
  },
};

export const MidiFilePlayer = forwardRef<
  { getSaveData: () => MidiSaveData | null },
  MidiFilePlayerProps
>(function MidiFilePlayer(
  {
    onNoteOn,
    onNoteOff,
    onAllNotesOff,
    startMidi = 36,
    endMidi = 96,
    onTutorialStart,
    onTutorialStop,
    onAnalyzedNotesChange,
    activeNotes,
    onTempoScaleChange,
    loadProjectData,
    onMidiLoadChange,
    onProjectLoaded,
  },
  ref
) {
  const [expanded, setExpanded] = useState(true);
  const [midiData, setMidiData] = useState<Midi | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tracks, setTracks] = useState<MidiTrackInfo[]>([]);
  const [tempo, setTempo] = useState(120);
  const [tempoScale, setTempoScale] = useState(DIFFICULTY_SPEED["intermediate"]);
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [mode, setMode] = useState<"listen" | "tutorial">("listen");
  const [playAudioInTutorial, setPlayAudioInTutorial] = useState(true);
  const [analyzedNotes, setAnalyzedNotes] = useState<AnalyzedNote[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<ReturnType<
    typeof getAnalysisSummary
  > | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [tutorialScore, setTutorialScore] = useState({
    hits: 0,
    misses: 0,
    total: 0,
  });
  // Adaptive speed state for auto-slowdown
  const [autoSlowdown, setAutoSlowdown] = useState(true);
  const [adaptiveSpeed, setAdaptiveSpeed] = useState(1);
  const [recentResults, setRecentResults] = useState<boolean[]>([]); // true=hit, false=miss

  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const durationRef = useRef(0);
  const tracksEnabledRef = useRef<boolean[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tutorialHitsRef = useRef<Set<number>>(new Set());
  const tutorialMissedRef = useRef<Set<number>>(new Set());
  const adaptiveSpeedRef = useRef(1);
  const recentResultsRef = useRef<boolean[]>([]);
  const userTempoScaleRef = useRef(1);

  useImperativeHandle(ref, () => ({
    getSaveData: (): MidiSaveData | null => {
      if (!midiData || !fileName) return null;
      return {
        midi: midiData,
        fileName,
        settings: {
          difficulty,
          mode,
          playAudioInTutorial,
          tracksEnabled: tracks.map((t) => t.enabled),
          tempoScale,
        },
      };
    },
  }), [midiData, fileName, difficulty, mode, playAudioInTutorial, tracks, tempoScale]);

  // Common percussion track detection
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
  ];

  const isDrumTrackCheck = (track: any): boolean => {
    if (track.channel === 9) return true;
    const name = (track.name || "").toLowerCase();
    const instrument = (track.instrument?.name || "").toLowerCase();
    for (const kw of DRUM_KEYWORDS) {
      if (name.includes(kw) || instrument.includes(kw)) return true;
    }
    if (track.notes.length > 10) {
      const avgDuration =
        track.notes.reduce((s: number, n: any) => s + n.duration, 0) /
        track.notes.length;
      if (avgDuration < 0.08) return true;
    }
    return false;
  };

  // Re-analyze whenever difficulty or tracks change
  const reanalyze = useCallback(
    (midi: Midi | null, diff: Difficulty, enabled?: boolean[]) => {
      if (!midi) {
        setAnalyzedNotes([]);
        setAnalysisSummary(null);
        return;
      }
      const notes = analyzeMidi(midi, diff, startMidi, endMidi, enabled);
      setAnalyzedNotes(notes);
      setAnalysisSummary(getAnalysisSummary(notes));
      onAnalyzedNotesChange?.(notes);
    },
    [startMidi, endMidi, onAnalyzedNotesChange]
  );

  const clearPlayback = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    onAllNotesOff();
  }, [onAllNotesOff]);

  const lastLoadedProjectIdRef = useRef<string | null>(null);

  // Load project when loadProjectData changes
  useEffect(() => {
    if (!loadProjectData) {
      lastLoadedProjectIdRef.current = null;
      return;
    }
    const { midi, project } = loadProjectData;
    if (lastLoadedProjectIdRef.current === project.id) return;
    lastLoadedProjectIdRef.current = project.id;

    clearPlayback();
    playingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setTutorialScore({ hits: 0, misses: 0, total: 0 });

    setMidiData(midi);
    setFileName(project.fileName);
    setDifficulty(project.settings.difficulty);
    setMode(project.settings.mode);
    setPlayAudioInTutorial(project.settings.playAudioInTutorial);
    setTempoScale(project.settings.tempoScale);

    const trackInfos: MidiTrackInfo[] = midi.tracks.map((track, i) => ({
      name: track.name || `Track ${i + 1}`,
      noteCount: track.notes.length,
      instrument: track.instrument?.name || "Piano",
      enabled: project.settings.tracksEnabled[i] ?? (track.notes.length > 0 && !isDrumTrackCheck(track)),
      isDrum: isDrumTrackCheck(track),
    }));
    setTracks(trackInfos);
    tracksEnabledRef.current = trackInfos.map((t) => t.enabled);

    if (midi.header.tempos.length > 0) {
      setTempo(Math.round(midi.header.tempos[0].bpm));
    }

    durationRef.current = midi.duration;
    reanalyze(midi, project.settings.difficulty, trackInfos.map((t) => t.enabled));
    onProjectLoaded?.();
  }, [loadProjectData, clearPlayback, reanalyze, onProjectLoaded]);

  useEffect(() => {
    onMidiLoadChange?.(!!midiData);
  }, [midiData, onMidiLoadChange]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      clearPlayback();
      playingRef.current = false;
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(0);
      setTutorialScore({ hits: 0, misses: 0, total: 0 });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        setMidiData(midi);
        setFileName(file.name);

        const trackInfos: MidiTrackInfo[] = midi.tracks.map((track, i) => ({
          name: track.name || `Track ${i + 1}`,
          noteCount: track.notes.length,
          instrument: track.instrument?.name || "Piano",
          enabled: track.notes.length > 0 && !isDrumTrackCheck(track),
          isDrum: isDrumTrackCheck(track),
        }));
        setTracks(trackInfos);
        tracksEnabledRef.current = trackInfos.map((t) => t.enabled);

        if (midi.header.tempos.length > 0) {
          setTempo(Math.round(midi.header.tempos[0].bpm));
        }

        durationRef.current = midi.duration;

        // Auto-analyze
        reanalyze(
          midi,
          difficulty,
          trackInfos.map((t) => t.enabled)
        );
      } catch (err) {
        console.error("Failed to parse MIDI file:", err);
        setFileName(null);
        setMidiData(null);
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [clearPlayback, difficulty, reanalyze]
  );

  // Listen mode: play notes through audio engine
  const startListenPlayback = useCallback(
    (fromTime: number = 0) => {
      if (!midiData || analyzedNotes.length === 0) return;

      clearPlayback();
      playingRef.current = true;
      pausedRef.current = false;
      setIsPlaying(true);
      setIsPaused(false);

      const scale = 1 / tempoScale;
      const duration = midiData.duration * scale;
      startTimeRef.current = Date.now() - fromTime * 1000 * scale;
      durationRef.current = midiData.duration;

      // Schedule analyzed (filtered) notes
      analyzedNotes.forEach((note) => {
        const noteOnTime = note.time * scale * 1000 - fromTime * scale * 1000;
        const noteOffTime =
          (note.time + note.duration) * scale * 1000 -
          fromTime * scale * 1000;

        if (noteOnTime >= 0) {
          const onTimeout = setTimeout(() => {
            if (!playingRef.current || pausedRef.current) return;
            onNoteOn(note.midi, note.velocity);
          }, noteOnTime);
          timeoutsRef.current.push(onTimeout);
        } else if (noteOffTime > 0) {
          onNoteOn(note.midi, note.velocity);
        }

        if (noteOffTime > 0) {
          const offTimeout = setTimeout(() => {
            if (!playingRef.current) return;
            onNoteOff(note.midi);
          }, Math.max(0, noteOffTime));
          timeoutsRef.current.push(offTimeout);
        }
      });

      // Progress
      progressIntervalRef.current = setInterval(() => {
        if (!playingRef.current || pausedRef.current) return;
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const prog = Math.min(elapsed / duration, 1);
        setProgress(prog);
        if (prog >= 1) stopPlayback();
      }, 50);

      const endTimeout = setTimeout(
        () => stopPlayback(),
        duration * 1000 - fromTime * scale * 1000 + 100
      );
      timeoutsRef.current.push(endTimeout);
    },
    [midiData, analyzedNotes, tempoScale, clearPlayback, onNoteOn, onNoteOff]
  );

  // Tutorial mode: show notes falling, user plays along (optionally hear MIDI audio)
  const startTutorialPlayback = useCallback(
    (fromTime: number = 0) => {
      if (!midiData || analyzedNotes.length === 0) return;

      clearPlayback();
      playingRef.current = true;
      pausedRef.current = false;
      setIsPlaying(true);
      setIsPaused(false);
      tutorialHitsRef.current = new Set();
      tutorialMissedRef.current = new Set();
      setTutorialScore({ hits: 0, misses: 0, total: analyzedNotes.length });

      const scale = 1 / tempoScale;
      const duration = midiData.duration * scale;
      startTimeRef.current = Date.now() - fromTime * 1000 * scale;
      durationRef.current = midiData.duration;

      // Notify parent to show target notes on canvas
      onTutorialStart?.(analyzedNotes, duration);

      // Optionally play MIDI through piano so user hears the song while playing along
      if (playAudioInTutorial) {
        analyzedNotes.forEach((note) => {
          const noteOnTime = note.time * scale * 1000 - fromTime * scale * 1000;
          const noteOffTime =
            (note.time + note.duration) * scale * 1000 -
            fromTime * scale * 1000;

          if (noteOnTime >= 0) {
            const onTimeout = setTimeout(() => {
              if (!playingRef.current || pausedRef.current) return;
              onNoteOn(note.midi, note.velocity);
            }, noteOnTime);
            timeoutsRef.current.push(onTimeout);
          } else if (noteOffTime > 0) {
            onNoteOn(note.midi, note.velocity);
          }

          if (noteOffTime > 0) {
            const offTimeout = setTimeout(() => {
              if (!playingRef.current) return;
              onNoteOff(note.midi);
            }, Math.max(0, noteOffTime));
            timeoutsRef.current.push(offTimeout);
          }
        });
      }

      // Progress
      progressIntervalRef.current = setInterval(() => {
        if (!playingRef.current || pausedRef.current) return;
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const prog = Math.min(elapsed / duration, 1);
        setProgress(prog);
        if (prog >= 1) stopPlayback();
      }, 50);

      const endTimeout = setTimeout(
        () => stopPlayback(),
        duration * 1000 - fromTime * scale * 1000 + 100
      );
      timeoutsRef.current.push(endTimeout);
    },
    [
      midiData,
      analyzedNotes,
      tempoScale,
      playAudioInTutorial,
      clearPlayback,
      onTutorialStart,
      onNoteOn,
      onNoteOff,
    ]
  );

  const startPlayback = useCallback(
    (fromTime: number = 0) => {
      if (mode === "tutorial") {
        startTutorialPlayback(fromTime);
      } else {
        startListenPlayback(fromTime);
      }
    },
    [mode, startListenPlayback, startTutorialPlayback]
  );

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    pausedRef.current = false;
    clearPlayback();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    onTutorialStop?.();
  }, [clearPlayback, onTutorialStop]);

  const pausePlayback = useCallback(() => {
    if (!playingRef.current) return;
    pausedRef.current = true;
    setIsPaused(true);
    const elapsed =
      ((Date.now() - startTimeRef.current) / 1000) * tempoScale;
    pauseTimeRef.current = elapsed;
    clearPlayback();
  }, [clearPlayback, tempoScale]);

  const resumePlayback = useCallback(() => {
    if (!isPaused) return;
    startPlayback(pauseTimeRef.current);
  }, [isPaused, startPlayback]);

  const toggleTrack = useCallback(
    (idx: number) => {
      const newTracks = [...tracks];
      newTracks[idx] = { ...newTracks[idx], enabled: !newTracks[idx].enabled };
      setTracks(newTracks);
      const enabled = newTracks.map((t) => t.enabled);
      tracksEnabledRef.current = enabled;
      reanalyze(midiData, difficulty, enabled);
    },
    [tracks, midiData, difficulty, reanalyze]
  );

  const handleDifficultyChange = useCallback(
    (diff: Difficulty) => {
      setDifficulty(diff);
      // Difficulty controls speed
      const newSpeed = DIFFICULTY_SPEED[diff];
      setTempoScale(newSpeed);
      adaptiveSpeedRef.current = newSpeed;
      setAdaptiveSpeed(newSpeed);
      recentResultsRef.current = [];
      setRecentResults([]);
      reanalyze(
        midiData,
        diff,
        tracks.map((t) => t.enabled)
      );
    },
    [midiData, tracks, reanalyze]
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!midiData) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const seekTime = pct * midiData.duration;

      if (isPlaying) {
        startPlayback(seekTime);
      } else {
        setProgress(pct);
        pauseTimeRef.current = seekTime;
      }
    },
    [midiData, isPlaying, startPlayback]
  );

  // Tutorial scoring: check active notes against target notes
  useEffect(() => {
    if (mode !== "tutorial" || !isPlaying || !activeNotes || !tutorialActive) return;

    const elapsed = (Date.now() - startTimeRef.current) / 1000 * tempoScale;
    const hitWindow = 0.3; // 300ms tolerance

    analyzedNotes.forEach((note, idx) => {
      if (tutorialHitsRef.current.has(idx)) return;
      if (tutorialMissedRef.current.has(idx)) return;
      const timeDiff = note.time - elapsed;
      const absDiff = Math.abs(timeDiff);

      // Note is in the hit window and user is playing the right note
      if (absDiff < hitWindow && activeNotes.has(note.midi)) {
        tutorialHitsRef.current.add(idx);
        setTutorialScore((prev) => ({
          ...prev,
          hits: prev.hits + 1,
        }));
        // Record hit for adaptive speed
        recentResultsRef.current = [...recentResultsRef.current.slice(-9), true];
        setRecentResults([...recentResultsRef.current]);
      } 
      // Note has passed beyond the hit window — missed
      else if (timeDiff < -hitWindow) {
        tutorialMissedRef.current.add(idx);
        setTutorialScore((prev) => ({
          ...prev,
          misses: prev.misses + 1,
        }));
        // Record miss for adaptive speed
        recentResultsRef.current = [...recentResultsRef.current.slice(-9), false];
        setRecentResults([...recentResultsRef.current]);
      }
    });
  }, [activeNotes, mode, isPlaying, analyzedNotes, tempoScale]);

  // Adaptive speed: auto-slowdown when missing notes, speed up when hitting
  useEffect(() => {
    if (!autoSlowdown || mode !== "tutorial" || !isPlaying) return;
    if (recentResults.length < 4) return; // need enough data

    const window = recentResults.slice(-8);
    const hitRate = window.filter(Boolean).length / window.length;

    let newSpeed = adaptiveSpeedRef.current;
    const baseSpeed = tempoScale;

    if (hitRate < 0.3) {
      // Very bad — slow down significantly
      newSpeed = Math.max(0.25, adaptiveSpeedRef.current - 0.15);
    } else if (hitRate < 0.5) {
      // Struggling — slow down
      newSpeed = Math.max(0.25, adaptiveSpeedRef.current - 0.08);
    } else if (hitRate < 0.65) {
      // Somewhat struggling — slow down slightly
      newSpeed = Math.max(0.25, adaptiveSpeedRef.current - 0.03);
    } else if (hitRate > 0.85 && adaptiveSpeedRef.current < baseSpeed) {
      // Doing well — speed back up gradually
      newSpeed = Math.min(baseSpeed, adaptiveSpeedRef.current + 0.05);
    }

    // Only update if meaningful change
    if (Math.abs(newSpeed - adaptiveSpeedRef.current) > 0.02) {
      adaptiveSpeedRef.current = newSpeed;
      setAdaptiveSpeed(newSpeed);
      onTempoScaleChange?.(newSpeed);
    }
  }, [recentResults, autoSlowdown, mode, isPlaying, tempoScale, onTempoScaleChange]);

  const tutorialActive =
    mode === "tutorial" && isPlaying;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const scorePercent =
    tutorialScore.total > 0
      ? Math.round((tutorialScore.hits / tutorialScore.total) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 transition-colors"
      >
        <FileMusic size={14} className="text-blue-400" />
        <span className="text-xs text-gray-300">MIDI Player</span>
        {fileName && (
          <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
            — {fileName}
          </span>
        )}
        <span className="flex-1" />
        {expanded ? (
          <ChevronUp size={12} className="text-gray-500" />
        ) : (
          <ChevronDown size={12} className="text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 px-1">
          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 py-4 px-4 rounded-lg border border-dashed border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/4 cursor-pointer transition-all"
          >
            <Upload size={18} className="text-gray-500" />
            <span className="text-[11px] text-gray-400">
              {fileName
                ? "Click to upload a different file"
                : "Upload a MIDI file (.mid)"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mid,.midi"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {midiData && (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span>{tempo} BPM</span>
                <span>-</span>
                <span>{formatTime(midiData.duration)}</span>
                <span>-</span>
                <span>
                  {midiData.tracks.reduce((s, t) => s + t.notes.length, 0)}{" "}
                  total notes
                </span>
              </div>

              {/* Difficulty Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Difficulty
                </span>
                <div className="flex gap-1">
                  {(
                    Object.entries(DIFFICULTY_CONFIG) as [
                      Difficulty,
                      (typeof DIFFICULTY_CONFIG)[Difficulty]
                    ][]
                  ).map(([key, config]) => {
                    const Icon = config.icon;
                    const isSelected = difficulty === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleDifficultyChange(key)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg border transition-all ${
                          isSelected
                            ? "bg-white/8 border-white/20"
                            : "bg-white/2 border-white/5 hover:bg-white/5 hover:border-white/10"
                        }`}
                        style={{
                          borderColor: isSelected
                            ? config.color + "50"
                            : undefined,
                          boxShadow: isSelected
                            ? `0 0 12px ${config.color}15`
                            : undefined,
                        }}
                      >
                        <Icon
                          size={14}
                          style={{
                            color: isSelected ? config.color : "#666",
                          }}
                        />
                        <span
                          className="text-[9px]"
                          style={{
                            color: isSelected ? config.color : "#888",
                          }}
                        >
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-gray-600">
                  {DIFFICULTY_CONFIG[difficulty].desc}
                </p>
              </div>

              {/* Analysis Summary */}
              {analysisSummary && (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setShowAnalysis(!showAnalysis)}
                    className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <BarChart3 size={10} />
                    <span>
                      {analysisSummary.totalNotes} notes filtered
                    </span>
                    <span className="text-gray-600">
                      ({analysisSummary.notesPerSecond} notes/sec)
                    </span>
                    {showAnalysis ? (
                      <ChevronUp size={10} />
                    ) : (
                      <ChevronDown size={10} />
                    )}
                  </button>
                  {showAnalysis && (
                    <div className="grid grid-cols-3 gap-1 text-[9px]">
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/3">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "#4dabf7" }}
                        />
                        <span className="text-gray-400">
                          Melody: {analysisSummary.melodyCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/3">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "#ff6b6b" }}
                        />
                        <span className="text-gray-400">
                          Bass: {analysisSummary.bassCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/3">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "#69db7c" }}
                        />
                        <span className="text-gray-400">
                          Harmony: {analysisSummary.harmonyCount}
                        </span>
                      </div>
                      <div className="px-2 py-1 rounded bg-white/3 text-gray-500">
                        R: {analysisSummary.rightHand}
                      </div>
                      <div className="px-2 py-1 rounded bg-white/3 text-gray-500">
                        L: {analysisSummary.leftHand}
                      </div>
                      <div className="px-2 py-1 rounded bg-white/3 text-gray-500">
                        Pitches: {analysisSummary.uniquePitches}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode selector */}
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (isPlaying) stopPlayback();
                    setMode("listen");
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[10px] transition-all ${
                    mode === "listen"
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                      : "bg-white/3 border-white/5 text-gray-500 hover:bg-white/5"
                  }`}
                >
                  <Play size={10} />
                  Listen
                </button>
                <button
                  onClick={() => {
                    if (isPlaying) stopPlayback();
                    setMode("tutorial");
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[10px] transition-all ${
                    mode === "tutorial"
                      ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                      : "bg-white/3 border-white/5 text-gray-500 hover:bg-white/5"
                  }`}
                >
                  <GraduationCap size={10} />
                  Tutorial
                </button>
              </div>

              {/* Tutorial score */}
              {mode === "tutorial" && tutorialScore.total > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                  <Target
                    size={14}
                    style={{
                      color:
                        scorePercent >= 80
                          ? "#69db7c"
                          : scorePercent >= 50
                          ? "#ffa94d"
                          : "#ff6b6b",
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-300">
                        Score: {tutorialScore.hits}/{tutorialScore.total}
                      </span>
                      <span
                        style={{
                          color:
                            scorePercent >= 80
                              ? "#69db7c"
                              : scorePercent >= 50
                              ? "#ffa94d"
                              : "#ff6b6b",
                        }}
                      >
                        {scorePercent}%
                      </span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-white/5 mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${scorePercent}%`,
                          background:
                            scorePercent >= 80
                              ? "#69db7c"
                              : scorePercent >= 50
                              ? "#ffa94d"
                              : "#ff6b6b",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Play audio in tutorial toggle */}
              {mode === "tutorial" && (
                <button
                  onClick={() => setPlayAudioInTutorial(!playAudioInTutorial)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] transition-all ${
                    playAudioInTutorial
                      ? "bg-green-500/10 border-green-500/20 text-green-300"
                      : "bg-white/3 border-white/5 text-gray-500 hover:bg-white/5"
                  }`}
                >
                  <Music size={12} />
                  <span>Play song while practicing</span>
                  <span className="flex-1" />
                  <div
                    className={`w-7 h-4 rounded-full relative transition-colors ${
                      playAudioInTutorial ? "bg-green-500/40" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                        playAudioInTutorial
                          ? "left-3.5 bg-green-400"
                          : "left-0.5 bg-gray-500"
                      }`}
                    />
                  </div>
                </button>
              )}

              {/* Auto-slowdown toggle & adaptive speed indicator */}
              {mode === "tutorial" && (
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      setAutoSlowdown(!autoSlowdown);
                      if (!autoSlowdown) {
                        // Reset adaptive speed when re-enabling
                        adaptiveSpeedRef.current = tempoScale;
                        setAdaptiveSpeed(tempoScale);
                        recentResultsRef.current = [];
                        setRecentResults([]);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] transition-all ${
                      autoSlowdown
                        ? "bg-orange-500/10 border-orange-500/20 text-orange-300"
                        : "bg-white/3 border-white/5 text-gray-500 hover:bg-white/5"
                    }`}
                  >
                    <TrendingDown size={12} />
                    <span>Auto Slowdown</span>
                    <span className="flex-1" />
                    <div
                      className={`w-7 h-4 rounded-full relative transition-colors ${
                        autoSlowdown ? "bg-orange-500/40" : "bg-white/10"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                          autoSlowdown
                            ? "left-3.5 bg-orange-400"
                            : "left-0.5 bg-gray-500"
                        }`}
                      />
                    </div>
                  </button>
                  {autoSlowdown && adaptiveSpeed < tempoScale && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/5 border border-orange-500/10">
                      <TrendingDown size={10} className="text-orange-400" />
                      <span className="text-[9px] text-orange-300">
                        Speed adjusted: {(adaptiveSpeed * 100).toFixed(0)}% of {tempoScale}x
                      </span>
                      <span className="flex-1" />
                      <span className="text-[9px] text-orange-400/60">
                        ({(adaptiveSpeed).toFixed(2)}x)
                      </span>
                    </div>
                  )}
                  <p className="text-[9px] text-gray-600">
                    {autoSlowdown
                      ? "Slows down when you miss notes, speeds up as you improve"
                      : "Speed stays constant regardless of accuracy"}
                  </p>
                </div>
              )}

              {/* Transport controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={stopPlayback}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-colors"
                >
                  <Square size={12} className="text-gray-400" />
                </button>
                <button
                  onClick={() => {
                    stopPlayback();
                    setProgress(0);
                    setTutorialScore({ hits: 0, misses: 0, total: 0 });
                  }}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-colors"
                >
                  <SkipBack size={12} className="text-gray-400" />
                </button>
                <button
                  onClick={() => {
                    if (isPlaying && !isPaused) {
                      pausePlayback();
                    } else if (isPaused) {
                      resumePlayback();
                    } else {
                      startPlayback(0);
                    }
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg"
                  style={{
                    background:
                      mode === "tutorial"
                        ? "linear-gradient(to bottom right, #9775fa, #da77f2)"
                        : "linear-gradient(to bottom right, #4dabf7, #9775fa)",
                    boxShadow:
                      mode === "tutorial"
                        ? "0 4px 15px rgba(151, 117, 250, 0.2)"
                        : "0 4px 15px rgba(77, 171, 247, 0.2)",
                  }}
                >
                  {isPlaying && !isPaused ? (
                    <Pause size={16} className="text-white" />
                  ) : (
                    <Play size={16} className="text-white ml-0.5" />
                  )}
                </button>

                {/* Speed */}
                <div className="flex items-center gap-1 ml-auto">
                  {[0.5, 0.75, 1, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => setTempoScale(s)}
                      className={`px-1.5 py-0.5 rounded text-[9px] transition-all ${
                        tempoScale === s
                          ? "bg-blue-500/30 text-blue-300 border border-blue-500/50"
                          : "bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              <div
                className="relative h-2 rounded-full bg-white/5 cursor-pointer overflow-hidden"
                onClick={handleProgressClick}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-none"
                  style={{
                    width: `${progress * 100}%`,
                    background:
                      mode === "tutorial"
                        ? "linear-gradient(to right, #9775fa, #da77f2)"
                        : "linear-gradient(to right, #4dabf7, #9775fa)",
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md transition-none"
                  style={{ left: `calc(${progress * 100}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-600 -mt-1">
                <span>{formatTime(progress * midiData.duration)}</span>
                <span>{formatTime(midiData.duration)}</span>
              </div>

              {/* Track list */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Tracks
                </span>
                <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto">
                  {tracks.map((track, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleTrack(idx)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all ${
                        track.enabled
                          ? "bg-white/5 hover:bg-white/8"
                          : "bg-transparent opacity-40 hover:opacity-60"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full transition-colors ${
                          track.isDrum
                            ? "bg-red-400/50"
                            : track.enabled
                            ? "bg-blue-400"
                            : "bg-gray-600"
                        }`}
                      />
                      <span className="text-[10px] text-gray-300 flex-1 truncate">
                        {track.name}
                        {track.isDrum && (
                          <span className="text-red-400/60 ml-1">(drums)</span>
                        )}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {track.noteCount}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});