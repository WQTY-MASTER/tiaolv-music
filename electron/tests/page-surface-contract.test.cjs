const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const daily = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingDailyMixPage.vue"), "utf8");

assert.match(app, /--app-page-background:\s*#f4f4f6/, "所有主页面应共用低饱和浅灰背景变量");
assert.match(app, /--app-card-background:\s*#fff/, "内容卡片应共用白色表面变量");
assert.match(app, /--app-playing-background:\s*#f7f3ea/, "播放中歌曲应共用浅米色高亮变量");
assert.match(app, /body\s*\{[^}]*background:\s*var\(--app-page-background\)/, "窗口页面背景应使用全局浅灰变量");
assert.match(app, /\.app-shell\s*\{[^}]*background:\s*var\(--app-page-background\)/, "应用主壳背景应使用全局浅灰变量");
assert.match(app, /\.workspace\s*\{[^}]*background:\s*var\(--app-page-background\)/, "工作区背景应使用全局浅灰变量");
assert.match(app, /\.main-scroll\s*\{[^}]*background:\s*var\(--app-page-background\)/, "主滚动区背景应使用全局浅灰变量");

for (const selector of [
  "local-library-table",
  "recent-history-table",
  "local-folder-detail",
  "playlist-track-container",
]) {
  const escaped = selector.replaceAll("-", "\\-");
  assert.match(
    app,
    new RegExp(`\\.${escaped}\\s*\\{[^}]*background:\\s*var\\(--app-card-background\\)[^}]*box-shadow:\\s*var\\(--app-card-shadow\\)`),
    `${selector} 应使用白色卡片和统一柔和阴影`,
  );
}

assert.match(daily, /\.daily-detail-table\s*\{[^}]*background:\s*var\(--app-card-background\)[^}]*box-shadow:\s*var\(--app-card-shadow\)/, "每日推荐列表应使用统一白色卡片层级");

for (const selector of [
  "local-library-row.active",
  "recent-history-row.active",
  "playlist-track-card.active",
  "local-folder-track-list>button.active",
]) {
  const escaped = selector.replace(/[.>]/g, (character) => `\\${character}`).replaceAll("-", "\\-");
  assert.match(app, new RegExp(`\\.${escaped}\\s*\\{[^}]*background:\\s*var\\(--app-playing-background\\)`), `${selector} 应使用统一浅米色播放高亮`);
}

console.log("全局页面背景与列表表面契约通过");
