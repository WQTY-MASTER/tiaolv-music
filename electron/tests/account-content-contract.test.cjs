const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");

for (const apiName of [
  "loadAccountRecommendations",
  "loadAccountFavorites",
  "loadAccountPlaylists",
  "loadFeaturedPlaylists",
  "saveAccountFavorite",
  "removeAccountFavorite"
]) {
  assert.match(api, new RegExp(`export (?:async )?function ${apiName}\\b`), `缺少账号接口：${apiName}`);
}

assert.match(api, /\/account\/\$\{encodeURIComponent\(provider\)\}\/recommendations/);
assert.match(api, /\/account\/\$\{encodeURIComponent\(provider\)\}\/favorites/);
assert.match(api, /\/account\/\$\{encodeURIComponent\(provider\)\}\/playlists/);
assert.match(api, /loadAccountPlaylist/);
assert.match(app, /accountFavoriteTracks/);
assert.match(app, /accountPlaylists/);
assert.match(app, /loadAccountRecommendations/);
assert.match(app, /loadAccountFavorites/);
assert.match(app, /loadAccountPlaylists/);
assert.match(app, /loadAccountPlaylist/);
assert.match(app, /saveAccountFavorite/);
assert.match(app, /removeAccountFavorite/);
assert.match(app, /activeView\.value === "streaming-library"[\s\S]{0,220}accountFavoriteTracks\.value/);
assert.match(app, /async function toggleLiked\(\)[\s\S]*?saveAccountFavorite/);
assert.match(app, /async function toggleLiked\(\)[\s\S]*?removeAccountFavorite/);
assert.match(app, /:playlists="sidebarPlaylists"/);
assert.match(app, /entry\.playlist\.source/);
assert.match(app, /playlist\.id === "account-favorites"[\s\S]{0,180}accountFavoriteTracks\.value\[0\]/);

console.log("账号内容接入契约通过");
