const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(app, /from "\.\/services\/preferredLocalPlayback"/, "播放器应复用独立的本地品质匹配器");
assert.match(app, /"prefer-local-download-playback"/, "旧品牌设置迁移清单缺少本地品质开关");
assert.match(app, /PREFER_LOCAL_DOWNLOAD_PLAYBACK_STORAGE_KEY/, "缺少本地品质开关持久化键");
assert.match(
  app,
  /function readPreferLocalDownloadPlayback[\s\S]{0,180}!==\s*"false"/,
  "优先播放本地下载品质应默认开启"
);
assert.match(app, /const preferLocalDownloadPlayback = ref\(readPreferLocalDownloadPlayback\(\)\)/, "缺少本地品质响应式状态");
assert.match(
  app,
  /watch\(preferLocalDownloadPlayback[\s\S]{0,220}PREFER_LOCAL_DOWNLOAD_PLAYBACK_STORAGE_KEY/,
  "本地品质开关没有持久化"
);

const playbackSettingsBlock = app.match(/<article v-else-if="activeSettingsSection === 'playback'"[\s\S]*?<article v-else/)?.[0] ?? "";
assert.match(playbackSettingsBlock, /优先播放本地下载品质/, "播放设置缺少本地下载品质开关");
assert.match(playbackSettingsBlock, /网络环境下播放已下载歌曲时，将优先选择本地高品质文件播放/, "本地品质设置缺少行为说明");
assert.match(playbackSettingsBlock, /v-model="preferLocalDownloadPlayback"/, "本地品质设置没有绑定开关状态");
assert.ok(
  playbackSettingsBlock.indexOf("音乐渐进渐出") < playbackSettingsBlock.indexOf("优先播放本地下载品质"),
  "本地品质设置应位于渐进渐出之后"
);
assert.ok(
  playbackSettingsBlock.indexOf("优先播放本地下载品质") < playbackSettingsBlock.indexOf("系统托盘图标"),
  "本地品质设置应位于系统播放入口之前"
);

const onlineAssetsBlock = app.match(/async function loadOnlineTrackAssets[\s\S]*?\n\}/)?.[0] ?? "";
assert.match(onlineAssetsBlock, /selectPreferredLocalPlaybackTrack/, "在线音频加载没有执行本地品质匹配");
assert.match(onlineAssetsBlock, /remoteTracks\.value/, "本地品质匹配只能使用真实扫描音乐库");
assert.match(onlineAssetsBlock, /playbackFallbackUrl/, "选用本地音频时必须保留网络回退地址");
assert.match(onlineAssetsBlock, /preferredLocalPlayback/, "播放记录需要标记本次是否选用了本地音频");

assert.match(app, /async function playAudioWithNetworkFallback/, "缺少本地播放失败后的单次网络回退函数");
assert.match(
  app,
  /function createNetworkFallbackTrack[\s\S]{0,650}preferredLocalPlayback:\s*false[\s\S]{0,250}playbackFallbackUrl:\s*undefined/,
  "网络回退后必须清除本地优先标记，防止循环重试"
);
assert.match(
  app,
  /async function handleAudioError[\s\S]{0,700}playAudioWithNetworkFallback/,
  "媒体在播放中加载失败时也应尝试网络回退"
);
assert.match(packageJson, /preferred-local-playback\.test\.cjs/, "完整测试脚本应包含本地品质匹配单元测试");
assert.match(packageJson, /preferred-local-playback-contract\.test\.cjs/, "完整测试脚本应包含本地品质播放契约测试");

console.log("优先播放本地下载品质契约通过");
