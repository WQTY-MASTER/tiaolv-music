const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { dismissFirstRunOnboarding } = require("./helpers/onboarding-smoke.cjs");

const data = fs.mkdtempSync(path.join(os.tmpdir(), "tiaolv-about-smoke-"));
const aboutConfigPath = path.join(data, "about.json");
fs.writeFileSync(aboutConfigPath, JSON.stringify({ autoCheckUpdates: false }));
const env = { ...process.env, SHORTCUT_SMOKE_DATA: data };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;

async function main() {
  const instance = await _electron.launch({
    executablePath: require("electron"),
    args: [path.join(__dirname, "helpers/shortcut-smoke-main.cjs")],
    env,
    timeout: 20000
  });
  try {
    const page = await instance.firstWindow();
    await dismissFirstRunOnboarding(page);
    page.setDefaultTimeout(10000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "关于", exact: true }).click();
    await page.locator(".about-settings-card").waitFor();
    await page.locator(".about-brand h2").filter({ hasText: "调律音乐" }).waitFor();
    await page.locator(".about-version").waitFor();
    assert.match(await page.locator(".about-version").innerText(), /^v\d+\.\d+\.\d+/);
    assert.equal(await page.getByText("项目仓库", { exact: true }).count(), 1);
    assert.equal(await page.getByText("MIT License", { exact: true }).count(), 1);
    assert.equal(await page.getByText("第三方内容声明", { exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);

    await page.getByRole("button", { name: "复制诊断信息" }).click();
    await page.getByRole("button", { name: "已复制" }).waitFor();
    const clipboardText = await instance.evaluate(({ clipboard }) => clipboard.readText());
    assert.match(clipboardText, /调律音乐 v\d+\.\d+\.\d+/);
    assert.match(clipboardText, /Electron 35\./);
    assert.match(clipboardText, /后端 API 未连接/);

    const toggle = page.getByRole("switch", { name: "启动时自动检查更新" });
    assert.equal(await toggle.isChecked(), false);
    await toggle.click();
    await page.waitForFunction(async () => (await window.listenMusic.getAboutSnapshot()).autoCheckUpdates);
    assert.equal(JSON.parse(fs.readFileSync(aboutConfigPath, "utf8")).autoCheckUpdates, true);
    const blocked = await page.evaluate(async () => {
      try { await window.listenMusic.openExternalLink("https://example.com"); return false; }
      catch { return true; }
    });
    assert.equal(blocked, true);

    fs.mkdirSync(path.resolve(__dirname, "../.playwright-cli"), { recursive: true });
    await page.evaluate(() => document.querySelector(".main-scroll")?.scrollTo(0, 0));
    await page.screenshot({ path: path.resolve(__dirname, "../.playwright-cli/about-desktop.png"), fullPage: true });

    // Exercise the existing UI/bridge in isolation; never download or execute an installer.
    await instance.evaluate(({ ipcMain, BrowserWindow }) => {
      const latest = { status: "available", currentVersion: "0.1.1", latestVersion: "0.1.2", releaseName: "调律音乐 v0.1.2", releaseNotes: "更新流程隔离验收", releaseUrl: "https://github.com/WQTY-MASTER/tiaolv-music/releases/tag/v0.1.2", message: "发现新版本。" };
      const window = BrowserWindow.getAllWindows()[0];
      global.updateSmokeLatest = latest;
      ipcMain.removeHandler("check-for-updates");
      ipcMain.handle("check-for-updates", () => latest);
      ipcMain.removeHandler("download-update");
      ipcMain.handle("download-update", () => {
        const result = { ...latest, status: "downloading", progress: { percent: 47.5, transferred: 4750000, total: 10000000, bytesPerSecond: 1000000 }, message: "正在下载更新。" };
        window.webContents.send("update-check-result", result);
        return result;
      });
      ipcMain.removeHandler("install-update");
      ipcMain.handle("install-update", () => { global.updateSmokeInstallRequests = (global.updateSmokeInstallRequests || 0) + 1; return true; });
    });
    await page.getByRole("button", { name: "检查更新", exact: true }).click();
    await page.getByRole("button", { name: "下载更新", exact: true }).click();
    await page.getByText("下载进度 48%", { exact: true }).waitFor();
    assert.equal(await page.getByRole("progressbar", { name: "更新下载进度" }).getAttribute("value"), "47.5");
    assert.equal(await page.getByRole("button", { name: "浏览器手动下载", exact: true }).count(), 1);
    await page.screenshot({ path: path.resolve(__dirname, "../.playwright-cli/about-update-progress.png"), fullPage: true });
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send("update-check-result", { ...global.updateSmokeLatest, status: "error", message: "更新包校验失败，未安装。" }));
    await page.getByText("更新包校验失败，未安装。", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "重启安装", exact: true }).count(), 0);
    await page.screenshot({ path: path.resolve(__dirname, "../.playwright-cli/about-update-fallback.png"), fullPage: true });
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send("update-check-result", { ...global.updateSmokeLatest, status: "downloaded", message: "更新已下载并通过校验。" }));
    await page.getByRole("button", { name: "重启安装", exact: true }).click();
    assert.equal(await instance.evaluate(() => global.updateSmokeInstallRequests), 1);
    await page.setViewportSize({ width: 800, height: 650 });
    await page.screenshot({ path: path.resolve(__dirname, "../.playwright-cli/about-update-narrow.png"), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    assert.deepEqual(pageErrors, []);
    console.log("Electron about-page smoke passed: update progress, failed-checksum fallback, explicit install action, layout and existing about controls. Download/install IPC used isolated fixtures.");
  } finally {
    await instance.close();
    console.log(`Isolated test data: ${data}`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
