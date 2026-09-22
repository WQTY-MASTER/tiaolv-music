const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const componentPath = path.join(root, "src/renderer/src/components/StreamingPlaylistDiscoveryPage.vue");

assert.equal(fs.existsSync(componentPath), true, "发现歌单应使用独立页面组件");
const component = fs.readFileSync(componentPath, "utf8");

for (const apiName of ["loadPlaylistCategories", "loadDiscoveredPlaylists", "loadHighQualityPlaylists", "updatePlaylistPlayCount"]) {
  assert.match(api, new RegExp(`export (?:async )?function ${apiName}\\b`), `缺少发现歌单接口：${apiName}`);
}
assert.match(component, /PLAYLIST DISCOVERY/);
assert.match(component, /全部歌单/);
assert.match(component, /精品歌单/);
assert.match(component, /最热/);
assert.match(component, /最新/);
assert.match(component, /class="playlist-discovery-sort"/);
assert.match(component, /class="playlist-discovery-quality"/);
assert.match(component, /class="playlist-discovery-tags"[\s\S]*class="playlist-discovery-tag-list"[\s\S]*class="playlist-discovery-actions"[\s\S]*class="playlist-discovery-modes"[\s\S]*class="playlist-discovery-all-tags"/, "分类、排序与全部分类应合并为同一工具栏");
assert.match(component, /全部分类/);
assert.match(component, /class="playlist-discovery-filter-panel"/);
assert.match(component, /v-for="\(tags, group\) in categoryGroups"/);
assert.match(component, /class="playlist-discovery-grid"/);
assert.match(component, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
assert.match(component, /\.playlist-discovery-card\.featured\{grid-column:span 2/);
assert.match(component, /\.playlist-discovery-card\.featured\{[^}]*grid-row:span 2[^}]*align-self:stretch/,
  "主打歌单应完整拉伸到两行高度");
assert.match(component, /\.playlist-discovery-card\.featured \.playlist-discovery-cover\{[^}]*height:100%[^}]*aspect-ratio:auto/,
  "主打封面应填满跨两行的卡片");
assert.match(component, /\.playlist-discovery-page\{width:min\(1420px,100%\);margin-inline:auto/);
assert.match(component, /\.playlist-discovery-grid\{display:grid;width:100%;margin-inline:0;padding-inline:0/);
assert.match(component, /\.playlist-discovery-tags\{[^}]*display:grid[^}]*grid-template-columns:minmax\(0,1fr\) auto[^}]*align-items:center/, "顶部标签与右侧操作应在同一基线");
assert.match(component, /\.playlist-discovery-actions\{[^}]*display:flex[^}]*align-items:center[^}]*justify-content:flex-end/, "排序与全部分类应组成靠右操作区");
assert.match(component, /grid-template-rows 250ms ease/);
assert.match(component, /opacity 250ms ease/);
assert.match(component, /class="playlist-discovery-card"/);
assert.doesNotMatch(component, /IntersectionObserver/, "分页模式不应再监听滚动触底");
assert.doesNotMatch(component, /playlist-discovery-sentinel/, "分页模式不应保留无限滚动哨兵");
assert.match(component, /class="playlist-discovery-pagination"/, "歌单列表底部应提供分页器");
assert.match(component, /emit\("changePage", props\.page - 1\)/, "上一页应请求前一页");
assert.match(component, /emit\("changePage", props\.page \+ 1\)/, "下一页应请求后一页");
assert.match(component, /:disabled="page <= 1 \|\| loading"/, "第一页或加载中应禁用上一页");
assert.match(component, /:disabled="!hasMore \|\| loading"/, "无更多数据或加载中应禁用下一页");
assert.match(component, /class="playlist-discovery-to-top"/);
assert.match(component, /emit\("select", playlist\)/);

assert.match(app, /StreamingPlaylistDiscoveryPage/);
assert.match(app, /loadPlaylistDiscovery/);
assert.match(app, /const playlistDiscoveryPage = ref\(1\)/, "发现歌单应维护当前页码");
assert.match(app, /const PLAYLIST_DISCOVERY_PAGE_SIZE = 30/, "发现歌单应使用固定每页数量");
assert.match(app, /\(requestedPage - 1\) \* PLAYLIST_DISCOVERY_PAGE_SIZE/, "普通歌单分页应使用页码计算 offset");
assert.match(app, /playlistDiscoveryPlaylists\.value = incoming/, "翻页时应替换列表而不是持续追加");
assert.match(app, /@change-page="changePlaylistDiscoveryPage"/, "分页器应连接页面加载逻辑");
assert.doesNotMatch(app, /@load-more="loadPlaylistDiscovery\(false\)"/, "发现歌单不应再注册无限加载事件");
assert.match(app, /loadPlaylistCategories/);
assert.match(app, /streamingTemplate:\s*true/);
assert.match(app, /@select="openDiscoveredPlaylist"/);
assert.match(app, /updatePlaylistPlayCount/);
assert.match(app, /'is-discovery-heading': appMode === 'streaming' && activeView === 'discover'/);
assert.match(app, /\.page-heading\.is-discovery-heading\s*\{[^}]*width:\s*min\(1420px,\s*100%\)/);
assert.match(app, /\.page-heading\.is-discovery-heading\s*\{[^}]*align-items:\s*center[^}]*margin:\s*4px\s+auto\s+14px[^}]*padding-bottom:\s*16px[^}]*border-bottom:\s*1px\s+solid/, "发现歌单标题与搜索框应使用紧凑同排头部");
assert.match(app, /\.page-heading\.is-discovery-heading\s+\.eyebrow,\s*\.page-heading\.is-discovery-heading\s+\.page-subtitle\s*\{[^}]*display:\s*none/, "发现歌单外层头部不应重复显示通用眉题和副标题");
assert.match(app, /\.app-shell\.is-sidebar-collapsed \.page-heading\.is-discovery-heading\s*\{[^}]*margin-top:\s*72px/);

console.log("发现歌单页面契约通过");
