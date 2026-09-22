const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const roamingPagePath = path.join(root, "src/renderer/src/components/PrivateRoamingPage.vue");

assert.match(api, /loadPrivateRadar/);
assert.match(api, /\/account\/\$\{encodeURIComponent\(provider\)\}\/private-radar/);
assert.match(api, /loadPrivateRoaming/);
assert.match(api, /\/account\/netease\/roaming/);

assert.doesNotMatch(app, /"streaming-roaming"/);
assert.doesNotMatch(app, /id:\s*"streaming-radar-/);
assert.match(app, /function openPrivateRadar\(\)\s*\{\s*void playPrivateRadar\(\);\s*\}/);
assert.match(app, /function playPrivateRadar\(\)[\s\S]*?loadStreamingRadarData\(\)[\s\S]*?playbackQueue\.value[\s\S]*?playTrack\(playbackQueue\.value\[0\]\)/);
assert.doesNotMatch(app, /function openPrivateRadar\(\)[\s\S]{0,300}?(?:selectPlaylist|pushNavigation|applyNavigation)/);
assert.match(app, /function openPrivateRoaming\(\)\s*\{[\s\S]*?loadPrivateRoamingBatch\(true, true\)/);
assert.doesNotMatch(app, /function openPrivateRoaming\(\)[\s\S]{0,300}?(?:selectPlaylist|pushNavigation|applyNavigation)/);
assert.match(app, /loadPrivateRoaming/);
assert.match(app, /privateRoamingState\.value === "loading" && !reset/, "切换漫游模式时重置请求应可抢占旧请求");
assert.match(app, /loadPrivateRadar/);
assert.match(app, /const streamingRoamingCoverUrls = computed/);
assert.match(app, /privateRoamingTracks\.value\s*\.map\(\(track\) => track\.coverUrl\)/);
assert.doesNotMatch(
  app.match(/const streamingRadarCoverUrls = computed\([\s\S]*?\n\}\);/)?.[0] || "",
  /streamingHomeTracks|streamingHomePlaylists/,
  "私人雷达封面不能借用每日推荐数据"
);
assert.doesNotMatch(
  app.match(/const streamingRoamingCoverUrls = computed\([\s\S]*?\n\}\);/)?.[0] || "",
  /streamingHomeTracks|streamingHomePlaylists/,
  "私人漫游封面不能借用每日推荐数据"
);
assert.match(
  app.match(/async function loadStreamingHomeData[\s\S]*?\n\}/)?.[0] || "",
  /loadPrivateRadar[\s\S]*?loadPrivateRoaming/,
  "流媒体主页应预取雷达与漫游的独立封面数据"
);
assert.match(
  app,
  /class="streaming-personal-card is-roaming"[\s\S]*?class="streaming-radar-covers"[\s\S]*?streamingRoamingCoverUrls/,
  "私人漫游卡片应像私人雷达一样展示歌曲封面"
);
assert.doesNotMatch(app, /PrivateRoamingPage/);
assert.ok(!fs.existsSync(roamingPagePath), "私人漫游不应保留独立页面组件");

console.log("私人雷达与私人漫游直接播放契约通过");
