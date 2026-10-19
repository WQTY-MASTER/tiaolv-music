const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const lists = Object.fromEntries(['netease', 'qq'].map(provider => [provider, [{
    id: `${provider}:900`, title: `${provider} initial`, count: 0, createdByAccount: true, deletable: true
  }]]));
  const writes = [];
  let nextId = 901;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const endpoint = decodeURIComponent(url.pathname);
    const provider = endpoint.split('/')[2];
    let body = '';
    for await (const chunk of request) body += chunk;
    let result = [];
    if (request.method !== 'GET') writes.push({ endpoint, method: request.method, body });
    if (endpoint === '/health') result = { ok: true };
    else if (endpoint === '/auth/accounts') result = ['netease', 'qq'].map(provider => ({ provider, userId: '100', nickname: 'Fixture' }));
    else if (endpoint === `/account/${provider}/playlists`) {
      if (request.method === 'POST') {
        result = { id: `${provider}:${nextId++}`, title: JSON.parse(body).name, count: 0, createdByAccount: true, deletable: true };
        lists[provider].push(result);
      } else result = lists[provider];
    } else if (/^\/account\/(netease|qq)\/playlists\/[^/]+$/.test(endpoint) && request.method === 'DELETE') {
      lists[provider] = lists[provider].filter(item => item.id !== endpoint.split('/')[4]);
      result = { ok: true };
    } else if (endpoint.endsWith('/profile')) result = { provider, userId: '100', nickname: 'Fixture', follows: 0, followers: 0 };
    response.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    response.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const data = fs.mkdtempSync(path.resolve(__dirname, '../.test-tmp/playlist-input-'));
  const tokenFile = path.join(data, 'local-access.token');
  fs.writeFileSync(tokenFile, 'a'.repeat(64));
  fs.writeFileSync(path.join(data, 'about.json'), JSON.stringify({ autoCheckUpdates: false }));
  const env = { ...process.env, SHORTCUT_SMOKE_DATA: data, LOCALAPPDATA: data,
    PLAYLIST_SMOKE_BACKEND_PORT: String(server.address().port), LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: tokenFile };
  if (process.argv[2]) env.SHORTCUT_SMOKE_MAIN_FILE = path.resolve(process.argv[2]);
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  let instance;
  try {
    instance = await _electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, 'helpers/shortcut-smoke-main.cjs')], env, timeout: 25000 });
    const page = await instance.firstWindow();
    page.setDefaultTimeout(10000);
    await page.locator('.first-run-onboarding').waitFor();
    await page.getByRole('button', { name: '跳过引导', exact: true }).click();
    await page.locator('.first-run-onboarding').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      window.confirm = () => { throw new Error('Native confirmation must not be used'); };
    });
    await page.getByRole('radio', { name: '切换到流媒体模式', exact: true }).click();
    await page.getByRole('button', { name: '音乐库', exact: true }).click();
    await page.locator('.library-source-trigger').waitFor();
    for (const provider of ['netease', 'qq']) {
      await page.locator('.library-source-trigger').click();
      await page.locator('.library-source-menu').getByRole('button', { name: new RegExp(provider === 'qq' ? 'QQ 音乐' : '网易云音乐') }).click();
      await page.locator('.account-playlist-item').filter({ hasText: `${provider} initial` }).waitFor();
      for (let cycle = 1; cycle <= 2; cycle += 1) {
        const currentName = cycle === 1 ? `${provider} initial` : `${provider} recreate ${cycle - 1}`;
        const item = page.locator('.account-playlist-item').filter({ hasText: currentName });
        await item.click({ button: 'right' });
        await page.getByRole('menuitem', { name: '删除歌单', exact: true }).click();
        await page.getByRole('dialog', { name: '删除歌单', exact: true }).getByRole('button', { name: '删除', exact: true }).click();
        await item.waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: '创建歌单', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: '创建歌单', exact: true });
        await dialog.waitFor();
        await page.waitForFunction(() => document.activeElement?.getAttribute('placeholder') === '请输入歌单名称');
        const name = `${provider} recreate ${cycle}`;
        await page.keyboard.type(name);
        assert.equal(await dialog.getByPlaceholder('请输入歌单名称').inputValue(), name);
        await page.keyboard.press('Enter');
        await dialog.waitFor({ state: 'hidden' });
        await page.locator('.account-playlist-item').filter({ hasText: name }).waitFor();
      }
    }
    assert.equal(writes.filter(item => item.method === 'DELETE').length, 4);
    assert.equal(writes.filter(item => item.method === 'POST' && item.endpoint.endsWith('/playlists')).length, 4);
    await page.screenshot({ path: path.resolve(__dirname, '../.playwright-cli/playlist-input-native.png') });
    console.log('Packaged Electron UI: both providers passed two delete -> keyboard type -> create cycles (isolated fixtures only)');
  } catch (error) {
    if (instance) {
      const page = await instance.firstWindow();
      await page.screenshot({ path: path.resolve(__dirname, '../.playwright-cli/playlist-input-native-failure.png') }).catch(() => {});
      console.error(await page.locator('body').innerText().catch(() => 'No renderer text'));
    }
    throw error;
  } finally {
    if (instance) await instance.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
