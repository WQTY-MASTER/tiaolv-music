const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/lyricMetadata.ts");

async function run() {
  const { parseLyricCredits } = await import(pathToFileUrl(sourcePath));
  const directors = '[00:15.00]音乐总监Music Director: jixwang\n[16000,600]Music Director：(16000,100)Fixture(16100,500)';
  assert.deepEqual(parseLyricCredits(directors), [
    { label: '音乐总监Music Director', value: 'jixwang', time: 15 },
    { label: 'Music Director', value: 'Fixture', time: 16 }
  ], 'Music director credits must remain in the production information');
  assert.deepEqual(parseLyricCredits('[10000,600]人声编辑：(10000,200)Tsuiyuching(10200,400)'), [
    { label: '人声编辑', value: 'Tsuiyuching', time: 10 }
  ], '人声编辑必须留在歌曲制作信息中');
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

  const orchestralCredits = [
    "[00:00.000]乐团 Orchestra：室屋 光一郎ストリングス Koichiro Muroya Strings",
    "[00:00.000]Violin：室屋 光一郎",
    "[00:00.000]Cello：堀沢 真己",
    "[00:00.000]Pipa：袁端端",
    "[00:00.000]Erhu：范汉卿",
    "[00:00.000]Chinese Opera：金露",
    "[00:00.000]音乐统筹 Music Coordinator：markmilian / 猫虚Sonn / auburn"
  ].join("\n");
  assert.deepEqual(
    parseLyricCredits(orchestralCredits).map(({ label, value }) => ({ label, value })),
    [
      { label: "乐团 Orchestra", value: "室屋 光一郎ストリングス Koichiro Muroya Strings" },
      { label: "Violin", value: "室屋 光一郎" },
      { label: "Cello", value: "堀沢 真己" },
      { label: "Pipa", value: "袁端端" },
      { label: "Erhu", value: "范汉卿" },
      { label: "Chinese Opera", value: "金露" },
      { label: "音乐统筹 Music Coordinator", value: "markmilian / 猫虚Sonn / auburn" }
    ],
    "管弦乐器和音乐统筹应归入制作信息"
  );

  const qqCredits = [
    "[4017,335]词(4017,175)：(4192,0)Tarokiki(4192,160)",
    "[4352,648]曲(4352,160)：(4512,0)测试作曲(4512,480)",
    "[5000,832]编(5000,160)曲(5160,160)：(5320,0)测试编曲(5320,512)",
    "[8328,2064]管(8328,178)弦(8506,173)乐(8679,169)团(8848,168)：(9016,0)测试乐团(9016,1376)"
  ].join("\n");
  assert.deepEqual(
    parseLyricCredits(qqCredits).map(({ label, value }) => ({ label, value })),
    [
      { label: "词", value: "Tarokiki" },
      { label: "曲", value: "测试作曲" },
      { label: "编曲", value: "测试编曲" },
      { label: "管弦乐团", value: "测试乐团" }
    ],
    "QQ 的短制作标签和管弦乐团信息应完整保留"
  );

  console.log("歌词制作信息解析通过");
  const app = fs.readFileSync(path.resolve(__dirname, "../src/renderer/src/App.vue"), "utf8");
  const songInfoTag = app.match(/<div\b[^\r\n]*class="song-detail-song-info"[^\r\n]*>/u)?.[0];
  assert.ok(songInfoTag, "歌曲制作信息区域必须存在");
  assert.doesNotMatch(songInfoTag, /v-if=/u, "歌曲信息必须始终显示，不能以有无前奏作为显示条件");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
