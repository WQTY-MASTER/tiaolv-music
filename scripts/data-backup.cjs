const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT_NAMES = ['backend', 'electron'];
const SERVICE_PORTS = [17890, 3000, 3300];

function defaultRoots() {
  return { backend: path.join(os.homedir(), '.tiaolv-music'),
    electron: path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '\u8c03\u5f8b\u97f3\u4e50') };
}

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function noLinks(target) {
  let current = path.resolve(target);
  for (;;) {
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error(`Unsafe symbolic link or junction: ${current}`);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function validateRoots(options) {
  const roots = options.roots || defaultRoots();
  const allowed = options.allowedRoots || defaultRoots();
  const resolved = {};
  for (const name of ROOT_NAMES) {
    if (!roots[name] || !allowed[name]) throw new Error(`Missing approved ${name} root`);
    const target = path.resolve(roots[name]);
    if (target !== path.resolve(allowed[name]) || target === path.parse(target).root || target === path.resolve(os.homedir())) {
      throw new Error(`Destination is not an approved safe ${name} root`);
    }
    noLinks(target);
    if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) throw new Error(`Root must be a directory: ${name}`);
    resolved[name] = target;
  }
  if (inside(resolved.backend, resolved.electron) || inside(resolved.electron, resolved.backend)) throw new Error('Data roots must not overlap');
  return resolved;
}

function validateArchive(archive, roots) {
  if (!archive) throw new Error('An archive directory is required');
  const target = path.resolve(archive);
  noLinks(target);
  for (const root of Object.values(roots)) {
    if (inside(root, target) || inside(target, root)) throw new Error('Archive and data roots must not overlap');
  }
  return target;
}

function credentialPath(relative) {
  return /(?:^|\/)runtime\/qq\/config(?:\/|$)/i.test(relative)
    || relative.split('/').some(part => /^(credentials?|tokens?|cookies?|sessions?|session storage|network|user-info\.json)$/i.test(part)
    || /(?:credential|cookie|token|anonymous_token|xeapi_public_key)/i.test(part)
    || /\.(key|pem|pfx)$/i.test(part));
}

function excluded(relative, includeCredentials) {
  const parts = relative.split('/');
  if (!includeCredentials && credentialPath(relative)) return true;
  return parts.some(part => /^(cache|caches|code cache|gpucache|dawncache|shadercache|grshadercache|logs|crashpad|blob_storage|service worker|\.tiaolv-music-cache|provider-cache|audio-cache|background-image-cache)$/i.test(part))
    || (/\.log$/i.test(relative) && !parts.some(part => /^(local storage|leveldb)$/i.test(part) || /\.leveldb$/i.test(part)));
}

function walk(directory, filter = () => true, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const source = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unsafe symbolic link in data: ${relative}`);
    if (!filter(relative)) continue;
    if (entry.isDirectory()) files.push(...walk(source, filter, relative));
    else if (entry.isFile()) files.push({ path: relative, source });
    else throw new Error(`Unsupported data entry: ${relative}`);
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

async function assertPortsClosed(ports = SERVICE_PORTS) {
  for (const port of ports) {
    for (const host of ['127.0.0.1', '::1']) {
      await new Promise((resolve, reject) => {
        const socket = net.connect({ host, port });
        socket.setTimeout(1000);
        socket.once('connect', () => { socket.destroy(); reject(new Error(`Service port ${port} is occupied; close the app and backend/API services first`)); });
        socket.once('error', error => {
          socket.destroy();
          if (['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EADDRNOTAVAIL'].includes(error.code)) resolve();
          else reject(error);
        });
        socket.once('timeout', () => { socket.destroy(); reject(new Error(`Cannot verify offline port ${port}`)); });
      });
    }
  }
}

async function assertOffline() {
  await assertPortsClosed();
  let result;
  if (process.platform === 'win32') {
    result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "[bool](@(Get-Process -ErrorAction Stop | Where-Object { $_.ProcessName -match '^(electron|tiaolv-music-electron|tiaolv-music|\u8c03\u5f8b\u97f3\u4e50)$' }).Count -gt 0) | ConvertTo-Json -Compress"], { encoding: 'utf8', windowsHide: true });
  } else result = spawnSync('ps', ['-A', '-o', 'comm='], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error('Cannot verify that the desktop app is closed; process inspection failed');
  const windowsResult = process.platform === 'win32' ? JSON.parse(result.stdout) : null;
  if (process.platform === 'win32' && typeof windowsResult !== 'boolean') throw new Error('Invalid desktop process inspection result');
  const running = process.platform === 'win32' ? windowsResult : result.stdout.split('\n').some(name =>
    /^(electron|tiaolv-music-electron|tiaolv-music|\u8c03\u5f8b\u97f3\u4e50)(\.exe)?$/i.test(path.basename(name.trim())));
  if (running) {
    throw new Error('Desktop app is running; close all Electron/music app processes before backup or restore');
  }
}

async function backup(options) {
  const roots = validateRoots(options);
  const archive = validateArchive(options.archive, roots);
  if (fs.existsSync(archive)) throw new Error('Archive already exists; choose a new directory');
  for (const root of Object.values(roots)) if (!fs.existsSync(root)) throw new Error(`Data root does not exist: ${root}`);
  const offline = options.offlineCheck || assertOffline;
  await offline();
  const partial = `${archive}.partial-${crypto.randomUUID()}`;
  fs.mkdirSync(partial, { recursive: true });
  const manifest = { format: 'tiaolv-offline-backup', version: 1, createdAt: new Date().toISOString(),
    includesCredentials: options.includeCredentials === true, roots: ROOT_NAMES, files: [] };
  for (const name of ROOT_NAMES) {
    for (const file of walk(roots[name], relative => !excluded(relative, manifest.includesCredentials))) {
      const target = path.join(partial, name, file.path);
      copyFile(file.source, target);
      const hash = digest(target);
      if (hash !== digest(file.source)) throw new Error('Source changed during backup; close all services and retry');
      manifest.files.push({ root: name, path: file.path, size: fs.statSync(target).size, sha256: hash });
    }
    fs.mkdirSync(path.join(partial, name), { recursive: true });
  }
  await offline();
  fs.writeFileSync(path.join(partial, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  fs.renameSync(partial, archive);
  return manifest;
}

function safeRelative(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.includes(':')
    && !/[\x00-\x1f<>"|?*]/.test(value) && !value.startsWith('/')
    && value.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part)
      && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}

function validateManifest(archive, includeCredentials) {
  noLinks(path.join(archive, 'manifest.json'));
  const manifest = JSON.parse(fs.readFileSync(path.join(archive, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'tiaolv-offline-backup' || manifest.version !== 1 || !Array.isArray(manifest.files)
    || typeof manifest.includesCredentials !== 'boolean' || JSON.stringify(manifest.roots) !== JSON.stringify(ROOT_NAMES)) {
    throw new Error('Unsupported or invalid backup manifest');
  }
  if (manifest.includesCredentials && !includeCredentials) throw new Error('Backup includes credentials; restore requires --include-credentials');
  const seen = new Set();
  for (const file of manifest.files) {
    if (!ROOT_NAMES.includes(file.root)) throw new Error('Unknown manifest root');
    if (!safeRelative(file.path)) throw new Error('Unsafe manifest path');
    const key = `${file.root}/${file.path}`.toLowerCase();
    if (seen.has(key)) throw new Error('Duplicate manifest path');
    seen.add(key);
    if (!manifest.includesCredentials && credentialPath(file.path)) throw new Error('Unexpected credentials in backup');
    if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid file integrity metadata');
    const source = path.join(archive, file.root, file.path);
    noLinks(source);
    const stat = fs.statSync(source);
    if (!stat.isFile() || stat.size !== file.size || digest(source) !== file.sha256) throw new Error(`Backup integrity/hash mismatch: ${file.root}/${file.path}`);
  }
  return manifest;
}

async function restore(options) {
  const roots = validateRoots(options);
  const archive = validateArchive(options.archive, roots);
  const manifest = validateManifest(archive, options.includeCredentials === true);
  const offline = options.offlineCheck || assertOffline;
  await offline();
  const identifier = crypto.randomUUID();
  const stages = {}; const rollback = {}; const moved = []; const installed = [];
  for (const name of ROOT_NAMES) {
    stages[name] = `${roots[name]}.restore-${identifier}`;
    rollback[name] = `${roots[name]}.rollback-${identifier}`;
    fs.mkdirSync(stages[name], { recursive: true });
    if (fs.existsSync(roots[name])) {
      for (const file of walk(roots[name])) copyFile(file.source, path.join(stages[name], file.path));
    }
    const snapshots = new Set();
    for (const file of manifest.files.filter(file => file.root === name)) {
      const localStorage = file.path.match(/^(Local Storage\/leveldb)\//i);
      if (localStorage) snapshots.add(localStorage[1]);
      const parts = file.path.split('/');
      const indexedDb = parts.findIndex(part => /^IndexedDB$/i.test(part));
      if (indexedDb >= 0) {
        for (let index = indexedDb + 1; index < parts.length - 1; index++) {
          if (/\.leveldb$/i.test(parts[index])) snapshots.add(parts.slice(0, index + 1).join('/'));
        }
      }
    }
    // LevelDB files belong to one snapshot, just like a SQLite database and WAL.
    for (const directory of snapshots) {
      const target = path.resolve(stages[name], directory);
      if (!safeRelative(directory) || target === stages[name] || !inside(stages[name], target)) throw new Error('Unsafe staged snapshot directory');
      noLinks(target);
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: false });
    }
    // Never reuse WAL/SHM from a different SQLite database snapshot.
    for (const file of manifest.files.filter(file => file.root === name && /\.(db|sqlite|sqlite3)$/i.test(file.path))) {
      for (const suffix of ['-wal', '-shm', '-journal']) {
        const stale = path.join(stages[name], `${file.path}${suffix}`);
        if (fs.existsSync(stale)) fs.unlinkSync(stale);
      }
    }
    for (const file of manifest.files.filter(file => file.root === name)) {
      const target = path.join(stages[name], file.path);
      copyFile(path.join(archive, name, file.path), target);
      if (digest(target) !== file.sha256) throw new Error('Backup changed during restore staging');
    }
  }
  await offline();
  try {
    for (const name of ROOT_NAMES) {
      noLinks(roots[name]);
      if (fs.existsSync(roots[name])) { fs.renameSync(roots[name], rollback[name]); moved.push(name); }
      else rollback[name] = null;
      fs.renameSync(stages[name], roots[name]); installed.push(name);
    }
  } catch (error) {
    for (const name of installed.reverse()) fs.renameSync(roots[name], `${stages[name]}.failed`);
    for (const name of moved.reverse()) fs.renameSync(rollback[name], roots[name]);
    throw error;
  }
  return { rollback, files: manifest.files.length };
}

function cliOptions(argv) {
  const mode = argv[0]; const options = { roots: defaultRoots() };
  for (let index = 1; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--include-credentials') { options.includeCredentials = true; continue; }
    if (!['--archive', '--backend-root', '--electron-root'].includes(flag) || !argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`Invalid argument: ${flag}`);
    const value = path.resolve(argv[++index]);
    if (flag === '--archive') options.archive = value;
    else {
      const name = flag === '--backend-root' ? 'backend' : 'electron';
      const allowedNames = name === 'backend' ? ['.tiaolv-music'] : ['\u8c03\u5f8b\u97f3\u4e50', 'tiaolv-music-electron', 'electron-user-data'];
      if (!allowedNames.includes(path.basename(value))) throw new Error(`Unsafe custom ${name} root name; use ${allowedNames.join(', ')}`);
      options.roots[name] = value;
    }
  }
  options.allowedRoots = { ...options.roots };
  if (!['backup', 'restore'].includes(mode) || !options.archive) throw new Error('Usage: node scripts/data-backup.cjs backup|restore --archive DIRECTORY [--backend-root .../.tiaolv-music] [--electron-root .../electron-user-data] [--include-credentials]');
  return { mode, options };
}

async function main() {
  const { mode, options } = cliOptions(process.argv.slice(2));
  if (options.includeCredentials) console.warn('PRIVATE BACKUP: credential keys, cookies and local access tokens may be included. Keep this directory private and offline.');
  const result = await (mode === 'backup' ? backup : restore)(options);
  console.log(JSON.stringify(mode === 'backup' ? { archive: path.resolve(options.archive), files: result.files.length, includesCredentials: result.includesCredentials } : result, null, 2));
}

module.exports = { backup, restore, assertPortsClosed, assertOffline, validateManifest, cliOptions };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
