const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/shared/desktopLyrics.ts");

async function run() {
  const {
    DEFAULT_DESKTOP_LYRICS_PREFERENCES,
    clampDesktopLyricsFontSize,
    getDesktopLyricCharacterFill,
    normalizeDesktopLyricsPreferences
  } = await import(pathToFileUrl(sourcePath));

  assert.deepEqual(DEFAULT_DESKTOP_LYRICS_PREFERENCES, {
    locked: false,
    translationEnabled: true,
    fontSize: 38
  }, "桌面歌词应使用稳定的默认设置");

  assert.equal(clampDesktopLyricsFontSize(8), 20, "字号不得低于 20px");
  assert.equal(clampDesktopLyricsFontSize(90), 64, "字号不得超过 64px");
  assert.equal(clampDesktopLyricsFontSize(41.6), 42, "字号应归一化为整数");

  assert.deepEqual(normalizeDesktopLyricsPreferences({
    locked: true,
    translationEnabled: false,
    fontSize: 52
  }), {
    locked: true,
    translationEnabled: false,
    fontSize: 52
  }, "有效持久化设置应完整恢复");

  assert.deepEqual(normalizeDesktopLyricsPreferences({
    locked: "yes",
    translationEnabled: 1,
    fontSize: Number.NaN
  }), DEFAULT_DESKTOP_LYRICS_PREFERENCES, "非法持久化值应逐项回退默认设置");

  assert.equal(getDesktopLyricCharacterFill(0.25, 0), 0.25, "当前字符应按进度逐步填充");
  assert.equal(getDesktopLyricCharacterFill(1.4, 0), 1, "已经唱完的字符必须保持完全高亮");
  assert.ok(
    Math.abs(getDesktopLyricCharacterFill(1.4, 1) - 0.4) < Number.EPSILON,
    "下一字符应从零继续填充"
  );
  assert.equal(getDesktopLyricCharacterFill(1.4, 2), 0, "尚未开始的字符不得提前高亮");

  console.log("桌面歌词状态逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
