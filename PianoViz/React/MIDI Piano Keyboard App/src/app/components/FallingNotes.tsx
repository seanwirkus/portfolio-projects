import React, { useEffect, useRef } from "react";
import { getMidiNoteInfo, midiToKey } from "./usePianoAudio";

export interface FallingNote {
  id: string;
  midi: number;
  startTime: number;
  endTime: number | null;
  velocity: number;
}

export interface TargetNote {
  midi: number;
  time: number; // seconds from playback start
  duration: number; // seconds
  voice: "melody" | "bass" | "harmony";
  hit?: boolean; // was it played correctly
}

interface FallingNotesProps {
  notes: FallingNote[];
  activeNotes: Set<number>;
  startMidi: number;
  endMidi: number;
  octaveShift: number;
  // Tutorial mode
  targetNotes?: TargetNote[];
  tutorialActive?: boolean;
  tutorialStartTime?: number; // Date.now() when tutorial started
  tutorialPausedAt?: number | null; // elapsed seconds when paused
}

const NOTE_COLORS: Record<string, string> = {
  C: "#ff6b6b",
  "C#": "#ff8e72",
  D: "#ffa94d",
  "D#": "#ffd43b",
  E: "#a9e34b",
  F: "#69db7c",
  "F#": "#38d9a9",
  G: "#3bc9db",
  "G#": "#4dabf7",
  A: "#748ffc",
  "A#": "#9775fa",
  B: "#da77f2",
};

const VOICE_COLORS: Record<string, string> = {
  melody: "#4dabf7",
  bass: "#ff6b6b",
  harmony: "#69db7c",
};


export function FallingNotes({
  notes,
  activeNotes,
  startMidi,
  endMidi,
  octaveShift,
  targetNotes,
  tutorialActive,
  tutorialStartTime,
  tutorialPausedAt,
}: FallingNotesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  // Track when each note became active for countdown timer
  const noteStartTimesRef = useRef<Map<number, number>>(new Map());

  // Update active note start times
  useEffect(() => {
    const now = Date.now();
    // Add new active notes
    activeNotes.forEach((midi) => {
      if (!noteStartTimesRef.current.has(midi)) {
        noteStartTimesRef.current.set(midi, now);
      }
    });
    // Remove released notes
    noteStartTimesRef.current.forEach((_, midi) => {
      if (!activeNotes.has(midi)) {
        noteStartTimesRef.current.delete(midi);
      }
    });
  }, [activeNotes]);

  // Build key layout for positioning
  const keyLayout = useRef<
    { midi: number; x: number; width: number; isBlack: boolean }[]
  >([]);

  useEffect(() => {
    const layout: typeof keyLayout.current = [];
    const whiteKeyWidth = 100; // will be scaled
    let whiteIndex = 0;

    for (let midi = startMidi; midi <= endMidi; midi++) {
      const info = getMidiNoteInfo(midi);
      if (!info.isBlack) {
        layout.push({
          midi,
          x: whiteIndex * whiteKeyWidth,
          width: whiteKeyWidth,
          isBlack: false,
        });
        whiteIndex++;
      }
    }

    // Now place black keys
    for (let midi = startMidi; midi <= endMidi; midi++) {
      const info = getMidiNoteInfo(midi);
      if (info.isBlack) {
        // Find the white key just before this
        const prevWhite = layout.find(
          (k) => k.midi === midi - 1 && !k.isBlack
        );
        if (prevWhite) {
          layout.push({
            midi,
            x: prevWhite.x + whiteKeyWidth * 0.65,
            width: whiteKeyWidth * 0.65,
            isBlack: true,
          });
        }
      }
    }

    keyLayout.current = layout;
  }, [startMidi, endMidi]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const totalWhiteKeys = keyLayout.current.filter((k) => !k.isBlack).length;
    const whiteKeyBaseWidth = 100;
    const totalWidth = totalWhiteKeys * whiteKeyBaseWidth;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const w = rect.width;
      const h = rect.height;
      const scaleX = w / totalWidth;
      const now = Date.now();
      const pixelsPerMs = 0.15; // speed of falling

      ctx.clearRect(0, 0, w, h);

      // Draw grid lines for white keys
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      keyLayout.current
        .filter((k) => !k.isBlack)
        .forEach((key) => {
          const x = key.x * scaleX;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        });

      // Helper: draw note label (note name + keyboard key) centered in a rect
      const drawNoteLabel = (
        x: number,
        y: number,
        width: number,
        height: number,
        midi: number,
        color: string,
        alpha: number
      ) => {
        const info = getMidiNoteInfo(midi);
        const noteName = `${info.name}${info.octave}`;
        const kbKey = midiToKey(midi, octaveShift);
        const centerX = x + width / 2;

        // Only show labels if note rect is tall enough
        if (height < 18) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Note name (e.g. "C4")
        const fontSize = Math.min(10, width * 0.35);
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = "#fff";

        if (height >= 36 && kbKey) {
          // Enough room for both labels stacked
          ctx.fillText(noteName, centerX, y + height / 2 - fontSize * 0.6);

          // Keyboard key in a small rounded badge
          const badgeY = y + height / 2 + fontSize * 0.7;
          const kbFontSize = Math.min(8, width * 0.28);
          ctx.font = `600 ${kbFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

          const textMetrics = ctx.measureText(kbKey);
          const badgeW = Math.max(textMetrics.width + 6, 14);
          const badgeH = kbFontSize + 4;

          ctx.globalAlpha = alpha * 0.4;
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.beginPath();
          ctx.roundRect(
            centerX - badgeW / 2,
            badgeY - badgeH / 2,
            badgeW,
            badgeH,
            3
          );
          ctx.fill();

          ctx.globalAlpha = alpha * 0.9;
          ctx.fillStyle = "#fff";
          ctx.fillText(kbKey, centerX, badgeY);
        } else {
          // Just the note name
          ctx.fillText(noteName, centerX, y + height / 2);
        }

        ctx.restore();
      };

      // Helper: draw countdown timer ring on active notes
      const drawCountdownRing = (
        x: number,
        y: number,
        width: number,
        midi: number,
        color: string,
        targetDuration?: number
      ) => {
        const pressStart = noteStartTimesRef.current.get(midi);
        if (!pressStart) return;

        const elapsed = (now - pressStart) / 1000;
        // Use target duration or cap at 4 seconds for free play
        const duration = targetDuration || 4;
        const progress = Math.min(elapsed / duration, 1);

        const centerX = x + width / 2;
        const ringRadius = Math.min(width * 0.28, 14);
        const ringY = y - ringRadius - 6;

        // Don't draw above canvas
        if (ringY - ringRadius < 2) return;

        ctx.save();

        // Background ring
        ctx.beginPath();
        ctx.arc(centerX, ringY, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Progress arc (fills clockwise as time passes)
        ctx.beginPath();
        ctx.arc(
          centerX,
          ringY,
          ringRadius,
          -Math.PI / 2,
          -Math.PI / 2 + progress * Math.PI * 2
        );
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Center time text
        const remaining = Math.max(duration - elapsed, 0);
        const timeText = remaining >= 1 ? remaining.toFixed(1) : remaining.toFixed(2);
        const timeFontSize = Math.min(8, ringRadius * 1.1);
        ctx.shadowBlur = 0;
        ctx.font = `bold ${timeFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 0.9;
        ctx.fillText(remaining >= 10 ? remaining.toFixed(0) + "s" : timeText + "s", centerX, ringY);

        ctx.restore();
      };

      // Draw tutorial target notes (if in tutorial mode)
      if (
        tutorialActive &&
        targetNotes &&
        targetNotes.length > 0 &&
        tutorialStartTime
      ) {
        const elapsed =
          tutorialPausedAt != null
            ? tutorialPausedAt
            : (now - tutorialStartTime) / 1000;
        const pixelsPerSec = pixelsPerMs * 1000;
        // "Hit line" is at the bottom of the canvas
        const hitLineY = h;

        // Draw hit zone indicator
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(0, h - 4);
        ctx.lineTo(w, h - 4);
        ctx.stroke();
        ctx.setLineDash([]);

        targetNotes.forEach((target) => {
          const keyInfo = keyLayout.current.find(
            (k) => k.midi === target.midi
          );
          if (!keyInfo) return;

          // Note falls from above: position relative to elapsed time
          // When target.time == elapsed, note bottom should be at hitLineY
          const timeDiff = target.time - elapsed; // seconds until this note arrives
          const bottomY = hitLineY - timeDiff * pixelsPerSec;
          const topY = bottomY - target.duration * pixelsPerSec;

          // Only draw if visible
          if (bottomY < -50 || topY > h + 50) return;

          const x = keyInfo.x * scaleX;
          const noteWidth = keyInfo.width * scaleX;
          const noteHeight = Math.max(bottomY - topY, 6);

          // Color based on voice
          const baseColor = VOICE_COLORS[target.voice] || "#4dabf7";
          const isHit = target.hit === true;
          const isActive = activeNotes.has(target.midi);
          const isPast = timeDiff < -0.5;

          // Target note style - outlined with glow for upcoming, filled when hit
          if (isHit) {
            // Hit: bright fill
            ctx.shadowColor = baseColor;
            ctx.shadowBlur = 20;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.roundRect(x + 1, topY, noteWidth - 2, noteHeight, 4);
            ctx.fillStyle = baseColor;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;

            // Labels on hit notes
            drawNoteLabel(
              x + 1,
              topY,
              noteWidth - 2,
              noteHeight,
              target.midi,
              baseColor,
              0.9
            );
          } else if (isPast) {
            // Missed: dim red
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.roundRect(x + 1, topY, noteWidth - 2, noteHeight, 4);
            ctx.fillStyle = "#ff4444";
            ctx.fill();
            ctx.globalAlpha = 1;

            // Dim labels on missed
            drawNoteLabel(
              x + 1,
              topY,
              noteWidth - 2,
              noteHeight,
              target.midi,
              "#ff4444",
              0.3
            );
          } else {
            // Upcoming: semi-transparent fill with border
            ctx.shadowColor = baseColor;
            ctx.shadowBlur = 10;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.roundRect(x + 1, topY, noteWidth - 2, noteHeight, 4);
            ctx.fillStyle = baseColor;
            ctx.fill();

            // Border
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // If currently in the hit zone (near bottom), pulse
            if (timeDiff >= -0.15 && timeDiff <= 0.15) {
              ctx.shadowBlur = 25;
              ctx.globalAlpha = 0.6;
              ctx.fillStyle = baseColor;
              ctx.fill();
            }

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;

            // Labels on upcoming notes
            drawNoteLabel(
              x + 1,
              topY,
              noteWidth - 2,
              noteHeight,
              target.midi,
              baseColor,
              timeDiff >= -0.15 && timeDiff <= 0.15 ? 0.95 : 0.7
            );

            // If this note is being actively pressed and near hit zone, show countdown
            if (isActive && timeDiff >= -0.5 && timeDiff <= 0.3) {
              drawCountdownRing(
                x + 1,
                topY,
                noteWidth - 2,
                target.midi,
                baseColor,
                target.duration
              );
            }
          }
        });
      }

      // Draw regular falling notes (user played)
      const visibleNotes = notes.filter((note) => {
        const endTime = note.endTime || now;
        const topY = h - (endTime - now) * pixelsPerMs;
        const bottomY = h - (note.startTime - now) * pixelsPerMs;
        return bottomY > 0 && topY < h;
      });

      visibleNotes.forEach((note) => {
        const keyInfo = keyLayout.current.find((k) => k.midi === note.midi);
        if (!keyInfo) return;

        const endTime = note.endTime || now;
        const topY = h - (endTime - now) * pixelsPerMs;
        const bottomY = h - (note.startTime - now) * pixelsPerMs;

        const x = keyInfo.x * scaleX;
        const noteWidth = keyInfo.width * scaleX;
        const noteHeight = Math.max(bottomY - topY, 6);

        const info = getMidiNoteInfo(note.midi);
        const color = NOTE_COLORS[info.name] || "#4dabf7";

        // Glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;

        // Draw note rectangle with rounded corners
        const radius = 4;
        ctx.beginPath();
        ctx.roundRect(x + 1, topY, noteWidth - 2, noteHeight, radius);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fill();

        // Brighter top edge
        ctx.beginPath();
        ctx.roundRect(
          x + 2,
          topY + 1,
          noteWidth - 4,
          Math.min(4, noteHeight - 2),
          radius
        );
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Labels on user-played notes
        drawNoteLabel(x + 1, topY, noteWidth - 2, noteHeight, note.midi, color, 0.9);
      });

      // Draw active note indicators at the bottom
      activeNotes.forEach((midi) => {
        const keyInfo = keyLayout.current.find((k) => k.midi === midi);
        if (!keyInfo) return;
        const x = keyInfo.x * scaleX;
        const noteWidth = keyInfo.width * scaleX;
        const info = getMidiNoteInfo(midi);
        const color = NOTE_COLORS[info.name] || "#4dabf7";

        // Glow at bottom
        const gradient = ctx.createLinearGradient(0, h - 40, 0, h);
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(1, color + "80");
        ctx.fillStyle = gradient;
        ctx.fillRect(x, h - 40, noteWidth, 40);

        // Countdown timer ring for active notes (always show when pressed)
        const pressStart = noteStartTimesRef.current.get(midi);
        if (pressStart) {
          drawCountdownRing(x, h - 44, noteWidth, midi, color);
        }
      });

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [
    notes,
    activeNotes,
    targetNotes,
    tutorialActive,
    tutorialStartTime,
    tutorialPausedAt,
    octaveShift,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
