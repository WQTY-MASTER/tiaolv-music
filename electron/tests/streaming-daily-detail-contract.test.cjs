const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const componentPath = path.join(root, "src/renderer/src/components/StreamingDailyMixPage.vue");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");

assert.equal(fs.existsSync(componentPath), true, "每日推荐应使用独立详情组件");
const component = fs.readFileSync(componentPath, "utf8");

assert.match(component, /每日推荐/);
assert.match(component, /title\?: string/);
assert.match(component, /label\?: string/);
assert.match(component, /\{\{ title \|\| "每日推荐" \}\}/);
assert.match(component, /在歌单中搜索/);
assert.match(component, /默认顺序/);
assert.match(component, /歌曲名称/);
assert.match(component, /歌手/);
assert.match(component, /专辑/);
assert.match(component, /时长/);
assert.match(component, /定位到当前播放歌曲/);
assert.match(component, /刷新歌单/);
assert.match(component, /降序，点击切换升序|升序，点击切换降序/);
assert.match(component, /data-track-id/);
assert.match(component, /scrollIntoView/);
assert.match(component, /toggle-favorite/);
assert.match(component, /reorder: \[draggedTrackId: string, targetTrackId: string\]/);
assert.match(component, /draggable="true"/);
assert.match(component, /@dragstart="startTrackDrag\(track\.id\)"/);
assert.match(component, /@drop\.prevent="dropTrack\(track\.id\)"/);
assert.match(component, /play-all/);
assert.match(component, /play-random/);
assert.match(component, /search-global/);
assert.match(component, /Pause/);
assert.match(component, /class="daily-detail-playing-indicator"/);
assert.match(component, /v-if="track\.id === currentTrackId"/);
assert.match(component, /isPlaying:\s*boolean/, "每日推荐详情应接收全局播放状态");
assert.match(component, /v-if="isPlaying"\s+class="daily-detail-playing-bars"/, "播放中应显示动态音条");
assert.match(component, /<i><\/i><i><\/i><i><\/i>/, "动态播放状态应由三根音条组成");
assert.match(component, /<Pause\s+v-else/, "暂停时应显示静态暂停图标");
assert.match(
  component,
  /\.daily-detail-page\s*\{[^}]*padding:\s*64px\s+10px\s+0/,
  "每日推荐详情页应下移顶部工具区，但末尾不应叠加播放器留白",
);
assert.match(component, /class="daily-detail-label-title">\{\{ label \|\| "推荐" \}\}</, "推荐标签标题应支持每日推荐与精选歌单共用");
assert.match(component, /class="daily-detail-label-count">・\s*\{\{\s*tracks\.length\s*\}\}\s*首</, "每日推荐数量应使用接口实际返回的歌曲数并弱化显示");
assert.doesNotMatch(component, /tracks\.(?:slice|splice)\([^)]*30/, "每日推荐不应固定截断为 30 首");
assert.match(component, /class="daily-detail-cover-chrome"/, "每日推荐封面应包含模拟窗口标题栏");
assert.match(component, /class="daily-detail-cover-media"/, "每日推荐封面图片应置于独立的窗口内容区");
assert.match(component, /ArrowLeftRight/, "随机按钮应使用双向箭头图标");
assert.match(
  component,
  /\.daily-detail-table-head span:nth-child\(3\)\s*\{[^}]*padding-left:\s*37px/,
  "专辑列表头应避开歌曲收藏按钮并与专辑名称对齐",
);
assert.match(
  component,
  /\.daily-detail-table-head span:last-child\s*\{[^}]*text-align:\s*right/,
  "时长列表头应与右对齐的歌曲时长保持一致",
);
assert.match(component, /\.daily-detail-cover-chrome\s*\{[^}]*border-bottom:\s*1px\s+solid\s+#ececef/, "模拟窗口标题栏应带细分隔线");
assert.match(component, /\.daily-detail-label::before\s*\{[^}]*background:\s*#d64c33/, "推荐标签应带红色短线标记");
assert.match(component, /\.daily-detail-label-title\s*\{[^}]*color:\s*#d64c33/, "推荐文字应保持红色强调");
assert.match(component, /\.daily-detail-label-count\s*\{[^}]*color:\s*#a6a7aa/, "推荐歌曲数量应使用浅灰色");
assert.match(component, /\.daily-detail-stats span:first-child\s*\{[^}]*background:\s*#faf8f2[^}]*color:\s*#292d33/, "时长标签应使用米白底深色文字");
assert.match(component, /\.daily-detail-stats span:last-child\s*\{[^}]*background:\s*#f1f1f2[^}]*color:\s*#a1a3a7/, "歌曲数量标签应使用弱化灰色样式");
assert.match(component, /\.daily-detail-table-head\s*\{[^}]*background:\s*#fbfaf7/, "歌曲表头应使用浅米白底色");
assert.match(component, /\.daily-detail-row\.active\s*\{[^}]*background:\s*var\(--app-playing-background\)/, "当前歌曲行应使用全局浅米色高亮");
assert.match(component, /\.daily-detail-playing-indicator\s*\{[^}]*border-radius:\s*50%[^}]*background:\s*#137f76/, "当前歌曲应显示圆形播放状态图标");
assert.match(component, /@keyframes\s+daily-playing-bar/, "播放音条应包含循环跳动动画");
assert.match(component, /\.daily-detail-playing-bars i:nth-child\(2\)\s*\{[^}]*animation-delay:/, "播放音条应错峰跳动");
assert.match(app, /StreamingDailyMixPage/);
assert.match(app, /isStreamingDailyPlaylist/);
assert.match(app, /isStreamingTemplatePlaylist/);
assert.match(app, /:title="selectedPlaylist\.title"/);
assert.match(app, /:cover-url="selectedPlaylist\.imageUrl"/);
assert.match(app, /@refresh="refreshStreamingPlaylist"/);
assert.match(app, /@reorder="reorderStreamingPlaylistTrack"/);
assert.match(app, /@refresh="refreshStreamingPlaylist"/);
assert.match(app, /@locate|current-track-id/);
assert.match(app, /const isPlaybackStarting = ref\(false\)/, "播放器应记录歌曲启动中的过渡状态");
assert.match(app, /async function playTrack[\s\S]{0,180}isPlaybackStarting\.value\s*=\s*true/, "点击歌曲后应立即进入启动状态");
assert.match(app, /:is-playing="isPlaying \|\| isPlaybackStarting"/, "每日推荐详情应在播放启动阶段直接显示动态音条");
assert.match(app, /if \(!audio \|\| !playbackTrack\.audioUrl\)[\s\S]{0,120}isPlaybackStarting\.value\s*=\s*false/, "播放地址不可用时应结束启动状态");
assert.match(app, /await audio\.play\(\)[\s\S]{0,180}isPlaybackStarting\.value\s*=\s*false/, "音频开始播放后应结束启动状态");
assert.doesNotMatch(app, /class="topbar"|floatingTopbarVisible|handleMainScroll/, "每日推荐详情不应残留已废弃的全局浮动状态栏");

console.log("流媒体每日推荐详情页契约通过");
