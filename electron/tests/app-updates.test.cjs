const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const ts = require("typescript");
const { test } = require("node:test");

const serviceFile = path.resolve(__dirname, "../src/main/appUpdates.ts");
const releaseUrl = "https://github.com/WQTY-MASTER/tiaolv-music/releases/latest";
const info = {
  version: "0.2.0", releaseName: "Version 0.2.0", releaseNotes: "Update notes", releaseDate: "2026-10-11T00:00:00Z",
  files: [{ url: "tiaolv-Setup-0.2.0.exe", sha512: Buffer.alloc(64, 1).toString("base64") }]
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class Engine extends EventEmitter {
  checks = 0;
  downloads = 0;
  installs = 0;
  info = info;
  setFeedURL(value) { this.feed = value; (this.feeds ??= []).push(value); }
  async checkForUpdates() {
    this.checks++;
    this.emit("checking-for-update");
    if (this.checkGate) await this.checkGate.promise;
    if (this.checkError) throw this.checkError;
    this.emit(this.available === false ? "update-not-available" : "update-available", this.info);
    return { updateInfo: this.info };
  }
  async downloadUpdate() {
    this.downloads++;
    if (this.downloadGate) await this.downloadGate.promise;
    if (this.downloadError) {
      this.emit("error", this.downloadError);
      throw this.downloadError;
    }
    this.emit("update-downloaded", this.info);
    return ["private-cache/installer.exe"];
  }
  quitAndInstall(silent, restart) { this.installs++; this.installArguments = [silent, restart]; }
}

async function fixture(overrides = {}) {
  assert.ok(fs.existsSync(serviceFile), "missing main-process GitHub updater service");
  function load(file) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", code)(
      name => name === "../shared/about" ? load(path.resolve(__dirname, "../src/shared/about.ts")) : require(name), module, module.exports
    );
    return module.exports;
  }
  const { createAppUpdateService } = load(serviceFile);
  const updater = new Engine();
  const changes = [];
  let prepared = 0;
  const service = createAppUpdateService({
    updater, currentVersion: "0.1.1", isPackaged: true, platform: "win32",
    onChange: value => changes.push(value),
    prepareInstall: async () => { prepared++; }, ...overrides
  });
  return { service, updater, changes, prepared: () => prepared };
}

test("GitHub updates require explicit download and explicit installation", async () => {
  const { service, updater } = await fixture();
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.allowDowngrade, false);
  assert.deepEqual(updater.feed, { provider: "github", owner: "WQTY-MASTER", repo: "tiaolv-music", private: false });
  const result = await service.check();
  assert.equal(result.status, "available");
  assert.equal(result.latestVersion, "0.2.0");
  assert.equal(result.releaseNotes, "Update notes");
  assert.equal(updater.downloads, 0);
  assert.equal(updater.installs, 0);
});

test("HTTPS distribution server is checked before GitHub without downloading", async () => {
  const { service, updater } = await fixture();
  assert.equal((await service.check()).status, "available");
  assert.deepEqual(updater.feed, { provider: "generic", url: "https://wqty.online/updates/windows/" });
  assert.equal(updater.checks, 1);
  assert.equal(updater.downloads, 0);
});

test("unavailable distribution server falls back to GitHub once", async () => {
  const { service, updater, changes } = await fixture();
  const check = updater.checkForUpdates.bind(updater);
  updater.checkForUpdates = async () => {
    if (updater.feed.provider === "generic") {
      updater.checks++;
      const error = new Error("server unavailable");
      updater.emit("error", error);
      throw error;
    }
    return check();
  };
  assert.equal((await service.check()).status, "available");
  assert.equal(updater.checks, 2);
  assert.equal(updater.feed.provider, "github");
  assert.ok(!changes.some(change => change.status === "error"));
  assert.equal(updater.downloads, 0);
});

test("invalid server metadata falls back and two failed checks cannot permit download", async () => {
  const { service, updater } = await fixture();
  const check = updater.checkForUpdates.bind(updater);
  updater.checkForUpdates = () => {
    updater.info = updater.feed.provider === "generic" ? { ...info, files: [] } : info;
    return check();
  };
  assert.equal((await service.check()).status, "available");
  assert.equal(updater.feed.provider, "github");
  const failed = await fixture();
  failed.updater.checkForUpdates = async () => {
    if (failed.updater.feed.provider === "github") throw new Error("GitHub unavailable");
    failed.updater.emit("update-available", { ...info, releaseNotes: {} });
    return { updateInfo: info };
  };
  assert.equal((await failed.service.check()).status, "error");
  await failed.service.download();
  assert.equal(failed.updater.downloads, 0);
});

test("checks/downloads are deduplicated and cannot discard a ready installer", async () => {
  const { service, updater } = await fixture();
  updater.checkGate = deferred();
  const checks = [service.check(), service.check()];
  assert.equal(updater.checks, 1);
  updater.checkGate.resolve();
  await Promise.all(checks);
  updater.downloadGate = deferred();
  const downloads = [service.download(), service.download()];
  assert.equal(updater.downloads, 1);
  await service.check();
  assert.equal(updater.checks, 1);
  updater.downloadGate.resolve();
  await Promise.all(downloads);
  assert.equal(service.getSnapshot().status, "downloaded");
  await service.check();
  assert.equal(updater.checks, 1);
});

test("native progress reaches settings without exposing installer paths", async () => {
  const { service, updater, changes } = await fixture();
  await service.check();
  updater.downloadGate = deferred();
  const download = service.download();
  updater.emit("download-progress", { percent: 47.5, transferred: 475, total: 1000, bytesPerSecond: 25 });
  assert.equal(service.getSnapshot().status, "downloading");
  assert.deepEqual(service.getSnapshot().progress, { percent: 47.5, transferred: 475, total: 1000, bytesPerSecond: 25 });
  assert.equal(changes.at(-1).progress.percent, 47.5);
  updater.downloadGate.resolve();
  await download;
  assert.equal(service.getSnapshot().status, "downloaded");
  assert.ok(!JSON.stringify(service.getSnapshot()).includes("private-cache"));
});

test("failed GitHub requests retain a fixed manual-download fallback", async () => {
  const { service, updater } = await fixture();
  updater.checkError = new Error("net::ERR_TIMED_OUT");
  const result = await service.check();
  assert.equal(result.status, "error");
  assert.equal(result.releaseUrl, releaseUrl);
  assert.match(result.message, /GitHub/);
  updater.checkError = undefined;
  await service.check();
  updater.downloadError = new Error("net::ERR_CONNECTION_RESET");
  assert.equal((await service.download()).status, "error");
  assert.equal(updater.installs, 0);
  assert.equal(service.getSnapshot().releaseUrl, "https://github.com/WQTY-MASTER/tiaolv-music/releases/tag/v0.2.0");
});

test("checksum failure never permits install and a fresh successful retry is required", async () => {
  const { service, updater } = await fixture();
  assert.equal(await service.install(), false);
  await service.download();
  assert.equal(updater.downloads, 0);
  await service.check();
  updater.downloadError = Object.assign(new Error("sha512 checksum mismatch"), { code: "ERR_CHECKSUM_MISMATCH" });
  const failed = await service.download();
  assert.equal(failed.status, "error");
  assert.match(failed.message, /校验/);
  assert.equal(await service.install(), false);
  assert.equal(updater.installs, 0);
  updater.downloadError = undefined;
  await service.download();
  assert.equal(service.getSnapshot().status, "downloaded");
});

test("install waits for owned-service cleanup and refuses duplicate installs", async () => {
  const cleanup = deferred();
  let prepares = 0;
  const { service, updater } = await fixture({ prepareInstall: async () => { prepares++; await cleanup.promise; } });
  await service.check();
  await service.download();
  const installing = service.install();
  assert.equal(prepares, 1);
  assert.equal(updater.installs, 0);
  assert.equal(await service.install(), false);
  cleanup.resolve();
  assert.equal(await installing, true);
  assert.equal(updater.installs, 1);
  assert.deepEqual(updater.installArguments, [false, true]);
});

test("failed cleanup keeps the app open and never launches an installer", async () => {
  const { service, updater } = await fixture({ prepareInstall: async () => { throw new Error("service still running"); } });
  await service.check();
  await service.download();
  assert.equal(await service.install(), false);
  assert.equal(updater.installs, 0);
  assert.equal(service.getSnapshot().status, "error");
  assert.match(service.getSnapshot().message, /本地服务/);
});

test("installer error events unlock retry and report installation failure", async () => {
  const { service, updater } = await fixture();
  await service.check();
  await service.download();
  updater.quitAndInstall = () => { updater.installs++; updater.emit("error", new Error("installer path missing")); };
  assert.equal(await service.install(), false);
  assert.equal(service.getSnapshot().status, "error");
  assert.match(service.getSnapshot().message, /安装失败/);
  assert.equal(await service.install(), false);
  await service.check();
  assert.equal(updater.checks, 2);
  await service.download();
  assert.equal(service.getSnapshot().status, "downloaded");
});

test("development and unsupported platforms never download or install", async () => {
  for (const options of [{ isPackaged: false }, { platform: "linux" }]) {
    const { service, updater } = await fixture(options);
    assert.equal((await service.check()).status, "error");
    await service.download();
    assert.equal(await service.install(), false);
    assert.equal(updater.checks, 0);
    assert.equal(updater.downloads, 0);
    assert.equal(updater.installs, 0);
  }
});

test("invalid or older release versions cannot become installable updates", async () => {
  for (const version of ["invalid", "0.1.0", "0.1.1"]) {
    const { service, updater } = await fixture();
    updater.info = { ...info, version };
    const result = await service.check();
    assert.notEqual(result.status, "available");
    await service.download();
    assert.equal(updater.downloads, 0);
  }
});

test("download completion uses the same normalized version as the release check", async () => {
  const { service, updater } = await fixture();
  updater.info = { ...info, version: "v0.2.0" };
  assert.equal((await service.check()).latestVersion, "0.2.0");
  assert.equal((await service.download()).status, "downloaded");
});

test("missing or invalid SHA512 metadata blocks automatic download", async () => {
  for (const files of [undefined, [], [{ url: "update.exe", sha2: "legacy-sha256" }], [{ url: "update.exe", sha512: "invalid" }], [{ url: "update.zip", sha512: info.files[0].sha512 }]]) {
    const { service, updater } = await fixture();
    updater.info = { ...info, files };
    assert.equal((await service.check()).status, "error");
    assert.match(service.getSnapshot().message, /校验/);
    await service.download();
    assert.equal(updater.downloads, 0);
    assert.equal(await service.install(), false);
    assert.equal(service.getSnapshot().releaseUrl, releaseUrl);
  }
});

test("only the trusted main frame can invoke update commands", () => {
  const mainFile = path.resolve(__dirname, "../src/main/main.ts");
  const source = ts.createSourceFile(mainFile, fs.readFileSync(mainFile, "utf8"), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "requireUpdateSender");
  assert.ok(declaration, "update commands need a main-frame authorization guard");
  const code = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const frame = { url: "file:///trusted/index.html" };
  const mainWindow = { isDestroyed: () => false, webContents: { mainFrame: frame } };
  const authorize = window => new Function("BrowserWindow", "mainWindow", "isTrustedRendererUrl", "rendererFileUrl", "rendererUrl", `${code}; return requireUpdateSender;`)(
    { fromWebContents: sender => sender.window }, window, url => url === frame.url, frame.url, undefined
  );
  const valid = { sender: { window: mainWindow }, senderFrame: frame };
  assert.doesNotThrow(() => authorize(mainWindow)(valid));
  assert.throws(() => authorize(mainWindow)({ ...valid, sender: { window: {} } }));
  assert.throws(() => authorize(mainWindow)({ ...valid, senderFrame: { url: frame.url } }));
  assert.throws(() => authorize(null)(valid));
  assert.throws(() => authorize({ ...mainWindow, isDestroyed: () => true })(valid));
  const foreignFrame = { url: "https://untrusted.example" };
  const foreignWindow = { ...mainWindow, webContents: { mainFrame: foreignFrame } };
  assert.throws(() => authorize(foreignWindow)({ sender: { window: foreignWindow }, senderFrame: foreignFrame }));
});

test("diagnostics retain the failed update source, phase and actual error without changing the UI flow", async () => {
  const events = [];
  const { service, updater } = await fixture({ onDiagnostic: (event, detail) => events.push({ event, detail }) });
  await service.check();
  updater.downloadError = Object.assign(new Error('HTTP 404: installer missing'), { code: 'ERR_HTTP_404' });
  assert.equal((await service.download()).status, 'error');
  assert.ok(events.some(item => item.event === 'request-failed' && item.detail.source === 'server'
    && item.detail.phase === 'download' && item.detail.error.code === 'ERR_HTTP_404'));
  assert.equal(updater.installs, 0);
});
