const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const test = require('node:test');
const script = path.resolve(__dirname, '../../scripts/data-backup.cjs');
function tooling() {
  assert.ok(fs.existsSync(script), 'offline recovery tool must exist');
  return require(script);
}
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-recovery-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const roots = { backend: path.join(home, 'source', '.tiaolv-music'), electron: path.join(home, 'source', 'electron-user-data') };
  for (const dir of Object.values(roots)) fs.mkdirSync(dir, { recursive: true });
  const options = { roots, allowedRoots: roots, offlineCheck: async () => {} };
  return { home, roots, options, archive: path.join(home, 'archive') };
}
function write(root, file, value) {
  const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value);
}

test('offline backup keeps database sidecars and settings but excludes credentials, logs and caches', async t => {
  const { backup } = tooling(); const f = fixture(t);
  write(f.roots.backend, 'tiaolv-music.db', 'database');
  write(f.roots.backend, 'tiaolv-music.db-wal', 'wal');
  write(f.roots.backend, 'credentials/credential.key', 'secret');
  write(f.roots.backend, 'netease_cookie.json', 'cookie');
  write(f.roots.backend, 'local-access.token', 'token');
  write(f.roots.electron, 'shortcuts.json', 'settings');
  write(f.roots.electron, 'Local Storage/leveldb/000001.log', 'local preferences');
  write(f.roots.electron, 'Cache/data', 'cache');
  write(f.roots.electron, 'logs/main.log', 'log');
  write(f.roots.electron, 'Network/Cookies', 'cookie');
  write(f.roots.electron, 'runtime/qq/config/user-info.json', JSON.stringify({ cookie: 'synthetic-cookie' }));
  write(f.roots.electron, 'runtime/qq/config/future-auth.json', 'synthetic-session');
  const manifest = await backup({ ...f.options, archive: f.archive });
  assert.deepEqual(manifest.files.map(item => `${item.root}/${item.path}`).sort(), [
    'backend/tiaolv-music.db', 'backend/tiaolv-music.db-wal',
    'electron/Local Storage/leveldb/000001.log', 'electron/shortcuts.json'
  ]);
  assert.equal(manifest.includesCredentials, false);
});

test('restore treats represented LevelDB directories as complete snapshots', async t => {
  const { backup, restore } = tooling(); const f = fixture(t);
  write(f.roots.electron, 'Local Storage/leveldb/CURRENT', 'MANIFEST-000002');
  write(f.roots.electron, 'Local Storage/leveldb/000001.log', 'preferences snapshot');
  write(f.roots.electron, 'IndexedDB/file__0.indexeddb.leveldb/000001.ldb', 'indexed snapshot');
  write(f.roots.electron, 'IndexedDB/file__0.indexeddb.leveldb/000002.log', 'indexed journal');
  await backup({ ...f.options, archive: f.archive });
  write(f.roots.electron, 'Local Storage/leveldb/stale.ldb', 'stale preferences');
  write(f.roots.electron, 'IndexedDB/file__0.indexeddb.leveldb/stale.ldb', 'stale indexed data');
  write(f.roots.electron, 'runtime/qq/config/user-info.json', 'current synthetic session');
  write(f.roots.electron, 'Cache/current', 'cached');
  const result = await restore({ ...f.options, archive: f.archive });
  assert.deepEqual(fs.readdirSync(path.join(f.roots.electron, 'Local Storage/leveldb')).sort(), ['000001.log', 'CURRENT']);
  assert.deepEqual(fs.readdirSync(path.join(f.roots.electron, 'IndexedDB/file__0.indexeddb.leveldb')).sort(), ['000001.ldb', '000002.log']);
  assert.equal(fs.readFileSync(path.join(f.roots.electron, 'runtime/qq/config/user-info.json'), 'utf8'), 'current synthetic session');
  assert.equal(fs.readFileSync(path.join(f.roots.electron, 'Cache/current'), 'utf8'), 'cached');
  assert.equal(fs.existsSync(path.join(result.rollback.electron, 'Local Storage/leveldb/stale.ldb')), true);
});

test('restore overlays validated settings, removes stale SQLite sidecars and keeps a full rollback', async t => {
  const { backup, restore } = tooling(); const f = fixture(t);
  write(f.roots.backend, 'tiaolv-music.db', 'old db'); write(f.roots.electron, 'shortcuts.json', 'old settings');
  await backup({ ...f.options, archive: f.archive });
  write(f.roots.backend, 'tiaolv-music.db', 'new db'); write(f.roots.backend, 'tiaolv-music.db-wal', 'stale wal');
  write(f.roots.backend, 'tiaolv-music.db-shm', 'stale shm'); write(f.roots.backend, 'credentials/credential.key', 'current key');
  write(f.roots.electron, 'shortcuts.json', 'new settings');
  const result = await restore({ ...f.options, archive: f.archive });
  assert.equal(fs.readFileSync(path.join(f.roots.backend, 'tiaolv-music.db'), 'utf8'), 'old db');
  assert.equal(fs.existsSync(path.join(f.roots.backend, 'tiaolv-music.db-wal')), false);
  assert.equal(fs.existsSync(path.join(f.roots.backend, 'tiaolv-music.db-shm')), false);
  assert.equal(fs.readFileSync(path.join(f.roots.backend, 'credentials/credential.key'), 'utf8'), 'current key');
  assert.equal(fs.readFileSync(path.join(result.rollback.backend, 'tiaolv-music.db'), 'utf8'), 'new db');
  assert.equal(fs.readFileSync(path.join(result.rollback.backend, 'tiaolv-music.db-wal'), 'utf8'), 'stale wal');
});

test('restore validates every hash before touching either target', async t => {
  const { backup, restore } = tooling(); const f = fixture(t);
  write(f.roots.backend, 'tiaolv-music.db', 'db'); write(f.roots.electron, 'shortcuts.json', 'settings');
  await backup({ ...f.options, archive: f.archive });
  write(f.roots.backend, 'tiaolv-music.db', 'current');
  write(path.join(f.archive, 'electron'), 'shortcuts.json', 'tampered');
  await assert.rejects(restore({ ...f.options, archive: f.archive }), /hash|integrity/i);
  assert.equal(fs.readFileSync(path.join(f.roots.backend, 'tiaolv-music.db'), 'utf8'), 'current');
});

test('restore rejects traversal, unknown roots, duplicate paths and unapproved destinations', async t => {
  const { backup, restore } = tooling(); const f = fixture(t); write(f.roots.backend, 'tiaolv-music.db', 'db');
  await backup({ ...f.options, archive: f.archive });
  const manifestPath = path.join(f.archive, 'manifest.json'); const original = JSON.parse(fs.readFileSync(manifestPath));
  for (const file of [{ ...original.files[0], path: '../outside' }, { ...original.files[0], path: 'tiaolv-music.db.' },
    { ...original.files[0], path: 'CON' }, { ...original.files[0], root: 'other' }]) {
    fs.writeFileSync(manifestPath, JSON.stringify({ ...original, files: [file] }));
    await assert.rejects(restore({ ...f.options, archive: f.archive }), /path|root/i);
  }
  fs.writeFileSync(manifestPath, JSON.stringify({ ...original, files: [original.files[0], original.files[0]] }));
  await assert.rejects(restore({ ...f.options, archive: f.archive }), /duplicate/i);
  fs.writeFileSync(manifestPath, JSON.stringify(original));
  await assert.rejects(restore({ ...f.options, roots: { ...f.roots, backend: f.home }, archive: f.archive }), /approved|safe/i);
});

test('backup and restore reject symbolic links and junctions before mutation', async t => {
  const { backup, restore } = tooling(); const f = fixture(t);
  write(f.roots.backend, 'tiaolv-music.db', 'db');
  await backup({ ...f.options, archive: f.archive });
  const outside = path.join(f.home, 'outside'); fs.mkdirSync(outside); write(outside, 'value', 'private');
  fs.symlinkSync(outside, path.join(f.roots.electron, 'linked-directory'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(backup({ ...f.options, archive: `${f.archive}-second` }), /symbolic link|junction/i);
  await assert.rejects(restore({ ...f.options, archive: f.archive }), /symbolic link|junction/i);
  assert.equal(fs.readFileSync(path.join(f.roots.backend, 'tiaolv-music.db'), 'utf8'), 'db');
});

test('restore refuses a dangling directory link at an approved data root', async t => {
  const { backup, restore } = tooling(); const f = fixture(t); write(f.roots.backend, 'tiaolv-music.db', 'db');
  await backup({ ...f.options, archive: f.archive });
  const linked = path.join(f.home, 'dangling-root');
  fs.symlinkSync(path.join(f.home, 'missing-target'), linked, process.platform === 'win32' ? 'junction' : 'dir');
  const roots = { ...f.roots, electron: linked };
  await assert.rejects(restore({ ...f.options, roots, allowedRoots: roots, archive: f.archive }), /symbolic link|junction/i);
});

test('a failure during the second root swap restores both original directories', async t => {
  const { backup, restore } = tooling(); const f = fixture(t);
  write(f.roots.backend, 'tiaolv-music.db', 'snapshot'); write(f.roots.electron, 'shortcuts.json', 'snapshot');
  await backup({ ...f.options, archive: f.archive });
  write(f.roots.backend, 'tiaolv-music.db', 'current'); write(f.roots.electron, 'shortcuts.json', 'current');
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (to === f.roots.electron && from.includes('.restore-') && !from.endsWith('.failed')) throw new Error('Simulated disk failure');
    return rename(from, to);
  };
  try { await assert.rejects(restore({ ...f.options, archive: f.archive }), /Simulated disk failure/); }
  finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(path.join(f.roots.backend, 'tiaolv-music.db'), 'utf8'), 'current');
  assert.equal(fs.readFileSync(path.join(f.roots.electron, 'shortcuts.json'), 'utf8'), 'current');
});

test('credential inclusion needs an explicit option on backup and restore', async t => {
  const { backup, restore } = tooling(); const f = fixture(t);
  write(f.roots.backend, 'credentials/credential.key', 'secret');
  write(f.roots.electron, 'runtime/qq/config/user-info.json', JSON.stringify({ cookie: 'synthetic-cookie' }));
  const manifest = await backup({ ...f.options, archive: f.archive, includeCredentials: true });
  assert.equal(manifest.includesCredentials, true);
  assert.ok(manifest.files.some(file => file.root === 'electron' && file.path === 'runtime/qq/config/user-info.json'));
  await assert.rejects(restore({ ...f.options, archive: f.archive }), /credentials/i);
});

test('offline checks reject an occupied service port', async t => {
  const { assertPortsClosed } = tooling(); const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(assertPortsClosed([server.address().port]), /running|occupied/i);
});
