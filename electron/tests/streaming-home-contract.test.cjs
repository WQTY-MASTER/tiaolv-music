const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const qqLoginPage = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingQqLoginPage.vue"), "utf8");
const qqRankingCards = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingQqRankingCards.vue"), "utf8");
const qqCuratedPlaylists = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingQqCuratedPlaylists.vue"), "utf8");
const discoveryPage = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingPlaylistDiscoveryPage.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(app, /home:\s*appMode\.value === "local" \? "我的音乐库" : "主页"/);
assert.match(app, /Cloud/);
assert.match(app, /streamingSource/);
assert.match(app, /streaming-source-switch/);
assert.match(app, /aria-label="切换主页音源"/);
assert.match(app, /网易云音乐/);
assert.match(app, /QQ 音乐/);
assert.match(app, /selectStreamingSource/);
assert.match(app, /selectedStreamingAccount/);
assert.match(app, /class="streaming-source-trigger-avatar"[\s\S]*?:src="selectedStreamingAccount\.avatarUrl"/, "已登录的当前音源应在切换按钮中显示账号头像");
assert.match(app, /v-if="neteaseAccount\?\.avatarUrl"[\s\S]*?class="streaming-source-mark is-avatar"/, "网易云音源菜单应优先显示账号头像");
assert.match(app, /v-if="qqAccount\?\.avatarUrl"[\s\S]*?class="streaming-source-mark is-avatar"/, "QQ 音源菜单应优先显示账号头像");
assert.match(app, /\.streaming-source-trigger-avatar\s*\{[^}]*width:\s*34px[^}]*height:\s*34px[^}]*border-radius:\s*50%/, "音源头像应保持固定圆形尺寸");
assert.match(app, /听见为你而来的音乐/);
assert.match(app, /在线漫游/);
assert.match(app, /openProviderAuthPanel\(streamingSource\)/);
assert.match(app, /loadAccountRecommendations\(provider\)/);
assert.match(app, /loadAccountPlaylists\(provider\)/);
assert.match(app, /loadFeaturedPlaylists\(provider\)/);
assert.match(app, /streaming-home-login-card/);
assert.match(app, /<StreamingQqLoginPage[\s\S]*?v-if="!selectedStreamingAccount && streamingSource === 'qq'"[\s\S]*?@login="openProviderAuthPanel\('qq'\)"/, "QQ 未登录主页应使用独立登录组件");
assert.match(app, /v-else-if="!selectedStreamingAccount"[\s\S]*?class="streaming-home-page streaming-home-login-card"/, "网易云未登录主页应继续使用原组件");
assert.doesNotMatch(app, /streaming-home-login-card\.is-qq/, "QQ 独立登录页不应覆盖网易云登录卡样式");
assert.match(qqLoginPage, /QQ 音乐未登录/);
assert.match(qqLoginPage, /每日推荐/);
assert.match(qqLoginPage, /登录查看每日推荐/);
assert.match(qqLoginPage, /登录 QQ 音乐/);
assert.match(app, /streaming-home-content/);
assert.match(
  app,
  /\.streaming-home-content\s*\{[^}]*gap:\s*40px[^}]*\}/,
  "主页三个主模块之间应保持固定的 40px 间距",
);
assert.match(app, /streaming-home-tools/);
assert.match(app, /placeholder="搜索歌曲、歌手、专辑或文件夹"/);
assert.match(app, /streaming-daily-mix/);
assert.match(app, /class="streaming-daily-qq-meta"[\s\S]*?DAILY DISCOVERY[\s\S]*?01 \/ 03/, "QQ 登录后的推荐卡应显示专属页签信息");
assert.match(app, /streamingSource === 'qq' \? '查看歌曲' : '查看全部'/, "QQ 推荐卡的次要操作应显示查看歌曲");
assert.match(app, /class="streaming-daily-qq-count"[\s\S]*?QQ 音乐/, "QQ 推荐卡应显示推荐数量和来源");
assert.match(app, /\.streaming-daily-mix\.is-qq\s*\{[^}]*background:\s*linear-gradient\([^}]*#283247[^}]*#397b6b/s, "QQ 已登录推荐卡应使用独立深色样式");
assert.match(app, /\.streaming-daily-mix\.is-qq \.streaming-daily-copy h2\s*\{[^}]*color:\s*#fff/s, "QQ 推荐标题应在深色背景上保持可读");
assert.match(app, /每日推荐/);
assert.match(app, /DAILY MIX/);
assert.match(app, /每日 06:00 焕新/);
assert.match(app, /streaming-daily-cover-stack/);
assert.match(app, /播放全部/);
assert.match(app, /查看全部/);
assert.match(app, /私人漫游/);
assert.match(app, /私人雷达/);
assert.match(
  app,
  /class="streaming-personal-card is-radar"[\s\S]*?class="streaming-personal-card is-roaming"/,
  "私人雷达应显示在私人漫游左侧",
);
assert.match(
  app,
  /class="streaming-personal-grid"[\s\S]*?class="streaming-daily-preview"/,
  "私人推荐卡片组应显示在每日歌曲预览上方",
);
assert.match(app, /playStreamingDailyMix/);
assert.match(app, /openStreamingDailyMix/);
assert.match(app, /openPrivateRoaming/);
assert.match(app, /openPrivateRadar/);
assert.match(app, /const streamingDailyPreviewTracks = computed\(\(\) => streamingHomeTracks\.value\.slice\(0, 8\)\)/);
assert.match(app, /class="streaming-daily-preview"/);
assert.match(app, /\{\{ streamingProviderName \}\} 为你精选/);
assert.match(app, /点一首就开始·队列自动接上整份推荐/);
assert.match(app, /class="streaming-daily-preview-all"[\s\S]*?@click="openStreamingDailyMix"[\s\S]*?完整歌单/);
assert.match(app, /function playStreamingDailyPreview\(trackId: string\)[\s\S]*?streamingHomeTracks\.value\.findIndex[\s\S]*?playbackQueue\.value = orderedTracks\.map\(\(track\) => createQueueTrack\(track\)\)[\s\S]*?playTrack\(playbackQueue\.value\[0\]\)/);
assert.match(app, /class="streaming-daily-preview-bars"/);
assert.match(app, /<StreamingQqRankingCards[\s\S]*?v-if="streamingSource === 'qq'"/, "QQ 双榜单只能显示在 QQ 首页");
assert.match(app, /loadQqHomeRankings/);
assert.match(app, /playQqHomeRankingTrack/);
assert.match(app, /openQqHomeRanking/);
assert.match(app, /title: "巅峰 · 飙升榜"/);
assert.match(app, /title: "巅峰 · 热歌榜"/);
assert.match(qqRankingCards, /查看全部 \{\{ ranking\.count \}\} 首/);
assert.match(qqRankingCards, /class="qq-ranking-grid"/);
assert.match(app, /<StreamingQqCuratedPlaylists[\s\S]*?v-if="streamingSource === 'qq'[^\"]*"/, "QQ 精选歌单只能显示在 QQ 首页");
assert.match(app, /playlistDiscoveryStates/, "网易云与 QQ 应分别保存发现页状态");
assert.match(app, /loadPlaylistCategories\(provider\)/, "发现歌单分类请求必须携带当前音源");
assert.match(app, /loadDiscoveredPlaylists\([\s\S]*?provider/, "发现歌单列表请求必须携带当前音源");
assert.match(qqCuratedPlaylists, /把喜欢，听成一张歌单/);
assert.match(qqCuratedPlaylists, /发现更多/);
assert.match(qqCuratedPlaylists, /emit\(['"]discover['"]\)/);
assert.match(qqCuratedPlaylists, /emit\(['"]select['"], playlist\)/);
assert.match(discoveryPage, /provider:\s*"netease"\s*\|\s*"qq"/);
assert.match(discoveryPage, /v-if="provider === 'netease'"[\s\S]*?playlist-discovery-quality/, "QQ 发现页不能显示网易云精品筛选");
assert.match(app, /class="streaming-featured-playlists"/);
assert.match(app, /网易云音乐 精选歌单/);
assert.match(app, /为你挑选 \{\{ streamingHomePlaylists\.length \}\} 份歌单/);
assert.match(app, /streamingHomePlaylists\.slice\(0, 8\)/);
assert.match(app, /class="streaming-featured-playlist-card"[\s\S]*?@click="selectPlaylist\(playlist\)"/);
assert.match(app, /playlist\.imageUrl/);
assert.match(app, /@keyframes streaming-daily-preview-bar/);
assert.match(app, /streaming-home-heading/);
assert.doesNotMatch(app, /floatingTopbarVisible|class="topbar"/, "已废弃的全局悬浮顶栏应彻底删除");
assert.match(
  app,
  /(?:^|\n)\.page-heading\.streaming-home-heading\s*\{[^}]*margin-top:\s*88px/m,
  "流媒体主页应进一步下移，并在侧栏展开和收起时保持一致",
);
assert.doesNotMatch(
  app,
  /\.app-shell\.is-sidebar-collapsed \.streaming-home-heading/,
  "主页纵向位置不应只在侧栏收起时改变",
);
assert.match(
  app,
  /\.page-heading\.streaming-home-heading,\s*\.streaming-home-page\s*\{[^}]*width:\s*min\(1420px,\s*100%\)[^}]*margin-inline:\s*auto/,
  "流媒体主页头部和内容应统一限宽并居中",
);
assert.match(app, /prefers-reduced-motion/);
assert.doesNotMatch(app, /class="streaming-featured-track"/);
assert.doesNotMatch(app, /class="streaming-daily-list"/);
assert.match(packageJson, /streaming-home-contract\.test\.cjs/);

console.log("流媒体主页音源切换契约通过");
