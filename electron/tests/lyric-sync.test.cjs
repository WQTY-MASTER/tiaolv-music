const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/lyricSync.ts");
const playbackClockPath = path.resolve(__dirname, "../src/renderer/src/services/playbackClock.ts");

async function run() {
  const {
    findCharacterCountAtTime,
    getLyricCharacterProgress,
    getLyricHighlightState,
    getPrefaceCharacterCount,
    getPrefaceHighlightState,
    getPrefaceLineStartTime,
    getPreludeEndTime,
    stabilizeLyricCharacterProgress
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
    { activeIndex: 0, characterCount: 0 },
    "普通 LRC 只有整行时间戳，不应伪造逐字进度"
  );
  assert.equal(
    getLyricCharacterProgress(11, lines),
    0,
    "普通 LRC 应只高亮当前行"
  );
  assert.equal(
    getLyricCharacterProgress(10.5, lines),
    0,
    "普通 LRC 不应按句间时长平均分配到每个字"
  );
  const exactTimedLines = [
    {
      time: 16.21,
      text: "还没",
      characters: [
        { text: "还", start: 16.21, duration: 0.67 },
        { text: "没", start: 16.88, duration: 0.42 }
      ]
    }
  ];
  assert.ok(
    Math.abs(getLyricCharacterProgress(16.545, exactTimedLines) - 0.5) < 0.000001,
    "QRC/YRC 应按真实字时长连续填充当前字"
  );
  const qqQrcLine = [{
    time: 12.739,
    text: "心事谁知晓",
    characters: [
      { text: "心", start: 12.739, duration: 0.958 },
      { text: "事", start: 13.697, duration: 1.095 },
      { text: "谁", start: 14.792, duration: 2.025 },
      { text: "知", start: 16.817, duration: 0.922 },
      { text: "晓", start: 17.739, duration: 3.005 }
    ]
  }];
  assert.ok(
    Math.abs(getLyricCharacterProgress(15.8045, qqQrcLine) - 2.5) < 0.000001,
    "QQ QRC 应在唱到谁字中段时只完成前两字，并把当前字填充到一半"
  );
  assert.deepEqual(
    getLyricHighlightState(14.5, lines),
    { activeIndex: 1, characterCount: 0 },
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
    getPreludeEndTime(8.5, 214, true),
    8.5,
    "第一句歌词晚于两秒时应生成覆盖完整前奏的歌曲信息条目"
  );
  assert.equal(
    getPreludeEndTime(1.8, 214, true),
    0,
    "第一句歌词在两秒内开始时不应生成一闪而过的前奏条目"
  );
  assert.equal(
    getPreludeEndTime(0, 214, false),
    214,
    "纯伴奏或无歌词歌曲应让歌曲信息覆盖完整播放时长"
  );
  assert.equal(
    stabilizeLyricCharacterProgress(3.75, 3.2),
    3.75,
    "正常播放时较旧时间样本不得让已经唱过的字符重新变淡"
  );
  assert.equal(
    stabilizeLyricCharacterProgress(3.75, 1.2, true),
    1.2,
    "用户主动跳转进度时应允许逐字高亮回退"
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

  const staleTimeupdateAudio = {
    currentTime: 10.42,
    paused: false,
    ended: false,
    seeking: false,
    playbackRate: 1
  };
  assert.equal(
    playbackClock.synchronize(staleTimeupdateAudio, 1500),
    10.5,
    "正常播放的 timeupdate 携带较旧媒体时间时，歌词时钟不得向后跳"
  );
  assert.ok(
    Math.abs(playbackClock.read(staleTimeupdateAudio, 1600) - 10.6) < 0.000001,
    "忽略较旧媒体时间后，歌词时钟应继续平滑前进"
  );

  const seekedAudio = { currentTime: 2, paused: false, ended: false, seeking: true, playbackRate: 1 };
  assert.equal(
    playbackClock.synchronize(seekedAudio, 1500),
    2,
    "检测到拖动进度时仍应允许歌词时钟回退到用户选择的位置"
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
