const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

let staging = {};
try {
  staging = require('../stage-runtime.cjs');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

function write(root, relative, value = 'fixture') {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value);
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-stage-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const netease = 'music-api/api-enhanced';
  const qq = 'music-api/qq-music-api';
  write(root, 'backend/pom.xml', '<project/>');
  write(root, `${netease}/package.json`, JSON.stringify({ name: 'netease', dependencies: { fixture: '1.0.0' } }));
  write(root, `${netease}/pnpm-lock.yaml`, "lockfileVersion: '9.0'\n");
  write(root, `${netease}/pnpm-workspace.yaml`, "packages:\n  - '.'\n");
  for (const file of ['app.js', 'server.js', 'main.js', 'generateConfig.js', 'module/ping.js', 'util/config.json', 'public/index.html', 'data/deviceid.txt', 'LICENSE']) write(root, `${netease}/${file}`);
  write(root, `${qq}/package.json`, JSON.stringify({ name: 'qq', type: 'module', dependencies: { fixture: '1.0.0' } }));
  write(root, `${qq}/package-lock.json`, '{}');
  for (const file of ['public/index.html', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) write(root, `${qq}/${file}`);
  write(root, 'java-home/bin/jlink.exe');
  write(root, 'java-home/bin/java.exe');
  write(root, 'java-home/jmods/java.base.jmod');
  const calls = [];
  const runCommand = (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd, env: options.env });
    if (args.includes('package')) write(root, 'backend/target/backend.jar', 'PK\u0003\u0004boot-jar');
    if (args.includes('build:core')) {
      write(root, `${qq}/dist/app.js`, 'export default {};');
      write(root, `${qq}/dist/dynamic-chunk.js`, 'export default {};');
    }
    if (args.includes('--output')) {
      const output = args[args.indexOf('--output') + 1];
      write(output, 'bin/java.exe');
      write(output, 'release', 'JAVA_VERSION="21.0.4"');
      write(output, 'legal/java.base/LICENSE');
    }
    if (args.includes('install') || args.includes('ci')) {
      write(options.cwd, 'node_modules/fixture/package.json', '{"name":"fixture","version":"1.0.0"}');
      write(options.cwd, 'node_modules/fixture/nested/production.js');
      write(options.cwd, 'node_modules/fixture/LICENSE');
    }
    return { status: 0 };
  };
  return { root, javaHome: path.join(root, 'java-home'), runCommand, platform: 'win32', calls };
}

test('resolves bare Windows batch commands from the current PATH before quoting', (t) => {
  assert.equal(typeof staging.resolveBatchCommand, 'function', 'batch commands must resolve to an absolute path');
  const options = fixture(t);
  write(options.root, 'build tools/probe.cmd', '@exit /b 0\r\n');
  write(options.root, 'build tools/probe.bat', '@exit /b 0\r\n');
  const env = {};
  const tools = path.join(options.root, 'build tools');
  env.Path = `"${tools}"`;
  for (const command of ['probe.cmd', 'probe.bat']) {
    const absolute = path.join(tools, command);
    assert.equal(staging.resolveBatchCommand(command, env, options.root), absolute);
    assert.equal(staging.resolveBatchCommand(absolute, env, options.root), absolute);
  }
  assert.throws(() => staging.resolveBatchCommand('missing.cmd', env, options.root), /Cannot find.*PATH/i);
});

test('stages the built jar, Java and both APIs with complete production installs', async (t) => {
  assert.equal(typeof staging.stageRuntime, 'function', 'portable runtime staging must be implemented');
  const options = fixture(t);
  const manifest = await staging.stageRuntime(options);
  const output = path.join(options.root, 'electron/resources/runtime');
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.javaExecutable, 'java/bin/java.exe');
  assert.deepEqual(manifest.services.map(({ id, entry, port, healthPath }) => ({ id, entry, port, healthPath })), [
    { id: 'backend', entry: 'backend/app.jar', port: 17890, healthPath: '/health' },
    { id: 'netease', entry: 'netease/launch.cjs', port: 3000, healthPath: '/' },
    { id: 'qq', entry: 'qq/launch.cjs', port: 3300, healthPath: '/' }
  ]);
  for (const relative of ['manifest.json', 'backend/app.jar', 'java/bin/java.exe', 'java/legal/java.base/LICENSE', 'netease/node_modules/fixture/nested/production.js', 'qq/dist/dynamic-chunk.js', 'qq/node_modules/fixture/LICENSE']) assert.ok(fs.existsSync(path.join(output, relative)), relative);
  const pnpm = options.calls.find(({ args }) => args.includes('install'));
  assert.ok(pnpm.args.includes('--prod') && pnpm.args.includes('--frozen-lockfile') && pnpm.args.includes('--offline'));
  const npm = options.calls.find(({ args }) => args.includes('ci'));
  assert.ok(npm.args.includes('--omit=dev') && npm.args.includes('--offline') && npm.args.includes('--workspaces=false'));
  assert.ok(options.calls.find(({ args }) => args.includes('package')));
  assert.ok(options.calls.find(({ args }) => args.includes('build:core')));
});

test('excludes local credentials, environment, user config and logs from source copies', async (t) => {
  assert.equal(typeof staging.stageRuntime, 'function');
  const options = fixture(t);
  for (const relative of ['music-api/api-enhanced/.env', 'music-api/api-enhanced/util/.env.production', 'music-api/api-enhanced/public/session.log', 'music-api/qq-music-api/config/user-info.json', 'music-api/qq-music-api/dist/.env', 'music-api/qq-music-api/dist/accounts.json']) write(options.root, relative, 'private');
  await staging.stageRuntime(options);
  const output = path.join(options.root, 'electron/resources/runtime');
  for (const relative of ['netease/.env', 'netease/util/.env.production', 'netease/public/session.log', 'qq/config/user-info.json', 'qq/dist/.env', 'qq/dist/accounts.json']) assert.equal(fs.existsSync(path.join(output, relative)), false, relative);
});

test('isolates pnpm from the parent application workspace and refuses interactive installation', async (t) => {
  const options = fixture(t);
  const runCommand = options.runCommand;
  options.runCommand = (command, args, commandOptions) => {
    if (args.includes('install')) {
      assert.equal(fs.existsSync(path.join(commandOptions.cwd, 'pnpm-workspace.yaml')), true, 'pnpm must have its own workspace boundary');
      assert.equal(commandOptions.env.CI, 'true');
    }
    return runCommand(command, args, commandOptions);
  };
  await staging.stageRuntime(options);
});

test('removes dependency-shipped environment examples rather than packaging them', async (t) => {
  const options = fixture(t);
  const runCommand = options.runCommand;
  options.runCommand = (command, args, commandOptions) => {
    const result = runCommand(command, args, commandOptions);
    if (args.includes('install')) write(commandOptions.cwd, 'node_modules/fixture/.env.example', 'EXAMPLE_TOKEN=');
    return result;
  };
  await staging.stageRuntime(options);
  assert.equal(fs.existsSync(path.join(options.root, 'electron/resources/runtime/netease/node_modules/fixture/.env.example')), false);
});

test('a failed production install preserves the previous complete runtime and publishes no partial manifest', async (t) => {
  assert.equal(typeof staging.stageRuntime, 'function');
  const options = fixture(t);
  write(options.root, 'electron/resources/runtime/manifest.json', '{"old":true}');
  const runCommand = options.runCommand;
  options.runCommand = (...args) => {
    if (args[1].includes('ci')) throw new Error('dependency cache incomplete');
    return runCommand(...args);
  };
  await assert.rejects(staging.stageRuntime(options), /dependency cache incomplete/);
  assert.equal(fs.readFileSync(path.join(options.root, 'electron/resources/runtime/manifest.json'), 'utf8'), '{"old":true}');
  assert.deepEqual(fs.readdirSync(path.join(options.root, 'electron/resources')), ['runtime']);
});

test('rejects incomplete outputs even if build commands report success', async (t) => {
  assert.equal(typeof staging.stageRuntime, 'function');
  const options = fixture(t);
  const runCommand = options.runCommand;
  options.runCommand = (...args) => args[1].includes('--output') ? { status: 0 } : runCommand(...args);
  await assert.rejects(staging.stageRuntime(options), /java\/bin\/java.exe|Java runtime/i);
  assert.equal(fs.existsSync(path.join(options.root, 'electron/resources/runtime/manifest.json')), false);
});

test('refuses resource directory junctions that escape the workspace', async (t) => {
  assert.equal(typeof staging.stageRuntime, 'function');
  const options = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-stage-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  write(outside, 'keep.txt', 'untouched');
  fs.mkdirSync(path.join(options.root, 'electron'), { recursive: true });
  fs.symlinkSync(outside, path.join(options.root, 'electron/resources'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(staging.stageRuntime(options), /workspace|symbolic|junction/i);
  assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'untouched');
  assert.deepEqual(options.calls, []);
});

for (const id of ['netease', 'qq']) {
  test(`${id} staged launcher protects real HTTP requests before provider handlers from a writable user-data cwd`, async (t) => {
    let child;
    t.after(async () => {
      if (child && child.exitCode === null && child.signalCode === null) {
        await new Promise((resolve) => { child.once('exit', resolve); child.kill(); });
      }
    });
    const options = fixture(t);
    await staging.stageRuntime(options);
    const output = path.join(options.root, 'electron/resources/runtime');
    write(output, 'netease/server.js', "const http = require('node:http'); exports.serveNcmApi = async ({port, host}) => ({server: http.createServer((_req,res) => res.end('provider handler')).listen(port,host)});");
    write(output, 'netease/generateConfig.js', 'module.exports = () => new Promise(() => {});');
    write(output, 'qq/dist/app.js', "import http from 'node:http'; export default {listen(port,host) {return http.createServer((_req,res) => res.end('provider handler')).listen(port,host);}};");
    const reservation = http.createServer();
    await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    const userData = path.join(options.root, 'synthetic-user-data');
    fs.mkdirSync(userData);
    const tokenFile = path.join(userData, 'local-access.token');
    const token = 'c'.repeat(64);
    child = spawn(process.execPath, [path.join(output, id, 'launch.cjs')], {
      cwd: userData,
      env: { ...process.env, PORT: String(port), HOST: '0.0.0.0', TEMP: userData, TMP: userData, TMPDIR: userData, LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE: tokenFile },
      stdio: 'ignore', windowsHide: true
    });
    const request = (url, headers = {}) => new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: url, headers }, (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body }));
      }).on('error', reject);
    });
    const deadline = Date.now() + 5000;
    while (true) {
      try { assert.deepEqual(await request('/'), { status: 200, body: '{"ok":true}' }); break; }
      catch (error) {
        if (Date.now() >= deadline || child.exitCode !== null) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    assert.equal((await request('/api/data')).status, 401);
    fs.writeFileSync(tokenFile, token);
    assert.deepEqual(await request('/api/data', { 'X-Tiaolv-Token': token }), { status: 200, body: 'provider handler' });
    assert.equal((await request('/api/data', { 'X-Tiaolv-Token': token, Origin: 'null' })).status, 403);
    assert.equal((await request('/api/data', { 'X-Tiaolv-Token': token, Host: 'evil.example' })).status, 403);
  });
}
