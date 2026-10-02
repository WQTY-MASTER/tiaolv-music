export type DesktopLyricsPlayMode = "shuffle" | "sequence" | "single" | "loop";

export type DesktopLyricsAction = "previous" | "toggle" | "next" | "cycle-mode";

export interface DesktopLyricsPreferences {
  locked: boolean;
  translationEnabled: boolean;
  fontSize: number;
}

export interface DesktopLyricsBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopLyricsPlaybackState {
  title: string;
  artist: string;
  isPlaying: boolean;
  playMode: DesktopLyricsPlayMode;
  currentTime: number;
  lyrics?: string;
  lyricsTranslation?: string;
  lyricsFormat?: string;
}

export const DESKTOP_LYRICS_UNLOCK_SHORTCUT = "CommandOrControl+Alt+L";
export const DESKTOP_LYRICS_UNLOCK_SHORTCUT_LABEL = "Ctrl+Alt+L";
export const MIN_DESKTOP_LYRICS_FONT_SIZE = 20;
export const MAX_DESKTOP_LYRICS_FONT_SIZE = 64;

export const DEFAULT_DESKTOP_LYRICS_PREFERENCES: DesktopLyricsPreferences = Object.freeze({
  locked: false,
  translationEnabled: true,
  fontSize: 38
});

export const DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE: DesktopLyricsPlaybackState = Object.freeze({
  title: "调律音乐",
  artist: "暂无歌曲",
  isPlaying: false,
  playMode: "sequence",
  currentTime: 0,
  lyrics: "",
  lyricsTranslation: "",
  lyricsFormat: ""
});

export function clampDesktopLyricsFontSize(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_DESKTOP_LYRICS_PREFERENCES.fontSize;
  }
  return Math.max(
    MIN_DESKTOP_LYRICS_FONT_SIZE,
    Math.min(MAX_DESKTOP_LYRICS_FONT_SIZE, Math.round(value))
  );
}

export function normalizeDesktopLyricsPreferences(value: unknown): DesktopLyricsPreferences {
  const candidate = value && typeof value === "object"
    ? value as Partial<DesktopLyricsPreferences>
    : {};
  return {
    locked: typeof candidate.locked === "boolean"
      ? candidate.locked
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.locked,
    translationEnabled: typeof candidate.translationEnabled === "boolean"
      ? candidate.translationEnabled
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.translationEnabled,
    fontSize: typeof candidate.fontSize === "number" && Number.isFinite(candidate.fontSize)
      ? clampDesktopLyricsFontSize(candidate.fontSize)
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.fontSize
  };
}

export function getDesktopLyricCharacterFill(characterProgress: number, characterIndex: number) {
  if (!Number.isFinite(characterProgress) || !Number.isInteger(characterIndex) || characterIndex < 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, characterProgress - characterIndex));
}
