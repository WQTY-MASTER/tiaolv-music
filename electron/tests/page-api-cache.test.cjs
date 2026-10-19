const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");
const { registerHooks } = require("node:module");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./pageDataCache" && context.parentURL?.endsWith("/api.ts")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    if (specifier.endsWith("/backendRoutes")) return nextResolve(`${specifier}.ts`, context);
    if (specifier.endsWith("/diagnostics")) return nextResolve(`${specifier}.ts`, context);
    if (specifier.endsWith("/requestLifecycle")) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  }
});

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/api.ts"));

test("explicit playlist refresh reads newly created targets instead of the cached list", async () => {
  const api = await import(moduleUrl);
  const originalFetch = global.fetch;
  let calls = 0;
  api.invalidatePageDataCache();
  api.setPageDataCacheAccountScope("netease", "new-target-account");
  global.fetch = async () => new Response(JSON.stringify([{ id: `netease:${++calls}` }]), { status: 200 });
  try {
    assert.deepEqual(await api.loadAccountPlaylists("netease"), [{ id: "netease:1" }]);
    assert.deepEqual(await api.loadAccountPlaylists("netease", true), [{ id: "netease:2" }]);
    assert.equal(calls, 2);
  } finally { global.fetch = originalFetch; api.invalidatePageDataCache(); }
});

test("QQ cloud report updates captured recent cache without evicting favorites or crossing accounts", async () => {
  const api = await import(moduleUrl);
  const originalFetch = global.fetch;
  const requests = [];
  let finishReport;
  api.invalidatePageDataCache();
  global.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method || "GET", body: init.body });
    if (String(url).includes("recent-play-reports")) return new Promise(resolve => { finishReport = resolve; });
    return new Response(JSON.stringify([{ id: "cached" }]), { status: 200 });
  };
  try {
    api.setPageDataCacheAccountScope("qq", "200");
    await api.loadAccountFavorites("qq");
    await api.loadAccountRecentTracks("qq");
    const payload = { accountId: "200", trackId: "qq:mid1", sessionId: "cf3dac35-7a99-4706-9c69-11a4742486a1", listenedSeconds: 30, totalSeconds: 180 };
    const pending = api.reportQqRecentPlay(payload);
    api.setPageDataCacheAccountScope("qq", "300");
    finishReport(new Response(JSON.stringify({ ok: true, tracks: [{ id: "qq:mid1" }] }), { status: 200 }));
    await pending;
    assert.deepEqual(await api.loadAccountRecentTracks("qq"), [{ id: "cached" }]);
    api.setPageDataCacheAccountScope("qq", "200");
    assert.deepEqual(await api.loadAccountRecentTracks("qq"), [{ id: "qq:mid1" }]);
    await api.loadAccountFavorites("qq");
    assert.equal(requests.filter(r => r.url.includes("favorites")).length, 1);
    assert.equal(requests.filter(r => r.method === "POST").length, 1);
    assert.deepEqual(JSON.parse(requests.find(r => r.method === "POST").body), payload);
    await assert.rejects(api.reportQqRecentPlay({ ...payload, accountId: "300" }), /账号/);
  } finally { global.fetch = originalFetch; api.invalidatePageDataCache(); }
});

test("QQ rejected cloud reports do not invent recent history or retry", async () => {
  const api = await import(moduleUrl);
  const originalFetch = global.fetch;
  let writes = 0;
  api.invalidatePageDataCache(); api.setPageDataCacheAccountScope("qq", "200");
  global.fetch = async (_url, init = {}) => {
    if (init.method === "POST") { writes++; return new Response(JSON.stringify({ message: "QQ 音乐接口返回错误: 80105" }), { status: 502 }); }
    return new Response("[]", { status: 200 });
  };
  try {
    await api.loadAccountRecentTracks("qq");
    await assert.rejects(api.reportQqRecentPlay({ accountId: "200", trackId: "qq:mid1", sessionId: "cf3dac35-7a99-4706-9c69-11a4742486a1", listenedSeconds: 30, totalSeconds: 180 }), /80105/);
    assert.deepEqual(await api.loadAccountRecentTracks("qq"), []); assert.equal(writes, 1);
  } finally { global.fetch = originalFetch; api.invalidatePageDataCache(); }
});

test("local and online API calls preserve encoded queries and absent current-account responses", async () => {
  const api = await import(moduleUrl);
  const originalWindow = global.window;
  const originalFetch = global.fetch;
  const requests = [];
  let status = 204;
  global.window = { location: { protocol: "http:", origin: "http://127.0.0.1:5173" } };
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return String(url).endsWith("/auth/current")
      ? new Response(null, { status }) : new Response("[]", { status: 200 });
  };
  try {
    api.invalidatePageDataCache();
    await api.loadLibrary();
    await api.loadAccountFavorites("qq");
    assert.equal(await api.loadCurrentAccount(), null);
    status = 404;
    assert.equal(await api.loadCurrentAccount(), null);
    assert.equal(requests[0].url, "http://127.0.0.1:5173/backend/library/tracks");
    assert.equal(requests[1].url, "http://127.0.0.1:5173/backend/account/qq/favorites");
    assert.equal(api.loadCatalogAudio("qq:a/b", "hires"),
      "http://127.0.0.1:5173/backend/catalog/tracks/qq%3Aa%2Fb/audio?quality=hires");
    assert.ok(!JSON.stringify(requests).includes("X-Tiaolv-Token"));
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
    global.fetch = originalFetch;
    api.invalidatePageDataCache();
  }
});

test("web preview routes requests and local media through the same-origin proxy without credentials", async () => {
  const api = await import(moduleUrl);
  const originalWindow = global.window;
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response("[]", { status: 200 });
  };
  try {
    global.window = { location: { protocol: "http:", origin: "http://127.0.0.1:5173" } };
    api.invalidatePageDataCache();
    await api.loadLibrary();
    assert.equal(requests[0].url, "http://127.0.0.1:5173/backend/library/tracks");
    assert.ok(!JSON.stringify(requests).includes("X-Tiaolv-Token"));
    assert.equal(api.resolveBackendUrl("http://127.0.0.1:17890/library/tracks/abc/audio"),
      "http://127.0.0.1:5173/backend/library/tracks/abc/audio");
    assert.equal(api.resolveBackendUrl("https://y.gtimg.cn/cover.jpg"), "https://y.gtimg.cn/cover.jpg");
    global.window.listenMusic = {};
    assert.equal(api.resolveBackendUrl("/library/tracks/abc/audio"),
      "http://127.0.0.1:17890/library/tracks/abc/audio");
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
    global.fetch = originalFetch;
    api.invalidatePageDataCache();
  }
});

test("page GET requests are cached per account and mutations invalidate their account scope", async () => {
  const api = await import(moduleUrl);
  api.invalidatePageDataCache();
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    const method = init.method || "GET";
    requests.push({ url: String(url), method });
    const body = String(url).includes("/auth/accounts")
      ? [{ provider: "qq", userId: "user-a", nickname: "A" }]
      : method === "GET" ? [{ id: `song-${requests.length}` }] : { ok: true };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    api.setPageDataCacheAccountScope("qq", "user-a");
    const first = await api.loadAccountFavorites("qq");
    first[0].id = "caller-mutated";
    const second = await api.loadAccountFavorites("qq");
    assert.equal(second[0].id, "song-1");
    assert.equal(requests.filter(item => item.url.includes("/account/qq/favorites") && item.method === "GET").length, 1);

    api.setPageDataCacheAccountScope("qq", "user-b");
    await api.loadAccountFavorites("qq");
    api.setPageDataCacheAccountScope("qq", "user-a");
    await api.loadAccountFavorites("qq");
    assert.equal(requests.filter(item => item.url.includes("/account/qq/favorites") && item.method === "GET").length, 2);

    await api.removeAccountFavorite("qq:song-1", "qq");
    await api.loadAccountFavorites("qq");
    assert.equal(requests.filter(item => item.url.includes("/account/qq/favorites") && item.method === "GET").length, 3);

    await api.loadCurrentAccounts();
    await api.loadCurrentAccounts();
    assert.equal(requests.filter(item => item.url.includes("/auth/accounts")).length, 2);
  } finally {
    global.fetch = originalFetch;
    api.invalidatePageDataCache();
  }
});

test("clearing one account scope preserves other account snapshots", async () => {
  const api = await import(moduleUrl);
  api.invalidatePageDataCache();
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify([{ id: `song-${++calls}` }]), { status: 200 });

  try {
    api.setPageDataCacheAccountScope("qq", "user-a");
    await api.loadAccountFavorites("qq");
    api.setPageDataCacheAccountScope("qq", "user-b");
    await api.loadAccountFavorites("qq");
    api.clearPageDataCacheAccountScope("qq", "user-a");
    api.setPageDataCacheAccountScope("qq", "user-b");
    await api.loadAccountFavorites("qq");
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
    api.invalidatePageDataCache();
  }
});

test("runtime playback writes do not evict page snapshots", async () => {
  const api = await import(moduleUrl);
  api.invalidatePageDataCache();
  let pageLoads = 0;
  const originalFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    const isPageLoad = String(url).includes("/library/history") && (init.method || "GET") === "GET";
    if (isPageLoad) pageLoads += 1;
    return new Response(JSON.stringify(isPageLoad ? [{ id: `history-${pageLoads}` }] : { ok: true }), { status: 200 });
  };

  try {
    await api.loadHistory();
    await api.savePlaybackState({ trackId: null, positionSeconds: 0, volume: 1, playMode: "sequence" });
    const cached = await api.loadHistory();
    assert.equal(pageLoads, 1);
    assert.equal(cached[0].id, "history-1");
  } finally {
    global.fetch = originalFetch;
    api.invalidatePageDataCache();
  }
});

test("QQ listening writes preserve rank caches and week/all use distinct cache keys", async () => {
  const api = await import(moduleUrl);
  api.invalidatePageDataCache();
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method || "GET" });
    return new Response(JSON.stringify((init.method || "GET") === "GET" ? [] : { ok: true }), { status: 200 });
  };

  try {
    api.setPageDataCacheAccountScope("qq", "user-a");
    await api.loadAccountListeningRank("qq", { period: "week" });
    await api.loadAccountListeningRank("qq", { period: "all" });
    await api.reportQqListeningDelta({ accountId: "100", track: { id: "qq:mid", title: "歌曲", source: "qq" }, listenedSeconds: 15, playCount: 0 });
    await api.loadAccountListeningRank("qq", { period: "week" });

    assert.equal(requests.filter(item => item.method === "GET" && item.url.includes("listening-rank")).length, 2);
    assert.ok(requests.some(item => item.method === "POST" && item.url.includes("/account/qq/listening-stats")));
  } finally {
    global.fetch = originalFetch;
    api.invalidatePageDataCache();
  }
});

test("refresh query bypasses and replaces the normal page snapshot", async () => {
  const api = await import(moduleUrl);
  api.invalidatePageDataCache();
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ banners: [], playlists: [], songs: [++calls], hasMore: false }), { status: 200 });

  try {
    assert.deepEqual((await api.loadHomepage()).songs, [1]);
    assert.deepEqual((await api.loadHomepage()).songs, [1]);
    assert.deepEqual((await api.loadHomepage(true)).songs, [2]);
    assert.deepEqual((await api.loadHomepage()).songs, [2]);
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
    api.invalidatePageDataCache();
  }
});

test("QQ listening invalidates only that account's playlist recommendations", async () => {
  const api = await import(moduleUrl);
  api.invalidatePageDataCache();
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method || "GET" });
    return new Response(JSON.stringify((init.method || "GET") === "GET" ? [] : { ok: true }), { status: 200 });
  };
  try {
    api.setPageDataCacheAccountScope("qq", "user-a");
    await api.loadFeaturedPlaylists("qq");
    await api.loadAccountFavorites("qq");
    api.setPageDataCacheAccountScope("qq", "user-b");
    await api.loadFeaturedPlaylists("qq");
    await api.reportQqListeningDelta({ accountId: "user-a", track: { id: "qq:mid", title: "Song", source: "qq" }, listenedSeconds: 30, playCount: 1 });
    await api.loadFeaturedPlaylists("qq");
    assert.equal(requests.filter(r => r.method === "GET" && r.url.includes("featured-playlists")).length, 2);
    api.setPageDataCacheAccountScope("qq", "user-a");
    await api.loadFeaturedPlaylists("qq");
    await api.loadAccountFavorites("qq");
    assert.equal(requests.filter(r => r.method === "GET" && r.url.includes("featured-playlists")).length, 3);
    assert.equal(requests.filter(r => r.method === "GET" && r.url.includes("favorites")).length, 1);
    await api.loadFeaturedPlaylists("qq", true);
    await api.loadFeaturedPlaylists("qq");
    assert.equal(requests.filter(r => r.method === "GET" && r.url.includes("featured-playlists")).length, 4);
  } finally {
    global.fetch = originalFetch;
    api.invalidatePageDataCache();
  }
});

test("provider query pages are isolated when the signed-in account changes", async () => {
  const api = await import(moduleUrl);
  api.invalidatePageDataCache();
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ songs: [++calls], playlists: [], artists: [], total: 1, hasMore: false }), { status: 200 });

  try {
    api.setPageDataCacheAccountScope("qq", "user-a");
    assert.deepEqual((await api.searchCatalog("cache", "qq", "song", 20, 0)).songs, [1]);
    api.setPageDataCacheAccountScope("qq", "user-b");
    assert.deepEqual((await api.searchCatalog("cache", "qq", "song", 20, 0)).songs, [2]);
    api.setPageDataCacheAccountScope("qq", "user-a");
    assert.deepEqual((await api.searchCatalog("cache", "qq", "song", 20, 0)).songs, [1]);
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
    api.invalidatePageDataCache();
  }
});
