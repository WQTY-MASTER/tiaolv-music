const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const coverFile = path.resolve(__dirname, "../resources/app-icon.png");
const coverBytes = fs.readFileSync(coverFile);

const account = (provider, userId) => ({ provider, userId, nickname: `Account ${userId}` });
const playlist = (provider, owner, kind) => ({
  id: `${provider}:${owner}-${kind}`, title: `${owner} ${kind}`, subtitle: "Fixture",
  count: 3, createdByAccount: kind !== "collected", deletable: kind === "created",
  favorite: kind === "likes",
  imageUrl: `http://127.0.0.1/fixture-covers/${provider}-${owner}-${kind}.png?original=1`
});
const tracks = provider => [1, 2, 3].map(id => ({
  id: `${provider}:${id}`, title: `Track ${id}`, artist: "Artist", album: "Album",
  duration: 180, source: provider,
  coverUrl: `http://127.0.0.1/fixture-covers/${provider}-track-${id}.png?original=1`
}));

async function stateCall(page, method, args = []) {
  return page.evaluate(async ({ method, args }) => {
    const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
    return state[method](...args);
  }, { method, args });
}

async function run() {
  const { createServer } = await import("vite");
  const server = await createServer({
    configFile: path.resolve(__dirname, "../vite.web.config.ts"),
    server: { port: 0, strictPort: false }, logLevel: "error"
  });
  await server.listen();
  let browser;
  const output = path.resolve(__dirname, "../.playwright-cli");
  fs.mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const owners = { qq: "A", netease: "A" };
    const lists = Object.fromEntries(["qq", "netease"].map(provider => [provider, {
      A: [playlist(provider, "A", "likes"), playlist(provider, "A", "created"), playlist(provider, "A", "collected")],
      B: [playlist(provider, "B", "likes"), playlist(provider, "B", "created"), playlist(provider, "B", "collected")]
    }]));
    const writes = [];
    const savedTracks = new Map();
    const savedFavorites = Object.fromEntries(["qq", "netease"].map(provider => [provider, tracks(provider)]));
    let rejectTargets = false;
    let rejectUnsubscribe = false;
    let rejectTrackWrite = false;
    let rejectRemovalId = "";
    let rejectFavoriteId = "";
    let holdNextList;
    let releaseList;
    await page.route(/^https?:\/\//, async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.abort();
      if (url.pathname.startsWith("/fixture-covers/")) return route.fulfill({ contentType: "image/png", body: coverBytes });
      if (!url.pathname.startsWith("/backend/")) return route.continue();
      const endpoint = url.pathname.replace(/^\/backend/, "");
      const method = route.request().method();
      const provider = endpoint.split("/")[2];
      const owner = owners[provider];
      if (method !== "GET") writes.push({ endpoint, query: url.search, method, body: route.request().postDataJSON() });
      if (endpoint === "/auth/accounts") return route.fulfill({ json: [account("qq", "A"), account("netease", "A")] });
      if (endpoint === `/account/${provider}/profile`) {
        return route.fulfill({ json: { ...account(provider, owner), follows: 0, followers: 0, signature: "" } });
      }
      if (endpoint === `/account/${provider}/favorites`) {
        if (method === "POST") {
          const track = route.request().postDataJSON();
          if (track.id === rejectFavoriteId) return route.fulfill({ status: 502, json: { message: "平台喜欢操作被拒绝，请稍后重试。" } });
          savedFavorites[provider] = [...savedFavorites[provider].filter(item => item.id !== track.id), track];
          return route.fulfill({ json: { ok: true } });
        }
        return route.fulfill({ json: savedFavorites[provider] });
      }
      if (endpoint.startsWith(`/account/${provider}/favorites/`) && method === "DELETE") {
        const id = decodeURIComponent(endpoint.split("/")[4]);
        if (id === rejectFavoriteId) return route.fulfill({ status: 502, json: { message: "平台喜欢操作被拒绝，请稍后重试。" } });
        savedFavorites[provider] = savedFavorites[provider].filter(item => item.id !== id);
        return route.fulfill({ json: { ok: true } });
      }
      if (endpoint === `/account/${provider}/playlists`) {
        if (method === "POST") {
          const created = { ...playlist(provider, owner, "created"), id: `${provider}:${owner}-new`, title: route.request().postDataJSON().name, count: 0 };
          lists[provider][owner].push(created);
          savedTracks.set(created.id, []);
          return route.fulfill({ json: created });
        }
        const snapshot = structuredClone(lists[provider][owner]);
        if (holdNextList === provider) {
          holdNextList = null;
          await new Promise(resolve => { releaseList = resolve; });
        }
        if (rejectTargets && url.searchParams.has("refresh")) return route.fulfill({ status: 503, json: { message: "Target load rejected" } });
        return route.fulfill({ json: snapshot });
      }
      if (/\/playlists\/[^/]+\/subscription$/.test(endpoint)) {
        if (rejectUnsubscribe) return route.fulfill({ status: 502, json: { message: "Unsubscribe rejected" } });
        const id = decodeURIComponent(endpoint.split("/")[4]);
        lists[provider][owner] = lists[provider][owner].filter(item => item.id !== id);
        return route.fulfill({ json: { synced: true } });
      }
      if (/\/playlists\/[^/]+\/tracks\/remove-batch$/.test(endpoint) && method === "POST") {
        const id = decodeURIComponent(endpoint.split("/")[4]);
        const { trackIds, expectedAccountId } = route.request().postDataJSON();
        assert.equal(expectedAccountId, owner);
        const succeeded = trackIds.filter(trackId => trackId !== rejectRemovalId);
        const failed = trackIds.filter(trackId => trackId === rejectRemovalId);
        savedTracks.set(id, (savedTracks.get(id) || tracks(provider)).filter(track => !succeeded.includes(track.id)));
        const target = lists[provider][owner].find(item => item.id === id);
        if (target) target.count = savedTracks.get(id).length;
        return route.fulfill({ json: { succeeded, failed, errors: Object.fromEntries(failed.map(trackId => [trackId, "平台返回错误码 80105，移出失败，请稍后重试。"])) } });
      }
      if (/\/playlists\/[^/]+\/tracks\/[^/]+$/.test(endpoint) && method === "DELETE") {
        const id = decodeURIComponent(endpoint.split("/")[4]);
        const trackId = decodeURIComponent(endpoint.split("/")[6]);
        if (trackId === rejectRemovalId) return route.fulfill({ status: 502, json: {
          code: "PLAYLIST_TRACK_REMOVE_FAILED", message: "平台返回错误码 80105，移出失败，请稍后重试。"
        } });
        savedTracks.set(id, (savedTracks.get(id) || tracks(provider)).filter(track => track.id !== trackId));
        const target = lists[provider][owner].find(item => item.id === id);
        if (target) target.count = savedTracks.get(id).length;
        return route.fulfill({ json: { ok: true } });
      }
      if (/\/playlists\/[^/]+\/tracks$/.test(endpoint)) {
        if (rejectTrackWrite) return route.fulfill({ status: 502, json: {
          code: "PLAYLIST_TRACK_WRITE_FAILED", message: "平台返回错误码 80105，请稍后重试。"
        } });
        const id = decodeURIComponent(endpoint.split("/")[4]);
        const ids = new Set([...(savedTracks.get(id) || []).map(track => track.id), ...route.request().postDataJSON().trackIds]);
        savedTracks.set(id, tracks(provider).filter(track => ids.has(track.id)));
        const target = lists[provider][owner].find(item => item.id === id);
        if (target) target.count = savedTracks.get(id).length;
        return route.fulfill({ json: { ok: true } });
      }
      if (/\/playlists\/[^/]+$/.test(endpoint) && method === "DELETE") {
        const id = decodeURIComponent(endpoint.split("/")[4]);
        lists[provider][owner] = lists[provider][owner].filter(item => item.id !== id);
        return route.fulfill({ json: { ok: true } });
      }
      if (/\/playlists\/[^/]+$/.test(endpoint)) {
        const id = decodeURIComponent(endpoint.split("/")[4]);
        return route.fulfill({ json: savedTracks.get(id) || tracks(provider) });
      }
      if (endpoint.includes("health")) return route.fulfill({ json: { ok: true } });
      return route.fulfill({ json: [] });
    });
    await page.addInitScript(() => localStorage.setItem("tiaolv-music-onboarding-version", "1"));
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => {
      const state = document.querySelector(".app-shell")?.__vueParentComponent.setupState;
      return state?.localLibraryHydrated && state.backendStatus === "已连接";
    });
    await page.evaluate(() => {
      const state = document.querySelector(".app-shell").__vueParentComponent.setupState;
      state.appMode = "streaming";
      state.showSongDetail = false;
    });
    const picker = page.getByRole("dialog", { name: "加入歌单", exact: true });
    const aggregatePicker = page.getByRole("dialog", { name: "加入聚合歌单", exact: true });

    for (const provider of ["netease", "qq"]) {
      await stateCall(page, "selectStreamingSource", [provider]);
      await stateCall(page, "selectView", ["streaming-library"]);
      await stateCall(page, "loadAccountContent");
      await page.locator(".account-playlist-item").filter({ hasText: "A created" }).waitFor();
      await page.evaluate(() => { window.confirm = () => { throw new Error("Native confirm must not interrupt playlist input"); }; });
      const removable = page.locator(".account-playlist-item").filter({ hasText: "A created" });
      await removable.click({ button: "right" });
      await page.getByRole("menuitem", { name: "删除歌单", exact: true }).click();
      const deleteDialog = page.getByRole("dialog", { name: "删除歌单", exact: true });
      await deleteDialog.getByRole("button", { name: "取消", exact: true }).click();
      assert.equal(await removable.count(), 1, "Cancel retains the playlist");
      await removable.click({ button: "right" });
      await page.getByRole("menuitem", { name: "删除歌单", exact: true }).click();
      await deleteDialog.getByRole("button", { name: "删除", exact: true }).click();
      await removable.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "创建歌单", exact: true }).click();
      const createDialog = page.getByRole("dialog", { name: "创建歌单", exact: true });
      const nameInput = createDialog.getByPlaceholder("请输入歌单名称");
      await page.waitForFunction(() => document.activeElement?.getAttribute("placeholder") === "请输入歌单名称");
      await page.keyboard.type(`${provider} new playlist`);
      assert.equal(await nameInput.inputValue(), `${provider} new playlist`, "Real keyboard input works after deleting a playlist");
      await createDialog.getByRole("button", { name: "确认", exact: true }).click();
      await createDialog.waitFor({ state: "hidden" });
      lists[provider].A.push(playlist(provider, "A", "created"));
      await stateCall(page, "openAccountFavorites");
      const row = page.locator(".daily-detail-row").first();
      await row.waitFor();
      await row.click({ button: "right" });
      await page.getByRole("menuitem", { name: "添加到歌单", exact: true }).click();
      await picker.locator(".track-playlist-target-list").waitFor();
      assert.deepEqual((await picker.locator("strong").allTextContents()).sort(), ["A created", `${provider} new playlist`].sort());
      const platformImage = picker.getByRole("button", { name: /^A created/ }).locator("img");
      assert.equal(await platformImage.count(), 1, "Account playlist picker must display its real platform cover");
      assert.equal(await platformImage.getAttribute("src"), playlist(provider, "A", "created").imageUrl);
      await platformImage.evaluate(image => image.decode());
      assert.equal(await platformImage.evaluate(image => image.naturalWidth), coverBytes.readUInt32BE(16), "Use the original image, not a recompressed thumbnail");
      await picker.getByRole("button", { name: new RegExp(`${provider} new playlist`) }).click();
      await picker.waitFor({ state: "hidden" });
      await page.locator(".search-toast").filter({ hasText: `已将 1 首歌曲加入「${provider} new playlist」` }).waitFor();
      const add = writes.find(item => item.endpoint === `/account/${provider}/playlists/${provider}%3AA-new/tracks`);
      assert.ok(add, "Online track must use the current account API, not the local library API");
      assert.deepEqual(add.body.trackIds, [`${provider}:1`]);

      await page.getByRole("button", { name: "批量操作", exact: true }).click();
      await page.getByLabel("全选当前列表").check();
      await row.click({ button: "right" });
      await page.getByRole("menuitem", { name: "添加到歌单（3 首）", exact: true }).click();
      rejectTrackWrite = true;
      await picker.getByRole("button", { name: new RegExp(`${provider} new playlist`) }).click();
      await picker.getByRole("alert").filter({ hasText: "平台返回错误码 80105" }).waitFor();
      assert.equal(savedTracks.get(`${provider}:A-new`).length, 1, "Rejected writes do not change the target");
      await page.waitForFunction(() => [...document.querySelectorAll('.daily-detail-row input[type="checkbox"]')].every(input => input.checked));
      assert.equal(await page.locator(".search-toast").filter({ hasText: "已将 3 首歌曲" }).count(), 0, "Failed writes cannot show success");
      rejectTrackWrite = false;
      await picker.getByRole("button", { name: new RegExp(`${provider} new playlist`) }).click();
      await picker.waitFor({ state: "hidden" });
      await page.locator(".search-toast").filter({ hasText: `已将 3 首歌曲加入「${provider} new playlist」` }).waitFor();
      const batchAdd = writes.filter(item => item.endpoint === `/account/${provider}/playlists/${provider}%3AA-new/tracks`).at(-1);
      assert.deepEqual(batchAdd.body.trackIds, tracks(provider).map(track => track.id), "Right-click sends all selected songs to the account playlist");
      assert.equal(savedTracks.get(`${provider}:A-new`).length, 3);
      await page.getByLabel("全选当前列表").check();
      await stateCall(page, "handleCreateAggregatePlaylist", [`${provider} aggregate`]);
      await stateCall(page, "openTrackPlaylistPicker", [tracks(provider)[0], "aggregate"]);
      await aggregatePicker.getByRole("button", { name: new RegExp(`${provider} aggregate`) }).click();
      assert.equal(await page.locator(".daily-track-management").getByRole("button", { name: "加入聚合歌单", exact: true }).count(), 0);
      await row.click({ button: "right" });
      await page.getByRole("menuitem", { name: "添加到聚合歌单（3 首）", exact: true }).click();
      const automaticAggregateImage = aggregatePicker.getByRole("button", { name: new RegExp(`${provider} aggregate`) }).locator("img");
      assert.equal(await automaticAggregateImage.count(), 1, "Aggregate picker shares the overview's automatic cover");
      assert.equal(await automaticAggregateImage.getAttribute("src"), tracks(provider)[0].coverUrl);
      await automaticAggregateImage.evaluate(image => image.decode());
      await aggregatePicker.getByRole("button", { name: "关闭", exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('.daily-detail-row input[type="checkbox"]')].every(input => input.checked && !input.disabled));
      await row.click({ button: "right" });
      await page.getByRole("menuitem", { name: "添加到聚合歌单（3 首）", exact: true }).click();
      await page.screenshot({ path: path.join(output, `account-playlist-batch-${provider}.png`) });
      await aggregatePicker.getByRole("button", { name: new RegExp(`${provider} aggregate`) }).click();
      const saved = await page.evaluate(name => JSON.parse(localStorage.getItem("tiaolv-music-aggregate-playlists")).find(item => item.name === name), `${provider} aggregate`);
      assert.equal(saved.tracks.length, 3, "Batch retains all three tracks and skips the pre-existing duplicate");
      await page.locator(".search-toast").filter({ hasText: "已加入 2 个音源" }).filter({ hasText: "跳过 1 个重复音源" }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.daily-detail-row input[type="checkbox"]')].every(input => !input.checked && !input.disabled));

      await page.evaluate(() => { document.querySelector('.app-shell').__vueParentComponent.setupState.appMode = "local"; });
      await stateCall(page, "selectView", ["aggregate"]);
      await page.locator(".aggregate-playlist-card").filter({ hasText: `${provider} aggregate` }).click();
      const choosingCover = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "设置聚合歌单封面", exact: true }).click();
      await (await choosingCover).setFiles(coverFile);
      await page.waitForFunction(name => JSON.parse(localStorage.getItem("tiaolv-music-aggregate-playlists")).find(item => item.name === name)?.coverUrl?.startsWith("data:"), `${provider} aggregate`);
      const customCover = await page.evaluate(name => JSON.parse(localStorage.getItem("tiaolv-music-aggregate-playlists")).find(item => item.name === name).coverUrl, `${provider} aggregate`);
      assert.deepEqual(Buffer.from(customCover.split(",")[1], "base64"), coverBytes, "Browser cover selection retains every original byte");
      await stateCall(page, "openTrackPlaylistPicker", [{ ...tracks(provider)[0], id: `${provider}:new-cover-track`, title: "New first track" }, "aggregate"]);
      const customAggregateImage = aggregatePicker.getByRole("button", { name: new RegExp(`${provider} aggregate`) }).locator("img");
      assert.equal(await customAggregateImage.getAttribute("src"), customCover, "Manual cover takes priority in the picker");
      await customAggregateImage.evaluate(image => image.decode());
      await page.screenshot({ path: path.join(output, `playlist-picker-custom-cover-${provider}.png`) });
      await aggregatePicker.getByRole("button", { name: new RegExp(`${provider} aggregate`) }).click();
      await stateCall(page, "openTrackPlaylistPicker", [tracks(provider)[0], "aggregate"]);
      assert.equal(await customAggregateImage.getAttribute("src"), customCover, "A new first song must not replace the manual cover");
      await aggregatePicker.getByRole("button", { name: "关闭", exact: true }).click();
      await page.evaluate(() => { document.querySelector('.app-shell').__vueParentComponent.setupState.appMode = "streaming"; });

      await stateCall(page, "selectView", ["streaming-library"]);
      await stateCall(page, "loadAccountContent");
      await page.locator(".account-playlist-item").filter({ hasText: "A created" }).click();
      savedFavorites[provider] = [tracks(provider)[0]];
      await stateCall(page, "refreshStreamingPlaylist");
      await stateCall(page, "loadAccountContent");
      await stateCall(page, "refreshStreamingPlaylist");
      await page.getByRole("button", { name: "批量操作", exact: true }).click();
      await page.getByLabel("全选当前列表").check();
      const favoriteWritesBefore = writes.length;
      const batchStatus = page.locator('.daily-track-management').getByRole('status');
      rejectFavoriteId = `${provider}:3`;
      await page.locator(".daily-detail-row").first().click({ button: "right" });
      const selection = await page.evaluate(() => {
        const state = document.querySelector('.app-shell').__vueParentComponent.setupState;
        return { selected: state.localTrackContextMenu.tracks.map(track => ({ id: track.id, liked: track.liked })), favorites: state.accountFavoriteTracks.map(track => track.id) };
      });
      assert.match(await page.locator('.local-track-context-menu').innerText(), /^喜欢选中的 3 首$/m, JSON.stringify(selection));
      assert.equal(await page.getByRole("menuitem", { name: "播放此歌曲", exact: true }).count(), 1);
      assert.equal(await page.getByRole("menuitem", { name: "此歌曲下一首播放", exact: true }).count(), 1);
      await page.screenshot({ path: path.join(output, `playlist-context-count-${provider}.png`) });
      await stateCall(page, "closeLocalTrackContextMenu");
      await page.setViewportSize({ width: 920, height: 720 });
      await page.locator(".daily-detail-row").first().click({ button: "right" });
      assert.equal(await page.locator('.local-track-context-menu').evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < 0 || bounds.right > innerWidth || bounds.bottom > innerHeight
          || [...element.querySelectorAll('button span')].some(label => label.scrollWidth > label.clientWidth);
      }), false, "Batch labels fit the menu and viewport without clipping");
      await page.screenshot({ path: path.join(output, `playlist-context-count-compact-${provider}.png`) });
      await page.getByRole("menuitem", { name: "喜欢选中的 3 首", exact: true }).click();
      await page.setViewportSize({ width: 1440, height: 900 });
      await batchStatus.filter({ hasText: "成功 2 首，失败 1 首：平台喜欢操作被拒绝" }).waitFor();
      const favoritePosts = writes.slice(favoriteWritesBefore).filter(item => item.endpoint === `/account/${provider}/favorites` && item.method === "POST");
      assert.deepEqual(favoritePosts.map(item => item.body.id), [`${provider}:2`, `${provider}:3`], "Mixed selection adds only missing favorites, regardless of clicked row");
      assert.equal(await page.locator('.daily-detail-row input:checked').count(), 1);
      assert.equal(await page.locator(".daily-detail-row").count(), 3);
      assert.equal(await page.locator(".daily-track-management").getByRole("button", { name: "添加喜欢", exact: true }).count(), 0);
      rejectFavoriteId = "";
      await page.locator(".daily-detail-row").nth(2).click({ button: "right" });
      await page.getByRole("menuitem", { name: "喜欢选中的 1 首", exact: true }).click();
      await batchStatus.filter({ hasText: "已喜欢 1 首歌曲" }).waitFor();
      assert.equal(savedFavorites[provider].length, 3);
      await page.getByLabel("全选当前列表").check();
      await page.screenshot({ path: path.join(output, `playlist-context-favorites-${provider}.png`) });
      rejectFavoriteId = `${provider}:1`;
      await page.locator(".daily-detail-row").first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "取消喜欢选中的 3 首", exact: true }).click();
      await batchStatus.filter({ hasText: "成功 2 首，失败 1 首：平台喜欢操作被拒绝" }).waitFor();
      assert.equal(savedFavorites[provider].length, 1);
      assert.equal(await page.locator(".daily-detail-row").count(), 3, "Unliking must not remove songs from the normal playlist");
      assert.equal(await page.locator('.daily-detail-row input:checked').count(), 1);
      rejectFavoriteId = "";
      await page.locator(".daily-detail-row").first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "取消喜欢选中的 1 首", exact: true }).click();
      await batchStatus.filter({ hasText: "已取消喜欢 1 首歌曲" }).waitFor();
      assert.equal(savedFavorites[provider].length, 0);
      assert.equal(await page.locator(".daily-detail-row").count(), 3);
      assert.equal(await page.locator('.daily-detail-row input:checked').count(), 0);
      await page.getByLabel("全选当前列表").check();
      await page.locator(".daily-detail-row").first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "添加到聚合歌单（3 首）", exact: true }).click();
      await aggregatePicker.getByRole("button", { name: new RegExp(`${provider} aggregate`) }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('.daily-detail-row input[type="checkbox"]')].every(input => !input.checked && !input.disabled));
      await page.locator('.daily-detail-row input[type="checkbox"]').nth(2).check();
      const removalWritesBefore = writes.filter(item => item.endpoint.endsWith("/remove-batch")).length;
      const removalDialog = page.getByRole("dialog", { name: "移出歌单", exact: true });
      await page.getByRole("button", { name: "移出歌单", exact: true }).click();
      await removalDialog.waitFor();
      assert.match(await removalDialog.innerText(), /从「A created」移出选中的 1 首歌曲/);
      assert.match(await removalDialog.innerText(), /此操作会同步到/);
      assert.equal(writes.filter(item => item.endpoint.endsWith("/remove-batch")).length, removalWritesBefore, "Opening confirmation cannot remove tracks");
      await page.waitForFunction(() => document.activeElement?.textContent === "取消");
      await removalDialog.getByRole("button", { name: "取消", exact: true }).click();
      assert.equal(await page.locator(".daily-detail-row").count(), 3);
      assert.equal(await page.locator('.daily-detail-row input:checked').count(), 1, "Cancel preserves selected tracks");
      await page.getByRole("button", { name: "移出歌单", exact: true }).click();
      await removalDialog.waitFor();
      await page.keyboard.press("Escape");
      await removalDialog.waitFor({ state: "hidden" });
      assert.equal(writes.filter(item => item.endpoint.endsWith("/remove-batch")).length, removalWritesBefore, "Cancel and Escape send no removal requests");
      await page.getByRole("button", { name: "移出歌单", exact: true }).click();
      await removalDialog.getByRole("button", { name: "移出", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "成功 1 首" }).waitFor();
      assert.equal(await page.locator(".daily-detail-row").count(), 2);
      assert.equal(await page.evaluate(() => document.querySelector('.app-shell').__vueParentComponent.setupState.selectedPlaylist.imageUrl), playlist(provider, "A", "created").imageUrl, "Removing the first song cannot replace the platform cover");
      await page.getByLabel("全选当前列表").check();
      rejectRemovalId = `${provider}:1`;
      await page.getByRole("button", { name: "移出歌单", exact: true }).click();
      assert.match(await removalDialog.innerText(), /移出选中的 2 首歌曲/);
      await page.screenshot({ path: path.join(output, `playlist-removal-confirm-${provider}.png`) });
      await removalDialog.getByRole("button", { name: "移出", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "成功 1 首，失败 1 首：平台返回错误码 80105" }).waitFor();
      assert.equal(await page.locator(".daily-detail-row").count(), 1);
      assert.equal(await page.locator('.daily-detail-row input:checked').count(), 1, "Failed removal preserves the row and selection");
      assert.equal(savedTracks.get(`${provider}:A-created`).length, 1);
      rejectRemovalId = "";
      await page.getByRole("button", { name: "移出歌单", exact: true }).click();
      assert.match(await removalDialog.innerText(), /移出选中的 1 首歌曲/);
      await removalDialog.getByRole("button", { name: "移出", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "成功 1 首" }).waitFor();
      await page.locator(".daily-detail-row").waitFor({ state: "hidden" });
      assert.deepEqual(savedTracks.get(`${provider}:A-created`), []);
      const removalRequests = writes.filter(item => item.endpoint === `/account/${provider}/playlists/${provider}%3AA-created/tracks/remove-batch`);
      assert.deepEqual(removalRequests.map(item => item.body.trackIds.length), [1, 2, 1], "Explicit batch results retry only the failed selection");
      await stateCall(page, "selectView", ["streaming-library"]);
      await stateCall(page, "loadAccountContent");
      const collected = page.locator(".account-playlist-item").filter({ hasText: "A collected" });
      rejectUnsubscribe = true;
      await collected.click({ button: "right" });
      await page.getByRole("menuitem", { name: "取消收藏", exact: true }).click();
      await page.waitForFunction(() => document.querySelector(".app-shell").__vueParentComponent.setupState.scanError.includes("Unsubscribe rejected"));
      assert.equal(await collected.count(), 1, "Rejected unsubscribe must retain the playlist");
      rejectUnsubscribe = false;
      await collected.click({ button: "right" });
      await page.getByRole("menuitem", { name: "取消收藏", exact: true }).click();
      await collected.waitFor({ state: "hidden" });
      assert.ok(writes.some(item => item.endpoint.includes(`/account/${provider}/playlists/`) && item.query === "?subscribed=false"));
      await page.waitForFunction(() => !document.querySelector(".app-shell").__vueParentComponent.setupState.playlistCollectionPending);

      // Delay an old account response while a different account signs in.
      holdNextList = provider;
      await stateCall(page, "openTrackPlaylistPicker", [tracks(provider)[0], "regular"]);
      await picker.getByRole("status").waitFor();
      assert.ok(releaseList, "The old account request must be held before switching");
      owners[provider] = "B";
      await stateCall(page, "handleAuthenticated", [account(provider, "B")]);
      releaseList();
      releaseList = null;
      await stateCall(page, "selectView", ["streaming-library"]);
      await stateCall(page, "loadAccountContent");
      await page.locator(".account-playlist-item").filter({ hasText: "B created" }).waitFor();
      assert.equal(await page.locator(".account-playlist-item").filter({ hasText: /A (created|collected)|new playlist/ }).count(), 0);
      assert.equal(await picker.count(), 0, "Account switch closes an old account picker");
      const oldHistory = await page.evaluate(() => document.querySelector(".app-shell").__vueParentComponent.setupState.navigationHistory.some(entry => entry.playlist?.accountScoped));
      assert.equal(oldHistory, false);

      rejectTargets = true;
      await stateCall(page, "openTrackPlaylistPicker", [tracks(provider)[0], "regular"]);
      await picker.getByRole("alert").waitFor();
      assert.match(await picker.getByRole("alert").textContent(), /Target load rejected/);
      rejectTargets = false;
      await picker.getByRole("button", { name: "重试", exact: true }).click();
      await picker.getByRole("button", { name: /B created/ }).waitFor();
      await page.setViewportSize({ width: 920, height: 720 });
      await page.screenshot({ path: path.join(output, `account-playlist-targets-${provider}.png`) });
      const clipped = await picker.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll("button, strong")].some(child => {
          const rect = child.getBoundingClientRect();
          return rect.right > bounds.right + 1 || rect.left < bounds.left - 1;
        });
      });
      assert.equal(clipped, false);
      await picker.getByRole("button", { name: "关闭", exact: true }).click();
      await page.setViewportSize({ width: 1440, height: 900 });
      await stateCall(page, "handleProviderLogout", [provider]);
      assert.equal(await page.locator(".account-playlist-item").count(), 0, "Logout clears private account playlists");
    }
    assert.deepEqual(errors, [], "No renderer exceptions");
    assert.ok(writes.every(item => !item.endpoint.startsWith("/library/favorites")), "No local favorite fallback for online writes");
    assert.ok(writes.every(item => !(item.method === "DELETE" && /\/tracks\/[^/]+$/.test(item.endpoint))), "Playlist removals use verified batch results");
    console.log("Both providers: count-labeled context actions, removal confirmation/cancel/Escape, mixed/all-liked favorites, refusal/retry, playlist add/removal, aggregate batch, unsubscribe and account switch passed (isolated fixtures only)");
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
