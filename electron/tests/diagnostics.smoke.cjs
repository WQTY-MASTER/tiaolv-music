const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.argv[2] || process.env.PLAYWRIGHT_MODULE || 'playwright');
const { unzipSync, strFromU8 } = require('fflate');

const root = path.resolve(__dirname, '../.test-tmp');
fs.mkdirSync(root, { recursive: true });
const data = fs.mkdtempSync(path.join(root, 'diagnostics-smoke-'));
const tokenFile = path.join(data, 'local-access.token');
fs.writeFileSync(tokenFile, 'a'.repeat(64));
fs.writeFileSync(path.join(data, 'about.json'), JSON.stringify({ autoCheckUpdates: false }));
const env = { ...process.env, SHORTCUT_SMOKE_DATA: data, LOCALAPPDATA: data,
  LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: tokenFile };
if (process.argv[3]) env.SHORTCUT_SMOKE_MAIN_FILE = path.resolve(process.argv[3]);
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;

function luminance(value) {
  const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => {
    const c = n / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

async function contrast(page, selector) {
  const colors = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node); return { text: node.textContent.trim(), color: style.color, background: style.backgroundColor };
  }));
  assert.ok(colors.length > 0);
  for (const color of colors) {
    const a = luminance(color.color), b = luminance(color.background);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, JSON.stringify(color));
  }
}

async function main() {
  const instance = await _electron.launch({ executablePath: require('electron'),
    args: [path.join(__dirname, 'helpers/shortcut-smoke-main.cjs')], env, timeout: 20000 });
  try {
    const page = await instance.firstWindow();
    page.setDefaultTimeout(10000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.first-run-onboarding').waitFor();
    await page.getByRole('radio', { name: '深色', exact: true }).click();
    await contrast(page, '.onboarding-density button.active, .onboarding-continue');
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await page.locator('.onboarding-source-page').waitFor();
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await page.locator('.onboarding-library-page').waitFor();
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await page.locator('.onboarding-quality-options').waitFor();
    const active = '.onboarding-quality-options button.active, .onboarding-cache-options button.active, .onboarding-continue';
    await page.waitForFunction(() => [...document.querySelectorAll('.onboarding-enter')]
      .every(node => Number(getComputedStyle(node).opacity) === 1));
    await contrast(page, active);
    const screenshots = path.resolve(__dirname, '../.playwright-cli');
    fs.mkdirSync(screenshots, { recursive: true });
    await page.screenshot({ path: path.join(screenshots, 'diagnostics-onboarding-dark.png') });
    await page.setViewportSize({ width: 920, height: 720 });
    await contrast(page, active);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(screenshots, 'diagnostics-onboarding-narrow.png') });
    await page.getByRole('button', { name: '跳过引导', exact: true }).click();
    await page.locator('.first-run-onboarding').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '关于', exact: true }).click();
    const exportButton = page.getByRole('button', { name: '导出诊断包', exact: true });
    await exportButton.waitFor();

    await page.evaluate(() => window.listenMusic.reportDiagnostic({ kind: 'request', message: 'HTTP 404 Cookie: SMOKE_PRIVATE',
      method: 'GET', path: '/updates/windows/Test.exe?ticket=SMOKE_QUERY', status: 404, elapsedMs: 321 }));
    await page.evaluate(() => { setTimeout(() => { Promise.reject(new Error('SMOKE_REJECTION token=SMOKE_REJECTION_PRIVATE')); }, 0); });
    await instance.evaluate(({ dialog }) => {
      dialog.showSaveDialog = () => new Promise(resolve => { global.resolveDiagnosticDialog = resolve; });
    });
    await exportButton.click();
    await page.getByRole('button', { name: '正在导出', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '正在导出', exact: true }).isDisabled(), true);
    const duplicate = await page.evaluate(() => window.listenMusic.exportDiagnostics({}));
    assert.equal(duplicate.status, 'error');
    await instance.evaluate(() => global.resolveDiagnosticDialog({ canceled: true }));
    await page.getByText('已取消导出。', { exact: true }).waitFor();
    assert.equal(await exportButton.isEnabled(), true);
    assert.ok(!fs.readdirSync(data).some(name => name.endsWith('.zip')));

    await instance.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); },
      path.join(data, 'missing', 'fail.zip'));
    await exportButton.click();
    await page.getByText('诊断包导出失败，请检查保存目录空间和写入权限后重试。', { exact: true }).waitFor();
    assert.equal(await exportButton.isEnabled(), true);
    const output = path.join(data, 'diagnostics.zip');
    await instance.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, output);
    await exportButton.click();
    await page.getByText('诊断包已导出。', { exact: true }).waitFor();
    const diagnosticText = await page.locator('.diagnostic-grid dd').first().evaluate(node => getComputedStyle(node).color);
    const diagnosticBackground = await page.locator('.about-settings-card').evaluate(node => getComputedStyle(node).backgroundColor);
    assert.ok((Math.max(luminance(diagnosticText), luminance(diagnosticBackground)) + 0.05)
      / (Math.min(luminance(diagnosticText), luminance(diagnosticBackground)) + 0.05) >= 4.5);
    const archive = unzipSync(fs.readFileSync(output));
    const info = JSON.parse(strFromU8(archive['diagnostics.json']));
    assert.equal(info.appearance.themeMode, 'dark');
    assert.equal(info.appearance.activeView, 'settings');
    assert.equal(info.appearance.fontFamily, 'system');
    assert.ok(info.display.scaleFactor > 0);
    assert.ok(info.display.width > 0);
    const text = Object.values(archive).map(value => strFromU8(value)).join('\n');
    assert.match(text, /HTTP 404/);
    assert.match(text, /unhandled-rejection/);
    assert.match(text, /SMOKE_REJECTION/);
    assert.match(text, /"status":404/);
    assert.match(text, /diagnostics-export-failed/);
    assert.doesNotMatch(text, /SMOKE_PRIVATE|SMOKE_QUERY|SMOKE_REJECTION_PRIVATE|local-access\.token|"cookie"|a{64}/);
    assert.ok(!Object.keys(archive).some(name => /about\.json|\.token|\.db/.test(name)));
    await page.locator('.diagnostic-actions').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshots, 'diagnostics-about-narrow.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('.diagnostic-actions').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshots, 'diagnostics-about-desktop.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    const foreignBlocked = await instance.evaluate(async ({ BrowserWindow }, preload) => {
      const foreign = new BrowserWindow({ show: false, webPreferences: { preload, contextIsolation: true, sandbox: false } });
      try {
        await foreign.loadURL('data:text/html,<h1>Isolated untrusted window</h1>');
        return await foreign.webContents.executeJavaScript(`window.listenMusic.exportDiagnostics({}).then(() => false, () => true)`);
      } finally { foreign.destroy(); }
    }, path.resolve(__dirname, '../out/preload/preload.js'));
    assert.equal(foreignBlocked, true);

    // Check actual CSS after reloading with each appearance, without touching any user profile.
    for (const theme of ['light', 'dark']) {
      for (const accent of ['#2dd4a7', '#8357f6', '#2868ed', '#16b88a', '#e91e4d', '#f59b0b', '#344156']) {
        await page.evaluate(({ theme, accent }) => {
          localStorage.removeItem('tiaolv-music-onboarding-version');
          localStorage.setItem('tiaolv-music-appearance-settings', JSON.stringify({ themeMode: theme, lightAccent: accent,
            darkAccent: accent, animationMode: 'reduced' }));
        }, { theme, accent });
        await page.reload();
        await page.locator('.first-run-onboarding').waitFor();
        await contrast(page, '.onboarding-density button.active, .onboarding-continue');
      }
    }
    console.log('Electron diagnostics smoke passed: real ZIP, cancel/failure/retry, trusted IPC, dark/light theme contrast and narrow layout.');
    console.log(`Isolated diagnostics: ${output}`);
  } finally { await instance.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
