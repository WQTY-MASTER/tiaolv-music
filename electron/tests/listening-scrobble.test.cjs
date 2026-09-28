const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/listeningScrobble.ts");

async function run() {
  const {
    beginScrobbleReport,
    createScrobbleSession,
    resetScrobbleSample,
    sampleScrobblePlayback
  } = await import(pathToFileUrl(sourcePath));

  let session = createScrobbleSession(1, "netease:123");
  session = sampleScrobblePlayback(session, 0);
  for (let second = 1; second < 30; second += 1) {
    session = sampleScrobblePlayback(session, second);
  }
  assert.equal(beginScrobbleReport(session).shouldReport, false, "不足 30 秒时不应打卡");

  session = sampleScrobblePlayback(session, 30);
  const ready = beginScrobbleReport(session);
  assert.equal(ready.shouldReport, true, "累计 30 秒时应触发打卡");
  assert.equal(ready.session.status, "reporting", "触发后应先锁定为正在上报");
  assert.equal(beginScrobbleReport(ready.session).shouldReport, false, "同一会话不应重复打卡");

  let resumed = createScrobbleSession(2, "netease:456");
  resumed = sampleScrobblePlayback(resumed, 10);
  resumed = sampleScrobblePlayback(resumed, 15);
  resumed = resetScrobbleSample(resumed);
  resumed = sampleScrobblePlayback(resumed, 80);
  resumed = sampleScrobblePlayback(resumed, 84);
  assert.equal(resumed.listenedSeconds, 9, "暂停恢复后的首个采样不应把暂停或拖动跨度计入时长");
  resumed = sampleScrobblePlayback(resumed, 100);
  assert.equal(resumed.listenedSeconds, 9, "超过 6 秒的进度跳变不应计入时长");

  const replay = createScrobbleSession(3, "netease:123");
  assert.equal(replay.listenedSeconds, 0, "新播放会话应重新累计时长");
  assert.equal(replay.status, "tracking", "新播放会话应允许再次打卡");

  console.log("网易云听歌打卡计时逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
