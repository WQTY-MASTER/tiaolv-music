import type { AppMode } from "./appMode";

export type StartupHome = AppMode | "last-used";

export const STARTUP_HOME_STORAGE_KEY = "tiaolv-music-startup-home";

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

export function readStartupHome(storage: ReadStorage): StartupHome {
  const stored = storage.getItem(STARTUP_HOME_STORAGE_KEY);
  if (stored === "local" || stored === "last-used") {
    return stored;
  }
  return "streaming";
}

export function writeStartupHome(preference: StartupHome, storage: WriteStorage) {
  storage.setItem(STARTUP_HOME_STORAGE_KEY, preference);
}

export function resolveStartupMode(preference: StartupHome, lastMode: AppMode): AppMode {
  return preference === "last-used" ? lastMode : preference;
}
