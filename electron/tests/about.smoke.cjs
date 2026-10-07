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
    assert.deepEqual(pageErrors, []);
    console.log("Electron about-page smoke passed: layout, diagnostics copy, persisted auto-check and external URL guard.");
  } finally {
    await instance.close();
    console.log(`Isolated test data: ${data}`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
