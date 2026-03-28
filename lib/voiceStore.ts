import type { VoiceEntry } from "./types";

const STORAGE_KEY = "lumevo_voice_library";

export function getAllVoices(): VoiceEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VoiceEntry[]) : [];
  } catch {
    return [];
  }
}

export function getVoice(id: string): VoiceEntry | null {
  return getAllVoices().find((v) => v.id === id) ?? null;
}

export function getVoiceByElevenLabsId(elevenLabsId: string): VoiceEntry | null {
  return getAllVoices().find((v) => v.elevenLabsId === elevenLabsId) ?? null;
}

export function saveVoice(voice: VoiceEntry): VoiceEntry {
  const voices = getAllVoices();
  const idx = voices.findIndex((v) => v.id === voice.id);
  if (idx >= 0) {
    voices[idx] = voice;
  } else {
    voices.unshift(voice);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(voices));
  return voice;
}

export function addVoice(partial: Omit<VoiceEntry, "id" | "createdAt">): VoiceEntry {
  const voice: VoiceEntry = {
    ...partial,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  return saveVoice(voice);
}

export function linkVoiceToProject(voiceId: string, projectId: string): void {
  const voice = getVoice(voiceId);
  if (!voice) return;
  if (!voice.usedInProjects.includes(projectId)) {
    voice.usedInProjects.push(projectId);
    saveVoice(voice);
  }
}

export function deleteVoice(id: string): void {
  const voices = getAllVoices().filter((v) => v.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(voices));
}
