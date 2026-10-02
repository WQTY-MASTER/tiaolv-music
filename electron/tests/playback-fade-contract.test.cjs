const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");

assert.match(app, /from "\.\/services\/playbackFade"/, "播放器应复用独立的淡入淡出边界逻辑");
assert.match(app, /interface PlayTrackOptions[\s\S]*fadeIn\?: boolean[\s\S]*transitionToken\?: number/, "播放歌曲应支持仅供切歌使用的淡入选项");
assert.match(app, /async function fadeAudioVolume/, "播放器缺少平滑音量动画");
assert.match(app, /window\.requestAnimationFrame/, "音量动画应使用逐帧更新而不是粗粒度定时器");
assert.match(app, /playbackFadeToken/, "连续切歌需要令旧动画失效");
assert.match(app, /function getRemainingPlaybackSeconds[\s\S]{0,500}audio\.duration[\s\S]{0,300}audio\.currentTime/, "淡出时长应受当前歌曲剩余时长保护");
assert.match(app, /async function transitionToTrack[\s\S]{0,1200}boundFadeDurationMs[\s\S]{0,1200}playTrack\(track,\s*\{\s*fadeIn:\s*true,\s*transitionToken\s*\}\)/, "上一首和下一首应统一执行淡出后切歌并淡入");
assert.match(app, /function previousTrack\(\)[\s\S]{0,900}void transitionToTrack\(previous\)/, "上一首没有触发切歌过渡");
assert.match(app, /function nextTrack\(\)[\s\S]{0,900}void transitionToTrack\(next\)/, "下一首没有触发切歌过渡");
assert.match(app, /async function playTrack\(track: Track, options: PlayTrackOptions = \{\}\)/, "普通点歌和切歌应通过明确选项区分");

const togglePlaybackBlock = app.match(/function togglePlayback\(\)[\s\S]*?\n\}/)?.[0] ?? "";
const seekPlaybackBlock = app.match(/function seekPlayback\(value: number\)[\s\S]*?\n\}/)?.[0] ?? "";
assert.doesNotMatch(togglePlaybackBlock, /transitionToTrack|fadeAudioVolume/, "暂停和恢复不应触发淡入淡出");
assert.doesNotMatch(seekPlaybackBlock, /transitionToTrack|fadeAudioVolume/, "拖动进度不应触发淡入淡出");

assert.match(app, /"playback-fade-enabled"[\s\S]*"playback-fade-duration-ms"/, "旧品牌存储迁移清单缺少淡入淡出设置");
assert.match(app, /PLAYBACK_FADE_ENABLED_STORAGE_KEY/, "缺少淡入淡出开关持久化键");
assert.match(app, /PLAYBACK_FADE_DURATION_STORAGE_KEY/, "缺少淡入淡出时长持久化键");
assert.match(app, /function readPlaybackFadeEnabled[\s\S]{0,180}!==\s*"false"/, "淡入淡出应默认开启");
assert.match(app, /function readPlaybackFadeDurationMs[\s\S]{0,220}normalizeFadeDurationMs/, "持久化时长应经过范围校验");
assert.match(app, /watch\(playbackFadeEnabled[\s\S]{0,220}PLAYBACK_FADE_ENABLED_STORAGE_KEY/, "淡入淡出开关没有持久化");
assert.match(app, /watch\(playbackFadeDurationMs[\s\S]{0,260}PLAYBACK_FADE_DURATION_STORAGE_KEY/, "淡入淡出时长没有持久化");

const playbackSettingsBlock = app.match(/<article v-else-if="activeSettingsSection === 'playback'"[\s\S]*?<article v-else/)?.[0] ?? "";
assert.match(playbackSettingsBlock, /音乐渐进渐出/, "播放设置缺少音乐渐进渐出选项");
assert.match(playbackSettingsBlock, /切换上一首或下一首时平滑淡出淡入/, "淡入淡出设置缺少触发边界说明");
assert.match(playbackSettingsBlock, /过渡时长（毫秒）/, "淡入淡出设置缺少时长标签");
assert.match(playbackSettingsBlock, /class="settings-fade-slider"[^>]*type="range"[^>]*min="10"[^>]*max="2000"[^>]*step="10"/, "过渡时长滑块范围应为 10 到 2000ms");
assert.match(playbackSettingsBlock, /:disabled="!playbackFadeEnabled"/, "关闭开关后时长控件应不可操作");
assert.match(playbackSettingsBlock, /\{\{ playbackFadeDurationMs \}\} ms/, "设置行应显示当前毫秒值");
assert.ok(
  playbackSettingsBlock.indexOf("settings-fade-field") < playbackSettingsBlock.indexOf("系统托盘图标"),
  "淡入淡出应位于系统播放入口设置之前"
);
assert.match(app, /\.settings-fade-field\s*\{[^}]*border-top:\s*1px solid #edf0f5[^}]*padding-top:\s*20px/, "淡入淡出设置应与其他播放设置使用相同分隔线和间距");
assert.doesNotMatch(app, /\.settings-fade-field\s*\{[^}]*(?:background|border-left):/, "淡入淡出设置不应使用独立灰底或左侧强调边");
assert.match(app, /\.settings-fade-slider:disabled\s*\{[^}]*opacity:/, "关闭状态需要清晰的置灰样式");

console.log("播放渐进渐出触发契约通过");
