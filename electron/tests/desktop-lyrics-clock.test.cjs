const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/desktopLyricsClock.ts");

async function run() {
  const { projectDesktopLyricsTime, reconcileDesktopLyricsTime } = await import(pathToFileUrl(sourcePath));

  assert.equal(
    projectDesktopLyricsTime(12.5, 1_000, 1_016, false),
    12.5,
    "暂停时桌面歌词时钟不应自行前进"
  );
  assert.ok(
    Math.abs(projectDesktopLyricsTime(12.5, 1_000, 1_016, true) - 12.516) < 0.000001,
    "播放时桌面歌词应在主窗口同步间隔内按帧平滑前进"
  );
  assert.equal(
    projectDesktopLyricsTime(12.5, 1_016, 1_000, true),
    12.5,
    "异常倒退的帧时间不得让歌词进度回退"
  );
  assert.equal(
    projectDesktopLyricsTime(-2, 1_000, 1_016, true),
    0.016,
    "无效的负播放时间应从零开始修正"
  );
  assert.equal(
    reconcileDesktopLyricsTime(12.58, 12.5, true, false),
    12.58,
    "正常播放的延迟校时不得让桌面歌词进度回跳"
  );
  assert.equal(
    reconcileDesktopLyricsTime(12.58, 12.5, true, true),
    12.5,
    "拖动进度或切歌时应允许桌面歌词时钟回退"
  );
  assert.equal(
    reconcileDesktopLyricsTime(12.5, 12.62, true, false),
    12.62,
    "较新的播放时间应立即校正桌面歌词"
  );

  console.log("桌面歌词平滑时钟测试通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replace(/\\/g, "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
