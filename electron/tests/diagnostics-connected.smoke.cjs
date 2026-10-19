const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { unzipSync, strFromU8 } = require('fflate');

async function main() {
  const backend = { ok: true, backendVersion: '0.1.0', springBootVersion: '3.5.4', javaVersion: '21.0.8',
    database: { product: 'SQLite', version: '3.49.1' } };
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    response.end(JSON.stringify(backend));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = path.resolve(__dirname, '../.test-tmp');
  fs.mkdirSync(root, { recursive: true });
  const data = fs.mkdtempSync(path.join(root, 'diagnostics-connected-'));
  const tokenFile = path.join(data, 'local-access.token');
  fs.writeFileSync(tokenFile, 'a'.repeat(64));
  fs.writeFileSync(path.join(data, 'about.json'), JSON.stringify({ autoCheckUpdates: false }));
  const env = { ...process.env, SHORTCUT_SMOKE_DATA: data, LOCALAPPDATA: data,
    DIAGNOSTICS_SMOKE_HEALTH_PORT: String(server.address().port),
    LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: tokenFile };
  if (process.argv[2]) env.SHORTCUT_SMOKE_MAIN_FILE = path.resolve(process.argv[2]);
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  let instance;
  try {
    instance = await _electron.launch({ executablePath: require('electron'),
      args: [path.join(__dirname, 'helpers/shortcut-smoke-main.cjs')], env, timeout: 25000 });
    const page = await instance.firstWindow();
    page.setDefaultTimeout(10000);
    await page.locator('.first-run-onboarding').waitFor();
    await page.getByRole('button', { name: '跳过引导', exact: true }).click();
    await page.locator('.first-run-onboarding').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '关于', exact: true }).click();
    await page.locator('.diagnostic-grid').getByText('SQLite 3.49.1', { exact: true }).waitFor();
    const file = path.join(data, 'connected-diagnostics.zip');
    await instance.evaluate(({ dialog }, file) => {
      global.diagnosticDialogCount = 0;
      dialog.showSaveDialog = async () => {
        global.diagnosticDialogCount += 1;
        return { canceled: false, filePath: file };
      };
    }, file);
    await page.getByRole('button', { name: '导出诊断包', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('诊断包已导出。')
      || document.body.textContent.includes('诊断包导出失败'));
    const dialogCount = await instance.evaluate(() => global.diagnosticDialogCount);
    if (dialogCount === 0) {
      const control = await page.evaluate(async backend => {
        const plain = await window.listenMusic.exportDiagnostics({ backend });
        let proxy;
        try { await window.listenMusic.exportDiagnostics({ backend: new Proxy(backend, {}) }); proxy = 'no error'; }
        catch (error) { proxy = `${error.name}: ${error.message}`; }
        return { plain: plain.status, proxy };
      }, backend);
      console.log('Connected export bridge controls:', control);
    }
    assert.equal(dialogCount, 1,
      'Connected backend state must reach IPC and open the save dialog');
    await page.getByText('诊断包已导出。', { exact: true }).waitFor();
    const archive = unzipSync(fs.readFileSync(file));
    const info = JSON.parse(strFromU8(archive['diagnostics.json']));
    assert.equal(info.backend.ok, true);
    assert.equal(info.backend.database.product, 'SQLite');
    const text = Object.values(archive).map(value => strFromU8(value)).join('\n');
    assert.doesNotMatch(text, /a{64}|local-access\.token/);
    console.log('Connected backend UI exported a real, readable, redacted diagnostics ZIP:', file);
  } finally { if (instance) await instance.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
