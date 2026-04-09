import React, { useMemo } from "react";
import { getMidiNoteInfo, midiToKey } from "./usePianoAudio";

interface PianoKeyboardProps {
  startMidi: number;
  endMidi: number;
  octaveShift: number;
  activeNotes: Set<number>;
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
}

// Active state accent (subtle blue when key is pressed)
const ACTIVE_ACCENT = "#60a5fa";

export function PianoKeyboard({
  startMidi,
  endMidi,
  octaveShift,
  activeNotes,
  onNoteOn,
  onNoteOff,
}: PianoKeyboardProps) {
  const keys = useMemo(() => {
    const allKeys: {
      midi: number;
      name: string;
      octave: number;
      isBlack: boolean;
      whiteIndex?: number;
    }[] = [];
    let whiteIdx = 0;
    for (let m = startMidi; m <= endMidi; m++) {
      const info = getMidiNoteInfo(m);
      if (!info.isBlack) {
        allKeys.push({ ...info, whiteIndex: whiteIdx });
        whiteIdx++;
      } else {
        allKeys.push({ ...info });
      }
    }
    return { allKeys, whiteCount: whiteIdx };
  }, [startMidi, endMidi]);

  const whiteKeys = keys.allKeys.filter((k) => !k.isBlack);
  const blackKeys = keys.allKeys.filter((k) => k.isBlack);
  const whiteCount = keys.whiteCount;

  // Calculate black key positions based on preceding white key
  const getBlackKeyPosition = (midi: number) => {
    // Find the white key just before this black key
    const prevWhiteMidi = midi - 1;
    const prevWhite = whiteKeys.find((k) => k.midi === prevWhiteMidi);
    if (!prevWhite && prevWhite !== undefined) return null;
    const idx = prevWhite ? prevWhite.whiteIndex! : 0;
    return ((idx + 0.65) / whiteCount) * 100;
  };

  return (
    <div className="relative w-full" style={{ height: "180px" }}>
      {/* White Keys */}
      <div className="absolute inset-0 flex">
        {whiteKeys.map((key) => {
          const isActive = activeNotes.has(key.midi);
          const kbKey = midiToKey(key.midi, octaveShift);
          return (
            <button
              key={key.midi}
              className="relative transition-all duration-75 flex flex-col items-center justify-end pb-2"
              style={{
                flex: `0 0 ${100 / whiteCount}%`,
                background: isActive
                  ? `linear-gradient(to top, #f0f4ff, #e8ecf8)`
                  : "linear-gradient(to top, #fafafa, #f0f0f0)",
                borderTop: "none",
                borderRight: "1px solid #d1d5db",
                borderBottom: isActive ? `3px solid ${ACTIVE_ACCENT}` : "3px solid #9ca3af",
                borderLeft: "none",
                boxShadow: isActive
                  ? `0 0 12px ${ACTIVE_ACCENT}40, inset 0 -3px 8px rgba(0,0,0,0.05)`
                  : "inset 0 -2px 4px rgba(0,0,0,0.06)",
                borderRadius: "0 0 6px 6px",
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                onNoteOn(key.midi);
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerUp={() => onNoteOff(key.midi)}
              onPointerLeave={() => {
                if (isActive) onNoteOff(key.midi);
              }}
            >
              {kbKey && (
                <div
                  className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-[12px] shadow-md z-10 ${
                    isActive ? "bg-blue-500 text-white shadow-blue-500/40" : "bg-white text-gray-800 border border-gray-200"
                  }`}
                  style={{ top: "50%" }}
                >
                  {kbKey}
                </div>
              )}
              <span
                className="text-[10px] font-medium"
                style={{
                  color: isActive ? "#1e40af" : "#374151",
                }}
              >
                {key.name}{key.octave}
              </span>
            </button>
          );
        })}
      </div>

      {/* Black Keys */}
      {blackKeys.map((key) => {
        const isActive = activeNotes.has(key.midi);
        const pos = getBlackKeyPosition(key.midi);
        if (pos === null) return null;
        const kbKey = midiToKey(key.midi, octaveShift);
        const bWidth = (0.6 / whiteCount) * 100;

        return (
          <button
            key={key.midi}
            className="absolute top-0 z-10 flex flex-col items-center justify-end pb-2 transition-all duration-75"
            style={{
              left: `${pos}%`,
              width: `${bWidth}%`,
              height: "60%",
              background: isActive
                ? "linear-gradient(to bottom, #4b5563, #1f2937)"
                : "linear-gradient(to bottom, #374151, #111827)",
              borderRadius: "0 0 5px 5px",
              boxShadow: isActive
                ? `0 0 12px ${ACTIVE_ACCENT}40, 0 3px 8px rgba(0,0,0,0.8)`
                : "0 3px 8px rgba(0,0,0,0.8), inset 0 -2px 4px rgba(0,0,0,0.5)",
              borderTop: "none",
              borderRight: isActive ? `1px solid ${ACTIVE_ACCENT}60` : "1px solid #1f2937",
              borderBottom: isActive ? `1px solid ${ACTIVE_ACCENT}60` : "1px solid #1f2937",
              borderLeft: isActive ? `1px solid ${ACTIVE_ACCENT}60` : "1px solid #1f2937",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNoteOn(key.midi);
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onNoteOff(key.midi);
            }}
            onPointerLeave={() => {
              if (isActive) onNoteOff(key.midi);
            }}
          >
            {kbKey && (
              <div
                className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shadow-md z-10 ${
                  isActive ? "bg-blue-400 text-black shadow-[0_0_12px_rgba(96,165,250,0.6)]" : "bg-gray-800 text-gray-300 border border-white/10"
                }`}
                style={{ top: "50%" }}
              >
                {kbKey}
              </div>
            )}
            <span
              className="text-[9px] font-medium"
              style={{ color: isActive ? "#93c5fd" : "#9ca3af" }}
            >
              {key.name}{key.octave}
            </span>
          </button>
        );
      })}
    </div>
  );
}