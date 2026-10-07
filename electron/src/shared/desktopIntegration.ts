export type CloseBehavior = "exit" | "tray" | "mini";

export interface DesktopIntegrationPreferences {
  closeBehavior: CloseBehavior;
  rememberPlaybackPosition: boolean;
  systemMediaControls: boolean;
}

export const DESKTOP_INTEGRATION_STORAGE_KEY = "tiaolv-music:desktop-integration";

export function defaultDesktopIntegrationPreferences(): DesktopIntegrationPreferences {
  return {
    closeBehavior: "exit",
    rememberPlaybackPosition: true,
    systemMediaControls: true
  };
}

export function normalizeDesktopIntegrationPreferences(value: unknown): DesktopIntegrationPreferences {
  const defaults = defaultDesktopIntegrationPreferences();
  if (!value || typeof value !== "object") return defaults;
  const stored = value as Partial<DesktopIntegrationPreferences>;
  return {
    closeBehavior: stored.closeBehavior === "tray" || stored.closeBehavior === "mini"
      ? stored.closeBehavior
      : "exit",
    rememberPlaybackPosition: typeof stored.rememberPlaybackPosition === "boolean"
      ? stored.rememberPlaybackPosition
      : defaults.rememberPlaybackPosition,
    systemMediaControls: typeof stored.systemMediaControls === "boolean"
      ? stored.systemMediaControls
      : defaults.systemMediaControls
  };
}

export function readDesktopIntegrationPreferences(storage: Pick<Storage, "getItem">) {
  try {
    const raw = storage.getItem(DESKTOP_INTEGRATION_STORAGE_KEY);
    return normalizeDesktopIntegrationPreferences(raw ? JSON.parse(raw) : undefined);
  } catch {
    return defaultDesktopIntegrationPreferences();
  }
}

export function writeDesktopIntegrationPreferences(
  storage: Pick<Storage, "setItem">,
  preferences: DesktopIntegrationPreferences
) {
  storage.setItem(
    DESKTOP_INTEGRATION_STORAGE_KEY,
    JSON.stringify(normalizeDesktopIntegrationPreferences(preferences))
  );
}
