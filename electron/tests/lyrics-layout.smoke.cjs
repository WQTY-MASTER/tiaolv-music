const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 803 } });
    await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):(?:17890\/|\d+\/backend\/)/, route => route.fulfill({
      json: route.request().url().includes("health") ? { ok: true } : []
    }));
    await page.addInitScript(() => localStorage.setItem("tiaolv-music-onboarding-version", "1"));
    await page.goto(process.env.LYRICS_TEST_URL || "http://127.0.0.1:5173");
    await page.locator(".app-shell").waitFor();
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
      const track = { ...state.currentTrack, id: "layout-fixture", source: "local", title: "致以无名的抗争者",
        artist: "鸣潮先约电台/jixwang/Thena A/Tarokiki/VISION SOUND", duration: 90,
        lyrics: "[00:12.00]Through these rainbows shadows struggles muddles\n[00:20.00]A second original line\n[00:30.00]The final line",
        lyricsTranslation: "[00:12.00]都留有我的指纹\n[00:20.00]第二句译文\n[00:30.00]最后一句译文", lyricsFormat: "LRC" };
      state.currentTrack = track;
      state.loadTrackLyrics(track);
      state.showSongDetail = true;
      state.manualLyricsScroll = true;
      state.lyricAnchorVisible = true;
    });
    await page.locator("[data-song-info-line]").first().waitFor();
    await page.waitForTimeout(650);
    await page.evaluate(() => {
      const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
      const root = document.querySelector(".song-detail-lyrics");
      root.scrollTop = 0;
      state.updateLyricAnchorFromScroll();
    });
    await page.waitForTimeout(100);
    const geometry = await page.evaluate(() => {
      const line = document.querySelector("[data-song-info-line]");
      const char = line.querySelector(".song-info-character");
      const range = document.createRange(); range.selectNodeContents(char);
      const first = range.getBoundingClientRect();
      const button = document.querySelector(".lyric-seek-play-icon").getBoundingClientRect();
      const root = document.querySelector(".song-detail-lyrics");
      const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
      return { delta: button.top + button.height / 2 - first.top - first.height / 2,
        lineHeight: line.getBoundingClientRect().height, firstHeight: first.height,
        rootTop: root.getBoundingClientRect().top, rootHeight: root.clientHeight, scrollTop: root.scrollTop,
        firstCenter: first.top + first.height / 2, buttonCenter: button.top + button.height / 2,
        spacer: state.lyricStartSpacerHeight, rootPadding: getComputedStyle(root).paddingTop };
    });
    await page.evaluate(() => {
      const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
      state.currentTime = 13;
    });
    await page.waitForTimeout(250);
    const styles = await page.evaluate(() => {
      const active = document.querySelector(".lyric-line.is-active");
      const inactive = document.querySelector(".lyric-line:not(.is-active)");
      return { metadata: getComputedStyle(document.querySelector(".song-detail-artist")).fontSize,
        metadataWeight: getComputedStyle(document.querySelector(".song-detail-artist")).fontWeight,
        metadataFont: getComputedStyle(document.querySelector(".song-detail-artist")).fontFamily,
        originalWeight: getComputedStyle(inactive.querySelector(".lyric-original")).fontWeight,
        originalFont: getComputedStyle(inactive.querySelector(".lyric-original")).fontFamily,
        activeWeight: active && getComputedStyle(active.querySelector(".lyric-original")).fontWeight,
        active: active && getComputedStyle(active.querySelector(".lyric-original")).fontSize,
        activeTransform: active && getComputedStyle(active.querySelector(".lyric-original")).transform,
        inactive: getComputedStyle(inactive.querySelector(".lyric-original")).fontSize,
        translation: active && getComputedStyle(active.querySelector(".song-detail-translation")).fontSize,
        inactiveTranslation: getComputedStyle(inactive.querySelector(".song-detail-translation")).fontSize,
        color: active && getComputedStyle(active.querySelector(".lyric-original")).color,
        originalHeight: active && active.querySelector(".lyric-original").getBoundingClientRect().height,
        originalBottom: active && active.querySelector(".lyric-original").getBoundingClientRect().bottom,
        translationTop: active && active.querySelector(".song-detail-translation").getBoundingClientRect().top,
        originalLineHeight: active && parseFloat(getComputedStyle(active.querySelector(".lyric-original")).lineHeight),
        originalOverflow: active && active.querySelector(".lyric-original").scrollWidth - active.querySelector(".lyric-original").clientWidth };
    });
    const output = path.resolve(__dirname, "../.playwright-cli");
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "lyrics-layout-desktop.png") });
    console.log(JSON.stringify({ geometry, styles }));
    assert.ok(geometry.lineHeight > geometry.firstHeight * 1.5, "fixture must wrap");
    assert.ok(Math.abs(geometry.delta) < 3, "triangle aligns with first visual line");
    assert.equal(styles.active, styles.metadata, "active original keeps the same base font size as song information");
    assert.equal(styles.inactive, styles.metadata, "original lyrics match the song information size");
    assert.equal(styles.inactive, "22px");
    assert.equal(styles.originalWeight, "400");
    assert.equal(styles.originalWeight, styles.metadataWeight);
    assert.equal(styles.activeWeight, styles.originalWeight, "singing enlarges without bolding");
    assert.equal(styles.originalFont, styles.metadataFont);
    assert.notEqual(styles.activeTransform, "none", "active lyric uses a compositor transform for smooth scaling");
    assert.ok(styles.originalHeight > styles.originalLineHeight, "active lyric is visibly enlarged");
    assert.ok(styles.originalBottom <= styles.translationTop, "scaled original lyric does not overlap its translation");
    assert.ok(styles.originalOverflow <= 1, "a complete lyric fits inside the lyric pane");
    assert.equal(styles.translation, styles.inactiveTranslation);
    assert.equal(styles.color, "rgb(47, 159, 200)");
    for (const width of [1600, 900, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 852 : 803 });
      await page.evaluate(() => {
        const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
        state.currentTime = 13;
      });
      await page.waitForTimeout(350);
      const activeLayout = await page.evaluate(() => {
        const root = document.querySelector(".song-detail-lyrics");
        const line = document.querySelector(".lyric-line.is-active");
        const original = line.querySelector(".lyric-original").getBoundingClientRect();
        const translation = line.querySelector(".song-detail-translation").getBoundingClientRect();
        return { overflow: root.scrollWidth - root.clientWidth,
          originalRight: original.right, paneRight: root.getBoundingClientRect().right, viewportRight: window.innerWidth,
          translationGap: translation.top - original.bottom };
      });
      console.log(JSON.stringify({ width, activeLayout }));
      await page.evaluate(() => {
        const root = document.querySelector(".song-detail-lyrics");
        const original = root.querySelector(".lyric-line.is-active .lyric-original").getBoundingClientRect();
        root.scrollTop += original.top - root.getBoundingClientRect().top - Math.max(18, (root.clientHeight - original.height) * 0.25);
      });
      await page.waitForTimeout(80);
      await page.screenshot({ path: path.join(output, `lyrics-layout-active-${width}.png`) });
      assert.ok(activeLayout.overflow <= 1, "active wrapped lyrics do not overflow horizontally");
      assert.ok(activeLayout.originalRight <= activeLayout.paneRight + 1, "scaled original stays inside the lyric pane");
      assert.ok(activeLayout.originalRight <= activeLayout.viewportRight + 1, "scaled original stays inside the visible viewport");
      assert.ok(activeLayout.translationGap >= 0, "scaled wrapped lyrics stay clear of their translation");
      assert.ok(activeLayout.translationGap <= 3, 'Translation should stay close to the original, including wrapped lines');
      const rhythm = await page.evaluate(() => [...document.querySelectorAll('.lyric-line')].map(line => {
        const style = getComputedStyle(line);
        return { padding: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) };
      }));
      assert.ok(rhythm.every(row => row.padding <= 16), 'Every bilingual group must retain a compact separated rhythm');
      await page.evaluate(() => {
        const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
        state.currentTime = 31;
        state.lyricAnchorVisible = true;
      });
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
        state.updateLyricAnchorFromScroll();
      });
      await page.waitForTimeout(50);
      await page.evaluate(() => {
        const root = document.querySelector(".song-detail-lyrics");
        root.scrollTo({ top: root.scrollHeight, behavior: "instant" });
      });
      await page.waitForTimeout(80);
      const end = await page.evaluate(() => {
        const root = document.querySelector(".song-detail-lyrics");
        const line = document.querySelector(".lyric-line:last-of-type");
        const range = document.createRange(); range.selectNodeContents(line.querySelector(".lyric-character"));
        const char = range.getBoundingClientRect();
        const anchor = document.querySelector(".lyric-seek-play-icon").getBoundingClientRect();
        const timestamp = document.querySelector(".lyric-timestamp").getBoundingClientRect();
        return { delta: char.top + char.height / 2 - anchor.top - anchor.height / 2,
          height: root.clientHeight, width: root.clientWidth, overflow: root.scrollWidth - root.clientWidth,
          gutterGap: char.left - timestamp.right, arrowLeft: anchor.left };
      });
      console.log(JSON.stringify({ width, end }));
      await page.screenshot({ path: path.join(output, `lyrics-layout-${width}.png`) });
      assert.ok(Math.abs(end.delta) < 3, "last original must also align at maximum scroll");
      assert.ok(end.overflow <= 1, "lyrics do not overflow horizontally");
      assert.ok(end.gutterGap >= 2 && end.arrowLeft >= 0, "timestamp and triangle stay clear of original text");
    }
    await page.setViewportSize({ width: 1600, height: 803 });
    for (const translated of [true, false]) {
      await page.evaluate(translated => {
        const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
        state.localLyricsOnlineMatchEnabled = false;
        const track = { ...state.currentTrack, id: `rhythm-${translated}`, source: 'local', lyricsFormat: 'LRC',
          lyrics: '[00:01.00]一弦清一心\n[00:03.00]身入局 掠阵欲影\n[00:05.00]刀起处 劈开雾中囚境',
          lyricsTranslation: translated ? '[00:01.00]First translation\n[00:03.00]Second translation\n[00:05.00]Third translation' : undefined };
        state.currentTrack = track; state.loadTrackLyrics(track); state.currentTime = 0;
      }, translated);
      await page.waitForTimeout(350);
      const rhythm = await page.locator('.lyric-line').evaluateAll(lines => lines.map(line => {
        const original = line.querySelector('.lyric-original').getBoundingClientRect();
        const translation = line.querySelector('.song-detail-translation')?.getBoundingClientRect();
        return { top: original.top, bottom: original.bottom, translationTop: translation?.top,
          translationBottom: translation?.bottom, font: parseFloat(getComputedStyle(line).fontSize) };
      }));
      const pitch = rhythm[1].top - rhythm[0].top;
      assert.ok(Math.abs(pitch - (rhythm[2].top - rhythm[1].top)) < .1, 'All lyric groups have equal pitch');
      if (translated) {
        const pairGap = rhythm[0].translationTop - rhythm[0].bottom;
        const groupGap = rhythm[1].top - rhythm[0].translationBottom;
        assert.ok(pairGap >= 0 && pairGap <= 7, 'Original and translation remain a tight pair');
        assert.ok(groupGap >= 9 && groupGap <= 18 && groupGap > pairGap * 1.5, `Separate groups visibly: gap ${groupGap}, pair ${pairGap}`);
      } else {
        assert.ok(pitch >= rhythm[0].font * 1.8 && pitch <= rhythm[0].font * 2, `Chinese single-line rhythm stays even and compact: ${pitch}`);
      }
      console.log(JSON.stringify({ translated, rhythm, pitch }));
      await page.screenshot({ path: path.join(output, `lyrics-rhythm-${translated ? 'bilingual' : 'chinese'}.png`) });
    }
    const matching = await page.evaluate(async () => {
      const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
      const originalFetch = window.fetch;
      const pending = [];
      window.fetch = (url, options) => String(url).includes("/lyrics/match")
        ? new Promise(resolve => pending.push({ url: String(url), resolve })) : originalFetch(url, options);
      try {
        state.accounts = [{ provider: "qq", providerUserId: "fixture", active: true }];
        state.localLyricsOnlineMatchEnabled = true;
        const base = { ...state.currentTrack, lyrics: "[00:01.00]local", lyricsSource: "sidecar", lyricsFormat: "LRC" };
        const a = { ...base, id: "fixture-a" };
        state.currentTrack = a;
        const first = state.matchLocalLyrics(a, true);
        const b = { ...base, id: "fixture-b" };
        state.currentTrack = b;
        const second = state.matchLocalLyrics(b, true);
        if (pending.length !== 2) throw new Error(`Expected two local-lyric upgrades, got ${pending.length}`);
        const reply = track => new Response(JSON.stringify({ matched: true,
          track: { ...track, lyrics: "[12000,1000]Hello (12000,500)world(12500,500)", lyricsFormat: "QRC", lyricsSource: "online-qq" },
          lyricData: { translation: "[00:12.00]你好世界", format: "QRC", source: "qq", credits: [] }, message: "QQ fixture" }),
          { status: 200, headers: { "Content-Type": "application/json" } });
        pending[1].resolve(reply(b)); await second;
        pending[0].resolve(reply(a)); await first;
        const result = { id: state.currentTrack.id, source: state.currentTrack.lyricsSource,
          translation: state.lyricLines[0]?.translation, timed: !!state.lyricLines[0]?.characters?.length,
          pending: state.localLyricsMatchPending };
        state.localLyricsOnlineMatchEnabled = false;
        await state.matchLocalLyrics(b, true);
        result.requests = pending.length;
        return result;
      } finally { window.fetch = originalFetch; }
    });
    console.log(JSON.stringify({ matching }));
    assert.deepEqual(matching, { id: "fixture-b", source: "online-qq", translation: "你好世界", timed: true, pending: false, requests: 2 });
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
