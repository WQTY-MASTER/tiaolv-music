const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function run() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    let mode = "mixed";
    let refreshed = 0;
    const imageUrl = "https://y.gtimg.cn/music/photo_new/T002R300x300M000002GQ6WM3Q96hQ.jpg";
    const makePlaylist = (id, title, recommendationSource, recommendationReason) => ({
      id, title, subtitle: "Creator", count: 20, imageUrl, recommendationSource, recommendationReason
    });
    const mixed = [
      makePlaylist("qq:9001", "Account playlist", "qq-personal"),
      makePlaylist("qq:9002", "Listening playlist", "local-listening", "鸣潮先约电台"),
      makePlaylist("qq:9003", "Hot playlist", "hot")
    ];
    await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):(?:17890\/|\d+\/backend\/)/, async route => {
      const url = route.request().url();
      if (url.includes("featured-playlists")) {
        if (url.includes("refresh=true")) refreshed += 1;
        if (mode === "failure") return route.fulfill({ status: 503, json: { message: "Unavailable" } });
        return route.fulfill({ json: mode === "mixed" ? mixed : [mixed[2]] });
      }
      if (url.includes("/auth/accounts")) return route.fulfill({ json: [{ provider: "qq", userId: "200", nickname: "Test" }] });
      return route.fulfill({ json: url.includes("health") ? { ok: true } : [] });
    });
    await page.addInitScript(() => localStorage.setItem("tiaolv-music-onboarding-version", "1"));
    await page.goto(process.env.LYRICS_TEST_URL || "http://127.0.0.1:5173");
    await page.locator(".app-shell").waitFor();
    await page.waitForFunction(() => {
      const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
      return state.localLibraryHydrated && state.homepageState === "success"
        && state.backendStatus === "已连接";
    });
    await page.evaluate(async () => {
      const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
      state.appMode = "streaming";
      state.streamingSource = "qq";
      state.accounts = [{ provider: "qq", userId: "200", nickname: "Test" }];
      state.showSongDetail = false;
      state.view = "home";
      await state.loadStreamingHomeData("qq");
    });
    const section = page.locator(".qq-curated");
    await section.waitFor();
    await assertPlaylists(section, ["Account playlist", "Listening playlist", "Hot playlist"]);
    const output = path.resolve(__dirname, "../.playwright-cli");
    fs.mkdirSync(output, { recursive: true });
    for (const width of [1600, 760]) {
      await page.setViewportSize({ width, height: 900 });
      await section.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `qq-personal-playlists-${width}.png`) });
      const overflow = await section.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll("button, strong, small")].some(child => {
          const rect = child.getBoundingClientRect();
          return rect.right > bounds.right + 1 || rect.left < bounds.left - 1;
        });
      });
      assert.equal(overflow, false, "Playlist text and controls must stay within the section");
    }
    mode = "hot";
    await section.getByRole("button", { name: "刷新推荐歌单" }).click();
    await section.getByRole("heading", { name: /热门精选歌单/ }).waitFor();
    await assertPlaylists(section, ["Hot playlist"]);
    assert.equal(refreshed, 1);
    mode = "failure";
    await section.getByRole("button", { name: "刷新推荐歌单" }).click();
    await section.getByRole("alert").waitFor();
    await assertPlaylists(section, ["Hot playlist"]);
    assert.match(await section.getByRole("alert").textContent(), /已保留上次结果/);
    console.log("QQ playlists without source captions, scoped refresh, failure retention and responsive layout passed");
  } finally {
    await browser.close();
  }
}

async function assertPlaylists(section, expected) {
  await section.locator(".qq-curated-item strong").first().waitFor();
  assert.deepEqual(await section.locator(".qq-curated-item strong").allTextContents(), expected);
  assert.equal(await section.locator(".qq-curated-item small").count(), 0);
  assert.equal(await section.locator(".qq-curated-source").count(), 0);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
