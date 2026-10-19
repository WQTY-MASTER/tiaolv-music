const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const script = path.resolve(__dirname, '../../scripts/verify.cjs');

test('release runner discovers isolated Node tests once, preserving transform flags', () => {
  assert.ok(fs.existsSync(script), 'release verification runner must exist');
  const { discoverFrontendTests } = require(script);
  const commands = discoverFrontendTests({ scripts: {
    test: 'node --test tests/a.test.cjs && node tests/b.test.cjs',
    'test:extra': 'node --experimental-transform-types --test tests/a.test.cjs && node tests/c.test.cjs',
    'test:e2e': 'echo "No e2e tests yet"', build: 'node ignored.cjs'
  } });
  assert.deepEqual(commands.map(item => item.file), ['tests/a.test.cjs', 'tests/b.test.cjs', 'tests/c.test.cjs']);
  assert.ok(commands[0].flags.includes('--experimental-transform-types'));
  assert.ok(commands[0].flags.includes('--test'));
});

test('release runner rejects shell placeholders and missing test paths', () => {
  assert.ok(fs.existsSync(script), 'release verification runner must exist');
  const { discoverFrontendTests, validateTestFiles } = require(script);
  assert.throws(() => discoverFrontendTests({ scripts: { test: 'echo success' } }), /Unsupported/);
  assert.throws(() => validateTestFiles([{ file: 'tests/missing.test.cjs' }], __dirname), /Missing/);
});

test('release runner accepts multiple files after flags and merges duplicate file flags', () => {
  const { discoverFrontendTests } = require(script);
  const commands = discoverFrontendTests({ scripts: {
    test: 'node --test tests/a.test.cjs tests/b.test.cjs tests/a.test.cjs',
    'test:extra': 'node --experimental-transform-types --test tests/b.test.cjs tests/c.test.cjs'
  } });
  assert.deepEqual(commands, [
    { file: 'tests/a.test.cjs', flags: ['--test'] },
    { file: 'tests/b.test.cjs', flags: ['--test', '--experimental-transform-types'] },
    { file: 'tests/c.test.cjs', flags: ['--experimental-transform-types', '--test'] }
  ]);
});

test('release runner refuses traversal, shell syntax, trailing flags and unapproved Node flags', () => {
  const { discoverFrontendTests } = require(script);
  for (const command of [
    'node --test tests/../outside.test.cjs', 'node --test tests/a.test.cjs --test',
    'node --require tests/a.test.cjs', 'node --test tests/a.test.cjs | node tests/b.test.cjs',
    'node --test tests/a.test.cjs; node tests/b.test.cjs',
    'node --test tests/a.test.cjs &&', 'node --test tests/a.test.cjs > output',
    'node --test "tests/a.test.cjs"', 'node --test tests//a.test.cjs'
  ]) {
    assert.throws(() => discoverFrontendTests({ scripts: { test: command } }), /Unsupported/, command);
  }
});

test('offline playlist regressions are registered and isolated browser acceptance stays separate', () => {
  const { discoverFrontendTests, ISOLATED_E2E_FILES } = require(script);
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  const commands = discoverFrontendTests(packageJson);
  for (const name of ['account-playlist-actions', 'aggregate-batch-removal', 'netease-playlist-gateway', 'request-lifecycle', 'local-playlist-persistence']) {
    assert.ok(commands.some(command => command.file === `tests/${name}.test.cjs`), name);
  }
  assert.deepEqual(ISOLATED_E2E_FILES, ['account-playlist-actions.smoke.cjs', 'account-playlist-batches.smoke.cjs', 'playlist-batch-removal.smoke.cjs', 'playlist-persistence.smoke.cjs']);
  assert.equal(packageJson.scripts['test:e2e:isolated'], 'node ../scripts/verify.cjs e2e-isolated');
});

test('browser acceptance has a bounded real smoke suite and refuses remote preview URLs', () => {
  assert.ok(fs.existsSync(script), 'release verification runner must exist');
  const { E2E_FILES, previewUrl } = require(script);
  assert.deepEqual(E2E_FILES, ['qq-playlist-recommendations.smoke.cjs', 'lyrics-qrc.smoke.cjs', 'lyrics-layout.smoke.cjs', 'qq-recent-report.smoke.cjs']);
  assert.equal(previewUrl('http://127.0.0.1:5174/').port, '5174');
  assert.throws(() => previewUrl('https://example.com/'), /loopback/);
});

test('browser acceptance exits unsuccessfully when Playwright is absent', () => {
  assert.ok(fs.existsSync(script), 'release verification runner must exist');
  const result = spawnSync(process.execPath, [script, 'e2e'], {
    env: { ...process.env, PLAYWRIGHT_MODULE: path.join(__dirname, 'missing-playwright-module.cjs') }, encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Playwright is required/);
});
