const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const moduleUrl = pathToFileURL(path.resolve(
  __dirname,
  "../src/renderer/src/services/qqListeningSession.ts"
));

const track = {
  id: "qq:mid-1",
  title: "测试歌曲",
  artist: "测试歌手",
  album: "测试专辑",
  duration: 180,
  source: "qq"
};

test("cloud report becomes eligible at 30 real seconds and is independent of local flush retries", async () => {
  const { createQqListeningSession, sampleQqListeningPlayback, beginQqRecentPlayReport,
    prepareQqListeningFlush, failQqListeningFlush } = await import(moduleUrl);
  let session = createQqListeningSession("100", track);
  const uuid = session.recentReportSessionId;
  assert.match(uuid, /^[a-f0-9-]{36}$/i);
  session = sampleQqListeningPlayback(session, 0, 0);
  for (let second = 1; second < 30; second++) session = sampleQqListeningPlayback(session, second, second * 1000);
  assert.equal(beginQqRecentPlayReport(session).payload, null);
  session = sampleQqListeningPlayback(session, 30, 30000);
  const started = beginQqRecentPlayReport(session);
  assert.equal(started.session.recentReportStatus, "reporting");
  assert.deepEqual(started.payload, { accountId: "100", trackId: track.id, sessionId: uuid, listenedSeconds: 30, totalSeconds: 180 });
  assert.equal(beginQqRecentPlayReport(started.session).payload, null);
  const retry = failQqListeningFlush(prepareQqListeningFlush(started.session).session);
  assert.equal(beginQqRecentPlayReport(retry).payload, null);
  assert.equal(beginQqRecentPlayReport({ ...retry, recentReportStatus: "failed" }).payload, null);
  assert.equal(beginQqRecentPlayReport({ ...retry, recentReportStatus: "reported" }).payload, null);
});

test("pauses, buffering and seek jumps cannot satisfy cloud playback eligibility", async () => {
  const { createQqListeningSession, sampleQqListeningPlayback, pauseQqListeningSession,
    beginQqRecentPlayReport } = await import(moduleUrl);
  let session = createQqListeningSession("100", track);
  session = sampleQqListeningPlayback(session, 0, 0);
  session = sampleQqListeningPlayback(session, 5, 5000);
  session = sampleQqListeningPlayback(session, 100, 6000);
  session = sampleQqListeningPlayback(session, 100, 11000);
  session = pauseQqListeningSession(session);
  session = sampleQqListeningPlayback(session, 101, 60000);
  session = sampleQqListeningPlayback(session, 105, 64000);
  assert.equal(session.totalListenedSeconds, 9);
  assert.equal(beginQqRecentPlayReport(session).payload, null);
  assert.notEqual(createQqListeningSession("200", track).recentReportSessionId, session.recentReportSessionId);
});

test("continuous QQ playback emits bounded deltas and one play count", async () => {
  const {
    acknowledgeQqListeningFlush,
    createQqListeningSession,
    prepareQqListeningFlush,
    sampleQqListeningPlayback
  } = await import(moduleUrl);

  let session = createQqListeningSession("100", track, "账号一", "avatar-1");
  session = sampleQqListeningPlayback(session, 0, 0);
  for (let second = 1; second <= 15; second += 1) {
    session = sampleQqListeningPlayback(session, second, second * 1_000);
  }

  const first = prepareQqListeningFlush(session);
  assert.ok(first.payload);
  assert.equal(first.payload.accountId, "100");
  assert.equal(first.payload.accountNickname, "账号一");
  assert.equal(first.payload.accountAvatarUrl, "avatar-1");
  assert.equal(first.payload.listenedSeconds, 15);
  assert.equal(first.payload.playCount, 0);
  session = acknowledgeQqListeningFlush(first.session);

  for (let second = 16; second <= 30; second += 1) {
    session = sampleQqListeningPlayback(session, second, second * 1_000);
  }
  const second = prepareQqListeningFlush(session);
  assert.ok(second.payload);
  assert.equal(second.payload.listenedSeconds, 15);
  assert.equal(second.payload.playCount, 1);
  session = acknowledgeQqListeningFlush(second.session);

  session = sampleQqListeningPlayback(session, 31, 31_000);
  const forced = prepareQqListeningFlush(session, true);
  assert.ok(forced.payload);
  assert.equal(forced.payload.playCount, 0);
});

test("seeks and paused wall time do not count", async () => {
  const {
    createQqListeningSession,
    pauseQqListeningSession,
    sampleQqListeningPlayback
  } = await import(moduleUrl);

  let session = createQqListeningSession("100", track);
  session = sampleQqListeningPlayback(session, 10, 0);
  session = sampleQqListeningPlayback(session, 11, 1_000);
  session = sampleQqListeningPlayback(session, 80, 2_000);
  session = pauseQqListeningSession(session);
  session = sampleQqListeningPlayback(session, 81, 60_000);
  session = sampleQqListeningPlayback(session, 82, 61_000);

  assert.equal(session.totalListenedSeconds, 2);
  assert.equal(session.pendingSeconds, 2);
});

test("failed flush keeps the exact payload for retry", async () => {
  const {
    createQqListeningSession,
    failQqListeningFlush,
    prepareQqListeningFlush,
    sampleQqListeningPlayback
  } = await import(moduleUrl);

  let session = createQqListeningSession("100", track);
  session = sampleQqListeningPlayback(session, 0, 0);
  for (let second = 1; second <= 30; second += 1) {
    session = sampleQqListeningPlayback(session, second, second * 1_000);
  }
  const first = prepareQqListeningFlush(session);
  assert.ok(first.payload);
  assert.equal(prepareQqListeningFlush(first.session).payload, null);

  session = failQqListeningFlush(first.session);
  const retry = prepareQqListeningFlush(session);
  assert.deepEqual(retry.payload, first.payload);
});
