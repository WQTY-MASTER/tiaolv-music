const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

function installOfflineGuard() {
  const allowed = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
  const check = input => {
    const hostname = typeof input === 'string' || input instanceof URL
      ? new URL(input).hostname
      : input?.hostname || input?.host || 'localhost';
    if (!allowed.has(hostname)) throw new Error('Upstream access is disabled during runtime smoke.');
  };
  for (const protocol of ['node:http', 'node:https']) {
    const transport = require(protocol);
    for (const method of ['request', 'get']) {
      const original = transport[method];
      transport[method] = function offlineRequest(...args) {
        check(args[0]);
        return original.apply(this, args);
      };
    }
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, options) => {
    check(input instanceof Request ? input.url : input);
    return originalFetch(input, options);
  };
}

async function available(port) {
  return new Promise(resolve => {
    const listener = net.createServer();
    listener.once('error', () => resolve(false));
    listener.listen({ host: '127.0.0.1', port, exclusive: true }, () => listener.close(() => resolve(true)));
  });
}

async function runSmoke() {
  const workspace = path.resolve(__dirname, '..');
  const temporary = path.join(workspace, '.test-tmp');
  await fs.mkdir(temporary, { recursive: true });
  const root = await fs.mkdtemp(path.join(temporary, 'runtime-smoke-'));
  const { createServiceRuntime } = await import(pathToFileURL(path.join(workspace, 'electron/src/main/serviceRuntime.ts')));
  const packaged = process.argv.includes('--packaged');
  const packageDirectory = path.join(workspace, 'electron/release/win-unpacked');
  const packageJson = require('../electron/package.json');
  const electronExecutable = packaged
    ? path.join(packageDirectory, `${packageJson.productName}.exe`)
    : require('../electron/node_modules/electron');
  const tokenFile = path.join(root, 'home/.tiaolv-music/local-access.token');
  const children = [];
  const results = [];
  const runtime = createServiceRuntime({
    resourcesDirectory: packaged ? path.join(packageDirectory, 'resources/runtime')
      : path.join(workspace, 'electron/resources/runtime'),
    nodeExecutable: electronExecutable,
    dataDirectory: path.join(root, 'data'),
    logDirectory: path.join(root, 'logs'),
    javaHomeDirectory: path.join(root, 'home'),
    javaTemporaryDirectory: path.join(root, 'jtmp'),
    tokenFile,
    onFatalError: error => results.push({ fatal: error.message }),
    dependencies: {
      spawn(executable, args, options) {
        const guarded = options.env.ELECTRON_RUN_AS_NODE === '1'
          ? ['--require', __filename, ...args]
          : args;
        const child = spawn(executable, guarded, options);
        children.push(child);
        return child;
      }
    }
  });
  const ports = [3000, 3300, 17890];
  async function expectStatus(port, route, status, headers = {}) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(5000)
    });
    await response.arrayBuffer();
    assert.equal(response.status, status, `${port}${route}`);
    results.push({ port, route, status });
  }
  let passed = false;
  try {
    await runtime.start();
    assert.equal(children.length, 3);
    const token = (await fs.readFile(tokenFile, 'utf8')).trim();
    assert.match(token, /^[a-f0-9]{64}$/i);
    const authorization = { 'X-Tiaolv-Token': token };
    for (const port of ports) {
      const publicRoute = port === 17890 ? '/health' : '/';
      const privateRoute = port === 17890 ? '/library/tracks' : '/__runtime_smoke_missing__';
      await expectStatus(port, publicRoute, 200);
      await expectStatus(port, privateRoute, 401);
      await expectStatus(port, privateRoute, port === 17890 ? 200 : 404, authorization);
      await expectStatus(port, privateRoute, 403, { ...authorization, Origin: 'https://attacker.example' });
    }
    assert.ok(children.every(child => child.exitCode === null && child.signalCode === null));
    assert.ok(!results.some(result => result.fatal));
    passed = true;
  } finally {
    await runtime.stop();
    assert.ok(children.every(child => child.exitCode !== null || child.signalCode !== null), 'Every owned child must exit.');
    for (const port of ports) assert.equal(await available(port), true, `Port ${port} must be released.`);
    await fs.rm(root, { recursive: true, force: true });
  }
  if (passed) console.log(JSON.stringify({ ok: true, packaged, runtime: 'bundled Electron Node and Java 21', checks: results, ownedChildren: children.length, remainingOwnedChildren: 0, portsReleased: ports, upstreamAccess: 'blocked in API test processes' }, null, 2));
}

if (require.main === module) {
  runSmoke().catch(error => {
    console.error(`Runtime smoke failed: ${error.message}`);
    process.exitCode = 1;
  });
} else {
  installOfflineGuard();
}
