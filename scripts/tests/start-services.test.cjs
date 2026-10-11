const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');

let services = {};
let development = {};
try { services = require('../start-services.cjs'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
if (fs.readFileSync(path.join(__dirname, '../dev.cjs'), 'utf8').includes('module.exports =')) {
  development = require('../dev.cjs');
}
const token = 'a'.repeat(64);
const options = { tokenFile: 'private-token-file', resourcesDirectory: 'staged-runtime' };

function dependencies(change = {}) {
  return {
    isPortAvailable: async () => false,
    readToken: async () => token,
    request: async (url, headers = {}) => {
      const parsed = new URL(url);
      if (parsed.pathname === '/' || parsed.pathname === '/health') return { status: 200, contentType: 'application/json', body: { ok: true } };
      if (headers.Origin) return { status: 403 };
      if (!headers['X-Tiaolv-Token']) return { status: 401 };
      return { status: parsed.port === '17890' ? 200 : 404 };
    },
    validateResources: async () => undefined,
    ...change
  };
}

test('service options use staged resources, real user home and app-data runtime paths', () => {
  assert.equal(typeof services.createServiceOptions, 'function');
  const result = services.createServiceOptions({ root: 'G:/project', homeDirectory: 'C:/user', appDataDirectory: 'C:/user/AppData/Roaming', nodeExecutable: 'C:/electron.exe' });
  assert.equal(result.resourcesDirectory, path.resolve('G:/project/electron/resources/runtime'));
  assert.equal(result.tokenFile, path.join('C:/user', '.tiaolv-music', 'local-access.token'));
  assert.equal(result.dataDirectory, path.join('C:/user/AppData/Roaming', '\u8c03\u5f8b\u97f3\u4e50', 'runtime'));
  assert.equal(result.javaHomeDirectory, undefined);
  assert.equal(result.nodeExecutable, 'C:/electron.exe');
});

test('all missing services start one owned runtime and cleanup is awaited', async () => {
  assert.equal(typeof services.ensureServices, 'function');
  const events = [];
  const result = await services.ensureServices(options, dependencies({
    isPortAvailable: async () => true,
    createRuntime: async received => {
      assert.equal(received.tokenFile, options.tokenFile);
      return { start: async () => events.push('start'), stop: async () => events.push('stop') };
    }
  }));
  assert.equal(result.reused, false);
  assert.deepEqual(events, ['start']);
  await result.stop();
  assert.deepEqual(events, ['start', 'stop']);
});

test('partial port occupation fails without starting or stopping any service', async () => {
  assert.equal(typeof services.ensureServices, 'function');
  let creations = 0;
  await assert.rejects(services.ensureServices(options, dependencies({
    isPortAvailable: async port => port !== 3000,
    createRuntime: async () => { creations++; }
  })), /partially occupied.*3000/i);
  assert.equal(creations, 0);
});

test('all ready protected services are reused and never receive owned cleanup', async () => {
  assert.equal(typeof services.ensureServices, 'function');
  let creations = 0;
  const result = await services.ensureServices(options, dependencies({ createRuntime: async () => { creations++; } }));
  assert.equal(result.reused, true);
  await result.stop();
  assert.equal(creations, 0);
});

test('unprotected API root HTML cannot be reused', async () => {
  assert.equal(typeof services.inspectServices, 'function');
  const deps = dependencies();
  const request = deps.request;
  deps.request = async (url, headers) => url === 'http://127.0.0.1:3300/'
    ? { status: 200, contentType: 'text/html', body: '<html>old API</html>' }
    : request(url, headers);
  await assert.rejects(services.inspectServices(options, deps), /3300.*protected/i);
});

test('missing, malformed or incorrect private tokens prevent reuse without exposing token content', async () => {
  assert.equal(typeof services.inspectServices, 'function');
  for (const readToken of [async () => { throw new Error('secret read failure'); }, async () => 'private-malformed']) {
    await assert.rejects(services.inspectServices(options, dependencies({ readToken })), error => /token/i.test(error.message) && !/secret|private-malformed/.test(error.message));
  }
  const deps = dependencies();
  const request = deps.request;
  deps.request = async (url, headers) => headers?.['X-Tiaolv-Token'] && !headers.Origin ? { status: 401 } : request(url, headers);
  await assert.rejects(services.inspectServices(options, deps), /protected|authentication/i);
});

test('service reuse requires denied unauthenticated and hostile-origin requests', async () => {
  assert.equal(typeof services.inspectServices, 'function');
  for (const unsafe of ['unauthenticated', 'origin']) {
    const deps = dependencies();
    const request = deps.request;
    deps.request = async (url, headers = {}) => new URL(url).pathname === '/'
      ? request(url, headers)
      : (unsafe === 'origin' && headers.Origin) || (unsafe === 'unauthenticated' && !headers['X-Tiaolv-Token'])
        ? { status: 200 }
        : request(url, headers);
    await assert.rejects(services.inspectServices(options, deps), /protected/i);
  }
});

test('development startup keeps Electron CLI pattern and cleans only owned service runtime on exit', async () => {
  assert.equal(typeof development.runDevelopment, 'function');
  const electron = new EventEmitter();
  const events = [];
  const running = development.runDevelopment({
    ensureServices: async () => ({ reused: false, stop: async () => events.push('services stopped') }),
    command(name, args) {
      assert.equal(name, 'npm');
      assert.deepEqual(args, ['--prefix', 'electron', 'run', 'dev']);
      events.push('electron started');
      return electron;
    },
    stopChild: async () => events.push('electron stopped'),
    signals: new EventEmitter()
  });
  await new Promise(resolve => setImmediate(resolve));
  electron.emit('exit', 0);
  assert.equal(await running, 0);
  assert.deepEqual(events, ['electron started', 'services stopped']);
});

test('development signal shutdown awaits owned cleanup and leaves reused services alone', async () => {
  assert.equal(typeof development.runDevelopment, 'function');
  const signals = new EventEmitter();
  const electron = new EventEmitter();
  const events = [];
  const running = development.runDevelopment({
    ensureServices: async () => ({ reused: true, stop: async () => undefined }),
    command: () => electron,
    stopChild: async () => events.push('electron stopped'),
    signals
  });
  await new Promise(resolve => setImmediate(resolve));
  signals.emit('SIGINT');
  assert.equal(await running, 0);
  assert.deepEqual(events, ['electron stopped']);
  assert.equal(signals.listenerCount('SIGINT'), 0);
});

test('startup failure awaits owned rollback and reports the original safe failure', async () => {
  let stopped = false;
  await assert.rejects(services.ensureServices(options, dependencies({
    isPortAvailable: async () => true,
    createRuntime: async () => ({ start: async () => { throw new Error('backend failed'); }, stop: async () => { stopped = true; } })
  })), /backend failed/);
  assert.equal(stopped, true);
});

test('supported Node versions and CLI arguments are checked before service startup', async () => {
  for (const version of ['22.18.0', '22.21.0', '24.0.0', '26.0.0']) services.assertNodeVersion(version);
  for (const version of ['20.19.0', '22.17.0', '23.1.0']) assert.throws(() => services.assertNodeVersion(version), /22\.18/);
  await assert.rejects(services.main(['--remote', 'https://example.com']), /Usage/);
});

test('development failure after service startup performs owned rollback', async () => {
  let stopped = false;
  await assert.rejects(development.runDevelopment({
    ensureServices: async () => ({ stop: async () => { stopped = true; } }),
    command: () => { throw new Error('launcher failure'); },
    signals: new EventEmitter()
  }), /launcher failure/);
  assert.equal(stopped, true);
});
