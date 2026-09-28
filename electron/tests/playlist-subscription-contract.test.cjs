const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const detail = fs.readFileSync(
  path.join(root, "src/renderer/src/components/StreamingDailyMixPage.vue"),
  "utf8",
);
const library = fs.readFileSync(
  path.join(root, "src/renderer/src/components/StreamingLibraryPage.vue"),
  "utf8",
);
const overrides = fs.readFileSync(
  path.join(root, "src/renderer/src/services/playlistSubscriptionOverrides.ts"),
  "utf8",
);

assert.match(api, /export function setAccountPlaylistSubscription\b/, "前端应提供统一歌单收藏接口");
assert.match(api, /AbortSignal\.timeout\(5_000\)/, "平台收藏同步不应让界面长时间等待");
assert.match(api, /\/account\/\$\{encodeURIComponent\(provider\)\}\/playlists\/\$\{encodeURIComponent\(playlistId\)\}\/subscription/, "歌单收藏应调用统一账号路由");
assert.match(app, /const selectedPlaylistCollectable = computed/, "应用应判断当前在线歌单是否可收藏");
assert.match(app, /const selectedPlaylistCollected = computed/, "应用应从账号歌单中派生收藏状态");
assert.match(app, /createdByAccount/, "自己创建的歌单不应作为可收藏对象");
assert.match(app, /async function toggleSelectedPlaylistCollection/, "应用应处理歌单收藏和取消收藏");
assert.match(app, /setAccountPlaylistSubscription/, "应用应调用统一收藏接口");
assert.match(app, /loadAccountPlaylists/, "收藏完成后应刷新当前音源的账号歌单");
assert.match(app, /reconcilePlaylistSubscriptionRefresh/, "刷新结果应与刚完成的收藏操作合并，避免上游延迟导致状态回退");
assert.match(app, /:collectable="selectedPlaylistCollectable"/, "歌单详情应接收可收藏状态");
assert.match(app, /:collected="selectedPlaylistCollected"/, "歌单详情应接收已收藏状态");
assert.match(app, /:collection-pending="playlistCollectionPending"/, "歌单详情应禁用重复提交");
assert.match(app, /@toggle-collection="toggleSelectedPlaylistCollection"/, "歌单详情收藏按钮应连接收藏动作");

assert.match(detail, /collectable\?: boolean/, "共用歌单详情应支持可收藏状态");
assert.match(detail, /collected\?: boolean/, "共用歌单详情应支持已收藏状态");
assert.match(detail, /collectionPending\?: boolean/, "共用歌单详情应支持提交中状态");
assert.match(detail, /"toggle-collection": \[\]/, "共用歌单详情应发出收藏事件");
assert.match(detail, /收藏歌单/, "歌单详情应提供收藏按钮");
assert.match(detail, /已收藏/, "收藏按钮应显示选中状态");
assert.match(detail, /collection-active/, "已收藏按钮应有独立灰色选中样式");

assert.match(library, /我的喜欢/);
assert.match(library, /我喜欢的歌曲/);
assert.doesNotMatch(library, /我收藏的歌曲/, "单曲集合不应继续称为收藏歌曲");
assert.match(library, /我创建的[\s\S]*我收藏的/, "歌单分类仍应保留收藏语义");

assert.match(overrides, /listenmusic\.account-playlist-subscriptions\.v1/, "本地收藏兜底应按稳定键持久化");
assert.match(overrides, /export function savePlaylistSubscriptionOverride/, "收藏操作应写入本地覆盖状态");
assert.match(overrides, /export function mergePlaylistSubscriptionOverrides/, "远端歌单应与本地收藏覆盖状态合并");
assert.match(app, /savePlaylistSubscriptionOverride/, "收藏和取消收藏都应持久化本地兜底状态");
assert.match(app, /mergePlaylistSubscriptionOverrides/, "音乐库加载时应恢复本地收藏兜底状态");
assert.match(
  app,
  /playlistsResult\.status === "fulfilled"[\s\S]*?else \{[\s\S]*?toAccountPlaylistListWithOverrides\(\[\], provider\)/,
  "平台歌单读取失败时也应展示本地持久化的收藏"
);

console.log("歌单收藏与歌曲喜欢语义契约通过");
