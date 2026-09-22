const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(app, /historySearchKeyword = ref\(""\)/, "最近播放页需要独立搜索状态");
assert.match(app, /historySourceFilter = ref<HistorySource>\("local"\)/, "最近播放页默认展示本地音乐历史");
assert.match(app, /historySortMode = ref<HistorySortMode>\("recent"\)/, "最近播放页默认按最近播放倒序");
assert.match(app, /filteredHistoryTracks = computed[\s\S]*historyTracks\.value[\s\S]*historySearchKeyword[\s\S]*historySourceFilter[\s\S]*historySortMode/, "最近播放列表应支持搜索、音源筛选和排序");
assert.match(app, /historyTrackSummary = computed[\s\S]*首\s*·[\s\S]*分钟/, "最近播放标题应展示歌曲数和总时长");
assert.match(app, /function resetHistoryFilters[\s\S]*historySortMode\.value = "recent"/, "筛选器应支持重置");
assert.match(app, /function playAllHistoryTracks[\s\S]*filteredHistoryTracks\.value[\s\S]*playbackQueue/, "播放全部应使用当前可见历史建立队列");
assert.match(app, /function playRandomHistoryTracks[\s\S]*filteredHistoryTracks\.value[\s\S]*playbackQueue/, "随机播放应使用当前可见历史建立队列");
assert.match(app, /function playHistoryTrack[\s\S]*filteredHistoryTracks\.value[\s\S]*playTrack/, "点击历史歌曲应从历史列表播放");

assert.match(app, /activeView === 'history'[\s\S]*class="recent-history-page"/, "最近播放应使用独立页面");
assert.match(app, /<h1>最近播放<\/h1>/, "最近播放页需要正确的大标题");
assert.match(app, /播放全部[\s\S]*随机播放/, "最近播放页缺少播放全部或随机播放按钮");
assert.match(app, /v-model="historySourceFilter"[\s\S]*本地音乐[\s\S]*网易云[\s\S]*QQ 音乐/, "音源选择应包含本地音乐、网易云和 QQ 音乐");
assert.match(app, /class="recent-history-filter"[\s\S]*最新播放[\s\S]*最早播放[\s\S]*重置筛选/, "筛选器应包含排序与重置操作");
assert.match(app, /v-model="historySearchKeyword"[\s\S]*placeholder="搜索歌曲、歌手、专辑或文件夹"/, "最近播放搜索框文案不正确");
assert.match(app, /class="recent-history-table-head"[\s\S]*#[\s\S]*标题[\s\S]*专辑[\s\S]*时长/, "最近播放表头不完整");
assert.match(app, /localTrackAudioInfo\(track\)/, "歌曲时长下方应展示格式、采样率和位深");
assert.match(app, /class="recent-history-empty"/, "最近播放页需要空状态");
assert.match(app, /activeView !== 'history'[\s\S]*class="section-block track-section"/, "最近播放页不应再渲染通用歌曲区");
assert.match(app, /\.recent-history-row:hover[\s\S]*background:/, "歌曲行需要 hover 高亮");
assert.match(app, /\.recent-history-table-head span:nth-child\(3\),\.recent-history-table-head span:nth-child\(4\)\s*\{[^}]*text-align:\s*right/, "专辑和时长表头应与对应内容右对齐");
assert.match(app, /\.recent-history-album\s*\{[^}]*min-height:\s*36px/, "专辑名称应占用与两行时长信息相同的高度以对齐首行");
assert.match(packageJson, /recent-history-page-contract\.test\.cjs/, "测试脚本需要包含最近播放页面契约");

console.log("最近播放页面契约通过");
