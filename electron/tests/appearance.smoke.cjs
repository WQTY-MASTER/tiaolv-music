const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { dismissFirstRunOnboarding } = require("./helpers/onboarding-smoke.cjs");

const data = fs.mkdtempSync(path.join(os.tmpdir(), "tiaolv-appearance-smoke-"));
const env = { ...process.env, SHORTCUT_SMOKE_DATA: data };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;

async function openAppearance(page) {
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "外观", exact: true }).click();
  await page.locator(".appearance-card").waitFor();
}

async function main() {
  const instance = await _electron.launch({
    executablePath: require("electron"),
    args: [path.join(__dirname, "helpers/shortcut-smoke-main.cjs")],
    env,
    timeout: 20000
  });
  try {
    const page = await instance.firstWindow();
    page.setDefaultTimeout(10000);
    await dismissFirstRunOnboarding(page);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await openAppearance(page);

    assert.equal(await page.getByText("主题模式", { exact: true }).count(), 1);
    assert.equal(await page.getByText("自定义背景", { exact: true }).count(), 1);
    assert.equal(await page.getByText("歌词显示样式", { exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);

    fs.mkdirSync(path.resolve(__dirname, "../.playwright-cli"), { recursive: true });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector(".main-scroll")?.scrollTo(0, 0));
    await page.screenshot({ path: path.resolve(__dirname, "../.playwright-cli/appearance-light.png"), fullPage: true });

    await page.getByRole("button", { name: "深色", exact: true }).click();
    await page.getByRole("button", { name: "舒展", exact: true }).click();
    await page.getByRole("button", { name: "当前继承统一背景", exact: true }).click();
    await page.getByRole("button", { name: "改为继承统一背景", exact: true }).waitFor();
    await page.locator('.lyric-setting input[type="range"]').first().evaluate((element) => {
      element.value = "24";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => {
      const raw = localStorage.getItem("tiaolv-music-appearance-settings");
      if (!raw) return false;
      const settings = JSON.parse(raw);
      return settings.themeMode === "dark"
        && settings.density === "comfortable"
        && settings.lyrics.fontSize === 24
        && settings.background.pages.local.inherit === false;
    });
    assert.equal(await page.locator(".app-shell").evaluate((element) => element.classList.contains("theme-dark")), true);
    await page.evaluate(() => document.querySelector(".main-scroll")?.scrollTo(0, 0));
    await page.screenshot({ path: path.resolve(__dirname, "../.playwright-cli/appearance-dark.png"), fullPage: true });

    await page.reload();
    await openAppearance(page);
    assert.equal(await page.getByRole("button", { name: "深色", exact: true }).getAttribute("class"), "active");
    assert.equal(await page.locator(".app-shell").evaluate((element) => element.classList.contains("density-comfortable")), true);
    await page.getByRole("button", { name: "改为继承统一背景", exact: true }).waitFor();
    assert.deepEqual(pageErrors, []);
    console.log("Electron appearance smoke passed: layout, live theme, density, lyric controls and persistence.");
  } finally {
    await instance.close();
    console.log(`Isolated test data: ${data}`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
