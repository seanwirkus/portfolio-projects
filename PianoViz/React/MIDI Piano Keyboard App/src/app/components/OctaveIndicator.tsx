import React from "react";
import { getMidiNoteInfo } from "./usePianoAudio";

interface OctaveIndicatorProps {
  startMidi: number;
  endMidi: number;
}

export function OctaveIndicator({ startMidi, endMidi }: OctaveIndicatorProps) {
  // A standard 88-key piano is MIDI 21 to 108
  // But we'll show the full 0-127 range for completeness, focusing on the playable area
  const range = Array.from({ length: 128 }, (_, i) => i);
  
  return (
    <div className="flex flex-col gap-1 w-full max-w-[200px]">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Piano Overview</span>
        <span className="text-[9px] text-blue-400 font-mono bg-blue-400/10 px-1 rounded">
          Active: {getMidiNoteInfo(startMidi).name}{getMidiNoteInfo(startMidi).octave}
        </span>
      </div>
      <div className="relative h-4 bg-black/40 rounded-sm border border-white/5 overflow-hidden flex items-end p-[1px] gap-[1px]">
        {range.map((midi) => {
          const info = getMidiNoteInfo(midi);
          const isActiveRange = midi >= startMidi && midi <= endMidi;
          
          if (info.isBlack) return null; // Only show white keys for the overview to keep it clean
          
          return (
            <div
              key={midi}
              className={`flex-1 h-full rounded-[0.5px] transition-all duration-300 ${
                isActiveRange 
                  ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] z-10 scale-y-110" 
                  : "bg-white/10"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
