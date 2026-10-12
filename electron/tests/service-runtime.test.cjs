const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { pathToFileURL } = require('node:url');

const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/main/serviceRuntime.ts'));
const manifest = () => ({
  schemaVersion: 1,
  javaExecutable: 'java/bin/java.exe',
  services: [
    { id: 'backend', kind: 'java', entry: 'backend/app.jar', cwd: 'backend', port: 17890, healthPath: '/health' },
    { id: 'netease', kind: 'node', entry: 'netease/launch.cjs', cwd: 'netease', port: 3000, healthPath: '/' },
    { id: 'qq', kind: 'node', entry: 'qq/launch.cjs', cwd: 'qq', port: 3300, healthPath: '/' }
  ]
});

async function fixture(t, overrides = {}) {
  const { createServiceRuntime } = await import(moduleUrl);
  const root = await fs.mkdtemp(path.join(__dirname, '../.tmp-service-runtime-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const resourcesDirectory = path.join(root, 'resources');
  const value = manifest();
  for (const file of [value.javaExecutable, ...value.services.map(service => service.entry)]) {
    const target = path.join(resourcesDirectory, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, 'fixture');
  }
  await fs.writeFile(path.join(resourcesDirectory, 'manifest.json'), JSON.stringify(value));
  const spawned = [];
  const logs = [];
  let clock = 0;
  const dependencies = {
    spawn(command, args, options) {
      const child = new EventEmitter();
      child.pid = 100 + spawned.length;
      child.exitCode = null;
      child.signalCode = null;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kills = [];
      child.kill = signal => {
        child.kills.push(signal);
        child.signalCode = signal;
        child.emit('exit', null, signal);
        return true;
      };
      spawned.push({ command, args, options, child });
      return child;
    },
    isPortAvailable: async () => true,
    isHealthy: async () => true,
    now: () => clock,
    sleep: async ms => { clock += ms; },
    appendLog: async (file, text) => logs.push({ file, text }),
    ...overrides
  };
  const options = {
    resourcesDirectory,
    nodeExecutable: path.join(root, 'desktop.exe'),
    dataDirectory: path.join(root, 'user-data', 'runtime'),
    logDirectory: path.join(root, 'user-data', 'logs'),
    tokenFile: path.join(root, 'user-data', 'local-access.token'),
    javaTemporaryDirectory: path.join(root, 'jtmp'),
    startupTimeoutMs: 20,
    pollIntervalMs: 5,
    stopTimeoutMs: 10,
    environment: { PATH: 'safe-path', NETEASE_COOKIE: 'private-cookie', NODE_OPTIONS: '--require malicious', JAVA_TOOL_OPTIONS: '-Dsecret=private' },
    dependencies
  };
  const runtime = createServiceRuntime(options);
  return { root, runtime, options, spawned, logs, dependencies, value, resourcesDirectory };
}

test('Java uses its explicit short temporary directory while API state stays in user data', async t => {
  const f = await fixture(t);
  await f.runtime.start();
  const java = f.spawned.find(item => item.args.includes('-jar'));
  assert.equal(java.options.env.TEMP, f.options.javaTemporaryDirectory);
  assert.equal(java.options.env.TMP, f.options.javaTemporaryDirectory);
  assert.equal(java.options.env.TMPDIR, f.options.javaTemporaryDirectory);
  assert.ok(java.args.includes(`-Djava.io.tmpdir=${f.options.javaTemporaryDirectory}`));
  assert.ok(!java.args.some(arg => arg.includes('preferIPv4Stack')));
  assert.ok(f.spawned.filter(item => !item.args.includes('-jar'))
    .every(item => item.options.env.TEMP.startsWith(f.options.dataDirectory)));
  await f.runtime.stop();
});

test('starts APIs before backend, waits readiness, and confines writable state to user data', async t => {
  const checks = [];
  const f = await fixture(t, { isHealthy: async url => { checks.push(url); return true; } });
  await f.runtime.start();
  assert.deepEqual(f.spawned.map(item => item.args.includes('-jar') ? 'backend' : path.basename(item.args[0])), ['launch.cjs', 'launch.cjs', 'backend']);
  assert.deepEqual(checks, ['http://127.0.0.1:3000/', 'http://127.0.0.1:3300/', 'http://127.0.0.1:17890/health']);
  for (const item of f.spawned) {
    assert.equal(item.options.windowsHide, true);
    assert.equal(item.options.shell, false);
    assert.deepEqual(item.options.stdio, ['ignore', 'ignore', 'ignore']);
    assert.equal(item.options.env.HOST, '127.0.0.1');
    assert.equal(item.options.env.LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE, f.options.tokenFile);
    assert.equal(item.options.env.NETEASE_COOKIE, undefined);
    assert.equal(item.options.env.NODE_OPTIONS, undefined);
    assert.equal(item.options.env.JAVA_TOOL_OPTIONS, undefined);
    assert.ok(item.options.cwd.startsWith(f.options.dataDirectory));
    assert.ok(item.options.env.TEMP.startsWith(f.options.dataDirectory)
      || item.options.env.TEMP === f.options.javaTemporaryDirectory);
  }
  assert.equal(f.spawned[0].command, f.options.nodeExecutable);
  assert.equal(f.spawned[0].options.env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(f.spawned[1].options.env.QQ_MUSIC_API_CONFIG_DIR, path.join(f.options.dataDirectory, 'qq', 'config'));
  assert.equal(f.spawned[2].command, path.join(f.resourcesDirectory, 'java', 'bin', 'java.exe'));
  assert.ok(f.spawned[2].args.includes('--server.address=127.0.0.1'));
  assert.equal(f.spawned[2].options.env.LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE, f.options.tokenFile);
  await f.runtime.stop();
  assert.ok(f.spawned.every(item => item.child.kills.length === 1));
});

test('rejects occupied ports before spawning and does not kill foreign listeners', async t => {
  const ports = [];
  const f = await fixture(t, { isPortAvailable: async port => { ports.push(port); return port !== 17890; } });
  await assert.rejects(f.runtime.start(), /17890.*in use/);
  assert.equal(f.spawned.length, 0);
  assert.ok(ports.includes(17890));
  await f.runtime.stop();
});

test('readiness timeout rolls back only owned processes and names the failed service', async t => {
  const f = await fixture(t, { isHealthy: async url => !url.includes('3300') });
  await assert.rejects(f.runtime.start(), /qq.*timed out/);
  assert.equal(f.spawned.length, 2);
  assert.ok(f.spawned.every(item => item.child.kills.length === 1));
});

test('asynchronous spawn errors roll back prior services without exposing error content', async t => {
  const f = await fixture(t);
  const spawn = f.dependencies.spawn;
  f.dependencies.spawn = (...args) => {
    const child = spawn(...args);
    if (f.spawned.length === 2) queueMicrotask(() => child.emit('error', new Error('cookie=secret-value')));
    return child;
  };
  await assert.rejects(f.runtime.start(), error => /qq.*failed/.test(error.message) && !error.message.includes('secret-value'));
  assert.equal(f.spawned[0].child.kills.length, 1);
  assert.ok(f.logs.every(item => !item.text.includes('secret-value')));
});

test('exits during readiness fail promptly and clean up earlier processes', async t => {
  const f = await fixture(t);
  f.dependencies.isHealthy = async url => {
    if (url.includes('3300')) {
      f.spawned[1].child.exitCode = 9;
      f.spawned[1].child.emit('exit', 9, null);
      return false;
    }
    return true;
  };
  await assert.rejects(f.runtime.start(), /qq.*exited/);
  assert.equal(f.spawned[0].child.kills.length, 1);
  assert.equal(f.spawned[1].child.kills.length, 0);
});

test('an unexpected exit after startup stops remaining services and reports a safe fatal error', async t => {
  const failures = [];
  const f = await fixture(t);
  const { createServiceRuntime } = await import(moduleUrl);
  const runtime = createServiceRuntime({ ...f.options, onFatalError: error => failures.push(error.message) });
  await runtime.start();
  f.spawned[0].child.exitCode = 2;
  f.spawned[0].child.emit('exit', 2, null);
  await new Promise(resolve => setImmediate(resolve));
  await runtime.stop();
  assert.deepEqual(failures, ['netease service exited unexpectedly.']);
  assert.equal(f.spawned[0].child.kills.length, 0);
  assert.equal(f.spawned[1].child.kills.length, 1);
  assert.equal(f.spawned[2].child.kills.length, 1);
});

test('concurrent start and stop calls do not create duplicate processes or duplicate cleanup', async t => {
  const f = await fixture(t);
  await Promise.all([f.runtime.start(), f.runtime.start()]);
  assert.equal(f.spawned.length, 3);
  await Promise.all([f.runtime.stop(), f.runtime.stop()]);
  assert.ok(f.spawned.every(item => item.child.kills.length === 1));
});

test('invalid manifests and traversal paths fail before spawning', async t => {
  const f = await fixture(t);
  for (const change of [
    value => { value.schemaVersion = 2; },
    value => { value.javaExecutable = '../java.exe'; },
    value => { value.services[0].entry = 'C:\\foreign\\app.jar'; },
    value => { value.services[1].cwd = 'netease/../../foreign'; },
    value => { value.services[1].healthPath = '//foreign'; },
    value => { value.services[1].port = 8080; },
    value => { value.services[1].id = 'backend'; }
  ]) {
    const value = manifest();
    change(value);
    await fs.writeFile(path.join(f.resourcesDirectory, 'manifest.json'), JSON.stringify(value));
    const { createServiceRuntime } = await import(moduleUrl);
    await assert.rejects(createServiceRuntime(f.options).start(), /manifest|resource/i);
  }
  assert.equal(f.spawned.length, 0);
});

test('logs contain only lifecycle events in per-user paths, never child output or inherited credentials', async t => {
  const f = await fixture(t);
  await f.runtime.start();
  await f.runtime.stop();
  assert.ok(f.logs.length >= 6);
  assert.ok(f.logs.every(item => item.file.startsWith(f.options.logDirectory)));
  const content = f.logs.map(item => item.text).join('');
  assert.match(content, /ready/);
  assert.doesNotMatch(content, /private-cookie|private|local-access\.token/);
});

test('shutdown during readiness prevents later service startup', async t => {
  let entered;
  let release;
  const readyEntered = new Promise(resolve => { entered = resolve; });
  const readiness = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { isHealthy: async () => { entered(); return readiness; } });
  const startup = f.runtime.start();
  await readyEntered;
  await f.runtime.stop();
  release(true);
  await assert.rejects(startup, /stopped/);
  assert.equal(f.spawned.length, 1);
  assert.equal(f.spawned[0].child.kills.length, 1);
});

test('cleanup escalates to forced termination and attempts every owned child when one refuses termination', async t => {
  const f = await fixture(t);
  await f.runtime.start();
  const backend = f.spawned[2].child;
  backend.kill = signal => { backend.kills.push(signal); return false; };
  await assert.rejects(f.runtime.stop(), /backend.*could not be stopped/);
  assert.deepEqual(backend.kills, ['SIGTERM', 'SIGKILL']);
  assert.equal(f.spawned[0].child.kills.length, 1);
  assert.equal(f.spawned[1].child.kills.length, 1);
});

test('resource directory junctions cannot escape bundled runtime', async t => {
  const f = await fixture(t);
  const foreign = path.join(f.root, 'foreign-backend');
  await fs.rename(path.join(f.resourcesDirectory, 'backend'), foreign);
  await fs.symlink(foreign, path.join(f.resourcesDirectory, 'backend'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.runtime.start(), /resource.*escapes/);
  assert.equal(f.spawned.length, 0);
});

test('diagnostic capture joins split UTF-8 errors, ignores normal output and records exit codes', async t => {
  const f = await fixture(t);
  const events = [];
  const { createServiceRuntime } = await import(moduleUrl);
  const runtime = createServiceRuntime({ ...f.options, onDiagnostic: (id, event, detail) => events.push({ id, event, detail }) });
  await runtime.start();
  const child = f.spawned[0].child;
  assert.deepEqual(f.spawned[0].options.stdio, ['ignore', 'pipe', 'pipe']);
  child.stdout.write('INFO cookie=do-not-record\n');
  const error = Buffer.from('Error: 中文故障\n    at launch.cjs:12:3\n');
  child.stderr.write(error.subarray(0, 10));
  child.stderr.write(error.subarray(10));
  child.stderr.write('Error: ' + 'x'.repeat(20_000));
  child.stderr.write('\nError: recovered\n');
  child.emit('exit', 9, null);
  await runtime.stop();
  assert.ok(events.some(item => item.event === 'output-error' && item.detail.line.includes('中文故障')));
  assert.ok(events.some(item => item.event === 'output-error' && item.detail.line.includes('launch.cjs:12:3')));
  assert.ok(events.some(item => item.event === 'exited' && item.detail.exitCode === 9));
  assert.doesNotMatch(JSON.stringify(events), /do-not-record|x{100}/);
  assert.equal(runtime.snapshot().find(item => item.id === 'netease').exitCode, 9);
});
