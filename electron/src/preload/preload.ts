import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopLyricsAction,
  DesktopLyricsPlaybackState,
  DesktopLyricsPreferences
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

const backendBaseUrl = "http://127.0.0.1:17890";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${backendBaseUrl}${path}`, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

contextBridge.exposeInMainWorld("listenMusic", {
  isWindows: process.platform === "win32",
  ping: () => request("/health"),
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
  uploadCloudAudio: () => ipcRenderer.invoke("upload-cloud-audio"),
  downloadCloudTrack: (audioUrl: string, fileName: string) => (
    ipcRenderer.invoke("download-cloud-track", audioUrl, fileName)
  ),
  enterMiniMode: () => ipcRenderer.invoke("enter-mini-mode"),
  exitMiniMode: () => ipcRenderer.invoke("exit-mini-mode"),
  setMiniQueueExpanded: (expanded: boolean) => ipcRenderer.invoke("set-mini-queue-expanded", expanded),
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
  toggleDesktopLyricsWindow: () => ipcRenderer.invoke("toggle-desktop-lyrics-window"),
  closeDesktopLyricsWindow: () => ipcRenderer.invoke("close-desktop-lyrics-window"),
  getDesktopLyricsSnapshot: () => ipcRenderer.invoke("get-desktop-lyrics-snapshot"),
  updateDesktopLyricsPlaybackState: (state: DesktopLyricsPlaybackState) => {
    ipcRenderer.send("update-desktop-lyrics-playback-state", state);
  },
  updateDesktopLyricsTime: (currentTime: number) => {
    ipcRenderer.send("update-desktop-lyrics-time", currentTime);
  },
  updateDesktopLyricsPreferences: (patch: Partial<DesktopLyricsPreferences>) => (
    ipcRenderer.invoke("update-desktop-lyrics-preferences", patch)
  ),
  sendDesktopLyricsAction: (action: DesktopLyricsAction) => {
    ipcRenderer.send("desktop-lyrics-action", action);
  },
  onDesktopLyricsPlaybackState: (listener: (state: DesktopLyricsPlaybackState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: DesktopLyricsPlaybackState) => listener(state);
    ipcRenderer.on("desktop-lyrics-playback-state", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-playback-state", handler);
  },
  onDesktopLyricsTime: (listener: (currentTime: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, currentTime: number) => listener(currentTime);
    ipcRenderer.on("desktop-lyrics-time", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-time", handler);
  },
  onDesktopLyricsPreferences: (listener: (preferences: DesktopLyricsPreferences) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, preferences: DesktopLyricsPreferences) => listener(preferences);
    ipcRenderer.on("desktop-lyrics-preferences", handler);
    return () => ipcRenderer.removeListener("desktop-lyrics-preferences", handler);
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
});
