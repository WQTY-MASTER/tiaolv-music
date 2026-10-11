const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const account = { provider: 'qq', userId: '200', nickname: 'Test' };
    const target = { id: 'qq:0034QXzv2ptMdw', source: 'qq', title: '愿戴荣光坠入天渊',
      artist: 'VISION SOUND', album: '真伪之塔', duration: 232, liked: false };
    const favorite = { ...target, id: 'qq:existing', title: 'Existing favorite', liked: true };
    let writes = 0;
    // Every backend request is intercepted, including startup and mutations.
    await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):(?:17890\/|\d+\/backend\/)/, async route => {
      const request = route.request();
      const url = new URL(request.url());
      const endpoint = url.pathname.replace(/^\/backend/, '');
      if (endpoint === '/account/qq/favorites' && request.method() === 'POST') {
        writes++;
        assert.equal(request.postDataJSON().id, target.id);
        await new Promise(resolve => setTimeout(resolve, 350));
        return route.fulfill({ status: 502, json: { code: 'FAVORITE_WRITE_FAILED', message: 'QQ 音乐接口返回错误: 80105' } });
      }
      if (request.method() === 'DELETE') throw new Error('Favorite failure must not issue a removal');
      if (endpoint === '/auth/accounts') return route.fulfill({ json: [account] });
      if (endpoint === '/account/qq/profile') return route.fulfill({ json: { ...account, follows: 0, followers: 0 } });
      if (endpoint === '/account/qq/favorites') return route.fulfill({ json: [favorite] });
      if (endpoint === '/account/qq/playlists') return route.fulfill({ json: [{ id: 'qq:900', title: 'Test playlist', count: 1, createdByAccount: true }] });
      if (endpoint.includes('lyrics')) return route.fulfill({ json: { lyrics: '', format: 'LRC', source: 'qq' } });
      return route.fulfill({ json: endpoint.includes('health') ? { ok: true } : [] });
    });
    await page.addInitScript(() => localStorage.setItem('tiaolv-music-onboarding-version', '1'));
    await page.goto(process.env.LYRICS_TEST_URL || 'http://127.0.0.1:24885');
    await page.locator('.app-shell').waitFor();
    await page.waitForFunction(() => document.querySelector('.app-shell').__vueParentComponent.setupState.localLibraryHydrated);
    await page.evaluate(async ({ account, target }) => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.appMode = 'streaming';
      state.streamingSource = 'qq';
      state.accounts = [account];
      state.showSongDetail = false;
      await state.loadAccountContent();
      state.activeView = 'streaming-library';
      state.currentTrack = { ...target, primary: '#65749a', secondary: '#ccd0dc', mark: 'Q' };
    }, { account, target });
    const library = page.locator('.streaming-library-page');
    const favorites = library.locator('.account-playlist-item').filter({ hasText: '我的喜欢' });
    await favorites.waitFor();
    assert.equal(await favorites.count(), 1);
    assert.match(await favorites.textContent(), /1 首/);
    const heart = page.locator('.player-tools button').filter({ has: page.locator('.player-like-icon') });
    await heart.click();
    await heart.click();
    await page.locator('.search-toast').filter({ hasText: '80105' }).waitFor();
    assert.equal(writes, 1);
    assert.equal(await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.currentTrack.liked), false);
    assert.match(await favorites.textContent(), /1 首/);
    assert.deepEqual(errors, []);
    const output = path.resolve(__dirname, '../.playwright-cli');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'qq-favorites-error.png') });
    await favorites.click();
    await page.getByText('Existing favorite', { exact: true }).first().waitFor();
    console.log('QQ favorites UI passed: fallback directory, real favorites detail, single write, visible 80105 and retained favorite state');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
