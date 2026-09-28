const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const componentPath = path.join(root, "src/renderer/src/components/StreamingSearchPage.vue");

assert.equal(fs.existsSync(componentPath), true, "流媒体搜索应使用独立结果页组件");
const component = fs.readFileSync(componentPath, "utf8");

assert.match(app, /const SEARCH_DEBOUNCE_MS = 500/);
assert.match(app, /watch\(keyword[\s\S]*setTimeout\([\s\S]*SEARCH_DEBOUNCE_MS/, "输入应在停止 500ms 后自动搜索");
assert.match(app, /searchTab = ref<SearchTab>\("song"\)/);
assert.match(app, /const SEARCH_PAGE_SIZE = 30/);
assert.match(app, /changeSearchTab/);
assert.match(app, /changeSearchPage/);
assert.match(app, /submittedKeyword\.value = ""[\s\S]*searchState\.value = "idle"/, "清空输入应复位搜索页");
assert.match(app, /selectStreamingSource[\s\S]*performSearch\(1\)/, "切换音源时应保留关键词并重新搜索");
assert.match(app, /if \(submittedKeyword\.value\)[\s\S]*clearSearchResultItems\(\)[\s\S]*performSearch\(1\)/, "切换音源后必须先清空上一个音源的搜索结果再重新请求");
assert.match(app, /searchToast/, "搜索失败应显示 toast");
assert.match(app, /searchError\.value = "搜索暂时不可用"/, "搜索接口失败时应使用统一错误提示");
assert.match(app, /mainScrollElement\.value\?\.scrollTo\(\{ top: 0, behavior: "smooth" \}\)/, "搜索后应保留完整顶部标题与搜索框");
assert.doesNotMatch(app, /document\.querySelector<HTMLElement>\("\.streaming-search-page"\)\?\.scrollIntoView/, "搜索结果不应把顶部搜索框滚出视口");
assert.match(app, /return `搜索: \$\{submittedKeyword\.value\}`/, "搜索页标题应使用“搜索: 关键词”格式");
assert.match(app, /'is-search-heading': appMode === 'streaming' && Boolean\(submittedKeyword\)/, "搜索结果页应使用紧凑标题样式");
assert.match(app, /class="eyebrow search-eyebrow">搜索</, "搜索页标题上方应显示红色小号搜索眉题");
assert.match(app, /\.page-heading \.search-eyebrow\s*\{[^}]*font-size:\s*10px/, "红色搜索眉题应适度放大");
assert.match(app, /\.page-heading \.search-eyebrow::before\s*\{[^}]*width:\s*15px/, "红色眉题短线应与文字同步放大");
assert.match(app, /\.page-heading\.is-search-heading\s*\{[^}]*width:\s*min\(1420px,100%\)[^}]*margin:\s*72px auto 14px/, "搜索页标题应与结果区共用居中容器并保持相同纵向位置");
assert.doesNotMatch(app, /\.app-shell\.is-sidebar-collapsed \.page-heading\.is-search-heading/, "侧边栏收起时搜索页只能左右伸缩，不能上下移动");
assert.match(app, /v-if="keyword"[\s\S]*class="streaming-search-clear"/, "输入内容存在时才显示清除按钮");
assert.match(app, /ref="streamingSearchInput"[\s\S]*type="text"/, "搜索框应使用自定义的唯一清除按钮");
assert.match(app, /function clearStreamingSearch\(\)/, "搜索框应提供独立清除交互");
assert.match(app, /'is-focused': streamingSearchFocused/, "搜索框聚焦状态应由输入焦点明确控制");
assert.match(app, /\.streaming-home-search\.is-focused[\s\S]*#e86b3f/, "聚焦后边框与图标应切换为橙色");
assert.match(app, /class="streaming-search-icon" :size="18"/, "右上角搜索图标应适度放大");
assert.match(app, /\.streaming-home-search input\s*\{[^}]*font-size:\s*13px/, "右上角搜索文字应适度放大");
const transitionKeyBlock = app.match(/const pageTransitionKey = computed\(\(\) => \[([\s\S]*?)\]\.join\("::"\)\);/)?.[1] ?? "";
assert.doesNotMatch(transitionKeyBlock, /submittedKeyword\.value/, "自动搜索不应使输入框失焦");

assert.match(api, /export function searchCatalog\(/);
assert.match(api, /\/catalog\/cloudsearch\?/);
for (const parameter of ["keywords", "provider", "type", "limit", "offset"]) {
  assert.match(api, new RegExp(`params\\.set\\(\"${parameter}\"`), `搜索接口缺少 ${parameter} 参数`);
}

assert.match(component, /单曲/);
assert.match(component, /歌单/);
assert.match(component, /歌手/);
assert.match(component, /class="streaming-search-pagination"/);
assert.match(component, /toggleFavorite: \[track: SearchTrack\]/, "搜索单曲页应暴露喜欢操作");
assert.match(component, /class="streaming-search-favorite"/, "搜索单曲行应显示喜欢按钮");
assert.match(component, /@click\.stop="emit\('toggleFavorite', track\)"/, "点击喜欢时不应触发歌曲播放");
assert.match(component, /<Heart[^>]*:fill="track\.liked \? 'currentColor' : 'none'"/, "喜欢状态应使用实心爱心反馈");
assert.match(app, /@toggle-favorite="toggleTrackLiked"/, "搜索页喜欢按钮应连接统一账号喜欢逻辑");
assert.match(component, /上一页/);
assert.match(component, /下一页/);
assert.match(component, /Math\.ceil\(props\.total \/ props\.pageSize\)/, "总页数应由后端总数计算");
assert.match(component, /:disabled="page <= 1 \|\| loading"/);
assert.match(component, /:disabled="page >= totalPages \|\| loading"/);
assert.match(component, /PlaylistCard/);
assert.doesNotMatch(component, /IntersectionObserver|sentinel/, "搜索结果页不应包含无限滚动逻辑");
assert.doesNotMatch(component, /<select/, "音源切换不应继续使用系统原生下拉框");
assert.match(component, /class="streaming-search-provider-trigger"/, "音源切换应使用胶囊触发按钮");
assert.match(component, /class="streaming-search-provider-menu"/, "音源选项应显示在自定义圆角浮层中");
assert.match(component, /网易云音乐/);
assert.match(component, /QQ 音乐/);
assert.match(component, /role="menuitemradio"/);
assert.match(component, /<Check v-if="provider === item\.id"/, "当前音源应显示勾选标记");
assert.match(component, /<span v-else class="streaming-search-pause-bars"[^>]*><b><\/b><b><\/b><\/span>/, "歌曲暂停态应使用两条实心竖线");
assert.match(component, /\.streaming-search-pause-bars b\{[^}]*background:#fff/, "暂停竖线应为实心白色");
assert.doesNotMatch(component, />Ⅱ</, "歌曲暂停态不应使用罗马数字");
assert.match(component, /class="streaming-search-artist"[^>]*>[\s\S]*?<img[^>]*loading="lazy"[^>]*decoding="async"/, "歌手图片应延迟解码，避免侧栏过渡时集中重绘");
assert.match(component, /\.streaming-search-artists\{[^}]*contain:layout style/, "歌手网格应隔离内部布局计算");
assert.match(component, /\.streaming-search-artist-cover\{[^}]*will-change:transform/, "歌手封面应提升到独立合成层");
assert.match(component, /\.streaming-search-tracks\{[^}]*background:rgba\(255,255,255,\.94\)[^}]*box-shadow:/, "单曲结果应使用与页面背景区分的浅白列表底板");

console.log("流媒体实时搜索与分页契约通过");
