const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/preferredLocalPlayback.ts");

function localTrack(overrides = {}) {
  return {
    id: "local:default",
    source: "local",
    title: "心月辞·何所往",
    artist: "鸣潮先约电台 / 苏诗丁",
    duration: 214,
    audioUrl: "/library/tracks/local-default/audio",
    codec: "flac",
    sampleRate: 48000,
    bitDepth: 24,
    ...overrides
  };
}

async function run() {
  const { selectPreferredLocalPlaybackTrack } = await import(pathToFileUrl(sourcePath));

  const onlineTrack = {
    id: "qq:003rJSwm3TechU",
    source: "qq",
    title: "心月辞 何所往",
    artist: "鸣潮先约电台、苏诗丁",
    duration: 213
  };

  assert.equal(
    selectPreferredLocalPlaybackTrack(onlineTrack, [localTrack()])?.id,
    "local:default",
    "常见标点差异不应阻止可靠的本地匹配"
  );

  assert.equal(
    selectPreferredLocalPlaybackTrack(onlineTrack, [localTrack({ id: "local:wrong-duration", duration: 220 })]),
    undefined,
    "时长相差超过三秒时不得切换到本地文件"
  );

  assert.equal(
    selectPreferredLocalPlaybackTrack({ ...onlineTrack, source: "local" }, [localTrack()]),
    undefined,
    "纯本地歌曲不应再次执行本地下载匹配"
  );

  const lossy = localTrack({
    id: "local:mp3",
    codec: "mp3",
    sampleRate: 96000,
    bitDepth: 32,
    duration: 213
  });
  const lossless = localTrack({
    id: "local:flac",
    codec: "FLAC",
    sampleRate: 44100,
    bitDepth: 16,
    duration: 215
  });
  assert.equal(
    selectPreferredLocalPlaybackTrack(onlineTrack, [lossy, lossless])?.id,
    "local:flac",
    "多个可靠候选中应优先选择无损格式"
  );

  const lowerQuality = localTrack({ id: "local:16bit", bitDepth: 16, sampleRate: 44100, duration: 213 });
  const higherQuality = localTrack({ id: "local:24bit", bitDepth: 24, sampleRate: 96000, duration: 215 });
  assert.equal(
    selectPreferredLocalPlaybackTrack(onlineTrack, [lowerQuality, higherQuality])?.id,
    "local:24bit",
    "格式相同时应优先更高位深和采样率"
  );

  console.log("本地下载品质优先匹配逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
