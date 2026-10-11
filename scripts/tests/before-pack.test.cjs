const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createRequire } = require('node:module');

test('packaging requires validated runtime resources and Windows x64', async () => {
  const beforePack = require('../../electron/scripts/before-pack.cjs');
  const root = path.resolve(__dirname, '../../electron');
  assert.throws(() => beforePack({ packager: { info: { appDir: root } }, electronPlatformName: 'linux', arch: 1 }), /Windows x64/);
  assert.throws(() => beforePack({ packager: { info: { appDir: root } }, electronPlatformName: 'win32', arch: 3 }), /Windows x64/);
  assert.throws(() => beforePack({ packager: { info: { appDir: path.join(__dirname, 'missing-electron') } }, electronPlatformName: 'win32', arch: 1 }), /runtime|missing|ENOENT/i);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(config.build.beforePack, 'scripts/before-pack.cjs');
});

test('Windows installer offers a directory wizard and preserves user data', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../electron/package.json'), 'utf8'));
  assert.equal(config.build.nsis?.oneClick, false);
  assert.equal(config.build.nsis?.allowToChangeInstallationDirectory, true);
  assert.equal(config.build.nsis?.perMachine, false);
  assert.equal(config.build.nsis?.runAfterFinish, true);
  assert.equal(config.build.nsis?.deleteAppDataOnUninstall, false);
});

test('Windows startup suppresses the default menu before readiness without removing tray or window controls', () => {
  const root = path.resolve(__dirname, '../../electron');
  const ts = createRequire(path.join(root, 'package.json'))('typescript');
  const source = fs.readFileSync(path.join(root, 'src/main/main.ts'), 'utf8');
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
  const calls = [];
  const visit = node => {
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const removal = calls.find(node => node.expression.getText(ast) === 'Menu.setApplicationMenu');
  assert.ok(removal, 'Windows must remove Electron default menus');
  assert.equal(removal.arguments.length, 1);
  assert.equal(removal.arguments[0].kind, ts.SyntaxKind.NullKeyword);
  assert.ok(ts.isExpressionStatement(removal.parent));
  const guard = removal.parent.parent;
  assert.ok(ts.isIfStatement(guard));
  assert.equal(guard.expression.getText(ast), 'process.platform === "win32"');
  const ready = calls.find(node => node.expression.getText(ast) === 'app.whenReady');
  assert.ok(ready && removal.pos < ready.pos, 'Menu suppression must precede app readiness');
  assert.ok(calls.some(node => node.expression.getText(ast) === 'Menu.buildFromTemplate'), 'Tray menus remain available');
  const createWindow = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindow');
  const declarations = createWindow.body.statements[0].declarationList.declarations;
  const options = declarations[0].initializer.arguments[0];
  const frame = options.properties.find(node => node.name?.getText(ast) === 'frame');
  assert.ok(!frame || frame.initializer.kind === ts.SyntaxKind.TrueKeyword, 'Keep native window controls');
});
