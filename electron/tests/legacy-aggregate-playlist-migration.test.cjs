const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const sourcePath = path.resolve(
    __dirname,
    "../src/main/legacyAggregatePlaylists.ts"
  );
  assert.ok(fs.existsSync(sourcePath), "应提供旧聚合歌单迁移读取模块");
  const moduleUrl = pathToFileURL(sourcePath).href;
  const {
    LEGACY_AGGREGATE_PLAYLIST_STORAGE_KEY,
    extractLegacyAggregatePlaylistVersions
  } = await import(moduleUrl);

  const first = [{ id: "aggregate-1", name: "旧版本", identifier: "agg1", tracks: [] }];
  const latest = [{ id: "aggregate-1", name: "已恢复", identifier: "agg1", tracks: [
    { id: "qq:1", title: "歌曲", artist: "歌手", source: "qq", sourceLabel: "QQ音乐" }
  ] }];
  const record = (value) => Buffer.concat([
    Buffer.from([0x01, 0x02]),
    Buffer.from(LEGACY_AGGREGATE_PLAYLIST_STORAGE_KEY, "utf8"),
    Buffer.from([0x8f, 0x02, 0x00]),
    Buffer.from(JSON.stringify(value), "utf16le"),
    Buffer.from([0xff, 0xee])
  ]);
  const contents = Buffer.concat([record(first), Buffer.from("noise"), record(latest)]);

  const versions = extractLegacyAggregatePlaylistVersions(contents);
  assert.deepEqual(versions, [first, latest], "应按 LevelDB 日志顺序提取旧聚合歌单版本");

  console.log("旧聚合歌单迁移解析通过");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
