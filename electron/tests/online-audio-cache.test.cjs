const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadModule() {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/renderer/src/services/onlineAudioCache.ts"), "utf8")
    .replace(/export type OnlineAudioCachePolicy = [^;]+;/, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ")
    .replace(/interface StorageLike \{[\s\S]*?\}/, "")
    .replace(/: StorageLike/g, "")
    .replace(/: OnlineAudioCachePolicy/g, "")
    .replace(/: string/g, "")
    .replace(/: number/g, "");
  const context = { result: null, URL, Date };
  vm.runInNewContext(`${source}\nresult = { readOnlineAudioCachePolicy, writeOnlineAudioCachePolicy, applyOnlineAudioCachePolicy, ONLINE_AUDIO_CACHE_POLICY_STORAGE_KEY };`, context);
  return context.result;
}

test("online audio cache policy persists", () => {
  const api = loadModule();
  const values = new Map();
  api.writeOnlineAudioCachePolicy("none", { setItem: (key, value) => values.set(key, value) });
  assert.equal(values.get(api.ONLINE_AUDIO_CACHE_POLICY_STORAGE_KEY), "none");
  assert.equal(api.readOnlineAudioCachePolicy({ getItem: (key) => values.get(key) ?? null }), "none");
});

test("no-cache policy makes each audio request unique", () => {
  const api = loadModule();
  assert.equal(api.applyOnlineAudioCachePolicy("http://127.0.0.1/audio?id=1", "provider", 42), "http://127.0.0.1/audio?id=1");
  const result = api.applyOnlineAudioCachePolicy("http://127.0.0.1/audio?id=1", "none", 42);
  assert.match(result, /cachePolicy=none/);
  assert.match(result, /cacheNonce=42/);
});
