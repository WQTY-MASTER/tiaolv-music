const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const account = { provider: 'qq', userId: '200', nickname: 'Test' };
    const target = { id: 'qq:testMid', source: 'qq', title: 'Test playback', artist: 'Test', duration: 180 };
    const reports = [];
    // All backend requests, including cloud writes, are replaced with fixtures.
    await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/backend\//, route => {
      const request = route.request();
      const endpoint = new URL(request.url()).pathname.replace(/^\/backend/, '');
      if (endpoint === '/account/qq/recent-play-reports') {
        reports.push(request.postDataJSON());
        return reports.length === 1
          ? route.fulfill({ json: { ok: true, tracks: [target] } })
          : route.fulfill({ status: 502, json: { code: 'RECENT_PLAY_REPORT_FAILED', message: 'QQ 音乐接口返回错误: 80105' } });
      }
      if (endpoint === '/auth/accounts') return route.fulfill({ json: [account] });
      if (endpoint === '/account/qq/profile') return route.fulfill({ json: { ...account, follows: 0, followers: 0 } });
      if (endpoint.includes('lyrics')) return route.fulfill({ json: { lyrics: '', format: 'LRC', source: 'qq' } });
      return route.fulfill({ json: request.method() === 'GET' ? [] : { ok: true } });
    });
    await page.addInitScript(() => localStorage.setItem('tiaolv-music-onboarding-version', '1'));
    await page.goto(process.env.LYRICS_TEST_URL || 'http://127.0.0.1:24885');
    await page.waitForFunction(() => document.querySelector('.app-shell')?.__vueParentComponent.setupState.localLibraryHydrated);
    await page.evaluate(async ({ account, target }) => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.appMode = 'streaming'; state.streamingSource = 'qq'; state.accounts = [account];
      await state.loadAccountContent();
      state.currentTrack = { ...target, primary: '#65749a', secondary: '#ccd0dc', mark: 'Q' };
      const audio = document.querySelector('audio');
      window.testMediaTime = 0; window.testWallTime = 0;
      Object.defineProperty(performance, 'now', { configurable: true, value: () => window.testWallTime });
      Object.defineProperties(audio, {
        currentTime: { configurable: true, get: () => window.testMediaTime },
        duration: { configurable: true, get: () => 180 },
        paused: { configurable: true, get: () => !state.isPlaying }
      });
      state.isPlaying = true;
      audio.dispatchEvent(new Event('play'));
    }, { account, target });
    const sample = async (seconds, jump = false) => page.evaluate(({ seconds, jump }) => {
      const audio = document.querySelector('audio');
      for (let i = 0; i < seconds; i++) {
        window.testWallTime += 1000;
        window.testMediaTime += jump ? 2 : 1;
        audio.dispatchEvent(new Event('timeupdate'));
      }
    }, { seconds, jump });
    await sample(10);
    await page.evaluate(() => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.isPlaying = false; document.querySelector('audio').dispatchEvent(new Event('pause'));
      window.testWallTime += 60000;
      state.isPlaying = true; document.querySelector('audio').dispatchEvent(new Event('play'));
    });
    await page.evaluate(() => document.querySelector('audio').dispatchEvent(new Event('seeking')));
    await sample(1, true);
    await sample(19);
    assert.equal(reports.length, 0);
    await sample(1);
    await page.waitForFunction(() => document.querySelector('.app-shell').__vueParentComponent.setupState.accountRecentTracks.length === 1);
    await sample(5);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].listenedSeconds, 30);
    assert.equal(reports[0].accountId, account.userId);
    await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.openProviderAuthPanel('qq'));
    await sample(35);
    assert.equal(reports.length, 1, 'opening login panel must not restart cloud playback session');
    page.on('dialog', dialog => dialog.accept());
    await page.evaluate(async () => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.selectedQqListeningDataAccountId = '200'; state.qqListeningDataDeleteMode = 'all';
      await state.deleteSelectedQqListeningStats(); state.authPanelVisible = false;
    });
    await sample(35);
    assert.equal(reports.length, 1, 'clearing local statistics must not restart cloud playback session');
    await page.evaluate(target => {
      const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
      state.currentTrack = { ...state.currentTrack, ...target, id: 'qq:secondMid' };
      window.testMediaTime = 0;
      document.querySelector('audio').dispatchEvent(new Event('play'));
    }, target);
    await sample(30);
    await page.locator('.search-toast').filter({ hasText: '80105' }).waitFor();
    await sample(5);
    assert.equal(reports.length, 2);
    assert.notEqual(reports[0].sessionId, reports[1].sessionId);
    assert.deepEqual(errors, []);
    console.log('QQ recent UI passed: real-time sampler, pause/seek exclusion, one report, confirmed history and visible terminal failure');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
