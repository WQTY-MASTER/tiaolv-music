const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/playlistOrder.ts")).href;
  const { applyTrackOrder, reorderVisibleKeys, trackOrderKey } = await import(moduleUrl);

  const tracks = [
    { id: "a", source: "local" },
    { id: "hidden", source: "netease" },
    { id: "c", source: "local" }
  ];

  const reorderedKeys = reorderVisibleKeys(
    tracks.map(trackOrderKey),
    [trackOrderKey(tracks[0]), trackOrderKey(tracks[2])],
    trackOrderKey(tracks[2]),
    trackOrderKey(tracks[0])
  );
  assert.deepEqual(
    reorderedKeys,
    ["local::c", "netease::hidden", "local::a"],
    "筛选状态拖拽只应交换可见歌曲，隐藏歌曲应留在原有槽位"
  );

  assert.deepEqual(
    applyTrackOrder(tracks, reorderedKeys).map((track) => track.id),
    ["c", "hidden", "a"],
    "保存后的完整顺序应能在下次打开时恢复"
  );

  const withNewTrack = [{ id: "new", source: "local" }, ...tracks];
  assert.equal(
    applyTrackOrder(withNewTrack, reorderedKeys)[0].id,
    "new",
    "未进入旧顺序记录的新歌应默认显示在最顶部"
  );

  console.log("歌单手动排序逻辑通过");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
