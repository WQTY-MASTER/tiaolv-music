const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "src/renderer/src/components/SidebarNav.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(sidebar, /id:\s*"artists"[\s\S]{0,90}label:\s*"艺术家"/, "侧栏需要保留艺术家入口");
assert.match(sidebar, /id:\s*"artists"[\s\S]{0,90}icon:\s*"🎙"/, "艺术家入口应使用话筒图标");

assert.match(app, /interface LocalArtist/, "艺术家页需要本地艺术家聚合模型");
assert.match(app, /localArtistSearchKeyword = ref\(""\)/, "艺术家页需要实时搜索关键词状态");
assert.match(app, /localArtistSortMode = ref<[^>]+>\("name-asc"\)/, "艺术家页默认排序应为名称 A-Z");
assert.match(app, /localArtistGenreFilter = ref\("全部流派"\)/, "艺术家页默认流派筛选应为全部流派");
assert.match(app, /selectedLocalArtist = ref<LocalArtist \| null>\(null\)/, "艺术家页需要选中的艺术家详情状态");
assert.match(app, /localArtists = computed<LocalArtist\[\]>/, "艺术家页数据应从本地歌曲表聚合");
assert.match(app, /filteredLocalArtists/, "艺术家页需要搜索、排序和流派过滤后的列表");
assert.match(app, /artistAlphabetIndex/, "艺术家页需要 A-Z 字母索引状态");
assert.match(app, /scrollToArtistLetter/, "艺术家页字母索引需要滚动定位逻辑");
assert.match(app, /openLocalArtist/, "点击艺术家卡片需要进入艺术家详情页");

assert.match(app, /local-artists-page/, "艺术家页缺少独立页面容器");
assert.match(app, /<h1>艺术家<\/h1>/, "艺术家页主标题应为艺术家");
assert.match(app, /共 \{\{ filteredLocalArtists\.length \}\} 位艺术家/, "艺术家页标题旁需要展示艺术家统计");
for (const text of ["名称 A-Z", "名称 Z-A", "歌曲数量多→少", "歌曲数量少→多"]) {
  assert.match(app, new RegExp(text), `艺术家排序下拉缺少 ${text}`);
}
assert.match(app, /全部流派/, "艺术家页缺少全部流派选项");
assert.match(app, /placeholder="搜索歌曲、歌手、专辑或文件夹"/, "艺术家页搜索框占位文案不正确");
assert.match(app, /local-artist-grid/, "艺术家页缺少卡片网格");
assert.match(app, /local-artist-card/, "艺术家页缺少艺术家卡片");
assert.match(app, /artist\.trackCount\s*\}\} 首/, "艺术家卡片需要展示歌曲数量");
assert.match(app, /data-artist-letter/, "艺术家分组需要可供 A-Z 定位的标记");
assert.match(app, /local-artist-index/, "艺术家页缺少右侧 A-Z 索引栏");
assert.match(app, /ABCDEFGHIJKLMNOPQRSTUVWXYZ/, "艺术家页索引栏应包含 A-Z 26 个字母");
assert.match(app, /local-artist-detail/, "艺术家详情页缺少独立区域");
assert.match(app, /localArtistAlbums/, "艺术家详情页需要展示该艺术家的专辑集合");
assert.match(app, /selectedLocalArtist\.tracks/, "艺术家详情页需要展示该艺术家的歌曲列表");
assert.match(app, /\.local-artist-card:hover\s+\.[\s\S]*transform:\s*translateY\(-4px\)/, "艺术家卡片封面需要 hover 上浮动画");
assert.match(app, /currentLibrary\.value/, "艺术家页数据应来自本地曲库");

assert.match(packageJson, /local-artists-page-contract\.test\.cjs/, "测试脚本需要包含艺术家页契约");

console.log("本地艺术家页契约通过");
