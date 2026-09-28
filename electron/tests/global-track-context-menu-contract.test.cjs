const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const daily = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingDailyMixPage.vue"), "utf8");
const search = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingSearchPage.vue"), "utf8");
const artist = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingArtistDetailPage.vue"), "utf8");
const cloud = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingCloudPage.vue"), "utf8");
const qqRankings = fs.readFileSync(path.join(root, "src/renderer/src/components/StreamingQqRankingCards.vue"), "utf8");

for (const [name, component] of [
  ["每日推荐/歌单详情", daily],
  ["搜索单曲", search],
  ["歌手歌曲", artist],
  ["音乐云盘", cloud],
  ["QQ 音乐首页榜单", qqRankings],
]) {
  assert.match(component, /context-menu/, `${name}应向上抛出歌曲右键菜单事件`);
  assert.match(component, /@contextmenu\.prevent=/, `${name}歌曲行应拦截右键并打开应用菜单`);
}

assert.match(app, /function openTrackContextMenu\(/, "应用应提供统一歌曲右键菜单入口");
assert.match(app, /<Teleport to="body">[\s\S]*local-track-context-menu/, "右键菜单应全局渲染，不受当前页面模板限制");
assert.match(app, /@context-menu="openTrackContextMenu\(/, "流媒体歌曲页应接入统一右键菜单");
assert.match(app, /@context-menu="openCloudTrackContextMenu"/, "云盘歌曲应转换后接入统一右键菜单");
assert.match(app, /@context-menu="openQqHomeRankingTrackContextMenu"/, "QQ 音乐首页榜单应接入统一右键菜单");
assert.match(app, /function playContextMenuTrackNext\(/, "右键菜单应支持将歌曲设为下一首播放");
assert.match(app, /toggleContextMenuTrackFavorite/, "右键菜单应支持喜欢或取消喜欢");
assert.match(app, /下一首播放/, "右键菜单应显示下一首播放命令");
assert.match(app, /取消喜欢|喜欢/, "右键菜单应显示喜欢命令");
assert.doesNotMatch(app, /加入收藏/, "单曲右键菜单不应显示加入收藏");
assert.match(app, /v-if="localTrackContextMenu\.track\.filePath"/, "查看文件位置只应对本地歌曲显示");
assert.match(app, /@contextmenu\.prevent="openTrackContextMenu\(track, \$event/, "内联歌曲列表也应接入统一右键菜单");

console.log("全局歌曲右键菜单契约通过");
