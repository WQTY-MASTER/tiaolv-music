const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const account = (provider, userId) => ({ provider, userId, nickname: `Fixture ${userId}` });
const songs = (provider, count) => Array.from({ length: count }, (_, index) => ({
  id: `${provider}:${index + 1}`, title: `Fixture song ${index + 1}`, artist: 'Fixture', album: 'Batch',
  duration: 180, source: provider, coverUrl: 'http://127.0.0.1/fixture-cover.png'
}));
const playlist = (provider, id, count = 205) => ({ id: `${provider}:${id}`, title: 'Same title', subtitle: 'Fixture',
  source: provider, count, createdByAccount: true, deletable: true, favorite: false,
  accountScoped: true, streamingTemplate: true, imageUrl: 'http://127.0.0.1/fixture-cover.png', primary: '#556677', secondary: '#8899aa', mark: 'F' });
async function stateCall(page, method, args = []) {
  return page.evaluate(({ method, args }) => document.querySelector('.app-shell').__vueParentComponent.setupState[method](...args), { method, args });
}

async function run() {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: path.resolve(__dirname, '../vite.web.config.ts'), server: { port: 0, strictPort: false }, logLevel: 'error' });
  let browser;
  const output = path.resolve(__dirname, '../.playwright-cli');
  fs.mkdirSync(output, { recursive: true });
  await server.listen();
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(12000);
    const errors = [], writes = [], owners = { qq: '100', netease: '100' }, stored = new Map();
    const fixtureLikes = { netease: [], qq: [] };
    let rejectAddition = false, rejectRemoval = '', hold = null, release = null;
    function reset(provider, owner = owners[provider], count = 205) {
      stored.set(`${provider}:${owner}:900`, songs(provider, count));
      stored.set(`${provider}:${owner}:901`, songs(provider, 7));
    }
    for (const provider of ['netease', 'qq']) { reset(provider); reset(provider, '200', 7); }
    function armHold(kind, countdown = 1) {
      return new Promise(resolve => { hold = { kind, countdown, held: resolve }; });
    }
    async function maybeHold(kind) {
      if (!hold || hold.kind !== kind || --hold.countdown) return;
      const held = hold;
      hold = null;
      await new Promise(resolve => { release = resolve; held.held(); });
    }
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\//, async route => {
      const url = new URL(route.request().url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
      if (url.pathname === '/fixture-cover.png') return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.resolve(__dirname, '../resources/app-icon.png')) });
      if (!url.pathname.startsWith('/backend/')) return route.continue();
      const endpoint = decodeURIComponent(url.pathname.replace('/backend', ''));
      const provider = endpoint.split('/')[2], owner = owners[provider], method = route.request().method();
      if (endpoint === '/auth/accounts') return route.fulfill({ json: [account('qq', owners.qq), account('netease', owners.netease)] });
      if (endpoint.endsWith('/profile')) return route.fulfill({ json: account(provider, owner) });
      if (endpoint === `/account/${provider}/favorites`) {
        if (method === 'POST') {
          const track = route.request().postDataJSON();
          writes.push({ provider, owner, kind: 'like', ids: [track.id] });
          await maybeHold('like');
          fixtureLikes[provider] = [...fixtureLikes[provider].filter(item => item.id !== track.id), track];
          return route.fulfill({ json: { ok: true } });
        }
        return route.fulfill({ json: fixtureLikes[provider] });
      }
      if (method === 'DELETE' && endpoint.startsWith(`/account/${provider}/favorites/`)) {
        const id = endpoint.split('/')[4];
        writes.push({ provider, owner, kind: 'unlike', ids: [id] });
        await maybeHold('unlike');
        fixtureLikes[provider] = fixtureLikes[provider].filter(item => item.id !== id);
        return route.fulfill({ json: { ok: true } });
      }
      if (endpoint === `/account/${provider}/recent-tracks`) {
        if (method === 'DELETE') {
          const { trackIds } = route.request().postDataJSON();
          writes.push({ provider, owner, kind: 'recent', ids: trackIds });
          await maybeHold('recent');
          return route.fulfill({ json: { deletedTrackIds: trackIds, tracks: [] } });
        }
        return route.fulfill({ json: songs(provider, 11) });
      }
      if (endpoint === `/account/${provider}/playlists`) return route.fulfill({ json: [900, 901].map(id => playlist(provider, id, stored.get(`${provider}:${owner}:${id}`)?.length || 0)) });
      if (method === 'POST' && /^\/account\/[^/]+\/playlists\/[^/]+\/order$/.test(endpoint)) {
        writes.push({ provider, owner, kind: 'reorder', ids: route.request().postDataJSON().trackIds });
        await maybeHold('reorder');
        return route.fulfill({ json: { ok: true } });
      }
      if (method === 'POST' && /\/tracks(?:\/remove-batch)?$/.test(endpoint)) {
        const body = route.request().postDataJSON(), id = endpoint.split('/')[4].split(':')[1];
        const kind = endpoint.endsWith('/remove-batch') ? 'remove' : 'add';
        assert.equal(body.expectedAccountId, owner, 'Every write carries the account captured at its start');
        assert.ok(body.trackIds.length >= 1 && body.trackIds.length <= 100);
        writes.push({ provider, owner, id, kind, ids: body.trackIds });
        const key = `${provider}:${owner}:${id}`;
        await maybeHold(kind);
        if (kind === 'add') {
          if (rejectAddition && body.trackIds.includes(`${provider}:101`)) return route.fulfill({ status: 502, json: { message: 'Platform code 80105' } });
          const ids = new Set([...(stored.get(key) || []).map(track => track.id), ...body.trackIds]);
          stored.set(key, songs(provider, 205).filter(track => ids.has(track.id)));
          return route.fulfill({ json: { ok: true } });
        }
        const succeeded = body.trackIds.filter(id => id !== rejectRemoval), failed = body.trackIds.filter(id => id === rejectRemoval);
        stored.set(key, (stored.get(key) || []).filter(track => !succeeded.includes(track.id)));
        return route.fulfill({ json: { succeeded, failed, errors: Object.fromEntries(failed.map(id => [id, 'Verified membership still contains this song'])) } });
      }
      if (/^\/account\/[^/]+\/playlists\/[^/]+$/.test(endpoint)) return route.fulfill({ json: stored.get(`${provider}:${owner}:${endpoint.split('/')[4].split(':')[1]}`) || [] });
      if (endpoint === '/health') return route.fulfill({ json: { ok: true } });
      return route.fulfill({ json: [] });
    });
    await page.addInitScript(() => {
      localStorage.setItem('tiaolv-music-onboarding-version', '1');
      window.confirm = () => { throw Error('Native confirmation must not be used'); };
    });
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => document.querySelector('.app-shell')?.__vueParentComponent.setupState.backendStatus === '已连接');
    await page.evaluate(() => { const state = document.querySelector('.app-shell').__vueParentComponent.setupState; state.appMode = 'streaming'; state.showSongDetail = false; });
    const picker = page.getByRole('dialog', { name: '加入歌单', exact: true });
    const status = page.locator('.daily-track-management').getByRole('status');
    const confirm = page.getByRole('dialog', { name: '移出歌单', exact: true });
    async function open(provider, id = 900, count = 205) {
      await stateCall(page, 'selectPlaylist', [playlist(provider, id, count)]);
      await page.waitForFunction(count => document.querySelectorAll('.daily-detail-row').length === count, stored.get(`${provider}:${owners[provider]}:${id}`).length);
    }
    async function selectAll() {
      await page.getByRole('button', { name: '批量操作', exact: true }).click();
      await page.getByLabel('全选当前列表').check();
    }
    async function remove() {
      await page.getByRole('button', { name: '移出歌单', exact: true }).click();
      await confirm.getByRole('button', { name: '移出', exact: true }).click();
    }
    async function waitIdle() {
      await page.waitForFunction(() => !document.querySelector('.app-shell').__vueParentComponent.setupState.playlistMutationPending);
    }
    async function screenshot(name) {
      await page.screenshot({ path: path.join(output, `${name}-desktop.png`) });
      await page.setViewportSize({ width: 920, height: 720 });
      await page.screenshot({ path: path.join(output, `${name}-narrow.png`) });
      assert.equal(await page.locator('.daily-track-management').evaluate(element => [...element.querySelectorAll('button,span')].some(child => child.getBoundingClientRect().right > window.innerWidth + 1)), false);
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    for (const provider of ['netease', 'qq']) {
      await stateCall(page, 'selectStreamingSource', [provider]);
      await stateCall(page, 'loadAccountContent');
      await open(provider);
      await selectAll();
      const start = writes.length;
      rejectAddition = true;
      const additionHeld = armHold('add', 2);
      await page.locator('.daily-detail-row').first().click({ button: 'right' });
      await page.getByRole('menuitem', { name: '添加到歌单（205 首）', exact: true }).click();
      await picker.locator('.track-playlist-target-list').waitFor();
      await picker.getByRole('button', { name: /Same title/ }).nth(1).click();
      await additionHeld;
      await picker.getByRole('status').filter({ hasText: '100/205' }).waitFor();
      await screenshot(`account-add-progress-${provider}`);
      release(); release = null;
      await picker.waitFor({ state: 'hidden' });
      await status.filter({ hasText: '成功 105 首，失败 100 首：Platform code 80105' }).waitFor();
      assert.equal(await page.locator('.daily-detail-row input:checked').count(), 100);
      assert.deepEqual(writes.slice(start).map(write => write.ids.length), [100, 100, 5]);
      rejectAddition = false;
      await page.locator('.daily-detail-row').nth(100).click({ button: 'right' });
      await page.getByRole('menuitem', { name: '添加到歌单（100 首）', exact: true }).click();
      await picker.getByRole('button', { name: /Same title/ }).nth(1).click();
      await picker.waitFor({ state: 'hidden' });
      assert.deepEqual(writes.at(-1).ids, songs(provider, 205).slice(100, 200).map(track => track.id));
      assert.equal(await page.locator('.daily-detail-row input:checked').count(), 0);
      const add101Start = writes.length;
      await stateCall(page, 'openTracksPlaylistPicker', [[...songs(provider, 101), songs(provider, 1)[0]], 'regular']);
      await picker.getByRole('button', { name: /Same title/ }).nth(1).click();
      await picker.waitFor({ state: 'hidden' });
      assert.deepEqual(writes.slice(add101Start).map(write => write.ids.length), [100, 1]);

      await page.getByLabel('全选当前列表').check();
      const removalStart = writes.length;
      await page.getByRole('button', { name: '移出歌单', exact: true }).click();
      await confirm.getByRole('button', { name: '取消', exact: true }).click();
      assert.equal(writes.length, removalStart);
      assert.equal(await page.locator('.daily-detail-row input:checked').count(), 205);
      rejectRemoval = `${provider}:101`;
      const removalHeld = armHold('remove', 2);
      await remove();
      await removalHeld;
      const processed = provider === 'qq' ? 5 : 100;
      await status.filter({ hasText: `${processed}/205` }).waitFor();
      assert.equal(await page.locator('.daily-detail-row').count(), 205 - processed);
      await screenshot(`account-remove-progress-${provider}`);
      release(); release = null;
      await status.filter({ hasText: '成功 204 首，失败 1 首：Verified membership' }).waitFor();
      assert.equal(await page.locator('.daily-detail-row input:checked').count(), 1);
      const removalTrace = writes.slice(removalStart);
      assert.deepEqual(removalTrace.map(write => write.ids.length), provider === 'qq' ? Array(41).fill(5) : [100, 100, 5]);
      assert.equal(await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.selectedPlaylist.imageUrl), playlist(provider, 900).imageUrl);
      await screenshot(`account-remove-partial-${provider}`);
      rejectRemoval = '';
      await remove();
      await waitIdle();
      assert.deepEqual(writes.at(-1).ids, [`${provider}:101`]);
      assert.equal(await page.locator('.daily-detail-row').count(), 0);

      for (const kind of ['add', 'remove']) for (const change of ['page', 'account']) {
        reset(provider, '100', 11); owners[provider] = '100';
        await stateCall(page, 'handleAuthenticated', [account(provider, '100')]);
        await stateCall(page, 'selectStreamingSource', [provider]);
        await stateCall(page, 'loadAccountContent');
        await open(provider, 900, 11);
        await selectAll();
        const scopeStart = writes.length, held = armHold(kind);
        if (kind === 'add') {
          await page.locator('.daily-detail-row').first().click({ button: 'right' });
          await page.getByRole('menuitem', { name: '添加到歌单（11 首）', exact: true }).click();
          await picker.getByRole('button', { name: /Same title/ }).nth(1).click();
        } else await remove();
        await held;
        if (change === 'account') {
          owners[provider] = '200';
          await stateCall(page, 'handleAuthenticated', [account(provider, '200')]);
          await stateCall(page, 'loadAccountContent');
        }
        await open(provider, change === 'page' ? 901 : 900, 7);
        assert.equal(await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.playlistMutationPending), false, 'A retired scope cannot keep the new page busy');
        assert.equal(await picker.count(), 0, 'A retired page picker must close before its request settles');
        release(); release = null;
        await waitIdle();
        await page.waitForFunction(() => document.querySelectorAll('.daily-detail-row').length === 7);
        assert.equal(writes.slice(scopeStart).length, 1, `${provider} ${kind} ${change} change stops new writes`);
        assert.ok((await status.allTextContents()).every(text => text === ''), 'Late result cannot publish into a same-title or new-account page');
        assert.equal(await page.locator('.daily-detail-row input:checked').count(), 0);
      }
      for (const oldKind of ['add', 'remove']) {
        reset(provider, '100', 11); owners[provider] = '100';
        await stateCall(page, 'handleAuthenticated', [account(provider, '100')]);
        await stateCall(page, 'loadAccountContent');
        await open(provider, 900, 11);
        const oldHeld = armHold(oldKind);
        if (oldKind === 'add') {
          await stateCall(page, 'openTracksPlaylistPicker', [songs(provider, 11), 'regular']);
          await picker.locator('.track-playlist-target-list').waitFor();
          await page.evaluate(() => {
            const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
            window.oldOverlap = state.addTracksToStreamingPlaylist(state.streamingPlaylistTargets[0]);
          });
        } else await page.evaluate(ids => {
          window.oldOverlap = document.querySelector('.app-shell').__vueParentComponent.setupState.runStreamingTrackBatch('remove', ids);
        }, songs(provider, 11).map(track => track.id));
        await oldHeld;
        const settleOld = release; release = null;
        await open(provider, 901, 7);
        const newKind = oldKind === 'add' ? 'remove' : 'add', newHeld = armHold(newKind);
        if (newKind === 'add') {
          await stateCall(page, 'openTracksPlaylistPicker', [songs(provider, 7), 'regular']);
          await picker.locator('.track-playlist-target-list').waitFor();
          await page.evaluate(() => {
            const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
            window.newOverlap = state.addTracksToStreamingPlaylist(state.streamingPlaylistTargets[1]);
          });
        } else await page.evaluate(ids => {
          window.newOverlap = document.querySelector('.app-shell').__vueParentComponent.setupState.runStreamingTrackBatch('remove', ids);
        }, songs(provider, 7).map(track => track.id));
        await newHeld;
        const settleNew = release; release = null;
        assert.equal(await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.playlistMutationPending), true);
        settleOld();
        await page.evaluate(() => window.oldOverlap);
        assert.equal(await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.playlistMutationPending), true, 'An old finally cannot clear a newer held operation');
        assert.equal(await page.getByRole('button', { name: '批量操作', exact: true }).isDisabled(), true);
        assert.equal(await page.locator('.daily-detail-row').count(), 7, 'The retired operation cannot change the current rows');
        settleNew();
        await page.evaluate(() => window.newOverlap);
        await waitIdle();
        assert.equal(await page.locator('.daily-detail-row').count(), newKind === 'remove' ? 0 : 7);
      }
      const retiredWriterFailures = [];
      for (const oldKind of ['recent', 'reorder']) for (const newKind of ['add', 'remove']) {
        reset(provider, '100', 11); owners[provider] = '100';
        await stateCall(page, 'handleAuthenticated', [account(provider, '100')]);
        await stateCall(page, 'loadAccountContent');
        if (oldKind === 'recent') {
          await stateCall(page, 'selectView', ['streaming-recent']);
          await page.waitForFunction(() => document.querySelectorAll('.daily-detail-row').length === 11);
        } else await open(provider, 900, 11);
        const oldHeld = armHold(oldKind);
        await page.evaluate(({ oldKind, ids }) => {
          const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
          window.oldOverlap = oldKind === 'recent'
            ? state.runAccountRecentTrackBatch('clear-recent', ids)
            : state.reorderStreamingPlaylistTrack(ids[0], ids[1]);
        }, { oldKind, ids: songs(provider, 11).map(track => track.id) });
        await oldHeld;
        const settleOld = release; release = null;
        await open(provider, 901, 7);
        const newHeld = armHold(newKind);
        if (newKind === 'add') {
          await stateCall(page, 'openTracksPlaylistPicker', [songs(provider, 7), 'regular']);
          await picker.locator('.track-playlist-target-list').waitFor();
          await page.evaluate(() => {
            const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
            window.newOverlap = state.addTracksToStreamingPlaylist(state.streamingPlaylistTargets[1]);
          });
        } else await page.evaluate(ids => {
          window.newOverlap = document.querySelector('.app-shell').__vueParentComponent.setupState.runStreamingTrackBatch('remove', ids);
        }, songs(provider, 7).map(track => track.id));
        await newHeld;
        const settleNew = release; release = null;
        settleOld();
        await page.evaluate(() => window.oldOverlap);
        const stateAfterOld = await page.evaluate(() => {
          const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
          return { pending: state.playlistMutationPending, cooling: state.playlistOrderCooling, recent: state.accountRecentTracks.length };
        });
        if (!stateAfterOld.pending) retiredWriterFailures.push(`${provider} old ${oldKind} cleared new ${newKind} busy`);
        if (stateAfterOld.cooling) retiredWriterFailures.push(`${provider} retired ${oldKind} started cooldown`);
        if (oldKind === 'recent' && stateAfterOld.recent !== 11) retiredWriterFailures.push(`${provider} retired recent published rows`);
        assert.equal(await page.locator('.daily-detail-row').count(), 7);
        settleNew();
        await page.evaluate(() => window.newOverlap);
        await waitIdle();
        await page.waitForFunction(() => !document.querySelector('.app-shell').__vueParentComponent.setupState.playlistOrderCooling);
      }
      for (const change of ['away-back', 'relogin']) {
        reset(provider, '100', 11);
        await stateCall(page, 'handleAuthenticated', [account(provider, '100')]);
        await stateCall(page, 'loadAccountContent');
        await open(provider, 900, 11);
        const held = armHold('reorder');
        await page.evaluate(ids => {
          window.oldOverlap = document.querySelector('.app-shell').__vueParentComponent.setupState.reorderStreamingPlaylistTrack(ids[0], ids[1]);
        }, songs(provider, 11).map(track => track.id));
        await held;
        const settleOld = release; release = null;
        if (change === 'away-back') await open(provider, 901, 7);
        else await stateCall(page, 'handleAuthenticated', [account(provider, '100')]);
        stored.set(`${provider}:100:900`, songs(provider, 11).reverse());
        await open(provider, 900, 11);
        const before = await page.locator('.daily-detail-row').evaluateAll(rows => rows.map(row => row.dataset.trackId));
        settleOld();
        await page.evaluate(() => window.oldOverlap);
        const after = await page.locator('.daily-detail-row').evaluateAll(rows => rows.map(row => row.dataset.trackId));
        if (JSON.stringify(after) !== JSON.stringify(before)) retiredWriterFailures.push(`${provider} ${change} reorder published old rows`);
        const cooling = await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.playlistOrderCooling);
        if (cooling) retiredWriterFailures.push(`${provider} ${change} reorder published old cooldown`);
        await page.waitForFunction(() => !document.querySelector('.app-shell').__vueParentComponent.setupState.playlistOrderCooling);
      }
      for (const action of ['like', 'unlike']) {
        reset(provider, '100', 11);
        fixtureLikes[provider] = action === 'unlike' ? songs(provider, 11) : [];
        await stateCall(page, 'handleAuthenticated', [account(provider, '100')]);
        await stateCall(page, 'loadAccountContent');
        await open(provider, 900, 11);
        await selectAll();
        await page.locator('.daily-detail-row').first().click({ button: 'right' });
        const held = armHold(action);
        await page.evaluate(() => {
          window.oldFavorite = document.querySelector('.app-shell').__vueParentComponent.setupState.toggleContextMenuTrackFavorite();
        });
        await held;
        const settleOld = release; release = null;
        await open(provider, 901, 7);
        await open(provider, 900, 11);
        await page.evaluate(() => { document.querySelector('.app-shell').__vueParentComponent.setupState.searchToast = ''; });
        settleOld();
        await page.evaluate(() => window.oldFavorite);
        const toast = await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.searchToast);
        if (toast) retiredWriterFailures.push(`${provider} away-back context ${action} published old toast: ${toast}`);
      }
      reset(provider, '100', 11);
      await stateCall(page, 'handleAuthenticated', [account(provider, '100')]);
      await stateCall(page, 'loadAccountContent');
      await open(provider, 901, 7);
      await open(provider, 900, 11);
      await selectAll();
      await page.locator('.daily-detail-row').first().click({ button: 'right' });
      const menuWritesBefore = writes.length;
      await page.keyboard.press('Alt+ArrowLeft');
      await page.waitForFunction(provider => document.querySelector('.app-shell').__vueParentComponent.setupState.selectedPlaylist?.id === `${provider}:901`, provider);
      let staleMenu = await page.evaluate(() => Boolean(document.querySelector('.app-shell').__vueParentComponent.setupState.localTrackContextMenu));
      if (staleMenu) retiredWriterFailures.push(`${provider} keyboard back retained old selection menu`);
      await page.keyboard.press('Alt+ArrowRight');
      await page.waitForFunction(provider => document.querySelector('.app-shell').__vueParentComponent.setupState.selectedPlaylist?.id === `${provider}:900`, provider);
      staleMenu = await page.evaluate(() => Boolean(document.querySelector('.app-shell').__vueParentComponent.setupState.localTrackContextMenu));
      if (staleMenu) retiredWriterFailures.push(`${provider} keyboard forward retained old selection menu`);
      assert.equal(writes.length, menuWritesBefore, 'Keyboard navigation never writes a retired selection');
      assert.deepEqual(retiredWriterFailures, [], 'All shared account mutations must own their pending state and captured scope');
      await open(provider, 900, 11);
      const currentOrder = await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.selectedPlaylistTracks.map(track => track.id));
      await stateCall(page, 'reorderStreamingPlaylistTrack', [currentOrder[0], currentOrder[1]]);
      const reordered = await page.evaluate(() => {
        const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
        return { ids: state.selectedPlaylistTracks.map(track => track.id), selected: state.selectedPlaylist?.id, mode: state.selectedPlaylistBatchMode,
          pending: state.playlistMutationPending, cooling: state.playlistOrderCooling, message: state.playlistOrderMessage };
      });
      const expectedOrder = [currentOrder[1], currentOrder[0], ...currentOrder.slice(2)];
      assert.deepEqual(reordered.ids, expectedOrder, JSON.stringify(reordered));
      await page.waitForFunction(ids => JSON.stringify([...document.querySelectorAll('.daily-detail-row')].map(row => row.dataset.trackId)) === JSON.stringify(ids), expectedOrder);
      assert.equal(await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.playlistOrderCooling), true, 'A current verified reorder retains its existing cooldown');
      await page.waitForFunction(() => !document.querySelector('.app-shell').__vueParentComponent.setupState.playlistOrderCooling);
      console.log(`${provider}: add 205 [100,100,5], partial retry [100], dedup 101 [100,1]; remove 205 ${provider === 'qq' ? '[5 x 41]' : '[100,100,5]'}, partial retry [1]; page/account scope, shared mutation overlap, and stale reorder checks passed`);
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
