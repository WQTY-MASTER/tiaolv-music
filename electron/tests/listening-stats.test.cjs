const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/listeningStats.ts");

async function run() {
  const {
    addListeningSeconds,
    createEmptyListeningStats,
    getCalendarIntensity,
    getMonthListeningSummary,
    getTrackListeningMinutes,
    mergeListeningStats,
    recordListeningPlay
  } = await import(pathToFileUrl(sourcePath));

  let stats = createEmptyListeningStats();
  assert.equal(stats.revision, 0, "新统计应从修订号 0 开始");
  stats = recordListeningPlay(stats, "local:a", new Date("2026-09-16T08:00:00+08:00"));
  stats = recordListeningPlay(stats, "local:a", new Date("2026-09-16T09:00:00+08:00"));
  stats = addListeningSeconds(stats, "local:a", 75, new Date("2026-09-16T09:01:00+08:00"));
  stats = addListeningSeconds(stats, "local:b", 30, new Date("2026-09-17T09:01:00+08:00"));

  assert.equal(stats.tracks["local:a"].playCount, 2, "歌曲播放次数应累计");
  assert.equal(stats.tracks["local:a"].listenedSeconds, 75, "歌曲聆听秒数应累计");
  assert.equal(stats.tracks["local:a"].lastListenedDate, "2026-09-16", "歌曲应保存本地聆听日期");
  assert.equal(stats.days["2026-09-16"].listenedSeconds, 75, "听歌日历应按当天累计时长");
  assert.equal(getTrackListeningMinutes(stats, "local:a"), 2, "展示分钟数应向上取整，避免有聆听却显示 0 分钟");

  const summary = getMonthListeningSummary(stats, 2026, 8);
  assert.equal(summary.activeDays, 2, "月份汇总应统计当月有听歌的天数");
  assert.equal(summary.totalMinutes, 2, "月份汇总应累计当月总分钟数");
  assert.equal(getCalendarIntensity(20, 120), 1, "较少听歌日期应使用浅色强度");
  assert.equal(getCalendarIntensity(120, 120), 5, "最高听歌日期应使用最深色强度");

  const merged = mergeListeningStats(stats, {
    revision: 0,
    tracks: {
      "local:a": {
        trackId: "local:a",
        playCount: 1,
        listenedSeconds: 120,
        lastListenedAt: "2026-09-18T09:00:00.000Z",
        lastListenedDate: "2026-09-18"
      }
    },
    days: {
      "2026-09-16": { date: "2026-09-16", listenedSeconds: 90 }
    }
  });
  assert.equal(merged.tracks["local:a"].playCount, 2, "合并持久化副本时不得倒退播放次数");
  assert.equal(merged.tracks["local:a"].listenedSeconds, 120, "合并时应保留更完整的聆听时长");
  assert.equal(merged.days["2026-09-16"].listenedSeconds, 90, "听歌日历应保留更完整的日期统计");

  const afterDeletion = mergeListeningStats(merged, {
    revision: 1,
    tracks: {},
    days: {}
  });
  assert.equal(afterDeletion.revision, 1, "更高服务端修订号应成为当前修订号");
  assert.deepEqual(afterDeletion.tracks, {}, "更高修订号应覆盖旧歌曲统计，防止删除记录复活");
  assert.deepEqual(afterDeletion.days, {}, "更高修订号应覆盖旧日历统计");

  console.log("本地聆听统计逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
