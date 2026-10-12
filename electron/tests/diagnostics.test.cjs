const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

function load(file) {
  const localRequire = createRequire(file);
  const module = { exports: {} };
  const code = ts.transpileModule(require('node:fs').readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), `${name.replace(/\.ts$/, '')}.ts`)) : localRequire(name), module, module.exports);
  return module.exports;
}

const core = () => load(path.resolve(__dirname, '../src/main/diagnostics.ts'));
const shared = () => load(path.resolve(__dirname, '../src/shared/diagnostics.ts'));
const summary = () => ({ system: { appVersion: '0.1.3', osName: 'Windows 11', osVersion: '10.0.26200', osArch: 'x64' },
  appearance: { themeMode: 'dark', darkAccent: '#2dd4a7' }, display: { width: 1280, height: 800, scaleFactor: 1.25 } });

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(__dirname, '../.tmp-diagnostics-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'logs');
  return { root, directory, store: core().createDiagnostics({ directory, ...options }) };
}

test('redacts tickets, complete cookie headers, URL queries and personal paths before truncation', () => {
  const { redactDiagnosticText, sanitizeDiagnosticPath } = core();
  const input = 'Cookie: p_skey=COOKIE_PRIVATE; uin=123456789\nAuthorization: Bearer AUTH_PRIVATE\n'
    + 'password="PASS_PRIVATE" token=TOKEN_PRIVATE\nError https://music.example/request?key=QUERY_PRIVATE#FRAGMENT_PRIVATE\n'
    + 'at C:\\Users\\Alice\\Music\\private.mp3\nmail alice@example.com KNOWN_PRIVATE';
  const output = redactDiagnosticText(input, { secrets: ['KNOWN_PRIVATE'] });
  assert.doesNotMatch(output, /COOKIE_PRIVATE|123456789|AUTH_PRIVATE|PASS_PRIVATE|TOKEN_PRIVATE|QUERY_PRIVATE|FRAGMENT_PRIVATE|Alice|private\.mp3|alice@example|KNOWN_PRIVATE/);
  assert.match(output, /music\.example\/request/);
  assert.equal(sanitizeDiagnosticPath('/accounts/qq/123456789/favorite?cookie=SECRET'), '/accounts/qq/[id]/favorite');
  assert.equal(redactDiagnosticText('x'.repeat(200_000) + 'password=hidden'), '[oversized diagnostic omitted]');
});

test('serialized bounded logs contain timestamps and stacks but no sensitive object fields', async t => {
  const f = await fixture(t);
  await f.store.write('renderer', 'vue-error', { error: new Error('boom'), cookie: 'PRIVATE_COOKIE',
    requestBody: { password: 'PRIVATE_PASSWORD' }, accountId: 'PRIVATE_ACCOUNT', status: 500 });
  await f.store.flush();
  const entry = JSON.parse((await fs.readFile(path.join(f.directory, 'renderer.log'), 'utf8')).trim());
  assert.match(entry.time, /^\d{4}-\d\d-\d\dT/);
  assert.match(entry.detail.error, /Error: boom/);
  assert.equal(entry.detail.status, 500);
  assert.doesNotMatch(JSON.stringify(entry), /PRIVATE_COOKIE|PRIVATE_PASSWORD|PRIVATE_ACCOUNT/);
});

test('renderer diagnostics accept only bounded safe fields and strip account query strings', () => {
  const { normalizeRendererDiagnostic, normalizeDiagnosticAppearance } = shared();
  assert.equal(normalizeRendererDiagnostic({ kind: 'request', message: 'failed', method: 'RUN', path: '/' }), null);
  assert.equal(normalizeRendererDiagnostic({ kind: 'error', message: 'x'.repeat(8193) }), null);
  const result = normalizeRendererDiagnostic({ kind: 'request', message: 'HTTP 404', method: 'GET',
    path: '/api/user/123456789?cookie=PRIVATE', status: 404, elapsedMs: -100, headers: { cookie: 'PRIVATE' } });
  assert.equal(result.path, '/api/user/[id]');
  assert.equal(result.status, 404);
  assert.equal(result.elapsedMs, 0);
  assert.ok(!('headers' in result));
  assert.deepEqual(normalizeDiagnosticAppearance({ themeMode: 'dark', darkAccent: '#2dd4a7',
    devicePixelRatio: Infinity, backgroundMode: 'image', imagePath: 'PRIVATE', fontFamily: 'PRIVATE' }),
    { themeMode: 'dark', darkAccent: '#2dd4a7', backgroundMode: 'image' });
});

test('rotation and a bounded queue keep only recent files and tolerate unavailable storage', async t => {
  const f = await fixture(t, { maxFileBytes: 512, maxPending: 4 });
  for (let i = 0; i < 15; i++) await f.store.write('main', 'error', { index: i, message: 'x'.repeat(230) });
  const files = await fs.readdir(f.directory);
  assert.ok(files.length <= 3);
  for (const file of files) assert.ok((await fs.stat(path.join(f.directory, file))).size <= 512);
  assert.match(await fs.readFile(path.join(f.directory, 'main.log'), 'utf8'), /"index":14/);
  await Promise.all(Array.from({ length: 40 }, () => f.store.write('main', 'flood', 'test')));
  assert.ok(f.store.statistics().dropped > 0);
  const blocked = path.join(f.root, 'not-a-directory');
  await fs.writeFile(blocked, 'fixture');
  const unavailable = core().createDiagnostics({ directory: blocked });
  await unavailable.write('main', 'error', 'still playable');
  assert.ok(unavailable.statistics().writeFailures > 0);
});

test('ZIP exports only bounded fixed logs and whitelisted environment fields, redacting again', async t => {
  const f = await fixture(t);
  await f.store.write('updater', 'download-failed', { source: 'server', error: 'HTTP 404', phase: 'download' });
  await fs.writeFile(path.join(f.directory, 'account.json'), '{"cookie":"DO_NOT_EXPORT"}');
  await fs.mkdir(path.join(f.directory, 'runtime'));
  await fs.writeFile(path.join(f.directory, 'backend.log'), 'Cookie: EXPORT_PRIVATE\nError: upstream failed\n');
  const file = path.join(f.root, 'diagnostics.zip');
  await f.store.exportBundle(file, { ...summary(), cookie: 'SUMMARY_PRIVATE',
    appearance: { ...summary().appearance, imagePath: 'PRIVATE_IMAGE' } });
  const { unzipSync, strFromU8 } = require('fflate');
  const files = unzipSync(await fs.readFile(file));
  assert.ok(files['diagnostics.json']);
  assert.ok(files['logs/updater.log']);
  assert.ok(files['logs/backend.log']);
  assert.ok(!files['account.json']);
  assert.ok(!Object.keys(files).some(name => name.includes('runtime')));
  const text = Object.values(files).map(value => strFromU8(value)).join('\n');
  assert.doesNotMatch(text, /DO_NOT_EXPORT|EXPORT_PRIVATE|SUMMARY_PRIVATE|PRIVATE_IMAGE/);
  assert.match(text, /HTTP 404/);
  assert.match(text, /#2dd4a7/);
  const oversized = Buffer.alloc(2 * 1024 * 1024, 120);
  await fs.writeFile(path.join(f.directory, 'qq.log'), oversized);
  await f.store.exportBundle(file, summary());
  assert.ok(!unzipSync(await fs.readFile(file))['logs/qq.log']);
});

test('export refuses symlink logs and cleans failed output so a later export can succeed', async t => {
  const f = await fixture(t);
  await f.store.write('main', 'startup', 'ready');
  const foreign = path.join(f.root, 'foreign');
  await fs.mkdir(foreign);
  await fs.writeFile(path.join(foreign, 'main.log'), 'FOREIGN_PRIVATE');
  const linked = path.join(f.root, 'linked');
  await fs.symlink(foreign, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(core().createDiagnostics({ directory: linked }).exportBundle(path.join(f.root, 'bad.zip'), summary()), /link|directory/i);
  const nested = core().createDiagnostics({ directory: path.join(linked, 'nested') });
  await nested.write('main', 'error', 'MUST_NOT_WRITE');
  await assert.rejects(nested.exportBundle(path.join(f.root, 'nested.zip'), summary()), /link|directory/i);
  assert.ok(!(await fs.readdir(foreign)).includes('nested'));
  await assert.rejects(f.store.exportBundle(path.join(f.root, 'missing', 'failed.zip'), summary()));
  assert.ok(!(await fs.readdir(f.root)).some(name => name.includes('.partial-')));
  await f.store.exportBundle(path.join(f.root, 'retry.zip'), summary());
  assert.ok((await fs.stat(path.join(f.root, 'retry.zip'))).size > 0);
});
