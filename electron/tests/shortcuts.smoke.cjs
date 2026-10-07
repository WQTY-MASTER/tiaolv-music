const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { dismissFirstRunOnboarding } = require("./helpers/onboarding-smoke.cjs");

const data = fs.mkdtempSync(path.join(os.tmpdir(), "tiaolv-shortcuts-smoke-"));
const configPath = path.join(data, "shortcuts.json");
fs.writeFileSync(configPath, JSON.stringify({ enabled: false }));
const env = { ...process.env, SHORTCUT_SMOKE_DATA: data };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const options = {
  executablePath: require("electron"),
  args: [path.join(__dirname, "helpers/shortcut-smoke-main.cjs")],
  env,
  timeout: 20000
};

async function main() {
  let instance;
  try {
    instance = await _electron.launch(options);
    const page = await instance.firstWindow();
    await dismissFirstRunOnboarding(page);
    page.setDefaultTimeout(10000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "快捷键", exact: true }).click();
    const bindings = page.locator(".shortcut-binding");
    await bindings.first().waitFor();
    assert.equal(await bindings.count(), 12);
    await page.waitForFunction(() => !document.querySelector(".shortcut-binding")?.disabled);
    const next = page.locator(".shortcut-row").filter({ has: page.getByText("下一曲", { exact: true }) });
    await next.locator("button").click();
    await page.waitForFunction(async () => (await window.listenMusic.getShortcuts()).recording);
    await page.keyboard.press("Control+Shift+Y");
    await page.waitForFunction(async () => (await window.listenMusic.getShortcuts()).config.bindings.next === "Control+Shift+Y");
    assert.equal(JSON.parse(fs.readFileSync(configPath, "utf8")).bindings.next, "Control+Shift+Y");

    await next.locator("button").click();
    await page.waitForFunction(async () => (await window.listenMusic.getShortcuts()).recording);
    await page.keyboard.press("Control+Alt+ArrowLeft");
    await next.getByRole("alert").waitFor();
    assert.match(await next.getByRole("alert").innerText(), /重复/);
    assert.equal((await page.evaluate(() => window.listenMusic.getShortcuts())).config.bindings.next, "Control+Shift+Y");

    await next.locator("button").click();
    await page.waitForFunction(async () => (await window.listenMusic.getShortcuts()).recording);
    await page.keyboard.press("Escape");
    await page.waitForFunction(async () => !(await window.listenMusic.getShortcuts()).recording);
    await page.evaluate(() => {
      window.shortcutSmokeActions = [];
      window.listenMusic.onShortcutAction((action) => window.shortcutSmokeActions.push(action));
    });
    await instance.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((item) => !item.webContents.getURL().includes("desktop-lyrics"));
      win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Up", modifiers: ["control", "alt"] });
      win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Up", modifiers: ["control", "alt"] });
    });
    await page.waitForFunction(() => window.shortcutSmokeActions.includes("volume-up"));
    assert.deepEqual(await page.evaluate(() => window.shortcutSmokeActions), ["volume-up"]);
    assert.equal(await page.locator(".shortcut-settings-card").count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);

    fs.mkdirSync(path.resolve(__dirname, "../.playwright-cli"), { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.resolve(__dirname, "../.playwright-cli/shortcuts-desktop.png"), fullPage: true });
    assert.deepEqual(pageErrors, []);
    await instance.close();
    instance = await _electron.launch(options);
    const restarted = await instance.firstWindow();
    await restarted.waitForFunction(() => Boolean(window.listenMusic));
    const restored = await restarted.evaluate(() => window.listenMusic.getShortcuts());
    assert.equal(restored.config.bindings.next, "Control+Shift+Y");
    assert.equal(restored.config.enabled, false);
    console.log("Electron shortcut smoke passed: 12 rows, capture/cancel, duplicate rejection, local single dispatch, disk persistence and restart.");
  } finally {
    if (instance) await instance.close();
    console.log(`Isolated test data: ${data}`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
