const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const page = fs.readFileSync(path.join(root, "src/renderer/src/components/AggregatePlaylistPage.vue"), "utf8");
const service = fs.readFileSync(path.join(root, "src/renderer/src/services/aggregatePlaylists.ts"), "utf8");

assert.match(app, /import AggregatePlaylistPage from/, "应用应接入独立聚合歌单页面组件");
assert.match(app, /activeView === 'aggregate'/, "聚合歌单导航应渲染独立页面");
assert.match(app, /AGGREGATE_PLAYLIST_STORAGE_KEY/, "聚合歌单应使用独立本地存储键");
assert.match(app, /<PlayerBar[\s\S]*v-if="!shouldHidePlayerBar && !showSongDetail && !miniPlayerVisible"/, "聚合歌单页面应继续使用全局底部播放栏");

assert.match(page, />聚合歌单</, "页面应显示聚合歌单标题");
assert.match(page, /本地维护的跨平台虚拟歌单，可混合本地、网易云与 QQ 音乐；同名同歌手自动合并。/, "页面应说明聚合歌单只在本地维护并支持跨平台音源");
assert.match(page, /class="aggregate-new-button"[\s\S]*新建聚合歌单/, "页面右上角应提供新建按钮");
assert.match(page, /class="aggregate-create-card"/, "卡片网格首项应为虚线新建卡片");
assert.match(page, /跨音源收歌/, "新建卡片应显示跨音源说明");
assert.match(page, /class="aggregate-playlist-card"/, "页面应展示聚合歌单内容卡片");
assert.match(page, /class="aggregate-dialog"/, "点击新建应打开创建弹窗");
assert.match(page, /歌单名称不能为空/, "创建弹窗应校验空名称");
assert.match(page, /class="aggregate-detail"/, "内容卡片应进入聚合歌单详情");
assert.match(page, /class="aggregate-source-switch"/, "聚合歌曲行应支持切换保留的音源");
assert.match(page, /class="aggregate-track-row"[\s\S]*@click="playGroup\(group\)"/, "点击聚合歌曲整行应播放当前选中的音源");
assert.doesNotMatch(page, /aggregate-track-play-icon/, "聚合歌曲行首不应再显示蓝色播放图标");
assert.match(page, /class="aggregate-track-index"/, "聚合歌曲行首应始终保留数字序号");
assert.match(page, /draggable="true"[\s\S]*@dragstart="startGroupDrag\(group\.id\)"[\s\S]*@drop(?:\.[a-z]+)*="dropGroup\(group\.id\)"/, "聚合歌曲整行应默认支持拖拽排序");
assert.match(page, /aggregateFolderFilter/, "聚合歌单应保留文件夹筛选");
assert.match(page, /aggregateSourceFilter/, "聚合歌单应保留来源筛选");
assert.doesNotMatch(page, />排序<|>顺序<|重置排序/, "聚合歌单不应提供自动排序控件");
assert.match(page, /v-if="group\.sources\.length === 1"[\s\S]*class="aggregate-source-label"/, "单音源歌曲应只显示来源文字");
assert.match(page, /v-else[\s\S]*class="aggregate-source-switch"/, "多音源歌曲才应显示来源下拉框");
assert.doesNotMatch(page, /aggregate-remove-source|移除当前音源/, "歌曲行不应显示单独移除当前音源的减号按钮");
assert.match(page, /removeGroup\(group\)/, "歌曲行应支持一次删除整行及全部音源");
assert.match(page, /title="从聚合歌单移除（含这首歌的全部音源）"/, "整首删除按钮应使用明确的完整音源移除提示");
assert.match(page, /\.aggregate-track-head span:first-child\s*\{[^}]*text-align:\s*center/, "表头井号应与歌曲序号居中对齐");
assert.match(page, /\.aggregate-track-head span:last-child\s*\{[^}]*text-align:\s*center/, "操作表头应与整首删除按钮居中对齐");
assert.match(page, /\.aggregate-remove-group\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/, "整首删除按钮默认应隐藏且不可误触");
assert.match(page, /\.aggregate-track-row:hover \.aggregate-remove-group[^{]*\{[^}]*opacity:\s*1[^}]*pointer-events:\s*auto/, "鼠标悬停歌曲行时才应显示整首删除按钮");
assert.match(page, /playAll\(false\)[\s\S]*播放全部[\s\S]*playAll\(true\)[\s\S]*随机播放/, "聚合歌单应支持按已选音源连续或随机播放");
assert.match(page, /function resolvedCoverUrl[\s\S]*resolveBackendUrl\(url\)/, "聚合歌曲封面应解析后端相对地址并保留本地文件地址");
assert.match(page, /aggregatePlaylistCover/, "聚合歌单卡片应使用自定义封面或第一首歌曲封面");

assert.match(service, /function normalizeTrackIdentity/, "服务应规范化歌曲身份用于同名合并");
assert.match(service, /function mergeAggregateTracks/, "服务应提供多音源歌曲合并逻辑");
assert.match(service, /sources:/, "合并后的歌曲行应保留全部底层音源");
assert.match(service, /createAggregatePlaylist/, "服务应提供聚合歌单创建逻辑");
assert.match(service, /readAggregatePlaylists/, "服务应提供持久化读取逻辑");
assert.match(service, /writeAggregatePlaylists/, "服务应提供持久化写入逻辑");
assert.match(service, /removeAggregateTrackSource/, "服务应支持只删除一个音源");
assert.match(service, /removeAggregateTrackGroup/, "服务应支持删除整行全部音源");
assert.match(service, /reorderAggregateTrackGroups/, "服务应支持整行移动聚合歌曲及其全部音源");

console.log("聚合歌单页面契约通过");
