const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/pageDataCache.ts"));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

test("fresh snapshots are cloned and returned without loading", async () => {
  const { createPageDataCache } = await import(moduleUrl);
  const cache = createPageDataCache({ ttlMs: 5_000, maxEntries: 3, now: () => 1_000 });
  const original = { tracks: [{ id: "a" }] };
  cache.set("qq:user|playlist:1", original);
  original.tracks[0].id = "changed";

  let loads = 0;
  const result = await cache.load("qq:user|playlist:1", async () => { loads += 1; return { tracks: [] }; });
  result.tracks[0].id = "caller-change";

  assert.equal(loads, 0);
  assert.deepEqual(cache.get("qq:user|playlist:1"), {
    snapshot: { tracks: [{ id: "a" }] },
    fresh: true
  });
});

test("stale data returns immediately while one background refresh updates the snapshot", async () => {
  const { createPageDataCache } = await import(moduleUrl);
  let now = 0;
  const cache = createPageDataCache({ ttlMs: 10, maxEntries: 3, now: () => now });
  cache.set("qq:user|playlist:1", { tracks: ["old"] });
  now = 20;
  const refresh = deferred();
  let loads = 0;
  const loader = () => { loads += 1; return refresh.promise; };

  assert.deepEqual(await cache.load("qq:user|playlist:1", loader), { tracks: ["old"] });
  assert.deepEqual(await cache.load("qq:user|playlist:1", loader), { tracks: ["old"] });
  assert.equal(loads, 1);

  refresh.resolve({ tracks: ["new"] });
  await refresh.promise;
  await flush();
  assert.deepEqual(cache.get("qq:user|playlist:1")?.snapshot, { tracks: ["new"] });
});

test("concurrent cache misses share one request", async () => {
  const { createPageDataCache } = await import(moduleUrl);
  const cache = createPageDataCache();
  const request = deferred();
  let loads = 0;
  const loader = () => { loads += 1; return request.promise; };

  const first = cache.load("public|search:q", loader);
  const second = cache.load("public|search:q", loader);
  assert.equal(loads, 1);
  request.resolve({ songs: ["a"] });

  assert.deepEqual(await first, { songs: ["a"] });
  assert.deepEqual(await second, { songs: ["a"] });
});

test("failed background refresh keeps the stale snapshot", async () => {
  const { createPageDataCache } = await import(moduleUrl);
  let now = 0;
  const cache = createPageDataCache({ ttlMs: 10, now: () => now });
  cache.set("public|discover", { playlists: ["old"] });
  now = 20;

  assert.deepEqual(await cache.load("public|discover", async () => { throw new Error("offline"); }), { playlists: ["old"] });
  await flush();
  assert.deepEqual(cache.get("public|discover")?.snapshot, { playlists: ["old"] });
});

test("forced loads wait for fresh data and replace the snapshot", async () => {
  const { createPageDataCache } = await import(moduleUrl);
  const cache = createPageDataCache();
  cache.set("qq:user|favorites", { tracks: ["old"] });

  const result = await cache.load("qq:user|favorites", async () => ({ tracks: ["fresh"] }), { force: true });
  assert.deepEqual(result, { tracks: ["fresh"] });
  assert.deepEqual(cache.get("qq:user|favorites")?.snapshot, { tracks: ["fresh"] });
});

test("prefix invalidation and scope clearing only remove matching entries", async () => {
  const { createPageDataCache } = await import(moduleUrl);
  const cache = createPageDataCache();
  cache.set("qq:user-a|/account/qq/favorites", { id: "a" });
  cache.set("qq:user-a|/account/qq/playlists", { id: "lists" });
  cache.set("netease:user-b|/account/netease/favorites", { id: "b" });

  cache.invalidate("qq:user-a|/account/qq/favorites");
  assert.equal(cache.get("qq:user-a|/account/qq/favorites"), null);
  assert.ok(cache.get("qq:user-a|/account/qq/playlists"));
  cache.clearScope("qq:user-a");
  assert.equal(cache.get("qq:user-a|/account/qq/playlists"), null);
  assert.ok(cache.get("netease:user-b|/account/netease/favorites"));
});

test("least recently used entries are evicted at the size limit", async () => {
  const { createPageDataCache } = await import(moduleUrl);
  let now = 0;
  const cache = createPageDataCache({ maxEntries: 2, now: () => ++now });
  cache.set("a", { value: "a" });
  cache.set("b", { value: "b" });
  cache.get("a");
  cache.set("c", { value: "c" });

  assert.ok(cache.get("a"));
  assert.equal(cache.get("b"), null);
  assert.ok(cache.get("c"));
  assert.equal(cache.size(), 2);
});
test("authoritative snapshots cannot be overwritten by older in-flight reads", async () => {
  const { createPageDataCache } = await import(moduleUrl);
  const cache = createPageDataCache();
  let complete;
  const pending = cache.load("recent", () => new Promise(resolve => { complete = resolve; }));
  cache.set("recent", ["confirmed"]);
  complete(["stale"]);
  await pending;
  assert.deepEqual(cache.get("recent").snapshot, ["confirmed"]);
});
