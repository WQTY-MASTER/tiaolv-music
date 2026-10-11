const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const serverPath = path.resolve(__dirname, '../../music-api/api-enhanced/server.js');
const source = fs.readFileSync(serverPath, 'utf8');
const localRequire = createRequire(serverPath);

function fixture(exec) {
  const exported = { exports: {} };
  const warnings = [];
  const express = localRequire('express');
  const cache = localRequire('./util/apicache').newInstance();
  const context = {
    module: exported,
    exports: exported.exports,
    __dirname: path.dirname(serverPath),
    process: { env: {}, stdout: { isTTY: false } },
    console: { log() {} },
    setInterval,
    clearInterval,
    require(id) {
      if (id === 'dotenv') return { config() {} };
      if (id === 'child_process') return { exec };
      if (id === './util/request') return () => { throw new Error('Unexpected provider request'); };
      if (id === './util/apicache') return { middleware: cache.middleware };
      if (id === './util/index') return { cookieToJson() {} };
      if (id === './util/logger.js') return { info() {}, error() {}, warn: message => warnings.push(message) };
      // Bind only an ephemeral loopback port, never the user's API port.
      if (id === 'express') return Object.assign(() => {
        const app = express();
        const listen = app.listen.bind(app);
        app.listen = (_port, _host, callback) => listen(0, '127.0.0.1', callback);
        return app;
      }, express);
      return localRequire(id);
    },
  };
  const load = vm.runInThisContext(
    `(function(require, module, exports, __dirname, process, console) {\n${source}\n})`,
    { filename: serverPath },
  );
  load(context.require, context.module, context.exports, context.__dirname, context.process, context.console);
  return {
    serve: exported.exports.serveNcmApi,
    warnings,
    dispose() {
      for (const key of [...cache.getIndex().all]) cache.clear(key);
    },
  };
}

async function start(t, api, checkVersion = true) {
  let server;
  t.after(async () => {
    api.dispose();
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const submission = api.serve({
    checkVersion,
    moduleDefs: [{ route: '/startup-probe', module: async () => ({ status: 200, body: { ready: true } }) }],
  }).then(app => {
    server = app.server;
    return app;
  });
  let timer;
  try {
    const result = await Promise.race([
      submission,
      new Promise(resolve => { timer = setTimeout(() => resolve(null), 300); }),
    ]);
    assert.ok(result, 'API startup must not wait for the optional npm version query');
    if (!server.listening) await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    return server;
  } finally {
    clearTimeout(timer);
  }
}

test('API serves requests while the npm version query never completes', async t => {
  const api = fixture(() => {});
  const server = await start(t, api);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/startup-probe`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ready: true });
});

test('version query has a bounded timeout and hides its Windows window', async t => {
  let options;
  const api = fixture((_command, suppliedOptions) => { options = suppliedOptions; });
  await start(t, api);
  assert.equal(options.windowsHide, true);
  assert.ok(options.timeout > 0 && options.timeout <= 5000);
});

test('npm failure does not prevent API startup', async t => {
  const api = fixture((_command, options, callback) => {
    const done = typeof options === 'function' ? options : callback;
    done(new Error('Registry unreachable'));
  });
  await start(t, api);
});

test('a synchronous version-query error does not prevent API startup', async t => {
  const api = fixture(() => { throw new Error('Cannot launch npm'); });
  await start(t, api);
});

test('disabled version checks do not launch npm', async t => {
  let calls = 0;
  const api = fixture(() => { calls += 1; });
  await start(t, api, false);
  assert.equal(calls, 0);
});

test('background version checks still report a newer version', async t => {
  let complete;
  const api = fixture((_command, options, callback) => { complete = typeof options === 'function' ? options : callback; });
  await start(t, api);
  complete(null, '99.0.0\n');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(api.warnings.length, 1);
  assert.match(api.warnings[0], /99\.0\.0/);
});
