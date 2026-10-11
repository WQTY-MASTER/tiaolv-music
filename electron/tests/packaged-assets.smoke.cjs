const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const local = createRequire(path.join(root, 'package.json'));
const asar = createRequire(local.resolve('electron-builder'))('@electron/asar');
const pkg = local('./package.json');
const packaged = path.join(root, 'release/win-unpacked');

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const built = files(path.join(root, 'out'));
for (const file of built) {
  const entry = path.relative(root, file);
  assert.ok(asar.extractFile(path.join(packaged, 'resources/app.asar'), entry).equals(fs.readFileSync(file)), `Packaged build differs: ${entry}`);
}
assert.ok(fs.readFileSync(path.join(packaged, 'resources/app-icon.png')).equals(fs.readFileSync(path.join(root, 'resources/app-icon.png'))));

function iconGroups(filename) {
  const bytes = fs.readFileSync(filename);
  const pe = bytes.readUInt32LE(0x3c);
  assert.equal(bytes.subarray(pe, pe + 4).toString('hex'), '50450000');
  const optional = pe + 24;
  const directory = optional + (bytes.readUInt16LE(optional) === 0x20b ? 112 : 96);
  const sectionStart = optional + bytes.readUInt16LE(pe + 20);
  const sections = Array.from({ length: bytes.readUInt16LE(pe + 6) }, (_, i) => {
    const offset = sectionStart + i * 40;
    return { rva: bytes.readUInt32LE(offset + 12), size: Math.max(bytes.readUInt32LE(offset + 8), bytes.readUInt32LE(offset + 16)), file: bytes.readUInt32LE(offset + 20) };
  });
  const fileOffset = rva => {
    const section = sections.find(section => rva >= section.rva && rva < section.rva + section.size);
    assert.ok(section, 'PE resource must belong to a section');
    return section.file + rva - section.rva;
  };
  const resources = fileOffset(bytes.readUInt32LE(directory + 16));
  const entries = relative => {
    const offset = resources + relative;
    const count = bytes.readUInt16LE(offset + 12) + bytes.readUInt16LE(offset + 14);
    return Array.from({ length: count }, (_, i) => {
      const entry = offset + 16 + i * 8;
      return { id: bytes.readUInt32LE(entry), child: bytes.readUInt32LE(entry + 4) & 0x7fffffff };
    });
  };
  const data = entry => {
    const language = entries(entry.child)[0];
    assert.ok(language, 'Resource must have a language entry');
    const offset = resources + language.child;
    const start = fileOffset(bytes.readUInt32LE(offset));
    return bytes.subarray(start, start + bytes.readUInt32LE(offset + 4));
  };
  const types = entries(0);
  const groupType = types.find(entry => entry.id === 14);
  const iconType = types.find(entry => entry.id === 3);
  assert.ok(groupType && iconType, 'Executable must contain icon group and image resources');
  const images = new Map(entries(iconType.child).map(entry => [entry.id, data(entry)]));
  return entries(groupType.child).map(entry => {
    const group = data(entry);
    return Array.from({ length: group.readUInt16LE(4) }, (_, i) => {
      const offset = 6 + i * 14;
      return { size: group[offset] || 256, bytes: images.get(group.readUInt16LE(offset + 12)) };
    });
  });
}
const ico = fs.readFileSync(path.join(root, 'resources/app-icon.ico'));
const expected = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
  const entry = 6 + i * 16, offset = ico.readUInt32LE(entry + 12);
  return { size: ico[entry] || 256, bytes: ico.subarray(offset, offset + ico.readUInt32LE(entry + 8)) };
});
for (const exe of [path.join(packaged, `${pkg.productName}.exe`), path.join(root, 'release', `${pkg.productName} Setup ${pkg.version}.exe`)]) {
  const groups = iconGroups(exe);
  assert.ok(groups.some(group => expected.every(frame => group.some(item => item.size === frame.size && item.bytes?.equals(frame.bytes)))), `Executable must embed the exact new multi-size ICO: ${path.basename(exe)}`);
}
local('../scripts/stage-runtime.cjs').validateRuntime(path.join(packaged, 'resources/runtime'));
for (const file of ['backend/app.jar', 'netease/server.js', 'qq/dist/app.js', 'local-access.cjs']) {
  assert.ok(fs.readFileSync(path.join(root, 'resources/runtime', file)).equals(fs.readFileSync(path.join(packaged, 'resources/runtime', file))), `Packaged runtime differs: ${file}`);
}
const qqDist = files(path.join(root, 'resources/runtime/qq/dist'));
for (const file of qqDist) {
  const entry = path.relative(path.join(root, 'resources/runtime'), file);
  assert.ok(fs.readFileSync(path.join(packaged, 'resources/runtime', entry)).equals(fs.readFileSync(file)), `Packaged QQ runtime differs: ${entry}`);
}
console.log(`Packaged assets passed: ${built.length} build entries, matching PNG, nine exact ICO frames in app/installer PE resources, validated runtime and matching service files`);
console.log(`All ${qqDist.length} QQ dist files match, including hashed server chunks`);
