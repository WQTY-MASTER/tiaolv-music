const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const aggregateService = fs.readFileSync(path.join(root, "src/renderer/src/services/aggregatePlaylists.ts"), "utf8");

assert.match(app, />加入歌单<\/button>/, "歌曲右键菜单应有普通歌单入口");
assert.match(app, />加入聚合歌单<\/button>/, "歌曲右键菜单应有聚合歌单入口");
assert.match(app, /openTrackPlaylistPicker\(localTrackContextMenu\.track, 'regular'\)/, "普通歌单入口应打开普通目标选择器");
assert.match(app, /openTrackPlaylistPicker\(localTrackContextMenu\.track, 'aggregate'\)/, "聚合歌单入口应打开聚合目标选择器");
assert.match(app, /class="track-playlist-picker-dialog"/, "加入歌曲时应显示目标歌单选择弹窗");
assert.match(app, /addTrackToRegularPlaylist/, "普通歌单应有独立写入逻辑");
assert.match(app, /localPlaylistTrackMap\.value\s*=\s*\{[\s\S]{0,500}persistLocalPlaylists\(\)/, "加入普通歌单后应更新并持久化普通歌单数据");
assert.match(app, /addTrackToSelectedAggregatePlaylist/, "聚合歌单应有独立写入逻辑");
assert.match(app, /writeAggregatePlaylists\(aggregatePlaylists\.value\)/, "加入聚合歌单后应持久化聚合歌单数据");
assert.doesNotMatch(app, /markAggregatePlaylistTodo/, "聚合歌单入口不应继续使用占位提示");

assert.match(aggregateService, /function addTrackToAggregatePlaylist/, "聚合歌单服务应提供添加音源逻辑");
assert.match(aggregateService, /source\.id === track\.id[\s\S]{0,100}source\.source === track\.source/, "聚合歌单应按平台和曲目 ID 阻止重复音源");

console.log("歌曲加入两类歌单契约通过");
