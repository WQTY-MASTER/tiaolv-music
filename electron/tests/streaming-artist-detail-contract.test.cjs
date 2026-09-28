const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const searchPage = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingSearchPage.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const detailPath = path.join(root, "src/renderer/src/components/StreamingArtistDetailPage.vue");

assert.match(api, /artist\/detail/);
assert.match(api, /artist\/top-songs/);
assert.match(api, /artist\/songs/);
assert.match(api, /artist\/albums/);
assert.match(api, /artists\/.*subscription/);
assert.match(searchPage, /selectArtist/);
assert.match(searchPage, /class="streaming-search-artist"[^>]*type="button"/);
assert.equal(fs.existsSync(detailPath), true, "歌手详情页组件必须存在");
const detailPage = fs.readFileSync(detailPath, "utf8");
assert.match(detailPage, /全部歌曲/);
assert.match(detailPage, /专辑/);
assert.match(detailPage, /创建的歌单/);
assert.match(detailPage, /播放全部/);
assert.match(detailPage, /随机播放/);
assert.match(detailPage, /toggleFollow/);
assert.match(detailPage, /emit\('back'\)/);
assert.match(app, /selectedStreamingArtist/);
assert.match(app, /loadCatalogArtistTopSongs/);
assert.match(app, /StreamingArtistDetailPage/);
assert.match(app, /selectStreamingArtist/);
assert.match(app, /!selectedStreamingArtist/);
assert.match(app, /Promise\.allSettled/);

console.log("流媒体歌手详情页契约通过");
