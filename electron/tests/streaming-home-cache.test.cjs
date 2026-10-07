const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/streamingHomeCache.ts"));

test("home snapshots are isolated by provider and account", async () => {
  const { createStreamingHomeCache } = await import(moduleUrl);
  const cache = createStreamingHomeCache(5_000, () => 1_000);

  cache.set("qq", "qq-user", { title: "QQ home" });
  cache.set("netease", "netease-user", { title: "NetEase home" });

  assert.deepEqual(cache.get("qq", "qq-user"), {
    snapshot: { title: "QQ home" },
    fresh: true
  });
  assert.deepEqual(cache.get("netease", "netease-user"), {
    snapshot: { title: "NetEase home" },
    fresh: true
  });
  assert.equal(cache.get("qq", "another-user"), null);
});

test("stale snapshots remain available for immediate display", async () => {
  const { createStreamingHomeCache } = await import(moduleUrl);
  let now = 1_000;
  const cache = createStreamingHomeCache(5_000, () => now);

  cache.set("qq", "qq-user", { tracks: ["cached"] });
  now = 7_000;

  assert.deepEqual(cache.get("qq", "qq-user"), {
    snapshot: { tracks: ["cached"] },
    fresh: false
  });
});

test("clearing one provider does not discard the other provider snapshot", async () => {
  const { createStreamingHomeCache } = await import(moduleUrl);
  const cache = createStreamingHomeCache(5_000, () => 1_000);

  cache.set("qq", "qq-user", { title: "QQ home" });
  cache.set("netease", "netease-user", { title: "NetEase home" });
  cache.clear("qq");

  assert.equal(cache.get("qq", "qq-user"), null);
  assert.equal(cache.get("netease", "netease-user")?.snapshot.title, "NetEase home");
});
