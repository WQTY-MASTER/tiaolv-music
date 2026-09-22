const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
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
assert.match(app, /听见为你而来的音乐/);
assert.match(app, /在线漫游/);
assert.match(app, /openProviderAuthPanel\(streamingSource\)/);
assert.match(app, /loadAccountRecommendations\(provider\)/);
assert.match(app, /loadAccountPlaylists\(provider\)/);
assert.match(app, /loadFeaturedPlaylists\(provider\)/);
assert.match(app, /streaming-home-login-card/);
assert.match(app, /streaming-home-content/);
assert.match(
  app,
  /\.streaming-home-content\s*\{[^}]*gap:\s*40px[^}]*\}/,
  "主页三个主模块之间应保持固定的 40px 间距",
);
assert.match(app, /streaming-home-tools/);
assert.match(app, /placeholder="搜索歌曲、歌手、专辑或文件夹"/);
assert.match(app, /streaming-daily-mix/);
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
assert.match(app, /class="streaming-featured-playlists"/);
assert.match(app, /网易云音乐 精选歌单/);
assert.match(app, /为你挑选 \{\{ streamingHomePlaylists\.length \}\} 份歌单/);
assert.match(app, /streamingHomePlaylists\.slice\(0, 8\)/);
assert.match(app, /class="streaming-featured-playlist-card"[\s\S]*?@click="selectPlaylist\(playlist\)"/);
assert.match(app, /playlist\.imageUrl/);
assert.match(app, /@keyframes streaming-daily-preview-bar/);
assert.match(app, /streaming-home-heading/);
assert.doesNotMatch(app, /floatingTopbarVisible|handleMainScroll|class="topbar"/, "已废弃的全局悬浮顶栏应彻底删除");
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
