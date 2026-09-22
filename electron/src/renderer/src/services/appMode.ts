export type AppMode = "local" | "streaming";

const STORAGE_KEY = "listenmusic.app-mode";

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

function browserStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function readAppMode(storage: ReadStorage | undefined = browserStorage()): AppMode {
  return storage?.getItem(STORAGE_KEY) === "streaming" ? "streaming" : "local";
}

export function writeAppMode(
  mode: AppMode,
  storage: WriteStorage | undefined = browserStorage()
) {
  storage?.setItem(STORAGE_KEY, mode);
}
