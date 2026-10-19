const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function run() {
  const writes = [];
  let cacheUnavailable = false;
  const queueTrack = { id: 'local:native-queue', title: 'Native queue song', artist: 'Artist', album: 'Album', duration: 180,
    source: 'local', sourceLabel: '本地', filePath: 'G:/Fixture/native-queue.mp3' };
  const cacheSnapshot = { settings: { directory: 'Isolated cache', coverEnabled: true, lyricsEnabled: true, metadataEnabled: true },
    statistics: { totalBytes: 0, totalEntries: 0, cover: { bytes: 0, entries: 0 }, lyrics: { bytes: 0, entries: 0 }, metadata: { bytes: 0, entries: 0 } } };
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET') writes.push({ method: request.method, url: request.url });
    response.writeHead(request.url === '/cache' && cacheUnavailable ? 503 : 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    const result = request.url === '/health' ? { ok: true }
      : request.url === '/cache' ? cacheSnapshot
      : request.url === '/playback/queue' ? [queueTrack] : [];
    response.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const data = fs.mkdtempSync(path.resolve(__dirname, '../.test-tmp/playlist-batch-native-'));
  const output = path.resolve(__dirname, '../.playwright-cli');
  fs.mkdirSync(output, { recursive: true });
  const originalImage = path.join(data, 'selected-cover.png');
  const originalBytes = fs.readFileSync(path.resolve(__dirname, '../resources/app-icon.png'));
  fs.writeFileSync(originalImage, originalBytes);
  const tokenFile = path.join(data, 'local-access.token');
  fs.writeFileSync(tokenFile, 'a'.repeat(64));
  fs.writeFileSync(path.join(data, 'about.json'), JSON.stringify({ autoCheckUpdates: false }));
  const env = { ...process.env, SHORTCUT_SMOKE_DATA: data, LOCALAPPDATA: data, APPDATA: data, HOME: data, USERPROFILE: data,
    PLAYLIST_SMOKE_BACKEND_PORT: String(server.address().port), LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: tokenFile };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  let vite;
  if (process.env.PLAYLIST_SMOKE_DEV === '1') {
    const { createServer } = await import('vite');
    vite = await createServer({ configFile: path.resolve(__dirname, '../vite.web.config.ts'), server: { port: 0, strictPort: false }, logLevel: 'error' });
    await vite.listen();
    env.ELECTRON_RENDERER_URL = vite.resolvedUrls.local[0];
  }
  let instance;
  try {
    instance = await _electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, 'helpers/shortcut-smoke-main.cjs')], env, timeout: 25000 });
    const page = await instance.firstWindow();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.locator('.first-run-onboarding').waitFor();
    await page.getByRole('button', { name: '跳过引导', exact: true }).click();
    await page.locator('.first-run-onboarding').waitFor({ state: 'hidden' });
    await page.evaluate(cover => {
      const song = (id, title, source = 'local') => ({ id: `${source}:${id}`, title, artist: 'Artist', album: 'Album', duration: 180,
        source, sourceLabel: source === 'local' ? '本地' : 'QQ 音乐', filePath: source === 'local' ? `G:/Fixture/${id}.mp3` : undefined,
        primary: '#446677', secondary: '#667788', mark: 'S' });
      localStorage.setItem('tiaolv-music-local-playlists', JSON.stringify([{ playlist: {
        id: 'user-native', title: 'Native local', source: 'local-user', userManaged: true, count: 3,
        subtitle: '', primary: '#446677', secondary: '#667788', mark: 'N'
      }, tracks: [song('1', 'One'), song('2', 'Two'), song('3', 'Keep')] }]));
      localStorage.setItem('tiaolv-music-aggregate-playlists', JSON.stringify([{ id: 'agg-native', identifier: 'agg1', name: 'Native aggregate',
        coverUrl: cover, createdAt: '2026-10-13', tracks: [song('1', 'Merged'), song('1q', 'Merged', 'qq'), song('2', 'Second'), song('3', 'Keep', 'qq')] }]));
      localStorage.setItem('tiaolv-music-playlist-cover-paths', JSON.stringify({ 'user-native': cover }));
      localStorage.setItem('tiaolv-music-startup-home', 'local');
    }, pathToFileURL(originalImage).href);
    await page.reload();
    await page.evaluate(() => { window.confirm = () => { throw new Error('Native confirm must not be used'); }; });
    await page.getByRole('button', { name: '歌单', exact: true }).click();
    await page.locator('.playlist-overview-card-shell').filter({ hasText: 'Native local' }).click();
    const local = page.locator('.playlist-detail-page');
    await local.locator('.playlist-track-card').nth(2).waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tiaolv-music-playlist-cover-paths'))['user-native'].startsWith('tiaolv-cover:'));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tiaolv-music-aggregate-playlists'))[0].coverUrl.startsWith('tiaolv-cover:'));
    await instance.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, originalImage);
    await local.getByRole('button', { name: '设置歌单封面', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tiaolv-music-playlist-cover-paths') || '{}')['user-native']?.startsWith('tiaolv-cover:'));
    const fixedCover = await page.evaluate(() => JSON.parse(localStorage.getItem('tiaolv-music-playlist-cover-paths'))['user-native']);
    const cachedFile = path.join(data, 'playlist-covers', new URL(fixedCover).pathname.slice(1));
    assert.deepEqual(fs.readFileSync(cachedFile), originalBytes, 'Selected desktop cover is an exact byte-for-byte copy');
    fs.renameSync(originalImage, path.join(data, 'moved-cover.png'));
    await page.evaluate(() => window.listenMusic.clearBackgroundCache());
    async function checkPickerCover() {
      await local.locator('.playlist-track-card').first().click({ button: 'right' });
      await page.getByRole('menuitem', { name: '添加到歌单', exact: true }).click();
      const picker = page.getByRole('dialog', { name: '加入歌单', exact: true });
      const image = picker.getByRole('button', { name: /^Native local/ }).locator('img');
      await image.evaluate(image => image.decode());
      assert.equal(await image.getAttribute('src'), fixedCover);
      assert.equal(await image.evaluate(image => image.naturalWidth), originalBytes.readUInt32BE(16));
      await page.screenshot({ path: path.join(output, `playlist-picker-cover-native${vite ? '-dev' : ''}.png`) });
      await picker.getByRole('button', { name: '关闭', exact: true }).click();
    }
    await checkPickerCover();
    await local.getByRole('button', { name: '批量操作', exact: true }).click();
    await local.locator('.playlist-track-card').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await local.getByLabel('选择 One', { exact: true }).isChecked(), true);
    await page.keyboard.press('Space');
    assert.equal(await local.getByLabel('选择 One', { exact: true }).isChecked(), false);
    await local.getByLabel('全选当前列表').check();
    await local.getByLabel('选择 Keep', { exact: true }).uncheck();
    await local.getByRole('button', { name: '移出歌单', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '移出歌单', exact: true });
    await page.waitForFunction(() => document.activeElement?.textContent === '取消');
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(() => document.activeElement?.textContent === '移出');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.textContent === '取消');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await local.locator('.playlist-track-card input:checked').count(), 2);
    await page.screenshot({ path: path.join(output, 'local-batch-native-selected.png') });
    await local.getByRole('button', { name: '移出歌单', exact: true }).click();
    await dialog.getByRole('button', { name: '移出', exact: true }).click();
    await local.getByRole('status').filter({ hasText: '已移出 2 首' }).waitFor();
    assert.equal(await local.locator('.playlist-track-card').count(), 1);
    await page.screenshot({ path: path.join(output, 'local-batch-native.png') });
    await page.reload();
    await page.getByRole('button', { name: '歌单', exact: true }).click();
    await page.locator('.playlist-overview-card-shell').filter({ hasText: 'Native local' }).click();
    await local.locator('.playlist-track-card').waitFor();
    assert.match(await local.locator('.playlist-track-card').innerText(), /Keep/);
    await checkPickerCover();
    await page.getByRole('button', { name: '聚合歌单', exact: true }).click();
    const aggregateImage = page.locator('.aggregate-playlist-card').filter({ hasText: 'Native aggregate' }).locator('img');
    await aggregateImage.evaluate(image => image.decode());
    assert.equal(await aggregateImage.getAttribute('src'), fixedCover, 'The existing aggregate cover survives moving its source and reload');
    await page.locator('.aggregate-playlist-card').filter({ hasText: 'Native aggregate' }).click();
    const aggregate = page.locator('.aggregate-detail');
    await aggregate.getByRole('button', { name: '批量操作', exact: true }).click();
    await aggregate.getByLabel('来源', { exact: true }).selectOption('local');
    await aggregate.getByLabel('全选当前列表').check();
    await aggregate.getByRole('button', { name: '移出歌单', exact: true }).click();
    await dialog.getByText(/全部音源/).waitFor();
    await dialog.getByRole('button', { name: '移出', exact: true }).click();
    await aggregate.getByRole('status').filter({ hasText: '已移出 2 首' }).waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('tiaolv-music-aggregate-playlists'))[0].tracks.map(track => track.id)), ['qq:3']);
    await aggregate.getByLabel('来源', { exact: true }).selectOption('全部');
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(940, 760));
    await page.screenshot({ path: path.join(output, 'aggregate-batch-native.png') });
    await page.reload();
    await page.getByRole('button', { name: '聚合歌单', exact: true }).click();
    await page.locator('.aggregate-playlist-card').filter({ hasText: 'Native aggregate' }).click();
    await aggregate.locator('.aggregate-track-row').waitFor();
    assert.equal(await aggregate.locator('.aggregate-track-row').count(), 1);

    const old = new Date(Date.now() - 48 * 3600000);
    fs.utimesSync(cachedFile, old, old);
    const coverName = letter => `${letter.repeat(64)}.png`;
    const coverUrl = letter => `tiaolv-cover://cache/${coverName(letter)}`;
    const coverFile = letter => path.join(data, 'playlist-covers', coverName(letter));
    for (const letter of ['b', 'c', 'd', 'e', 'f']) { fs.writeFileSync(coverFile(letter), originalBytes); fs.utimesSync(coverFile(letter), old, old); }
    fs.utimesSync(coverFile('d'), new Date(), new Date());
    fs.utimesSync(coverFile('e'), new Date(Date.now() + 3600000), new Date(Date.now() + 3600000));
    fs.linkSync(coverFile('f'), path.join(data, 'outside-hardlink.png'));
    const refs = { complete: true, urls: [fixedCover] };
    const directStats = await page.evaluate(refs => window.listenMusic.getPlaylistCoverStorageStatistics(refs), refs);
    assert.equal(directStats.entries, 6);
    assert.equal(directStats.reclaimableEntries, 2);
    assert.equal(directStats.bytes, originalBytes.length * 6);
    assert.equal(await page.evaluate(async () => {
      try { await window.listenMusic.prunePlaylistCoverStorage({ complete: false, urls: [] }); return false; } catch { return true; }
    }), true, 'Incomplete IPC payload cannot authorize deletion');

    cacheUnavailable = true;
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '缓存与数据', exact: true }).click();
    const originalSettings = page.getByRole('region', { name: '原始歌单封面', exact: true });
    async function waitForOriginalStorageReady() {
      await page.waitForFunction(() => {
        const panel = document.querySelector('.original-cover-storage');
        if (!panel) return false;
        for (let element = panel; element; element = element.parentElement) {
          if (Number(getComputedStyle(element).opacity) < 1) return false;
          if (element.getAnimations().some(animation => animation.playState === 'running'
            && animation.effect?.getKeyframes().some(frame => frame.opacity !== undefined))) return false;
        }
        return true;
      });
    }
    await originalSettings.getByText(`6 项 / ${(originalBytes.length * 6 / 1024).toFixed(1)} KB`, { exact: true }).waitFor();
    await page.getByText('缓存信息加载失败，请确认后端已启动。', { exact: true }).waitFor();
    await waitForOriginalStorageReady();
    await page.screenshot({ path: path.join(output, 'original-cover-storage-desktop.png') });
    const cleanupDialog = page.getByRole('dialog', { name: '清理未使用原始封面', exact: true });
    await originalSettings.getByRole('button', { name: '清理未使用原始封面', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.textContent === '取消');
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(() => document.activeElement?.textContent === '清理');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await cleanupDialog.waitFor({ state: 'hidden' });
    assert.equal(fs.existsSync(coverFile('b')), true, 'Cancel does not delete');
    await originalSettings.getByRole('button', { name: '清理未使用原始封面', exact: true }).click();
    await page.evaluate(uri => localStorage.setItem('native-invalid-storage', `broken ${uri}`), coverUrl('b'));
    await cleanupDialog.getByRole('button', { name: '清理', exact: true }).click();
    await cleanupDialog.getByRole('alert').filter({ hasText: '歌单存储损坏' }).waitFor();
    assert.equal(fs.existsSync(coverFile('b')), true, 'Corrupt unknown storage blocks cleanup at confirmation');
    await page.evaluate(uri => {
      localStorage.removeItem('native-invalid-storage');
      localStorage.setItem('native-late-reference', JSON.stringify({ coverUrl: uri.replace('tiaolv-cover:', 'TIAOLV-COVER:') }));
    }, coverUrl('c'));
    await instance.evaluate(({ ipcMain }) => {
      const channel = 'prune-playlist-cover-storage';
      const original = ipcMain._invokeHandlers.get(channel);
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, async (...args) => {
        await new Promise(resolve => { global.playlistCoverPruneRelease = resolve; });
        return original(...args);
      });
      global.restorePlaylistCoverPruneHandler = () => { ipcMain.removeHandler(channel); ipcMain.handle(channel, original); };
    });
    await cleanupDialog.getByRole('button', { name: '清理', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.original-cover-confirm-panel button:last-child')?.disabled === true);
    assert.equal(await cleanupDialog.evaluate(element => element.contains(document.activeElement)), true,
      `Busy cleanup must retain dialog focus: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 300))}`);
    for (const key of ['Tab', 'Shift+Tab', 'Escape']) {
      await page.keyboard.press(key);
      assert.equal(await cleanupDialog.isVisible(), true, `Busy ${key} cannot close the dialog`);
      assert.equal(await cleanupDialog.evaluate(element => element.contains(document.activeElement)), true, `Busy ${key} cannot move focus outside the dialog`);
    }
    await instance.evaluate(() => {
      global.restorePlaylistCoverPruneHandler();
      global.playlistCoverPruneRelease();
      delete global.restorePlaylistCoverPruneHandler;
      delete global.playlistCoverPruneRelease;
    });
    await cleanupDialog.waitFor({ state: 'hidden' });
    await originalSettings.getByRole('status').filter({ hasText: '已清理 1 项' }).waitFor();
    assert.equal(fs.existsSync(coverFile('b')), false);
    for (const file of [cachedFile, ...['c', 'd', 'e', 'f'].map(coverFile), path.join(data, 'outside-hardlink.png')]) assert.deepEqual(fs.readFileSync(file), originalBytes);
    await instance.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setMinimumSize(360, 640); win.setSize(420, 760); });
    await originalSettings.scrollIntoViewIfNeeded();
    await waitForOriginalStorageReady();
    assert.equal(await originalSettings.evaluate(element => [...element.querySelectorAll('button,dt,dd,strong')].every(child => {
      const rect = child.getBoundingClientRect(); return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth;
    })), true, 'Original storage row and actions fit the narrow viewport');
    await page.screenshot({ path: path.join(output, 'original-cover-storage-narrow.png') });
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(940, 760));

    const mainId = await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id);
    const opening = instance.waitForEvent('window');
    await instance.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.send('tray-media-action', 'mini-player'), mainId);
    const mini = await opening;
    mini.setDefaultTimeout(10000);
    await mini.locator('.mini-player').waitFor();
    assert.equal(await mini.evaluate(() => window.listenMusic.getPlaylistCoverStorageStatistics === undefined && window.listenMusic.prunePlaylistCoverStorage === undefined), true,
      'The real mini preload does not expose original cover storage commands');
    assert.equal(await instance.evaluate(async ({ BrowserWindow, ipcMain }, { mainId, refs }) => {
      const sender = BrowserWindow.getAllWindows().find(win => win.id !== mainId).webContents;
      let rejected = 0;
      for (const channel of ['playlist-cover-storage-statistics', 'prune-playlist-cover-storage']) {
        try { await ipcMain._invokeHandlers.get(channel)({ sender, senderFrame: sender.mainFrame }, refs); } catch (error) { if (error.message.includes('仅限主窗口')) rejected++; }
      }
      return rejected;
    }, { mainId, refs }), 2, 'Registered storage IPC handlers reject the real mini window sender');
    await mini.locator('.mini-player').hover();
    await mini.getByRole('button', { name: '播放列表', exact: true }).click();
    const queueRow = mini.locator('.mini-queue-track').filter({ hasText: 'Native queue song' });
    await queueRow.hover();
    await queueRow.getByRole('button', { name: '更多', exact: true }).click();
    await mini.getByRole('button', { name: '添加到歌单', exact: true }).click();
    await page.evaluate(() => {
      window.nativeOriginalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'tiaolv-music-local-playlists') throw new DOMException('Native quota fixture', 'QuotaExceededError');
        return window.nativeOriginalSetItem.call(this, key, value);
      };
    });
    await mini.getByRole('textbox', { name: '新歌单名称', exact: true }).fill('Native IPC playlist');
    await mini.getByRole('button', { name: '新建歌单', exact: true }).click();
    await mini.getByRole('status').filter({ hasText: '本地存储空间不足' }).waitFor();
    assert.equal(await mini.getByRole('textbox', { name: '新歌单名称', exact: true }).inputValue(), 'Native IPC playlist');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tiaolv-music-local-playlists')).filter(row => row.playlist.title === 'Native IPC playlist').length), 0);
    const failureAck = await mini.evaluate(async () => (await window.listenMusic.getMiniPlayerSnapshot()).playback.playlistMutationResult);
    assert.equal(failureAck.kind, 'create'); assert.match(failureAck.error, /本地存储空间不足/); assert.ok(failureAck.requestId);
    await mini.screenshot({ path: path.join(output, 'mini-native-ipc-save-error.png') });
    await page.evaluate(() => { Storage.prototype.setItem = window.nativeOriginalSetItem; delete window.nativeOriginalSetItem; });
    await mini.getByRole('button', { name: '新建歌单', exact: true }).click();
    await mini.locator('.mini-playlist-create').waitFor({ state: 'hidden' });
    const successAck = await mini.evaluate(async () => (await window.listenMusic.getMiniPlayerSnapshot()).playback.playlistMutationResult);
    assert.equal(successAck.kind, 'create'); assert.equal(successAck.error, undefined); assert.notEqual(successAck.requestId, failureAck.requestId);
    const created = await page.evaluate(() => JSON.parse(localStorage.getItem('tiaolv-music-local-playlists')).filter(row => row.playlist.title === 'Native IPC playlist'));
    assert.equal(created.length, 1); assert.equal(created[0].tracks[0].id, queueTrack.id);
    await mini.locator('.mini-player').hover();
    const miniClosed = mini.waitForEvent('close');
    await mini.getByRole('button', { name: '返回完整播放器', exact: true }).click();
    await miniClosed;
    await page.reload();
    await instance.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).setSize(1180, 820), mainId);
    const expandSidebar = page.getByRole('button', { name: '展开侧栏', exact: true });
    if (await expandSidebar.isVisible()) await expandSidebar.click();
    await page.getByRole('button', { name: '歌单', exact: true }).click();
    await page.locator('.playlist-overview-card-shell').filter({ hasText: 'Native local' }).click();
    await local.locator('.playlist-track-card').waitFor();
    await checkPickerCover();
    assert.deepEqual(fs.readFileSync(cachedFile), originalBytes, 'Retained cover bytes and decoded dimensions survive pruning and reload');
    assert.deepEqual(errors, []);
    assert.equal(writes.filter(write => write.method === 'DELETE').length, 0, 'No audio/library deletion');
    console.log(`Native Electron${vite ? ' development' : ''}: original cover stats, confirmed fail-closed cleanup, age/reference/hardlink protection, unauthorized mini IPC, real mini persistence acknowledgements and exact bytes/decode after reload passed with isolated data`);
  } catch (error) {
    if (instance) {
      const page = await instance.firstWindow();
      await page.screenshot({ path: path.join(output, 'playlist-batch-native-failure.png') }).catch(() => {});
      console.error(await page.locator('body').innerText().catch(() => 'No renderer text'));
    }
    throw error;
  } finally {
    if (instance) await instance.close();
    if (vite) await vite.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
