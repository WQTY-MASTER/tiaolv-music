export const APPEARANCE_STORAGE_KEY = "tiaolv-music-appearance-settings";

export type ThemeMode = "system" | "light" | "dark";
export type AnimationMode = "system" | "full" | "reduced";
export type InterfaceDensity = "compact" | "standard" | "comfortable";
export type AppearanceBackgroundMode = "solid" | "image";
export type AppearancePage = "local" | "settings" | "streaming" | "player";
export type LyricAlignment = "left" | "center" | "right";
export type LyricColorMode = "theme" | "custom";
export type LyricFocusRows = 0 | 1 | 3 | 5;
export type MiniPlayerTheme = "twilight-glass" | "moon-white";
export type MiniPlayerBackgroundMode = "solid" | "gradient" | "cover" | "image";
export type MiniPlayerCoverFit = "cover" | "contain";
export type MiniPlayerAccentMode = "cover" | "custom";
export type MiniPlayerTextMode = "auto" | "custom";
export type MiniPlayerLayoutMode = "auto" | "compact" | "standard" | "wide";
export type PlayerBarPresentation = "full" | "capsule" | "compact";
export type PlayerBarVisibility = "always" | "hover" | "hidden";

export interface AppearanceBackground {
  mode: AppearanceBackgroundMode;
  lightColor: string;
  darkColor: string;
  imagePath: string;
}

export interface AppearancePageBackground extends AppearanceBackground {
  inherit: boolean;
}

export interface AppearanceLyricsPreferences {
  fontFamily: string;
  alignment: LyricAlignment;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  inactiveOpacity: number;
  focusRows: LyricFocusRows;
  wordHighlight: boolean;
  colorMode: LyricColorMode;
  activeColor: string;
  inactiveColor: string;
  sweepColor: string;
}

export interface MiniPlayerPreferences {
  theme: MiniPlayerTheme;
  background: {
    mode: MiniPlayerBackgroundMode;
    solidColor: string;
    gradientStart: string;
    gradientEnd: string;
    fallbackColor: string;
    maskColor: string;
    imagePath: string;
    coverFit: MiniPlayerCoverFit;
    blur: number;
    brightness: number;
    saturation: number;
    opacity: number;
    maskStrength: number;
  };
  appearance: {
    accentMode: MiniPlayerAccentMode;
    accentColor: string;
    textMode: MiniPlayerTextMode;
    textColor: string;
    borderColor: string;
    surfaceOpacity: number;
    blur: number;
    cornerRadius: number;
    borderWidth: number;
    shadowStrength: number;
  };
  layout: {
    mode: MiniPlayerLayoutMode;
    showCover: boolean;
    showAlbum: boolean;
    showEqualizer: boolean;
    showTime: boolean;
    showVolume: boolean;
    showPlayMode: boolean;
    showQueue: boolean;
  };
}

export interface PlayerControlsPreferences {
  presentation: PlayerBarPresentation;
  visibility: PlayerBarVisibility;
  miniShowInTaskbar: boolean;
  miniAlwaysOnTop: boolean;
  openMiniAfterGuide: boolean;
}

export interface AppearancePreferences {
  themeMode: ThemeMode;
  animationMode: AnimationMode;
  lightAccent: string;
  darkAccent: string;
  coverThemeEnabled: boolean;
  fontFamily: string;
  density: InterfaceDensity;
  background: {
    unified: AppearanceBackground;
    pages: Record<AppearancePage, AppearancePageBackground>;
  };
  lyrics: AppearanceLyricsPreferences;
  miniPlayer: MiniPlayerPreferences;
  playerControls: PlayerControlsPreferences;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const pageKeys: AppearancePage[] = ["local", "settings", "streaming", "player"];

function pageBackground(lightColor: string): AppearancePageBackground {
  return {
    inherit: true,
    mode: "solid",
    lightColor,
    darkColor: "#17181a",
    imagePath: ""
  };
}

export function createDefaultMiniPlayerPreferences(): MiniPlayerPreferences {
  return {
    theme: "moon-white",
    background: {
      mode: "gradient",
      solidColor: "#f7f9fa",
      gradientStart: "#f7f9fa",
      gradientEnd: "#f3f6f8",
      fallbackColor: "#f4f5fb",
      maskColor: "#ffffff",
      imagePath: "",
      coverFit: "cover",
      blur: 18,
      brightness: 100,
      saturation: 100,
      opacity: 90,
      maskStrength: 0
    },
    appearance: {
      accentMode: "cover",
      accentColor: "#20c98b",
      textMode: "auto",
      textColor: "#26343d",
      borderColor: "#ffffff",
      surfaceOpacity: 0,
      blur: 18,
      cornerRadius: 24,
      borderWidth: 1,
      shadowStrength: 20
    },
    layout: {
      mode: "auto",
      showCover: true,
      showAlbum: true,
      showEqualizer: false,
      showTime: false,
      showVolume: false,
      showPlayMode: false,
      showQueue: true
    }
  };
}

export function createMiniPlayerThemePreferences(theme: MiniPlayerTheme): MiniPlayerPreferences {
  const defaults = createDefaultMiniPlayerPreferences();
  if (theme === "moon-white") return defaults;
  return {
    ...defaults,
    theme,
    background: {
      ...defaults.background,
      mode: "gradient",
      gradientStart: "#121625",
      gradientEnd: "#27304a",
      fallbackColor: "#171b29",
      maskColor: "#080b14",
      blur: 24,
      brightness: 88,
      saturation: 112,
      opacity: 92,
      maskStrength: 18
    },
    appearance: {
      ...defaults.appearance,
      accentMode: "custom",
      accentColor: "#7c8cff",
      textMode: "custom",
      textColor: "#f4f6ff",
      borderColor: "#7e8aa5",
      surfaceOpacity: 18,
      blur: 24,
      shadowStrength: 30
    }
  };
}

export function createDefaultAppearancePreferences(): AppearancePreferences {
  return {
    themeMode: "system",
    animationMode: "system",
    lightAccent: "#16b88a",
    darkAccent: "#2dd4a7",
    coverThemeEnabled: true,
    fontFamily: "system",
    density: "standard",
    background: {
      unified: {
        mode: "solid",
        lightColor: "#f4f4f7",
        darkColor: "#17181a",
        imagePath: ""
      },
      pages: {
        local: pageBackground("#ffffff"),
        settings: pageBackground("#f4f4f7"),
        streaming: pageBackground("#fafbfe"),
        player: pageBackground("#080e17")
      }
    },
    lyrics: {
      fontFamily: "inherit",
      alignment: "left",
      fontSize: 22,
      fontWeight: 400,
      lineHeight: 1.85,
      inactiveOpacity: 1,
      focusRows: 0,
      wordHighlight: true,
      colorMode: "theme",
      activeColor: "#2f9fc8",
      inactiveColor: "#405d63",
      sweepColor: "#2f9fc8"
    },
    miniPlayer: createDefaultMiniPlayerPreferences(),
    playerControls: {
      presentation: "full",
      visibility: "always",
      miniShowInTaskbar: true,
      miniAlwaysOnTop: true,
      openMiniAfterGuide: false
    }
  };
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? value as T : fallback;
}

function colorValue(value: unknown, fallback: string) {
  return typeof value === "string" && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number, step = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const bounded = Math.min(max, Math.max(min, value));
  return Number((Math.round(bounded / step) * step).toFixed(4));
}

function focusRowsValue(value: unknown, fallback: LyricFocusRows): LyricFocusRows {
  return typeof value === "number" && [0, 1, 3, 5].includes(value)
    ? value as LyricFocusRows
    : fallback;
}

function normalizeBackground(value: unknown, fallback: AppearanceBackground): AppearanceBackground {
  const source = value && typeof value === "object" ? value as Partial<AppearanceBackground> : {};
  return {
    mode: enumValue(source.mode, ["solid", "image"], fallback.mode),
    lightColor: colorValue(source.lightColor, fallback.lightColor),
    darkColor: colorValue(source.darkColor, fallback.darkColor),
    imagePath: stringValue(source.imagePath, fallback.imagePath)
  };
}

export function normalizeMiniPlayerPreferences(value: unknown): MiniPlayerPreferences {
  const defaults = createDefaultMiniPlayerPreferences();
  const source = value && typeof value === "object" ? value as Partial<MiniPlayerPreferences> : {};
  const background = source.background && typeof source.background === "object"
    ? source.background as Partial<MiniPlayerPreferences["background"]> : {};
  const appearance = source.appearance && typeof source.appearance === "object"
    ? source.appearance as Partial<MiniPlayerPreferences["appearance"]> : {};
  const layout = source.layout && typeof source.layout === "object"
    ? source.layout as Partial<MiniPlayerPreferences["layout"]> : {};
  return {
    theme: enumValue(source.theme, ["twilight-glass", "moon-white"], defaults.theme),
    background: {
      mode: enumValue(background.mode, ["solid", "gradient", "cover", "image"], defaults.background.mode),
      solidColor: colorValue(background.solidColor, defaults.background.solidColor),
      gradientStart: colorValue(background.gradientStart, defaults.background.gradientStart),
      gradientEnd: colorValue(background.gradientEnd, defaults.background.gradientEnd),
      fallbackColor: colorValue(background.fallbackColor, defaults.background.fallbackColor),
      maskColor: colorValue(background.maskColor, defaults.background.maskColor),
      imagePath: stringValue(background.imagePath, defaults.background.imagePath),
      coverFit: enumValue(background.coverFit, ["cover", "contain"], defaults.background.coverFit),
      blur: numberValue(background.blur, defaults.background.blur, 0, 48),
      brightness: numberValue(background.brightness, defaults.background.brightness, 50, 150),
      saturation: numberValue(background.saturation, defaults.background.saturation, 50, 180),
      opacity: numberValue(background.opacity, defaults.background.opacity, 0, 100),
      maskStrength: numberValue(background.maskStrength, defaults.background.maskStrength, 0, 100)
    },
    appearance: {
      accentMode: enumValue(appearance.accentMode, ["cover", "custom"], defaults.appearance.accentMode),
      accentColor: colorValue(appearance.accentColor, defaults.appearance.accentColor),
      textMode: enumValue(appearance.textMode, ["auto", "custom"], defaults.appearance.textMode),
      textColor: colorValue(appearance.textColor, defaults.appearance.textColor),
      borderColor: colorValue(appearance.borderColor, defaults.appearance.borderColor),
      surfaceOpacity: numberValue(appearance.surfaceOpacity, defaults.appearance.surfaceOpacity, 0, 100),
      blur: numberValue(appearance.blur, defaults.appearance.blur, 0, 48),
      cornerRadius: numberValue(appearance.cornerRadius, defaults.appearance.cornerRadius, 8, 32),
      borderWidth: numberValue(appearance.borderWidth, defaults.appearance.borderWidth, 0, 4),
      shadowStrength: numberValue(appearance.shadowStrength, defaults.appearance.shadowStrength, 0, 60)
    },
    layout: {
      mode: enumValue(layout.mode, ["auto", "compact", "standard", "wide"], defaults.layout.mode),
      showCover: typeof layout.showCover === "boolean" ? layout.showCover : defaults.layout.showCover,
      showAlbum: typeof layout.showAlbum === "boolean" ? layout.showAlbum : defaults.layout.showAlbum,
      showEqualizer: typeof layout.showEqualizer === "boolean" ? layout.showEqualizer : defaults.layout.showEqualizer,
      showTime: typeof layout.showTime === "boolean" ? layout.showTime : defaults.layout.showTime,
      showVolume: typeof layout.showVolume === "boolean" ? layout.showVolume : defaults.layout.showVolume,
      showPlayMode: typeof layout.showPlayMode === "boolean" ? layout.showPlayMode : defaults.layout.showPlayMode,
      showQueue: typeof layout.showQueue === "boolean" ? layout.showQueue : defaults.layout.showQueue
    }
  };
}

export function normalizeAppearancePreferences(value: unknown): AppearancePreferences {
  const defaults = createDefaultAppearancePreferences();
  const source = value && typeof value === "object" ? value as Partial<AppearancePreferences> : {};
  const background = source.background && typeof source.background === "object" ? source.background : undefined;
  const pages = background?.pages && typeof background.pages === "object" ? background.pages : undefined;
  const lyrics = source.lyrics && typeof source.lyrics === "object"
    ? source.lyrics as Partial<AppearanceLyricsPreferences> : {};
  const playerControls = source.playerControls && typeof source.playerControls === "object"
    ? source.playerControls as Partial<PlayerControlsPreferences> : {};
  const normalizedPages = {} as Record<AppearancePage, AppearancePageBackground>;

  pageKeys.forEach((key) => {
    const fallback = defaults.background.pages[key];
    const pageSource = pages?.[key] && typeof pages[key] === "object"
      ? pages[key] as Partial<AppearancePageBackground>
      : {};
    normalizedPages[key] = {
      ...normalizeBackground(pageSource, fallback),
      inherit: typeof pageSource.inherit === "boolean" ? pageSource.inherit : fallback.inherit
    };
  });

  return {
    themeMode: enumValue(source.themeMode, ["system", "light", "dark"], defaults.themeMode),
    animationMode: enumValue(source.animationMode, ["system", "full", "reduced"], defaults.animationMode),
    lightAccent: colorValue(source.lightAccent, defaults.lightAccent),
    darkAccent: colorValue(source.darkAccent, defaults.darkAccent),
    coverThemeEnabled: typeof source.coverThemeEnabled === "boolean"
      ? source.coverThemeEnabled
      : defaults.coverThemeEnabled,
    fontFamily: enumValue(source.fontFamily, ["system", "segoe", "yahei", "simsun", "arial"], defaults.fontFamily),
    density: enumValue(source.density, ["compact", "standard", "comfortable"], defaults.density),
    background: {
      unified: normalizeBackground(background?.unified, defaults.background.unified),
      pages: normalizedPages
    },
    lyrics: {
      fontFamily: enumValue(lyrics.fontFamily, ["inherit", "yahei", "simsun", "arial"], defaults.lyrics.fontFamily),
      alignment: enumValue(lyrics.alignment, ["left", "center", "right"], defaults.lyrics.alignment),
      fontSize: numberValue(lyrics.fontSize, defaults.lyrics.fontSize, 12, 32),
      fontWeight: numberValue(lyrics.fontWeight, defaults.lyrics.fontWeight, 300, 900, 100),
      lineHeight: numberValue(lyrics.lineHeight, defaults.lyrics.lineHeight, 1.1, 2.5, 0.05),
      inactiveOpacity: numberValue(lyrics.inactiveOpacity, defaults.lyrics.inactiveOpacity, 0.15, 1, 0.05),
      focusRows: focusRowsValue(lyrics.focusRows, defaults.lyrics.focusRows),
      wordHighlight: typeof lyrics.wordHighlight === "boolean" ? lyrics.wordHighlight : defaults.lyrics.wordHighlight,
      colorMode: enumValue(lyrics.colorMode, ["theme", "custom"], defaults.lyrics.colorMode),
      activeColor: colorValue(lyrics.activeColor, defaults.lyrics.activeColor),
      inactiveColor: colorValue(lyrics.inactiveColor, defaults.lyrics.inactiveColor),
      sweepColor: colorValue(lyrics.sweepColor, colorValue(lyrics.activeColor, defaults.lyrics.sweepColor))
    },
    miniPlayer: normalizeMiniPlayerPreferences(source.miniPlayer),
    playerControls: {
      presentation: enumValue(playerControls.presentation, ["full", "capsule", "compact"], defaults.playerControls.presentation),
      visibility: enumValue(playerControls.visibility, ["always", "hover", "hidden"], defaults.playerControls.visibility),
      miniShowInTaskbar: typeof playerControls.miniShowInTaskbar === "boolean"
        ? playerControls.miniShowInTaskbar : defaults.playerControls.miniShowInTaskbar,
      miniAlwaysOnTop: typeof playerControls.miniAlwaysOnTop === "boolean"
        ? playerControls.miniAlwaysOnTop : defaults.playerControls.miniAlwaysOnTop,
      openMiniAfterGuide: typeof playerControls.openMiniAfterGuide === "boolean"
        ? playerControls.openMiniAfterGuide : defaults.playerControls.openMiniAfterGuide
    }
  };
}

export function readAppearancePreferences(storage: StorageLike): AppearancePreferences {
  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved?.lyricSizeVersion !== 1 && saved?.lyrics?.fontSize === 18) {
      saved.lyrics.fontSize = 22;
    }
    if (saved?.lyricWeightVersion !== 1 && saved?.lyrics?.fontWeight === 600) {
      saved.lyrics.fontWeight = 400;
    }
    return normalizeAppearancePreferences(saved);
  } catch {
    return createDefaultAppearancePreferences();
  }
}

export function writeAppearancePreferences(storage: StorageLike, preferences: AppearancePreferences) {
  storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({
    ...normalizeAppearancePreferences(preferences), lyricSizeVersion: 1, lyricWeightVersion: 1
  }));
}

export function resolveDarkTheme(mode: ThemeMode, systemPrefersDark: boolean) {
  return mode === "dark" || (mode === "system" && systemPrefersDark);
}

export function resolveReducedMotion(mode: AnimationMode, systemPrefersReducedMotion: boolean) {
  return mode === "reduced" || (mode === "system" && systemPrefersReducedMotion);
}

export function resolvePageBackground(preferences: AppearancePreferences, page: AppearancePage): AppearanceBackground {
  const pageBackground = preferences.background.pages[page];
  return pageBackground.inherit ? { ...preferences.background.unified } : { ...pageBackground };
}

export function resolveAppearanceFont(value: string) {
  return ({
    system: 'Inter, "SF Pro Display", "Microsoft YaHei", "PingFang SC", sans-serif',
    segoe: '"Segoe UI", "Microsoft YaHei", sans-serif',
    yahei: '"Microsoft YaHei", "PingFang SC", sans-serif',
    simsun: 'SimSun, "Songti SC", serif',
    arial: 'Arial, "Microsoft YaHei", sans-serif',
    inherit: "inherit"
  } as Record<string, string>)[value] ?? 'Inter, "Microsoft YaHei", sans-serif';
}
