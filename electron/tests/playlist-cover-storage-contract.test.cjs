const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8');
test('original cover storage uses main-window-only IPC and independent fail-closed settings coordination', () => {
  const main = read('main/main.ts');
  for (const channel of ['playlist-cover-storage-statistics', 'prune-playlist-cover-storage']) {
    assert.match(main, new RegExp(`ipcMain.handle\\("${channel}"[\\s\\S]*?requirePlaylistCoverStorageOwner\\(event\\)`));
  }
  assert.match(main, /function requirePlaylistCoverStorageOwner[\s\S]*?!mainWindow[\s\S]*?event\.sender !== mainWindow\.webContents/);
  const app = read('renderer/src/App.vue');
  assert.match(app, /collectPlaylistCoverReferences\(window\.localStorage/);
  assert.match(app, /currentLibrary\.value/);
  assert.match(app, /PlaylistCoverStorageSettings/);
  assert.match(read('preload/preload.ts'), /getPlaylistCoverStorageStatistics/);
  assert.match(read('renderer/src/env.d.ts'), /prunePlaylistCoverStorage/);
});
test('original cover settings use icon actions, a custom focus-trapped confirmation and busy/error states', () => {
  const settings = read('renderer/src/components/PlaylistCoverStorageSettings.vue');
  assert.match(settings, /RefreshCw/);
  assert.match(settings, /Trash2/);
  assert.match(settings, /role="dialog"/);
  assert.match(settings, /aria-modal="true"/);
  assert.match(settings, /keydown\.esc/);
  assert.match(settings, /event\.key !== "Tab"/);
  assert.match(settings, /role="alert"/);
  assert.doesNotMatch(settings, /window\.confirm/);
});

test('storage IPC rejects absent/destroyed main windows, foreign windows and subframes before touching the cache', async () => {
  const main = read('main/main.ts');
  const start = main.indexOf('function requirePlaylistCoverStorageOwner(');
  const end = main.indexOf('ipcMain.handle("read-appearance-background"', start);
  assert.ok(start >= 0 && end > start);
  const handlers = new Map();
  const calls = [];
  const contents = { mainFrame: {} };
  const context = { mainWindow: { webContents: contents, isDestroyed: () => false },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    playlistCoverImageCache: { originalStatistics: payload => calls.push(payload), pruneOriginals: payload => calls.push(payload) } };
  vm.runInNewContext(main.slice(start, end).replaceAll(': Electron.IpcMainInvokeEvent', '').replaceAll(': unknown', ''), context);
  for (const handler of handlers.values()) {
    const trusted = { sender: contents, senderFrame: contents.mainFrame };
    assert.throws(() => handler({ sender: {}, senderFrame: contents.mainFrame }, {}), /仅限主窗口/);
    assert.throws(() => handler({ sender: contents, senderFrame: {} }, {}), /仅限主窗口/);
    context.mainWindow.isDestroyed = () => true;
    assert.throws(() => handler(trusted, {}), /仅限主窗口/);
    context.mainWindow = null;
    assert.throws(() => handler(trusted, {}), /仅限主窗口/);
    context.mainWindow = { webContents: contents, isDestroyed: () => false };
    assert.equal(calls.length, 0);
  }
  const payload = { complete: true, urls: [] };
  for (const handler of handlers.values()) handler({ sender: contents, senderFrame: contents.mainFrame }, payload);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(value => value === payload));
});
