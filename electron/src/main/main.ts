import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  screen,
  session,
  shell,
  Tray,
  type MenuItemConstructorOptions
} from "electron";
import path from "node:path";
import os from "node:os";
import { mkdirSync, openAsBlob, readFileSync, renameSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import electronUpdater from "electron-updater";
import { createAppUpdateService } from "./appUpdates";
import { BackgroundImageCache } from "./backgroundImageCache";
import { MiniPlayerWindows } from "./miniPlayerWindows";
import type { MiniPlayerSnapshot } from "../shared/miniPlayer";
import { authorizeBackendHeaders, BACKEND_TOKEN_HEADER, isTrustedRendererUrl, readLocalAccessToken, stripBackendTokenHeaders } from "./backendAccess";
import { createServiceRuntime } from "./serviceRuntime";
import { isLocalBackendUrl, standaloneBackendRequestUrl } from "../shared/backendRoutes";
import {
  DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE,
  DEFAULT_DESKTOP_LYRICS_PREFERENCES,
  MIN_DESKTOP_LYRICS_HEIGHT,
  MIN_DESKTOP_LYRICS_WIDTH,
  clampDesktopLyricsBounds,
  normalizeDesktopLyricsPreferences,
  type DesktopLyricsAction,
  type DesktopLyricsBounds,
  type DesktopLyricsPlaybackState,
  type DesktopLyricsPreferences
} from "../shared/desktopLyrics";
import { readLegacyAggregatePlaylists } from "./legacyAggregatePlaylists";
import { ShortcutManager } from "./shortcutManager";
import {
  acceleratorFromInput, defaultShortcutConfig,
  type ShortcutAction, type ShortcutPatch
} from "../shared/shortcuts";
import {
  type AboutSnapshot,
  type AboutSystemInfo,
  type UpdateCheckResult
} from "../shared/about";
import type { CloseBehavior } from "../shared/desktopIntegration";

const rendererUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
protocol.registerSchemesAsPrivileged([
  { scheme: "tiaolv-background", privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);
let backgroundImageCache: BackgroundImageCache;
const rendererFileUrl = pathToFileURL(path.join(__dirname, "../renderer/index.html")).href;
const localAccessTokenFile = process.env.LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE || path.join(os.homedir(), ".tiaolv-music", "local-access.token");
let localAccessToken = "";
let serviceRuntime: ReturnType<typeof createServiceRuntime> | null = null;
let serviceShutdownComplete = false;

function installBackendAccess() {
  localAccessToken = readLocalAccessToken(localAccessTokenFile);
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["http://*/*", "https://*/*"] }, (details, callback) => {
    if (!isLocalBackendUrl(details.url)) {
      callback({ requestHeaders: stripBackendTokenHeaders(details.requestHeaders) });
      return;
    }
    const owner = [mainWindow, desktopLyricsWindow, miniPlayerWindows.window].find(win => win && !win.isDestroyed() && win.webContents.id === details.webContentsId);
    if (owner === miniPlayerWindows.window && details.url !== miniPlayerWindows.getSnapshot().playback?.coverUrl) {
      callback({ cancel: true });
      return;
    }
    const headers = authorizeBackendHeaders({
      url: details.url, owned: Boolean(owner), ownerUrl: owner?.webContents.getURL() || "",
      frameUrl: details.frame?.url, rendererFileUrl, rendererUrl, headers: details.requestHeaders
    }, localAccessToken);
    callback(headers ? { requestHeaders: headers } : { cancel: true });
  });
}

function restrictWindowNavigation(win: BrowserWindow) {
  win.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url, rendererFileUrl, rendererUrl)) event.preventDefault();
  });
  win.webContents.on("will-frame-navigate", details => {
    if (!isTrustedRendererUrl(details.url, rendererFileUrl, rendererUrl)) details.preventDefault();
  });
}
const DESKTOP_LYRICS_DEFAULT_WIDTH = 960;
const DESKTOP_LYRICS_DEFAULT_HEIGHT = 220;
const DESKTOP_LYRICS_UNLOCK_HOTSPOT_HEIGHT = 36;
const DESKTOP_LYRICS_UNLOCK_POLL_INTERVAL = 80;
const GITHUB_REPOSITORY_URL = "https://github.com/WQTY-MASTER/tiaolv-music";
const TASKBAR_ICON_DATA = {
  previous: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAClSURBVDhP7ZOxDcJADEUzAiUjMEJKxmAExqCjpWMcSkahZIP3kaW76M5xIqeigNecZH89yV+6YfjzVSTt/axD0lHSxV6/a5F0AB6W9buOIjPCoKQdcC2ZxdzEmhA4Aa9GFuY6ImFzXkReGJwXkRMCt+C8iJzQXmAEnk7gyQvrDDgDbyeqbBeWufV5d7JZbsaSsBLUEOYmsj+lqWFduIVSw+jnP8gHHomavl1TT/UAAAAASUVORK5CYII=",
  play: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACqSURBVDhP7ZMhDsJAEEUrkUgkEolEIjkGx0DiOAJHqURyBI6AROLeI5t0EzLQdtsqEp7a7Px5yWZmq+pPQl3Gu0moR+CqrmJtFEmoCjyb8yxmBpGFGeAGbGKumCjMAGd1HvO9tAkTwB3YxZ5OuoQZoFYXsfcrJcIE8FDXsf+DEuGgp/cJgdOg4bQJR69PFDYLfoi5Yt6FwGXyF2z+cprgPtZGoW6Ld+zneAEWLHgrYCmGvwAAAABJRU5ErkJggg==",
  pause: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABTSURBVDhP7dOxDcAgFENBRmM0NncaUvpEQ5WcRPW+S8b4XZFkJln7zdNW7ePXOm2VRmqVRmqVRmqVRmqVRmqVRmqVRmqVRmqVRmqVRmqV/qvaRz2N4X6sr17uAAAAAABJRU5ErkJggg==",
  next: "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACbSURBVDhP7ZOxDYMwEEUZISUlY6TMOIyQki1gg4ySERiDDd6PDtmSfYII46TjNZZ9X0++s9w0F39BUufPqpA0AG/g7mspkh6WtdXXMkJoBRgl3XzGSHKDr2WkwiBdgP5LrkwY8WOoFkbiGH4mNMIYprCtEwJz8sLGOaHdStJzI1cuBF6S2p3ccWFsz2eMIqFvb4uSn2LBrL2LXT6ZEpu/+lZ0IgAAAABJRU5ErkJggg=="
} as const;
type SystemTrayPlayMode = "shuffle" | "sequence" | "single" | "loop";

interface SystemTrayState {
  title: string;
  artist: string;
  isPlaying: boolean;
  liked: boolean;
  playMode: SystemTrayPlayMode;
  desktopLyricsVisible: boolean;
  miniPlayerVisible: boolean;
}

interface MiniWindowOptions {
  showInTaskbar: boolean;
  alwaysOnTop: boolean;
}

interface DesktopLyricsConfig {
  bounds?: DesktopLyricsBounds;
  preferences: DesktopLyricsPreferences;
}

let mainWindow: BrowserWindow | null = null;
let shortcutManager: ShortcutManager | null = null;
let shortcutRecordingTimer: ReturnType<typeof setTimeout> | null = null;
let autoCheckUpdates = false;
let appUpdates: ReturnType<typeof createAppUpdateService> | null = null;
let updateCheckResult: UpdateCheckResult = {
  status: "idle",
  currentVersion: app.getVersion(),
  releaseUrl: `${GITHUB_REPOSITORY_URL}/releases/latest`
};
let desktopLyricsWindow: BrowserWindow | null = null;
let taskbarThumbnailButtonsEnabled = false;
let taskbarPlaybackIsPlaying = false;
let systemTray: Tray | null = null;
let systemTrayEnabled = false;
let closeBehavior: CloseBehavior = "exit";
let appQuitting = false;
let desktopLyricsSaveTimer: ReturnType<typeof setTimeout> | null = null;
let desktopLyricsUnlockPollTimer: ReturnType<typeof setInterval> | null = null;
let desktopLyricsUnlockHotspotActive = false;
let desktopLyricsPointerInside = false;
let desktopLyricsPlaybackState: DesktopLyricsPlaybackState = {
  ...DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE
};
let desktopLyricsConfigInitialized = false;
let desktopLyricsConfig: DesktopLyricsConfig = {
  preferences: { ...DEFAULT_DESKTOP_LYRICS_PREFERENCES }
};
let systemTrayState: SystemTrayState = {
  title: "调律音乐",
  artist: "暂无歌曲",
  isPlaying: false,
  liked: false,
  playMode: "sequence",
  desktopLyricsVisible: false,
  miniPlayerVisible: false
};

const miniPlayerWindows = new MiniPlayerWindows({
  getMainWindow: () => mainWindow,
  rendererFile: path.join(__dirname, "../renderer/index.html"),
  rendererUrl,
  icon: applicationIconPath(),
  get dataDirectory() { return app.getPath("userData"); },
  setupWindow: win => { restrictWindowNavigation(win); attachWindowShortcuts(win); },
  onAction: action => mainWindow?.webContents.send("mini-player-action", action),
  onVisibility: visible => mainWindow?.webContents.send("mini-mode-visibility", visible),
  ensureRecovery: () => setSystemTrayEnabled(true)
});
miniPlayerWindows.installIpc(ipcMain);

const chromiumCachePath = path.join(
  process.env.LOCALAPPDATA || app.getPath("temp"),
  "tiaolv-music-electron",
  "ChromiumCache"
);
mkdirSync(chromiumCachePath, { recursive: true });
app.setName("调律音乐");
if (process.platform === "win32") Menu.setApplicationMenu(null);
app.commandLine.appendSwitch("disk-cache-dir", chromiumCachePath);
// Keep Chromium's default compositor: forced software rendering leaves stale
// accent-colored pixels around transparent windows on Windows 11.
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function taskbarIcon(name: keyof typeof TASKBAR_ICON_DATA) {
  return nativeImage.createFromDataURL(`data:image/png;base64,${TASKBAR_ICON_DATA[name]}`);
}

function applicationIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app-icon.png")
    : path.join(__dirname, "../../resources/app-icon.png");
}

function applicationIcon() {
  return nativeImage.createFromPath(applicationIconPath());
}

function aboutConfigPath() {
  return path.join(app.getPath("userData"), "about.json");
}

function readAboutConfig() {
  try {
    const stored = JSON.parse(readFileSync(aboutConfigPath(), "utf8")) as { autoCheckUpdates?: unknown };
    autoCheckUpdates = stored.autoCheckUpdates === true;
  } catch {
    autoCheckUpdates = false;
  }
}

function saveAboutConfig() {
  const configPath = aboutConfigPath();
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(`${configPath}.tmp`, JSON.stringify({ autoCheckUpdates }, null, 2), "utf8");
  renameSync(`${configPath}.tmp`, configPath);
}

function windowsName() {
  if (process.platform !== "win32") return `${os.type()} ${os.release()}`;
  const build = Number(os.release().split(".")[2]);
  return Number.isFinite(build) && build >= 22000 ? "Windows 11" : "Windows 10";
}

function aboutSystemInfo(): AboutSystemInfo {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    osName: windowsName(),
    osVersion: os.release(),
    osArch: os.arch()
  };
}

function aboutSnapshot(): AboutSnapshot {
  return {
    system: aboutSystemInfo(),
    autoCheckUpdates,
    update: updateCheckResult
  };
}

function broadcastUpdateResult() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-check-result", updateCheckResult);
  }
}

function checkForUpdates() {
  if (!appUpdates) throw new Error("更新服务尚未就绪");
  return appUpdates.check();
}

function isAllowedExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com";
  } catch {
    return false;
  }
}

function dispatchShortcut(action: ShortcutAction) {
  switch (action) {
    case "main-window":
      if (mainWindow?.isVisible() && !mainWindow.isMinimized()) mainWindow.minimize();
      else showMainWindow();
      break;
    case "desktop-lyrics":
      toggleDesktopLyricsWindow();
      break;
    case "unlock-lyrics":
      updateDesktopLyricsPreferences({ locked: false });
      break;
    case "translation":
      updateDesktopLyricsPreferences({ translationEnabled: !desktopLyricsConfig.preferences.translationEnabled });
      break;
    case "lyrics-on-top":
      updateDesktopLyricsPreferences({ alwaysOnTop: !desktopLyricsConfig.preferences.alwaysOnTop });
      break;
    default:
      mainWindow?.webContents.send("shortcut-action", action);
  }
}

function initializeShortcuts() {
  const configPath = path.join(app.getPath("userData"), "shortcuts.json");
  let stored: unknown;
  try { stored = JSON.parse(readFileSync(configPath, "utf8")); } catch { stored = undefined; }
  shortcutManager = new ShortcutManager(globalShortcut, stored, dispatchShortcut, (config) => {
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(`${configPath}.tmp`, JSON.stringify(config, null, 2), "utf8");
    renameSync(`${configPath}.tmp`, configPath);
  });
}

function broadcastShortcuts() {
  const snapshot = shortcutManager?.snapshot();
  for (const win of [mainWindow, desktopLyricsWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.setIgnoreMenuShortcuts(Boolean(snapshot?.recording));
      win.webContents.send("shortcuts-changed", snapshot);
    }
  }
}

function finishShortcutRecording() {
  if (shortcutRecordingTimer) clearTimeout(shortcutRecordingTimer);
  shortcutRecordingTimer = null;
  if (!shortcutManager?.snapshot().recording) return;
  shortcutManager.setRecording(false);
  broadcastShortcuts();
}

function attachWindowShortcuts(win: BrowserWindow) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || input.isComposing) return;
    const accelerator = acceleratorFromInput(input);
    if (accelerator && shortcutManager?.handleLocal(accelerator, input.isAutoRepeat)) event.preventDefault();
  });
  if (win === mainWindow) {
    win.on("blur", finishShortcutRecording);
    win.webContents.on("did-start-loading", finishShortcutRecording);
    win.webContents.on("render-process-gone", finishShortcutRecording);
    win.on("closed", finishShortcutRecording);
  }
}

function desktopLyricsConfigPath() {
  return path.join(app.getPath("userData"), "desktop-lyrics.json");
}

function readDesktopLyricsConfig() {
  try {
    const stored = JSON.parse(readFileSync(desktopLyricsConfigPath(), "utf8")) as Partial<DesktopLyricsConfig>;
    const bounds = stored.bounds;
    desktopLyricsConfig = {
      bounds: bounds
        && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
        ? bounds
        : undefined,
      preferences: normalizeDesktopLyricsPreferences(stored.preferences)
    };
  } catch {
    desktopLyricsConfig = {
      preferences: { ...DEFAULT_DESKTOP_LYRICS_PREFERENCES }
    };
  }
  desktopLyricsConfigInitialized = true;
}

function getDesktopLyricsBounds(): DesktopLyricsBounds {
  const primaryWorkArea = screen.getPrimaryDisplay().workArea;
  const stored = desktopLyricsConfig.bounds;
  if (!stored) {
    return {
      width: DESKTOP_LYRICS_DEFAULT_WIDTH,
      height: DESKTOP_LYRICS_DEFAULT_HEIGHT,
      x: Math.round(primaryWorkArea.x + (primaryWorkArea.width - DESKTOP_LYRICS_DEFAULT_WIDTH) / 2),
      y: Math.round(primaryWorkArea.y + primaryWorkArea.height * 0.68)
    };
  }

  const display = screen.getDisplayMatching(stored).workArea;
  const size = clampDesktopLyricsBounds(stored);
  const width = clamp(size.width, MIN_DESKTOP_LYRICS_WIDTH, display.width);
  const height = clamp(size.height, MIN_DESKTOP_LYRICS_HEIGHT, display.height);
  return {
    width,
    height,
    x: clamp(stored.x, display.x, display.x + display.width - width),
    y: clamp(stored.y, display.y, display.y + display.height - height)
  };
}

function saveDesktopLyricsConfig() {
  if (!desktopLyricsConfigInitialized) return;
  const win = desktopLyricsWindow;
  if (win && !win.isDestroyed()) {
    desktopLyricsConfig.bounds = win.getBounds();
  }
  void writeFile(
    desktopLyricsConfigPath(),
    JSON.stringify(desktopLyricsConfig, null, 2),
    "utf8"
  ).catch(() => undefined);
}

function scheduleDesktopLyricsConfigSave() {
  if (desktopLyricsSaveTimer) clearTimeout(desktopLyricsSaveTimer);
  desktopLyricsSaveTimer = setTimeout(() => {
    desktopLyricsSaveTimer = null;
    saveDesktopLyricsConfig();
  }, 180);
}

function sendDesktopLyricsPreferences() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.webContents.send(
      "desktop-lyrics-preferences",
      desktopLyricsConfig.preferences
    );
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "desktop-lyrics-preferences",
      desktopLyricsConfig.preferences
    );
  }
}

function sendDesktopLyricsBounds() {
  const bounds = desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()
    ? desktopLyricsWindow.getBounds()
    : getDesktopLyricsBounds();
  desktopLyricsConfig.bounds = bounds;
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.webContents.send("desktop-lyrics-bounds-changed", bounds);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop-lyrics-bounds-changed", bounds);
  }
}

function sendDesktopLyricsPlaybackState() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  desktopLyricsWindow.webContents.send(
    "desktop-lyrics-playback-state",
    desktopLyricsPlaybackState
  );
}

function notifyDesktopLyricsVisibility(visible: boolean) {
  systemTrayState.desktopLyricsVisible = visible;
  if (systemTrayEnabled) refreshSystemTray();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("desktop-lyrics-visibility-changed", visible);
}

function stopDesktopLyricsUnlockMonitor() {
  if (desktopLyricsUnlockPollTimer) clearInterval(desktopLyricsUnlockPollTimer);
  desktopLyricsUnlockPollTimer = null;
  desktopLyricsUnlockHotspotActive = false;
  desktopLyricsPointerInside = false;
  const win = desktopLyricsWindow;
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(false);
  win.webContents.send("desktop-lyrics-hover-state", false);
  win.webContents.send("desktop-lyrics-unlock-hotspot", false);
}

function startDesktopLyricsUnlockMonitor() {
  const win = desktopLyricsWindow;
  if (!win || win.isDestroyed()) return;
  if (desktopLyricsUnlockPollTimer) clearInterval(desktopLyricsUnlockPollTimer);
  desktopLyricsUnlockHotspotActive = false;
  desktopLyricsPointerInside = false;
  win.webContents.send("desktop-lyrics-hover-state", false);
  win.webContents.send("desktop-lyrics-unlock-hotspot", false);

  desktopLyricsUnlockPollTimer = setInterval(() => {
    const currentWindow = desktopLyricsWindow;
    if (!currentWindow || currentWindow.isDestroyed()) {
      if (desktopLyricsUnlockPollTimer) clearInterval(desktopLyricsUnlockPollTimer);
      desktopLyricsUnlockPollTimer = null;
      return;
    }
    const bounds = currentWindow.getBounds();
    const cursor = screen.getCursorScreenPoint();
    const pointerInside = cursor.x >= bounds.x
      && cursor.x < bounds.x + bounds.width
      && cursor.y >= bounds.y
      && cursor.y < bounds.y + bounds.height;
    if (pointerInside !== desktopLyricsPointerInside) {
      desktopLyricsPointerInside = pointerInside;
      currentWindow.webContents.send("desktop-lyrics-hover-state", pointerInside);
    }
    const hotspotActive = desktopLyricsConfig.preferences.locked
      && pointerInside
      && cursor.y < bounds.y + DESKTOP_LYRICS_UNLOCK_HOTSPOT_HEIGHT;
    if (hotspotActive === desktopLyricsUnlockHotspotActive) return;
    desktopLyricsUnlockHotspotActive = hotspotActive;
    if (desktopLyricsConfig.preferences.locked) {
      currentWindow.setIgnoreMouseEvents(!hotspotActive, { forward: true });
    }
    currentWindow.webContents.send("desktop-lyrics-unlock-hotspot", hotspotActive);
  }, DESKTOP_LYRICS_UNLOCK_POLL_INTERVAL);
}

function applyDesktopLyricsLock(locked: boolean) {
  const win = desktopLyricsWindow;
  if (!win || win.isDestroyed()) return false;

  if (!desktopLyricsUnlockPollTimer) startDesktopLyricsUnlockMonitor();
  desktopLyricsUnlockHotspotActive = false;
  win.webContents.send("desktop-lyrics-unlock-hotspot", false);
  win.setIgnoreMouseEvents(locked, { forward: true });
  return true;
}

function updateDesktopLyricsPreferences(patch: Partial<DesktopLyricsPreferences>) {
  const next = normalizeDesktopLyricsPreferences({
    ...desktopLyricsConfig.preferences,
    ...patch
  });
  desktopLyricsConfig.preferences = next;
  if (next.enabled && (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed())) {
    createDesktopLyricsWindow();
  } else if (!next.enabled && desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.close();
  }
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.setAlwaysOnTop(next.alwaysOnTop, "floating");
    applyDesktopLyricsLock(next.locked);
  }
  sendDesktopLyricsPreferences();
  scheduleDesktopLyricsConfigSave();
  if (systemTrayEnabled) refreshSystemTray();
  return desktopLyricsConfig.preferences;
}

function updateDesktopLyricsBounds(bounds: Pick<DesktopLyricsBounds, "width" | "height">) {
  const size = clampDesktopLyricsBounds(bounds);
  const current = desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()
    ? desktopLyricsWindow.getBounds()
    : getDesktopLyricsBounds();
  const nextBounds = { ...current, ...size };
  desktopLyricsConfig.bounds = nextBounds;
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.setBounds({
      ...desktopLyricsWindow.getBounds(),
      ...clampDesktopLyricsBounds(size)
    });
  }
  sendDesktopLyricsBounds();
  scheduleDesktopLyricsConfigSave();
  return desktopLyricsConfig.bounds;
}

function createDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.showInactive();
    return desktopLyricsWindow;
  }

  const win = new BrowserWindow({
    ...getDesktopLyricsBounds(),
    minWidth: MIN_DESKTOP_LYRICS_WIDTH,
    minHeight: MIN_DESKTOP_LYRICS_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: desktopLyricsConfig.preferences.alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  desktopLyricsWindow = win;
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  restrictWindowNavigation(win);
  attachWindowShortcuts(win);
  desktopLyricsWindow.setAlwaysOnTop(desktopLyricsConfig.preferences.alwaysOnTop, "floating");
  desktopLyricsWindow.on("move", () => {
    sendDesktopLyricsBounds();
    scheduleDesktopLyricsConfigSave();
  });
  desktopLyricsWindow.on("resize", () => {
    sendDesktopLyricsBounds();
    scheduleDesktopLyricsConfigSave();
  });
  desktopLyricsWindow.on("closed", () => {
    stopDesktopLyricsUnlockMonitor();
    desktopLyricsWindow = null;
    desktopLyricsConfig.preferences = normalizeDesktopLyricsPreferences({
      ...desktopLyricsConfig.preferences,
      enabled: false
    });
    sendDesktopLyricsPreferences();
    scheduleDesktopLyricsConfigSave();
    notifyDesktopLyricsVisibility(false);
  });
  win.webContents.on("did-finish-load", () => {
    sendDesktopLyricsPlaybackState();
    sendDesktopLyricsPreferences();
  });
  win.once("ready-to-show", () => {
    win.showInactive();
    applyDesktopLyricsLock(desktopLyricsConfig.preferences.locked);
    notifyDesktopLyricsVisibility(true);
  });

  if (rendererUrl) {
    const url = new URL(rendererUrl);
    url.searchParams.set("window", "desktop-lyrics");
    void win.loadURL(url.toString());
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"), {
      query: { window: "desktop-lyrics" }
    });
  }
  return win;
}

function toggleDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    updateDesktopLyricsPreferences({ enabled: false });
    return false;
  }
  updateDesktopLyricsPreferences({ enabled: true });
  return true;
}

function isTrustedDesktopLyricsSender(event: Electron.IpcMainInvokeEvent) {
  const sender = BrowserWindow.fromWebContents(event.sender);
  return sender === mainWindow || sender === desktopLyricsWindow;
}

function applyTaskbarThumbnailButtons(win: BrowserWindow) {
  if (process.platform !== "win32" || win.isDestroyed()) return false;
  if (!taskbarThumbnailButtonsEnabled) {
    return win.setThumbarButtons([]);
  }

  return win.setThumbarButtons([
    {
      tooltip: "上一首",
      icon: taskbarIcon("previous"),
      click: () => {
        if (!win.isDestroyed()) win.webContents.send("taskbar-media-action", "previous");
      }
    },
    {
      tooltip: taskbarPlaybackIsPlaying ? "暂停" : "播放",
      icon: taskbarIcon(taskbarPlaybackIsPlaying ? "pause" : "play"),
      click: () => {
        if (!win.isDestroyed()) win.webContents.send("taskbar-media-action", "toggle");
      }
    },
    {
      tooltip: "下一首",
      icon: taskbarIcon("next"),
      click: () => {
        if (!win.isDestroyed()) win.webContents.send("taskbar-media-action", "next");
      }
    }
  ]);
}

function showMainWindow() {
  if (miniPlayerWindows.window) miniPlayerWindows.exit();
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function trayTrackLabel(state: SystemTrayState) {
  const text = [state.title, state.artist].filter(Boolean).join(" - ");
  return text.length > 32 ? `${text.slice(0, 31)}…` : text;
}

function buildSystemTrayMenu(state: SystemTrayState) {
  const template: MenuItemConstructorOptions[] = [
    { label: trayTrackLabel(state), click: () => showMainWindow() },
    { type: "separator" },
    {
      label: "上一首",
      click: () => mainWindow?.webContents.send("tray-media-action", "previous")
    },
    {
      label: state.isPlaying ? "暂停" : "播放",
      click: () => mainWindow?.webContents.send("tray-media-action", "toggle")
    },
    {
      label: "下一首",
      click: () => mainWindow?.webContents.send("tray-media-action", "next")
    },
    {
      label: state.liked ? "取消喜欢" : "喜欢",
      click: () => mainWindow?.webContents.send("tray-media-action", "favorite")
    },
    { type: "separator" },
    {
      label: "播放模式",
      submenu: [
        {
          label: "顺序播放",
          type: "radio",
          checked: state.playMode === "sequence",
          click: () => mainWindow?.webContents.send("tray-media-action", "play-mode:sequence")
        },
        {
          label: "列表循环",
          type: "radio",
          checked: state.playMode === "loop",
          click: () => mainWindow?.webContents.send("tray-media-action", "play-mode:loop")
        },
        {
          label: "单曲循环",
          type: "radio",
          checked: state.playMode === "single",
          click: () => mainWindow?.webContents.send("tray-media-action", "play-mode:single")
        },
        {
          label: "随机播放",
          type: "radio",
          checked: state.playMode === "shuffle",
          click: () => mainWindow?.webContents.send("tray-media-action", "play-mode:shuffle")
        }
      ]
    },
    { type: "separator" },
    {
      label: "桌面歌词",
      type: "checkbox",
      checked: state.desktopLyricsVisible,
      click: () => toggleDesktopLyricsWindow()
    },
    {
      label: desktopLyricsConfig.preferences.locked
        ? "解锁桌面歌词"
        : "锁定桌面歌词",
      type: "checkbox",
      checked: desktopLyricsConfig.preferences.locked,
      enabled: state.desktopLyricsVisible,
      click: () => updateDesktopLyricsPreferences({ locked: !desktopLyricsConfig.preferences.locked })
    },
    { type: "separator" },
    {
      label: "迷你播放器",
      type: "checkbox",
      checked: state.miniPlayerVisible,
      click: () => mainWindow?.webContents.send("tray-media-action", "mini-player")
    },
    { type: "separator" },
    {
      label: "设置",
      click: () => {
        showMainWindow();
        mainWindow?.webContents.send("tray-media-action", "settings");
      }
    },
    { type: "separator" },
    { label: "退出", click: () => app.quit() }
  ];
  return Menu.buildFromTemplate(template);
}

function refreshSystemTray() {
  if (!systemTray || systemTray.isDestroyed()) return;
  systemTray.setContextMenu(buildSystemTrayMenu(systemTrayState));
  systemTray.setToolTip(trayTrackLabel(systemTrayState));
}

function setSystemTrayEnabled(enabled: boolean) {
  systemTrayEnabled = enabled;
  if (process.platform !== "win32") return false;
  if (!enabled) {
    systemTray?.destroy();
    systemTray = null;
    return true;
  }
  if (!systemTray || systemTray.isDestroyed()) {
    const icon = applicationIcon().resize({ width: 20, height: 20 });
    systemTray = new Tray(icon);
    systemTray.on("click", () => {
      showMainWindow();
    });
  }
  refreshSystemTray();
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: "调律音乐",
    icon: applicationIconPath(),
    backgroundColor: "#111111",
    ...(process.platform === "win32" ? {
      titleBarStyle: "hidden" as const
    } : {}),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow = win;
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  restrictWindowNavigation(win);
  attachWindowShortcuts(win);
  const publishMaximized = () => win.webContents.send("main-window-maximized", win.isMaximized());
  win.on("maximize", publishMaximized);
  win.on("unmaximize", publishMaximized);
  win.on("close", (event) => {
    if (appQuitting || closeBehavior === "exit") return;
    event.preventDefault();
    if (closeBehavior === "tray") {
      setSystemTrayEnabled(true);
      win.hide();
      return;
    }
    win.webContents.send("window-close-behavior", closeBehavior);
  });
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
    miniPlayerWindows.dispose();
  });

  if (rendererUrl) {
    void win.loadURL(rendererUrl).catch(error => console.error("Failed to load the main window", error));
    return;
  }

  void win.loadFile(path.join(__dirname, "../renderer/index.html"))
    .catch(error => console.error("Failed to load the main window", error));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function mainCaptionWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  if (process.platform !== "win32" || !mainWindow || mainWindow.isDestroyed()
    || BrowserWindow.fromWebContents(event.sender) !== mainWindow
    || event.senderFrame !== mainWindow.webContents.mainFrame) return null;
  return mainWindow;
}

ipcMain.handle("main-window-get-maximized", (event) => {
  const win = mainCaptionWindow(event);
  return win ? win.isMaximized() : null;
});

ipcMain.handle("main-window-command", (event, command: unknown) => {
  const win = mainCaptionWindow(event);
  if (!win) return false;
  if (command === "minimize") win.minimize();
  else if (command === "toggle-maximize") {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  } else if (command === "close") win.close();
  else return false;
  return true;
});

ipcMain.handle("select-music-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle("select-playlist-cover-image", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win !== mainWindow && !miniPlayerWindows.owns(event.sender, true)) return null;
  const options = {
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }
    ]
  } as Electron.OpenDialogOptions;
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  const selected = result.canceled ? null : result.filePaths[0] ?? null;
  if (selected) miniPlayerWindows.rememberSelectedImage(event.sender, selected);
  return selected;
});

ipcMain.handle("read-appearance-background", async (event, imagePath: unknown) => {
  if (typeof imagePath !== "string") throw new Error("Invalid background path");
  const mainOwner = BrowserWindow.fromWebContents(event.sender) === mainWindow;
  if (!mainOwner && !miniPlayerWindows.consumeSelectedImage(event.sender, imagePath)) throw new Error("Background image was not selected in this editor");
  if (imagePath.startsWith("tiaolv-background:")) {
    await backgroundImageCache.resolve(imagePath);
    return imagePath;
  }
  const imported = await backgroundImageCache.importImage(imagePath);
  if (!mainOwner) miniPlayerWindows.rememberImportedImage(imported);
  return imported;
});
ipcMain.handle("background-cache-statistics", () => backgroundImageCache.statistics());
ipcMain.handle("clear-background-cache", async () => {
  await backgroundImageCache.clear();
  return backgroundImageCache.statistics();
});

ipcMain.handle("read-cover-data-url", async (event, rawUrl: string) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return null;
  const url = new URL(String(rawUrl || ""));
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  const response = isLocalBackendUrl(url)
    ? await fetch(url.toString(), { headers: { [BACKEND_TOKEN_HEADER]: localAccessToken }, redirect: "error" })
    : await net.fetch(url.toString());
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim() || "";
  if (!contentType.startsWith("image/")) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 12 * 1024 * 1024) return null;
  return `data:${contentType};base64,${bytes.toString("base64")}`;
});

ipcMain.handle("upload-cloud-audio", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options = {
    properties: ["openFile", "multiSelections"] as Array<"openFile" | "multiSelections">,
    filters: [
      { name: "Audio", extensions: ["mp3", "flac", "wav", "ogg", "opus", "m4a"] }
    ]
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return [];

  const uploaded: unknown[] = [];
  for (const filePath of result.filePaths) {
    const form = new FormData();
    form.append("file", await openAsBlob(filePath), path.basename(filePath));
    const response = await fetch(
      standaloneBackendRequestUrl("/account/netease/cloud/tracks"),
      { method: "POST", body: form, headers: { [BACKEND_TOKEN_HEADER]: localAccessToken }, redirect: "error" }
    );
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(detail?.message || `上传失败: ${response.status}`);
    }
    uploaded.push(await response.json());
  }
  return uploaded;
});

ipcMain.handle("download-cloud-track", async (event, audioUrl: string, fileName: string) => {
  let source: URL;
  try {
    source = new URL(audioUrl);
  } catch {
    throw new Error("网易云未返回可用的歌曲下载地址");
  }
  if (!['http:', 'https:'].includes(source.protocol)) {
    throw new Error("歌曲下载地址不安全");
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  const options = { defaultPath: path.basename(fileName || "cloud-audio") };
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return false;

  const response = await fetch(source, {
    headers: isLocalBackendUrl(source) ? { [BACKEND_TOKEN_HEADER]: localAccessToken } : undefined,
    redirect: isLocalBackendUrl(source) ? "error" : "follow"
  });
  if (!response.ok) throw new Error(`下载失败: ${response.status}`);
  await writeFile(result.filePath, new Uint8Array(await response.arrayBuffer()));
  return true;
});

ipcMain.handle("enter-mini-mode", async (event, options?: Partial<MiniWindowOptions>) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win === mainWindow ? miniPlayerWindows.enter({
    showInTaskbar: options?.showInTaskbar !== false,
    alwaysOnTop: options?.alwaysOnTop !== false
  }) : false;
});

ipcMain.handle("exit-mini-mode", async (event) => {
  return BrowserWindow.fromWebContents(event.sender) === mainWindow ? miniPlayerWindows.exit() : false;
});

ipcMain.handle("set-mini-queue-expanded", async (event, expanded: boolean) => {
  return miniPlayerWindows.owns(event.sender) && typeof expanded === "boolean" ? miniPlayerWindows.expandQueue(expanded) : false;
});

ipcMain.on("update-mini-player-snapshot", (event, snapshot: MiniPlayerSnapshot) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return;
  if (!snapshot?.track || !Array.isArray(snapshot.queue) || !snapshot.preferences) return;
  miniPlayerWindows.updateSnapshot(snapshot);
});
ipcMain.on("update-mini-player-time", (event, currentTime: number, progress: number) => {
  if (BrowserWindow.fromWebContents(event.sender) === mainWindow) miniPlayerWindows.updateTime(currentTime, progress);
});

ipcMain.handle("set-taskbar-thumbnail-buttons", (event, enabled: boolean, isPlaying: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || process.platform !== "win32") return false;
  taskbarThumbnailButtonsEnabled = Boolean(enabled);
  taskbarPlaybackIsPlaying = Boolean(isPlaying);
  return applyTaskbarThumbnailButtons(win);
});

ipcMain.handle("update-taskbar-playback-state", (event, isPlaying: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || process.platform !== "win32") return false;
  taskbarPlaybackIsPlaying = Boolean(isPlaying);
  return taskbarThumbnailButtonsEnabled ? applyTaskbarThumbnailButtons(win) : true;
});

ipcMain.handle("set-system-tray-enabled", (_event, enabled: boolean, state: SystemTrayState) => {
  systemTrayState = { ...systemTrayState, ...state };
  return setSystemTrayEnabled(Boolean(enabled));
});

ipcMain.handle("update-system-tray-state", (_event, state: SystemTrayState) => {
  systemTrayState = { ...systemTrayState, ...state };
  if (systemTrayEnabled) refreshSystemTray();
  return systemTrayEnabled;
});

ipcMain.handle("set-close-behavior", (event, behavior: CloseBehavior) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return closeBehavior;
  closeBehavior = behavior === "tray" || behavior === "mini" ? behavior : "exit";
  return closeBehavior;
});

function launchAtStartupOptions() {
  return {
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()]
  };
}

ipcMain.handle("get-launch-at-startup", (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return false;
  return app.getLoginItemSettings(launchAtStartupOptions()).openAtLogin;
});

ipcMain.handle("set-launch-at-startup", (event, enabled: boolean) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return false;
  app.setLoginItemSettings({ ...launchAtStartupOptions(), openAtLogin: Boolean(enabled) });
  return app.getLoginItemSettings(launchAtStartupOptions()).openAtLogin;
});

ipcMain.handle("get-legacy-aggregate-playlists", (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return [];
  return readLegacyAggregatePlaylists(app.getPath("appData"));
});

ipcMain.handle("toggle-desktop-lyrics-window", (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return false;
  return toggleDesktopLyricsWindow();
});

ipcMain.handle("close-desktop-lyrics-window", (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== desktopLyricsWindow) return false;
  updateDesktopLyricsPreferences({ enabled: false });
  return true;
});

ipcMain.handle("get-desktop-lyrics-snapshot", (event) => {
  if (!isTrustedDesktopLyricsSender(event)) return null;
  return {
    visible: Boolean(desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()),
    bounds: desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()
      ? desktopLyricsWindow.getBounds()
      : getDesktopLyricsBounds(),
    playback: desktopLyricsPlaybackState,
    preferences: desktopLyricsConfig.preferences
  };
});

ipcMain.on("update-desktop-lyrics-playback-state", (event, state: DesktopLyricsPlaybackState) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow || !state) return;
  desktopLyricsPlaybackState = {
    ...DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE,
    ...state,
    currentTime: Number.isFinite(state.currentTime) ? Math.max(0, state.currentTime) : 0
  };
  sendDesktopLyricsPlaybackState();
});

ipcMain.on("update-desktop-lyrics-time", (event, currentTime: number, allowRewind = false) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow || !Number.isFinite(currentTime)) return;
  desktopLyricsPlaybackState.currentTime = Math.max(0, currentTime);
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  desktopLyricsWindow.webContents.send(
    "desktop-lyrics-time",
    desktopLyricsPlaybackState.currentTime,
    Boolean(allowRewind)
  );
});

ipcMain.handle("update-desktop-lyrics-preferences", (event, patch: Partial<DesktopLyricsPreferences>) => {
  if (!isTrustedDesktopLyricsSender(event)) {
    return desktopLyricsConfig.preferences;
  }
  return updateDesktopLyricsPreferences(patch ?? {});
});

ipcMain.handle("update-desktop-lyrics-bounds", (event, bounds: Pick<DesktopLyricsBounds, "width" | "height">) => {
  if (!isTrustedDesktopLyricsSender(event)) return getDesktopLyricsBounds();
  return updateDesktopLyricsBounds(bounds ?? getDesktopLyricsBounds());
});

ipcMain.on("desktop-lyrics-action", (event, action: DesktopLyricsAction) => {
  if (BrowserWindow.fromWebContents(event.sender) !== desktopLyricsWindow) return;
  if (!["previous", "toggle", "next", "cycle-mode"].includes(action)) return;
  mainWindow?.webContents.send("desktop-lyrics-action", action);
});

ipcMain.handle("get-shortcuts", (event) => {
  if (!isTrustedDesktopLyricsSender(event)) throw new Error("不允许读取快捷键配置");
  return shortcutManager?.snapshot();
});

ipcMain.handle("update-shortcuts", (event, patch: ShortcutPatch, reset = false) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw new Error("不允许修改快捷键配置");
  finishShortcutRecording();
  try {
    return shortcutManager?.update(reset ? defaultShortcutConfig() : (patch ?? {}), Boolean(reset));
  } finally {
    broadcastShortcuts();
  }
});

ipcMain.handle("set-shortcut-recording", (event, recording: boolean) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw new Error("不允许录制快捷键");
  finishShortcutRecording();
  if (recording && mainWindow?.isFocused()) {
    shortcutManager?.setRecording(true);
    shortcutRecordingTimer = setTimeout(finishShortcutRecording, 30000);
    broadcastShortcuts();
  }
  return shortcutManager?.snapshot();
});

ipcMain.handle("get-about-snapshot", (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw new Error("不允许读取关于信息");
  return aboutSnapshot();
});

function requireUpdateSender(event: Electron.IpcMainInvokeEvent) {
  if (!mainWindow || mainWindow.isDestroyed()
    || BrowserWindow.fromWebContents(event.sender) !== mainWindow
    || event.senderFrame !== mainWindow.webContents.mainFrame
    || !isTrustedRendererUrl(event.senderFrame.url, rendererFileUrl, rendererUrl)) {
    throw new Error("不允许操作应用更新");
  }
}

ipcMain.handle("check-for-updates", (event) => {
  requireUpdateSender(event);
  return checkForUpdates();
});

ipcMain.handle("download-update", (event) => {
  requireUpdateSender(event);
  if (!appUpdates) throw new Error("更新服务尚未就绪");
  return appUpdates.download();
});

ipcMain.handle("install-update", (event) => {
  requireUpdateSender(event);
  return appUpdates?.install() ?? false;
});

ipcMain.handle("set-auto-update-check", (event, enabled: boolean) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) throw new Error("不允许修改更新设置");
  const previous = autoCheckUpdates;
  autoCheckUpdates = Boolean(enabled);
  try {
    saveAboutConfig();
  } catch (error) {
    autoCheckUpdates = previous;
    throw error;
  }
  return aboutSnapshot();
});

ipcMain.handle("open-external-link", async (event, url: string) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow || !isAllowedExternalUrl(url)) {
    throw new Error("不允许打开此外部链接");
  }
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("copy-text", (_event, value: string) => {
  clipboard.writeText(String(value));
  return true;
});

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (miniPlayerWindows.window) miniPlayerWindows.exit();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    if (app.isPackaged) {
      serviceRuntime = createServiceRuntime({
        resourcesDirectory: path.join(process.resourcesPath, "runtime"),
        nodeExecutable: process.execPath,
        dataDirectory: path.join(app.getPath("userData"), "runtime"),
        logDirectory: path.join(app.getPath("userData"), "logs", "runtime"),
        tokenFile: localAccessTokenFile,
        onFatalError: () => {
          dialog.showErrorBox("本地服务已停止", "后端或音乐 API 意外退出，请重新启动调律音乐。");
          app.quit();
        }
      });
      await serviceRuntime.start();
    }
    installBackendAccess();
    backgroundImageCache = new BackgroundImageCache(path.join(app.getPath("userData"), "cache", "backgrounds"));
    protocol.handle("tiaolv-background", async (request) => {
      try {
        return await net.fetch(pathToFileURL(await backgroundImageCache.resolve(request.url)).href);
      } catch {
        return new Response("Background not found", { status: 404 });
      }
    });
    if (process.platform === "win32") {
      app.setAppUserModelId("com.tiaolvmusic.desktop");
    }
    readDesktopLyricsConfig();
    readAboutConfig();
    appUpdates = createAppUpdateService({
      updater: electronUpdater.autoUpdater,
      currentVersion: app.getVersion(), isPackaged: app.isPackaged, platform: process.platform,
      onChange: result => { updateCheckResult = result; broadcastUpdateResult(); },
      prepareInstall: async () => {
        await serviceRuntime?.stop();
        serviceShutdownComplete = true;
      }
    });
    initializeShortcuts();
    createWindow();
    if (autoCheckUpdates) void checkForUpdates();
    if (desktopLyricsConfig.preferences.enabled) {
      createDesktopLyricsWindow();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  }).catch(async error => {
    await serviceRuntime?.stop().catch(() => undefined);
    const detail = error instanceof Error ? error.message : "无法连接受保护的本地服务";
    dialog.showErrorBox("调律音乐启动失败", `${detail}\n请关闭占用端口的服务后重试。开发模式请先启动后端。`);
    app.quit();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", event => {
  appQuitting = true;
  miniPlayerWindows.dispose();
  if (serviceRuntime && !serviceShutdownComplete) {
    event.preventDefault();
    void serviceRuntime.stop().then(() => {
      serviceShutdownComplete = true;
      app.quit();
    }).catch(() => {
      dialog.showErrorBox("服务退出失败", "本地服务未能完全退出，请确认后台进程已结束后再启动程序。");
      app.exit(1);
    });
  }
  if (shortcutRecordingTimer) clearTimeout(shortcutRecordingTimer);
  shortcutManager?.dispose();
  if (desktopLyricsSaveTimer) clearTimeout(desktopLyricsSaveTimer);
  if (desktopLyricsUnlockPollTimer) clearInterval(desktopLyricsUnlockPollTimer);
  saveDesktopLyricsConfig();
  systemTray?.destroy();
  systemTray = null;
});
