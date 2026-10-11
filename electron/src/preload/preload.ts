import { contextBridge, ipcRenderer } from "electron";
import { standaloneBackendRequestUrl } from "../shared/backendRoutes";
import type { ShortcutAction, ShortcutPatch, ShortcutSnapshot } from "../shared/shortcuts";
import type { AboutSnapshot, BackendHealth, UpdateCheckResult } from "../shared/about";
import type { CloseBehavior, MainWindowCommand } from "../shared/desktopIntegration";
import type { MiniPlayerPreferences } from "../renderer/src/services/appearanceSettings";
import type { MiniPlayerAction, MiniPlayerSnapshot, MiniResizeEdge, MiniWindowCommand, MiniWindowSnapshot } from "../shared/miniPlayer";
import type {
  DesktopLyricsAction,
  DesktopLyricsBounds,
  DesktopLyricsPlaybackState,
  DesktopLyricsPreferences,
  DesktopLyricsSnapshot
} from "../shared/desktopLyrics";

type TaskbarMediaAction = "previous" | "toggle" | "next";
type TrayMediaAction = TaskbarMediaAction
  | "favorite"
  | "desktop-lyrics"
  | "mini-player"
  | "settings"
  | `play-mode:${"shuffle" | "sequence" | "single" | "loop"}`;

interface SystemTrayState {
  title: string;
  artist: string;
  isPlaying: boolean;
  liked: boolean;
  playMode: "shuffle" | "sequence" | "single" | "loop";
  desktopLyricsVisible: boolean;
  miniPlayerVisible: boolean;
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(standaloneBackendRequestUrl(path), init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

const miniBridge = {
  getMiniPlayerSnapshot: (): Promise<MiniWindowSnapshot | null> => ipcRenderer.invoke("mini-player-get-snapshot"),
  onMiniPlayerSnapshot: (listener: (snapshot: MiniWindowSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: MiniWindowSnapshot) => listener(snapshot);
    ipcRenderer.on("mini-player-snapshot", handler);
    return () => ipcRenderer.removeListener("mini-player-snapshot", handler);
  },
  onMiniPlayerTime: (listener: (time: { currentTime: number; progress: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, time: { currentTime: number; progress: number }) => listener(time);
    ipcRenderer.on("mini-player-time", handler);
    return () => ipcRenderer.removeListener("mini-player-time", handler);
  },
  sendMiniPlayerAction: (action: MiniPlayerAction) => ipcRenderer.send("mini-player-action", action),
  miniWindowCommand: (command: MiniWindowCommand): Promise<boolean> => ipcRenderer.invoke("mini-window-command", command),
  setMiniQueueExpanded: (expanded: boolean): Promise<boolean> => ipcRenderer.invoke("set-mini-queue-expanded", expanded),
  startMiniResize: (edge: MiniResizeEdge): Promise<boolean> => ipcRenderer.invoke("mini-resize-start", edge),
  moveMiniResize: (): Promise<boolean> => ipcRenderer.invoke("mini-resize-move"),
  endMiniResize: (): Promise<boolean> => ipcRenderer.invoke("mini-resize-end"),
  setMiniPlayerAppearance: (preferences: MiniPlayerPreferences): Promise<boolean> => ipcRenderer.invoke("mini-player-set-appearance", preferences)
};

const mainBridge = {
  isWindows: process.platform === "win32",
  mainWindowCommand: (command: MainWindowCommand): Promise<boolean> => ipcRenderer.invoke("main-window-command", command),
  getMainWindowMaximized: (): Promise<boolean | null> => ipcRenderer.invoke("main-window-get-maximized"),
  onMainWindowMaximized: (listener: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => listener(maximized);
    ipcRenderer.on("main-window-maximized", handler);
    return () => ipcRenderer.removeListener("main-window-maximized", handler);
  },
  getShortcuts: (): Promise<ShortcutSnapshot> => ipcRenderer.invoke("get-shortcuts"),
  updateShortcuts: (patch: ShortcutPatch, reset = false): Promise<ShortcutSnapshot> => ipcRenderer.invoke("update-shortcuts", patch, reset),
  setShortcutRecording: (recording: boolean): Promise<ShortcutSnapshot> => ipcRenderer.invoke("set-shortcut-recording", recording),
  onShortcutsChanged: (listener: (snapshot: ShortcutSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: ShortcutSnapshot) => listener(snapshot);
    ipcRenderer.on("shortcuts-changed", handler);
    return () => ipcRenderer.removeListener("shortcuts-changed", handler);
  },
  onShortcutAction: (listener: (action: ShortcutAction) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: ShortcutAction) => listener(action);
    ipcRenderer.on("shortcut-action", handler);
    return () => ipcRenderer.removeListener("shortcut-action", handler);
  },
  ping: (): Promise<BackendHealth> => request("/health"),
  getAboutSnapshot: (): Promise<AboutSnapshot> => ipcRenderer.invoke("get-about-snapshot"),
  checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke("check-for-updates"),
  setAutoUpdateCheck: (enabled: boolean): Promise<AboutSnapshot> => ipcRenderer.invoke("set-auto-update-check", enabled),
  openExternalLink: (url: string): Promise<boolean> => ipcRenderer.invoke("open-external-link", url),
  onUpdateCheckResult: (listener: (result: UpdateCheckResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: UpdateCheckResult) => listener(result);
    ipcRenderer.on("update-check-result", handler);
    return () => ipcRenderer.removeListener("update-check-result", handler);
  },
  getLibrary: () => request("/library/tracks"),
  getPlaylists: () => request("/library/playlists"),
  search: (query: string) =>
    request(`/catalog/search?q=${encodeURIComponent(query)}`),
  play: (trackId: string) =>
    request("/playback/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId })
    }),
  pause: () => request("/playback/pause", { method: "POST" }),
  setVolume: (value: number) =>
    request("/playback/volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    }),
  selectDirectory: async () => {
    const result = await ipcRenderer.invoke("select-music-directory");
    return typeof result === "string" ? result : null;
  },
  selectCoverImage: async () => {
    const result = await ipcRenderer.invoke("select-playlist-cover-image");
    return typeof result === "string" ? result : null;
  },
  readAppearanceBackground: (imagePath: string): Promise<string> => (
    ipcRenderer.invoke("read-appearance-background", imagePath)
  ),
  readCoverDataUrl: (coverUrl: string): Promise<string | null> => (
    ipcRenderer.invoke("read-cover-data-url", coverUrl)
  ),
  getBackgroundCacheStatistics: () => ipcRenderer.invoke("background-cache-statistics"),
  clearBackgroundCache: () => ipcRenderer.invoke("clear-background-cache"),
  getLegacyAggregatePlaylists: () => ipcRenderer.invoke("get-legacy-aggregate-playlists"),
  uploadCloudAudio: () => ipcRenderer.invoke("upload-cloud-audio"),
  downloadCloudTrack: (audioUrl: string, fileName: string) => (
    ipcRenderer.invoke("download-cloud-track", audioUrl, fileName)
  ),
  enterMiniMode: (options: { showInTaskbar: boolean; alwaysOnTop: boolean }) => ipcRenderer.invoke("enter-mini-mode", options),
  exitMiniMode: () => ipcRenderer.invoke("exit-mini-mode"),
  setMiniQueueExpanded: (expanded: boolean) => ipcRenderer.invoke("set-mini-queue-expanded", expanded),
  updateMiniPlayerSnapshot: (snapshot: MiniPlayerSnapshot) => ipcRenderer.send("update-mini-player-snapshot", snapshot),
  updateMiniPlayerTime: (currentTime: number, progress: number) => ipcRenderer.send("update-mini-player-time", currentTime, progress),
  onMiniPlayerAction: (listener: (action: MiniPlayerAction) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: MiniPlayerAction) => listener(action);
    ipcRenderer.on("mini-player-action", handler);
    return () => ipcRenderer.removeListener("mini-player-action", handler);
  },
  onMiniModeVisibility: (listener: (visible: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, visible: boolean) => listener(visible);
    ipcRenderer.on("mini-mode-visibility", handler);
    return () => ipcRenderer.removeListener("mini-mode-visibility", handler);
  },
  setTaskbarThumbnailButtons: (enabled: boolean, isPlaying: boolean) => (
    ipcRenderer.invoke("set-taskbar-thumbnail-buttons", enabled, isPlaying)
  ),
  updateTaskbarPlaybackState: (isPlaying: boolean) => (
    ipcRenderer.invoke("update-taskbar-playback-state", isPlaying)
  ),
  onTaskbarMediaAction: (listener: (action: TaskbarMediaAction) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: TaskbarMediaAction) => listener(action);
    ipcRenderer.on("taskbar-media-action", handler);
    return () => ipcRenderer.removeListener("taskbar-media-action", handler);
  },
  setSystemTrayEnabled: (enabled: boolean, state: SystemTrayState) => (
    ipcRenderer.invoke("set-system-tray-enabled", enabled, state)
  ),
  updateSystemTrayState: (state: SystemTrayState) => (
    ipcRenderer.invoke("update-system-tray-state", state)
  ),
  onTrayMediaAction: (listener: (action: TrayMediaAction) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: TrayMediaAction) => listener(action);
    ipcRenderer.on("tray-media-action", handler);
    return () => ipcRenderer.removeListener("tray-media-action", handler);
  },
  setCloseBehavior: (behavior: CloseBehavior): Promise<CloseBehavior> => (
    ipcRenderer.invoke("set-close-behavior", behavior)
  ),
  onWindowCloseBehavior: (listener: (behavior: CloseBehavior) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, behavior: CloseBehavior) => listener(behavior);
    ipcRenderer.on("window-close-behavior", handler);
    return () => ipcRenderer.removeListener("window-close-behavior", handler);
  },
  getLaunchAtStartup: (): Promise<boolean> => ipcRenderer.invoke("get-launch-at-startup"),
  setLaunchAtStartup: (enabled: boolean): Promise<boolean> => (
    ipcRenderer.invoke("set-launch-at-startup", enabled)
  ),
  toggleDesktopLyricsWindow: () => ipcRenderer.invoke("toggle-desktop-lyrics-window"),
  closeDesktopLyricsWindow: () => ipcRenderer.invoke("close-desktop-lyrics-window"),
  getDesktopLyricsSnapshot: (): Promise<DesktopLyricsSnapshot | null> => (
    ipcRenderer.invoke("get-desktop-lyrics-snapshot")
  ),
  updateDesktopLyricsPlaybackState: (state: DesktopLyricsPlaybackState) => {
    ipcRenderer.send("update-desktop-lyrics-playback-state", state);
  },
  updateDesktopLyricsTime: (currentTime: number, allowRewind = false) => {
    ipcRenderer.send("update-desktop-lyrics-time", currentTime, allowRewind);
  },
  updateDesktopLyricsPreferences: (patch: Partial<DesktopLyricsPreferences>) => (
    ipcRenderer.invoke("update-desktop-lyrics-preferences", patch)
  ),
  updateDesktopLyricsBounds: (bounds: Pick<DesktopLyricsBounds, "width" | "height">) => (
    ipcRenderer.invoke("update-desktop-lyrics-bounds", bounds)
  ),
  sendDesktopLyricsAction: (action: DesktopLyricsAction) => {
    ipcRenderer.send("desktop-lyrics-action", action);
  },
  onDesktopLyricsPlaybackState: (listener: (state: DesktopLyricsPlaybackState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: DesktopLyricsPlaybackState) => listener(state);
    ipcRenderer.on("desktop-lyrics-playback-state", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-playback-state", handler);
  },
  onDesktopLyricsTime: (listener: (currentTime: number, allowRewind: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, currentTime: number, allowRewind: boolean) => (
      listener(currentTime, Boolean(allowRewind))
    );
    ipcRenderer.on("desktop-lyrics-time", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-time", handler);
  },
  onDesktopLyricsPreferences: (listener: (preferences: DesktopLyricsPreferences) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, preferences: DesktopLyricsPreferences) => listener(preferences);
    ipcRenderer.on("desktop-lyrics-preferences", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-preferences", handler);
  },
  onDesktopLyricsBoundsChanged: (listener: (bounds: DesktopLyricsBounds) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, bounds: DesktopLyricsBounds) => listener(bounds);
    ipcRenderer.on("desktop-lyrics-bounds-changed", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-bounds-changed", handler);
  },
  onDesktopLyricsHoverState: (listener: (pointerInside: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, pointerInside: boolean) => listener(Boolean(pointerInside));
    ipcRenderer.on("desktop-lyrics-hover-state", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-hover-state", handler);
  },
  onDesktopLyricsUnlockHotspot: (listener: (active: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, active: boolean) => listener(Boolean(active));
    ipcRenderer.on("desktop-lyrics-unlock-hotspot", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-unlock-hotspot", handler);
  },
  onDesktopLyricsVisibilityChanged: (listener: (visible: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, visible: boolean) => listener(Boolean(visible));
    ipcRenderer.on("desktop-lyrics-visibility-changed", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-visibility-changed", handler);
  },
  onDesktopLyricsAction: (listener: (action: DesktopLyricsAction) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: DesktopLyricsAction) => listener(action);
    ipcRenderer.on("desktop-lyrics-action", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-action", handler);
  },
  copyText: (value: string) => ipcRenderer.invoke("copy-text", value)
};

const windowMode = new URLSearchParams(window.location.search).get("window");
contextBridge.exposeInMainWorld("listenMusic", windowMode === "mini-player" ? miniBridge
  : windowMode === "mini-editor" ? {
    getMiniPlayerSnapshot: miniBridge.getMiniPlayerSnapshot,
    onMiniPlayerSnapshot: miniBridge.onMiniPlayerSnapshot,
    miniWindowCommand: miniBridge.miniWindowCommand,
    setMiniPlayerAppearance: miniBridge.setMiniPlayerAppearance,
    selectCoverImage: mainBridge.selectCoverImage,
    readAppearanceBackground: mainBridge.readAppearanceBackground
  } : mainBridge);
