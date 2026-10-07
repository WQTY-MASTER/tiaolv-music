const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadModule() {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/renderer/src/services/startupHome.ts"), "utf8")
    .replace(/import type[^;]+;/, "")
    .replace(/export type StartupHome = [^;]+;/, "")
    .replace(/type (?:Read|Write)Storage[^;]+;/g, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ")
    .replace(/: StartupHome/g, "")
    .replace(/: AppMode/g, "")
    .replace(/storage: ReadStorage/, "storage")
    .replace(/storage: WriteStorage/, "storage")
    .replace(/preference: StartupHome/g, "preference")
    .replace(/lastMode: AppMode/g, "lastMode");
  const context = { result: null };
  vm.runInNewContext(`${source}\nresult = { readStartupHome, writeStartupHome, resolveStartupMode, STARTUP_HOME_STORAGE_KEY };`, context);
  return context.result;
}

test("startup home defaults to streaming and accepts all three choices", () => {
  const { readStartupHome } = loadModule();
  assert.equal(readStartupHome({ getItem: () => null }), "streaming");
  assert.equal(readStartupHome({ getItem: () => "local" }), "local");
  assert.equal(readStartupHome({ getItem: () => "last-used" }), "last-used");
});

test("last-used resolves to the persisted app mode", () => {
  const { resolveStartupMode } = loadModule();
  assert.equal(resolveStartupMode("local", "streaming"), "local");
  assert.equal(resolveStartupMode("streaming", "local"), "streaming");
  assert.equal(resolveStartupMode("last-used", "streaming"), "streaming");
});

test("startup home persists its selection", () => {
  const { writeStartupHome, STARTUP_HOME_STORAGE_KEY } = loadModule();
  const values = new Map();
  writeStartupHome("last-used", { setItem: (key, value) => values.set(key, value) });
  assert.equal(values.get(STARTUP_HOME_STORAGE_KEY), "last-used");
});
