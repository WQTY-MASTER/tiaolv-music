const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/shared/desktopLyrics.ts");

async function run() {
  const {
    DEFAULT_DESKTOP_LYRICS_PREFERENCES,
    clampDesktopLyricsBounds,
    clampDesktopLyricsFontSize,
    getDesktopLyricHighlightMode,
    getDesktopLyricCharacterFill,
    normalizeDesktopLyricsPreferences,
    resolveDesktopLyricAccent,
    resolveDesktopLyricColors
  } = await import(pathToFileUrl(sourcePath));

  assert.deepEqual(DEFAULT_DESKTOP_LYRICS_PREFERENCES, {
    enabled: false,
    alwaysOnTop: true,
    locked: false,
    translationEnabled: true,
    phoneticEnabled: false,
    fontFamily: "Microsoft YaHei UI",
    fontSize: 38,
    fontWeight: "standard",
    strokeEnabled: true,
    lineMode: "double",
    orientation: "horizontal",
    textAlign: "center",
    lyricColorTheme: "cover",
    customPlayedColor: "#ff8f98",
    customUnplayedColor: "#f4e5e1",
    panelOpacity: 0.72,
    cornerRadius: 18,
    shadowEnabled: true,
    animationEnabled: true
  }, "桌面歌词应使用稳定的默认设置");

  assert.equal(clampDesktopLyricsFontSize(8), 20, "字号不得低于 20px");
  assert.equal(clampDesktopLyricsFontSize(90), 64, "字号不得超过 64px");
  assert.equal(clampDesktopLyricsFontSize(41.6), 42, "字号应归一化为整数");
  assert.deepEqual(
    clampDesktopLyricsBounds({ width: 2000, height: 80 }),
    { width: 1600, height: 140 },
    "窗口尺寸应限制在设置滑块支持的范围内"
  );

  assert.deepEqual(normalizeDesktopLyricsPreferences({
    locked: true,
    enabled: true,
    alwaysOnTop: false,
    translationEnabled: false,
    phoneticEnabled: true,
    fontFamily: "MiSans Light",
    fontSize: 52,
    fontWeight: "bold",
    strokeEnabled: false,
    lineMode: "single",
    orientation: "horizontal",
    textAlign: "left",
    lyricColorTheme: "twilight",
    customPlayedColor: "#12ABEF",
    customUnplayedColor: "#345678",
    panelOpacity: 0.45,
    cornerRadius: 8,
    shadowEnabled: false,
    animationEnabled: false
  }), {
    enabled: true,
    alwaysOnTop: false,
    locked: true,
    translationEnabled: false,
    phoneticEnabled: true,
    fontFamily: "MiSans Light",
    fontSize: 52,
    fontWeight: "bold",
    strokeEnabled: false,
    lineMode: "single",
    orientation: "horizontal",
    textAlign: "left",
    lyricColorTheme: "twilight",
    customPlayedColor: "#12abef",
    customUnplayedColor: "#345678",
    panelOpacity: 0.45,
    cornerRadius: 8,
    shadowEnabled: false,
    animationEnabled: false
  }, "有效持久化设置应完整恢复");

  const migrated = normalizeDesktopLyricsPreferences({ customLyricColor: "#12ABEF" });
  assert.equal(migrated.customPlayedColor, "#12abef", "旧版自定义歌词颜色应迁移为已播放颜色");

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

  assert.equal(resolveDesktopLyricAccent("cover", "#2388cc", "#ff0000"), "#2388cc", "封面配色应使用当前歌曲强调色");
  assert.equal(resolveDesktopLyricAccent("sunset", "#2388cc", "#ff0000"), "#f1a6aa", "落日晖应使用固定柔粉色");
  assert.equal(resolveDesktopLyricAccent("custom", "#2388cc", "#12abef"), "#12abef", "自定义配色应使用用户颜色");
  assert.deepEqual(
    resolveDesktopLyricColors("sunset", "#2388cc", "#111111", "#222222"),
    { played: "#f1a6aa", unplayed: "#eadbd8" },
    "主题应同时解析已播放和未播放颜色"
  );
  assert.deepEqual(
    resolveDesktopLyricColors("custom", "#2388cc", "#12abef", "#345678"),
    { played: "#12abef", unplayed: "#345678" },
    "自定义主题应保留两个独立色值"
  );

  assert.equal(getDesktopLyricHighlightMode({ source: "qq", lyricsFormat: "QRC" }), "word", "QQ 音乐 QRC 应逐字变色");
  assert.equal(getDesktopLyricHighlightMode({ source: "qq", lyricsFormat: "LRC" }), "line", "QQ 普通歌词应回退整行变色");
  assert.equal(getDesktopLyricHighlightMode({ source: "netease", lyricsFormat: "YRC" }), "line", "网易云逐字数据也应按整行变色");
  assert.equal(getDesktopLyricHighlightMode({ source: "local", lyricsFormat: "YRC" }), "word", "本地逐字歌词应保留逐字变色");

  console.log("桌面歌词状态逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
