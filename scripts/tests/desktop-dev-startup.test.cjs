const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '../../electron/scripts/dev.cjs');
const localRequire = createRequire(scriptPath);
const exported = { exports: {} };
let launches = 0;
function requireWithoutLaunch(id) {
  if (id === 'node:child_process') return { spawn() { launches += 1; return new EventEmitter(); } };
  return localRequire(id);
}
const load = vm.runInThisContext(
  `(function(require, module, exports, __dirname) {\n${fs.readFileSync(scriptPath, 'utf8')}\n})`,
  { filename: scriptPath },
);
load(requireWithoutLaunch, exported, exported.exports, path.dirname(scriptPath));

function startRendererServer(...args) {
  assert.equal(typeof exported.exports.startRendererServer, 'function', 'Renderer startup must expose its port-selection boundary');
  return exported.exports.startRendererServer(...args);
}

test('importing the development launcher does not build or launch Electron', () => {
  assert.equal(launches, 0);
});

test('an occupied preferred port can fall back without changing the existing service', async () => {
  let options;
  const server = {
    httpServer: { address: () => ({ address: '127.0.0.1', port: 5174 }) },
    async listen() {
      assert.equal(options.server.strictPort, false, 'Vite must be allowed to choose another free port');
    },
    printUrls() {},
    async close() {},
  };
  const result = await startRendererServer(async config => { options = config; return server; }, () => ({ name: 'vue-fixture' }));
  assert.equal(options.server.host, '127.0.0.1');
  assert.equal(options.server.port, 5173);
  assert.equal(result.server, server);
  assert.equal(result.rendererUrl, 'http://127.0.0.1:5174');
});

test('an available preferred port keeps the usual renderer address', async () => {
  const server = {
    httpServer: { address: () => ({ address: '127.0.0.1', port: 5173 }) },
    async listen() {},
    printUrls() {},
    async close() {},
  };
  const result = await startRendererServer(async () => server, () => ({}));
  assert.equal(result.rendererUrl, 'http://127.0.0.1:5173');
});

test('a failed Vite startup closes the partially created server', async () => {
  const error = new Error('Cannot listen');
  let closed = false;
  const server = { async listen() { throw error; }, async close() { closed = true; } };
  await assert.rejects(() => startRendererServer(async () => server, () => ({})), value => value === error);
  assert.equal(closed, true);
});
