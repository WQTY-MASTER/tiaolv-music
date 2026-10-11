const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/lyricParser.ts");
const syncPath = path.resolve(__dirname, "../src/renderer/src/services/lyricSync.ts");

async function run() {
  const {
    parseKaraokeTokens,
    parseQrcContent,
    parseQrcTokens,
    parseLyricContent,
    parseYrcTokens,
    getLeadingLyricQuote,
    splitLyricCharacters
  } = await import(pathToFileUrl(sourcePath));
  const { getLyricHighlightState } = await import(pathToFileUrl(syncPath));
  assert.equal(getLeadingLyricQuote('“Will the prophecy manifest'), '“', 'Opening quotes must be identified for hanging alignment without removing source text');
  assert.equal(getLeadingLyricQuote('“预言是否会显现'), '“');
  assert.equal(getLeadingLyricQuote('"Hello'), '"');
  assert.equal(getLeadingLyricQuote("There's no turning back"), '');
  assert.equal(getLeadingLyricQuote(''), '');
  const fixture = require("./fixtures/qrc-preface.cjs");
  for (const [format, raw] of [
    ['LRC', '[00:15.00]音乐总监Music Director: jixwang\n[00:17.00]Could you spare a second\n[00:18.00]Answer: stay with me'],
    ['QRC', '[15000,1000]音乐总监Music Director: jixwang(15000,1000)\n[17000,1000]Could you spare a second(17000,1000)\n[18000,1000]Answer: stay with me(18000,1000)']
  ]) {
    assert.deepEqual(parseLyricContent(raw, undefined, format).map(line => line.text),
      ['Could you spare a second', 'Answer: stay with me'], 'Director metadata must not enter sung lyrics; normal colons must remain');
  }
  assert.deepEqual(parseLyricContent('[10000,600]人声编辑：(10000,200)Tsuiyuching(10200,400)\n[20000,1500]I was standing in the quiet(20000,1500)', undefined, 'QRC').map(line => line.text),
    ['I was standing in the quiet'], '人声编辑不应作为演唱歌词被高亮或改变前奏结束时间');
  const singingLines = parseLyricContent(fixture.lyrics, fixture.translation, "QRC");
  assert.deepEqual(singingLines.map(line => line.text), ["First original", "Second original", "Third original"],
    "QRC title, vocal roles and separators must not become sung lines or hide the prelude");
  assert.equal(singingLines[0].time, 12.131);

  const qqPreludeLines = parseLyricContent(
    [
      "[ti:QQ 返回的错误标题]",
      "[ar:测试歌手]",
      "[416,3601]测试歌曲 (Wish You) - 测试歌手(416,3601)",
      "[4017,335]词(4017,175)：(4192,0)作者(4192,160)",
      "[18848,3189]First (18848,1040)line(19888,2149)"
    ].join("\n"),
    "[00:00.41]//\n[00:04.01]//\n[00:18.84]第一句翻译",
    "QRC"
  );
  assert.deepEqual(
    qqPreludeLines.map(({ text, translation }) => ({ text, translation })),
    [{ text: "First line", translation: "第一句翻译" }],
    "QQ 开场歌曲信息和翻译轨中的 // 占位符都不应进入正文歌词"
  );

  assert.deepEqual(
    parseYrcTokens("(1000,700,0)你(1700,800,0)好"),
    [
      { text: "你", start: 1, duration: 0.7 },
      { text: "好", start: 1.7, duration: 0.8 }
    ],
    "网易云逐字歌词应解析每个 token 的开始时间和持续时间"
  );
  assert.deepEqual(
    parseQrcTokens("密(1000,500)文(1500,500)"),
    [
      { text: "密", start: 1, duration: 0.5 },
      { text: "文", start: 1.5, duration: 0.5 }
    ],
    "QQ 音乐 QRC 应解析每个字后面的开始时间和持续时间"
  );
  assert.deepEqual(
    parseKaraokeTokens("密(1000,500)文(1500,500)"),
    parseQrcTokens("密(1000,500)文(1500,500)"),
    "兼容入口应把 QQ 后置时间语法交给独立 QRC 解析器"
  );

  const qrcLines = parseQrcContent(
    [
      "[126,15]歌曲名 - 歌手(126,15)",
      "[1000,1500]你(1000,400)，(1400,200) A(1600,900)"
    ].join("\n")
  );
  assert.equal(qrcLines.length, 1, "QRC 的标题和制作信息不应进入演唱歌词列表");
  assert.equal(qrcLines[0].text, "你， A", "QRC 不应丢失标点、英文或内部空格");
  assert.deepEqual(
    qrcLines[0].characters.map(({ text, start, duration }) => ({
      text,
      start: Number(start.toFixed(3)),
      duration: Number(duration.toFixed(3))
    })),
    [
      { text: "你", start: 1, duration: 0.4 },
      { text: "，", start: 1.4, duration: 0.2 },
      { text: " ", start: 1.6, duration: 0.45 },
      { text: "A", start: 2.05, duration: 0.45 }
    ],
    "QRC 多字符 token 应保留原字符并在 token 时长内分配时间"
  );

  const yrc = [
    '{"t":0,"c":[{"tx":"作曲: "},{"tx":"测试作者"}]}',
    "[1000,2200](1000,700,0)你(1700,800,0)好(2500,700,0)呀"
  ].join("\n");
  const yrcLines = parseLyricContent(yrc, "[00:01.00]Hello", "YRC");

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

  const adjacentSpeakerLine = parseLyricContent(
    "[00:10.00]Lupa:\n[00:10.12]All the medals on my chest are glimmering",
    "[00:10.12]胸间的勋章闪耀着"
  );
  assert.equal(adjacentSpeakerLine[0].translation, undefined, "人物名不应错误复用下一句的翻译");
  assert.equal(adjacentSpeakerLine[1].translation, "胸间的勋章闪耀着", "翻译应只绑定时间最接近的原歌词");

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

  const orchestralPrelude = parseLyricContent([
    "[00:00.000]梦枢心相由心生二 ——《月声尽，心灯明》",
    "[00:00.000]乐团 Orchestra：室屋 光一郎ストリングス Koichiro Muroya Strings",
    "[00:00.000]Violin：室屋 光一郎",
    "[00:00.000]Cello：堀沢 真己",
    "[00:00.000]Pipa：袁端端",
    "[00:00.000]Erhu：范汉卿",
    "[00:00.000]Chinese Opera：金露",
    "[00:00.000]音乐统筹 Music Coordinator：markmilian / 猫虚Sonn / auburn",
    "[00:16.025]月光会不会记得今夜"
  ].join("\n"));
  assert.deepEqual(
    orchestralPrelude.map(({ text, translation }) => ({ text, translation })),
    [{ text: "月光会不会记得今夜", translation: undefined }],
    "零秒作品标题和管弦乐制作名单不应被拆成正文歌词或翻译"
  );

  const characterOnlyLines = yrcLines.map(({ characterTimes, ...line }) => line);
  assert.deepEqual(
    getLyricHighlightState(1.7, characterOnlyLines),
    { activeIndex: 0, characterCount: 2 },
    "高亮计算应支持直接读取字符时间轴对象"
  );

  const lrcLines = parseLyricContent("[00:10.00]<00:10.00>你<00:10.50>好\n[00:12.00]下一句");
  assert.equal(lrcLines[0].text, "你好", "普通本地 LRC 应去除行内时间标记");
  assert.equal(lrcLines[0].characterTimes, undefined, "LRC 应保持整行时间，不冒充 QRC/YRC 逐字歌词");

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
