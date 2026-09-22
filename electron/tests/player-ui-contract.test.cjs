const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const playerBar = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerBar.vue"), "utf8");
const sidebarNav = fs.readFileSync(path.join(root, "src/renderer/src/components/SidebarNav.vue"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const lyricMetadata = fs.readFileSync(path.join(root, "src/renderer/src/services/lyricMetadata.ts"), "utf8");
const lyricSync = fs.readFileSync(path.join(root, "src/renderer/src/services/lyricSync.ts"), "utf8");
const lyricParser = fs.readFileSync(path.join(root, "src/renderer/src/services/lyricParser.ts"), "utf8");
const coverPalette = fs.readFileSync(path.join(root, "src/renderer/src/services/coverPalette.ts"), "utf8");
const onlinePlayback = fs.readFileSync(path.join(root, "tests/online-playback-contract.test.cjs"), "utf8");
const devScript = fs.readFileSync(path.join(root, "..", "scripts/dev.cjs"), "utf8");
const workspacePackage = JSON.parse(fs.readFileSync(path.join(root, "..", "package.json"), "utf8"));
const iconDirectory = path.join(root, "src/renderer/src/assets/icons");
const modeIcons = ["back.svg", "list-order.svg", "next.svg", "previous.svg"]
  .map((file) => fs.readFileSync(path.join(iconDirectory, file), "utf8"));

assert.match(playerBar, /expand:\s*\[\]/, "播放器封面应提供展开歌曲详情事件");
assert.match(playerBar, /desktopLyrics:\s*\[\]/, "“词”按钮应触发桌面歌词事件");
assert.match(playerBar, /class="cover-expand"/, "封面应作为可点击的歌曲详情入口");
assert.doesNotMatch(playerBar, /class="player-like"/, "左侧歌曲信息旁不应保留重复的喜欢按钮");
assert.match(playerBar, /player-volume-panel/, "播放器音量应使用可展开的竖向音量面板");
assert.match(playerBar, /player-volume-slider/, "播放器应提供独立的音量滑块");
assert.match(playerBar, /volume-slider-rail/, "播放器音量滑块应有明确的竖向轨道");
assert.match(playerBar, /transport-icon-previous/, "播放器上一首按钮应使用图标");
assert.match(playerBar, /transport-icon-next/, "播放器下一首按钮应使用图标");
assert.match(sidebarNav, /id:\s*"library"[\s\S]{0,80}label:\s*"所有歌曲"/, "左侧导航应提供所有歌曲入口");

assert.match(app, /showSongDetail/, "应用应支持全屏歌曲详情页");
assert.match(app, /<div\s+v-if="!showSongDetail"\s+class="shell-controls"/, "歌曲详情页打开时应隐藏菜单和设置按钮");
assert.doesNotMatch(app, /class="topbar"|floatingTopbarVisible|handleMainScroll/, "已废弃的普通页面悬浮顶栏应删除");
assert.match(app, /<PlayerBar\s+v-if="!shouldHidePlayerBar && !showSongDetail && !miniPlayerVisible"/, "歌曲详情页或迷你播放器打开时不应继续渲染外层播放栏");
assert.match(app, /<section\s+v-if="showSongDetail"[\s\S]*<PlayerBar[\s\S]*:sidebar-collapsed="true"[\s\S]*@expand="closeSongDetail"/, "歌曲详情页应复用全局底部播放栏并支持返回");
assert.doesNotMatch(app, /<footer class="song-detail-player"/, "歌曲详情页不应保留旧版独立播放控件");
assert.match(coverPalette, /extractCoverPalette/, "歌曲详情页应从真实封面提取环境色");
assert.match(app, /songDetailThemeStyle/, "歌曲详情页应生成共享的环境色 CSS 变量");
assert.match(app, /songDetailPaletteRequestId/, "快速切歌时应防止过期封面取色覆盖当前歌曲");
assert.doesNotMatch(app, /const requestId\s*=\s*\+\+songDetailPaletteRequestId;\s*songDetailPalette\.value\s*=\s*createSoftCoverPalette/, "新封面取色期间不应提前重置上一首歌曲的环境色");
assert.match(app, /const fallbackPalette\s*=\s*createSoftCoverPalette[\s\S]*if\s*\(!coverUrl\)\s*\{[\s\S]*songDetailPalette\.value\s*=\s*fallbackPalette/, "封面不可用时应平滑回退默认主题色");
assert.match(app, /const extractedPalette\s*=\s*await extractCoverPalette[\s\S]*requestId\s*!==\s*songDetailPaletteRequestId[\s\S]*songDetailPalette\.value\s*=\s*extractedPalette\s*\?\?\s*fallbackPalette/, "新封面取色完成前应保留旧色，成功或失败后再切换主题");
assert.match(app, /<section\s+v-if="showSongDetail"[^>]*:style="songDetailThemeStyle"/, "歌曲详情背景应绑定封面环境色");
assert.match(app, /class="song-detail-player-bar"[\s\S]*?ambient[\s\S]*?:style="songDetailThemeStyle"/, "详情页底部播放栏应共享封面环境色");
assert.match(app, /\.song-detail\s*\{[^}]*linear-gradient\([^}]*--detail-ambient-start[^}]*--detail-ambient-end/, "歌曲详情页应使用浅淡环境色渐变");
assert.match(app, /\.song-detail\s*\{[^}]*background-color:\s*#fff/, "歌曲详情渐变下方应有不透明白色底层，不能透出下层页面内容");
assert.match(app, /desktopLyricsPreview/, "应用应支持桌面歌词预览");
assert.match(app, /\.app-shell\s*\{[^}]*height:\s*100vh/, "主应用容器应固定为视口高度，供内容区域滚动");
assert.match(app, /\.main-scroll\s*\{[^}]*overflow:\s*auto/, "内容区域应自行滚动");
assert.match(app, /manualLyricsScroll/, "手动滚动歌词后应暂时停止自动跟随");
assert.match(app, /resumeLyricsFollow/, "歌词应在手动滚动后自动恢复跟随");
assert.match(app, /resetLyricsFollowState/, "重新打开歌词页时应清理上一次的手动滚动状态");
assert.match(
  app,
  /root\.scrollTo\(\{\s*top:\s*Math\.max\(0, targetTop\),\s*behavior:\s*"smooth"\s*\}\)/,
  "歌词自动跟随应使用平滑滚动过渡"
);
assert.match(app, /root\.scrollTop\s*=\s*lyricDragStartScrollTop\s*-\s*\(event\.clientY\s*-\s*lyricDragStartY\)/, "手动拖动歌词仍应即时滚动");
assert.doesNotMatch(
  app,
  /if\s*\(shouldAutoFollowLyrics\(root,\s*activeLine\)\)/,
  "切换到新歌词行时应始终将当前歌词移动到固定基准线"
);
assert.match(app, /playMode/, "歌曲详情页应维护播放模式");
assert.match(app, /toggleDetailVolume/, "歌曲详情页应提供音量调节入口");
assert.match(app, /song-detail-mode/, "上一首左侧应有播放模式按钮");
assert.match(app, /play-mode-menu/, "播放模式按钮应打开播放模式菜单");
assert.match(app, /随机播放/, "播放模式菜单应包含随机播放");
assert.match(app, /单曲循环/, "播放模式菜单应包含单曲循环");
assert.match(app, /列表循环/, "播放模式菜单应包含列表循环");
assert.match(app, /song-detail-translation/, "双语歌词应在原歌词下方显示翻译");
assert.doesNotMatch(
  app,
  /isSongInfoActive|song-detail-song-info\.is-playing/,
  "歌曲信息不应使用整段播放状态一次性高亮"
);
assert.match(
  app,
  /song-info-character/,
  "歌曲信息应拆分为可逐字高亮的字符节点"
);
assert.match(
  app,
  /updateSongInfoHighlightDom/,
  "歌曲信息应通过独立的增量 DOM 更新函数高亮"
);
assert.match(
  app,
  /renderedSongInfoLineElements/,
  "歌曲信息逐字高亮应按行缓存 DOM 字符节点"
);
assert.match(
  app,
  /\.song-detail-lyrics-list \.song-detail-translation\s*\{[^}]*color:\s*#6f9296/,
  "翻译歌词颜色应比原来的浅灰色更清晰"
);
assert.match(app, /song-detail-volume/, "下一首右侧应有音量按钮");
assert.match(app, /song-detail-lyrics-list::-webkit-scrollbar/, "歌词区域应隐藏浏览器滚动条");
assert.match(app, /song-detail-header button:first-child\s*\{[^}]*transform:\s*none/, "歌曲详情页左上角应使用向下箭头而非横向返回箭头");
assert.match(app, /assets\/icons\/back\.svg/, "歌曲详情页左上角应使用本地返回图标");
assert.match(app, /song-detail-back-icon/, "歌曲详情页左上角应使用独立的返回图标样式");
assert.doesNotMatch(app, /title="关闭歌曲详情"/, "歌曲详情页已有左上角返回入口，不应重复显示右上角关闭按钮");
assert.match(app, /getLyricHighlightState/, "歌词高亮应由统一时间轴状态计算");
assert.doesNotMatch(app, /class="lyric-character"[\s\S]*:class="\{[^}]*'is-sung'/, "逐字高亮不应再由 Vue 每帧重绘");
assert.match(app, /lyric-original/, "双语歌词应区分原歌词和翻译");
assert.match(app, /characterCount/, "原歌词应根据当前播放时间计算逐字进度");
assert.match(app, /v-for="\(character, characterIndex\) in lyricCharacters\(line\)"/, "原歌词应按字符拆分渲染");
assert.match(app, /class="lyric-character"/, "原歌词字符应使用独立样式");
assert.match(app, /song-detail-translation[^>]*>\{\{ line\.translation \}\}/, "翻译应作为整行文本单独渲染");
assert.match(lyricParser, /splitInlineTranslation/, "同一行中的原歌词和中文翻译应被拆分为上下两行");
assert.match(
  app,
  /\.song-detail-lyrics-list \.song-detail-translation\s*\{[^}]*font-size:\s*22px/,
  "桌面端翻译歌词应与歌曲名和原歌词保持相同字号"
);
assert.match(
  app,
  /\.song-detail-lyrics-list \.is-active \.song-detail-translation\s*\{[^}]*font-size:\s*22px[^}]*font-weight:\s*400/,
  "当前翻译不应因播放而放大或加粗"
);
assert.match(app, /song-detail-controls[\s\S]*song-detail-progress/, "歌曲详情页应先显示控制按钮，再显示进度条");
assert.match(app, /song-detail-progress-wrap/, "详情页进度条应使用独立的限宽容器");
assert.match(app, /volume-slider-rail/, "详情页音量滑块应有明确的竖向轨道");
assert.match(app, /\.song-detail-volume \.volume-slider-rail\s*\{[^}]*position:\s*relative[^}]*margin-inline:\s*auto/, "详情页音量轨道应相对定位并在面板中水平居中");
assert.match(app, /\.song-detail-volume \.song-detail-volume-slider\s*\{[^}]*position:\s*absolute[^}]*top:\s*50%[^}]*left:\s*50%[^}]*translate\(-50%,\s*-50%\)\s*rotate\(-90deg\)/, "详情页音量滑块应以轨道中心为基准定位");
assert.match(playerBar, /\.player-volume-wrap \.volume-slider-rail\s*\{[^}]*position:\s*relative[^}]*margin-inline:\s*auto/, "底部播放器音量轨道应相对定位并水平居中");
assert.match(playerBar, /\.player-volume-wrap \.player-volume-slider\s*\{[^}]*position:\s*absolute[^}]*top:\s*50%[^}]*left:\s*50%[^}]*translate\(-50%,\s*-50%\)\s*rotate\(-90deg\)/, "底部播放器音量滑块应以轨道中心为基准定位");
assert.match(app, /requestAnimationFrame/, "歌词同步应使用高精度动画时钟");
assert.match(lyricSync, /findCharacterCountAtTime/, "歌词同步应使用高效的逐字时间定位");
assert.match(app, /cancelAnimationFrame/, "歌词同步应在暂停或卸载时停止动画时钟");
assert.match(app, /data-lyric-index/, "歌词行应提供稳定的 DOM 定位标记");
assert.match(app, /updateLyricAnchorFromScroll/, "歌词滚动时应更新固定定位线对应的歌词");
assert.match(app, /lyricAnchorIndex/, "歌词应维护固定定位线对应的行索引");
assert.match(app, /updateLyricHighlightDom/, "逐字高亮应通过增量 DOM 更新减少整页重渲染");
assert.match(app, /clearRenderedLyricHighlight/, "切换歌词句时应清理上一句已点亮的字符");
assert.match(app, /renderedCharacterElements\.length\s*===\s*0/, "歌词 DOM 更新后应重新绑定当前句字符节点");
assert.ok(lyricParser.includes("/<(\\d{1,3}):(\\d{2})(?:[.:](\\d{1,3}))?>/gu"), "歌词解析应支持增强 LRC 的逐字时间标记");
assert.match(lyricParser, /characterTimes/, "歌词行应保存逐字时间信息");
assert.match(lyricParser, /parseKaraokeTokens/, "歌词解析应支持带逐词时间的 QRC/YRC 歌词");
assert.match(lyricParser, /isLyricMetadataText/, "歌词解析应过滤网易云的作词、作曲等歌曲信息行");
assert.match(lyricParser, /parseYrcContent/, "歌词解析应优先读取网易云逐字时间轴");
assert.match(lyricParser, /parseLrcContent/, "歌词解析应支持本地普通 LRC 兜底");
assert.match(app, /parseLyricCredits/, "歌曲详情页应展示歌词中的制作信息");
assert.match(app, /song-detail-credits/, "歌曲制作信息应有独立的对齐布局");
assert.doesNotMatch(app, /逐字同步|按句同步/, "界面不应显示歌词同步方式提示");
assert.match(app, /song-detail-track-meta/, "歌曲标题下方应有独立的歌曲元信息布局");
assert.doesNotMatch(app, /lyrics-source|song-detail-sync-badge/, "歌曲详情和播放区域不应显示同步方式标签");
assert.match(app, /\.song-detail-content\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)/, "歌曲详情内容区应限制栅格行高度，避免制作信息挤出标题");
assert.match(app, /\.song-detail-title\s*\{[^}]*font-size:\s*22px[^}]*font-weight:\s*800/, "歌曲标题应与普通歌词同字号并加粗");
assert.match(app, /\.song-detail-lyrics-list p\.lyric-line\s*\{[^}]*font-size:\s*22px/, "歌曲详情普通歌词字号应放大");
assert.match(app, /findActiveLyricIndex/, "歌词当前行定位应使用独立的时间查找函数");
assert.match(lyricMetadata, /"作词",\s*"作曲"/, "歌词解析应过滤作词、作曲等网易云元数据");
assert.match(app, /@wheel\.stop="handleLyricsManualScroll"/, "歌词滚轮事件不应冒泡干扰外层页面滚动");
assert.match(app, /overscroll-behavior:\s*contain/, "歌词区域滚动到边界时不应把滚轮传给外层页面");
assert.match(app, /\.song-detail-lyrics\s*\{[^}]*-webkit-mask-image:\s*linear-gradient\(to bottom/, "歌词滚动区顶部和底部应有自然淡出的遮罩");
assert.match(app, /\.song-detail-lyrics\s*\{[^}]*mask-image:\s*linear-gradient\(to bottom/, "歌词滚动区应使用标准渐隐遮罩属性");
assert.match(api, /loadCatalogTrack/, "前端应通过统一后端接口加载在线歌曲详情");
assert.match(api, /loadCatalogLyrics/, "前端应通过统一后端接口加载在线歌词");
assert.match(onlinePlayback, /在线音乐播放闭环契约通过/, "在线音乐播放闭环应有独立契约测试");
assert.match(app, /lyricsTranslation/, "在线歌词翻译应进入统一歌词模型");
assert.match(app, /loadOnlineTrackAssets/, "播放在线歌曲前应通过 Java 后端补充歌曲资源");
assert.match(app, /coverFallbackUrl/, "封面应保留在线图片的 Java 代理回退地址");
assert.match(app, /primaryCoverUrl\s*=\s*detail\?\.coverUrl\s*\?\?\s*track\.coverUrl/, "在线封面应优先使用歌曲详情中的真实封面");
assert.match(app, /handleTrackCoverError/, "搜索列表封面失败应只影响当前歌曲");
assert.match(app, /handleCurrentCoverError/, "当前播放封面应支持独立回退");
assert.doesNotMatch(app, /@error="coverLoadFailed\s*=\s*true"/, "封面错误不应再使用全局失败标记");
assert.match(app, /findLocalLyricFallback/, "在线歌词缺失时应尝试匹配本地歌词");
assert.match(app, /class="lyric-anchor-controls"/, "歌词播放按钮和时间应固定在歌词定位线");
assert.match(
  app,
  /local-library-page/,
  "本地歌曲页应使用独立页面布局"
);
assert.match(
  app,
  /placeholder="搜索歌曲、歌手、专辑或文件夹"/,
  "本地歌曲页应提供实时过滤搜索框"
);
assert.doesNotMatch(
  app,
  /<section class="now-playing-section">/, 
  "页面主体不应重复显示当前歌曲信息区，当前歌曲信息由底部播放器负责"
);
assert.match(api, /export function loadHomepage\b/, "首页应通过统一后端接口加载网易云首页数据");
assert.match(app, /homepageState/, "首页应有独立的加载和错误状态");
assert.match(app, /homepagePlaylists/, "首页推荐歌单应来自网易云首页数据");
assert.match(app, /homepageSongs/, "首页推荐歌曲应来自网易云首页数据");
assert.match(app, /homepageFeaturedIndex/, "首页今日精选应维护当前推荐歌曲索引");
assert.match(app, /nextHomepageSong|previousHomepageSong/, "首页今日精选应支持切换歌曲");
assert.match(app, /refreshHomepageRecommendations/, "首页推荐歌单应支持独立刷新");
assert.match(app, /每日推荐/, "首页应展示每日推荐入口");
assert.match(api, /export function loadDailyRecommendations\b/, "每日推荐应通过统一后端接口加载");
assert.match(app, /dailyRecommendationState/, "每日推荐应有独立加载状态");
assert.match(app, /dailyRecommendationTracks/, "每日推荐应使用独立歌曲数据");
assert.match(app, /canGoBack/, "顶部后退按钮应有页面历史状态");
assert.match(app, /canGoForward/, "顶部前进按钮应有页面历史状态");
assert.match(app, /navigateBack/, "顶部后退按钮应执行页面导航");
assert.match(app, /navigateForward/, "顶部前进按钮应执行页面导航");
assert.match(app, /homepageBanners/, "首页横幅应来自网易云首页数据");
assert.match(app, /\.hero-card\s*\{[^}]*height:\s*253px[^}]*overflow:\s*hidden/, "首页今日精选容器应使用固定高度并裁剪溢出内容");
assert.match(app, /\.hero-copy h2\s*\{[^}]*-webkit-line-clamp:\s*2/, "首页长歌曲名最多显示两行，不能撑大推荐容器");
assert.match(app, /\.daily-recommendation-card\s*\{[^}]*height:\s*253px[^}]*max-height:\s*253px/, "首页每日推荐容器应与今日精选保持固定高度");
assert.match(api, /export function loadDiscovery\b/, "发现页应通过独立接口加载发现数据");
assert.match(app, /discoveryData/, "发现页应使用独立的数据状态");
assert.match(app, /discoveryPlaylists/, "发现页歌单不应复用首页歌单数据");
assert.match(app, /discoverySongs/, "发现页歌曲不应复用首页歌曲数据");
assert.match(app, /discoveryState/, "发现页应有独立的加载状态");
assert.match(app, /StreamingPlaylistDiscoveryPage/, "发现页应提供独立的发现内容");
assert.match(app, /homepage-fallback/, "首页没有横幅时仍应显示推荐主视觉");
assert.doesNotMatch(app, /class="private-radar-demo"/, "本地首页不应恢复旧的私人雷达演示模块");
assert.match(api, /export function loadCatalogPlaylist\b/, "推荐歌单应通过统一后端接口加载歌曲");
assert.match(app, /loadCatalogPlaylist/, "首页歌单点击应加载真实歌曲");
assert.match(app, /selectedPlaylist/, "首页应记录当前选中的在线歌单");
assert.match(app, /async function selectPlaylist\(playlist: Playlist\)/, "点击在线歌单应异步加载歌单内容");
assert.match(app, /playlistState\.value\s*=\s*\"loading\"/, "在线歌单加载时应进入加载状态");
assert.match(app, /view:\s*\"playlist\"/, "在线歌单详情应使用独立页面视图");
assert.doesNotMatch(app, /keepHomepageRefreshVisible/, "刷新不能只重新排列原有歌单");
assert.match(app, /playlistState\.value\s*=\s*\"error\"/, "在线歌单加载失败应进入错误状态");
assert.match(app, /正在加载歌单歌曲/, "在线歌单加载中应给出状态提示");
assert.match(app, /歌单歌曲加载失败/, "在线歌单加载失败应给出提示");
assert.match(app, /playFromTime\(anchorPlaybackTime\)/, "固定定位线的播放按钮应从前奏或定位线歌词开始播放");
assert.match(app, /alignPlaybackTargetToAnchor/, "点击固定播放按钮后应将目标行对齐到定位线");
assert.match(app, /await alignPlaybackTargetToAnchor\(time, targetIsPreface, targetPrefaceLineIndex\)/, "切换播放时间后应立即重置歌词定位");
assert.match(app, /root\.scrollHeight\s*-\s*root\.clientHeight/, "目标歌词定位时应限制在可滚动边界内");
assert.match(app, /lyricAnchorVisible/, "定位控件应只在手动浏览歌词时显示");
assert.match(app, /handleLyricPointerDown/, "歌词区域应支持鼠标左键拖动浏览");
assert.match(app, /@pointerdown="handleLyricPointerDown"/, "歌词容器应绑定拖动起点事件");
assert.match(app, /prefaceAnchorActive/, "歌曲信息经过定位线时应作为前奏播放目标");
assert.match(app, /prefaceAnchorLineIndex/, "歌曲信息经过定位线时应记录具体的信息行");
assert.match(app, /prefaceLineTimes/, "歌曲信息应优先使用每行真实时间轴");
assert.match(app, /creditTime \?\? getPrefaceLineStartTime/, "只有缺少时间戳的歌曲信息才应使用前奏估算时间");
assert.doesNotMatch(app, /song-detail-preface-track/, "前奏信息不应再包含前端伪造的歌名和歌手行");
assert.match(app, /playbackDuration/, "播放进度显示应基于媒体实际时长");
assert.match(app, /@loadedmetadata="updateMediaDuration"/, "音频加载元数据后应刷新真实播放时长");
assert.match(app, /isPreviewPlayback/, "网易云试听片段结束时应识别为试听限制");
assert.match(app, /seekablePlaybackDuration/, "试听歌曲应单独维护可跳转的实际时长");
assert.match(app, /previewProgressLimit/, "试听歌曲应计算锁定区开始位置");
assert.match(
  app,
  /Math\.min\(\s*\(playbackDuration\.value \* value\) \/ 100,\s*actualSeekableDuration\s*\)/,
  "拖动试听歌曲到锁定区时应限制到试听终点"
);
assert.match(app, /if \(audioElement\.value && playbackDuration\.value > 0\)/, "音频尚未报告 duration 时也应允许按歌曲时长拖动");
assert.match(app, /getSeekablePlaybackDuration\(currentTrack\.value\.duration, audio\.duration\)/, "拖动时应直接使用音频实际时长判断试听边界");
assert.match(app, /isSeeking/, "进度条拖动应有独立的暂存状态");
assert.match(app, /beginSeek/, "进度条开始拖动时应记录播放状态");
assert.doesNotMatch(app, /function beginSeek\(\)[\s\S]{0,500}audio\.pause\(\)/, "拖动进度条时原歌曲应继续播放");
assert.doesNotMatch(app, /function beginSeek\(\)[\s\S]{0,500}isPlaying\.value\s*=\s*false/, "拖动进度条时播放状态不应切换为暂停");
assert.match(app, /previewSeek/, "进度条拖动过程中应只更新预览位置");
assert.doesNotMatch(app.match(/function previewSeek\(value: number\) \{([\s\S]*?)\n\}/)?.[1] ?? "", /lyricClockTime\s*=|currentTime\.value\s*=/, "进度条预览不应改变歌词播放时间");
assert.doesNotMatch(app.match(/function beginSeek\(\) \{([\s\S]*?)\n\}/)?.[1] ?? "", /stopPlaybackClock\(\)|audio\.pause\(\)|isPlaying\.value\s*=\s*false/, "拖动进度条时原播放时钟应继续运行");
assert.match(app, /finishSeek/, "进度条松开后才应提交最终播放位置");
assert.match(app, /@seek-start="beginSeek"/, "底部播放条应通知拖动开始");
assert.match(app, /@seek-end="finishSeek"/, "底部播放条应通知拖动结束");
assert.match(app, /@pointerdown="beginSeek"[\s\S]*@pointerup="finishSeekFromEvent"/, "详情页进度条应使用拖动生命周期事件");
assert.match(playerBar, /seekStart:\s*\[\]/, "底部播放条应提供拖动开始事件");
assert.match(playerBar, /seekEnd:\s*\[value: number\]/, "底部播放条应提供拖动结束事件");
assert.match(playerBar, /@pointerdown="emitSeekStart"/, "底部播放条应在鼠标按下时开始拖动会话");
assert.match(playerBar, /@keydown="emitSeekStart"/, "底部播放条应在键盘操作时开始拖动会话");
assert.match(playerBar, /@pointerup="emitSeekEnd"/, "底部播放条应在鼠标松开时提交拖动会话");
assert.match(playerBar, /previewProgressLimit/, "底部播放条应接收试听锁定区位置");
assert.match(playerBar, /is-preview/, "底部播放条应渲染试听锁定段样式");
assert.match(playerBar, /progress-slider-wrap/, "底部播放条应使用独立滑块容器承载试听终点标记");
assert.doesNotMatch(playerBar, /progress-slider-wrap\.is-preview::after\s*\{/, "底部播放条不应显示黑色试听终点圆点");
assert.match(playerBar, /Math\.min\(Number\(input\.value\), props\.previewProgressLimit\)/, "底部滑块输入值应在试听终点截断");
assert.match(playerBar, /['"]--progress['"]\s*:/, "底部播放条应把当前播放进度传给试听轨道");
assert.match(playerBar, /progress-input::-webkit-slider-runnable-track/, "底部播放条应单独设置细轨道");
assert.match(playerBar, /progress-input::-webkit-slider-runnable-track\s*\{[^}]*height:\s*4px/, "紧凑底部播放条轨道应保持清晰的 4px 高度");
assert.match(playerBar, /progress-input::-webkit-slider-runnable-track\s*\{[^}]*linear-gradient\(90deg,\s*#2f6df6[^}]*#14a88d[^}]*--progress/, "底部普通播放条应显示蓝绿渐变进度");
assert.match(playerBar, /progress-input::-webkit-slider-thumb\s*\{[^}]*background:\s*transparent[^}]*box-shadow:\s*none/, "底部播放滑块应隐藏黑点但保留拖拽能力");
assert.match(app, /\.play-mode-menu\s*\{[^}]*min-width:\s*168px/, "播放模式菜单应保持足够宽度");
assert.match(app, /\.play-mode-menu button\s*\{[^}]*white-space:\s*nowrap/, "播放模式菜单文字应保持横向显示");
assert.match(app, /anchorPlaybackTime/, "定位控件应统一计算前奏或歌词行的播放时间");
assert.match(app, /playFromTime\(anchorPlaybackTime/, "定位按钮应支持从歌曲信息的 00:00 开始播放");
assert.match(app, /\[data-song-info-line\]/, "前奏播放定位应使用具体的歌曲信息行，而非整个信息区");
assert.match(app, /targetPrefaceLineIndex/, "点击前奏播放时应保留当前信息行的定位索引");
assert.match(app, /song-detail-song-header/, "顶部歌曲标题信息应与前奏歌曲信息分开布局");
assert.doesNotMatch(app, /currentTrack\.title \+ ' - ' \+ currentTrack\.artist/, "不应把歌名和歌手伪造成一条可播放的制作信息");
assert.match(app, /!isPlaying\.value\s*\|\|\s*manualLyricsScroll\.value/, "暂停时不应自动跳转到正在播放的歌词行");
assert.match(app, /lyricEndSpacerHeight/, "歌词末尾应根据定位线保留可滚动缓冲区");
assert.match(app, /lyricStartSpacerHeight/, "歌曲信息开头应根据定位线保留动态对齐空间");
assert.match(app, /LYRIC_START_VISUAL_OFFSET\s*=\s*14/, "开头歌曲信息应轻微上移以匹配定位按钮的视觉中心");
assert.match(app, /class="lyric-start-spacer"/, "歌曲信息前应渲染开头定位缓冲区");
assert.match(
  app,
  /\.song-detail-song-info\s*\{[^}]*margin-top:\s*0/,
  "歌曲信息不应再叠加固定顶部间距"
);
assert.match(
  app,
  /anchorOffset\s*-\s*firstSongInfoCenterWithoutSpacer/,
  "开头缓冲区应让第一行歌曲信息的中心对齐固定定位线"
);
assert.match(app, /class="lyric-end-spacer"/, "歌词列表末尾应渲染定位缓冲区");
assert.match(app, /root\.clientHeight\s*-\s*anchorOffset/, "最后一句歌词应获得足够空间滚动到固定定位线");
assert.match(app, /lastLyricLine\.offsetHeight/, "末尾缓冲区应扣除最后一句歌词自身高度");
assert.match(app, /paddingBottom/, "末尾缓冲区应扣除歌词列表原有的底部留白");
assert.doesNotMatch(app, /root\.clientHeight\s*-\s*anchorOffset\s*\+\s*28/, "末尾不应保留额外空白，最后一句应在定位线处停止");
assert.match(app, /class="song-detail-lyrics-pane"/, "右侧详情区域应提供固定头部与滚动歌词的共同容器");
assert.match(
  app,
  /song-detail-lyrics-pane[\s\S]*song-detail-song-header[\s\S]*song-detail-lyrics/,
  "标题和歌手应位于歌词滚动容器之外"
);
assert.match(
  app,
  /\.song-detail-lyrics-pane\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/,
  "右侧详情区域应为固定头部和可滚动歌词区分配独立行"
);
assert.match(
  app,
  /lineRect\.top\s*<=\s*anchorY\s*&&\s*lineRect\.bottom\s*>=\s*anchorY/,
  "定位控件只应在歌词行真正经过定位线时绑定该行"
);
assert.doesNotMatch(
  app,
  /v-if="index === activeLyricIndex"[\s\S]{0,220}class="lyric-seek-button"/,
  "播放按钮不应继续放在每一行歌词内部"
);
assert.match(
  app,
  /\.lyric-anchor-controls\s*\{[^}]*position:\s*sticky[^}]*top:\s*calc\(38%\s*-\s*42px\)[^}]*left:\s*0[^}]*transform:\s*translateX\(calc\(var\(--lyric-gutter\)\s*\*\s*-0\.9\)\)/,
  "歌曲信息定位按钮应与第一行前奏信息对齐"
);
assert.match(app, /data-song-info-line/, "歌曲信息应按行分组以便上一行恢复原色");
assert.match(app, /renderedSongInfoLineElements/, "歌曲信息应缓存逐行字符节点");
assert.match(app, /getPrefaceHighlightState/, "歌曲信息应按当前行计算逐字高亮状态");
assert.match(app, /playFromLyricLine/, "当前歌词行应保留从该句开始播放的方法");
assert.match(app, /class="song-detail-song-info"/, "歌曲信息应放进歌词滚动区域");
assert.match(
  app,
  /\.song-detail-lyrics-list p\.lyric-line\s*\{(?=[^}]*display:\s*block)(?=[^}]*position:\s*relative)[^}]*\}/,
  "歌词行应使用与歌曲信息相同的左对齐单列布局"
);
assert.match(
  app,
  /\.song-detail-lyrics-list p\.lyric-line\.is-active\s*\{[^}]*font-size:\s*22px/,
  "当前歌词字号应与歌曲标题保持一致，不因播放而放大"
);
assert.match(
  app,
  /\.lyric-anchor-controls \.lyric-seek-button\s*\{[^}]*position:\s*static/,
  "固定播放按钮应在定位线控件内，而不是跟随单行歌词定位"
);
assert.doesNotMatch(app, /\.lyric-line-content\s*\{[^}]*grid-column:\s*3/, "歌词正文不应再被推到第三列");
assert.match(
  app,
  /\.song-detail-lyrics\s*\{[^}]*margin-left:\s*calc\(var\(--lyric-gutter\)\s*\*\s*-1\)[^}]*padding-left:\s*var\(--lyric-gutter\)/,
  "歌词区域应为左侧播放控件预留可见空间，同时保持歌曲信息与歌词左对齐"
);
assert.match(
  app,
  /\.song-detail-credit\s*\{(?=[^}]*display:\s*block)(?=[^}]*text-align:\s*left)[^}]*\}/,
  "歌曲制作信息应使用整行左对齐，长内容换行后回到同一左边线"
);
assert.match(
  app,
  /\.song-detail-credit strong\s*\{[^}]*font-weight:\s*400/,
  "歌曲制作信息的标签不应加粗，应与内容保持一致"
);
assert.doesNotMatch(app, /\.song-detail-credit\s*\{[^}]*grid-template-columns/, "歌曲制作信息不应使用两列布局，避免长内容换行缩进");
assert.match(
  app,
  /\.song-detail-lyrics-list p\.lyric-line\s*\{[^}]*padding:\s*6px\s+0/,
  "相邻歌词行之间的垂直间距应收紧"
);
assert.match(devScript, /music-api[\\/"']/, "完整开发启动脚本应包含网易云 API 服务");
assert.equal(workspacePackage.scripts["music-api"], "node scripts/music-api.cjs", "项目应提供独立启动网易云 API 的命令");
for (const icon of modeIcons) {
  assert.doesNotMatch(icon, /<!DOCTYPE|(?:\s|<)(?:t|p-id)=/, "播放图标不应包含 IDEA 不识别的 DTD 或导出元数据属性");
}

console.log("播放器交互契约通过");
