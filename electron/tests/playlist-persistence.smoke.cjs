const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const keys = {
  local: 'tiaolv-music-local-playlists', aggregate: 'tiaolv-music-aggregate-playlists',
  overview: 'tiaolv-music-playlist-overview-order', order: 'tiaolv-music-playlist-track-order',
  covers: 'tiaolv-music-playlist-cover-paths', favorites: 'tiaolv-music-favorites-playlist-metadata'
};
const song = id => ({ id: `local:${id}`, title: `Song ${id}`, artist: 'Artist', album: 'Album', duration: 180,
  source: 'local', filePath: `G:/Fixture/${id}.mp3`, primary: '#446677', secondary: '#667788', mark: 'S', liked: false, history: false });
const local = { id: 'local-user-fixture', title: 'Existing local', subtitle: '', count: 2, mark: 'E',
  primary: '#446677', secondary: '#667788', source: 'local-user', userManaged: true };
const aggregate = { id: 'aggregate-fixture', name: 'Existing aggregate', identifier: 'agg1', createdAt: '2026-10-13',
  tracks: [song(1), song(2)].map(track => ({ ...track, sourceLabel: 'Local' })) };
async function fixture(page, method, args = []) {
  return page.evaluate(({ method, args }) => document.querySelector('.app-shell').__vueParentComponent.setupState[method](...args), { method, args });
}
async function snapshot(page) {
  return page.evaluate(keys => {
    const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
    return JSON.parse(JSON.stringify({ stored: Object.fromEntries(Object.values(keys).map(key => [key, localStorage.getItem(key)])),
      playlists: state.userPlaylists, tracks: state.localPlaylistTrackMap, overview: state.playlistOverviewOrder,
      aggregate: state.aggregatePlaylists, order: state.playlistTrackOrder, covers: state.playlistCoverPaths,
      selected: state.selectedPlaylist, favorites: state.playlistOverviewSource.find(item => item.id === 'favorites') }));
  }, keys);
}
async function reject(page, key) { await page.evaluate(key => { window.rejectedSaveKey = key; }, key); }
async function drag(from, to) {
  await from.dispatchEvent('dragstart');
  await to.dispatchEvent('drop');
  await from.dispatchEvent('dragend');
}
async function assertMiniFormFits(mini, input) {
  const frame = await mini.boundingBox();
  const field = await input.boundingBox();
  const button = await mini.getByRole('button', { name: '新建歌单', exact: true }).boundingBox();
  const menu = await mini.locator('.mini-queue-more-menu').boundingBox();
  const inside = bounds => bounds.x >= frame.x && bounds.y >= frame.y
    && bounds.x + bounds.width <= frame.x + frame.width && bounds.y + bounds.height <= frame.y + frame.height;
  assert.ok(inside(field), 'Mini playlist input must fit inside its window');
  assert.ok(inside(button), 'Mini playlist retry button must fit inside its window');
  assert.ok(inside(menu), 'The entire mini playlist popup must fit inside its window');
  const status = await mini.getByRole('status').boundingBox();
  if (status) {
    assert.ok(inside(status), 'Mini error feedback must fit inside its window');
    for (const bounds of [field, button]) assert.ok(status.y >= bounds.y + bounds.height || status.y + status.height <= bounds.y, 'Mini error feedback must not overlap the retry controls');
  }
}
async function run() {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: path.resolve(__dirname, '../vite.web.config.ts'), server: { port: 0, strictPort: false }, logLevel: 'error' });
  let browser;
  const output = path.resolve(__dirname, '../.playwright-cli');
  fs.mkdirSync(output, { recursive: true });
  try {
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    const backendWrites = [];
    const queueWrites = [];
    let heldQueueResponse;
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\//, async route => {
      const url = new URL(route.request().url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
      if (!url.pathname.startsWith('/backend/')) return route.continue();
      if (route.request().method() !== 'GET') backendWrites.push(url.pathname);
      if (url.pathname === '/backend/playback/queue' && route.request().method() === 'PUT') {
        queueWrites.push(route.request().postDataJSON());
        const response = heldQueueResponse;
        heldQueueResponse = undefined;
        if (response) { response.onStarted(); await response.promise; }
        return route.fulfill({ status: response?.status || 200, json: response ? { message: 'Fixture backend offline' } : { ok: true } });
      }
      if (url.pathname === '/backend/health') return route.fulfill({ json: { ok: true } });
      if (url.pathname === '/backend/library/favorites') return route.fulfill({ json: [song('f')] });
      return route.fulfill({ json: [] });
    });
    await page.addInitScript(({ keys, local, aggregate, tracks }) => {
      if (!localStorage.getItem('persistence-fixture-seeded')) {
        localStorage.setItem(keys.local, JSON.stringify([{ playlist: local, tracks }]));
        localStorage.setItem(keys.aggregate, JSON.stringify([aggregate]));
        localStorage.setItem(keys.overview, JSON.stringify(['favorites', local.id]));
        localStorage.setItem('persistence-fixture-seeded', '1');
      }
      localStorage.setItem('tiaolv-music-onboarding-version', '1');
      localStorage.setItem('tiaolv-music-startup-home', 'local');
      const save = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === window.rejectedSaveKey) throw new DOMException('Fixture storage quota exhausted', 'QuotaExceededError');
        return save.call(this, key, value);
      };
    }, { keys, local, aggregate, tracks: [song(1), song(2)] });
    const ready = () => page.waitForFunction(() => document.querySelector('.app-shell')?.__vueParentComponent.setupState.localLibraryHydrated);
    await page.goto(server.resolvedUrls.local[0]);
    await ready();
    await page.evaluate(() => { const state = document.querySelector('.app-shell').__vueParentComponent.setupState; state.appMode = 'local'; state.showSongDetail = false; });
    await fixture(page, 'persistPlaybackQueue');
    queueWrites.length = 0;
    let releaseQueueWrite;
    let queueWriteStarted;
    const queueStarted = new Promise(resolve => { queueWriteStarted = resolve; });
    heldQueueResponse = { status: 503, promise: new Promise(resolve => { releaseQueueWrite = resolve; }), onStarted: queueWriteStarted };
    const queuedTrack = { ...song('queue'), duration: 180.6, source: '', audioUrl: 'http://fixture/audio',
      coverUrl: 'fixture-cover', lyrics: 'Fixture lyrics', lyricsPhonetic: 'Fixture phonetic',
      lyricsSource: 'embedded', lyricsFormat: 'lrc', metaSource: 'embedded' };
    const wireTrack = { id: queuedTrack.id, title: queuedTrack.title, artist: queuedTrack.artist, album: queuedTrack.album,
      duration: 181, source: 'local', filePath: queuedTrack.filePath, url: queuedTrack.audioUrl,
      coverUrl: queuedTrack.coverUrl, lyrics: queuedTrack.lyrics, lyricsPhonetic: queuedTrack.lyricsPhonetic,
      lyricsSource: queuedTrack.lyricsSource, lyricsFormat: queuedTrack.lyricsFormat, metaSource: queuedTrack.metaSource };
    await page.evaluate(track => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.playbackQueue = [{ ...track, queueKey: 'queue:first' }, { ...track, queueKey: 'queue:second' }];
      window.queueFixtureSaves = [state.persistPlaybackQueue()];
      state.playbackQueue[0].title = 'Second snapshot';
      state.playbackQueue.reverse();
      window.queueFixtureSaves.push(state.persistPlaybackQueue());
      state.playbackQueue[0].title = 'Changed after enqueue';
    }, queuedTrack);
    await queueStarted;
    assert.deepEqual(queueWrites, [[{ ...wireTrack, queueKey: 'queue:first' }, { ...wireTrack, queueKey: 'queue:second' }]], 'A stalled write must preserve the first snapshot and hold later writes');
    releaseQueueWrite();
    assert.deepEqual(await page.evaluate(() => Promise.all(window.queueFixtureSaves)), [undefined, undefined]);
    assert.deepEqual(queueWrites[1], [{ ...wireTrack, queueKey: 'queue:second' }, { ...wireTrack, title: 'Second snapshot', queueKey: 'queue:first' }]);
    assert.equal(await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.scanError), '播放队列暂时无法保存，请确认后端已启动。');
    assert.deepEqual(await page.evaluate(() => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      return state.playbackQueue.map(track => ({ queueKey: track.queueKey, title: track.title }));
    }), [{ queueKey: 'queue:second', title: 'Changed after enqueue' }, { queueKey: 'queue:first', title: 'Second snapshot' }]);
    await page.evaluate(async () => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.playbackQueue = [];
      await state.persistPlaybackQueue();
      state.scanError = '';
      delete window.queueFixtureSaves;
    });
    assert.deepEqual(queueWrites[2], [], 'A later queue save must still work after the failed request');
    await fixture(page, 'selectView', ['playlists']);
    const create = page.getByRole('dialog', { name: '创建歌单', exact: true });
    for (const failedKey of [keys.local, keys.overview]) {
      await page.getByRole('button', { name: /创建歌单/ }).click();
      await create.getByRole('textbox').fill('Retry local');
      const before = await snapshot(page);
      await reject(page, failedKey);
      await create.getByRole('textbox').press('Enter');
      await create.getByText(/quota exhausted/).waitFor();
      assert.equal(await create.getByRole('textbox').inputValue(), 'Retry local');
      assert.deepEqual(await snapshot(page), before, 'Rejected local create must preserve storage and visible state');
      await create.getByRole('button', { name: '取消', exact: true }).click();
    }
    await reject(page, '');
    await page.getByRole('button', { name: /创建歌单/ }).click();
    await create.getByRole('textbox').fill('Retry local');
    await create.getByRole('textbox').press('Enter');
    await create.waitFor({ state: 'hidden' });
    assert.equal((await snapshot(page)).playlists.length, 2);
    const overviewCards = page.locator('.playlist-overview-card-shell');
    const beforeOverview = await snapshot(page);
    await reject(page, keys.overview);
    await drag(overviewCards.first(), overviewCards.nth(1));
    await page.getByRole('status').filter({ hasText: /quota exhausted/ }).waitFor();
    assert.deepEqual(await snapshot(page), beforeOverview, 'Rejected overview reorder keeps the previous order');
    await fixture(page, 'selectPlaylist', [local]);
    const detail = page.locator('.playlist-detail-page');
    const rename = page.getByRole('dialog', { name: '重命名歌单', exact: true });
    await detail.getByRole('button', { name: '重命名歌单', exact: true }).click();
    await rename.getByRole('textbox').fill('Renamed local');
    const beforeRename = await snapshot(page);
    await reject(page, keys.local);
    await rename.getByRole('textbox').press('Enter');
    await rename.getByText(/quota exhausted/).waitFor();
    assert.deepEqual(await snapshot(page), beforeRename);
    assert.equal(await rename.getByRole('textbox').inputValue(), 'Renamed local');
    await reject(page, '');
    await rename.getByRole('textbox').press('Enter');
    await rename.waitFor({ state: 'hidden' });
    const beforeCopy = await snapshot(page);
    await reject(page, keys.overview);
    await detail.getByRole('button', { name: '复制歌单', exact: true }).click();
    await page.getByRole('status').filter({ hasText: /quota exhausted/ }).waitFor();
    assert.deepEqual(await snapshot(page), beforeCopy, 'Rejected copy must not publish or navigate');
    for (const failedKey of [keys.local, keys.covers]) {
      const beforeCover = await snapshot(page);
      await reject(page, failedKey);
      const chooser = page.waitForEvent('filechooser');
      await detail.getByRole('button', { name: '设置歌单封面', exact: true }).click();
      await (await chooser).setFiles(path.resolve(__dirname, '../resources/app-icon.png'));
      await page.getByRole('status').filter({ hasText: /quota exhausted/ }).waitFor();
      assert.deepEqual(await snapshot(page), beforeCover, 'Rejected cover keeps both playlist and cover map snapshots');
    }
    const beforeOrder = await snapshot(page);
    await reject(page, keys.order);
    await drag(detail.locator('.playlist-track-card').first(), detail.locator('.playlist-track-card').nth(1));
    await page.getByRole('status').filter({ hasText: /quota exhausted/ }).waitFor();
    assert.deepEqual(await snapshot(page), beforeOrder);
    assert.deepEqual(await detail.locator('.playlist-track-main strong').allTextContents(), ['Song 1', 'Song 2']);
    await fixture(page, 'openTrackPlaylistPicker', [song(3), 'regular']);
    const picker = page.getByRole('dialog', { name: '加入歌单', exact: true });
    const beforeAdd = await snapshot(page);
    await reject(page, keys.local);
    await picker.getByRole('button').filter({ hasText: 'Renamed local' }).click();
    await picker.getByText(/quota exhausted/).waitFor();
    assert.deepEqual(await snapshot(page), beforeAdd);
    await reject(page, '');
    await picker.getByRole('button').filter({ hasText: 'Renamed local' }).click();
    await picker.waitFor({ state: 'hidden' });
    assert.equal((await snapshot(page)).tracks[local.id].length, 3);
    const favorites = (await snapshot(page)).favorites;
    await fixture(page, 'selectPlaylist', [favorites]);
    await detail.getByRole('button', { name: '重命名歌单', exact: true }).click();
    await rename.getByRole('textbox').fill('Favorite name');
    await rename.getByRole('textbox').press('Enter');
    await rename.waitFor({ state: 'hidden' });
    await page.reload();
    await ready();
    const restored = (await snapshot(page)).favorites;
    assert.equal(restored.id, 'favorites');
    assert.equal(restored.title, 'Favorite name');
    await fixture(page, 'selectPlaylist', [restored]);
    await detail.getByRole('button', { name: '重命名歌单', exact: true }).click();
    await rename.getByRole('textbox').fill('Rejected favorite');
    const beforeFavorite = await snapshot(page);
    await reject(page, keys.favorites);
    await rename.getByRole('textbox').press('Enter');
    await rename.getByText(/quota exhausted/).waitFor();
    assert.equal(await rename.getByRole('textbox').inputValue(), 'Rejected favorite');
    assert.deepEqual(await snapshot(page), beforeFavorite);
    await rename.getByRole('button', { name: '取消', exact: true }).click();
    assert.deepEqual(backendWrites.filter(endpoint => endpoint.startsWith('/backend/library/favorites')), [], 'Local metadata must never move favorite songs through backend writes');
    await fixture(page, 'selectView', ['aggregate']);
    await page.getByRole('button', { name: /新建聚合歌单/ }).first().click();
    const aggregateDialog = page.getByRole('dialog', { name: '新建聚合歌单', exact: true });
    await aggregateDialog.getByRole('textbox').fill('Retry aggregate');
    const beforeAggregate = await snapshot(page);
    await reject(page, keys.aggregate);
    await aggregateDialog.getByRole('textbox').press('Enter');
    await aggregateDialog.getByText(/quota exhausted/).waitFor();
    assert.equal(await aggregateDialog.getByRole('textbox').inputValue(), 'Retry aggregate');
    assert.deepEqual(await snapshot(page), beforeAggregate);
    await reject(page, '');
    await aggregateDialog.getByRole('textbox').press('Enter');
    await aggregateDialog.waitFor({ state: 'hidden' });
    assert.equal((await snapshot(page)).aggregate.length, 2);
    await page.locator('.aggregate-playlist-card').filter({ hasText: 'Existing aggregate' }).click();
    const beforeAggregateOrder = await snapshot(page);
    await reject(page, keys.aggregate);
    await drag(page.locator('.aggregate-track-row').first(), page.locator('.aggregate-track-row').nth(1));
    await page.getByRole('status').filter({ hasText: /quota exhausted/ }).waitFor();
    assert.deepEqual(await snapshot(page), beforeAggregateOrder);
    await fixture(page, 'openTrackPlaylistPicker', [song(4), 'aggregate']);
    const aggregatePicker = page.getByRole('dialog', { name: '加入聚合歌单', exact: true });
    const beforeAggregateAdd = await snapshot(page);
    await aggregatePicker.getByRole('button').filter({ hasText: 'Existing aggregate' }).click();
    await aggregatePicker.getByText(/quota exhausted/).waitFor();
    assert.deepEqual(await snapshot(page), beforeAggregateAdd);
    await reject(page, '');
    await aggregatePicker.getByRole('button').filter({ hasText: 'Existing aggregate' }).click();
    await aggregatePicker.waitFor({ state: 'hidden' });
    assert.equal((await snapshot(page)).aggregate[0].tracks.length, 3);
    await page.evaluate(track => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.playbackQueue = [{ ...track, queueKey: 'mini-fixture' }];
      state.miniPlayerVisible = true;
      state.miniQueueVisible = true;
      state.miniQueueShellOpen = true;
    }, song('mini'));
    const mini = page.getByRole('complementary', { name: '迷你播放器', exact: true });
    await mini.locator('.mini-queue-track').hover();
    await mini.getByRole('button', { name: '更多', exact: true }).click();
    const ordinaryMenuBounds = await mini.locator('.mini-queue-more-menu').boundingBox();
    const miniTrackBounds = await mini.locator('.mini-queue-track').boundingBox();
    assert.equal(Math.round(ordinaryMenuBounds.y - miniTrackBounds.y), 40, 'The ordinary more menu must keep its existing row anchor');
    await mini.getByRole('button', { name: '添加到歌单', exact: true }).click();
    const miniInput = mini.getByRole('textbox', { name: '新歌单名称', exact: true });
    await miniInput.fill('Mini retry');
    const beforeMini = await snapshot(page);
    await reject(page, keys.overview);
    await miniInput.press('Enter');
    await mini.getByRole('status').filter({ hasText: /quota exhausted/ }).waitFor();
    await assertMiniFormFits(mini, miniInput);
    await page.screenshot({ path: path.join(output, 'playlist-persistence-mini-failure.png') });
    assert.equal(await miniInput.inputValue(), 'Mini retry');
    assert.deepEqual(await snapshot(page), beforeMini);
    await reject(page, '');
    await miniInput.press('Enter');
    await mini.getByRole('status').filter({ hasText: /已新建/ }).waitFor();
    const miniCreated = (await snapshot(page)).playlists.find(item => item.title === 'Mini retry');
    assert.equal((await snapshot(page)).tracks[miniCreated.id][0].id, 'local:mini');
    await mini.locator('.mini-queue-track').hover();
    await mini.getByRole('button', { name: '更多', exact: true }).click();
    await mini.getByRole('button', { name: '添加到歌单', exact: true }).click();
    const beforeMiniAdd = await snapshot(page);
    await reject(page, keys.local);
    await mini.locator('.mini-playlist-targets button').filter({ hasText: 'Renamed local' }).click();
    await mini.getByRole('status').filter({ hasText: /quota exhausted/ }).waitFor();
    assert.equal(await mini.locator('.mini-playlist-targets').isVisible(), true);
    assert.deepEqual(await snapshot(page), beforeMiniAdd);
    await reject(page, '');
    await mini.locator('.mini-playlist-targets button').filter({ hasText: 'Renamed local' }).click();
    await mini.getByRole('status').filter({ hasText: /已加入歌单/ }).waitFor();
    assert.equal((await snapshot(page)).tracks[local.id][0].id, 'local:mini');
    await page.evaluate(track => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.playbackQueue = [{ ...track, queueKey: 'native-fixture' }];
      window.listenMusic = { updateMiniPlayerSnapshot: value => { window.fixtureMiniSnapshot = value; } };
      state.syncMiniPlayerSnapshot();
    }, song('native'));
    const initialNativeSnapshot = await page.evaluate(() => ({ playback: window.fixtureMiniSnapshot, window: { locked: false, alwaysOnTop: false, queueExpanded: false } }));
    const nativePage = await browser.newPage({ viewport: { width: 512, height: 168 } });
    nativePage.setDefaultTimeout(8000);
    nativePage.on('pageerror', error => errors.push(error.message));
    await nativePage.route(/^https?:\/\//, route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    let heldSnapshot;
    let holdNativeResult = true;
    async function waitForHeldResult(requestId) {
      const deadline = Date.now() + 8000;
      while (heldSnapshot?.playback?.playlistMutationResult?.requestId !== requestId) {
        if (Date.now() >= deadline) throw new Error(`Native result was not delivered for ${requestId}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    await page.exposeFunction('forwardMiniSnapshot', async playback => {
      const value = { playback, window: initialNativeSnapshot.window };
      if (holdNativeResult) heldSnapshot = value;
      else await nativePage.evaluate(value => window.receiveMiniSnapshot(value), value);
    });
    await page.evaluate(() => { window.listenMusic.updateMiniPlayerSnapshot = value => { window.fixtureLatestMiniSnapshot = value; return window.forwardMiniSnapshot(value); }; });
    await nativePage.exposeFunction('forwardNativeAction', action => page.evaluate(action => document.querySelector('.app-shell').__vueParentComponent.setupState.handleMiniPlayerAction(action), action));
    await nativePage.exposeFunction('resizeNativeFixture', async open => { await nativePage.setViewportSize({ width: 512, height: open ? 376 : 168 }); return true; });
    await nativePage.addInitScript(initial => {
      window.nativeActions = [];
      window.listenMusic = {
        getMiniPlayerSnapshot: async () => initial,
        onMiniPlayerSnapshot: callback => { window.receiveMiniSnapshot = callback; return () => {}; },
        onMiniPlayerTime: () => () => {}, miniWindowCommand: async () => true,
        setMiniQueueExpanded: open => window.resizeNativeFixture(open),
        sendMiniPlayerAction: action => { window.nativeActions.push(action); void window.forwardNativeAction(action); }
      };
    }, initialNativeSnapshot);
    await nativePage.goto(`${server.resolvedUrls.local[0]}?window=mini-player`);
    const nativeMini = nativePage.getByRole('complementary', { name: '迷你播放器', exact: true });
    await nativeMini.getByRole('button', { name: '播放列表', exact: true }).press('Enter');
    await nativeMini.locator('.mini-queue-track').hover();
    await nativeMini.getByRole('button', { name: '更多', exact: true }).click();
    await nativeMini.getByRole('button', { name: '添加到歌单', exact: true }).click();
    const nativeInput = nativeMini.getByRole('textbox', { name: '新歌单名称', exact: true });
    await nativeInput.fill('Native retry');
    await reject(page, keys.overview);
    const beforeNativeCreate = await snapshot(page);
    await nativeInput.press('Enter');
    await nativePage.waitForFunction(() => window.nativeActions.length === 1);
    assert.equal(await nativeInput.inputValue(), 'Native retry', 'A sent request must retain the name until confirmation');
    assert.equal(await nativeMini.getByText(/已新建/).count(), 0);
    const firstNativeRequestId = await nativePage.evaluate(() => window.nativeActions[0].requestId);
    await waitForHeldResult(firstNativeRequestId);
    const rejectedCreateResult = heldSnapshot;
    const wrongResult = structuredClone(heldSnapshot);
    wrongResult.playback.playlistMutationResult.requestId = 'outdated-request';
    await nativePage.evaluate(value => window.receiveMiniSnapshot(value), wrongResult);
    assert.equal(await nativeInput.inputValue(), 'Native retry');
    assert.equal(await nativeMini.getByRole('button', { name: '新建歌单', exact: true }).isDisabled(), true);
    const wrongKind = structuredClone(heldSnapshot);
    wrongKind.playback.playlistMutationResult.kind = 'add';
    await nativePage.evaluate(value => window.receiveMiniSnapshot(value), wrongKind);
    assert.equal(await nativeMini.getByRole('button', { name: '新建歌单', exact: true }).isDisabled(), true);
    await nativePage.evaluate(value => window.receiveMiniSnapshot(value), rejectedCreateResult);
    await nativeMini.getByRole('status').filter({ hasText: /quota exhausted/ }).waitFor();
    await assertMiniFormFits(nativeMini, nativeInput);
    await nativePage.screenshot({ path: path.join(output, 'playlist-persistence-native-failure.png') });
    await nativePage.setViewportSize({ width: 340, height: 376 });
    await assertMiniFormFits(nativeMini, nativeInput);
    await nativePage.screenshot({ path: path.join(output, 'playlist-persistence-native-narrow-failure.png') });
    await nativePage.setViewportSize({ width: 512, height: 376 });
    assert.equal(await nativeInput.inputValue(), 'Native retry');
    assert.deepEqual(await snapshot(page), beforeNativeCreate);
    holdNativeResult = false;
    await reject(page, '');
    await nativeInput.press('Enter');
    await nativeMini.getByRole('status').filter({ hasText: /已新建/ }).waitFor();
    const afterNativeCreate = await snapshot(page);
    assert.equal(afterNativeCreate.tracks[afterNativeCreate.playlists.find(item => item.title === 'Native retry').id][0].id, 'local:native');
    await nativePage.evaluate(value => window.receiveMiniSnapshot(value), rejectedCreateResult);
    assert.equal(await nativeMini.getByText(/quota exhausted/).count(), 0, 'A duplicate old failure must not replace the confirmed success');
    await nativeMini.locator('.mini-queue-track').hover();
    await nativeMini.getByRole('button', { name: '更多', exact: true }).click();
    await nativeMini.getByRole('button', { name: '添加到歌单', exact: true }).click();
    const beforeNativeAdd = await snapshot(page);
    await reject(page, keys.local);
    await nativeMini.locator('.mini-playlist-targets button').filter({ hasText: 'Renamed local' }).click();
    await nativeMini.getByRole('status').filter({ hasText: /quota exhausted/ }).waitFor();
    assert.equal(await nativeMini.locator('.mini-playlist-targets').isVisible(), true);
    assert.deepEqual(await snapshot(page), beforeNativeAdd);
    await reject(page, '');
    await nativeMini.locator('.mini-playlist-targets button').filter({ hasText: 'Renamed local' }).click();
    await nativeMini.getByRole('status').filter({ hasText: /已加入歌单/ }).waitFor();
    assert.equal((await snapshot(page)).tracks[local.id][0].id, 'local:native');
    await nativePage.screenshot({ path: path.join(output, 'playlist-persistence-native-success.png') });
    await nativeMini.locator('.mini-queue-track').hover();
    await nativeMini.getByRole('button', { name: '更多', exact: true }).click();
    await nativeMini.getByRole('button', { name: '添加到歌单', exact: true }).click();
    await nativeInput.fill('Stale queue name');
    await page.evaluate(() => { document.querySelector('.app-shell').__vueParentComponent.setupState.playbackQueue = []; });
    await nativeInput.press('Enter');
    await nativeMini.getByRole('status').filter({ hasText: /歌曲已不在播放列表/ }).waitFor();
    assert.match(await page.evaluate(() => window.fixtureLatestMiniSnapshot.playlistMutationResult.error), /歌曲已不在播放列表/);
    await page.evaluate(track => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.playbackQueue = [{ ...track, queueKey: 'native-restored' }];
      state.syncMiniPlayerSnapshot();
    }, song('native'));
    await nativeMini.locator('.mini-queue-track').hover();
    await nativeMini.getByRole('button', { name: '更多', exact: true }).click();
    await nativeMini.getByRole('button', { name: '添加到歌单', exact: true }).click();
    await nativeInput.fill('Unconfirmed name');
    holdNativeResult = true;
    heldSnapshot = null;
    await nativePage.clock.install();
    const previousRequests = await nativePage.evaluate(() => window.nativeActions.length);
    await nativeInput.press('Enter');
    await nativePage.waitForFunction(count => window.nativeActions.length === count + 1, previousRequests);
    await waitForHeldResult(await nativePage.evaluate(() => window.nativeActions.at(-1).requestId));
    await nativePage.clock.fastForward(15_001);
    await nativeMini.getByRole('status').filter({ hasText: /尚未收到保存结果/ }).waitFor();
    assert.equal(await nativeInput.inputValue(), 'Unconfirmed name');
    assert.equal(await nativeMini.getByRole('button', { name: '新建歌单', exact: true }).isEnabled(), true);
    await nativePage.evaluate(value => window.receiveMiniSnapshot(value), heldSnapshot);
    assert.equal(await nativeInput.inputValue(), 'Unconfirmed name', 'A result arriving after timeout must not clear retry input');
    await nativePage.close();
    assert.deepEqual(errors, []);
    console.log('Playlist persistence offline browser acceptance passed: queue snapshot FIFO, duplicate identity, failed write recovery; local/aggregate create/add/reorder, multi-key copy/cover rollback, favorite rename reload; embedded/native mini create/add retry, correlation, stale queue, timeout/late results, contained desktop/narrow popup controls');
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
