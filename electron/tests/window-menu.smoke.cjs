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
    const captions = page.getByRole('group', { name: '窗口控制', exact: true });
    await captions.waitFor();
    assert.equal(await captions.getByRole('button').count(), 3);
    assert.equal(await page.evaluate(() => navigator.windowControlsOverlay?.visible ?? false), false);
    const captionBounds = await page.evaluate(() => {
      const controls = document.querySelector('.desktop-window-controls');
      const rect = controls.getBoundingClientRect();
      const drag = document.querySelector('.desktop-titlebar-drag-region');
      const bounds = drag.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        dragLeft: bounds.left, dragRight: bounds.right,
        dragStyle: getComputedStyle(drag).getPropertyValue('-webkit-app-region'),
        controlStyle: getComputedStyle(controls).getPropertyValue('-webkit-app-region') };
    });
    assert.equal(captionBounds.y, 0);
    assert.equal(captionBounds.height, 32);
    assert.equal(captionBounds.width, 138);
    assert.equal(captionBounds.dragLeft, 144);
    assert.ok(captionBounds.dragRight <= captionBounds.x, 'Drag region must not cover caption buttons');
    assert.equal(captionBounds.dragStyle, 'drag');
    assert.equal(captionBounds.controlStyle, 'no-drag');
    const captionColor = () => captions.evaluate(element => getComputedStyle(element).color);
    const checkHighlight = async (theme) => {
      await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
      const hover = theme === 'dark' ? 'rgba(226, 234, 248, 0.14)' : 'rgb(229, 234, 244)';
      const pressed = theme === 'dark' ? 'rgba(226, 234, 248, 0.22)' : 'rgb(216, 223, 237)';
      for (const name of ['最小化', '最大化', '关闭']) {
        const button = captions.getByRole('button', { name, exact: true });
        const bounds = await button.boundingBox();
        assert.equal(bounds.width, 46);
        assert.equal(bounds.height, 32);
        assert.equal(await button.evaluate(element => getComputedStyle(element).getPropertyValue('-webkit-app-region')), 'no-drag');
        await button.hover();
        await page.waitForFunction(({ name, hover }) => {
          const button = document.querySelector(`.desktop-window-button[aria-label="${name}"]`);
          return button?.matches(':hover') && getComputedStyle(button).backgroundColor === hover;
        }, { name, hover });
        assert.equal(await button.evaluate(element => getComputedStyle(element).backgroundColor), hover);
      }
      await captions.screenshot({ path: path.join(artifacts, `titlebar-${theme}-close-hover.png`) });
      const close = captions.getByRole('button', { name: '关闭', exact: true });
      await close.hover();
      await page.mouse.down();
      await page.waitForTimeout(160);
      assert.equal(await close.evaluate(element => getComputedStyle(element).backgroundColor), pressed,
        JSON.stringify(await close.evaluate(element => ({ active: element.matches(':active'), hover: element.matches(':hover'), focused: document.activeElement === element }))));
      await captions.screenshot({ path: path.join(artifacts, `titlebar-${theme}-close-pressed.png`) });
      // Release away from the caption so the pressed-state check never closes it.
      await page.mouse.move(300, 200);
      await page.mouse.up();
    };
    await page.getByRole('radio', { name: '深色', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.first-run-onboarding.dark'));
    assert.equal(await captionColor(), 'rgb(237, 241, 247)');
    await checkHighlight('dark');
    await page.screenshot({ path: path.join(artifacts, 'titlebar-onboarding-dark.png') });
    await page.getByRole('radio', { name: '浅色', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.first-run-onboarding.dark'));
    assert.equal(await captionColor(), 'rgb(75, 85, 104)');
    await checkHighlight('light');
    await page.screenshot({ path: path.join(artifacts, 'titlebar-onboarding-light.png') });
    await dismissFirstRunOnboarding(page);
    await page.evaluate(() => {
      const backdrop = document.createElement('div');
      backdrop.className = 'duplicate-finder-backdrop';
      backdrop.dataset.titlebarSmoke = 'true';
      document.body.append(backdrop);
    });
    const captionsReachable = await captions.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(bounds.right - 23, bounds.top + 16));
    });
    await page.evaluate(() => document.querySelector('[data-titlebar-smoke]')?.remove());
    assert.equal(captionsReachable, true, 'Window captions must remain usable above application modals');
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
    assert.equal(await captionColor(), 'rgb(237, 241, 247)');
    await page.getByRole('button', { name: '系统', exact: true }).click();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.querySelector('.app-shell.theme-light'));
    assert.equal(await captionColor(), 'rgb(75, 85, 104)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.querySelector('.app-shell.theme-dark'));
    assert.equal(await captionColor(), 'rgb(237, 241, 247)');
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
      assert.ok(controls.x + controls.width <= captionBounds.dragLeft, 'Application tools stay outside drag area');
      const right = await captions.boundingBox();
      assert.equal(right.width, 138);
      assert.equal(right.x + right.width, await page.evaluate(() => innerWidth));
      await page.screenshot({ path: path.join(artifacts, `titlebar-local-${width}.png`) });
    }
    await captions.getByRole('button', { name: '最大化', exact: true }).click();
    await captions.getByRole('button', { name: '还原', exact: true }).waitFor();
    assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
    await captions.getByRole('button', { name: '还原', exact: true }).click();
    await captions.getByRole('button', { name: '最大化', exact: true }).waitFor();
    assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), false);
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize());
    await captions.getByRole('button', { name: '还原', exact: true }).waitFor();
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize());
    await captions.getByRole('button', { name: '最大化', exact: true }).waitFor();
    await captions.getByRole('button', { name: '最小化', exact: true }).click();
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
    await captions.getByRole('button', { name: '关闭', exact: true }).click();
    assert.equal(await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    assert.equal(await page.evaluate(() => window.listenMusic.setCloseBehavior('exit')), 'exit');
    assert.deepEqual(errors, []);
    console.log('Windows titlebar smoke passed: custom captions, neutral hover/pressed colors, onboarding/theme contrast, caption bounds, maximize/restore/minimize, mini mode and tray close');
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
