const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');

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
const run = (code, context) => vm.runInNewContext(ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText, context);

function windowOptions(platform) {
  const node = ast.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === 'createWindow');
  let options;
  class Window {
    constructor(value) { options = value; }
    webContents = { setWindowOpenHandler() {} };
    on() {}
    loadFile() { return Promise.resolve(); }
  }
  run(`let mainWindow; ${node.getText(ast)}; createWindow();`, {
    BrowserWindow: Window, process: { platform }, applicationIconPath: () => 'icon.ico',
    path, __dirname: '.', rendererUrl: undefined,
    restrictWindowNavigation() {}, attachWindowShortcuts() {}
  });
  return options;
}

test('Windows main window blends native caption buttons into the renderer', () => {
  const options = windowOptions('win32');
  assert.equal(options.titleBarStyle, 'hidden');
  assert.equal(options.titleBarOverlay.color, '#00000000');
  assert.equal(options.titleBarOverlay.symbolColor, '#27313c');
  assert.equal(options.titleBarOverlay.height, 32);
  assert.notEqual(options.frame, false, 'Keep native caption and resizing behavior');
});

test('other platforms retain their existing window chrome', () => {
  for (const platform of ['darwin', 'linux']) {
    const options = windowOptions(platform);
    assert.equal(options.titleBarStyle, undefined);
    assert.equal(options.titleBarOverlay, undefined);
  }
});

function themeHandler(platform = 'win32') {
  const node = calls.find(item => item.expression.getText(ast) === 'ipcMain.handle'
    && item.arguments[0]?.text === 'set-window-titlebar-theme');
  assert.ok(node, 'Theme IPC handler must exist');
  let handler;
  const applied = [];
  const sender = {};
  const window = { setTitleBarOverlay: value => applied.push(value) };
  run(node.getText(ast), {
    ipcMain: { handle: (_name, value) => { handler = value; } },
    process: { platform }, mainWindow: window,
    BrowserWindow: { fromWebContents: value => value === sender ? window : null }
  });
  return { handler, applied, sender };
}

test('only the Windows main renderer may set validated caption contrast', () => {
  const { handler, applied, sender } = themeHandler();
  assert.equal(handler({ sender: {} }, true), false);
  for (const value of [undefined, 'dark', 1, null, {}, '#ffffff']) {
    assert.equal(handler({ sender }, value), false);
  }
  assert.equal(applied.length, 0);
  assert.equal(handler({ sender }, true), true);
  assert.equal(handler({ sender }, false), true);
  assert.deepEqual(JSON.parse(JSON.stringify(applied)), [
    { color: '#00000000', symbolColor: '#edf1f7', height: 32 },
    { color: '#00000000', symbolColor: '#27313c', height: 32 }
  ]);
});

test('non-Windows theme IPC does not change native window chrome', () => {
  const { handler, applied, sender } = themeHandler('linux');
  assert.equal(handler({ sender }, true), false);
  assert.equal(applied.length, 0);
});

test('caption contrast follows visible page rather than only the global theme', () => {
  const localRequire = createRequire(path.join(root, 'package.json'));
  const { parse } = localRequire('vue/compiler-sfc');
  const app = fs.readFileSync(path.join(root, 'src/renderer/src/App.vue'), 'utf8');
  const script = ts.createSourceFile('App.ts', parse(app).descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
  const declaration = script.statements.filter(ts.isVariableStatement)
    .flatMap(node => [...node.declarationList.declarations])
    .find(node => node.name.getText(script) === 'windowTitlebarDark');
  assert.ok(declaration, 'Caption contrast must account for the visible song-detail surface');
  for (const [dark, detail, image, expected] of [
    [false, false, false, false], [true, false, false, true],
    [true, true, false, false], [true, true, true, true], [false, true, true, false]
  ]) {
    const context = { computed: fn => fn(), appearanceDarkMode: { value: dark },
      showSongDetail: { value: detail }, hasConfiguredBackgroundImage: { value: image } };
    run(`result = ${declaration.initializer.getText(script)};`, context);
    assert.equal(context.result, expected);
  }
  assert.match(app, /<WindowTitlebar\s+:dark="windowTitlebarDark"/);
});
