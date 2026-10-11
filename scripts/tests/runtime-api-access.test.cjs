const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

let access = {};
try {
  access = require('../runtime-local-access.cjs');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

async function fixture(t, tokenExists = true) {
  assert.equal(typeof access.protectApiServer, 'function', 'upstream API boundary must exist');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-api-access-'));
  const tokenFile = path.join(directory, 'local-access.token');
  const token = 'a'.repeat(64);
  if (tokenExists) fs.writeFileSync(tokenFile, token);
  let calls = 0;
  const server = http.createServer((_request, response) => {
    calls += 1;
    response.end('provider handler');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  access.protectApiServer(server, port, { tokenFile });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const request = (url, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: url, headers, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
  return { request, token, tokenFile, calls: () => calls };
}

test('readiness is public and contains no provider documentation or data', async (t) => {
  const api = await fixture(t, false);
  assert.deepEqual(await api.request('/'), { status: 200, body: '{"ok":true}' });
  assert.equal(api.calls(), 0);
});

test('data routes fail closed until the backend creates the private token', async (t) => {
  const api = await fixture(t, false);
  assert.equal((await api.request('/api/data')).status, 401);
  assert.equal((await api.request('/api/data', { 'X-Tiaolv-Token': api.token })).status, 401);
  fs.writeFileSync(api.tokenFile, api.token);
  assert.deepEqual(await api.request('/api/data', { 'X-Tiaolv-Token': api.token }), { status: 200, body: 'provider handler' });
  assert.equal(api.calls(), 1);
});

test('rejects absent and incorrect tokens before provider handlers', async (t) => {
  const api = await fixture(t);
  for (const value of [undefined, 'b'.repeat(64), 'short', `${api.token}, ${api.token}`]) {
    const headers = value === undefined ? {} : { 'X-Tiaolv-Token': value };
    assert.equal((await api.request('/api/data', headers)).status, 401);
  }
  assert.equal(api.calls(), 0);
});

test('denies browser origins, hostile Host and OPTIONS even with a token', async (t) => {
  const api = await fixture(t);
  for (const extra of [{ Origin: 'http://localhost:5173' }, { Origin: 'null' }, { Origin: '' }, { Host: 'evil.example' }, { Host: '127.0.0.1:1' }]) {
    assert.equal((await api.request('/api/data', { 'X-Tiaolv-Token': api.token, ...extra })).status, 403);
  }
  assert.equal((await api.request('/api/data', { 'X-Tiaolv-Token': api.token }, 'OPTIONS')).status, 403);
  assert.equal((await api.request('/', { Origin: 'https://evil.example' })).status, 403);
  assert.equal(api.calls(), 0);
});

test('protects POST / and non-health paths with the same token requirement', async (t) => {
  const api = await fixture(t);
  assert.equal((await api.request('/', {}, 'POST')).status, 401);
  assert.equal((await api.request('/?data=1')).status, 401);
  assert.equal((await api.request('/', { 'X-Tiaolv-Token': api.token }, 'POST')).status, 200);
  assert.equal(api.calls(), 1);
});
