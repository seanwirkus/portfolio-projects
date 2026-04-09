import React, { useState, useCallback, useEffect, useRef } from "react";
import { PianoKeyboard } from "./components/PianoKeyboard";
import { OctaveIndicator } from "./components/OctaveIndicator";
import { FallingNotes, FallingNote, TargetNote } from "./components/FallingNotes";
import { MidiStatus } from "./components/MidiStatus";
import { ChordPresets } from "./components/ChordPresets";
import { MidiFilePlayer } from "./components/MidiFilePlayer";
import { ProjectManager } from "./components/ProjectManager";
import {
  usePianoAudio,
  KEYBOARD_MAP,
  getMidiNoteInfo,
  getDisplayRange,
  keyToMidi,
} from "./components/usePianoAudio";
import { useProjects } from "./hooks/useProjects";
import { AnalyzedNote } from "./components/NoteAnalyzer";
import { Piano, Volume2, VolumeX, PanelLeftClose, PanelLeftOpen } from "lucide-react";

// Piano range is dynamic: 3 octaves, shifts with octave +/-

let noteIdCounter = 0;

export default function App() {
  const { noteOn, noteOff, chordOn, chordOff, initSampler, loadProgress, samplesReady } =
    usePianoAudio();
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [fallingNotes, setFallingNotes] = useState<FallingNote[]>([]);
  const [midiConnected, setMidiConnected] = useState(false);
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null);
  const [showKeyLabels, setShowKeyLabels] = useState(true);
  const [octaveShift, setOctaveShift] = useState(0);
  const [muted, setMuted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const activeNoteIdsRef = useRef<Map<number, string>>(new Map());
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const progressionTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Tutorial mode state
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStartTime, setTutorialStartTime] = useState<number>(0);
  const [tutorialPausedAt, setTutorialPausedAt] = useState<number | null>(null);
  const [targetNotes, setTargetNotes] = useState<TargetNote[]>([]);
  const [adaptiveSpeed, setAdaptiveSpeed] = useState<number | null>(null);
  const [loadProjectData, setLoadProjectData] = useState<{
    midi: import("@tonejs/midi").Midi;
    project: import("./hooks/useProjects").SavedProject;
  } | null>(null);
  const [hasMidiLoaded, setHasMidiLoaded] = useState(false);

  const { projects, saveProject, loadProject, deleteProject, renameProject } = useProjects();
  const midiPlayerRef = useRef<{ getSaveData: () => import("./components/MidiFilePlayer").MidiSaveData | null }>(null);

  // Initialize sampler on first user interaction
  const ensureInit = useCallback(() => {
    if (!initialized) {
      setInitialized(true);
      initSampler();
    }
  }, [initialized, initSampler]);

  const handleNoteOn = useCallback(
    (midi: number, velocity: number = 0.8) => {
      if (midi < 0 || midi > 127) return;
      ensureInit();
      if (!muted) noteOn(midi, velocity);

      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.add(midi);
        return next;
      });

      const id = `note-${noteIdCounter++}`;
      activeNoteIdsRef.current.set(midi, id);
      setFallingNotes((prev) => [
        ...prev.slice(-500),
        { id, midi, startTime: Date.now(), endTime: null, velocity },
      ]);
    },
    [noteOn, muted, ensureInit]
  );

  const handleNoteOff = useCallback(
    (midi: number) => {
      noteOff(midi);
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });

      const noteId = activeNoteIdsRef.current.get(midi);
      if (noteId) {
        activeNoteIdsRef.current.delete(midi);
        setFallingNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, endTime: Date.now() } : n))
        );
      }
    },
    [noteOff]
  );

  // Stop all notes
  const handleAllNotesOff = useCallback(() => {
    activeNotes.forEach((midi) => handleNoteOff(midi));
    activeNoteIdsRef.current.forEach((_, midi) => {
      noteOff(midi);
    });
    activeNoteIdsRef.current.clear();
    setActiveNotes(new Set());
  }, [activeNotes, handleNoteOff, noteOff]);

  // Chord preset handlers — use chordOn for aligned simultaneous playback
  const handlePlayChord = useCallback(
    (notes: number[], duration?: number) => {
      ensureInit();
      if (!muted) chordOn(notes, 0.7);
      setActiveNotes((prev) => {
        const next = new Set(prev);
        notes.forEach((m) => next.add(m));
        return next;
      });
      const now = Date.now();
      const newFalling = notes.map((midi) => {
        const id = `note-${noteIdCounter++}`;
        activeNoteIdsRef.current.set(midi, id);
        return { id, midi, startTime: now, endTime: null, velocity: 0.7 };
      });
      setFallingNotes((prev) => [...prev.slice(-500), ...newFalling]);
    },
    [chordOn, muted, ensureInit]
  );

  const handleStopChord = useCallback(
    (notes: number[]) => {
      chordOff(notes);
      setActiveNotes((prev) => {
        const next = new Set(prev);
        notes.forEach((m) => next.delete(m));
        return next;
      });
      const now = Date.now();
      const idsToEnd = new Set<string>();
      notes.forEach((midi) => {
        const noteId = activeNoteIdsRef.current.get(midi);
        if (noteId) {
          activeNoteIdsRef.current.delete(midi);
          idsToEnd.add(noteId);
        }
      });
      setFallingNotes((prev) =>
        prev.map((n) => (idsToEnd.has(n.id) ? { ...n, endTime: now } : n))
      );
    },
    [chordOff]
  );

  const handlePlayProgression = useCallback(
    (chords: { notes: number[]; duration: number }[]) => {
      progressionTimeoutsRef.current.forEach(clearTimeout);
      progressionTimeoutsRef.current = [];
      handleAllNotesOff();

      let offset = 0;
      chords.forEach((chord) => {
        const onTimeout = setTimeout(() => {
          if (!muted) chordOn(chord.notes, 0.7);
          setActiveNotes((prev) => {
            const next = new Set(prev);
            chord.notes.forEach((m) => next.add(m));
            return next;
          });
          const now = Date.now();
          chord.notes.forEach((midi) => {
            const id = `note-${noteIdCounter++}`;
            activeNoteIdsRef.current.set(midi, id);
          });
          setFallingNotes((prev) => [
            ...prev.slice(-500),
            ...chord.notes.map((midi) => ({
              id: activeNoteIdsRef.current.get(midi)!,
              midi,
              startTime: now,
              endTime: null as number | null,
              velocity: 0.7,
            })),
          ]);
        }, offset);
        progressionTimeoutsRef.current.push(onTimeout);

        const offTimeout = setTimeout(() => {
          chordOff(chord.notes);
          setActiveNotes((prev) => {
            const next = new Set(prev);
            chord.notes.forEach((m) => next.delete(m));
            return next;
          });
          const now = Date.now();
          const idsToEnd = new Set<string>();
          chord.notes.forEach((midi) => {
            const noteId = activeNoteIdsRef.current.get(midi);
            if (noteId) {
              activeNoteIdsRef.current.delete(midi);
              idsToEnd.add(noteId);
            }
          });
          setFallingNotes((prev) =>
            prev.map((n) => (idsToEnd.has(n.id) ? { ...n, endTime: now } : n))
          );
        }, offset + chord.duration - 80);
        progressionTimeoutsRef.current.push(offTimeout);

        offset += chord.duration;
      });
    },
    [chordOn, chordOff, handleAllNotesOff, muted]
  );

  // Tutorial callbacks
  const handleTutorialStart = useCallback(
    (notes: AnalyzedNote[], duration: number) => {
      ensureInit();
      const targets: TargetNote[] = notes.map((n) => ({
        midi: n.midi,
        time: n.time,
        duration: n.duration,
        voice: n.voice,
        hit: false,
      }));
      setTargetNotes(targets);
      setTutorialStartTime(Date.now());
      setTutorialPausedAt(null);
      setTutorialActive(true);
    },
    [ensureInit]
  );

  const handleTutorialStop = useCallback(() => {
    setTutorialActive(false);
    setTargetNotes([]);
    setTutorialPausedAt(null);
  }, []);

  // Mark target notes as hit when user plays them during tutorial
  useEffect(() => {
    if (!tutorialActive || targetNotes.length === 0) return;

    const elapsed = (Date.now() - tutorialStartTime) / 1000;
    const hitWindow = 0.35; // 350ms tolerance

    let updated = false;
    const newTargets = targetNotes.map((target) => {
      if (target.hit) return target;
      const timeDiff = Math.abs(target.time - elapsed);
      if (timeDiff < hitWindow && activeNotes.has(target.midi)) {
        updated = true;
        return { ...target, hit: true };
      }
      return target;
    });

    if (updated) {
      setTargetNotes(newTargets);
    }
  }, [activeNotes, tutorialActive, targetNotes, tutorialStartTime]);

  // Musical typing (computer keyboard) — batch simultaneous key presses for aligned chords
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const flushScheduledRef = useRef(false);

  useEffect(() => {
    const flushPendingKeys = () => {
      const keys = Array.from(pendingKeysRef.current);
      pendingKeysRef.current.clear();
      flushScheduledRef.current = false;

      if (keys.length === 0) return;

      const midiNotes = keys
        .map((k) => keyToMidi(k, octaveShift))
        .filter((m): m is number => m !== undefined);

      if (midiNotes.length === 0) return;

      ensureInit();
      if (midiNotes.length === 1) {
        handleNoteOn(midiNotes[0], 0.8);
      } else {
        if (!muted) chordOn(midiNotes, 0.8);
        setActiveNotes((prev) => {
          const next = new Set(prev);
          midiNotes.forEach((m) => next.add(m));
          return next;
        });
        const now = Date.now();
        const newFalling = midiNotes.map((midi) => {
          const id = `note-${noteIdCounter++}`;
          activeNoteIdsRef.current.set(midi, id);
          return { id, midi, startTime: now, endTime: null, velocity: 0.8 };
        });
        setFallingNotes((prev) => [...prev.slice(-500), ...newFalling]);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (pressedKeysRef.current.has(key)) return;

      if (e.key === "ArrowLeft" || key === "z") {
        setOctaveShift((s) => Math.max(s - 1, -4));
        return;
      }
      if (e.key === "ArrowRight" || key === "x") {
        setOctaveShift((s) => Math.min(s + 1, 3));
        return;
      }

      const midi = keyToMidi(key, octaveShift);
      if (midi === undefined) return;

      pressedKeysRef.current.add(key);
      pendingKeysRef.current.add(key);

      if (!flushScheduledRef.current) {
        flushScheduledRef.current = true;
        requestAnimationFrame(() => {
          flushPendingKeys();
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!pressedKeysRef.current.has(key)) return;
      pressedKeysRef.current.delete(key);

      const midi = keyToMidi(key, octaveShift);
      if (midi !== undefined) {
        handleNoteOff(midi);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleNoteOn, handleNoteOff, chordOn, octaveShift, muted, ensureInit]);

  // MIDI input
  useEffect(() => {
    let midiAccess: MIDIAccess | null = null;

    const onMidiMessage = (e: MIDIMessageEvent) => {
      const [status, note, velocity] = e.data!;
      const command = status & 0xf0;
      if (command === 0x90 && velocity > 0) {
        handleNoteOn(note, velocity / 127);
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        handleNoteOff(note);
      }
    };

    const connectMidi = async () => {
      try {
        midiAccess = await navigator.requestMIDIAccess();
        const inputs = midiAccess.inputs;

        inputs.forEach((input) => {
          input.onmidimessage = onMidiMessage;
          setMidiConnected(true);
          setMidiDeviceName(input.name || "MIDI Device");
        });

        midiAccess.onstatechange = (e) => {
          const port = (e as any).port;
          if (port.type === "input") {
            if (port.state === "connected") {
              port.onmidimessage = onMidiMessage;
              setMidiConnected(true);
              setMidiDeviceName(port.name || "MIDI Device");
            } else {
              setMidiConnected(false);
              setMidiDeviceName(null);
            }
          }
        };
      } catch (err) {
        console.log("MIDI access not available:", err);
      }
    };

    connectMidi();

    return () => {
      if (midiAccess) {
        midiAccess.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
      }
    };
  }, [handleNoteOn, handleNoteOff]);

  // Clean up old notes
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 15000;
      setFallingNotes((prev) => prev.filter((n) => (n.endTime || Date.now()) > cutoff));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup progression timeouts
  useEffect(() => {
    return () => {
      progressionTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const { startMidi, endMidi } = getDisplayRange(octaveShift);

  return (
    <div className="w-full h-screen flex flex-col bg-[#0a0a15] overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/30 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-colors"
          >
            {sidebarOpen ? (
              <PanelLeftClose size={14} className="text-gray-400" />
            ) : (
              <PanelLeftOpen size={14} className="text-gray-400" />
            )}
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Piano size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm text-white tracking-wide">MIDI Piano</h1>
            <p className="text-[10px] text-gray-500">
              Grand Piano &bull; Use keyboard or MIDI controller
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {tutorialActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-[10px] text-purple-300">Tutorial Mode</span>
              {adaptiveSpeed !== null && adaptiveSpeed < 1 && (
                <span className="text-[9px] text-orange-300 ml-1">
                  ({(adaptiveSpeed).toFixed(2)}x)
                </span>
              )}
            </div>
          )}
          <div className="hidden lg:block mr-4 opacity-70">
            <OctaveIndicator startMidi={startMidi} endMidi={endMidi} />
          </div>
          <MidiStatus
            midiConnected={midiConnected}
            midiDeviceName={midiDeviceName}
            showKeyLabels={showKeyLabels}
            onToggleLabels={() => setShowKeyLabels(!showKeyLabels)}
            octaveShift={octaveShift}
            onOctaveShift={(v) => setOctaveShift(Math.max(-4, Math.min(3, v)))}
          />
          <button
            onClick={() => setMuted(!muted)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10"
          >
            {muted ? (
              <VolumeX size={14} className="text-red-400" />
            ) : (
              <Volume2 size={14} className="text-gray-300" />
            )}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Chords & MIDI Player */}
        <div
          className={`flex-shrink-0 border-r border-white/5 bg-black/20 overflow-y-auto transition-all duration-300 ${
            sidebarOpen ? "w-72" : "w-0 overflow-hidden"
          }`}
        >
          <div className="w-72 p-3 flex flex-col gap-3">
            <ProjectManager
              projects={projects}
              onSave={(name) => {
                const data = midiPlayerRef.current?.getSaveData();
                if (data) saveProject(name, data.midi, data.fileName, data.settings);
              }}
              onLoad={(id) => {
                const result = loadProject(id);
                if (result) setLoadProjectData(result);
              }}
              onDelete={deleteProject}
              onRename={renameProject}
              getSaveData={() => midiPlayerRef.current?.getSaveData() ?? null}
              hasUnsavedMidi={hasMidiLoaded}
            />
            <ChordPresets
              onPlayChord={handlePlayChord}
              onStopChord={handleStopChord}
              onPlayProgression={handlePlayProgression}
              startMidi={startMidi}
              endMidi={endMidi}
            />
            <MidiFilePlayer
              ref={midiPlayerRef}
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
              onAllNotesOff={handleAllNotesOff}
              startMidi={startMidi}
              endMidi={endMidi}
              onTutorialStart={handleTutorialStart}
              onTutorialStop={handleTutorialStop}
              activeNotes={activeNotes}
              onTempoScaleChange={(speed) => setAdaptiveSpeed(speed)}
              loadProjectData={loadProjectData}
              onMidiLoadChange={setHasMidiLoaded}
              onProjectLoaded={() => setLoadProjectData(null)}
            />
          </div>
        </div>

        {/* Falling Notes + Piano area (same width so positions match) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Falling Notes Area */}
          <div className="flex-1 relative overflow-hidden">
            <FallingNotes
              notes={fallingNotes}
              activeNotes={activeNotes}
              startMidi={startMidi}
              endMidi={endMidi}
              octaveShift={octaveShift}
              targetNotes={tutorialActive ? targetNotes : undefined}
              tutorialActive={tutorialActive}
              tutorialStartTime={tutorialActive ? tutorialStartTime : undefined}
              tutorialPausedAt={tutorialPausedAt}
            />

            {/* Hint overlay when no notes */}
            {fallingNotes.length === 0 && !tutorialActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center space-y-3 opacity-30">
                  <p className="text-gray-400 text-sm">Press keys to play (GarageBand Musical Typing)</p>
                  <div className="flex flex-col gap-1 items-center">
                    <p className="text-gray-500 text-xs">White: A–S–D–F–G–H–J–K–L–;–'</p>
                    <p className="text-gray-500 text-xs">Black: W–E–T–Y–U–O–P</p>
                    <p className="text-gray-500 text-xs">Z/X = Octave Shift &bull; Left/Right Arrow = Octave Shift</p>
                  </div>
                  <div className="pt-2 border-t border-white/5 mt-3">
                    <p className="text-gray-500 text-xs">
                      {sidebarOpen
                        ? "Upload a MIDI file and choose a difficulty to start learning"
                        : "Open the sidebar for chord presets & MIDI tutorials"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Piano Keyboard */}
          <div className="w-full border-t border-white/10 bg-gradient-to-t from-black/50 to-transparent">
            <PianoKeyboard
              startMidi={startMidi}
              endMidi={endMidi}
              octaveShift={octaveShift}
              activeNotes={activeNotes}
              onNoteOn={(midi) => handleNoteOn(midi)}
              onNoteOff={handleNoteOff}
            />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-t border-white/5">
        <span className="text-[10px] text-gray-600">
          {getMidiNoteInfo(startMidi).name}{getMidiNoteInfo(startMidi).octave} — {getMidiNoteInfo(endMidi).name}{getMidiNoteInfo(endMidi).octave} &bull;{" "}
          {activeNotes.size > 0
            ? `${activeNotes.size} note${activeNotes.size > 1 ? "s" : ""} playing`
            : "Ready"}
        </span>
        <div className="flex items-center gap-3">
          {initialized && !samplesReady && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500">Loading piano {loadProgress}%</span>
            </div>
          )}
          {samplesReady && (
            <span className="text-[10px] text-green-500/60">Grand Piano Ready</span>
          )}
          <span className="text-[10px] text-gray-600">{fallingNotes.length} notes</span>
        </div>
      </div>
    </div>
  );
}