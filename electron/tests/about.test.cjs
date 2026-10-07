const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/shared/about.ts"));

test("release version comparison handles prefixes and prereleases", async () => {
  const { compareReleaseVersions, normalizeReleaseVersion } = await import(moduleUrl);
  assert.equal(normalizeReleaseVersion(" v1.2.3 "), "1.2.3");
  assert.equal(compareReleaseVersions("v1.2.3", "1.2.3"), 0);
  assert.equal(compareReleaseVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareReleaseVersions("2.0.0", "10.0.0"), -1);
  assert.equal(compareReleaseVersions("1.0.0", "1.0.0-beta.2"), 1);
  assert.equal(compareReleaseVersions("1.0.0-beta.10", "1.0.0-beta.2"), 1);
  assert.equal(compareReleaseVersions("invalid", "1.0.0"), null);
});

test("diagnostic report includes runtime and backend availability", async () => {
  const { formatDiagnosticReport } = await import(moduleUrl);
  const report = formatDiagnosticReport({
    appVersion: "0.1.0",
    electronVersion: "35.7.5",
    chromeVersion: "134.0.0",
    nodeVersion: "22.0.0",
    osName: "Windows 11",
    osVersion: "10.0.26100",
    osArch: "x64"
  }, {
    ok: true,
    backendVersion: "0.1.0",
    springBootVersion: "3.5.4",
    database: { product: "SQLite", version: "3.50.3" }
  });
  assert.match(report, /调律音乐 v0\.1\.0/);
  assert.match(report, /Windows 11 10\.0\.26100 \(x64\)/);
  assert.match(report, /Electron 35\.7\.5/);
  assert.match(report, /后端 API 0\.1\.0/);
  assert.match(report, /SQLite 3\.50\.3/);

  const offline = formatDiagnosticReport({
    appVersion: "0.1.0", electronVersion: "35", chromeVersion: "134", nodeVersion: "22",
    osName: "Windows", osVersion: "10", osArch: "x64"
  }, null);
  assert.match(offline, /后端 API 未连接/);
  assert.match(offline, /数据库 未连接/);
});
