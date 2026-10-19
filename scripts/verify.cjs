const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ELECTRON = path.join(ROOT, 'electron');
const E2E_FILES = ['qq-playlist-recommendations.smoke.cjs', 'lyrics-qrc.smoke.cjs', 'lyrics-layout.smoke.cjs', 'qq-recent-report.smoke.cjs'];
const ISOLATED_E2E_FILES = ['account-playlist-actions.smoke.cjs', 'account-playlist-batches.smoke.cjs', 'playlist-batch-removal.smoke.cjs', 'playlist-persistence.smoke.cjs'];

function discoverFrontendTests(packageJson) {
  const found = new Map();
  for (const [name, command] of Object.entries(packageJson.scripts || {})) {
    if ((name !== 'test' && !name.startsWith('test:')) || /^test:e2e(?:$|:)/.test(name)) continue;
    for (const segment of command.split(/\s*&&\s*/)) {
      const tokens = segment.trim().split(/\s+/);
      let firstFile = 1;
      while (['--test', '--experimental-transform-types'].includes(tokens[firstFile])) firstFile++;
      const files = tokens.slice(firstFile);
      if (tokens[0] !== 'node' || !files.length || files.some(file =>
        !/^tests\/(?:[\w.-]+\/)*[\w.-]+\.test\.cjs$/.test(file)
        || file.split('/').some(segment => segment === '.' || segment === '..'))) {
        throw new Error(`Unsupported frontend test command in ${name}: ${segment}`);
      }
      for (const file of files) {
        const flags = [...new Set([...(found.get(file)?.flags || []), ...tokens.slice(1, firstFile)])];
        found.set(file, { file, flags });
      }
    }
  }
  if (!found.size) throw new Error('No frontend tests configured');
  return [...found.values()];
}

function validateTestFiles(commands, directory) {
  for (const command of commands) {
    const file = path.resolve(directory, command.file);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Missing test file: ${file}`);
  }
}

function execute(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Verification failed (${result.status ?? result.signal}): ${path.basename(command)} ${args.join(' ')}`);
}

function frontend() {
  const commands = discoverFrontendTests(JSON.parse(fs.readFileSync(path.join(ELECTRON, 'package.json'), 'utf8')));
  for (const [name, transform] of [['release-verification'], ['data-backup'], ['backend-access', true],
    ['local-backend-proxy'], ['service-runtime', true]]) {
    const file = `tests/${name}.test.cjs`;
    if (!commands.some(command => command.file === file)) commands.push({ file,
      flags: transform ? ['--experimental-transform-types', '--test'] : ['--test'] });
  }
  validateTestFiles(commands, ELECTRON);
  console.log(`Frontend acceptance: ${commands.length} explicit, deduplicated test files`);
  for (const command of commands) {
    console.log(`\n[frontend] ${command.file}`);
    execute(process.execPath, [...command.flags, command.file], ELECTRON);
  }
  const scriptTests = fs.readdirSync(path.join(ROOT, 'scripts', 'tests')).filter(name => /^[\w-]+\.test\.cjs$/.test(name)).sort();
  for (const required of ['stage-runtime.test.cjs', 'runtime-api-access.test.cjs']) {
    if (!scriptTests.includes(required)) throw new Error(`Missing script acceptance test: ${required}`);
  }
  for (const name of scriptTests) {
    const file = `scripts/tests/${name}`;
    console.log(`\n[frontend] ${file}`);
    execute(process.execPath, ['--test', file], ROOT);
  }
}

function typecheck() {
  const localRequire = createRequire(path.join(ELECTRON, 'package.json'));
  execute(process.execPath, [localRequire.resolve('vue-tsc/bin/vue-tsc.js'), '--noEmit', '-p', 'tsconfig.json'], ELECTRON);
  const tsc = localRequire.resolve('typescript/bin/tsc');
  for (const project of ['tsconfig.main.json', 'tsconfig.preload.json']) {
    execute(process.execPath, [tsc, '-p', project, '--noEmit'], ELECTRON);
  }
}

function backend() {
  if (process.platform === 'win32') {
    execute(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'mvn.cmd -B test'], path.join(ROOT, 'backend'));
  } else execute('mvn', ['-B', 'test'], path.join(ROOT, 'backend'));
}

function previewUrl(value = 'http://127.0.0.1:5173') {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Browser preview URL must be an HTTP loopback URL without credentials');
  }
  return url;
}

function playwrightModule() {
  const localRequire = createRequire(path.join(ELECTRON, 'package.json'));
  let modulePath;
  try { modulePath = localRequire.resolve(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
  catch { throw new Error('Playwright is required: install it or set PLAYWRIGHT_MODULE to its absolute module path'); }
  return modulePath;
}

function isolatedE2e() {
  const modulePath = playwrightModule();
  const commands = ISOLATED_E2E_FILES.map(name => ({ file: `tests/${name}` }));
  validateTestFiles(commands, ELECTRON);
  for (const command of commands) {
    console.log(`\n[e2e-isolated] ${command.file}`);
    execute(process.execPath, [command.file], ELECTRON, { ...process.env, PLAYWRIGHT_MODULE: modulePath });
  }
}

async function e2e() {
  const modulePath = playwrightModule();
  const url = previewUrl(process.env.LYRICS_TEST_URL);
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(5000) }); }
  catch { throw new Error(`Web preview is unavailable at ${url.origin}; start npm run serve before browser acceptance`); }
  if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) {
    throw new Error(`Web preview did not return HTML at ${url.origin} (${response.status})`);
  }
  const commands = E2E_FILES.map(name => ({ file: `tests/${name}` }));
  validateTestFiles(commands, ELECTRON);
  for (const command of commands) {
    console.log(`\n[e2e] ${command.file}`);
    execute(process.execPath, [command.file], ELECTRON, { ...process.env, PLAYWRIGHT_MODULE: modulePath, LYRICS_TEST_URL: url.href });
  }
}

async function main(mode = process.argv[2] || 'frontend') {
  const modes = { frontend, typecheck, backend, e2e, 'e2e-isolated': isolatedE2e, offline: async () => { frontend(); typecheck(); backend(); },
    all: async () => { frontend(); typecheck(); backend(); await e2e(); } };
  if (!modes[mode]) throw new Error('Usage: node scripts/verify.cjs frontend|typecheck|backend|e2e|e2e-isolated|offline|all');
  await modes[mode]();
  console.log(`\nVerification passed: ${mode}`);
}

module.exports = { discoverFrontendTests, validateTestFiles, E2E_FILES, ISOLATED_E2E_FILES, previewUrl, main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
