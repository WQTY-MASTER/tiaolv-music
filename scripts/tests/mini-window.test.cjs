const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../../electron/package.json'));
const ts = local('typescript');

function fixture(options = {}) {
  const root = path.resolve(__dirname, '../../electron/src');
  const file = path.join(root, 'main/miniPlayerWindows.ts');
  assert.ok(fs.existsSync(file), 'Dedicated frameless mini-window controller must exist');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-mini-unit-'));
  const handlers = new Map();
  const events = new Map();
  const ipcMain = { handle: (name, fn) => handlers.set(name, fn), on: (name, fn) => events.set(name, fn) };
  let id = 0;
  class Window extends EventEmitter {
    constructor(options = {}) {
      super(); this.options = options; this.id = ++id; this.bounds = { x: 20, y: 20, width: 1280, height: 860, ...options };
      this.visible = options.show !== false; this.dead = false; this.minimized = false; this.top = Boolean(options.alwaysOnTop);
      this.webContents = new EventEmitter(); this.webContents.id = this.id;
      this.webContents.send = (name, value) => this.sent.push([name, value]); this.sent = [];
      this.webContents.setWindowOpenHandler = () => {};
      this.throttled = true;
      this.webContents.getBackgroundThrottling = () => this.throttled;
      this.webContents.setBackgroundThrottling = value => { this.throttled = value; };
      this.repaints = 0;
      this.webContents.invalidate = () => { this.repaints++; };
    }
    static fromWebContents(sender) { return windows.find(win => win.webContents === sender) || null; }
    isDestroyed() { return this.dead; } getBounds() { return { x: this.bounds.x, y: this.bounds.y, width: this.bounds.width, height: this.bounds.height }; }
    setBounds(value) { this.bounds = { ...this.bounds, ...value }; this.emit('resize'); this.emit('move'); }
    setMinimumSize() {} setMaximumSize() {} setResizable(value) { this.resizable = value; }
    setAlwaysOnTop(value) { this.top = value; } setSkipTaskbar(value) { this.skip = value; }
    setShape(value) { this.shape = value; this.shapeUpdates = (this.shapeUpdates || 0) + 1; }
    isMinimized() { return this.minimized; } restore() { this.minimized = false; }
    minimize() { this.minimized = true; } show() { this.visible = true; } hide() { this.visible = false; }
    focus() {} isVisible() { return this.visible; }
    async loadFile() {
      if (this.failLoad) throw new Error('load failed');
      if (!options.holdPaint) this.emit('ready-to-show');
      if (!options.holdContent && this.options.transparent) handlers.get('mini-window-command')({ sender: this.webContents }, { type: 'ready' });
    }
    async loadURL() { return this.loadFile(); }
    destroy() { this.dead = true; this.emit('closed'); }
    close() { this.destroy(); }
  }
  const windows = [];
  const cursor = { x: 700, y: 300 };
  const NativeWindow = class extends Window { constructor(windowOptions) { super(windowOptions); this.failLoad = options.failLoad && windowOptions?.show === false; windows.push(this); } };
  const main = new NativeWindow();
  const actions = [], visibility = [];
  const recovery = { count: 0 };
  const warnings = [];
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const require = name => name === 'electron' ? { BrowserWindow: NativeWindow, screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1600, height: 900 } }), getCursorScreenPoint: () => ({ ...cursor }) } }
      : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts')) : local(name);
    const timer = (callback, delay) => setTimeout(callback, delay === 10000 && options.shortStartupTimeout ? 25 : delay);
    vm.runInNewContext(source, { module, exports: module.exports, require, __dirname: path.dirname(filename), console: { ...console, warn: (...args) => warnings.push(args) }, setTimeout: timer, clearTimeout, structuredClone, URL, Date, process: { platform: options.platform || 'win32' } });
    return module.exports;
  }
  const shared = load(path.join(root, 'shared/miniPlayer.ts'));
  const { MiniPlayerWindows } = load(file);
  const controller = new MiniPlayerWindows({ getMainWindow: () => main, rendererFile: 'index.html', dataDirectory: data,
    setupWindow: () => {}, onAction: action => actions.push(action), onVisibility: value => visibility.push(value), ensureRecovery: () => { recovery.count++; } });
  controller.installIpc(ipcMain);
  const snapshot = { track: { id: '1', title: 'Test', artist: 'Artist', album: '', duration: 200, primary: '#ffffff', secondary: '#ffffff', mark: '', liked: false, history: false },
    queue: [], playlists: [], isPlaying: true, progress: 5, lyric: 'Test lyric', themeStyle: {}, preferences: load(path.join(root, 'renderer/src/services/appearanceSettings.ts')).createDefaultMiniPlayerPreferences(),
    volume: 50, playMode: 'sequence', currentTime: 10, duration: 200, alwaysOnTop: true, showInTaskbar: true };
  controller.updateSnapshot(snapshot);
  const invoke = (name, sender, ...args) => handlers.get(name)({ sender: sender.webContents }, ...args);
  return { controller, main, windows, actions, visibility, snapshot, invoke, events, shared, cursor, recovery, warnings,
    cleanup() { controller.dispose(); fs.rmSync(data, { recursive: true, force: true }); } };
}

test('mini is transparent, frameless and preserves main geometry on return', async () => {
  const f = fixture();
  try {
    const before = f.main.getBounds();
    assert.equal(await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true }), true);
    const mini = f.controller.window;
    assert.equal(mini.options.frame, false); assert.equal(mini.options.transparent, true);
    assert.equal(mini.options.thickFrame, false, 'Native thick frame must not leak rectangular corners');
    assert.equal(mini.options.titleBarOverlay, undefined); assert.equal(f.main.visible, false);
    assert.equal(f.main.throttled, false, 'Hidden main renderer must continue its playback/lyric clock');
    assert.deepEqual(f.main.getBounds(), before);
    assert.equal(f.controller.exit(), true); assert.equal(f.main.visible, true);
    assert.equal(f.main.throttled, true);
    assert.deepEqual(f.main.getBounds(), before); assert.equal(mini.dead, true);
  } finally { f.cleanup(); }
});

test('first paint must not display mini until its actual content is ready', async () => {
  const f = fixture({ holdContent: true });
  try {
    const entering = f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window;
    assert.equal(mini.visible, false, 'First paint is not proof that Vue has rendered playback content');
    assert.equal(f.main.visible, true);
    assert.equal(f.controller.restoreMini(), false, 'Tray restore must not bypass startup readiness');
    assert.equal(f.invoke('mini-window-command', f.main, { type: 'ready' }), false);
    mini.setShape([]);
    assert.equal(f.invoke('mini-window-command', mini, { type: 'ready' }), true);
    assert.equal(await entering, true);
    assert.equal(mini.visible, true);
    assert.equal(f.main.visible, false);
    assert.ok(mini.shape.length > 0, 'Apply clipping before initial visibility');
    mini.minimize();
    assert.equal(f.invoke('mini-window-command', mini, { type: 'ready' }), true);
    assert.equal(mini.isMinimized(), true, 'Duplicate ready must not restore a minimized mini');
  } finally { f.cleanup(); }
});

test('renderer ready before first paint stays hidden until paint and disposal settles pending entry', async () => {
  const f = fixture({ holdPaint: true });
  try {
    const entering = f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window;
    assert.equal(mini.visible, false);
    assert.equal(f.main.visible, true);
    mini.emit('ready-to-show');
    assert.equal(await entering, true);
    assert.equal(mini.visible, true);
  } finally { f.cleanup(); }
  const pending = fixture({ holdContent: true });
  try {
    const entering = pending.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    pending.controller.dispose();
    assert.equal(await entering, false, 'Closing must settle a pending startup, not leave IPC hanging');
    assert.equal(pending.main.visible, true);
  } finally { pending.cleanup(); }
});

test('missing renderer readiness times out without leaving the main window hidden', async () => {
  const f = fixture({ holdContent: true, shortStartupTimeout: true });
  try {
    assert.equal(await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true }), false);
    assert.equal(f.controller.window, null);
    assert.equal(f.main.visible, true);
    assert.equal(f.main.throttled, true);
    assert.equal(f.warnings.length, 1);
  } finally { f.cleanup(); }
});

test('native rounded region follows radius, resize and queue without clipping center or edge grips', async () => {
  const f = fixture();
  const contains = (shape, x, y) => shape.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
  try {
    await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window;
    assert.ok(Array.isArray(mini.shape), 'Windows mini must receive a native rounded region');
    assert.equal(contains(mini.shape, 0, 0), false);
    assert.equal(contains(mini.shape, 200, 0), true);
    assert.equal(contains(mini.shape, 0, 84), true, 'Side resize grips must remain accessible');
    const first = JSON.stringify(mini.shape);
    const preferences = structuredClone(f.snapshot.preferences);
    preferences.appearance.cornerRadius = 32;
    f.controller.updateSnapshot({ ...f.snapshot, preferences });
    assert.notEqual(JSON.stringify(mini.shape), first);
    const updates = mini.shapeUpdates;
    f.controller.updateSnapshot({ ...f.snapshot, preferences });
    assert.equal(mini.shapeUpdates, updates, 'Clock/metadata packets must not repeatedly reshape the window');
    mini.setBounds({ width: 720, height: 320 });
    assert.equal(contains(mini.shape, 719, 319), false);
    assert.equal(contains(mini.shape, 719, 160), true);
    assert.equal(contains(mini.shape, 360, 319), true);
    assert.ok(mini.shape.every(r => r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x + r.width <= 720 && r.y + r.height <= 320));
    assert.ok(mini.shape.length <= 65);
    f.controller.expandQueue(true);
    assert.equal(contains(mini.shape, 360, 527), true);
    assert.equal(contains(mini.shape, 719, 527), false);
    f.controller.expandQueue(false);
    assert.equal(contains(mini.shape, 360, 320), false);
  } finally { f.cleanup(); }
  const linux = fixture({ platform: 'linux' });
  try {
    await linux.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    assert.equal(linux.controller.window.shape, undefined, 'Windows region policy must not affect other platforms');
  } finally { linux.cleanup(); }
});

test('window lifecycle reapplies native clipping even when geometry and radius are unchanged', async () => {
  const f = fixture();
  try {
    await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window;
    const expected = JSON.stringify(mini.shape);
    for (const event of ['show', 'focus', 'blur', 'restore']) {
      mini.setShape([]);
      mini.emit(event);
      assert.equal(JSON.stringify(mini.shape), expected, `${event} must restore lost native clipping without a size change`);
    }
  } finally { f.cleanup(); }
});

test('Windows surface requests a full repaint after opening, lifecycle and settled resizing', async () => {
  const f = fixture();
  const settle = () => new Promise(resolve => setTimeout(resolve, 90));
  try {
    await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window;
    await settle();
    assert.ok(mini.repaints > 0, 'A prepared initial surface must request a full repaint');
    for (const event of ['show', 'focus', 'blur', 'restore']) {
      const before = mini.repaints;
      mini.emit(event);
      await settle();
      assert.equal(mini.repaints, before + 1, `${event} should refresh the full native surface`);
    }
    const before = mini.repaints;
    for (const width of [420, 540, 600, 720]) mini.setBounds({ width, height: 320 });
    await settle();
    assert.equal(mini.repaints, before + 1, 'Rapid resizing should request one final full repaint');
    f.controller.updateSnapshot(f.snapshot);
    await settle();
    assert.equal(mini.repaints, before + 1, 'Unchanged playback updates must not cause extra repaint requests');
    mini.setBounds({ width: 680 });
    f.controller.exit();
    await settle();
    assert.equal(mini.repaints, before + 1, 'A closed window must not be repainted by a pending callback');
  } finally { f.cleanup(); }
});

test('native clipping preserves partially covered CSS edge pixels for antialiasing', async () => {
  const f = fixture();
  const contains = (shape, x, y) => shape.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
  try {
    const preferences = structuredClone(f.snapshot.preferences);
    preferences.appearance.cornerRadius = 32;
    f.controller.updateSnapshot({ ...f.snapshot, preferences });
    await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window, { width, height } = mini.getBounds();
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const intersectsCircle = (32 - x - 1) ** 2 + (32 - y - 1) ** 2 < 32 ** 2;
      if (!intersectsCircle) continue;
      for (const [px, py] of [[x, y], [width - x - 1, y], [x, height - y - 1], [width - x - 1, height - y - 1]]) {
        assert.equal(contains(mini.shape, px, py), true, `Native hard clipping must preserve antialiased CSS pixel ${px},${py}`);
      }
    }
    assert.equal(contains(mini.shape, 0, 0), false, 'Keeping smooth edge pixels must not restore rectangular corners');
  } finally { f.cleanup(); }
});

test('editor edits are normalized, selected-image grants are single-use and return cleans up', async () => {
  const f = fixture();
  try {
    await f.controller.enter({ showInTaskbar: false, alwaysOnTop: true });
    assert.ok(f.recovery.count > 0, 'Taskbar-hidden mini must provide tray recovery');
    const mini = f.controller.window;
    assert.equal(await f.invoke('mini-window-command', mini, { type: 'customize' }), true);
    const editor = f.controller.editor;
    assert.equal(f.invoke('mini-player-set-appearance', mini, f.snapshot.preferences), false);
    const preferences = JSON.parse(JSON.stringify(f.snapshot.preferences));
    preferences.appearance.cornerRadius = 1000;
    assert.equal(f.invoke('mini-player-set-appearance', editor, preferences), true);
    assert.equal(f.actions.at(-1).preferences.appearance.cornerRadius, 32);
    preferences.background.imagePath = 'file:///C:/private.png';
    assert.equal(f.invoke('mini-player-set-appearance', editor, preferences), false);
    f.controller.rememberSelectedImage(editor.webContents, 'C:/selected.png');
    assert.equal(f.controller.consumeSelectedImage(mini.webContents, 'C:/selected.png'), false);
    assert.equal(f.controller.consumeSelectedImage(editor.webContents, 'C:/other.png'), false);
    assert.equal(f.controller.consumeSelectedImage(editor.webContents, 'C:/selected.png'), true);
    assert.equal(f.controller.consumeSelectedImage(editor.webContents, 'C:/selected.png'), false);
    f.controller.exit(); assert.equal(editor.dead, true); assert.equal(f.main.visible, true);
  } finally { f.cleanup(); }
});

test('failed mini load restores main and unexpected mini closure leaves no editor', async () => {
  const failed = fixture({ failLoad: true });
  try {
    assert.equal(await failed.controller.enter({ showInTaskbar: true, alwaysOnTop: true }), false);
    assert.equal(failed.main.visible, true); assert.equal(failed.controller.window, null);
    assert.equal(failed.warnings.length, 1, JSON.stringify(failed.warnings));
  } finally { failed.cleanup(); }
  const f = fixture();
  try {
    await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    await f.invoke('mini-window-command', f.controller.window, { type: 'customize' });
    const editor = f.controller.editor;
    f.controller.window.close();
    assert.equal(f.controller.window, null); assert.equal(editor.dead, true);
    assert.equal(f.main.visible, true); assert.equal(f.main.throttled, true);
  } finally { f.cleanup(); }
});

test('lightweight clock updates do not resend queues or appearance to the editor', async () => {
  const f = fixture();
  try {
    await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window;
    await f.invoke('mini-window-command', mini, { type: 'customize' });
    const editor = f.controller.editor;
    const previous = editor.sent.length;
    assert.equal(typeof f.controller.updateTime, 'function', 'Mini clocks need a lightweight transport');
    assert.equal(f.controller.updateTime(15, 7.5), true);
    assert.equal(editor.sent.length, previous);
    assert.equal(mini.sent.at(-1)[0], 'mini-player-time');
    assert.equal(f.controller.getSnapshot().playback.currentTime, 15);
    assert.equal(f.controller.updateTime(NaN, 10), false);
    assert.equal(f.controller.updateTime(10, 101), false);
  } finally { f.cleanup(); }
});

test('resize sessions enforce explicit minimum/maximum and queue-dependent limits', async () => {
  const f = fixture();
  try {
    await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window;
    f.invoke('mini-resize-start', mini, 'se');
    f.cursor.x += 2000; f.cursor.y += 1200;
    f.invoke('mini-resize-move', mini);
    assert.equal(mini.getBounds().width, 720); assert.equal(mini.getBounds().height, 320);
    f.invoke('mini-resize-end', mini);
    f.invoke('mini-resize-start', mini, 'se');
    f.cursor.x -= 4000; f.cursor.y -= 2400;
    f.invoke('mini-resize-move', mini);
    assert.equal(mini.getBounds().width, 340); assert.equal(mini.getBounds().height, 168);
    f.invoke('mini-resize-end', mini);
    f.controller.expandQueue(true);
    f.invoke('mini-resize-start', mini, 'se');
    f.cursor.x += 4000; f.cursor.y += 2400;
    f.invoke('mini-resize-move', mini);
    assert.equal(mini.getBounds().width, 720); assert.equal(mini.getBounds().height, 528);
  } finally { f.cleanup(); }
});

test('lock blocks resize, minimize preserves playback owner, queue restores manual size', async () => {
  const f = fixture();
  try {
    await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window;
    mini.setBounds({ width: 600, height: 220 });
    assert.equal(f.invoke('mini-window-command', mini, { type: 'lock', value: true }), true);
    assert.equal(f.invoke('mini-resize-start', mini, 'se'), false);
    assert.equal(f.invoke('mini-window-command', mini, { type: 'lock', value: false }), true);
    assert.equal(f.invoke('mini-resize-start', mini, 'se'), true);
    f.invoke('mini-resize-end', mini);
    f.controller.expandQueue(true); assert.equal(mini.getBounds().width, 600); assert.equal(mini.getBounds().height, 428);
    f.controller.expandQueue(false); assert.equal(mini.getBounds().height, 220);
    f.invoke('mini-window-command', mini, { type: 'minimize' });
    assert.equal(mini.isMinimized(), true); assert.equal(f.main.dead, false); assert.equal(f.main.visible, false);
  } finally { f.cleanup(); }
});

test('foreign IPC and malformed actions cannot resize, return or change preferences', async () => {
  const f = fixture();
  try {
    await f.controller.enter({ showInTaskbar: true, alwaysOnTop: true });
    const mini = f.controller.window;
    assert.equal(f.invoke('mini-window-command', f.main, { type: 'return' }), false);
    assert.equal(f.invoke('mini-resize-start', f.main, 'se'), false);
    assert.equal(f.invoke('mini-window-command', mini, { type: 'pin', value: 'false' }), false);
    assert.equal(f.invoke('mini-window-command', mini, { type: 'return' }), true);
    assert.equal(f.shared.parseMiniPlayerAction({ type: 'volume', value: Infinity }), null);
    assert.equal(f.shared.parseMiniPlayerAction({ type: 'volume', value: 101 }), null);
    assert.equal(f.shared.parseMiniPlayerAction({ type: 'queue-play', key: '' }), null);
    assert.equal(f.shared.parseMiniPlayerAction({ type: 'arbitrary-operation' }), null);
    assert.equal(f.shared.parseMiniPlayerAction({ type: 'volume', value: 35 }).value, 35);
  } finally { f.cleanup(); }
});
