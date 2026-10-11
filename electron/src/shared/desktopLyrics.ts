export type DesktopLyricsPlayMode = "shuffle" | "sequence" | "single" | "loop";

export type DesktopLyricsColorTheme = "cover" | "sunset" | "twilight" | "warm" | "custom";

export type DesktopLyricHighlightMode = "word" | "line";
export type DesktopLyricsFontWeight = "standard" | "bold";
export type DesktopLyricsLineMode = "single" | "double";
export type DesktopLyricsOrientation = "horizontal";
export type DesktopLyricsTextAlign = "left" | "center" | "right";

export type DesktopLyricsAction = "previous" | "toggle" | "next" | "cycle-mode";

export interface DesktopLyricsPreferences {
  enabled: boolean;
  alwaysOnTop: boolean;
  locked: boolean;
  translationEnabled: boolean;
  phoneticEnabled: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: DesktopLyricsFontWeight;
  strokeEnabled: boolean;
  lineMode: DesktopLyricsLineMode;
  orientation: DesktopLyricsOrientation;
  textAlign: DesktopLyricsTextAlign;
  lyricColorTheme: DesktopLyricsColorTheme;
  customPlayedColor: string;
  customUnplayedColor: string;
  panelOpacity: number;
  cornerRadius: number;
  shadowEnabled: boolean;
  animationEnabled: boolean;
}

export interface DesktopLyricsBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopLyricsPlaybackState {
  trackId?: string;
  title: string;
  artist: string;
  isPlaying: boolean;
  playMode: DesktopLyricsPlayMode;
  currentTime: number;
  lyrics?: string;
  lyricsTranslation?: string;
  lyricsPhonetic?: string;
  lyricsFormat?: string;
  source?: string;
  coverAccentColor?: string;
}

export interface DesktopLyricsSnapshot {
  visible: boolean;
  bounds: DesktopLyricsBounds;
  playback: DesktopLyricsPlaybackState;
  preferences: DesktopLyricsPreferences;
}

export const DESKTOP_LYRICS_UNLOCK_SHORTCUT = "CommandOrControl+Alt+L";
export const DESKTOP_LYRICS_UNLOCK_SHORTCUT_LABEL = "Ctrl+Alt+L";
export const MIN_DESKTOP_LYRICS_FONT_SIZE = 20;
export const MAX_DESKTOP_LYRICS_FONT_SIZE = 64;
export const MIN_DESKTOP_LYRICS_WIDTH = 560;
export const MAX_DESKTOP_LYRICS_WIDTH = 1600;
export const MIN_DESKTOP_LYRICS_HEIGHT = 140;
export const MAX_DESKTOP_LYRICS_HEIGHT = 500;

const DESKTOP_LYRIC_THEME_COLORS: Record<Exclude<DesktopLyricsColorTheme, "cover" | "custom">, { played: string; unplayed: string }> = {
  sunset: { played: "#f1a6aa", unplayed: "#eadbd8" },
  twilight: { played: "#9ec5ff", unplayed: "#d8e2f2" },
  warm: { played: "#f4d38a", unplayed: "#ece5d8" }
};

const DEFAULT_DESKTOP_LYRIC_ACCENT = "#5b8cff";
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;

export const DEFAULT_DESKTOP_LYRICS_PREFERENCES: DesktopLyricsPreferences = Object.freeze({
  enabled: false,
  alwaysOnTop: true,
  locked: false,
  translationEnabled: true,
  phoneticEnabled: false,
  fontFamily: "Microsoft YaHei UI",
  fontSize: 38,
  fontWeight: "standard",
  strokeEnabled: true,
  lineMode: "double",
  orientation: "horizontal",
  textAlign: "center",
  lyricColorTheme: "cover",
  customPlayedColor: "#ff8f98",
  customUnplayedColor: "#f4e5e1",
  panelOpacity: 0.72,
  cornerRadius: 18,
  shadowEnabled: true,
  animationEnabled: true
});

export const DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE: DesktopLyricsPlaybackState = Object.freeze({
  trackId: "",
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

export function clampDesktopLyricsBounds(bounds: Pick<DesktopLyricsBounds, "width" | "height">) {
  return {
    width: clampNumber(bounds.width, MIN_DESKTOP_LYRICS_WIDTH, MAX_DESKTOP_LYRICS_WIDTH, 960),
    height: clampNumber(bounds.height, MIN_DESKTOP_LYRICS_HEIGHT, MAX_DESKTOP_LYRICS_HEIGHT, 220)
  };
}

export function normalizeDesktopLyricsPreferences(value: unknown): DesktopLyricsPreferences {
  const candidate = value && typeof value === "object"
    ? value as Partial<DesktopLyricsPreferences>
    : {};
  return {
    enabled: typeof candidate.enabled === "boolean"
      ? candidate.enabled
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.enabled,
    alwaysOnTop: typeof candidate.alwaysOnTop === "boolean"
      ? candidate.alwaysOnTop
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.alwaysOnTop,
    locked: typeof candidate.locked === "boolean"
      ? candidate.locked
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.locked,
    translationEnabled: typeof candidate.translationEnabled === "boolean"
      ? candidate.translationEnabled
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.translationEnabled,
    phoneticEnabled: typeof candidate.phoneticEnabled === "boolean"
      ? candidate.phoneticEnabled
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.phoneticEnabled,
    fontFamily: normalizeFontFamily(candidate.fontFamily),
    fontSize: typeof candidate.fontSize === "number" && Number.isFinite(candidate.fontSize)
      ? clampDesktopLyricsFontSize(candidate.fontSize)
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.fontSize,
    fontWeight: candidate.fontWeight === "bold" || candidate.fontWeight === "standard"
      ? candidate.fontWeight
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.fontWeight,
    strokeEnabled: typeof candidate.strokeEnabled === "boolean"
      ? candidate.strokeEnabled
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.strokeEnabled,
    lineMode: candidate.lineMode === "single" || candidate.lineMode === "double"
      ? candidate.lineMode
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.lineMode,
    orientation: "horizontal",
    textAlign: candidate.textAlign === "left" || candidate.textAlign === "right" || candidate.textAlign === "center"
      ? candidate.textAlign
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.textAlign,
    lyricColorTheme: isDesktopLyricsColorTheme(candidate.lyricColorTheme)
      ? candidate.lyricColorTheme
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.lyricColorTheme,
    customPlayedColor: normalizeHexColor(
      candidate.customPlayedColor ?? (candidate as Partial<DesktopLyricsPreferences> & { customLyricColor?: string }).customLyricColor,
      DEFAULT_DESKTOP_LYRICS_PREFERENCES.customPlayedColor
    ),
    customUnplayedColor: normalizeHexColor(
      candidate.customUnplayedColor,
      DEFAULT_DESKTOP_LYRICS_PREFERENCES.customUnplayedColor
    ),
    panelOpacity: clampNumber(candidate.panelOpacity, 0.25, 1, DEFAULT_DESKTOP_LYRICS_PREFERENCES.panelOpacity, 2),
    cornerRadius: clampNumber(candidate.cornerRadius, 0, 32, DEFAULT_DESKTOP_LYRICS_PREFERENCES.cornerRadius),
    shadowEnabled: typeof candidate.shadowEnabled === "boolean"
      ? candidate.shadowEnabled
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.shadowEnabled,
    animationEnabled: typeof candidate.animationEnabled === "boolean"
      ? candidate.animationEnabled
      : DEFAULT_DESKTOP_LYRICS_PREFERENCES.animationEnabled
  };
}

export function resolveDesktopLyricColors(
  theme: DesktopLyricsColorTheme,
  coverAccentColor?: string,
  customPlayedColor?: string,
  customUnplayedColor?: string
) {
  if (theme === "cover") {
    return {
      played: normalizeHexColor(coverAccentColor, DEFAULT_DESKTOP_LYRIC_ACCENT),
      unplayed: "#edf1f7"
    };
  }
  if (theme === "custom") {
    return {
      played: normalizeHexColor(customPlayedColor, DEFAULT_DESKTOP_LYRICS_PREFERENCES.customPlayedColor),
      unplayed: normalizeHexColor(customUnplayedColor, DEFAULT_DESKTOP_LYRICS_PREFERENCES.customUnplayedColor)
    };
  }
  return DESKTOP_LYRIC_THEME_COLORS[theme];
}

export function resolveDesktopLyricAccent(
  theme: DesktopLyricsColorTheme,
  coverAccentColor?: string,
  customLyricColor?: string
) {
  return resolveDesktopLyricColors(theme, coverAccentColor, customLyricColor).played;
}

export function getDesktopLyricHighlightMode(
  playback: Pick<DesktopLyricsPlaybackState, "source" | "lyricsFormat">
): DesktopLyricHighlightMode {
  const source = playback.source?.trim().toLocaleLowerCase();
  const format = playback.lyricsFormat?.trim().toLocaleUpperCase();
  if (source === "netease") {
    return "line";
  }
  if (source === "qq" || source === "qqmusic") {
    return format === "QRC" ? "word" : "line";
  }
  return format === "QRC" || format === "YRC" ? "word" : "line";
}

function isDesktopLyricsColorTheme(value: unknown): value is DesktopLyricsColorTheme {
  return value === "cover"
    || value === "sunset"
    || value === "twilight"
    || value === "warm"
    || value === "custom";
}

function normalizeHexColor(value: unknown, fallback: string) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value.trim())
    ? value.trim().toLocaleLowerCase()
    : fallback;
}

function normalizeFontFamily(value: unknown) {
  if (typeof value !== "string") return DEFAULT_DESKTOP_LYRICS_PREFERENCES.fontFamily;
  const normalized = value.trim();
  return normalized && normalized.length <= 80 && !/[\r\n\0]/u.test(normalized)
    ? normalized
    : DEFAULT_DESKTOP_LYRICS_PREFERENCES.fontFamily;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number, precision = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const factor = 10 ** precision;
  return Math.round(Math.max(min, Math.min(max, value)) * factor) / factor;
}

export function getDesktopLyricCharacterFill(characterProgress: number, characterIndex: number) {
  if (!Number.isFinite(characterProgress) || !Number.isInteger(characterIndex) || characterIndex < 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, characterProgress - characterIndex));
}
