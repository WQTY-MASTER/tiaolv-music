import { app, BrowserWindow, clipboard, dialog, ipcMain, screen, type Rectangle } from "electron";
import path from "node:path";

const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const MINI_WINDOW_WIDTH = 412;
const MINI_WINDOW_HEIGHT = 184;
const MINI_QUEUE_WINDOW_HEIGHT = 396;
const WINDOW_ANIMATION_DURATION = 220;

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

let mainWindow: BrowserWindow | null = null;
let miniWindowState: MiniWindowState | null = null;
let windowAnimationId = 0;

app.disableHardwareAcceleration();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
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
    minimumSize: win.getMinimumSize(),
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

ipcMain.handle("copy-text", (_event, value: string) => {
  clipboard.writeText(String(value));
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
