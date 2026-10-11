const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const workspace = path.resolve(__dirname, '..');
const servicePorts = [17890, 3000, 3300];

function assertNodeVersion(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (!(major >= 24 || major === 22 && minor >= 18)) throw new Error('Protected services require Node 22.18+ or Node 24+.');
}

function createServiceOptions(overrides = {}) {
  const root = path.resolve(overrides.root || workspace);
  const home = overrides.homeDirectory || os.homedir();
  const appData = overrides.appDataDirectory || process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  let nodeExecutable = overrides.nodeExecutable;
  if (!nodeExecutable) {
    try { nodeExecutable = require(path.join(root, 'electron/node_modules/electron')); }
    catch { throw new Error('Electron runtime is missing; run pnpm install first.'); }
    if (typeof nodeExecutable !== 'string' || !existsSync(nodeExecutable)) throw new Error('Electron runtime is missing; run pnpm install first.');
  }
  const userData = path.join(appData, '\u8c03\u5f8b\u97f3\u4e50');
  return {
    resourcesDirectory: path.join(root, 'electron', 'resources', 'runtime'),
    nodeExecutable,
    dataDirectory: path.join(userData, 'runtime'),
    logDirectory: path.join(userData, 'logs', 'runtime'),
    tokenFile: path.join(home, '.tiaolv-music', 'local-access.token')
  };
}

function isPortAvailable(port) {
  return new Promise(resolve => {
    const listener = net.createServer();
    listener.once('error', () => resolve(false));
    listener.listen({ host: '127.0.0.1', port, exclusive: true }, () => listener.close(() => resolve(true)));
  });
}

async function localRequest(url, headers) {
  try {
    const response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(1500) });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { /* Only JSON can identify the expected service. */ }
    return { status: response.status, contentType: response.headers.get('content-type') || '', body };
  } catch { return { status: 0 }; }
}

async function inspectServices(options, dependencies = {}) {
  const available = await Promise.all(servicePorts.map(port => (dependencies.isPortAvailable || isPortAvailable)(port)));
  if (available.every(Boolean)) return { state: 'missing' };
  if (available.some(Boolean)) {
    const occupied = servicePorts.filter((_port, index) => !available[index]);
    throw new Error(`Service ports are partially occupied (${occupied.join(', ')}); stop those services yourself before retrying.`);
  }
  let token;
  try { token = await (dependencies.readToken || (filename => fs.readFile(filename, 'utf8')))(options.tokenFile); }
  catch { throw new Error('Cannot verify existing services without the private local-access token.'); }
  token = typeof token === 'string' ? token.trim() : '';
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error('The private local-access token is invalid; existing services cannot be reused.');
  const request = dependencies.request || localRequest;
  for (const port of servicePorts) {
    const base = `http://127.0.0.1:${port}`;
    const health = await request(`${base}${port === 17890 ? '/health' : '/'}`);
    const privateUrl = `${base}${port === 17890 ? '/library/tracks' : '/__tiaolv_service_identity__'}`;
    const unauthenticated = await request(privateUrl);
    const authenticated = await request(privateUrl, { 'X-Tiaolv-Token': token });
    const hostile = await request(privateUrl, { 'X-Tiaolv-Token': token, Origin: 'https://invalid.example' });
    if (health.status !== 200 || !health.contentType?.includes('application/json') || health.body?.ok !== true
      || unauthenticated.status !== 401 || authenticated.status !== (port === 17890 ? 200 : 404) || hostile.status !== 403) {
      throw new Error(`Port ${port} is not a verified protected application service; refusing to reuse it.`);
    }
  }
  return { state: 'ready' };
}

async function validateResources(directory) {
  try { require('./stage-runtime.cjs').validateRuntime(directory); }
  catch { throw new Error('Protected runtime resources are missing or invalid; run npm run runtime:stage -- --online first.'); }
}

async function createRuntime(options) {
  const { createServiceRuntime } = await import(pathToFileURL(path.join(workspace, 'electron/src/main/serviceRuntime.ts')));
  return createServiceRuntime(options);
}

async function ensureServices(options, dependencies = {}) {
  const inspection = await inspectServices(options, dependencies);
  if (inspection.state === 'ready') return { reused: true, stop: async () => undefined };
  await (dependencies.validateResources || validateResources)(options.resourcesDirectory);
  const runtime = await (dependencies.createRuntime || createRuntime)(options);
  dependencies.onRuntimeCreated?.(runtime);
  try { await runtime.start(); }
  catch (error) { await runtime.stop(); throw error; }
  return { reused: false, stop: () => runtime.stop() };
}

async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/start-services.cjs [--check]');
  assertNodeVersion();
  const options = createServiceOptions();
  if (args.includes('--check')) {
    await validateResources(options.resourcesDirectory);
    const result = await inspectServices(options);
    console.log(result.state === 'ready' ? 'Protected services are verified and ready.' : 'Protected runtime is staged; all service ports are available.');
    return;
  }
  let runtime;
  let stopping = false;
  async function shutdown(code = 0) {
    stopping = true;
    try { await runtime?.stop(); process.exitCode = code; }
    catch { console.error('An owned service could not be stopped.'); process.exitCode = 1; }
  }
  const interrupt = () => { void shutdown(); };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  options.onFatalError = error => { console.error(error.message); void shutdown(1); };
  try {
    const result = await ensureServices(options, { onRuntimeCreated: created => { runtime = created; if (stopping) void created.stop(); } });
    if (stopping) { await shutdown(); return; }
    console.log(result.reused ? 'Reusing verified protected services.' : 'Protected services are ready (17890, 3000, 3300).');
    if (result.reused) {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    }
  } catch (error) {
    const interrupted = stopping;
    await shutdown(interrupted ? 0 : 1);
    if (!interrupted || process.exitCode === 1) throw error;
  }
}

module.exports = { assertNodeVersion, createServiceOptions, inspectServices, ensureServices, main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
