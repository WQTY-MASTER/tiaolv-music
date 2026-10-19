import type { MiniPlayerPreferences } from "../renderer/src/services/appearanceSettings";
import type { LyricLine } from "../renderer/src/services/lyricParser";

export interface MiniPlayerTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  primary: string;
  secondary: string;
  mark: string;
  liked: boolean;
  history: boolean;
  queueKey?: string;
}

export interface MiniPlayerSnapshot {
  track: MiniPlayerTrack;
  queue: MiniPlayerTrack[];
  playlists: Array<{ id: string; title: string; count: number }>;
  coverUrl?: string;
  isPlaying: boolean;
  progress: number;
  lyric: string;
  lyricLines?: LyricLine[];
  source?: string;
  lyricsFormat?: string;
  lyricsSource?: string;
  themeStyle: Record<string, string>;
  preferences: MiniPlayerPreferences;
  volume: number;
  playMode: "shuffle" | "sequence" | "single" | "loop";
  currentTime: number;
  duration: number;
  alwaysOnTop: boolean;
  showInTaskbar: boolean;
  playlistMutationResult?: { requestId: string; kind: "create" | "add"; error?: string };
}

export interface MiniWindowStatus { locked: boolean; alwaysOnTop: boolean; queueExpanded: boolean }
export interface MiniWindowSnapshot { playback: MiniPlayerSnapshot | null; window: MiniWindowStatus }
export type MiniPlayerAction =
  | { type: "toggle" | "previous" | "next" | "like" | "mode" }
  | { type: "volume"; value: number }
  | { type: "queue-play" | "queue-like" | "queue-remove" | "queue-copy"; key: string }
  | { type: "queue-add"; key: string; playlistId: string; requestId?: string }
  | { type: "queue-create"; key: string; name: string; requestId?: string }
  | { type: "appearance"; preferences: MiniPlayerPreferences }
  | { type: "pin"; value: boolean };
export type MiniWindowCommand =
  | { type: "ready" | "customize" | "minimize" | "return" | "close-editor" }
  | { type: "lock" | "pin"; value: boolean };
export type MiniResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const MINI_RESIZE_EDGES: MiniResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
export const MINI_MIN_WIDTH = 340;
export const MINI_MIN_HEIGHT = 168;
export const MINI_MAX_WIDTH = 720;
export const MINI_MAX_HEIGHT = 320;
export const MINI_QUEUE_HEIGHT = 208;

export function parseMiniPlayerAction(raw: unknown): MiniPlayerAction | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const type = value.type;
  if (typeof type !== "string") return null;
  if (["toggle", "previous", "next", "like", "mode"].includes(type)) {
    return { type } as MiniPlayerAction;
  }
  if (type === "volume" && typeof value.value === "number" && Number.isFinite(value.value) && value.value >= 0 && value.value <= 100) {
    return { type, value: value.value };
  }
  if (typeof value.key !== "string" || !value.key || value.key.length > 512) return null;
  const key = value.key;
  if ((type === "queue-add" || type === "queue-create") && value.requestId !== undefined
    && (typeof value.requestId !== "string" || !value.requestId.trim() || value.requestId.length > 128)) return null;
  const correlation = typeof value.requestId === "string" ? { requestId: value.requestId } : {};
  if (["queue-play", "queue-like", "queue-remove", "queue-copy"].includes(type)) {
    return { type, key } as MiniPlayerAction;
  }
  if (type === "queue-add" && typeof value.playlistId === "string" && value.playlistId && value.playlistId.length <= 512) {
    return { type, key, playlistId: value.playlistId, ...correlation };
  }
  if (type === "queue-create" && typeof value.name === "string" && value.name.trim() && value.name.length <= 40) {
    return { type, key, name: value.name.trim(), ...correlation };
  }
  return null;
}
