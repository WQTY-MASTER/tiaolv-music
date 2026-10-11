const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { dismissFirstRunOnboarding } = require('./helpers/onboarding-smoke.cjs');

async function main() {
  assert.equal(process.platform, 'win32', 'This smoke checks the Windows menu policy');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-window-menu-'));
  const tokenFile = path.join(data, 'local-access.token');
  fs.writeFileSync(tokenFile, 'a'.repeat(64));
  fs.writeFileSync(path.join(data, 'shortcuts.json'), JSON.stringify({ enabled: false }));
  const env = {
    ...process.env,
    SHORTCUT_SMOKE_DATA: data,
    LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: tokenFile,
    LOCALAPPDATA: data,
    APPDATA: data,
    USERPROFILE: data,
    HOME: data
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  let instance;
  try {
    instance = await _electron.launch({
      executablePath: require('electron'),
      args: [path.join(__dirname, 'helpers/shortcut-smoke-main.cjs')],
      env,
      timeout: 20000
    });
    const page = await instance.firstWindow();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => Boolean(window.listenMusic));
    const artifacts = path.resolve(__dirname, '../.playwright-cli');
    fs.mkdirSync(artifacts, { recursive: true });
    await page.locator('.desktop-titlebar-drag-region').waitFor();
    await page.waitForFunction(() => navigator.windowControlsOverlay?.visible);
    const overlay = await page.evaluate(() => {
      const rect = navigator.windowControlsOverlay.getTitlebarAreaRect();
      const drag = document.querySelector('.desktop-titlebar-drag-region');
      const bounds = drag.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        dragLeft: bounds.left, dragRight: bounds.right,
        dragStyle: getComputedStyle(drag).getPropertyValue('-webkit-app-region') };
    });
    assert.equal(overlay.y, 0);
    assert.ok(overlay.height > 0 && overlay.height <= 32);
    assert.equal(overlay.dragLeft, 144);
    assert.ok(overlay.dragRight <= overlay.x + overlay.width, 'Drag region must not cover native buttons');
    assert.equal(overlay.dragStyle, 'drag');
    await instance.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      globalThis.titlebarSmokeUpdates = [];
      const apply = win.setTitleBarOverlay.bind(win);
      win.setTitleBarOverlay = options => { globalThis.titlebarSmokeUpdates.push(options); apply(options); };
    });
    const captionColor = () => instance.evaluate(() => globalThis.titlebarSmokeUpdates.at(-1)?.symbolColor);
    await page.getByRole('radio', { name: '深色', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.first-run-onboarding.dark'));
    assert.equal(await captionColor(), '#edf1f7');
    await page.screenshot({ path: path.join(artifacts, 'titlebar-onboarding-dark.png') });
    await page.getByRole('radio', { name: '浅色', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.first-run-onboarding.dark'));
    assert.equal(await captionColor(), '#27313c');
    await page.screenshot({ path: path.join(artifacts, 'titlebar-onboarding-light.png') });
    await dismissFirstRunOnboarding(page);
    const menuVisible = () => instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMenuBarVisible());
    const state = await instance.evaluate(({ Menu, BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return {
        applicationMenu: Menu.getApplicationMenu() === null,
        closable: win.isClosable(),
        minimizable: win.isMinimizable(),
        maximizable: win.isMaximizable(),
        resizable: win.isResizable()
      };
    });
    assert.deepEqual(state, { applicationMenu: true, closable: true, minimizable: true, maximizable: true, resizable: true });
    assert.equal(await menuVisible(), false);
    await page.keyboard.press('Alt');
    assert.equal(await menuVisible(), false, 'Alt must not restore the removed menu');
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '外观', exact: true }).click();
    await page.getByRole('button', { name: '深色', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.app-shell.theme-dark'));
    assert.equal(await captionColor(), '#edf1f7');
    await page.getByRole('button', { name: '系统', exact: true }).click();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.querySelector('.app-shell.theme-light'));
    assert.equal(await captionColor(), '#27313c');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.querySelector('.app-shell.theme-dark'));
    assert.equal(await captionColor(), '#edf1f7');
    await page.getByRole('button', { name: '浅色', exact: true }).click();
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('heading', { name: '外观', exact: true, level: 1 }).waitFor({ state: 'detached' });
    await page.waitForTimeout(300);
    await page.getByRole('radio', { name: '切换到本地模式', exact: true }).click();
    await page.waitForTimeout(300);
    for (const width of [1280, 1600]) {
      await instance.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 860), width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const controls = await page.locator('.shell-controls').boundingBox();
      assert.ok(controls.x + controls.width <= overlay.dragLeft, 'Application tools stay outside drag area');
      await page.screenshot({ path: path.join(artifacts, `titlebar-local-${width}.png`) });
    }
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize());
    assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize());
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
    assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()), true);
    await instance.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.restore(); win.focus(); });
    // An empty library has no player bar, so exercise the existing tray action.
    const miniReady = instance.waitForEvent('window');
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('tray-media-action', 'mini-player'));
    const mini = await miniReady;
    await mini.waitForFunction(() => document.querySelector('.mini-player.is-native-window')?.getBoundingClientRect().top === 0);
    assert.equal(await menuVisible(), false);
    assert.equal(await mini.evaluate(() => navigator.windowControlsOverlay?.visible ?? false), false);
    await mini.locator('.mini-player').hover();
    await mini.waitForTimeout(300);
    await mini.screenshot({ path: path.join(artifacts, 'titlebar-mini.png'), omitBackground: true });
    await mini.getByRole('button', { name: '返回完整播放器', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.mini-player.is-native-window') && innerWidth > 1000 && getComputedStyle(document.querySelector('.app-shell')).display !== 'none');
    assert.equal(await menuVisible(), false, 'Leaving mini mode must not restore the default menu');
    const screenshot = path.resolve(__dirname, '../.playwright-cli/window-menu.png');
    fs.mkdirSync(path.dirname(screenshot), { recursive: true });
    await page.screenshot({ path: screenshot });
    assert.equal(await page.evaluate(() => window.listenMusic.setCloseBehavior('tray')), 'tray');
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    assert.equal(await page.evaluate(() => window.listenMusic.setCloseBehavior('exit')), 'exit');
    assert.deepEqual(errors, []);
    console.log('Windows titlebar smoke passed: native overlay, onboarding/theme contrast, caption bounds, maximize/minimize, mini mode and tray close');
  } finally {
    try {
      if (instance) await instance.close();
    } finally {
      const resolved = fs.realpathSync(data);
      assert.equal(resolved, fs.realpathSync(path.dirname(data)) + path.sep + path.basename(data));
      assert.ok(path.basename(data).startsWith('tiaolv-window-menu-'));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
