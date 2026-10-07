const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/appearanceSettings.ts"));

test("lyrics default to the 22px song information size and migrate the old default once", async () => {
  const { APPEARANCE_STORAGE_KEY, readAppearancePreferences, writeAppearancePreferences } = await import(moduleUrl);
  assert.equal(readAppearancePreferences(memoryStorage()).lyrics.fontSize, 22);
  const storage = memoryStorage({ [APPEARANCE_STORAGE_KEY]: JSON.stringify({ lyrics: { fontSize: 18 } }) });
  const preferences = readAppearancePreferences(storage);
  assert.equal(preferences.lyrics.fontSize, 22);
  preferences.lyrics.fontSize = 18;
  writeAppearancePreferences(storage, preferences);
  assert.equal(readAppearancePreferences(storage).lyrics.fontSize, 18);
  const custom = memoryStorage({ [APPEARANCE_STORAGE_KEY]: JSON.stringify({ lyrics: { fontSize: 26 } }) });
  assert.equal(readAppearancePreferences(custom).lyrics.fontSize, 26);
});

test("background image data survives normalization and persistence without truncation", async () => {
  const { readAppearancePreferences, writeAppearancePreferences } = await import(moduleUrl);
  const storage = memoryStorage();
  const preferences = readAppearancePreferences(storage);
  const image = `data:image/png;base64,${"A".repeat(4096)}`;
  preferences.background.unified.imagePath = image;
  writeAppearancePreferences(storage, preferences);
  assert.equal(readAppearancePreferences(storage).background.unified.imagePath, image);
});

test("lyrics use regular song-info weight and migrate the old semibold default once", async () => {
  const { APPEARANCE_STORAGE_KEY, readAppearancePreferences, writeAppearancePreferences } = await import(moduleUrl);
  assert.equal(readAppearancePreferences(memoryStorage()).lyrics.fontWeight, 400);
  const storage = memoryStorage({ [APPEARANCE_STORAGE_KEY]: JSON.stringify({ lyrics: { fontWeight: 600 } }) });
  const preferences = readAppearancePreferences(storage);
  assert.equal(preferences.lyrics.fontWeight, 400);
  preferences.lyrics.fontWeight = 600;
  writeAppearancePreferences(storage, preferences);
  assert.equal(readAppearancePreferences(storage).lyrics.fontWeight, 600);
  assert.equal(readAppearancePreferences(memoryStorage({ [APPEARANCE_STORAGE_KEY]: JSON.stringify({ lyrics: { fontWeight: 500 } }) })).lyrics.fontWeight, 500);
});

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    dump: () => Object.fromEntries(values)
  };
}

test("three lyric colors persist independently and legacy highlight becomes sweep", async () => {
  const { normalizeAppearancePreferences, writeAppearancePreferences, readAppearancePreferences } = await import(moduleUrl);
  const legacy = normalizeAppearancePreferences({ lyrics: { activeColor: "#123456", inactiveColor: "#654321", colorMode: "custom" } });
  assert.equal(legacy.lyrics.sweepColor, "#123456");
  const storage = memoryStorage();
  legacy.lyrics.sweepColor = "#fff8df";
  writeAppearancePreferences(storage, legacy);
  const restored = readAppearancePreferences(storage);
  assert.equal(restored.lyrics.activeColor, "#123456");
  assert.equal(restored.lyrics.inactiveColor, "#654321");
  assert.equal(restored.lyrics.sweepColor, "#fff8df");
  assert.equal(normalizeAppearancePreferences({ lyrics: { sweepColor: "invalid" } }).lyrics.sweepColor, "#2f9fc8");
});

test("appearance preferences normalize malformed values", async () => {
  const { normalizeAppearancePreferences } = await import(moduleUrl);
  const preferences = normalizeAppearancePreferences({
    themeMode: "unknown",
    lightAccent: "red",
    density: "tiny",
    lyrics: { fontSize: 200, lineHeight: 0, inactiveOpacity: -2, focusRows: 7 }
  });

  assert.equal(preferences.themeMode, "system");
  assert.equal(preferences.lightAccent, "#16b88a");
  assert.equal(preferences.density, "standard");
  assert.equal(preferences.lyrics.fontSize, 32);
  assert.equal(preferences.lyrics.lineHeight, 1.1);
  assert.equal(preferences.lyrics.inactiveOpacity, 0.15);
  assert.equal(preferences.lyrics.focusRows, 0);
});

test("appearance preferences persist and page backgrounds inherit", async () => {
  const {
    APPEARANCE_STORAGE_KEY,
    readAppearancePreferences,
    resolvePageBackground,
    writeAppearancePreferences
  } = await import(moduleUrl);
  const storage = memoryStorage();
  const preferences = readAppearancePreferences(storage);
  preferences.themeMode = "dark";
  preferences.background.unified.darkColor = "#101820";
  preferences.background.pages.local.inherit = false;
  preferences.background.pages.local.lightColor = "#ffffff";
  writeAppearancePreferences(storage, preferences);

  const restored = readAppearancePreferences(storage);
  assert.ok(storage.dump()[APPEARANCE_STORAGE_KEY]);
  assert.equal(restored.themeMode, "dark");
  assert.equal(resolvePageBackground(restored, "settings").darkColor, "#101820");
  assert.equal(resolvePageBackground(restored, "local").lightColor, "#ffffff");
});

test("system theme and animation modes resolve explicitly", async () => {
  const { resolveDarkTheme, resolveReducedMotion } = await import(moduleUrl);
  assert.equal(resolveDarkTheme("system", true), true);
  assert.equal(resolveDarkTheme("light", true), false);
  assert.equal(resolveReducedMotion("system", true), true);
  assert.equal(resolveReducedMotion("full", true), false);
  assert.equal(resolveReducedMotion("reduced", false), true);
});

test("mini player appearance preferences persist and normalize every editor group", async () => {
  const {
    createDefaultAppearancePreferences,
    normalizeAppearancePreferences,
    readAppearancePreferences,
    writeAppearancePreferences
  } = await import(moduleUrl);
  const storage = memoryStorage();
  const preferences = createDefaultAppearancePreferences();

  preferences.miniPlayer.theme = "twilight-glass";
  preferences.miniPlayer.background.mode = "gradient";
  preferences.miniPlayer.background.blur = 28;
  preferences.miniPlayer.appearance.accentMode = "custom";
  preferences.miniPlayer.appearance.accentColor = "#5966d9";
  preferences.miniPlayer.layout.mode = "wide";
  preferences.miniPlayer.layout.showVolume = true;
  writeAppearancePreferences(storage, preferences);

  const restored = readAppearancePreferences(storage).miniPlayer;
  assert.equal(restored.theme, "twilight-glass");
  assert.equal(restored.background.mode, "gradient");
  assert.equal(restored.background.blur, 28);
  assert.equal(restored.appearance.accentMode, "custom");
  assert.equal(restored.appearance.accentColor, "#5966d9");
  assert.equal(restored.layout.mode, "wide");
  assert.equal(restored.layout.showVolume, true);

  const malformed = normalizeAppearancePreferences({
    miniPlayer: {
      theme: "unknown",
      background: { mode: "video", blur: 999, brightness: -1 },
      appearance: { cornerRadius: 100, borderWidth: -2 },
      layout: { mode: "giant", showCover: "yes" }
    }
  }).miniPlayer;
  assert.equal(malformed.theme, "moon-white");
  assert.equal(malformed.background.mode, "gradient");
  assert.equal(malformed.background.blur, 48);
  assert.equal(malformed.background.brightness, 50);
  assert.equal(malformed.appearance.cornerRadius, 32);
  assert.equal(malformed.appearance.borderWidth, 0);
  assert.equal(malformed.layout.mode, "auto");
  assert.equal(malformed.layout.showCover, true);
});

test("player control preferences persist and normalize onboarding choices", async () => {
  const {
    createDefaultAppearancePreferences,
    normalizeAppearancePreferences,
    readAppearancePreferences,
    writeAppearancePreferences
  } = await import(moduleUrl);
  const storage = memoryStorage();
  const preferences = createDefaultAppearancePreferences();

  assert.deepEqual(preferences.playerControls, {
    presentation: "full",
    visibility: "always",
    miniShowInTaskbar: true,
    miniAlwaysOnTop: true,
    openMiniAfterGuide: false
  });

  preferences.playerControls.presentation = "capsule";
  preferences.playerControls.visibility = "hover";
  preferences.playerControls.miniShowInTaskbar = false;
  preferences.playerControls.miniAlwaysOnTop = true;
  preferences.playerControls.openMiniAfterGuide = true;
  writeAppearancePreferences(storage, preferences);

  assert.deepEqual(readAppearancePreferences(storage).playerControls, preferences.playerControls);
  assert.deepEqual(normalizeAppearancePreferences({
    playerControls: {
      presentation: "giant",
      visibility: "sometimes",
      miniShowInTaskbar: "yes",
      miniAlwaysOnTop: 1,
      openMiniAfterGuide: null
    }
  }).playerControls, createDefaultAppearancePreferences().playerControls);
});
