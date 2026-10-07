const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/onboarding.ts"));

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    dump: () => Object.fromEntries(values)
  };
}

test("onboarding is shown until the current version is completed", async () => {
  const { ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION, hasCompletedOnboarding, markOnboardingCompleted } = await import(moduleUrl);
  const storage = memoryStorage();

  assert.equal(hasCompletedOnboarding(storage), false);
  markOnboardingCompleted(storage);
  assert.equal(storage.dump()[ONBOARDING_STORAGE_KEY], String(ONBOARDING_VERSION));
  assert.equal(hasCompletedOnboarding(storage), true);
});

test("any previous completion suppresses future automatic onboarding", async () => {
  const { ONBOARDING_STORAGE_KEY, hasCompletedOnboarding } = await import(moduleUrl);
  const storage = memoryStorage({ [ONBOARDING_STORAGE_KEY]: "0" });
  assert.equal(hasCompletedOnboarding(storage), true);
});
