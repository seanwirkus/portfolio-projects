import React from "react";
import { Usb, Music, Keyboard } from "lucide-react";

interface MidiStatusProps {
  midiConnected: boolean;
  midiDeviceName: string | null;
  showKeyLabels: boolean;
  onToggleLabels: () => void;
  octaveShift: number;
  onOctaveShift: (shift: number) => void;
}

export function MidiStatus({
  midiConnected,
  midiDeviceName,
  showKeyLabels,
  onToggleLabels,
  octaveShift,
  onOctaveShift,
}: MidiStatusProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* MIDI Status */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
        <Usb size={14} className={midiConnected ? "text-green-400" : "text-gray-500"} />
        <span className="text-xs text-gray-400">
          {midiConnected ? midiDeviceName || "MIDI Connected" : "No MIDI Device"}
        </span>
        <span
          className={`w-2 h-2 rounded-full ${midiConnected ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}
        />
      </div>

      {/* Musical Typing indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
        <Keyboard size={14} className="text-blue-400" />
        <span className="text-xs text-gray-400">Musical Typing Active</span>
      </div>

      {/* Octave controls */}
      <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
        <Music size={14} className="text-purple-400" />
        <span className="text-xs text-gray-400 mr-1">Octave</span>
        <button
          onClick={() => onOctaveShift(octaveShift - 1)}
          className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center justify-center transition-colors"
        >
          -
        </button>
        <span className="text-xs text-gray-200 w-6 text-center">
          {octaveShift > 0 ? `+${octaveShift}` : octaveShift}
        </span>
        <button
          onClick={() => onOctaveShift(octaveShift + 1)}
          className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center justify-center transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
