const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const localKey = 'tiaolv-music-local-playlists';
const aggregateKey = 'tiaolv-music-aggregate-playlists';
const song = (id, title = `Song ${id}`, source = 'local') => ({ id: `${source}:${id}`, title, artist: 'Artist', album: 'Album',
  duration: 180, source, filePath: source === 'local' ? `G:/Fixture/${id}.mp3` : undefined, primary: '#446677', secondary: '#667788', mark: 'S' });
const custom = { id: 'user-fixture', title: 'Bulk local', subtitle: '', count: 20, mark: 'B', primary: '#446677', secondary: '#667788', source: 'local-user', userManaged: true };
const localTracks = Array.from({ length: 20 }, (_, i) => song(String(i + 1)));
const aggregate = { id: 'agg-fixture', identifier: 'agg1', name: 'Bulk aggregate', createdAt: '2026-10-13', tracks: [
  { ...song('g1', 'Merged', 'local'), sourceLabel: '本地' },
  { ...song('g1q', 'Merged', 'qq'), sourceLabel: 'QQ 音乐' },
  { ...song('g2', 'Second', 'local'), sourceLabel: '本地' },
  { ...song('g3', 'Keep', 'qq'), sourceLabel: 'QQ 音乐' }
] };
async function stateCall(page, method, args = []) {
  return page.evaluate(({ method, args }) => document.querySelector('.app-shell').__vueParentComponent.setupState[method](...args), { method, args });
}
async function run() {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: path.resolve(__dirname, '../vite.web.config.ts'), server: { port: 0, strictPort: false }, logLevel: 'error' });
  try { await server.listen(); } catch (error) { await server.close(); throw error; }
  let browser;
  const output = path.resolve(__dirname, '../.playwright-cli');
  fs.mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let favorites = [1, 2, 3].map(id => song(`f${id}`, `Favorite ${id}`));
    let rejectFavorite = true;
    const writes = [];
    await page.route(/^https?:\/\//, route => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
      if (!url.pathname.startsWith('/backend/')) return route.continue();
      const endpoint = decodeURIComponent(url.pathname.replace('/backend', ''));
      if (route.request().method() !== 'GET') writes.push({ endpoint, method: route.request().method() });
      if (endpoint === '/library/favorites') return route.fulfill({ json: favorites });
      if (endpoint.startsWith('/library/favorites/')) {
        const id = endpoint.split('/').at(-1);
        if (rejectFavorite && id === 'local:f1') return route.fulfill({ status: 503, json: { message: 'Favorite removal unavailable' } });
        favorites = favorites.filter(track => track.id !== id);
        return route.fulfill({ json: { ok: true } });
      }
      if (endpoint === '/health') return route.fulfill({ json: { ok: true } });
      return route.fulfill({ json: [] });
    });
    await page.addInitScript(({ localKey, aggregateKey, custom, localTracks, aggregate }) => {
      if (!localStorage.getItem('batch-fixture-seeded')) {
        localStorage.setItem(localKey, JSON.stringify([{ playlist: custom, tracks: localTracks }]));
        localStorage.setItem(aggregateKey, JSON.stringify([aggregate]));
        localStorage.setItem('batch-fixture-seeded', 'yes');
      }
      localStorage.setItem('tiaolv-music-onboarding-version', '1');
      localStorage.setItem('tiaolv-music-startup-home', 'local');
      const save = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === window.rejectedSaveKey) throw new Error('Storage save rejected');
        return save.call(this, key, value);
      };
      window.confirm = () => { throw new Error('Native confirm must not be used'); };
    }, { localKey, aggregateKey, custom, localTracks, aggregate });
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => document.querySelector('.app-shell')?.__vueParentComponent.setupState.localLibraryHydrated);
    await page.evaluate(() => { const state = document.querySelector('.app-shell').__vueParentComponent.setupState; state.appMode = 'local'; state.showSongDetail = false; });
    await stateCall(page, 'selectPlaylist', [custom]);
    const localPage = page.locator('.playlist-detail-page');
    await localPage.locator('.playlist-track-card').nth(19).waitFor();
    await localPage.getByRole('button', { name: '批量操作', exact: true }).click();
    const search = localPage.getByPlaceholder('搜索歌曲、歌手、专辑或文件夹');
    await search.fill('Song 1');
    await page.waitForFunction(() => document.querySelectorAll('.playlist-track-card').length === 11);
    await localPage.getByLabel('全选当前列表').check();
    await localPage.getByText('已选 11 首', { exact: true }).waitFor();
    const confirm = page.getByRole('dialog', { name: '移出歌单', exact: true });
    await localPage.getByRole('button', { name: '移出歌单', exact: true }).click();
    await confirm.getByRole('button', { name: '取消', exact: true }).click();
    assert.equal(await localPage.locator('.playlist-track-card input:checked').count(), 11);
    assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), localKey))[0].tracks.length, 20);
    await page.evaluate(key => { window.rejectedSaveKey = key; }, localKey);
    await localPage.getByRole('button', { name: '移出歌单', exact: true }).click();
    await confirm.getByRole('button', { name: '移出', exact: true }).click();
    await localPage.getByRole('status').filter({ hasText: 'Storage save rejected' }).waitFor();
    assert.equal(await localPage.locator('.playlist-track-card input:checked').count(), 11);
    await page.evaluate(() => { window.rejectedSaveKey = ''; });
    await localPage.getByRole('button', { name: '移出歌单', exact: true }).click();
    await confirm.getByRole('button', { name: '移出', exact: true }).click();
    await localPage.getByRole('status').filter({ hasText: '已移出 11 首' }).waitFor();
    const saved = JSON.parse(await page.evaluate(key => localStorage.getItem(key), localKey))[0].tracks;
    assert.equal(saved.length, 9);
    assert.ok(saved.every(track => !track.title.includes('Song 1')));
    await search.fill('');
    await page.screenshot({ path: path.join(output, 'local-playlist-batch-removal.png') });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.app-shell')?.__vueParentComponent.setupState.localLibraryHydrated);
    await stateCall(page, 'selectPlaylist', [custom]);
    await localPage.locator('.playlist-track-card').nth(8).waitFor();
    assert.equal(await localPage.locator('.playlist-track-card').count(), 9);
    const favoritePlaylist = await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.playlistOverviewSource.find(item => item.id === 'favorites'));
    await stateCall(page, 'selectPlaylist', [favoritePlaylist]);
    await localPage.locator('.playlist-track-card').nth(2).waitFor();
    await localPage.getByRole('button', { name: '批量操作', exact: true }).click();
    await localPage.getByLabel('全选当前列表').check();
    await localPage.getByRole('button', { name: '移出歌单', exact: true }).click();
    await confirm.getByRole('button', { name: '移出', exact: true }).click();
    await localPage.getByRole('status').filter({ hasText: 'Favorite removal unavailable' }).waitFor();
    assert.equal(await localPage.locator('.playlist-track-card').count(), 1);
    assert.equal(await localPage.locator('.playlist-track-card input:checked').count(), 1);
    rejectFavorite = false;
    await localPage.getByRole('button', { name: '移出歌单', exact: true }).click();
    await confirm.getByRole('button', { name: '移出', exact: true }).click();
    await localPage.getByRole('status').filter({ hasText: '已移出 1 首' }).waitFor();
    assert.equal(favorites.length, 0);
    assert.equal(writes.filter(write => write.method === 'DELETE' && !write.endpoint.startsWith('/library/favorites/')).length, 0, JSON.stringify(writes));
    assert.equal(writes.filter(write => write.method === 'DELETE' && write.endpoint.startsWith('/library/favorites/')).length, 4);

    await stateCall(page, 'selectView', ['aggregate']);
    await page.locator('.aggregate-playlist-card').filter({ hasText: 'Bulk aggregate' }).click();
    const aggregatePage = page.locator('.aggregate-detail');
    await aggregatePage.getByRole('button', { name: '批量操作', exact: true }).click();
    await aggregatePage.getByLabel('来源', { exact: true }).selectOption('local');
    await aggregatePage.getByLabel('全选当前列表').check();
    await aggregatePage.getByText('已选 2 首', { exact: true }).waitFor();
    await aggregatePage.getByRole('button', { name: '移出歌单', exact: true }).click();
    await confirm.getByText(/全部音源/).waitFor();
    await confirm.getByRole('button', { name: '取消', exact: true }).click();
    await page.evaluate(key => { window.rejectedSaveKey = key; }, aggregateKey);
    await aggregatePage.getByRole('button', { name: '移出歌单', exact: true }).click();
    await confirm.getByRole('button', { name: '移出', exact: true }).click();
    await aggregatePage.getByRole('status').filter({ hasText: 'Storage save rejected' }).waitFor();
    assert.equal(await aggregatePage.locator('.aggregate-track-row input:checked').count(), 2);
    assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), aggregateKey))[0].tracks.length, 4);
    await page.evaluate(() => { window.rejectedSaveKey = ''; });
    await aggregatePage.getByRole('button', { name: '移出歌单', exact: true }).click();
    await confirm.getByRole('button', { name: '移出', exact: true }).click();
    await aggregatePage.getByRole('status').filter({ hasText: '已移出 2 首' }).waitFor();
    const remaining = JSON.parse(await page.evaluate(key => localStorage.getItem(key), aggregateKey))[0].tracks;
    assert.deepEqual(remaining.map(track => track.id), ['qq:g3'], 'The merged QQ source is removed, but the hidden unselected song survives');
    await aggregatePage.getByLabel('来源', { exact: true }).selectOption('全部');
    await page.setViewportSize({ width: 920, height: 720 });
    await page.screenshot({ path: path.join(output, 'aggregate-playlist-batch-removal.png') });
    const bounds = await aggregatePage.locator('.playlist-batch-controls').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 920);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.app-shell')?.__vueParentComponent.setupState.localLibraryHydrated);
    await stateCall(page, 'selectView', ['aggregate']);
    await page.locator('.aggregate-playlist-card').filter({ hasText: 'Bulk aggregate' }).click();
    await aggregatePage.locator('.aggregate-track-row').waitFor();
    assert.equal(await aggregatePage.locator('.aggregate-track-row').count(), 1);
    assert.deepEqual(errors, []);
    console.log('Local custom/favorites and aggregate batch: filtered select-all, cancel, confirmed removal, persistence, storage refusal, partial failure and retry passed; no audio files deleted');
  } finally { if (browser) await browser.close(); await server.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
