const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/streamingDailyMix.ts")).href;
  const { filterAndSortDailyTracks, summarizeDailyDuration } = await import(moduleUrl);
  const tracks = [
    { id: "3", title: "夜航", artist: "周", album: "远方", duration: 210 },
    { id: "1", title: "晨光", artist: "安", album: "今天", duration: 180 },
    { id: "2", title: "海风", artist: "林", album: "远方", duration: 240 }
  ];

  assert.deepEqual(
    filterAndSortDailyTracks(tracks, "远方", "default", "asc").map((track) => track.id),
    ["3", "2"],
    "歌单内搜索应保留接口原始顺序"
  );
  assert.deepEqual(
    filterAndSortDailyTracks(tracks, "", "duration", "desc").map((track) => track.id),
    ["2", "3", "1"],
    "时长降序应即时重排歌曲"
  );
  assert.deepEqual(
    filterAndSortDailyTracks(tracks, "", "artist", "asc").map((track) => track.id),
    ["1", "2", "3"],
    "歌手升序应按中文名称排序"
  );
  assert.equal(summarizeDailyDuration(tracks), "约 11 分钟", "总时长应按分钟向上取整");

  console.log("流媒体每日推荐排序逻辑通过");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
