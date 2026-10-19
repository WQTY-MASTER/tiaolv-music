const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const aggregateService = fs.readFileSync(path.join(root, "src/renderer/src/services/aggregatePlaylists.ts"), "utf8");

assert.match(app, /添加到歌单/, "歌曲右键菜单应有普通歌单入口");
assert.match(app, /添加到聚合歌单/, "歌曲右键菜单应有聚合歌单入口");
assert.match(app, /openTracksPlaylistPicker\(localTrackContextMenu\.tracks, 'regular', localTrackContextMenu\.complete\)/, "普通歌单入口应传递右键选中的所有歌曲及完成回调");
assert.match(app, /openTracksPlaylistPicker\(localTrackContextMenu\.tracks, 'aggregate', localTrackContextMenu\.complete\)/, "聚合歌单入口应传递右键选中的所有歌曲及完成回调");
assert.match(app, /class="track-playlist-picker-dialog"/, "加入歌曲时应显示目标歌单选择弹窗");
assert.match(app, /addTrackToRegularPlaylist/, "普通歌单应有独立写入逻辑");
assert.match(app, /async function addTrackToRegularPlaylist[\s\S]*?const next = \{[\s\S]*?persistLocalPlaylists\(next\);[\s\S]*?localPlaylistTrackMap\.value = next;/, "加入普通歌单应先保存候选快照再更新可见歌曲");
assert.match(app, /addTrackToSelectedAggregatePlaylist/, "聚合歌单应有独立写入逻辑");
assert.match(app, /function addTrackToSelectedAggregatePlaylist[\s\S]*?writeAggregatePlaylists\(next\);\s*aggregatePlaylists\.value = next;/, "加入聚合歌单应先保存候选快照再更新可见集合");
assert.doesNotMatch(app, /markAggregatePlaylistTodo/, "聚合歌单入口不应继续使用占位提示");

assert.match(aggregateService, /function addTrackToAggregatePlaylist/, "聚合歌单服务应提供添加音源逻辑");
assert.match(aggregateService, /source\.id === track\.id[\s\S]{0,100}source\.source === track\.source/, "聚合歌单应按平台和曲目 ID 阻止重复音源");

console.log("歌曲加入两类歌单契约通过");
