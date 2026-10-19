const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { getEventListeners } = require('node:events');
const ts = require('../node_modules/typescript');

const sourceRoot = path.resolve(__dirname, '../src');
const drain = () => new Promise(resolve => setImmediate(resolve));
function within(promise) {
  let timer;
  return Promise.race([promise, new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Request did not settle after cancellation')), 100);
  })]).finally(() => clearTimeout(timer));
}

function harness(kind, fetch) {
  const timers = new Map();
  const diagnostics = [];
  let nextTimer = 0;
  const globals = {
    AbortController, AbortSignal, DOMException, Error, URL, URLSearchParams, performance, structuredClone,
    process: { platform: 'win32' }, fetch,
    window: { location: { search: '', protocol: 'file:' }, listenMusic: {
      reportDiagnostic(value) { diagnostics.push(value); }
    } },
    setTimeout(callback, milliseconds) { const id = ++nextTimer; timers.set(id, { callback, milliseconds }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  const context = vm.createContext(globals);
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const exports = {};
    modules.set(file, exports);
    const source = fs.readFileSync(file, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
    } }).outputText;
    const isEntry = file.endsWith(kind === 'renderer' ? '/api.ts' : '/preload.ts');
    const compiled = vm.runInContext(`(function(exports, require) { ${code}\n${isEntry ? `exports.performRequest = ${kind === 'renderer' ? 'performRequest' : 'request'};` : ''}\n})`, context);
    compiled(exports, specifier => {
      if (specifier === 'electron') return {
        contextBridge: { exposeInMainWorld() {} },
        ipcRenderer: { send(_channel, value) { diagnostics.push(value); } }
      };
      assert.ok(specifier.startsWith('.'), specifier);
      return load(path.resolve(path.dirname(file), `${specifier}.ts`).replaceAll('\\', '/'));
    });
    return exports;
  }
  const entry = path.join(sourceRoot, kind === 'renderer' ? 'renderer/src/services/api.ts' : 'preload/preload.ts').replaceAll('\\', '/');
  return { api: load(entry), timers, diagnostics,
    expire() { for (const timer of [...timers.values()]) timer.callback(); } };
}

for (const kind of ['renderer', 'preload']) {
  for (const status of [200, 503]) {
    test(`${kind} timeout stays active while a ${status} response body stalls`, async () => {
      let signal;
      const client = harness(kind, async (_url, init) => {
        signal = init.signal;
        return { ok: status === 200, status, json: () => new Promise(() => {}) };
      });
      const pending = client.api.performRequest('/catalog/search', undefined, 25);
      pending.catch(() => {});
      await drain();
      assert.equal(client.timers.size, 1, 'timeout must remain active after response headers');
      assert.equal([...client.timers.values()][0].milliseconds, 25);
      client.expire();
      await assert.rejects(within(pending), /请求超时/);
      assert.equal(signal.aborted, true);
      assert.equal(client.diagnostics.length, 1);
      assert.equal(client.diagnostics[0].status, status);
      assert.equal(client.diagnostics[0].message, 'Request timed out');
      assert.equal(client.timers.size, 0);
    });
  }

  test(`${kind} timeout also bounds a transport stalled before response headers`, async () => {
    let signal;
    const client = harness(kind, (_url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    });
    const pending = client.api.performRequest('/catalog/search', undefined, 25);
    pending.catch(() => {});
    client.expire();
    await assert.rejects(within(pending), /请求超时/);
    assert.equal(signal.aborted, true);
    assert.equal(client.diagnostics.length, 1);
    assert.equal(client.diagnostics[0].status, 0);
    assert.equal(client.timers.size, 0);
  });

  for (const status of [200, 503]) {
  test(`${kind} caller cancellation during ${status} JSON parsing aborts without failure diagnostics`, async () => {
    const caller = new AbortController();
    let signal;
    const client = harness(kind, async (_url, init) => {
      signal = init.signal;
      return { ok: status === 200, status, json: () => new Promise(() => {}) };
    });
    const pending = client.api.performRequest('/catalog/search', { signal: caller.signal }, 25);
    pending.catch(() => {});
    await drain();
    caller.abort();
    assert.equal(signal.aborted, true);
    await assert.rejects(within(pending), error => error.name === 'AbortError');
    assert.equal(client.diagnostics.length, 0);
    assert.equal(client.timers.size, 0);
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0);
  });
  }

  test(`${kind} keeps HTTP status and JSON message and cleans successful requests`, async () => {
    let status = 502;
    const client = harness(kind, async () => ({ ok: status === 200, status,
      json: async () => status === 200 ? { ok: true } : { message: 'Provider refused' } }));
    const failedCaller = new AbortController();
    await assert.rejects(client.api.performRequest('/catalog/search', { signal: failedCaller.signal }), error =>
      error.status === 502 && error.message === 'Provider refused');
    assert.equal(client.diagnostics.length, 1);
    assert.equal(client.diagnostics[0].status, 502);
    assert.equal(client.diagnostics[0].message, 'Provider refused');
    assert.equal(client.timers.size, 0);
    assert.equal(getEventListeners(failedCaller.signal, 'abort').length, 0);
    status = 200;
    const caller = new AbortController();
    assert.equal((await client.api.performRequest('/catalog/search', { signal: caller.signal })).ok, true);
    assert.equal(client.timers.size, 0);
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0);
    assert.equal(client.diagnostics.length, 1);
  });

  test(`${kind} malformed HTTP error bodies retain the response status`, async () => {
    const client = harness(kind, async () => ({ ok: false, status: 429,
      json: async () => { throw new SyntaxError('not JSON'); } }));
    await assert.rejects(client.api.performRequest('/catalog/search'), error =>
      error.status === 429 && error.message === 'Request failed: 429');
    assert.equal(client.diagnostics.length, 1);
    assert.equal(client.diagnostics[0].status, 429);
  });

  test(`${kind} rejects a caller already cancelled without starting fetch`, async () => {
    const caller = new AbortController();
    caller.abort();
    let calls = 0;
    const client = harness(kind, async () => { calls++; throw new Error('must not fetch'); });
    await assert.rejects(client.api.performRequest('/catalog/search', { signal: caller.signal }), error => error.name === 'AbortError');
    assert.equal(calls, 0);
    assert.equal(client.diagnostics.length, 0);
    assert.equal(client.timers.size, 0);
  });
}

test('current account absence keeps 204/404 semantics while existing account JSON is bounded', async () => {
  let status = 204;
  let bodyCalls = 0;
  const client = harness('renderer', async () => ({ ok: status < 400, status,
    json: () => { bodyCalls++; return new Promise(() => {}); } }));
  assert.equal(await client.api.loadCurrentAccount(), null);
  status = 404;
  assert.equal(await client.api.loadCurrentAccount(), null);
  assert.equal(bodyCalls, 0);
  assert.equal(client.diagnostics.length, 0);
  status = 200;
  const pending = client.api.loadCurrentAccount();
  pending.catch(() => {});
  await drain();
  assert.equal(client.timers.size, 1);
  client.expire();
  await assert.rejects(within(pending), /请求超时/);
  assert.equal(client.timers.size, 0);
});
