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
assert.match(app, /\.local-artist-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*min\(188px,\s*100%\)\)/, "艺术家卡片应保持固定宽度，仅在容器不足一列时缩小，侧栏开合不能拉伸封面");
assert.match(app, /local-artist-card/, "艺术家页缺少艺术家卡片");
assert.match(app, /artist\.trackCount\s*\}\} 首/, "艺术家卡片需要展示歌曲数量");
assert.match(app, /data-artist-letter/, "艺术家分组需要可供 A-Z 定位的标记");
assert.match(app, /local-artist-index/, "艺术家页缺少右侧 A-Z 索引栏");
assert.match(app, /ABCDEFGHIJKLMNOPQRSTUVWXYZ/, "艺术家页索引栏应包含 A-Z 26 个字母");
const mainCloseIndex = app.indexOf("</main>");
const artistIndexPosition = app.indexOf('class="local-artist-index"');
assert.ok(artistIndexPosition > mainCloseIndex, "固定字母索引必须位于页面过渡容器外，避免进入动画改变 fixed 定位参照");
assert.match(app, /<Transition name="artist-index">[\s\S]*?class="local-artist-index"/, "字母索引外框应使用独立淡入过渡");
assert.match(app, /v-for="\(item, index\) in artistAlphabetIndex"[\s\S]{0,420}:style="\{ '--artist-letter-index': index \}"/, "A-Z 字母应按索引设置错峰动画顺序");
assert.match(app, /@keyframes artist-index-letter-enter\s*\{[\s\S]*?opacity:\s*0[\s\S]*?opacity:\s*1[\s\S]*?\}/, "字母应使用只改变透明度的顺序入场动画");
assert.match(app, /\.artist-index-enter-active\s*\{[^}]*transition:\s*opacity\s+320ms/, "字母索引外框应缓慢淡入");
assert.doesNotMatch(app, /\.artist-index-enter-(?:active|from)\s*\{[^}]*transform:/, "字母索引入场不能使用位移，避免 fixed 定位再次跳动");
assert.match(app, /selectedLocalArtistLetter = ref\(""\)/, "艺术家字母索引应记录鼠标选择的当前字母");
assert.match(app, /:class="\{ active: selectedLocalArtistLetter === item\.letter \}"/, "当前字母应具有稳定的选中样式");
assert.match(app, /:aria-current="selectedLocalArtistLetter === item\.letter \? 'true' : undefined"/, "字母索引应向辅助技术暴露当前选中项");
assert.match(app, /function scrollToArtistLetter\(letter: string\)[\s\S]{0,180}selectedLocalArtistLetter\.value = letter/, "点击字母时应立即更新选中状态");
assert.match(app, /\.local-artist-index button\s*\{[^}]*font-size:\s*11px[^}]*transition:[^}]*transform/s, "字母索引应提高字号并使用平滑缩放");
assert.match(app, /\.local-artist-index button:not\(:disabled\):hover[^{]*\{[^}]*transform:\s*scale\(1\.45\)/s, "可用字母应随鼠标悬停放大");
assert.match(app, /\.local-artist-index button\.active\s*\{[^}]*transform:\s*scale\(1\.35\)/s, "点击选中的字母应保持放大与高亮");
assert.match(app, /local-artist-detail/, "艺术家详情页缺少独立区域");
assert.match(app, /localArtistAlbums/, "艺术家详情页需要展示该艺术家的专辑集合");
assert.match(app, /selectedLocalArtist\.tracks/, "艺术家详情页需要展示该艺术家的歌曲列表");
assert.match(app, /\.local-artist-card:hover\s+\.[\s\S]*transform:\s*translateY\(-4px\)/, "艺术家卡片封面需要 hover 上浮动画");
assert.match(app, /currentLibrary\.value/, "艺术家页数据应来自本地曲库");

assert.match(packageJson, /local-artists-page-contract\.test\.cjs/, "测试脚本需要包含艺术家页契约");

console.log("本地艺术家页契约通过");
