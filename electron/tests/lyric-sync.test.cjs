const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/lyricSync.ts");
const playbackClockPath = path.resolve(__dirname, "../src/renderer/src/services/playbackClock.ts");

async function run() {
  const {
    findCharacterCountAtTime,
    getLyricHighlightState,
    getPrefaceCharacterCount,
    getPrefaceHighlightState,
    getPrefaceLineStartTime
  } = await import(pathToFileUrl(sourcePath));
  const {
    createPlaybackClock,
    getPlaybackDuration,
    getSeekablePlaybackDuration,
    isPreviewPlayback
  } = await import(pathToFileUrl(playbackClockPath));
  const lines = [
    { time: 10, text: "abcd" },
    { time: 14, text: "ef" }
  ];
  const wordTimedLines = [
    { time: 16.21, text: "还没", characterTimes: [16.21, 16.88] }
  ];

  assert.deepEqual(
    getLyricHighlightState(11, lines),
    { activeIndex: 0, characterCount: 1 },
    "普通 LRC 应根据当前句到下一句的时间计算已唱字符数"
  );
  assert.deepEqual(
    getLyricHighlightState(14.5, lines),
    { activeIndex: 1, characterCount: 1 },
    "切换到下一句时，上一句不应继续作为高亮状态"
  );
  assert.deepEqual(
    getLyricHighlightState(9.9, lines),
    { activeIndex: -1, characterCount: 0 },
    "第一句开始前不应点亮歌词"
  );
  assert.deepEqual(
    getLyricHighlightState(16.2, wordTimedLines),
    { activeIndex: -1, characterCount: 0 },
    "逐字歌词行开始前不应提前点亮"
  );
  assert.deepEqual(
    getLyricHighlightState(16.25, wordTimedLines),
    { activeIndex: 0, characterCount: 1 },
    "逐字歌词应使用网易云提供的第一个字符时间戳"
  );
  assert.deepEqual(
    getLyricHighlightState(16.89, wordTimedLines),
    { activeIndex: 0, characterCount: 2 },
    "逐字歌词应使用网易云提供的第二个字符时间戳"
  );
  assert.deepEqual(
    getLyricHighlightState(16.5, wordTimedLines),
    { activeIndex: 0, characterCount: 1 },
    "拖动进度倒退后逐字高亮应按时间轴恢复"
  );
  assert.equal(
    findCharacterCountAtTime([16.21, 16.88], 16.5),
    1,
    "逐字高亮计数应在字符时间戳中定位当前字符"
  );
  assert.equal(
    findCharacterCountAtTime([16.21, 16.88], 16.88),
    2,
    "逐字高亮计数应在字符时间戳边界准确切换"
  );
  assert.equal(
    getPrefaceCharacterCount(1, 4, 20),
    5,
    "前奏歌曲信息应根据第一句歌词时间按比例点亮字符"
  );
  assert.equal(
    getPrefaceCharacterCount(4, 4, 20),
    0,
    "第一句歌词开始后前奏歌曲信息应清除逐字高亮"
  );
  assert.equal(
    getPrefaceCharacterCount(2, 4, 0),
    0,
    "没有歌曲信息字符时前奏高亮数量应为零"
  );
  assert.deepEqual(
    getPrefaceHighlightState(1, 4, [4, 6]),
    { activeIndex: 0, characterCount: 2 },
    "前奏歌曲信息应只高亮当前行的字符"
  );
  assert.deepEqual(
    getPrefaceHighlightState(2.5, 4, [4, 6]),
    { activeIndex: 1, characterCount: 1 },
    "前奏进入下一行后上一行应结束高亮"
  );
  assert.deepEqual(
    getPrefaceHighlightState(4, 4, [4, 6]),
    { activeIndex: -1, characterCount: 0 },
    "第一句歌词开始后歌曲信息行应停止高亮"
  );
  assert.deepEqual(
    getPrefaceHighlightState(5.5, 11, [4, 6], [0, 5.4]),
    { activeIndex: 1, characterCount: 0 },
    "网易云提供前奏信息时间戳时应优先按真实时间定位当前行"
  );
  assert.equal(
    getPrefaceLineStartTime(11, 11, 6),
    6,
    "前奏制作信息的每一行应获得独立播放起点"
  );
  assert.equal(
    getPrefaceLineStartTime(11, 11, 11),
    undefined,
    "不存在的前奏行不应返回可播放时间"
  );
  assert.equal(
    getPlaybackDuration(280, 40.824),
    280,
    "试听歌曲的进度时间轴应保留歌曲完整时长"
  );
  assert.equal(
    getPlaybackDuration(280, Number.NaN),
    280,
    "媒体元数据尚未可用时应暂时使用目录时长"
  );
  assert.equal(
    getSeekablePlaybackDuration(280, 40.824),
    40.824,
    "试听歌曲拖动进度时只能跳转到实际允许播放的终点"
  );
  assert.equal(
    isPreviewPlayback(280, 40.824),
    true,
    "实际音频明显短于目录歌曲时长时应识别为试听片段"
  );

  const playbackClock = createPlaybackClock();
  const playingAudio = { currentTime: 10, paused: false, ended: false, playbackRate: 1 };
  playbackClock.reset(playingAudio, 1000);
  assert.ok(
    Math.abs(playbackClock.read(playingAudio, 1500) - 10.5) < 0.000001,
    "播放时钟应在浏览器暂时没有刷新媒体 currentTime 时平滑估算当前时间"
  );

  const seekedAudio = { currentTime: 2, paused: false, ended: false, seeking: true, playbackRate: 1 };
  assert.equal(
    playbackClock.read(seekedAudio, 1500),
    2,
    "检测到拖动进度或音频跳变时应立即重新锚定媒体时间"
  );

  const pausedAudio = { currentTime: 2.25, paused: true, ended: false, playbackRate: 1 };
  assert.equal(
    playbackClock.read(pausedAudio, 2000),
    2.25,
    "暂停后歌词时间应直接使用媒体当前时间而不是继续估算"
  );

  console.log("歌词同步逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
