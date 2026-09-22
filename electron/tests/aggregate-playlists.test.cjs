const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/aggregatePlaylists.ts")).href;
  const {
    addTrackToAggregatePlaylist,
    mergeAggregateTracks,
    removeAggregateTrackGroup,
    removeAggregateTrackSource,
    reorderAggregateTrackGroups
  } = await import(moduleUrl);

  const local = {
    id: "local-1",
    title: " 山霁浮古今 ",
    artist: "鸣潮先约电台/jixwang",
    album: "本地专辑",
    duration: 115,
    source: "local",
    sourceLabel: "本地",
    coverUrl: "/library/local-1/cover"
  };
  const netease = {
    id: "ncm-1",
    title: "山霁浮古今",
    artist: "鸣潮先约电台 / jixwang",
    album: "在线专辑",
    duration: 116,
    source: "netease",
    sourceLabel: "网易云"
  };
  const other = {
    id: "local-2",
    title: "另一首歌",
    artist: "另一位歌手",
    album: "本地专辑",
    duration: 200,
    source: "local",
    sourceLabel: "本地",
    coverUrl: "/library/local-2/cover"
  };
  const playlist = {
    id: "aggregate-1",
    name: "测试",
    identifier: "agg1",
    tracks: [local, netease, other],
    createdAt: new Date(0).toISOString()
  };

  const groups = mergeAggregateTracks(playlist.tracks);
  assert.equal(groups.length, 2, "歌名和歌手一致时应合并为一行");
  assert.equal(groups[0].sources.length, 2, "合并行应保留本地和网易云两个音源");
  assert.equal(groups[0].coverUrl, local.coverUrl, "合并行应使用第一个可用歌曲封面");

  const duplicate = addTrackToAggregatePlaylist(playlist, { ...local });
  assert.equal(duplicate.added, false, "同平台同曲目不应重复加入");

  const addedNewTrack = addTrackToAggregatePlaylist(playlist, {
    ...other,
    id: "local-3",
    title: "刚加入的歌"
  });
  assert.equal(
    mergeAggregateTracks(addedNewTrack.playlist.tracks)[0].title,
    "刚加入的歌",
    "新增歌曲行应默认置于聚合歌单顶部"
  );

  const reordered = reorderAggregateTrackGroups(playlist, [groups[1].id, groups[0].id]);
  const reorderedGroups = mergeAggregateTracks(reordered.tracks);
  assert.deepEqual(reorderedGroups.map((group) => group.id), [groups[1].id, groups[0].id], "聚合歌曲行应按手动顺序移动");
  assert.equal(reorderedGroups[1].sources.length, 2, "拖动聚合歌曲行时应保留该行绑定的全部音源");
  assert.equal(reorderedGroups[0].coverUrl, other.coverUrl, "聚合歌单封面应随移动到第一位的合并歌曲行更新");

  const withoutNetease = removeAggregateTrackSource(playlist, groups[0].id, "netease", "ncm-1");
  assert.equal(mergeAggregateTracks(withoutNetease.tracks)[0].sources.length, 1, "删除单个音源应保留歌曲行和其他音源");

  const withoutRow = removeAggregateTrackGroup(playlist, groups[0].id);
  assert.deepEqual(withoutRow.tracks.map((track) => track.id), ["local-2"], "删除歌曲行应一次移除该行全部音源");
  assert.equal(mergeAggregateTracks(withoutRow.tracks)[0].coverUrl, other.coverUrl, "删除首行后应使用新的第一行歌曲封面");
  assert.equal(mergeAggregateTracks(removeAggregateTrackGroup(withoutRow, groups[1].id).tracks).length, 0, "清空聚合歌单后应恢复默认占位图");

  console.log("聚合歌单领域逻辑通过");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
