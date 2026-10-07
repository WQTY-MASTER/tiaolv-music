const assert = require("node:assert/strict");
const path = require("node:path");

const sourcePath = path.resolve(__dirname, "../src/renderer/src/services/listeningStatsRetention.ts");

async function run() {
  const {
    createListeningStatsRange,
    describeListeningStatsRange,
    formatListeningDuration
  } = await import(pathToFileUrl(sourcePath));

  assert.deepEqual(
    createListeningStatsRange("month", 2024, 2),
    { from: "2024-02-01", to: "2024-02-29" },
    "按月删除应正确处理闰月"
  );
  assert.deepEqual(
    createListeningStatsRange("year", 2023, 7),
    { from: "2023-01-01", to: "2023-12-31" },
    "按年删除应覆盖完整自然年"
  );
  assert.equal(createListeningStatsRange("all", 2023, 7), null, "删除全部不应携带日期范围");
  assert.equal(describeListeningStatsRange("month", 2026, 7), "2026 年 7 月", "月份描述应便于二次确认");
  assert.equal(describeListeningStatsRange("year", 2026, 7), "2026 年", "年份描述应便于二次确认");
  assert.equal(describeListeningStatsRange("all", 2026, 7), "全部", "全部范围应明确标注");
  assert.equal(formatListeningDuration(0), "0 分钟", "空记录应显示零分钟");
  assert.equal(formatListeningDuration(3660), "1 小时 1 分钟", "长时聆听应以小时和分钟展示");

  console.log("聆听足迹保留范围逻辑通过");
}

function pathToFileUrl(filePath) {
  return new URL(`file:///${filePath.replaceAll("\\", "/")}`).href;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
