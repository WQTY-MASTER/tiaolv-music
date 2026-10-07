const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/shared/desktopIntegration.ts"));

test("desktop integration preferences preserve the app's existing behavior", async () => {
  const { defaultDesktopIntegrationPreferences } = await import(moduleUrl);
  assert.deepEqual(defaultDesktopIntegrationPreferences(), {
    closeBehavior: "exit",
    rememberPlaybackPosition: true,
    systemMediaControls: true
  });
});

test("desktop integration preferences normalize persisted values", async () => {
  const { normalizeDesktopIntegrationPreferences } = await import(moduleUrl);
  assert.deepEqual(normalizeDesktopIntegrationPreferences({
    closeBehavior: "tray",
    rememberPlaybackPosition: false,
    systemMediaControls: false
  }), {
    closeBehavior: "tray",
    rememberPlaybackPosition: false,
    systemMediaControls: false
  });
  assert.deepEqual(normalizeDesktopIntegrationPreferences({ closeBehavior: "unknown" }), {
    closeBehavior: "exit",
    rememberPlaybackPosition: true,
    systemMediaControls: true
  });
});
