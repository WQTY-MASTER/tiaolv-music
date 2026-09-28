const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sharedButton = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerControlButton.vue"), "utf8");
const playerBar = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerBar.vue"), "utf8");

assert.match(sharedButton, /\.player-control-button\s*\{[^}]*width:\s*40px[^}]*height:\s*40px[^}]*border:\s*1px\s+solid\s+#d7dddf[^}]*border-radius:\s*10px[^}]*background:\s*#fff/, "普通共享按钮应使用 40px 轻边框统一样式");
assert.match(sharedButton, /\.player-control-button:hover\s*\{[^}]*border-color:\s*#c2cacc[^}]*background:\s*#f3f5f6[^}]*transform:\s*translateY\(-1px\)/, "共享按钮应使用统一悬浮反馈");
assert.match(sharedButton, /\.player-control-button\.compact\s*\{[^}]*width:\s*30px[^}]*height:\s*30px[^}]*border-radius:\s*8px/, "迷你播放器应保留同比例紧凑按钮");
assert.match(sharedButton, /\.player-control-button\.play-button\s*\{[^}]*width:\s*48px[^}]*height:\s*48px[^}]*border-radius:\s*50%/, "主播放按钮应放大到 48px 并保持圆形");
assert.match(sharedButton, /\.player-control-button\.play-button\.compact\s*\{[^}]*width:\s*36px[^}]*height:\s*36px/, "迷你播放器主按钮应使用 36px 紧凑尺寸");
assert.match(sharedButton, /\.transport-icon,\.player-queue-icon\s*\{[^}]*width:\s*20px[^}]*height:\s*20px/, "共享图标应统一为 20px 视觉尺寸");

assert.match(playerBar, /<PlayerControlButton kind="previous"\s+compact/, "底部播放器应启用共享按钮的紧凑规格");
assert.match(playerBar, /<PlayerControlButton kind="toggle"[^>]*compact/, "底部播放器主播放按钮应启用紧凑规格");
assert.match(playerBar, /<PlayerControlButton kind="like"[^>]*compact/, "底部播放器收藏按钮应启用紧凑规格");
assert.match(playerBar, /<PlayerControlButton kind="queue"\s+compact/, "底部播放器列表按钮应启用紧凑规格");
assert.match(playerBar, /\.transport-controls button\s*\{[^}]*width:\s*30px[^}]*height:\s*30px[^}]*flex:\s*0\s+0\s+30px/, "播放传输按钮应保留 30px 紧凑规格");
assert.match(playerBar, /\.player-tools\s*\{[^}]*--player-tool-button-size:\s*36px[^}]*--player-tool-icon-size:\s*18px/, "右侧操作区应统一声明 36px 热区和 18px 图标规格");
assert.match(playerBar, /\.player-tools\s+:deep\(\.player-tool-button\)\s*\{[^}]*width:\s*var\(--player-tool-button-size\)[^}]*height:\s*var\(--player-tool-button-size\)[^}]*flex:\s*0\s+0\s+var\(--player-tool-button-size\)[^}]*border-radius:\s*50%[^}]*padding:\s*0[^}]*line-height:\s*1[^}]*text-align:\s*center/, "右侧所有按钮应使用相同的 36px 点击热区和排版参数");
assert.match(playerBar, /\.player-tools\s+:deep\(\.player-tool-button:hover\)\s*\{[^}]*background:\s*#f3f1f8[^}]*color:\s*var\(--player-accent[^}]*transform:\s*translateY\(-1px\)/, "右侧按钮悬浮时应统一使用当前封面主色");
assert.match(playerBar, /\.player-tools\s+:deep\(\.player-tool-button:active\)\s*\{[^}]*background:\s*#e9e4f1[^}]*transform:\s*translateY\(0\)\s+scale\(\.96\)/, "右侧按钮应使用统一按下反馈");
assert.match(playerBar, /\.transport-controls \.player-control-button\.play-button\.compact\s*\{[^}]*width:\s*44px[^}]*height:\s*44px[^}]*border-radius:\s*50%/, "播放栏主按钮应覆盖共享样式并使用 44px 圆形规格");
assert.match(playerBar, /grid-template-columns:\s*minmax\(150px,\.85fr\)\s+minmax\(320px,1\.5fr\)\s+minmax\(230px,\.85fr\)/, "播放栏应按参考图分配三段区域并兼容 1024px 窗口");
assert.match(playerBar, /class="player-tool-button"[^>]*kind="like"|kind="like"[^>]*class="player-tool-button"/, "收藏按钮应接入统一操作按钮样式");
assert.match(playerBar, /class="player-tool-button"[^>]*kind="queue"|kind="queue"[^>]*class="player-tool-button"/, "播放列表按钮应接入统一操作按钮样式");
assert.match(playerBar, /\.player-tools\s*\{[^}]*gap:\s*4px/, "工具按钮应使用参考图的轻量间距");
assert.match(playerBar, /\.player-volume-wrap\s*\{[^}]*display:\s*grid/, "底部播放器应显示音量按钮");
assert.match(playerBar, /class="lyrics-icon">词<\/span>/, "歌词按钮应使用独立的小方框图标");
assert.match(playerBar, /\.player-tools\s+:deep\(\.player-like-icon\),[\s\S]*?\.player-hifi-icon\s*\{[^}]*width:\s*var\(--player-tool-icon-size\)[^}]*height:\s*var\(--player-tool-icon-size\)/, "右侧全部图标应使用统一的 18px 视觉容器");
assert.match(playerBar, /\.lyrics-icon\s*\{[^}]*border:\s*1px\s+solid\s+currentColor[^}]*border-radius:\s*3px/, "歌词图标应匹配参考图的小型方框样式");
assert.doesNotMatch(playerBar, /\.lyrics-button\s*\{[^}]*!important/, "歌词按钮不应再使用独立尺寸或边框覆盖");

console.log("播放器控制按钮统一样式契约通过");
