const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const playerBar = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerBar.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");

assert.match(
  api,
  /function loadCatalogAudio\(id: string, quality[^)]*\)[\s\S]*URLSearchParams[\s\S]*quality/,
  "在线音频地址应携带全局音质参数"
);
assert.match(app, /NETEASE_QUALITY_OPTIONS/, "设置页与播放栏应共享网易云音质选项");
assert.match(app, /QQ_QUALITY_OPTIONS/, "设置页与播放栏应共享 QQ 音质选项");
assert.match(app, /neteasePlaybackQuality/, "应用应维护网易云全局音质");
assert.match(app, /qqPlaybackQuality/, "应用应维护 QQ 全局音质");
assert.match(app, /reloadCurrentTrackOnQualityChange/, "应用应维护切换音质重载当前歌曲设置");
assert.match(app, /playbackFormat/, "优先播放本地文件时应保留其格式供底栏展示");
assert.match(app, /reloadCurrentOnlineTrackForQuality/, "启用重载时应保留进度重新解析在线音源");
assert.match(app, /网易云播放音质/, "播放设置应提供网易云音质选择");
assert.match(app, /QQ 音乐播放音质/, "播放设置应提供 QQ 音质选择");
assert.match(app, /切换音质后重载当前歌曲/, "播放设置应提供立即重载开关");
assert.match(app, /@quality-change=/, "底栏修改应回写同一份全局设置");

assert.doesNotMatch(playerBar, /HiFi 控制台/, "底栏不应保留未实现的 HiFi 控制台占位提示");
assert.doesNotMatch(playerBar, /hifi:\s*\[\]/, "底栏不应继续发送 HiFi 占位事件");
assert.match(playerBar, /qualityChange:/, "底栏应发送音质变化事件");
assert.match(playerBar, /title="音质"/, "底栏音质按钮应提供明确提示");
assert.match(playerBar, /player-quality-panel/, "底栏应提供音质选择面板");
assert.match(playerBar, /本地音频/, "本地歌曲面板应显示只读本地音质信息");
assert.match(playerBar, /handleQualityOutsidePointer/, "点击音质面板外部应关闭面板");
assert.match(playerBar, /Escape/, "按 Escape 应关闭音质面板");

console.log("全局播放音质与底栏入口契约通过");
