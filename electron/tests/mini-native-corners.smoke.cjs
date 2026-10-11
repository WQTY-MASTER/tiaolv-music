const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { dismissFirstRunOnboarding } = require('./helpers/onboarding-smoke.cjs');

async function main() {
  if (process.platform !== 'win32') throw new Error('Windows compositor check requires Windows');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-mini-corners-'));
  fs.writeFileSync(path.join(data, 'local-access.token'), 'a'.repeat(64));
  fs.writeFileSync(path.join(data, 'shortcuts.json'), JSON.stringify({ enabled: false }));
  const env = { ...process.env, SHORTCUT_SMOKE_DATA: data, LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: path.join(data, 'local-access.token'), HOME: data, USERPROFILE: data, APPDATA: data, LOCALAPPDATA: data };
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  let app;
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, 'helpers/shortcut-smoke-main.cjs')], env });
    const page = await app.firstWindow();
    await dismissFirstRunOnboarding(page);
    const mainId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id);
    const ready = app.waitForEvent('window');
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.send('tray-media-action', 'mini-player'), mainId);
    const mini = await ready;
    await mini.locator('.mini-player').waitFor();
    const id = await app.evaluate(({ BrowserWindow }, mainId) => BrowserWindow.getAllWindows().find(win => win.id !== mainId).id, mainId);
    await page.waitForTimeout(1000);
    const snapshot = await mini.evaluate(() => window.listenMusic.getMiniPlayerSnapshot());
    await page.evaluate(playback => window.listenMusic.updateMiniPlayerSnapshot({ ...playback, preferences: { ...playback.preferences, appearance: { ...playback.preferences.appearance, cornerRadius: 32 } } }), snapshot.playback);
    await mini.waitForFunction(() => getComputedStyle(document.querySelector('.mini-player')).getPropertyValue('--mini-radius').trim() === '32px');
    const backdropId = await app.evaluate(async ({ BrowserWindow }, id) => {
      const mini = BrowserWindow.fromId(id);
      mini.setBounds({ x: 100, y: 100, width: 720, height: 320 });
      const backdrop = new BrowserWindow({ x: 60, y: 60, width: 960, height: 480, frame: false, thickFrame: false, alwaysOnTop: true, show: false, backgroundColor: '#29d65b' });
      await backdrop.loadURL('data:text/html,<html style="background:%2329d65b"></html>');
      backdrop.showInactive(); mini.setAlwaysOnTop(true); mini.show(); mini.focus();
      return backdrop.id;
    }, id);
    const artifacts = path.resolve(__dirname, '../.playwright-cli');
    fs.mkdirSync(artifacts, { recursive: true });
    async function capture(stage) {
      await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).moveTop(), id);
      await mini.waitForTimeout(200);
      const rendererPath = path.join(artifacts, `mini-native-${stage}-renderer.png`);
      await mini.screenshot({ path: rendererPath, omitBackground: true });
      const handle = await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).getNativeWindowHandle().readBigUInt64LE().toString(), id);
      const result = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'helpers/mini-native-region.ps1'), '-WindowHandle', handle, '-CapturePath', path.join(artifacts, `mini-native-${stage}.png`), '-RendererCapturePath', rendererPath], { encoding: 'utf8', windowsHide: true }));
      console.log(JSON.stringify({ stage, ...result }));
      assert.equal(await mini.evaluate(() => getComputedStyle(document.querySelector('.mini-player')).getPropertyValue('--mini-radius').trim()), '32px', 'Fixture radius must not be overwritten by guide initialization');
      assert.equal(result.topInset, 24, 'Maximum-radius region must retain the CSS antialiasing fringe');
      assert.ok(result.cornerBlendChecked > 20, 'Real screen must include partially transparent antialiased pixels');
      assert.equal(result.cornerBlendMismatches, 0, 'Native screen edge must match the antialiased renderer blended over the backdrop');
      return result;
    }
    const results = [await capture('focused')];
    await app.evaluate(({ BrowserWindow }, { id, backdropId }) => {
      const win = BrowserWindow.fromId(id);
      win.setShape([]);
      BrowserWindow.fromId(backdropId).focus();
      win.focus();
    }, { id, backdropId });
    results.push(await capture('clip-recovered'));
    await app.evaluate(({ BrowserWindow }, id) => { const win = BrowserWindow.fromId(id); const bounds = win.getBounds(); win.setPosition(bounds.x + 8, bounds.y + 8); }, id);
    results.push(await capture('moved'));
    await app.evaluate(({ BrowserWindow }, id) => { const win = BrowserWindow.fromId(id); win.setAlwaysOnTop(false); win.setAlwaysOnTop(true); }, id);
    results.push(await capture('pin-toggled'));
    await app.evaluate(({ BrowserWindow }, { id, backdropId }) => { BrowserWindow.fromId(backdropId).focus(); }, { id, backdropId });
    results.push(await capture('blurred'));
    await app.evaluate(({ BrowserWindow }, id) => { const win = BrowserWindow.fromId(id); win.focus(); win.setBounds({ width: 680, height: 300 }); }, id);
    results.push(await capture('resized'));
    await app.evaluate(({ BrowserWindow }, id) => {
      const win = BrowserWindow.fromId(id);
      for (let step = 0; step < 20; step++) win.setBounds({ width: 420 + step * 15, height: 190 + step * 6 });
      win.setBounds({ width: 720, height: 320 });
    }, id);
    results.push(await capture('rapid-resize'));
    await app.evaluate(({ BrowserWindow }, id) => { const win = BrowserWindow.fromId(id); win.minimize(); win.restore(); win.show(); win.focus(); }, id);
    results.push(await capture('restored'));
    for (const result of results) for (const pixel of result.cornerPixels) {
      assert.ok(result.kind > 0 && !result.corner && !result.bottomCorner && !result.thickFrame, 'Native 32 px rounded region must remain active');
      assert.ok(pixel.every((value, channel) => Math.abs(value - [41, 214, 91][channel]) <= 2), `Windows compositor must reveal backdrop at rounded corners, got ${JSON.stringify(result)}`);
    }
    console.log('Native compositor 32 px corners passed: focused, moved, pin toggled, blurred, resized, rapid resizing and restored');
  } finally {
    if (app) await app.close();
    const real = fs.realpathSync(data);
    assert.equal(path.dirname(real), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(real).startsWith('tiaolv-mini-corners-'));
    fs.rmSync(real, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
