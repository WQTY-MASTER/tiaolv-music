const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fixture = require("./fixtures/qrc-preface.cjs");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 803 } });
    await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):(?:17890\/|\d+\/backend\/)/, route => route.fulfill({ json: route.request().url().includes("health") ? { ok: true } : [] }));
    await page.addInitScript(() => localStorage.setItem("tiaolv-music-onboarding-version", "1"));
    await page.goto(process.env.LYRICS_TEST_URL || "http://127.0.0.1:5173");
    await page.locator(".app-shell").waitFor();
    await page.waitForTimeout(500);
    await page.evaluate(fixture => {
      const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
      const track = { ...state.currentTrack, id: "qrc-fixture", source: "local", duration: 60,
        title: fixture.title, artist: "Fixture artist", lyrics: fixture.lyrics, lyricsTranslation: fixture.translation,
        lyricsFormat: "QRC", lyricCredits: [] };
      state.currentTrack = track; state.loadTrackLyrics(track);
      state.showSongDetail = true; state.manualLyricsScroll = true; state.currentTime = 0;
    }, fixture);
    const failures = [];
    const snapshots = [];
    for (const time of [0, 12.131, 13.689, 13.690, 15.011, 12.2, 0]) {
      await page.evaluate(time => {
        const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
        state.currentTime = time; state.updateLyricHighlightDom(time, true);
      }, time);
      await page.waitForTimeout(220);
      const result = await page.evaluate(() => ({
        preface: document.querySelector(".song-detail-song-info")?.textContent,
        lines: Array.from(document.querySelectorAll(".lyric-line")).map(line => {
          const original = line.querySelector(".lyric-original");
          const char = line.querySelector(".lyric-character");
          const style = getComputedStyle(char);
          return { text: original.textContent, active: line.classList.contains("is-active"),
            size: parseFloat(getComputedStyle(original).fontSize) * new DOMMatrix(getComputedStyle(original).transform).a,
            translationSize: parseFloat(getComputedStyle(line.querySelector(".song-detail-translation") || original).fontSize),
            visible: style.color !== "rgba(0, 0, 0, 0)" || (style.backgroundImage !== "none" && style.webkitBackgroundClip === "text") };
        })
      }));
      snapshots.push({ time, ...result });
      if (!result.preface?.includes("Fixture author")) failures.push(`missing preface credits at ${time}`);
      const active = time < 12.131 ? -1 : time < 13.690 ? 0 : time < 15.011 ? 1 : 2;
      if (result.lines.length !== 3) failures.push(`unexpected lyric count ${result.lines.length}`);
      result.lines.forEach((line, index) => {
        if (!line.visible) failures.push(`invisible original ${index} at ${time}`);
        if (line.active !== (index === active)) failures.push(`wrong active line ${index} at ${time}`);
        if (Math.abs(line.size - (index === active ? 27.5 : 22)) > 0.1) failures.push(`wrong enlarged line ${index} at ${time}`);
        if (line.translationSize !== 22) failures.push(`translation enlarged at ${time}`);
      });
    }
    const output = path.resolve(__dirname, "../.playwright-cli"); fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "lyrics-qrc-preface.png") });
    for (const firstLyricTime of [0.768, 0]) {
      await page.evaluate(firstLyricTime => {
        const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
        state.closeSongDetail();
        const credits = Array.from({ length: 20 }, (_, index) => {
          const time = 141 + index * 10;
          return `[${time},10]作曲：制作人员${index}`;
        });
        const start = firstLyricTime * 1000;
        const track = { ...state.currentTrack, id: `short-preface-${firstLyricTime}`,
          lyrics: [...credits, `[${start},1000]第一句歌词(${start},1000)`].join("\n"), lyricCredits: [] };
        state.currentTrack = track;
        state.loadTrackLyrics(track);
        state.currentTime = 0;
      }, firstLyricTime);
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
        state.openSongDetail();
        state.manualLyricsScroll = true;
      });
      await page.waitForTimeout(100);
      assert.equal(await page.locator(".song-detail-credit").count(), 20, "短前奏和零前奏都必须渲染全部制作信息");
      await page.evaluate(time => {
        const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
        state.currentTime = time;
        state.updateLyricHighlightDom(time, true);
      }, firstLyricTime > 0 ? 0.5 : 0);
      if (firstLyricTime > 0) {
        const highlight = await page.evaluate(() => {
          const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
          return { end: state.preludeEndTime, starts: state.prefaceLineTimes,
            sung: [...document.querySelectorAll(".song-detail-credit")].map(line => line.querySelectorAll(".is-sung").length) };
        });
        assert.ok(highlight.sung.at(-1) > 0,
          `不足一秒时制作信息应快速高亮到最后一行: ${JSON.stringify(highlight)}`);
      }
      await page.evaluate(time => {
        const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
        state.currentTime = time;
        state.updateLyricHighlightDom(time, true);
      }, firstLyricTime);
      await page.waitForTimeout(50);
      assert.equal(await page.locator(".lyric-line.is-active").count(), 1, "制作信息不能推迟首句歌词");
      assert.equal(await page.locator(".song-detail-song-info .is-sung").count(), 0,
        "开唱后制作信息应停止高亮");
      for (const width of [1600, 760]) {
        await page.setViewportSize({ width, height: 803 });
        await page.screenshot({ path: path.join(output, `lyrics-short-preface-${firstLyricTime}-${width}.png`) });
      }
    }
    console.log(JSON.stringify(snapshots.map(({time, preface, lines}) => ({time, preface: !!preface, lines}))));
    assert.deepEqual(failures, []);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
