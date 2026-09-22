const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/playlistCovers.ts")).href;
  const { mediaPathToUrl, resolvePlaylistCover } = await import(moduleUrl);

  const tracks = [
    { id: "first", coverUrl: "/library/first/cover" },
    { id: "second", coverUrl: "/library/second/cover" }
  ];
  const managedPlaylist = {
    id: "playlist-1",
    imageUrl: "/library/stale-cover/cover",
    userManaged: true
  };
  const resolveCover = (url) => url ? `resolved:${url}` : undefined;

  assert.equal(
    resolvePlaylistCover(managedPlaylist, tracks, undefined, resolveCover),
    "resolved:/library/first/cover",
    "本地歌单应忽略旧的派生 imageUrl，使用当前第一首歌曲封面"
  );
  assert.equal(
    resolvePlaylistCover(managedPlaylist, [tracks[1], tracks[0]], undefined, resolveCover),
    "resolved:/library/second/cover",
    "歌曲重新排序后应立即使用新的第一首歌曲封面"
  );
  assert.equal(
    resolvePlaylistCover(managedPlaylist, [tracks[1]], undefined, resolveCover),
    "resolved:/library/second/cover",
    "删除原第一首歌曲后应使用新的第一首歌曲封面"
  );
  assert.equal(
    resolvePlaylistCover(managedPlaylist, [], undefined, resolveCover),
    undefined,
    "歌单清空后应恢复默认占位图"
  );
  assert.equal(
    resolvePlaylistCover(managedPlaylist, tracks, "D:\\covers\\custom.png", resolveCover),
    "file:///D:/covers/custom.png",
    "用户设置的歌单封面应始终优先于首曲封面"
  );
  assert.equal(
    mediaPathToUrl("data:image/png;base64,AAAA"),
    "data:image/png;base64,AAAA",
    "浏览器文件选择回退生成的数据地址不应被改写"
  );

  console.log("歌单封面派生逻辑通过");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
