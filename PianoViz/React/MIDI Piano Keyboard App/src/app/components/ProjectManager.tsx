import React, { useState, useRef } from "react";
import {
  FolderOpen,
  Save,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileMusic,
  Pencil,
} from "lucide-react";
import type { SavedProject } from "../hooks/useProjects";

interface ProjectManagerProps {
  projects: SavedProject[];
  onSave: (name: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  getSaveData: () => { midi: unknown; fileName: string; settings: unknown } | null;
  hasUnsavedMidi: boolean;
}

export function ProjectManager({
  projects,
  onSave,
  onLoad,
  onDelete,
  onRename,
  getSaveData,
  hasUnsavedMidi,
}: ProjectManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSaveClick = () => {
    const data = getSaveData();
    if (!data) return;
    const name = saveName.trim() || data.fileName.replace(/\.(mid|midi)$/i, "");
    onSave(name);
    setSaveMode(false);
    setSaveName("");
  };

  const handleStartSave = () => {
    const data = getSaveData();
    if (data) {
      setSaveName(data.fileName.replace(/\.(mid|midi)$/i, ""));
      setSaveMode(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleStartRename = (project: SavedProject) => {
    setEditingId(project.id);
    setEditName(project.name);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleConfirmRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
      setEditingId(null);
      setEditName("");
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 transition-colors"
      >
        <FolderOpen size={14} className="text-amber-400" />
        <span className="text-xs text-gray-300">Projects</span>
        {projects.length > 0 && (
          <span className="text-[10px] text-gray-500">({projects.length})</span>
        )}
        <span className="flex-1" />
        {expanded ? (
          <ChevronUp size={12} className="text-gray-500" />
        ) : (
          <ChevronDown size={12} className="text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 px-1">
          {/* Save current */}
          {hasUnsavedMidi && (
            <div className="flex flex-col gap-2">
              {saveMode ? (
                <div className="flex gap-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveClick();
                      if (e.key === "Escape") setSaveMode(false);
                    }}
                    placeholder="Project name"
                    className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                  />
                  <button
                    onClick={handleSaveClick}
                    disabled={!getSaveData()}
                    className="px-2 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setSaveMode(false)}
                    className="px-2 py-1.5 rounded-lg bg-white/5 text-gray-500 text-[10px] hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartSave}
                  disabled={!getSaveData()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                >
                  <Save size={12} />
                  Save current as project
                </button>
              )}
            </div>
          )}

          {/* Project list */}
          <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
            {projects.length === 0 ? (
              <p className="text-[10px] text-gray-500 px-2 py-3 text-center">
                No saved projects. Upload a MIDI file and save it.
              </p>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 group"
                >
                  {editingId === project.id ? (
                    <>
                      <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleConfirmRename();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-200 focus:outline-none focus:border-amber-500/50"
                      />
                      <button
                        onClick={handleConfirmRename}
                        className="text-[9px] text-amber-400 hover:text-amber-300"
                      >
                        OK
                      </button>
                    </>
                  ) : (
                    <>
                      <FileMusic size={10} className="text-gray-500 flex-shrink-0" />
                      <button
                        onClick={() => onLoad(project.id)}
                        className="flex-1 text-left text-[10px] text-gray-300 hover:text-white truncate min-w-0"
                      >
                        {project.name}
                      </button>
                      <span className="text-[9px] text-gray-600 flex-shrink-0">
                        {formatDate(project.updatedAt)}
                      </span>
                      <button
                        onClick={() => handleStartRename(project)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-gray-500 transition-opacity"
                        title="Rename"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(project.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-red-400/80 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 size={10} />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
