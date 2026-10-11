const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");

for (const name of [
  "reportQqListeningDelta",
  "createQqListeningSession",
  "sampleQqListeningPlayback",
  "pauseQqListeningSession",
  "prepareQqListeningFlush",
  "acknowledgeQqListeningFlush",
  "failQqListeningFlush",
]) {
  assert.match(app, new RegExp(`\\b${name}\\b`), `App.vue 缺少 QQ 听歌会话接入：${name}`);
}

assert.match(
  app,
  /loadAccountListeningRank\(provider, \{ period: qqListeningRankPeriod\.value \}\)/,
  "音乐库概览应按当前范围读取对应音源的听歌排行",
);
assert.match(
  app,
  /function toQqListeningRankTracks\([\s\S]*entry\.track[\s\S]*accountListeningRank\.value = provider === "qq"[\s\S]*toQqListeningRankTracks/,
  "QQ 本地排行响应应从 entry.track 映射为页面歌曲",
);

assert.match(app, />最近一周</, "听歌排行应提供最近一周范围");
assert.match(app, />全部</, "QQ 排行应提供全部范围");
assert.doesNotMatch(app, />最近 7 天|>本周|>自定义/, "听歌排行不应保留旧范围");
assert.match(app, /<template #toolbar-tools>[\s\S]{0,300}class="qq-listening-range"/, "排行范围应放在歌曲工具栏中");
assert.doesNotMatch(app, /<template #hero-tools>[\s\S]{0,300}class="qq-listening-range"/, "排行范围不应继续占用详情页头图区域");
assert.match(app, /loadListeningRankRange\(true\)/, "打开或切换排行范围时应强制刷新");

assert.match(app, /function ensureQqListeningSession/, "播放器应按当前 QQ 账号和歌曲创建会话");
assert.match(app, /function flushQqListeningSession/, "播放器应统一提交 QQ 听歌增量");
assert.match(app, /function ensureQqListeningSession[\s\S]*sampleQqListeningPlayback/, "QQ 播放采样应使用连续播放状态机");
assert.match(app, /function updateProgressFromAudio[\s\S]*recordCurrentQqListening/, "播放进度更新应触发 QQ 连续播放采样");
assert.match(app, /function beginSeek[\s\S]*pauseCurrentQqListeningSession/, "拖动进度前应暂停 QQ 计时，避免把跳转计入时长");
assert.match(app, /finishSeek[\s\S]*ensureQqListeningSession/, "拖动结束后应从新位置重新开始采样");
assert.match(app, /async function playTrack[\s\S]*finishQqListeningSession\(\)/, "切歌前应结束并提交旧歌曲增量");
assert.match(app, /function togglePlayback[\s\S]*pauseCurrentQqListeningSession[\s\S]*flushQqListeningSession\(true\)/, "暂停时应停止计时并提交剩余增量");
assert.match(app, /handleProviderLogout[\s\S]*finishQqListeningSession\(\)/, "QQ 账号退出前应提交剩余增量");
assert.match(app, /onBeforeUnmount\([\s\S]*finishQqListeningSession\(\)/, "应用退出前应提交剩余增量");

console.log("QQ 本地听歌排行接入契约通过");
