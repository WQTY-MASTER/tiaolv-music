const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { dismissFirstRunOnboarding } = require('./helpers/onboarding-smoke.cjs');

async function main() {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-mini-first-'));
  fs.writeFileSync(path.join(data, 'local-access.token'), 'a'.repeat(64));
  fs.writeFileSync(path.join(data, 'shortcuts.json'), JSON.stringify({ enabled: false }));
  fs.writeFileSync(path.join(data, 'mini-window.json'), JSON.stringify({ locked: false, bounds: { x: 150, y: 150, width: 720, height: 320 } }));
  const env = { ...process.env, SHORTCUT_SMOKE_DATA: data, LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: path.join(data, 'local-access.token'),
    HOME: data, USERPROFILE: data, APPDATA: data, LOCALAPPDATA: data };
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  let app;
  const failures = [];
  const label = `${env.SHORTCUT_SMOKE_MAIN_FILE ? 'installed-baseline' : 'current'}${env.MINI_SMOKE_SOFTWARE_RENDERING === '1' ? '-software' : ''}`;
  const artifacts = path.resolve(__dirname, '../.playwright-cli');
  fs.mkdirSync(artifacts, { recursive: true });
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, 'helpers/shortcut-smoke-main.cjs')], env });
    const page = await app.firstWindow();
    await dismissFirstRunOnboarding(page);
    await page.evaluate(() => {
      const key = 'tiaolv-music-appearance-settings';
      const prefs = JSON.parse(localStorage.getItem(key) || '{}');
      prefs.miniPlayer = { ...prefs.miniPlayer, appearance: { ...prefs.miniPlayer?.appearance, cornerRadius: 31 } };
      prefs.playerControls = { ...prefs.playerControls, miniAlwaysOnTop: false };
      localStorage.setItem(key, JSON.stringify(prefs));
    });
    await page.reload();
    await page.locator('.app-shell').waitFor();
    await page.waitForTimeout(1000);
    const mainId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id);
    const backdropId = await app.evaluate(async ({ BrowserWindow }, mainId) => {
      BrowserWindow.fromId(mainId).maximize();
      const backdrop = new BrowserWindow({ x: 100, y: 100, width: 940, height: 460, frame: false, thickFrame: false, alwaysOnTop: false,
        show: false, backgroundColor: '#29d65b' });
      await backdrop.loadURL('data:text/html,<html style="background:%2329d65b"></html>');
      backdrop.showInactive();
      return backdrop.id;
    }, mainId);
    for (let entry = 0; entry < Number(env.MINI_SMOKE_ENTRIES || 5); entry++) {
      const opening = app.waitForEvent('window');
      await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.send('tray-media-action', 'mini-player'), mainId);
      const mini = await opening;
      await mini.locator('.mini-player').waitFor();
      const native = await app.evaluate(({ BrowserWindow }, { mainId, backdropId }) => {
        const win = BrowserWindow.getAllWindows().find(win => win.id !== mainId && win.id !== backdropId);
        return { id: win.id, handle: win.getNativeWindowHandle().readBigUInt64LE().toString(), bounds: win.getBounds() };
      }, { mainId, backdropId });
      // Screen first: no renderer capture, moveTop, focus or minimize before this.
      const capturePath = path.join(artifacts, `mini-first-${label}-${entry}.png`);
      let screen = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        path.join(__dirname, 'helpers/mini-native-region.ps1'), '-WindowHandle', native.handle, '-CapturePath', capturePath],
        { encoding: 'utf8', windowsHide: true }));
      const roots = await mini.evaluate(() => ({
        radius: getComputedStyle(document.querySelector('.mini-player')).borderTopLeftRadius,
        backgrounds: [document.documentElement, document.body, document.querySelector('#app')].map(el => getComputedStyle(el).backgroundColor)
      }));
      console.log(JSON.stringify({ label, entry, native, screen, roots }));
      if (!screen.cornerPixels.every(pixel => pixel.every((value, channel) => Math.abs(value - [41, 214, 91][channel]) <= 2))) failures.push(entry);
      assert.deepEqual(roots.backgrounds, ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
      assert.equal(roots.radius, '31px');
      assert.equal(screen.windowWidth, 720); assert.equal(screen.windowHeight, 320);
      if (entry === 0) {
        for (const stage of ['small', 'large', 'pin-off']) {
          await app.evaluate(({ BrowserWindow }, { id, stage }) => {
            const win = BrowserWindow.fromId(id);
            if (stage === 'small') win.setBounds({ width: 420, height: 220 });
            if (stage === 'large') win.setBounds({ width: 720, height: 320 });
            if (stage === 'pin-off') { win.setAlwaysOnTop(true); win.setAlwaysOnTop(false); }
            if (win.isAlwaysOnTop()) throw new Error('Fixture must remain non-topmost');
          }, { id: native.id, stage });
          await mini.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height,
            stage === 'small' ? { width: 420, height: 220 } : { width: 720, height: 320 });
          const resized = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
            path.join(__dirname, 'helpers/mini-native-region.ps1'), '-WindowHandle', native.handle,
            '-CapturePath', path.join(artifacts, `mini-first-${label}-${stage}.png`)], { encoding: 'utf8', windowsHide: true }));
          console.log(JSON.stringify({ label, stage, screen: resized }));
          if (!resized.cornerPixels.every(pixel => pixel.every((value, channel) => Math.abs(value - [41, 214, 91][channel]) <= 2))) failures.push(stage);
        }
      }
      await mini.locator('.mini-player').hover();
      await mini.getByRole('button', { name: '返回完整播放器', exact: true }).click();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.app-shell')).display !== 'none');
    }
    assert.deepEqual(failures, [], 'Actual first-open corners must reveal the backdrop before any renderer screenshot or recovery operation');
    console.log(`First-open native corners passed: ${label}, saved full size, radius 31, non-topmost, ${Number(env.MINI_SMOKE_ENTRIES || 5)} entries, screen capture first`);
  } finally {
    if (app) await app.close();
    assert.equal(path.dirname(fs.realpathSync(data)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(data).startsWith('tiaolv-mini-first-'));
    fs.rmSync(data, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
