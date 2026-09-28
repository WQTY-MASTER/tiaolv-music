const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const dailyDetail = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingDailyMixPage.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(app, /historySearchKeyword = ref\(""\)/, "最近播放页需要独立搜索状态");
assert.match(app, /type HistorySource = "all" \| "local" \| "netease" \| "qq"/, "最近播放音源类型应包含全部");
assert.match(app, /historySourceOptions = \[\s*\{ value: "all", label: "全部" \},\s*\{ value: "local", label: "本地音乐" \},\s*\{ value: "netease", label: "网易云" \},\s*\{ value: "qq", label: "QQ 音乐" \}/, "全部应位于音源选项首位");
assert.match(app, /historySourceFilter = ref<HistorySource>\("all"\)/, "最近播放页默认汇总全部音源历史");
assert.match(app, /historySortMode = ref<HistorySortMode>\("recent"\)/, "最近播放页默认按最近播放倒序");
assert.match(app, /filteredHistoryTracks = computed[\s\S]*historyTracks\.value[\s\S]*historySearchKeyword[\s\S]*historySourceFilter[\s\S]*historySortMode/, "最近播放列表应支持搜索、音源筛选和排序");
assert.match(app, /historyTrackSummary = computed[\s\S]*首\s*·[\s\S]*分钟/, "最近播放标题应展示歌曲数和总时长");
assert.match(app, /function resetHistoryFilters[\s\S]*historySourceFilter\.value = "all"[\s\S]*historySortMode\.value = "recent"/, "重置筛选应恢复全部音源和最新播放顺序");
assert.match(app, /function playAllHistoryTracks[\s\S]*filteredHistoryTracks\.value[\s\S]*playbackQueue/, "播放全部应使用当前可见历史建立队列");
assert.match(app, /function playRandomHistoryTracks[\s\S]*filteredHistoryTracks\.value[\s\S]*playbackQueue/, "随机播放应使用当前可见历史建立队列");
assert.match(app, /function playHistoryTrack[\s\S]*filteredHistoryTracks\.value[\s\S]*playTrack/, "点击历史歌曲应从历史列表播放");
assert.match(app, /historySourceTracks = computed[\s\S]*historySourceFilter\.value === "all"[\s\S]*historyTracks\.value[\s\S]*getHistoryTrackSource[\s\S]*historySourceFilter/, "流媒体最近播放应汇总全部音源或按所选音源过滤");
assert.match(app, /function changeHistorySource[\s\S]*source === "all"[\s\S]*source === "local"[\s\S]*source === "netease"[\s\S]*source === "qq"/, "音源切换应接受全部及三个独立音源");
assert.match(app, /<StreamingDailyMixPage[\s\S]{0,500}activeView === 'history'[\s\S]{0,900}:source-options="historySourceOptions"[\s\S]{0,300}title="最近播放"/, "流媒体最近播放应复用现有歌单详情样式并保留音源选择");
assert.match(app, /activeView === 'history' && appMode !== 'streaming'/, "本地模式最近播放应继续使用原页面");
assert.match(app, /@play="playHistoryTrackById"[\s\S]*@play-all="playHistoryTrackList"[\s\S]*@play-random="playHistoryTrackListRandom"/, "新版最近播放应绑定歌曲播放操作");
assert.match(dailyDetail, /sourceOptions\?:[\s\S]*sourceValue\?:/, "歌单详情组件应支持可选音源选择器");
assert.match(dailyDetail, /function emitSourceChange[\s\S]*class="daily-detail-source-select"[\s\S]*@change="emitSourceChange"/, "歌单详情工具栏应展示并派发音源切换");

assert.match(app, /activeView === 'history'[\s\S]*class="recent-history-page"/, "最近播放应使用独立页面");
assert.match(app, /<h1>最近播放<\/h1>/, "最近播放页需要正确的大标题");
assert.match(app, /播放全部[\s\S]*随机播放/, "最近播放页缺少播放全部或随机播放按钮");
assert.match(app, /v-model="historySourceFilter"[\s\S]*<option value="all">全部<\/option>[\s\S]*本地音乐[\s\S]*网易云[\s\S]*QQ 音乐/, "音源选择应将全部放在本地音乐、网易云和 QQ 音乐之前");
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
