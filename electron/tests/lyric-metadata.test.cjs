const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/lyricMetadata.ts");

async function run() {
  const { parseLyricCredits } = await import(pathToFileUrl(sourcePath));
  assert.deepEqual(parseLyricCredits(require("./fixtures/qrc-preface.cjs").lyrics), [
    { label: "作曲 Composer", value: "Fixture author", time: 1.457 }
  ], "QRC credits must be decoded without per-word timestamps and preserve their line time");
  const raw = [
    '{"t":0,"c":[{"tx":"作曲: "},{"tx":"jixwang"}]}',
    "[00:00.89]编曲 Arranger : jixwang",
    "[00:01.79]Was it real 这是真的吗"
  ].join("\n");

  assert.deepEqual(
    parseLyricCredits(raw),
    [
      { label: "作曲", value: "jixwang", time: 0 },
      { label: "编曲 Arranger", value: "jixwang", time: 0.89 }
    ],
    "应从 YRC JSON 元数据和本地 LRC 制作信息中保留可展示的歌曲信息及时间轴"
  );

  console.log("歌词制作信息解析通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
