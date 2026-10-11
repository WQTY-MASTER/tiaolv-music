import { BrowserWindow, screen, type IpcMain, type Rectangle, type WebContents } from "electron";
import path from "node:path";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { normalizeMiniPlayerPreferences } from "../renderer/src/services/appearanceSettings";
import { getMiniWindowShape } from "../shared/miniWindowShape";
import {
  MINI_MAX_HEIGHT, MINI_MAX_WIDTH, MINI_MIN_HEIGHT, MINI_MIN_WIDTH, MINI_QUEUE_HEIGHT, MINI_RESIZE_EDGES, parseMiniPlayerAction,
  type MiniPlayerAction, type MiniPlayerSnapshot, type MiniResizeEdge, type MiniWindowCommand, type MiniWindowSnapshot
} from "../shared/miniPlayer";

interface Dependencies {
  getMainWindow(): BrowserWindow | null;
  rendererFile: string;
  rendererUrl?: string;
  icon?: string;
  dataDirectory: string;
  setupWindow(win: BrowserWindow): void;
  onAction(action: MiniPlayerAction): void;
  onVisibility(visible: boolean): void;
  ensureRecovery(): void;
}

export class MiniPlayerWindows {
  window: BrowserWindow | null = null;
  editor: BrowserWindow | null = null;
  private playback: MiniPlayerSnapshot | null = null;
  private locked = false;
  private queueExpanded = false;
  private collapsedBounds: Rectangle | null = null;
  private savedBounds: Rectangle | null = null;
  private loadedConfig = false;
  private resizeSession: { edge: MiniResizeEdge; bounds: Rectangle; x: number; y: number } | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private opening: Promise<boolean> | null = null;
  private updatingBounds = false;
  private selectedImages = new Map<number, string>();
  private importedImages = new Set<string>();
  private mainThrottling: boolean | null = null;
  private shapeKey = "";
  private paintReady = false;
  private contentReady = false;
  private initiallyShown = false;
  private startupTimer: ReturnType<typeof setTimeout> | undefined;
  private startupResolve: ((ready: boolean) => void) | undefined;
  private repaintTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly deps: Dependencies) {}

  owns(sender: WebContents, editor = false) {
    const win = editor ? this.editor : this.window;
    return Boolean(win && !win.isDestroyed() && win.webContents === sender);
  }

  getSnapshot(): MiniWindowSnapshot {
    return { playback: this.playback, window: { locked: this.locked, alwaysOnTop: this.playback?.alwaysOnTop !== false, queueExpanded: this.queueExpanded } };
  }

  private sendSnapshot() {
    for (const win of [this.window, this.editor]) {
      if (win && !win.isDestroyed()) win.webContents.send("mini-player-snapshot", this.getSnapshot());
    }
  }

  updateSnapshot(snapshot: MiniPlayerSnapshot) {
    const previous = this.playback;
    this.playback = snapshot;
    const win = this.window;
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(snapshot.alwaysOnTop);
      win.setSkipTaskbar(!snapshot.showInTaskbar);
      this.editor?.setAlwaysOnTop(snapshot.alwaysOnTop);
      if (!snapshot.showInTaskbar) this.deps.ensureRecovery();
      if (!this.locked && previous && previous.preferences.layout.mode !== snapshot.preferences.layout.mode) {
        const width = { auto: 412, compact: 340, standard: 412, wide: 512 }[snapshot.preferences.layout.mode];
        this.setBounds(win, this.clamp({ ...win.getBounds(), width }));
      }
      const current = win.getBounds(), bounded = this.clamp(current);
      if (JSON.stringify(current) !== JSON.stringify(bounded)) this.setBounds(win, bounded);
      this.syncShape(win);
    }
    this.sendSnapshot();
  }

  updateTime(currentTime: number, progress: number) {
    if (!this.playback || !Number.isFinite(currentTime) || currentTime < 0
      || !Number.isFinite(progress) || progress < 0 || progress > 100) return false;
    this.playback = { ...this.playback, currentTime, progress };
    if (this.window && !this.window.isDestroyed()) this.window.webContents.send("mini-player-time", { currentTime, progress });
    return true;
  }

  private configPath() { return path.join(this.deps.dataDirectory, "mini-window.json"); }

  private loadConfig() {
    if (this.loadedConfig) return;
    this.loadedConfig = true;
    try {
      const config = JSON.parse(readFileSync(this.configPath(), "utf8"));
      this.locked = config.locked === true;
      const bounds = config.bounds;
      if (bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) this.savedBounds = bounds;
    } catch { /* An absent or invalid window preference uses the default bounds. */ }
  }

  private saveConfig() {
    if (!this.loadedConfig) return;
    try {
      mkdirSync(this.deps.dataDirectory, { recursive: true });
      const file = this.configPath();
      writeFileSync(`${file}.tmp`, JSON.stringify({ locked: this.locked, bounds: this.savedBounds }), "utf8");
      renameSync(`${file}.tmp`, file);
    } catch (error) { console.warn("Unable to save mini-window geometry", error); }
  }

  private rememberBounds() {
    const win = this.window;
    if (!win || win.isDestroyed()) return;
    const bounds = win.getBounds();
    this.savedBounds = { ...bounds, height: this.queueExpanded ? (this.collapsedBounds?.height ?? MINI_MIN_HEIGHT) : bounds.height };
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveConfig(), 250);
  }

  private clamp(bounds: Rectangle): Rectangle {
    const area = screen.getDisplayMatching(bounds).workArea;
    const width = Math.min(area.width, MINI_MAX_WIDTH, Math.max(MINI_MIN_WIDTH, Math.round(bounds.width)));
    const layout = this.playback?.preferences.layout;
    const minimumHeight = MINI_MIN_HEIGHT + (layout?.showEqualizer ? 20 : 0) + (layout?.showTime ? 16 : 0);
    const queueHeight = this.queueExpanded ? MINI_QUEUE_HEIGHT : 0;
    const height = Math.min(area.height, MINI_MAX_HEIGHT + queueHeight, Math.max(minimumHeight + queueHeight, Math.round(bounds.height)));
    return { width, height, x: Math.max(area.x, Math.min(Math.round(bounds.x), area.x + area.width - width)), y: Math.max(area.y, Math.min(Math.round(bounds.y), area.y + area.height - height)) };
  }

  private setBounds(win: BrowserWindow, bounds: Rectangle) {
    this.updatingBounds = true;
    try { win.setBounds(bounds); } finally { this.updatingBounds = false; }
    this.syncShape(win);
    this.rememberBounds();
  }

  private syncShape(win: BrowserWindow, force = false) {
    if (process.platform !== "win32" || win.isDestroyed()) return;
    const { width, height } = win.getBounds();
    const radius = this.playback?.preferences.appearance.cornerRadius ?? 24;
    const key = `${win.id}:${width}:${height}:${radius}`;
    if (!force && key === this.shapeKey) return;
    win.setShape(getMiniWindowShape(width, height, radius));
    this.shapeKey = key;
    if (this.repaintTimer) clearTimeout(this.repaintTimer);
    // Let resize/layout settle before refreshing the entire transparent surface.
    this.repaintTimer = setTimeout(() => {
      this.repaintTimer = undefined;
      if (this.window === win && !win.isDestroyed()) win.webContents.invalidate();
    }, 50);
  }

  private settleStartup(ready: boolean) {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = undefined;
    const resolve = this.startupResolve;
    this.startupResolve = undefined;
    resolve?.(ready);
  }

  private showPreparedMini() {
    const win = this.window, main = this.deps.getMainWindow();
    if (!win || win.isDestroyed() || !main || main.isDestroyed()
      || this.initiallyShown || !this.paintReady || !this.contentReady) return;
    this.syncShape(win, true);
    this.initiallyShown = true;
    this.mainThrottling = main.webContents.getBackgroundThrottling();
    main.webContents.setBackgroundThrottling(false);
    win.show(); win.focus(); main.hide(); this.deps.onVisibility(true);
    this.settleStartup(true);
  }

  private loadWindow(win: BrowserWindow, mode: string) {
    if (this.deps.rendererUrl) {
      const url = new URL(this.deps.rendererUrl); url.searchParams.set("window", mode);
      return win.loadURL(url.toString());
    }
    return win.loadFile(this.deps.rendererFile, { query: { window: mode } });
  }

  enter(options: { showInTaskbar: boolean; alwaysOnTop: boolean }): Promise<boolean> {
    if (this.opening) return this.opening;
    if (this.window && !this.window.isDestroyed()) { this.restoreMini(); return Promise.resolve(true); }
    this.opening = this.open(options).finally(() => { this.opening = null; });
    return this.opening;
  }

  private async open(options: { showInTaskbar: boolean; alwaysOnTop: boolean }) {
    const main = this.deps.getMainWindow();
    if (!main || main.isDestroyed() || !this.playback) return false;
    this.loadConfig();
    this.queueExpanded = false;
    const current = main.getBounds();
    const width = { auto: 412, compact: 340, standard: 412, wide: 512 }[this.playback.preferences.layout.mode];
    const bounds = this.clamp(this.savedBounds ?? { x: current.x + current.width - width, y: current.y + 48, width, height: MINI_MIN_HEIGHT });
    const win = new BrowserWindow({ ...bounds, frame: false, thickFrame: false, transparent: true, backgroundColor: "#00000000", hasShadow: false,
      resizable: false, maximizable: false, fullscreenable: false, show: false, alwaysOnTop: options.alwaysOnTop,
      skipTaskbar: !options.showInTaskbar, title: "调律音乐 · 迷你播放器", icon: this.deps.icon,
      webPreferences: { preload: path.join(__dirname, "../preload/preload.js"), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    this.window = win;
    this.paintReady = false; this.contentReady = false; this.initiallyShown = false;
    const prepared = new Promise<boolean>(resolve => { this.startupResolve = resolve; });
    this.startupTimer = setTimeout(() => {
      if (this.window !== win) return;
      console.warn("Mini player content did not become ready before the startup deadline");
      this.exit();
    }, 10000);
    this.syncShape(win);
    this.deps.setupWindow(win);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    // Reassert native clipping after window chrome changes, even at the same size.
    const refreshShape = () => this.syncShape(win, true);
    win.on("show", refreshShape);
    win.on("focus", refreshShape);
    win.on("blur", refreshShape);
    win.on("restore", refreshShape);
    win.on("move", () => {
      if (this.locked && !this.updatingBounds && this.savedBounds) this.setBounds(win, this.clamp({ ...win.getBounds(), x: this.savedBounds.x, y: this.savedBounds.y }));
      else { this.syncShape(win); this.rememberBounds(); }
    });
    win.on("resize", () => {
      if (this.updatingBounds) return;
      const current = win.getBounds(), bounded = this.clamp(current);
      if (JSON.stringify(current) !== JSON.stringify(bounded)) this.setBounds(win, bounded);
      else { this.syncShape(win); this.rememberBounds(); }
    });
    win.on("closed", () => {
      if (this.window !== win) return;
      this.settleStartup(false);
      this.window = null; this.resizeSession = null;
      this.closeEditor(); this.restoreMain();
    });
    win.webContents.on("render-process-gone", () => { if (this.window === win) this.exit(); });
    win.once("ready-to-show", () => {
      if (this.window !== win || main.isDestroyed()) return;
      this.paintReady = true;
      this.sendSnapshot(); this.showPreparedMini();
    });
    if (!options.showInTaskbar) this.deps.ensureRecovery();
    try {
      await this.loadWindow(win, "mini-player");
      return await prepared;
    } catch (error) {
      console.warn("Unable to open mini player", error);
      if (this.window === win) this.exit();
      return false;
    }
  }

  private restoreMain() {
    this.queueExpanded = false;
    this.deps.onVisibility(false);
    const main = this.deps.getMainWindow();
    if (!main || main.isDestroyed()) return;
    if (main.isMinimized()) main.restore();
    main.show(); main.focus();
    if (this.mainThrottling !== null) main.webContents.setBackgroundThrottling(this.mainThrottling);
    this.mainThrottling = null;
  }

  exit() {
    if (!this.window) return false;
    if (this.repaintTimer) clearTimeout(this.repaintTimer);
    this.repaintTimer = undefined;
    this.settleStartup(false);
    this.rememberBounds(); this.saveConfig();
    const win = this.window; this.window = null; this.resizeSession = null;
    this.closeEditor();
    if (!win.isDestroyed()) win.destroy();
    this.restoreMain(); return true;
  }

  restoreMini() {
    const win = this.window;
    if (!win || win.isDestroyed() || !this.initiallyShown) return false;
    if (win.isMinimized()) win.restore();
    win.show(); win.focus(); return true;
  }

  expandQueue(expanded: boolean) {
    const win = this.window;
    if (!win || win.isDestroyed()) return false;
    if (expanded === this.queueExpanded) return true;
    const current = win.getBounds();
    if (expanded) this.collapsedBounds = current;
    this.queueExpanded = expanded;
    const height = expanded ? current.height + MINI_QUEUE_HEIGHT : this.collapsedBounds?.height ?? MINI_MIN_HEIGHT;
    this.setBounds(win, this.clamp({ ...current, height }));
    this.sendSnapshot(); return true;
  }

  private closeEditor() {
    const editor = this.editor; this.editor = null;
    this.selectedImages.clear(); this.importedImages.clear();
    if (editor && !editor.isDestroyed()) editor.destroy();
  }

  private async openEditor() {
    if (this.editor && !this.editor.isDestroyed()) { this.editor.show(); this.editor.focus(); return true; }
    const mini = this.window;
    if (!mini || mini.isDestroyed()) return false;
    const bounds = mini.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    const width = Math.min(460, area.width), height = Math.min(650, area.height);
    const win = new BrowserWindow({ x: Math.max(area.x, Math.min(bounds.x + bounds.width + 12, area.x + area.width - width)),
      y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)), width, height,
      minWidth: Math.min(360, width), minHeight: Math.min(400, height), frame: false, show: false,
      backgroundColor: "#f4f4f6", title: "迷你播放器外观", icon: this.deps.icon, alwaysOnTop: this.playback?.alwaysOnTop,
      webPreferences: { preload: path.join(__dirname, "../preload/preload.js"), contextIsolation: true, nodeIntegration: false } });
    this.editor = win;
    this.deps.setupWindow(win); win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.once("ready-to-show", () => { if (this.editor === win) { this.sendSnapshot(); win.show(); } });
    win.on("closed", () => { if (this.editor === win) { this.editor = null; this.selectedImages.clear(); this.importedImages.clear(); } });
    try { await this.loadWindow(win, "mini-editor"); return this.editor === win; }
    catch (error) { console.warn("Unable to open mini appearance editor", error); this.closeEditor(); return false; }
  }

  rememberSelectedImage(sender: WebContents, imagePath: string) { if (this.owns(sender, true)) this.selectedImages.set(sender.id, imagePath); }
  consumeSelectedImage(sender: WebContents, imagePath: string) {
    if (!this.owns(sender, true) || this.selectedImages.get(sender.id) !== imagePath) return false;
    this.selectedImages.delete(sender.id); return true;
  }
  rememberImportedImage(url: string) { this.importedImages.add(url); }

  private command(sender: WebContents, raw: unknown) {
    if (!raw || typeof raw !== "object") return false;
    const command = raw as MiniWindowCommand;
    if (command.type === "close-editor") { if (!this.owns(sender, true)) return false; this.closeEditor(); return true; }
    if (!this.owns(sender)) return false;
    switch (command.type) {
      case "ready": this.contentReady = true; this.showPreparedMini(); return true;
      case "return": return this.exit();
      case "customize": return this.openEditor();
      case "minimize": this.resizeSession = null; this.window?.minimize(); return true;
      case "lock":
        if (typeof command.value !== "boolean") return false;
        this.rememberBounds(); this.locked = command.value; this.resizeSession = null;
        this.saveConfig(); this.sendSnapshot(); return true;
      case "pin":
        if (typeof command.value !== "boolean") return false;
        this.window?.setAlwaysOnTop(command.value); this.editor?.setAlwaysOnTop(command.value);
        if (this.playback) this.playback = { ...this.playback, alwaysOnTop: command.value };
        this.sendSnapshot(); this.deps.onAction({ type: "pin", value: command.value }); return true;
      default: return false;
    }
  }

  installIpc(ipc: IpcMain) {
    ipc.handle("mini-player-get-snapshot", event => this.owns(event.sender) || this.owns(event.sender, true) ? this.getSnapshot() : null);
    ipc.handle("mini-window-command", (event, command: unknown) => this.command(event.sender, command));
    ipc.on("mini-player-action", (event, raw: unknown) => {
      if (!this.owns(event.sender)) return;
      const action = parseMiniPlayerAction(raw); if (action) this.deps.onAction(action);
    });
    ipc.handle("mini-player-set-appearance", (event, raw: unknown) => {
      if (!this.owns(event.sender, true) || !raw || typeof raw !== "object") return false;
      const preferences = normalizeMiniPlayerPreferences(raw);
      const image = preferences.background.imagePath;
      if (image && image !== this.playback?.preferences.background.imagePath && !this.importedImages.has(image)) return false;
      this.deps.onAction({ type: "appearance", preferences }); return true;
    });
    ipc.handle("mini-resize-start", (event, edge: MiniResizeEdge) => {
      if (!this.owns(event.sender) || this.locked || !MINI_RESIZE_EDGES.includes(edge) || !this.window) return false;
      const point = screen.getCursorScreenPoint(); this.resizeSession = { edge, bounds: this.window.getBounds(), ...point }; return true;
    });
    ipc.handle("mini-resize-move", event => {
      const state = this.resizeSession, win = this.window;
      if (!this.owns(event.sender) || this.locked || !state || !win) return false;
      const point = screen.getCursorScreenPoint(); const dx = point.x - state.x, dy = point.y - state.y;
      const bounds = { ...state.bounds };
      if (state.edge.includes("e")) bounds.width += dx;
      if (state.edge.includes("s")) bounds.height += dy;
      if (state.edge.includes("w")) { bounds.x += dx; bounds.width -= dx; }
      if (state.edge.includes("n")) { bounds.y += dy; bounds.height -= dy; }
      const next = this.clamp(bounds);
      if (state.edge.includes("w")) next.x = Math.min(state.bounds.x + state.bounds.width - next.width, next.x);
      if (state.edge.includes("n")) next.y = Math.min(state.bounds.y + state.bounds.height - next.height, next.y);
      this.setBounds(win, this.clamp(next)); return true;
    });
    ipc.handle("mini-resize-end", event => { if (!this.owns(event.sender)) return false; this.resizeSession = null; this.rememberBounds(); return true; });
  }

  dispose() {
    if (this.repaintTimer) clearTimeout(this.repaintTimer);
    this.repaintTimer = undefined;
    this.settleStartup(false);
    this.rememberBounds(); this.saveConfig();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.closeEditor();
    const win = this.window; this.window = null; this.resizeSession = null;
    if (win && !win.isDestroyed()) win.destroy();
  }
}
