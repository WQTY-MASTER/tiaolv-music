const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appSource = fs.readFileSync(path.resolve(__dirname, "../src/renderer/src/App.vue"), "utf8");
const cacheSource = fs.readFileSync(path.resolve(__dirname, "../src/renderer/src/services/pageDataCache.ts"), "utf8");

test("App registers account cache scopes and clears them on logout", () => {
  assert.match(appSource, /setPageDataCacheAccountScope\(currentAccount\.provider, currentAccount\.userId\)/);
  assert.match(appSource, /setPageDataCacheAccountScope\(provider, nextAccount\.userId\)/);
  assert.match(appSource, /clearPageDataCacheAccountScope\(provider, accountAtLogout\?\.userId\)/);
});

test("manual refresh actions invalidate their page data before reloading", () => {
  assert.match(appSource, /async function refreshCloudData\(\)[\s\S]*?invalidatePageDataCacheForProvider\("netease"\)[\s\S]*?await loadCloudData\(\)/);
  assert.match(appSource, /async function refreshStreamingLibraryData\(\)[\s\S]*?invalidatePageDataCacheForProvider\(activeAccount\.provider\)[\s\S]*?await loadStreamingLibraryData\(\)/);
  assert.match(appSource, /async function refreshStreamingDailyMix\(\)[\s\S]*?invalidatePageDataCacheForProvider\(provider\)[\s\S]*?await loadStreamingHomeData\(provider\)/);
  assert.match(appSource, /invalidatePageDataCache\(\(key\) => key\.includes\("\/library\/history"\)\)/);
});

test("the unified cache is session-only", () => {
  assert.doesNotMatch(cacheSource, /localStorage|sessionStorage|indexedDB/i);
});
