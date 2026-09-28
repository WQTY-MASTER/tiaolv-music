const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const playerBar = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerBar.vue"), "utf8");
const playerControlButton = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerControlButton.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");

for (const apiName of [
  "loadFavorites",
  "saveFavorite",
  "removeFavorite",
  "loadHistory",
  "recordHistory",
  "loadPlaybackQueue",
  "savePlaybackQueue",
  "loadPlaybackState",
  "savePlaybackState"
]) {
  assert.match(api, new RegExp(`export function ${apiName}\\b`), `缺少持久化接口：${apiName}`);
  assert.match(app, new RegExp(`\\b${apiName}\\b`), `App.vue 尚未使用持久化接口：${apiName}`);
}

assert.match(app, /const favoriteTracks = ref<Track\[]>\(\[\]\)/, "收藏页应使用后端返回的独立列表");
assert.match(app, /const historyTracks = ref<Track\[]>\(\[\]\)/, "最近播放页应使用后端返回的独立列表");
assert.match(app, /activeView\.value === "liked"[\s\S]{0,160}favoriteTracks\.value/, "收藏页应展示持久化收藏");
assert.match(app, /activeView\.value === "history"[\s\S]{0,160}historyTracks\.value/, "最近播放页应展示持久化历史");
assert.match(app, /recordPlayedTrack/, "成功播放后应记录最近播放");
assert.match(app, /restorePersistedSession/, "启动时应恢复播放状态和队列");
assert.match(app, /persistPlaybackState/, "暂停、拖动或设置变化后应保存播放状态");
assert.match(app, /stateSaveChain/, "播放状态保存应串行执行，避免旧进度覆盖新状态");
assert.match(app, /persistPlaybackQueue/, "播放队列发生变化后应保存");
assert.match(app, /class="queue-panel"/, "播放队列按钮应打开真实队列面板");
assert.match(
  app,
  /<PlayerBar[\s\S]*?:class="\{ 'song-detail-player-bar': showSongDetail \}"[\s\S]*?@like="toggleLiked"/,
  "歌词详情页的全局播放栏应复用收藏逻辑"
);
assert.match(playerBar, /<PlayerControlButton\s+kind="like"\s+:liked="props\.track\.liked"/, "播放栏应把收藏状态传给共享按钮");
assert.match(playerControlButton, /:class="\{ liked: props\.liked, compact: props\.compact \}"/, "共享收藏按钮应根据收藏状态切换样式");
assert.match(playerControlButton, /:aria-pressed="props\.liked"/, "共享收藏按钮应暴露收藏状态");
assert.match(playerControlButton, /\.player-control-button\s*\{[^}]*color:\s*#697174/, "未收藏爱心应使用工具按钮灰色");
assert.match(playerControlButton, /\.player-like-button\.liked[^}]*color:\s*#ff6570/, "收藏后爱心应使用粉红色");
assert.match(app, /removeQueueTrack/, "播放队列应支持移除歌曲");
assert.match(app, /currentQueueIndex/, "删除队列歌曲时应先记录当前歌曲在队列中的位置");
assert.match(app, /nextQueueTrack|previousQueueTrack/, "删除当前歌曲后应按队列位置选择下一首或上一首");
assert.match(app, /resetPlayerToDefault/, "播放队列为空时应恢复默认播放器");
assert.match(app, /appendTrackToQueue/, "播放在线歌曲时应追加当前歌曲而不是替换现有队列");
assert.match(app, /playbackQueue\.value\s*=\s*\[queuedTrack,\s*\.\.\.playbackQueue\.value\]/, "新播放歌曲应插入队首，队列从第一首到最后一首排列");
assert.doesNotMatch(app, /@click="playTrack\(track, visibleTracks\)"/, "在线搜索结果不应覆盖播放队列");
assert.match(app, /clearPlaybackQueue/, "播放队列应支持清空");
assert.doesNotMatch(app, /后续接入真实队列/, "不应再显示播放队列占位提示");

console.log("用户音乐数据持久化契约通过");
