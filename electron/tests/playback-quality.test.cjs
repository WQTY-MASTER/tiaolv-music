const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/playbackQuality.ts");

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

async function run() {
  const quality = await import(pathToFileURL(sourcePath).href);

  assert.deepEqual(
    quality.readPlaybackQualityPreferences(memoryStorage()),
    { netease: "auto", qq: "auto", reloadCurrent: false },
    "未保存配置时应使用自动音质且不重载当前歌曲"
  );

  assert.deepEqual(
    quality.readPlaybackQualityPreferences(memoryStorage({
      "tiaolv-playback-quality-netease": "studio",
      "tiaolv-playback-quality-qq": "lossless",
      "tiaolv-playback-quality-reload-current": "true"
    })),
    { netease: "auto", qq: "lossless", reloadCurrent: true },
    "无效值应回退默认值，合法值和重载开关应恢复"
  );

  const storage = memoryStorage();
  quality.writePlaybackQualityPreferences(storage, {
    netease: "hires",
    qq: "high",
    reloadCurrent: true
  });
  assert.deepEqual(
    quality.readPlaybackQualityPreferences(storage),
    { netease: "hires", qq: "high", reloadCurrent: true },
    "全局音质配置应可持久化并重新读取"
  );

  assert.deepEqual(
    quality.NETEASE_QUALITY_OPTIONS.map((option) => option.value),
    ["auto", "hires", "lossless", "exhigh", "standard"]
  );
  assert.deepEqual(
    quality.QQ_QUALITY_OPTIONS.map((option) => option.value),
    ["auto", "lossless", "high", "standard"]
  );

  assert.equal(quality.localPlaybackFormat({ codec: "flac" }), "FLAC");
  assert.equal(quality.localPlaybackFormat({ filePath: "G:/Music/song.mp3" }), "MP3");
  assert.equal(quality.localPlaybackFormat({}), "本地音频");
  assert.equal(quality.playbackQualitySource({ source: "netease" }), "netease");
  assert.equal(quality.playbackQualitySource({ source: "qq", preferredLocalPlayback: true }), "local");
  assert.equal(quality.playbackQualitySource({ source: "cloud" }), "local");

  console.log("播放音质配置与本地格式逻辑通过");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
