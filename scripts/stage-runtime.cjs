const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const manifest = {
  schemaVersion: 1,
  javaExecutable: 'java/bin/java.exe',
  services: [
    { id: 'backend', kind: 'java', entry: 'backend/app.jar', cwd: 'backend', port: 17890, healthPath: '/health' },
    { id: 'netease', kind: 'node', entry: 'netease/launch.cjs', cwd: 'netease', port: 3000, healthPath: '/' },
    { id: 'qq', kind: 'node', entry: 'qq/launch.cjs', cwd: 'qq', port: 3300, healthPath: '/' }
  ]
};

const neteaseLauncher = `const fs = require('node:fs');
const path = require('node:path');
const { protectApiServer } = require('../local-access.cjs');
const token = path.join(require('node:os').tmpdir(), 'anonymous_token');
if (!fs.existsSync(token)) fs.writeFileSync(token, '', { mode: 0o600 });
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API port');
require('./server').serveNcmApi({ port, host: '127.0.0.1', checkVersion: false })
  .then((app) => {
    protectApiServer(app.server, port);
    app.server.on('error', () => { console.error('Netease API startup failed'); process.exitCode = 1; });
  })
  .catch(() => { console.error('Netease API startup failed'); process.exitCode = 1; });
// Anonymous configuration refresh does not delay local, offline readiness.
require('./generateConfig')().catch(() => console.error('Netease anonymous configuration refresh failed'));
`;

const qqLauncher = `const port = Number(process.env.PORT || 3300);
const { protectApiServer } = require('../local-access.cjs');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API port');
import('./dist/app.js').then(({ default: app }) => {
  const server = protectApiServer(app.listen(port, '127.0.0.1'), port);
  server.on('error', () => { console.error('QQ API startup failed'); process.exitCode = 1; });
}).catch(() => { console.error('QQ API initialization failed'); process.exitCode = 1; });
`;

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function assertWorkspacePath(root, target) {
  if (!isWithin(root, target)) throw new Error(`Runtime destination must stay inside the workspace: ${target}`);
  let existing = target;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error('Cannot resolve runtime destination');
    existing = parent;
  }
  const real = fs.realpathSync(existing);
  if (real !== root && !isWithin(root, real)) throw new Error(`Runtime destination escapes workspace through a symbolic link or junction: ${target}`);
}

function removeWorkspacePath(root, target) {
  assertWorkspacePath(root, target);
  fs.rmSync(target, { recursive: true, force: true });
}

function excluded(filename) {
  return /^\.env(?:\.|$)/i.test(filename) || /\.log(?:\.|$)/i.test(filename)
    || /^(?:\.git|\.npmrc|\.pnpmfile\.cjs|logs?|credentials?(?:\.json)?|accounts?\.json|user-info\.json|anonymous_token|xeapi_public_key|local-access\.token)$/i.test(filename)
    || /\.(?:sqlite3?|db|db-wal|db-shm)$/i.test(filename);
}

function copyResource(source, destination, required = true) {
  if (!fs.existsSync(source)) {
    if (required) throw new Error(`Required runtime input is missing: ${source}`);
    return;
  }
  const sourceRoot = fs.realpathSync(source);
  fs.cpSync(source, destination, {
    recursive: true,
    dereference: true,
    filter: (filename) => {
      if (excluded(path.basename(filename))) return false;
      const real = fs.realpathSync(filename);
      if (real !== sourceRoot && !isWithin(sourceRoot, real)) throw new Error(`Runtime input contains an escaping symbolic link: ${filename}`);
      return true;
    }
  });
}

function resolveBatchCommand(command, env = process.env, cwd = process.cwd()) {
  const pathValue = env.PATH ?? env.Path ?? Object.entries(env).find(([name]) => name.toLowerCase() === 'path')?.[1] ?? '';
  const candidates = path.isAbsolute(command) || /[\\/]/.test(command)
    ? [path.resolve(cwd, command)]
    : [cwd, ...pathValue.split(path.delimiter).map((entry) => entry.replace(/^"(.*)"$/, '$1'))]
      .map((directory) => path.resolve(cwd, directory, command));
  for (const candidate of candidates) {
    if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) return candidate;
  }
  throw new Error(`Cannot find ${command} in the current PATH`);
}

function commandRunner(command, args, options) {
  let executable = command;
  let commandArgs = args;
  if (process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command)) {
    const batchCommand = resolveBatchCommand(command, options.env, options.cwd);
    const quote = (value) => {
      if (/["%\r\n!&|<>^]/.test(value)) throw new Error('Unsupported shell characters in build command');
      return `"${value}"`;
    };
    executable = process.env.ComSpec || 'cmd.exe';
    commandArgs = ['/d', '/s', '/c', `"${[batchCommand, ...args].map(quote).join(' ')}"`];
  }
  const result = spawnSync(executable, commandArgs, {
    cwd: options.cwd,
    env: options.env,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    windowsVerbatimArguments: executable !== command
  });
  if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status ?? result.signal}`);
  return result;
}

function requireFile(root, relative) {
  const filename = path.join(root, relative);
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile() || fs.statSync(filename).size === 0) throw new Error(`Required runtime file is missing or empty: ${relative}`);
}

function validateRuntime(directory) {
  for (const relative of [manifest.javaExecutable, 'java/release', 'local-access.cjs', 'backend/app.jar', 'netease/server.js', 'netease/main.js', 'netease/generateConfig.js', 'netease/module', 'netease/util', 'netease/public', 'netease/data', 'netease/LICENSE', 'qq/dist/app.js', 'qq/public', 'qq/LICENSE']) {
    const filename = path.join(directory, relative);
    if (!fs.existsSync(filename)) throw new Error(`Required runtime resource is missing: ${relative}`);
  }
  for (const service of manifest.services) requireFile(directory, service.entry);
  requireFile(directory, manifest.javaExecutable);
  if (!/^JAVA_VERSION="21(?:\.|["+])/m.test(fs.readFileSync(path.join(directory, 'java/release'), 'utf8'))) throw new Error('Staged Java runtime must be Java 21');
  if (!fs.readdirSync(path.join(directory, 'java/legal')).length) throw new Error('Java runtime license notices are missing');
  const header = Buffer.alloc(4);
  const jar = fs.openSync(path.join(directory, 'backend/app.jar'), 'r');
  try { fs.readSync(jar, header, 0, 4, 0); } finally { fs.closeSync(jar); }
  if (!header.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw new Error('Backend output is not a jar archive');
  for (const id of ['netease', 'qq']) {
    const api = path.join(directory, id);
    const pkg = JSON.parse(fs.readFileSync(path.join(api, 'package.json'), 'utf8'));
    for (const dependency of Object.keys(pkg.dependencies || {})) {
      requireFile(api, `node_modules/${dependency}/package.json`);
    }
  }
  const inspect = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filename = path.join(current, entry.name);
      if (excluded(entry.name)) throw new Error(`Private or development file found in staged runtime: ${filename}`);
      if (entry.isSymbolicLink()) throw new Error(`Staged runtime must not contain symbolic links: ${filename}`);
      if (entry.isDirectory()) inspect(filename);
    }
  };
  inspect(directory);
}

function removePrivateDependencyFiles(root, directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (excluded(entry.name)) removeWorkspacePath(root, filename);
    else if (entry.isDirectory()) removePrivateDependencyFiles(root, filename);
  }
}

async function stageRuntime(options = {}) {
  if ((options.platform || process.platform) !== 'win32') throw new Error('Windows runtime staging requires a Windows Java 21 JDK');
  const root = fs.realpathSync(path.resolve(options.root || path.join(__dirname, '..')));
  const resources = path.join(root, 'electron/resources');
  const destination = path.join(resources, 'runtime');
  assertWorkspacePath(root, destination);
  const javaHome = path.resolve(options.javaHome || process.env.JAVA_HOME || 'C:/Program Files/Java/jdk-21');
  const jlink = path.join(javaHome, 'bin/jlink.exe');
  requireFile(javaHome, 'bin/jlink.exe');
  requireFile(javaHome, 'jmods/java.base.jmod');
  const npmCommand = options.npmCommand || process.env.TIAOLV_NPM || 'npm';
  const pnpmCommand = options.pnpmCommand || process.env.TIAOLV_PNPM || 'pnpm';
  const mavenCommand = options.mavenCommand || process.env.TIAOLV_MAVEN || 'mvn.cmd';
  const runCommand = options.runCommand || commandRunner;
  const env = { ...process.env, JAVA_HOME: javaHome, CI: 'true' };
  const run = async (command, args, cwd) => {
    const result = await runCommand(command, args, { cwd, env });
    if (result && result.status !== undefined && result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
  };
  fs.mkdirSync(resources, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(resources, '.runtime-stage-'));
  let backup;
  try {
    const backend = path.join(root, 'backend');
    const qq = path.join(root, 'music-api/qq-music-api');
    const netease = path.join(root, 'music-api/api-enhanced');
    for (const input of [path.join(backend, 'pom.xml'), path.join(qq, 'package-lock.json'), path.join(netease, 'pnpm-lock.yaml')]) if (!fs.existsSync(input)) throw new Error(`Missing runtime build input: ${input}`);
    await run(mavenCommand, ['-B', 'package'], backend);
    const jars = fs.readdirSync(path.join(backend, 'target')).filter((name) => name.endsWith('.jar'));
    if (jars.length !== 1) throw new Error('Expected exactly one runnable backend jar in backend/target');
    copyResource(path.join(backend, 'target', jars[0]), path.join(temporary, 'backend/app.jar'));
    await run(npmCommand, ['run', 'build:core'], qq);
    await run(jlink, ['--module-path', path.join(javaHome, 'jmods'), '--add-modules', 'java.se,jdk.crypto.ec,jdk.unsupported,jdk.zipfs,jdk.charsets', '--strip-debug', '--no-header-files', '--no-man-pages', '--compress=2', '--output', path.join(temporary, 'java')], root);
    const apiCopies = [
      { id: 'netease', source: netease, required: ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'app.js', 'server.js', 'main.js', 'generateConfig.js', 'module', 'util', 'public', 'data', 'LICENSE'], optional: ['plugins', 'THIRD_PARTY_NOTICES.md'] },
      { id: 'qq', source: qq, required: ['package.json', 'package-lock.json', 'dist', 'public', 'LICENSE'], optional: ['docs-dist', 'THIRD_PARTY_NOTICES.md'] }
    ];
    for (const api of apiCopies) {
      const output = path.join(temporary, api.id);
      for (const relative of api.required) copyResource(path.join(api.source, relative), path.join(output, relative));
      for (const relative of api.optional) copyResource(path.join(api.source, relative), path.join(output, relative), false);
    }
    const offline = options.offline !== false ? ['--offline'] : [];
    await run(pnpmCommand, ['install', '--prod', '--frozen-lockfile', '--ignore-scripts', '--config.node-linker=hoisted', '--config.package-import-method=copy', ...offline], path.join(temporary, 'netease'));
    await run(npmCommand, ['ci', '--omit=dev', '--ignore-scripts', '--workspaces=false', '--no-audit', '--no-fund', ...offline], path.join(temporary, 'qq'));
    for (const id of ['netease', 'qq']) removePrivateDependencyFiles(root, path.join(temporary, id, 'node_modules'));
    copyResource(path.join(__dirname, 'runtime-local-access.cjs'), path.join(temporary, 'local-access.cjs'));
    fs.writeFileSync(path.join(temporary, 'netease/launch.cjs'), neteaseLauncher);
    fs.writeFileSync(path.join(temporary, 'qq/launch.cjs'), qqLauncher);
    validateRuntime(temporary);
    fs.writeFileSync(path.join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    assertWorkspacePath(root, destination);
    if (fs.existsSync(destination)) {
      backup = fs.mkdtempSync(path.join(resources, '.runtime-previous-'));
      fs.rmdirSync(backup);
      fs.renameSync(destination, backup);
    }
    try {
      fs.renameSync(temporary, destination);
    } catch (error) {
      if (backup) fs.renameSync(backup, destination);
      throw error;
    }
    if (backup) removeWorkspacePath(root, backup);
    return structuredClone(manifest);
  } finally {
    if (fs.existsSync(temporary)) removeWorkspacePath(root, temporary);
  }
}

module.exports = { stageRuntime, validateRuntime, commandRunner, resolveBatchCommand };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--online')) {
    console.error('Usage: node scripts/stage-runtime.cjs [--online]');
    process.exitCode = 1;
  } else {
    stageRuntime({ offline: !args.includes('--online') }).then(() => {
      console.log('Validated Windows runtime staged at electron/resources/runtime');
    }).catch((error) => {
      console.error(`Runtime staging failed: ${error.message}`);
      process.exitCode = 1;
    });
  }
}
