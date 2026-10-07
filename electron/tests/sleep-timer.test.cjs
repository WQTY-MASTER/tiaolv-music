const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/sleepTimer.ts"));

test("sleep timer accepts only supported minute presets", async () => {
  const { normalizeSleepTimerMinutes } = await import(moduleUrl);
  assert.equal(normalizeSleepTimerMinutes(15), 15);
  assert.equal(normalizeSleepTimerMinutes(60), 60);
  assert.equal(normalizeSleepTimerMinutes(17), 0);
  assert.equal(normalizeSleepTimerMinutes(Number.NaN), 0);
});

test("sleep timer remaining seconds rounds up and never becomes negative", async () => {
  const { sleepTimerRemainingSeconds } = await import(moduleUrl);
  assert.equal(sleepTimerRemainingSeconds(61_001, 1_000), 61);
  assert.equal(sleepTimerRemainingSeconds(1_000, 1_000), 0);
  assert.equal(sleepTimerRemainingSeconds(500, 1_000), 0);
});
