const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/desktopLyricsOverflow.ts");

async function run() {
  const {
    getDesktopLyricPlaybackProgress,
    getDesktopLyricScrollProgress
  } = await import(pathToFileUrl(sourcePath));

  assert.equal(getDesktopLyricPlaybackProgress(10, 10, 20), 0, "歌词开始时进度应为零");
  assert.equal(getDesktopLyricPlaybackProgress(15, 10, 20), 0.5, "整行歌词应按本句时长计算进度");
  assert.equal(getDesktopLyricPlaybackProgress(24, 10, 20), 1, "歌词进度不得超过一");
  assert.equal(getDesktopLyricPlaybackProgress(15, 10, 10), 0, "缺少有效结束时间时不应自动滚动");
  assert.equal(getDesktopLyricPlaybackProgress(15, 10, 20, 6, 12), 0.5, "逐字歌词应优先使用字符进度");

  assert.equal(getDesktopLyricScrollProgress(0.08, true), 0, "开头应留出稳定阅读时间");
  assert.ok(
    Math.abs(getDesktopLyricScrollProgress(0.5, true) - 0.5) < Number.EPSILON,
    "演唱到中点时长句也应滚动到中点"
  );
  assert.equal(getDesktopLyricScrollProgress(0.92, true), 1, "结尾前应完整显示歌词末尾");
  assert.equal(getDesktopLyricScrollProgress(0.49, false), 0, "关闭动画时前半句保持句首");
  assert.equal(getDesktopLyricScrollProgress(0.5, false), 1, "关闭动画时后半句直接显示句尾");

  console.log("桌面歌词长句滚动逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
