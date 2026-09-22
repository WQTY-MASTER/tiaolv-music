const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const playerBar = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerBar.vue"), "utf8");
const miniPlayer = fs.readFileSync(path.join(root, "src/renderer/src/components/MiniPlayer.vue"), "utf8");
const controlButton = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerControlButton.vue"), "utf8");

assert.match(app, /import MiniPlayer from/, "应用应接入迷你悬浮播放器组件");
assert.match(app, /const miniPlayerVisible = ref\(false\)/, "应用应维护迷你播放器显示状态");
assert.match(app, /function openMiniPlayer\(\)\s*\{[\s\S]*miniPlayerVisible\.value\s*=\s*true[\s\S]*showSongDetail\.value\s*=\s*false/, "打开迷你播放器时应退出歌曲详情并切换到迷你模式");
assert.match(app, /<PlayerBar[\s\S]*v-if="!shouldHidePlayerBar && !showSongDetail && !miniPlayerVisible"/, "迷你播放器显示时应隐藏普通底部播放栏");
assert.match(app, /<MiniPlayer[\s\S]*v-if="miniPlayerVisible"[\s\S]*:track="currentTrack"[\s\S]*:lyric="currentLyricText"[\s\S]*:theme-style="songDetailThemeStyle"/, "迷你播放器应复用当前歌曲、同步歌词和封面主题色");
assert.match(app, /<MiniPlayer[\s\S]*@toggle="togglePlayback"[\s\S]*@previous="previousTrack"[\s\S]*@next="nextTrack"[\s\S]*@like="toggleLiked"[\s\S]*@queue="toggleMiniQueue"[\s\S]*@close="closeMiniPlayer"/, "迷你播放器应复用主播放器点击逻辑并切换内置队列");
assert.match(app, /showSongDetail\.value \|\| miniPlayerVisible\.value/, "迷你播放器显示时也应持续提取封面主题色");

assert.match(miniPlayer, /class="mini-player"/, "迷你播放器应使用独立悬浮卡片");
assert.match(miniPlayer, /position:\s*fixed/, "迷你播放器应悬浮在软件窗口内");
assert.match(miniPlayer, /border-radius:\s*24px/, "迷你播放器应使用柔和大圆角卡片");
assert.match(miniPlayer, /backdrop-filter:\s*blur/, "迷你播放器应使用半透明雾化背景");
assert.match(miniPlayer, /conic-gradient\([^}]*--mini-progress/, "圆形封面外圈应按播放进度绘制进度环");
assert.match(miniPlayer, /class="mini-cover-button"[\s\S]*@click\.stop="emit\('toggle'\)"/, "点击圆形封面应切换播放暂停");
assert.match(miniPlayer, /v-if="props\.isPlaying"[\s\S]*class="mini-lyric"[\s\S]*v-else[\s\S]*class="mini-track-info"/, "播放时只显示歌词，暂停时应切换到歌曲信息");
assert.match(miniPlayer, /props\.track\.title[\s\S]*props\.track\.artist[\s\S]*props\.track\.album/, "暂停状态应显示标题、歌手和专辑");
assert.match(miniPlayer, /@pointerdown="startDrag"/, "迷你播放器应提供卡片拖拽入口");
assert.match(miniPlayer, /Math\.min\([^)]*window\.innerWidth[\s\S]*Math\.min\([^)]*window\.innerHeight/, "迷你播放器拖拽位置应限制在窗口范围内");
assert.match(miniPlayer, /\.mini-controls\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none[^}]*transition:[^}]*300ms\s+ease/, "控制栏默认应隐藏并使用 0.3 秒淡出动画");
assert.match(miniPlayer, /\.mini-player:hover \.mini-controls[^{]*\{[^}]*opacity:\s*1[^}]*pointer-events:\s*auto/, "鼠标悬浮卡片时才应显示控制栏");
assert.match(
  miniPlayer,
  /class="mini-controls"[\s\S]*kind="like"[\s\S]*kind="previous"[\s\S]*kind="toggle"[\s\S]*kind="next"[\s\S]*kind="queue"/,
  "迷你控制栏应按收藏、上一首、播放暂停、下一首、队列排列"
);
assert.match(miniPlayer, /class="mini-close-button"/, "迷你播放器应保留独立关闭按钮");
assert.match(miniPlayer, /<PlayerControlButton/g, "迷你播放器应复用主播放器按钮组件");
assert.match(miniPlayer, /--detail-player-start[\s\S]*transition:[^}]*400ms\s+ease/, "迷你播放器主题色应随封面平滑变化");

assert.match(playerBar, /import PlayerControlButton from/, "主播放器应使用共享按钮组件");
for (const kind of ["previous", "toggle", "next", "like", "queue"]) {
  assert.match(playerBar, new RegExp(`<PlayerControlButton[^>]*kind="${kind}"`), `主播放器应复用 ${kind} 按钮`);
}

assert.match(controlButton, /kind:\s*"like"\s*\|\s*"previous"\s*\|\s*"toggle"\s*\|\s*"next"\s*\|\s*"queue"/, "共享按钮应覆盖迷你播放器所需操作");
assert.match(controlButton, /title="上一首"/, "共享上一首按钮应保留 tooltip");
assert.match(controlButton, /title="播放列表"/, "共享播放列表按钮应保留 tooltip");
assert.match(controlButton, /transport-icon-previous[\s\S]*transport-icon-next[\s\S]*player-queue-icon/, "共享按钮应复用底部播放栏图标");

console.log("迷你悬浮播放器契约通过");
