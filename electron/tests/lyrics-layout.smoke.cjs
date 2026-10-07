const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 803 } });
    await page.route("http://127.0.0.1:17890/**", route => route.fulfill({
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
        lyrics: "[00:12.00]I have left my fingerprints\n[00:20.00]A second original line\n[00:30.00]The final line",
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
        inactive: getComputedStyle(inactive.querySelector(".lyric-original")).fontSize,
        translation: active && getComputedStyle(active.querySelector(".song-detail-translation")).fontSize,
        inactiveTranslation: getComputedStyle(inactive.querySelector(".song-detail-translation")).fontSize,
        color: active && getComputedStyle(active.querySelector(".lyric-original")).color };
    });
    const output = path.resolve(__dirname, "../.playwright-cli");
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "lyrics-layout-desktop.png") });
    console.log(JSON.stringify({ geometry, styles }));
    assert.ok(geometry.lineHeight > geometry.firstHeight * 1.5, "fixture must wrap");
    assert.ok(Math.abs(geometry.delta) < 3, "triangle aligns with first visual line");
    assert.ok(parseFloat(styles.active) > parseFloat(styles.inactive), "active original is larger");
    assert.equal(styles.inactive, styles.metadata, "original lyrics match the song information size");
    assert.equal(styles.inactive, "22px");
    assert.equal(styles.originalWeight, "400");
    assert.equal(styles.originalWeight, styles.metadataWeight);
    assert.equal(styles.activeWeight, styles.originalWeight, "singing enlarges without bolding");
    assert.equal(styles.originalFont, styles.metadataFont);
    assert.equal(styles.translation, styles.inactiveTranslation);
    assert.equal(styles.color, "rgb(47, 159, 200)");
    for (const width of [1600, 900, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 852 : 803 });
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
