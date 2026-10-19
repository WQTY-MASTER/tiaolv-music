const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

const boundaryFile = path.resolve(__dirname, "../src/shared/backendRoutes.ts");
async function boundary() {
  assert.ok(fs.existsSync(boundaryFile), "The shared backend route boundary must exist");
  return import(pathToFileURL(boundaryFile));
}

test("device and online application routes have explicit ownership", async () => {
  const { backendRouteOwner } = await boundary();
  for (const root of ["library", "playback", "cache"]) {
    assert.equal(backendRouteOwner(`/${root}`), "device");
    assert.equal(backendRouteOwner(`/${root}/tracks/a?next=/account#catalog`), "device");
  }
  for (const root of ["auth", "account", "catalog"]) {
    assert.equal(backendRouteOwner(`/${root}`), "online");
    assert.equal(backendRouteOwner(`/${root}/tracks/a?next=/library#cache`), "online");
  }
  assert.equal(backendRouteOwner("/health?probe=1"), "device");
  assert.equal(backendRouteOwner("/library/tracks/a/lyrics/match"), "device");
});

test("prefix lookalikes and unrelated resources have no application ownership", async () => {
  const { backendRouteOwner } = await boundary();
  for (const value of ["/accounting", "/library-old", "/catalogue", "/health/more",
    "/covers/old.jpg?next=/account", "data:image/png;base64,AA", "file:///library/a",
    "https://cdn.example/catalog/tracks/a", "//cdn.example/account/current",
    "http://localhost:17890/account/current", "http://user:pass@127.0.0.1:17890/account/current"]) {
    assert.equal(backendRouteOwner(value), null, value);
  }
});

test("URL pathname normalization determines ownership rather than query text", async () => {
  const { backendRouteOwner } = await boundary();
  assert.equal(backendRouteOwner("http://127.0.0.1:17890/catalog/tracks/a?next=/library"), "online");
  assert.equal(backendRouteOwner("/catalog/../library/tracks"), "device");
  assert.equal(backendRouteOwner("/account/%2e%2e/library/tracks"), "device");
  assert.equal(backendRouteOwner("/library%2Ftracks"), null);
  assert.equal(backendRouteOwner("http://[invalid"), null);
});

test("local backend identity requires the exact existing origin", async () => {
  const { LOCAL_BACKEND_ORIGIN, isLocalBackendUrl } = await boundary();
  assert.equal(LOCAL_BACKEND_ORIGIN, "http://127.0.0.1:17890");
  assert.equal(isLocalBackendUrl(`${LOCAL_BACKEND_ORIGIN}/library/tracks`), true);
  assert.equal(isLocalBackendUrl(new URL(`${LOCAL_BACKEND_ORIGIN}/catalog/tracks/a`)), true);
  for (const value of ["http://127.0.0.1:17890.attacker.example/private", "http://localhost:17890/private",
    "http://127.0.0.1:17891/private", "https://127.0.0.1:17890/private", "/library/tracks", "not-a-url"]) {
    assert.equal(isLocalBackendUrl(value), false, value);
  }
});

test("both owners preserve standalone and preview request URLs", async () => {
  const { standaloneBackendRequestUrl } = await boundary();
  for (const route of ["/library/tracks", "/playback/queue", "/health", "/account/qq/favorites",
    "/auth/current", "/catalog/tracks/qq%3Aa/audio?quality=hires&cachePolicy=none#position"]) {
    assert.equal(standaloneBackendRequestUrl(route), `http://127.0.0.1:17890${route}`);
    assert.equal(standaloneBackendRequestUrl(route, "http://127.0.0.1:5174"),
      `http://127.0.0.1:5174/backend${route}`);
  }
});

test("resource resolution rebases backend URLs without changing external resources", async () => {
  const { resolveStandaloneBackendResourceUrl } = await boundary();
  const origin = "http://127.0.0.1:5173";
  for (const route of ["/library/tracks/a/audio?part=2#time", "/catalog/tracks/qq%3Aa/cover", "/covers/legacy.jpg"]) {
    assert.equal(resolveStandaloneBackendResourceUrl(route), `http://127.0.0.1:17890${route}`);
    assert.equal(resolveStandaloneBackendResourceUrl(route, origin), `${origin}/backend${route}`);
    assert.equal(resolveStandaloneBackendResourceUrl(`http://127.0.0.1:17890${route}`, origin), `${origin}/backend${route}`);
  }
  for (const url of ["https://y.gtimg.cn/cover.jpg", "http://cdn.example/audio?x=1", "file:///C:/music/a.mp3",
    "data:image/png;base64,AA", "blob:http://127.0.0.1:5173/123", "tiaolv-cover://cache/" + "a".repeat(64) + ".png"]) {
    assert.equal(resolveStandaloneBackendResourceUrl(url, origin), url);
  }
});
