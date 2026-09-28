const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/playbackFade.ts");

async function run() {
  const {
    DEFAULT_FADE_DURATION_MS,
    MAX_FADE_DURATION_MS,
    MIN_FADE_DURATION_MS,
    boundFadeDurationMs,
    interpolateFadeVolume,
    normalizeFadeDurationMs
  } = await import(pathToFileUrl(sourcePath));

  assert.equal(DEFAULT_FADE_DURATION_MS, 500, "默认过渡时长应为 500ms");
  assert.equal(normalizeFadeDurationMs(Number.NaN), 500, "无效持久化值应回退默认时长");
  assert.equal(normalizeFadeDurationMs(1), MIN_FADE_DURATION_MS, "设置时长不得低于 10ms");
  assert.equal(normalizeFadeDurationMs(5000), MAX_FADE_DURATION_MS, "设置时长不得超过 2000ms");
  assert.equal(normalizeFadeDurationMs(499.6), 500, "设置时长应保存为整数毫秒");

  assert.equal(boundFadeDurationMs(800, 0.25), 250, "淡出不得超过歌曲剩余时长");
  assert.equal(boundFadeDurationMs(800, 0), 0, "歌曲已经结束时不应继续淡出");
  assert.equal(boundFadeDurationMs(800, Number.NaN), 800, "媒体时长未知时应使用设置时长");
  assert.equal(boundFadeDurationMs(8, 4), 10, "运行时长也应遵守设置下限");

  assert.equal(interpolateFadeVolume(0.8, 0, 0), 0.8, "渐变起点应保持原音量");
  assert.equal(interpolateFadeVolume(0.8, 0, 0.5), 0.4, "渐变中点应连续变化");
  assert.equal(interpolateFadeVolume(0.8, 0, 1), 0, "渐变终点应准确到达目标音量");
  assert.equal(interpolateFadeVolume(0, 1.2, 1), 1, "目标音量必须限制在媒体允许范围");

  console.log("播放渐进渐出逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
