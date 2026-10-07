const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

function silence(seconds = 60) {
  const samples = 8000 * seconds;
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF"); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  return data;
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 803 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let failOnline = false;
    let delayOnline = false;
    let previewOnly = false;
    let searchCount = 0;
    await page.route("http://127.0.0.1:17890/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/audio")) {
        const online = url.pathname.includes("catalog");
        if (online && delayOnline) await new Promise(resolve => setTimeout(resolve, 1000));
        const body = silence(online && previewOnly ? 30 : 60);
        const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
        const start = range ? Number(range[1]) : 0;
        const end = range?.[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
        await route.fulfill(online && failOnline ? { status: 403, body: "Unavailable" } : {
          status: range ? 206 : 200, contentType: "audio/wav", body: body.subarray(start, end + 1),
          headers: { "Accept-Ranges": "bytes", ...(range ? { "Content-Range": `bytes ${start}-${end}/${body.length}` } : {}) }
        });
      } else if (url.pathname.endsWith("cloudsearch")) {
        searchCount++;
        const provider = url.searchParams.get("provider");
        await route.fulfill({ json: { songs: [{ id: `${provider}:fixture`, source: provider, title: "Test Song", artist: "Test Artist", album: "Test Album", duration: 60 }], total: 1, hasMore: false } });
      } else await route.fulfill({ json: url.pathname.includes("health") ? { ok: true } : [] });
    });
    await page.addInitScript(() => localStorage.setItem("tiaolv-music-onboarding-version", "1"));
    await page.goto(process.env.LYRICS_TEST_URL || "http://127.0.0.1:5173");
    await page.locator(".app-shell").waitFor();
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
      const s = document.querySelector(".app-shell").__vueParentComponent.setupState;
      const track = { ...s.currentTrack, id: "local:fixture", source: "local", title: "Test Song", artist: "Test Artist", album: "Test Album", duration: 60,
        audioUrl: "/local/fixture/audio", codec: "FLAC", lyrics: "[00:00]Original lyrics", lyricsTranslation: "[00:00]Translation", liked: true };
      s.volume = 0;
      s.appMode = "local";
      s.remoteTracks = [track];
      s.currentTrack = track;
      s.loadTrackLyrics(track);
      s.prepareAudioSource(track);
      s.showSongDetail = true;
    });
    await page.waitForFunction(() => document.querySelector("audio").readyState >= 1);
    await page.evaluate(() => { document.querySelector("audio").currentTime = 17; });
    await page.waitForFunction(() => !document.querySelector("audio").seeking && document.querySelector("audio").currentTime >= 17);
    await page.getByRole("button", { name: "音质", exact: true }).click();
    await page.getByRole("menuitemradio", { name: /Hi-Res优先/ }).waitFor();
    async function state() {
      return page.evaluate(() => {
        const s = document.querySelector(".app-shell").__vueParentComponent.setupState;
        const audio = document.querySelector("audio");
        return { id: s.currentTrack.id, audioUrl: s.currentTrack.audioUrl, lyrics: s.currentTrack.lyrics,
          liked: s.currentTrack.liked, time: audio.currentTime, paused: audio.paused,
          src: audio.src, selection: { ...s.localAudioSelection }, busy: s.localSourceBusy, notice: s.localSourceNotice };
      });
    }
    async function waitSwitch() {
      await page.waitForFunction(() => !document.querySelector(".app-shell").__vueParentComponent.setupState.localSourceBusy);
    }
    const original = await state();
    await page.getByRole("menuitemradio", { name: /Hi-Res优先/ }).click();
    await waitSwitch();
    let result = await state();
    assert.match(result.src, /netease.*quality=hires/);
    assert.equal(result.id, original.id);
    assert.equal(result.audioUrl, original.audioUrl);
    assert.equal(result.lyrics, original.lyrics);
    assert.equal(result.liked, true);
    assert.equal(result.paused, true);
    assert.ok(Math.abs(result.time - 17) < .2, JSON.stringify({ original, result }));
    await page.evaluate(() => document.querySelector(".app-shell").__vueParentComponent.setupState.togglePlayback());
    await page.waitForFunction(() => !document.querySelector("audio").paused);
    assert.match((await state()).src, /netease.*quality=hires/, "resume keeps the chosen online source");
    await page.getByRole("group", { name: "QQ 音乐", exact: true }).getByRole("menuitemradio", { name: /无损优先/ }).click();
    await waitSwitch();
    result = await state();
    assert.equal(result.selection.provider, "qq");
    assert.equal(result.paused, false);
    assert.ok(result.time >= 17 && result.time < 20);
    await page.getByRole("menuitemradio", { name: /本地音频/ }).click();
    await waitSwitch();
    assert.match((await state()).src, /local\/fixture\/audio/);
    failOnline = true;
    await page.getByRole("menuitemradio", { name: /Hi-Res优先/ }).click();
    await waitSwitch();
    result = await state();
    assert.equal(result.selection.provider, "local");
    assert.match(result.notice, /已恢复本地/);
    assert.equal(result.paused, false);
    failOnline = false;
    previewOnly = true;
    await page.getByRole("menuitemradio", { name: /Hi-Res优先/ }).click();
    await waitSwitch();
    assert.equal((await state()).selection.provider, "local", "a preview never replaces the full local audio");
    previewOnly = false;
    await page.getByRole("button", { name: "音质", exact: true }).click();
    await page.getByRole("button", { name: "音质", exact: true }).click();
    assert.equal(searchCount, 2, "reopening uses cached matches");
    const output = path.resolve(__dirname, "../.playwright-cli");
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "local-audio-sources-desktop.png") });
    await page.setViewportSize({ width: 900, height: 803 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(output, "local-audio-sources-narrow.png") });
    const bounds = await page.locator(".player-quality-panel").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 900);
    await page.getByRole("menuitemradio", { name: /Hi-Res优先/ }).click();
    await waitSwitch();
    await page.evaluate(() => {
      const s = document.querySelector(".app-shell").__vueParentComponent.setupState;
      s.beginSeek();
      s.previewSeek(50);
      document.querySelector("audio").dispatchEvent(new Event("error"));
    });
    await waitSwitch();
    result = await state();
    assert.equal(result.selection.provider, "local", "runtime failure while dragging restores local audio");
    assert.ok(result.time >= 30 && result.time < 31, "recovery consumes the requested seek position");
    assert.equal(result.paused, false);
    delayOnline = true;
    await page.getByRole("menuitemradio", { name: /Hi-Res优先/ }).click();
    assert.equal(await page.locator(".player-bar .progress-input").isDisabled(), true);
    const seeking = await page.evaluate(() => {
      const s = document.querySelector(".app-shell").__vueParentComponent.setupState;
      s.beginSeek(); s.previewSeek(80); s.seekPlayback(80);
      return s.isSeeking;
    });
    assert.equal(seeking, false, "seek commands cannot overwrite an in-flight source switch");
    await page.evaluate(async () => {
      const s = document.querySelector(".app-shell").__vueParentComponent.setupState;
      await s.playTrack({ ...s.currentTrack, id: "local:next", title: "Next Song", audioUrl: "/local/next/audio" });
    });
    await page.waitForTimeout(1200);
    result = await state();
    assert.equal(result.id, "local:next");
    assert.equal(result.selection.provider, "local");
    assert.match(result.src, /local\/next\/audio/);
    assert.equal(result.busy, false);
    assert.equal(await page.evaluate(() => document.querySelector(".app-shell").__vueParentComponent.setupState.localAudioGroups.length), 2, "an open menu refreshes after track changes");
    delayOnline = false;
    await page.evaluate(() => {
      const s = document.querySelector(".app-shell").__vueParentComponent.setupState;
      s.currentTrack = { ...s.currentTrack, id: "local:external", title: "Test Song", audioUrl: "/local/fixture/audio" };
      s.prepareAudioSource(s.currentTrack);
    });
    await page.getByRole("menuitemradio", { name: /Hi-Res优先/ }).click();
    await waitSwitch();
    assert.equal((await state()).selection.provider, "netease");
    await page.evaluate(() => {
      const s = document.querySelector(".app-shell").__vueParentComponent.setupState;
      s.currentTrack = { ...s.currentTrack, id: "local:scanned", title: "Scanned Song", audioUrl: "/local/next/audio" };
      s.prepareAudioSource(s.currentTrack);
    });
    result = await state();
    assert.equal(result.selection.provider, "local", "external current-track changes clear overrides");
    assert.match(result.src, /local\/next\/audio/);
    await page.evaluate(async () => {
      const s = document.querySelector(".app-shell").__vueParentComponent.setupState;
      await s.playTrack(s.currentTrack);
    });
    await page.waitForFunction(() => document.querySelector(".app-shell").__vueParentComponent.setupState.localAudioGroups.length === 2);
    assert.deepEqual(errors, []);
    console.log("Local -> NetEase -> QQ -> local, paused/playing state, progress, fallback, cache, cancellation and layout passed.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
