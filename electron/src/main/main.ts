import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
  type MenuItemConstructorOptions,
  type Rectangle
} from "electron";
import path from "node:path";
import { mkdirSync, openAsBlob, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
  DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE,
  DEFAULT_DESKTOP_LYRICS_PREFERENCES,
  DESKTOP_LYRICS_UNLOCK_SHORTCUT,
  normalizeDesktopLyricsPreferences,
  type DesktopLyricsAction,
  type DesktopLyricsBounds,
  type DesktopLyricsPlaybackState,
  type DesktopLyricsPreferences
} from "../shared/desktopLyrics";

const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const MINI_WINDOW_WIDTH = 412;
const MINI_WINDOW_HEIGHT = 184;
const MINI_QUEUE_WINDOW_HEIGHT = 396;
const WINDOW_ANIMATION_DURATION = 220;
const BACKEND_BASE_URL = "http://127.0.0.1:17890";
const DESKTOP_LYRICS_DEFAULT_WIDTH = 960;
const DESKTOP_LYRICS_DEFAULT_HEIGHT = 220;
const DESKTOP_LYRICS_MIN_WIDTH = 560;
const DESKTOP_LYRICS_MIN_HEIGHT = 140;
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

interface MiniWindowState {
  windowId: number;
  bounds: Rectangle;
  wasMaximized: boolean;
  wasFullScreen: boolean;
  wasAlwaysOnTop: boolean;
  wasMenuBarVisible: boolean;
  minimumSize: [number, number];
  wasResizable: boolean;
  queueExpanded: boolean;
}

interface DesktopLyricsConfig {
  bounds?: DesktopLyricsBounds;
  preferences: DesktopLyricsPreferences;
}

let mainWindow: BrowserWindow | null = null;
let desktopLyricsWindow: BrowserWindow | null = null;
let miniWindowState: MiniWindowState | null = null;
let windowAnimationId = 0;
let taskbarThumbnailButtonsEnabled = false;
let taskbarPlaybackIsPlaying = false;
let systemTray: Tray | null = null;
let systemTrayEnabled = false;
let desktopLyricsSaveTimer: ReturnType<typeof setTimeout> | null = null;
let desktopLyricsPlaybackState: DesktopLyricsPlaybackState = {
  ...DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE
};
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

const chromiumCachePath = path.join(
  process.env.LOCALAPPDATA || app.getPath("temp"),
  "tiaolv-music-electron",
  "ChromiumCache"
);
mkdirSync(chromiumCachePath, { recursive: true });
app.setName("调律音乐");
app.commandLine.appendSwitch("disk-cache-dir", chromiumCachePath);
app.disableHardwareAcceleration();
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
  const width = clamp(stored.width, DESKTOP_LYRICS_MIN_WIDTH, display.width);
  const height = clamp(stored.height, DESKTOP_LYRICS_MIN_HEIGHT, display.height);
  return {
    width,
    height,
    x: clamp(stored.x, display.x, display.x + display.width - width),
    y: clamp(stored.y, display.y, display.y + display.height - height)
  };
}

function saveDesktopLyricsConfig() {
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
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  desktopLyricsWindow.webContents.send(
    "desktop-lyrics-preferences",
    desktopLyricsConfig.preferences
  );
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

function applyDesktopLyricsLock(locked: boolean) {
  const win = desktopLyricsWindow;
  if (!win || win.isDestroyed()) return false;

  if (locked) {
    globalShortcut.unregister(DESKTOP_LYRICS_UNLOCK_SHORTCUT);
    const registered = globalShortcut.register(DESKTOP_LYRICS_UNLOCK_SHORTCUT, () => {
      updateDesktopLyricsPreferences({ locked: false });
    });
    if (!registered) {
      desktopLyricsConfig.preferences = {
        ...desktopLyricsConfig.preferences,
        locked: false
      };
      win.setIgnoreMouseEvents(false);
      sendDesktopLyricsPreferences();
      scheduleDesktopLyricsConfigSave();
      return false;
    }
  } else {
    globalShortcut.unregister(DESKTOP_LYRICS_UNLOCK_SHORTCUT);
  }

  win.setIgnoreMouseEvents(locked, { forward: true });
  return true;
}

function updateDesktopLyricsPreferences(patch: Partial<DesktopLyricsPreferences>) {
  const next = normalizeDesktopLyricsPreferences({
    ...desktopLyricsConfig.preferences,
    ...patch
  });
  desktopLyricsConfig.preferences = next;
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    applyDesktopLyricsLock(next.locked);
    sendDesktopLyricsPreferences();
  }
  scheduleDesktopLyricsConfigSave();
  if (systemTrayEnabled) refreshSystemTray();
  return desktopLyricsConfig.preferences;
}

function createDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.showInactive();
    return desktopLyricsWindow;
  }

  const win = new BrowserWindow({
    ...getDesktopLyricsBounds(),
    minWidth: DESKTOP_LYRICS_MIN_WIDTH,
    minHeight: DESKTOP_LYRICS_MIN_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
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
  desktopLyricsWindow.setAlwaysOnTop(true, "floating");
  desktopLyricsWindow.on("move", scheduleDesktopLyricsConfigSave);
  desktopLyricsWindow.on("resize", scheduleDesktopLyricsConfigSave);
  desktopLyricsWindow.on("closed", () => {
    globalShortcut.unregister(DESKTOP_LYRICS_UNLOCK_SHORTCUT);
    desktopLyricsWindow = null;
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
    desktopLyricsWindow.close();
    return false;
  }
  createDesktopLyricsWindow();
  return true;
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
        ? "桌面歌词已锁定（Ctrl+Alt+L 解锁）"
        : "锁定桌面歌词",
      type: "checkbox",
      checked: desktopLyricsConfig.preferences.locked,
      enabled: state.desktopLyricsVisible && !desktopLyricsConfig.preferences.locked,
      click: () => updateDesktopLyricsPreferences({ locked: true })
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
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
    if (miniWindowState?.windowId === win.id) miniWindowState = null;
  });

  if (rendererUrl) {
    win.loadURL(rendererUrl);
    return;
  }

  win.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getMiniWindowBounds(win: BrowserWindow): Rectangle {
  const current = win.getBounds();
  const workArea = screen.getDisplayMatching(current).workArea;
  return {
    width: MINI_WINDOW_WIDTH,
    height: MINI_WINDOW_HEIGHT,
    x: clamp(current.x + current.width - MINI_WINDOW_WIDTH, workArea.x, workArea.x + workArea.width - MINI_WINDOW_WIDTH),
    y: clamp(current.y + 48, workArea.y, workArea.y + workArea.height - MINI_WINDOW_HEIGHT)
  };
}

function animateWindowBounds(win: BrowserWindow, target: Rectangle) {
  const animationId = ++windowAnimationId;
  const start = win.getBounds();
  const startedAt = Date.now();

  return new Promise<void>((resolve) => {
    function step() {
      if (win.isDestroyed() || animationId !== windowAnimationId) {
        resolve();
        return;
      }

      const progress = Math.min(1, (Date.now() - startedAt) / WINDOW_ANIMATION_DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);
      win.setBounds({
        x: Math.round(start.x + (target.x - start.x) * eased),
        y: Math.round(start.y + (target.y - start.y) * eased),
        width: Math.round(start.width + (target.width - start.width) * eased),
        height: Math.round(start.height + (target.height - start.height) * eased)
      });

      if (progress >= 1) {
        resolve();
        return;
      }
      setTimeout(step, 16);
    }

    step();
  });
}

async function stabilizeRestoredWindow(win: BrowserWindow) {
  if (win.isMinimized()) win.restore();
  win.show();
  await new Promise((resolve) => setTimeout(resolve, 80));
  if (win.isMinimized()) win.restore();
  await new Promise((resolve) => setTimeout(resolve, 32));
}

async function enterMiniMode(win: BrowserWindow) {
  if (miniWindowState?.windowId === win.id) return true;
  if (miniWindowState) return false;

  const wasMaximized = win.isMaximized();
  miniWindowState = {
    windowId: win.id,
    bounds: wasMaximized ? win.getNormalBounds() : win.getBounds(),
    wasMaximized,
    wasFullScreen: win.isFullScreen(),
    wasAlwaysOnTop: win.isAlwaysOnTop(),
    wasMenuBarVisible: win.isMenuBarVisible(),
    minimumSize: win.getMinimumSize() as [number, number],
    wasResizable: win.isResizable(),
    queueExpanded: false
  };

  const target = getMiniWindowBounds(win);
  win.setMinimumSize(MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT);
  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();
  win.setMenuBarVisibility(false);
  await stabilizeRestoredWindow(win);
  win.setAlwaysOnTop(true);
  await animateWindowBounds(win, target);
  win.setResizable(false);
  if (!win.isDestroyed()) win.focus();
  return !win.isDestroyed();
}

async function setMiniQueueExpanded(win: BrowserWindow, expanded: boolean) {
  const state = miniWindowState;
  if (!state || state.windowId !== win.id) return false;
  if (state.queueExpanded === expanded) return true;

  const current = win.getBounds();
  const workArea = screen.getDisplayMatching(current).workArea;
  const height = expanded ? Math.min(MINI_QUEUE_WINDOW_HEIGHT, workArea.height) : MINI_WINDOW_HEIGHT;
  const target: Rectangle = {
    x: current.x,
    y: Math.min(current.y, workArea.y + workArea.height - height),
    width: MINI_WINDOW_WIDTH,
    height
  };

  win.setResizable(true);
  await animateWindowBounds(win, target);
  if (win.isDestroyed()) return false;
  win.setResizable(false);
  state.queueExpanded = expanded;
  return true;
}

async function exitMiniMode(win: BrowserWindow) {
  const state = miniWindowState;
  if (!state || state.windowId !== win.id) return false;

  win.setResizable(true);
  await animateWindowBounds(win, state.bounds);
  if (win.isDestroyed()) return false;

  win.setMinimumSize(...state.minimumSize);
  win.setResizable(state.wasResizable);
  win.setAlwaysOnTop(state.wasAlwaysOnTop);
  win.setMenuBarVisibility(state.wasMenuBarVisible);
  if (state.wasMaximized) win.maximize();
  if (state.wasFullScreen) win.setFullScreen(true);
  miniWindowState = null;
  win.focus();
  return true;
}

ipcMain.handle("select-music-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle("select-playlist-cover-image", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["jpg", "jpeg", "png"] }
    ]
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
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
      `${BACKEND_BASE_URL}/account/netease/cloud/tracks`,
      { method: "POST", body: form }
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

  const response = await fetch(source);
  if (!response.ok) throw new Error(`下载失败: ${response.status}`);
  await writeFile(result.filePath, new Uint8Array(await response.arrayBuffer()));
  return true;
});

ipcMain.handle("enter-mini-mode", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? enterMiniMode(win) : false;
});

ipcMain.handle("exit-mini-mode", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? exitMiniMode(win) : false;
});

ipcMain.handle("set-mini-queue-expanded", async (event, expanded: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? setMiniQueueExpanded(win, Boolean(expanded)) : false;
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

ipcMain.handle("toggle-desktop-lyrics-window", (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return false;
  return toggleDesktopLyricsWindow();
});

ipcMain.handle("close-desktop-lyrics-window", (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== desktopLyricsWindow) return false;
  desktopLyricsWindow?.close();
  return true;
});

ipcMain.handle("get-desktop-lyrics-snapshot", (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== desktopLyricsWindow) return null;
  return {
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

ipcMain.on("update-desktop-lyrics-time", (event, currentTime: number) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow || !Number.isFinite(currentTime)) return;
  desktopLyricsPlaybackState.currentTime = Math.max(0, currentTime);
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  desktopLyricsWindow.webContents.send("desktop-lyrics-time", desktopLyricsPlaybackState.currentTime);
});

ipcMain.handle("update-desktop-lyrics-preferences", (event, patch: Partial<DesktopLyricsPreferences>) => {
  if (BrowserWindow.fromWebContents(event.sender) !== desktopLyricsWindow) {
    return desktopLyricsConfig.preferences;
  }
  return updateDesktopLyricsPreferences(patch ?? {});
});

ipcMain.on("desktop-lyrics-action", (event, action: DesktopLyricsAction) => {
  if (BrowserWindow.fromWebContents(event.sender) !== desktopLyricsWindow) return;
  if (!["previous", "toggle", "next", "cycle-mode"].includes(action)) return;
  mainWindow?.webContents.send("desktop-lyrics-action", action);
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
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.tiaolvmusic.desktop");
    }
    readDesktopLyricsConfig();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  globalShortcut.unregister(DESKTOP_LYRICS_UNLOCK_SHORTCUT);
  if (desktopLyricsSaveTimer) clearTimeout(desktopLyricsSaveTimer);
  saveDesktopLyricsConfig();
  systemTray?.destroy();
  systemTray = null;
});
