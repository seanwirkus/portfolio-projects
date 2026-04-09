import { useState, useCallback, useEffect } from "react";
import { Midi } from "@tonejs/midi";
import type { Difficulty } from "../components/NoteAnalyzer";

const STORAGE_KEY = "piano-viz-projects";
const MAX_PROJECTS = 20;

export interface ProjectSettings {
  difficulty: Difficulty;
  mode: "listen" | "tutorial";
  playAudioInTutorial: boolean;
  tracksEnabled: boolean[];
  tempoScale: number;
}

export interface SavedProject {
  id: string;
  name: string;
  fileName: string;
  midiBase64: string;
  settings: ProjectSettings;
  createdAt: number;
  updatedAt: number;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function loadFromStorage(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(projects: SavedProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.warn("Failed to save projects:", e);
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<SavedProject[]>([]);

  useEffect(() => {
    setProjects(loadFromStorage());
  }, []);

  const saveProject = useCallback(
    (
      name: string,
      midi: Midi,
      fileName: string,
      settings: ProjectSettings
    ): SavedProject => {
      const arr = midi.toArray();
      const bytes = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
      const midiBase64 = arrayBufferToBase64(bytes.buffer as ArrayBuffer);

      const now = Date.now();
      const existing = projects.find((p) => p.name === name);

      const project: SavedProject = {
        id: existing?.id ?? `proj-${now}`,
        name,
        fileName,
        midiBase64,
        settings,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const next = existing
        ? projects.map((p) => (p.id === project.id ? project : p))
        : [project, ...projects].slice(0, MAX_PROJECTS);

      setProjects(next);
      saveToStorage(next);
      return project;
    },
    [projects]
  );

  const loadProject = useCallback((id: string): { midi: Midi; project: SavedProject } | null => {
    const project = projects.find((p) => p.id === id);
    if (!project) return null;

    try {
      const buffer = base64ToArrayBuffer(project.midiBase64);
      const midi = new Midi(buffer);
      return { midi, project };
    } catch (e) {
      console.error("Failed to load project:", e);
      return null;
    }
  }, [projects]);

  const deleteProject = useCallback((id: string) => {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    saveToStorage(next);
  }, [projects]);

  const renameProject = useCallback((id: string, newName: string) => {
    const next = projects.map((p) =>
      p.id === id ? { ...p, name: newName, updatedAt: Date.now() } : p
    );
    setProjects(next);
    saveToStorage(next);
  }, [projects]);

  return { projects, saveProject, loadProject, deleteProject, renameProject };
}
