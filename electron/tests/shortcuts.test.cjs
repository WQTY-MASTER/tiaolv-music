const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");
const { registerHooks } = require("node:module");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "../shared/shortcuts" && context.parentURL?.endsWith("/shortcutManager.ts")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  }
});

async function modules() {
  const shared = await import(pathToFileURL(path.resolve(__dirname, "../src/shared/shortcuts.ts")));
  const { ShortcutManager } = await import(pathToFileURL(path.resolve(__dirname, "../src/main/shortcutManager.ts")));
  return { ...shared, ShortcutManager };
}

test("default bindings and keyboard normalization", async () => {
  const { defaultShortcutConfig, normalizeAccelerator, acceleratorFromInput, normalizeShortcutConfig } = await modules();
  const config = defaultShortcutConfig();
  assert.equal(Object.keys(config.bindings).length, 12);
  assert.equal(new Set(Object.values(config.bindings)).size, 12);
  assert.equal(normalizeAccelerator("alt+ctrl+arrowleft"), "Control+Alt+Left");
  assert.equal(normalizeAccelerator("Control+Ctrl+A"), null);
  assert.equal(normalizeAccelerator("Shift+A"), null);
  assert.equal(normalizeAccelerator("F12"), "F12");
  assert.equal(normalizeAccelerator("F25"), null);
  assert.equal(normalizeAccelerator("Alt+"), null);
  assert.equal(acceleratorFromInput({ key: " ", control: true, alt: true, shift: false, meta: false }), "Control+Alt+Space");
  assert.equal(acceleratorFromInput({ key: "!", code: "Digit1", control: true, alt: false, shift: true, meta: false }), "Control+Shift+1");
  assert.equal(normalizeShortcutConfig({ enabled: false, bindings: { toggle: "invalid" } }).bindings.toggle, config.bindings.toggle);
  assert.equal(normalizeShortcutConfig({ enabled: false }).enabled, false);
});

async function harness(stored) {
  const { ShortcutManager } = await modules();
  const callbacks = new Map();
  const blocked = new Set();
  const actions = [];
  let saved;
  let failSave = false;
  const manager = new ShortcutManager({
    register(key, callback) {
      if (blocked.has(key) || callbacks.has(key)) return false;
      callbacks.set(key, callback);
      return true;
    },
    unregister(key) { callbacks.delete(key); }
  }, stored, (action) => actions.push(action), (config) => {
    if (failSave) throw new Error("disk full");
    saved = JSON.parse(JSON.stringify(config));
  });
  return { manager, callbacks, blocked, actions, saved: () => saved, failSave: () => { failSave = true; } };
}

test("global dispatch, foreground deduplication, disable and local fallback", async () => {
  const { manager, callbacks, actions } = await harness();
  assert.equal(callbacks.size, 12);
  callbacks.get("Control+Alt+Space")();
  assert.deepEqual(actions, ["toggle"]);
  assert.equal(manager.handleLocal("Control+Alt+Space", false), true);
  assert.equal(actions.length, 1);
  manager.update({ enabled: false });
  assert.equal(callbacks.size, 0);
  manager.handleLocal("Control+Alt+Space", false);
  manager.handleLocal("Control+Alt+Space", true);
  assert.deepEqual(actions, ["toggle", "toggle"]);
  assert.equal(manager.handleLocal("Control+Alt+Q", false), false);
  manager.dispose();
});

test("recording suspends all actions and restores registrations on cancellation", async () => {
  const { manager, callbacks, actions } = await harness();
  manager.setRecording(true);
  assert.equal(callbacks.size, 0);
  assert.equal(manager.handleLocal("Control+Alt+Left", false), false);
  assert.deepEqual(actions, []);
  manager.setRecording(false);
  assert.equal(callbacks.size, 12);
  manager.dispose();
  assert.equal(callbacks.size, 0);
});

test("duplicate and system conflicts preserve existing bindings", async () => {
  const { manager, callbacks, blocked, saved } = await harness();
  assert.throws(() => manager.update({ bindings: { next: "alt+ctrl+left" } }), /重复/);
  assert.throws(() => manager.update({ bindings: { next: "Shift+A" } }), /Ctrl/);
  assert.equal(callbacks.size, 12);
  blocked.add("Control+Alt+Q");
  manager.setRecording(true);
  assert.throws(() => manager.update({ bindings: { next: "Control+Alt+Q" } }), /全局注册失败/);
  assert.equal(manager.snapshot().config.bindings.next, "Control+Alt+Right");
  assert.equal(manager.snapshot().recording, false);
  assert.equal(callbacks.size, 12);
  assert.equal(saved(), undefined);
});

test("custom settings persist, reload, reset and recover from write failures", async () => {
  const { defaultShortcutConfig } = await modules();
  const first = await harness();
  first.manager.update({ bindings: { next: "Control+Shift+N" }, enabled: false });
  const second = await harness(first.saved());
  assert.equal(second.manager.snapshot().config.bindings.next, "Control+Shift+N");
  assert.equal(second.callbacks.size, 0);
  second.manager.handleLocal("Control+Shift+N", false);
  assert.deepEqual(second.actions, ["next"]);
  second.manager.update(defaultShortcutConfig(), true);
  assert.equal(second.callbacks.size, 12);
  second.failSave();
  assert.throws(() => second.manager.update({ bindings: { next: "Control+Alt+N" } }), /disk full/);
  assert.equal(second.manager.snapshot().config.bindings.next, "Control+Alt+Right");
  assert.equal(second.callbacks.size, 12);
});

test("unavailable hotkeys are reported on enable and still work locally", async () => {
  const { manager, blocked, actions } = await harness({ enabled: false });
  blocked.add("Control+Alt+L");
  const next = manager.update({ enabled: true });
  assert.match(next.conflicts["unlock-lyrics"], /全局注册失败/);
  manager.handleLocal("Control+Alt+L", false);
  assert.deepEqual(actions, ["unlock-lyrics"]);
});
