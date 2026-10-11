const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const source of ['qq', 'netease', 'cloud']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 852 } });
      const page = await context.newPage();
      const original = '[00:00.00]First line\n[00:04.00]“Will the prophecy manifest\n[00:08.00]Final line';
      const translation = '[00:00.00]第一句\n[00:04.00]“预言是否会显现\n[00:08.00]最后一句';
      const track = { id: `${source}:startup-fixture`, title: 'Startup fixture', artist: 'Fixture', source, duration: 60,
        lyrics: original, lyricsFormat: 'LRC' };
      let lyricRequests = 0;
      await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):(?:17890\/|\d+\/backend\/)/, async route => {
        const url = new URL(route.request().url());
        const pathname = url.pathname.replace(/^\/backend/, '');
        let json = [];
        if (pathname === '/health') json = { ok: true };
        if (pathname === '/playback/queue') json = [track];
        if (pathname === '/playback/state') json = { trackId: track.id, positionSeconds: 4.5, volume: 35, playMode: 'loop' };
        if (pathname.endsWith('/lyrics')) {
          lyricRequests++;
          json = { lyrics: original, translation, format: 'LRC', source };
        }
        await route.fulfill({ json });
      });
      await page.addInitScript(() => localStorage.setItem('tiaolv-music-onboarding-version', '1'));
      await page.goto(process.env.LYRICS_TEST_URL || 'http://127.0.0.1:5173');
      await page.waitForFunction(id => document.querySelector('.app-shell')?.__vueParentComponent.setupState.currentTrack.id === id, track.id);
      await page.waitForFunction(() => document.querySelector('.app-shell').__vueParentComponent.setupState.lyricLines.some(line => line.translation));
      assert.equal(lyricRequests, 1, 'Translation must load at startup, before opening the panel');
      const restored = await page.evaluate(() => {
        const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
        return { playing: state.isPlaying, volume: state.volume, translation: state.currentTrack.lyricsTranslation };
      });
      assert.equal(restored.playing, false);
      assert.equal(restored.volume, 35);
      assert.equal(restored.translation, translation);
      await page.evaluate(() => {
        const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
        state.openSongDetail(); state.currentTime = 4.5; state.manualLyricsScroll = true;
      });
      await page.locator('.song-detail-translation').first().waitFor();
      await page.waitForTimeout(400);
      const quote = await page.evaluate(() => {
        const line = document.querySelector('[data-lyric-index="1"]');
        const original = line.querySelector('.lyric-original'), first = original.querySelector('.lyric-character:not(.is-leading-quote)');
        const translated = line.querySelector('.song-detail-translation'), mark = original.querySelector('.is-leading-quote');
        const range = document.createRange(); range.selectNodeContents(translated.lastChild);
        return { text: original.textContent, translation: translated.textContent,
          originalInset: first.getBoundingClientRect().left - original.getBoundingClientRect().left,
          translationInset: range.getBoundingClientRect().left - translated.getBoundingClientRect().left,
          markRight: mark.getBoundingClientRect().right, originalLeft: original.getBoundingClientRect().left };
      });
      assert.equal(quote.text, '“Will the prophecy manifest');
      assert.equal(quote.translation, '“预言是否会显现');
      assert.ok(Math.abs(quote.originalInset) < 1 && Math.abs(quote.translationInset) < 1, 'Opening quotes must not indent the body');
      assert.ok(quote.markRight <= quote.originalLeft + 1, 'Preserve the opening quote outside the body alignment');
      await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.openMiniPlayer());
      await page.locator('.mini-lyric-translation').first().waitFor();
      assert.ok((await page.locator('.mini-lyric-translation').allTextContents()).some(text => text.includes('预言是否会显现')));
      const artifacts = path.resolve(__dirname, '../.playwright-cli'); fs.mkdirSync(artifacts, { recursive: true });
      await page.screenshot({ path: path.join(artifacts, `lyric-startup-${source}.png`) });
      assert.equal(lyricRequests, 1, 'Opening detail and mini must reuse the hydrated translation');
      await context.close();
    }
    console.log('Startup lyrics passed: QQ/NetEase/cloud translations before panel, paused state, hanging quotes, immediate mini translations');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
