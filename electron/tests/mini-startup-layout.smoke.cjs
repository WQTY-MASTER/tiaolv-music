const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { dismissFirstRunOnboarding } = require('./helpers/onboarding-smoke.cjs');

async function main() {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-mini-startup-'));
  const token = path.join(data, 'local-access.token');
  fs.writeFileSync(token, 'a'.repeat(64));
  fs.writeFileSync(path.join(data, 'shortcuts.json'), JSON.stringify({ enabled: false }));
  const env = { ...process.env, SHORTCUT_SMOKE_DATA: data, MINI_SMOKE_HOLD_READY: '1', LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: token,
    LOCALAPPDATA: data, APPDATA: data, HOME: data, USERPROFILE: data };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  let app;
  const failures = [];
  const check = (name, run) => { try { run(); } catch (error) { failures.push(`${name}: ${error.message}`); } };
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, 'helpers/shortcut-smoke-main.cjs')], env });
    const page = await app.firstWindow();
    await dismissFirstRunOnboarding(page);
    const mainId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id);
    const opening = app.waitForEvent('window');
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.send('tray-media-action', 'mini-player'), mainId);
    const mini = await opening;
    await mini.locator('.mini-player').waitFor();
    await mini.waitForTimeout(100);
    const pending = await app.evaluate(({ BrowserWindow }, id) => ({
      mainVisible: BrowserWindow.fromId(id).isVisible(), miniVisible: BrowserWindow.getAllWindows().find(win => win.id !== id).isVisible(),
      readyCount: global.miniSmokeReadiness.length
    }), mainId);
    check('hidden preparation', () => {
      assert.equal(pending.readyCount, 1);
      assert.equal(pending.mainVisible, true);
      assert.equal(pending.miniVisible, false);
    });
    const shellDisplay = await page.locator('.app-shell').evaluate(el => getComputedStyle(el).display);
    check('main content remains visible while preparing', () => assert.notEqual(shellDisplay, 'none'));
    await app.evaluate(() => global.miniSmokeReadiness.splice(0).forEach(release => release()));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.app-shell')).display === 'none');
    const miniId = await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows().find(win => win.id !== id).id, mainId);
    for (const [width, height] of [[340, 168], [720, 320], [412, 220]]) {
      await app.evaluate(({ BrowserWindow }, { id, width, height }) => BrowserWindow.fromId(id).setBounds({ width, height }), { id: miniId, width, height });
      await mini.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height, { width, height });
      await mini.locator('.mini-player').hover();
      await mini.waitForTimeout(320);
      const layout = await mini.evaluate(() => {
        const card = document.querySelector('.mini-player').getBoundingClientRect();
        const controls = document.querySelector('.mini-controls').getBoundingClientRect();
        return { card: { left: card.left, top: card.top, width: card.width, height: card.height }, width: innerWidth, height: innerHeight,
          center: (controls.left + controls.right) / 2,
          backgrounds: [document.documentElement, document.body, document.querySelector('#app')].map(el => getComputedStyle(el).backgroundColor) };
      });
      check(`transparent roots and full card ${width}`, () => {
        assert.deepEqual(layout.backgrounds, ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
        assert.deepEqual(layout.card, { left: 0, top: 0, width: layout.width, height: layout.height });
      });
      check(`toolbar centered ${width}`, () => assert.ok(Math.abs(layout.center - width / 2) < 1, `center ${layout.center} should be ${width / 2}`));
    }
    await mini.getByRole('button', { name: '返回完整播放器', exact: true }).click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.app-shell')).display !== 'none');
    await page.evaluate(() => {
      const shell = document.querySelector('.app-shell');
      const scope = shell.getAttributeNames().find(name => name.startsWith('data-v-'));
      const container = document.createElement('div');
      container.className = 'song-detail-lyrics-list';
      container.style.cssText = 'position:fixed;top:200px;left:500px;width:400px;z-index:999999';
      for (const [index, text] of ['月高高 月遥遥', '谁把人间偷瞧', '灯火摇 岁月好'].entries()) {
        const line = document.createElement('p');
        line.className = `lyric-line${index === 1 ? ' is-active' : ''}`;
        const content = document.createElement('span'); content.className = 'lyric-line-content';
        const original = document.createElement('span'); original.className = 'lyric-original'; original.textContent = text;
        for (const el of [line, content, original]) el.setAttribute(scope, '');
        content.append(original); line.append(content); container.append(line);
      }
      container.setAttribute(scope, ''); shell.append(container);
      for (const line of container.children) line.style.setProperty('--lyric-scale-room', `${line.querySelector('.lyric-original').offsetHeight * .125}px`);
    });
    await page.waitForTimeout(350);
    const rows = await page.locator('.lyric-line').evaluateAll(lines => lines.map(el => {
      const r = el.querySelector('.lyric-original').getBoundingClientRect(), css = getComputedStyle(el);
      return { top: r.top, bottom: r.bottom, padding: parseFloat(css.paddingTop) + parseFloat(css.paddingBottom) };
    }));
    check('compact untranslated lyrics without overlap', () => {
      assert.equal(rows.length, 3);
      assert.ok(rows.every(row => row.padding <= 4), `excess padding ${rows.map(row => row.padding)}`);
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i].top >= rows[i - 1].bottom, 'Active scaling must not overlap adjacent lyrics');
    });
    assert.deepEqual(failures, []);
    console.log('Mini startup/layout passed: hidden prepared renderer, visible main while waiting, transparent full-size roots/card, centered controls, compact untranslated lyrics without overlap');
  } finally {
    if (app) await app.close();
    assert.equal(path.dirname(fs.realpathSync(data)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(data).startsWith('tiaolv-mini-startup-'));
    fs.rmSync(data, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
