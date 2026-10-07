const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fixture = require("./fixtures/qrc-preface.cjs");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 803 } });
    await page.route("http://127.0.0.1:17890/**", route => route.fulfill({ json: route.request().url().includes("health") ? { ok: true } : [] }));
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
            size: parseFloat(getComputedStyle(original).fontSize),
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
        if (line.size !== (index === active ? 27.5 : 22)) failures.push(`wrong enlarged line ${index} at ${time}`);
        if (line.translationSize !== 22) failures.push(`translation enlarged at ${time}`);
      });
    }
    const output = path.resolve(__dirname, "../.playwright-cli"); fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "lyrics-qrc-preface.png") });
    console.log(JSON.stringify(snapshots.map(({time, preface, lines}) => ({time, preface: !!preface, lines}))));
    assert.deepEqual(failures, []);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
