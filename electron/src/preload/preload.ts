import { contextBridge, ipcRenderer } from "electron";

const backendBaseUrl = "http://127.0.0.1:17890";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${backendBaseUrl}${path}`, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

contextBridge.exposeInMainWorld("listenMusic", {
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
  enterMiniMode: () => ipcRenderer.invoke("enter-mini-mode"),
  exitMiniMode: () => ipcRenderer.invoke("exit-mini-mode"),
  setMiniQueueExpanded: (expanded: boolean) => ipcRenderer.invoke("set-mini-queue-expanded", expanded),
  copyText: (value: string) => ipcRenderer.invoke("copy-text", value)
});
