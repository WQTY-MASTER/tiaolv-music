const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/lyricParser.ts");
const syncPath = path.resolve(__dirname, "../src/renderer/src/services/lyricSync.ts");

async function run() {
  const {
    parseKaraokeTokens,
    parseLyricContent,
    splitLyricCharacters
  } = await import(pathToFileUrl(sourcePath));
  const { getLyricHighlightState } = await import(pathToFileUrl(syncPath));

  assert.deepEqual(
    parseKaraokeTokens("(1000,700,0)你(1700,800,0)好"),
    [
      { text: "你", start: 1, duration: 0.7 },
      { text: "好", start: 1.7, duration: 0.8 }
    ],
    "网易云逐字歌词应解析每个 token 的开始时间和持续时间"
  );

  const yrc = [
    '{"t":0,"c":[{"tx":"作曲: "},{"tx":"测试作者"}]}',
    "[1000,2200](1000,700,0)你(1700,800,0)好(2500,700,0)呀"
  ].join("\n");
  const yrcLines = parseLyricContent(yrc, "[00:01.00]Hello");

  assert.equal(yrcLines.length, 1, "YRC 元数据行不应被当成歌词行");
  assert.equal(yrcLines[0].text, "你好呀", "YRC 应保留歌词正文");
  assert.deepEqual(
    yrcLines[0].characters.map(({ text, start, duration }) => ({ text, start, duration })),
    [
      { text: "你", start: 1, duration: 0.7 },
      { text: "好", start: 1.7, duration: 0.8 },
      { text: "呀", start: 2.5, duration: 0.7 }
    ],
    "YRC 应把逐字 token 转成可渲染的字符时间轴"
  );
  assert.equal(yrcLines[0].translation, "Hello", "翻译应按行时间戳绑定到原歌词下方");

  const slightlyOffsetTranslation = parseLyricContent("[00:10.00]Hello", "[00:10.12]你好");
  assert.equal(
    slightlyOffsetTranslation[0].translation,
    "你好",
    "翻译时间戳有轻微取整误差时仍应绑定到对应原歌词"
  );

  const chineseLine = parseLyricContent("[00:24.65]长夜道不尽离别 又时过境迁");
  assert.equal(
    chineseLine[0].text,
    "长夜道不尽离别 又时过境迁",
    "纯中文歌词中的词间空格不应被误判为翻译分隔符"
  );
  assert.equal(
    chineseLine[0].translation,
    undefined,
    "纯中文歌词应只渲染一行原歌词，不应生成浅色翻译行"
  );

  const bilingualLine = parseLyricContent("[00:01.00]Take me home 带我回家");
  assert.equal(bilingualLine[0].text, "Take me home", "外文原词应保留在原歌词行");
  assert.equal(bilingualLine[0].translation, "带我回家", "外文原词后的中文翻译应保留在下一行");

  const characterOnlyLines = yrcLines.map(({ characterTimes, ...line }) => line);
  assert.deepEqual(
    getLyricHighlightState(1.7, characterOnlyLines),
    { activeIndex: 0, characterCount: 2 },
    "高亮计算应支持直接读取字符时间轴对象"
  );

  const lrcLines = parseLyricContent("[00:10.00]<00:10.00>你<00:10.50>好\n[00:12.00]下一句");
  assert.equal(lrcLines[0].text, "你好", "普通本地 LRC 应去除行内时间标记");
  assert.deepEqual(
    lrcLines[0].characterTimes,
    [10, 10.5],
    "增强 LRC 应保留逐字开始时间"
  );

  assert.deepEqual(
    splitLyricCharacters("A🙂́"),
    ["A", "🙂́"],
    "歌词字符拆分应避免把复合 Unicode 字符拆坏"
  );

  assert.deepEqual(
    getLyricHighlightState(1.69, yrcLines),
    { activeIndex: 0, characterCount: 1 },
    "逐字高亮应在下一个 token 开始前保持上一字状态"
  );
  assert.deepEqual(
    getLyricHighlightState(1.7, yrcLines),
    { activeIndex: 0, characterCount: 2 },
    "逐字高亮应在 token 时间边界切换"
  );
  assert.deepEqual(
    getLyricHighlightState(1.4, yrcLines),
    { activeIndex: 0, characterCount: 1 },
    "拖动进度倒退后应按时间轴重新计算已唱字符"
  );

  console.log("歌词解析契约通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
