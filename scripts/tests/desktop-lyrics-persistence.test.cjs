const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('../../electron/node_modules/typescript');

function settingsHarness() {
  const source = fs.readFileSync(path.resolve(__dirname, '../../electron/src/main/main.ts'), 'utf8');
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    && ['readDesktopLyricsConfig', 'saveDesktopLyricsConfig'].includes(node.name?.text));
  assert.equal(functions.length, 2);
  const stored = { preferences: { enabled: true, fontSize: 38 },
    bounds: { x: 10, y: 20, width: 800, height: 120 } };
  const writes = [];
  const context = vm.createContext({ desktopLyricsConfigInitialized: false,
    desktopLyricsWindow: null, desktopLyricsConfig: { preferences: { enabled: false } },
    desktopLyricsConfigPath: () => 'synthetic-settings.json',
    DEFAULT_DESKTOP_LYRICS_PREFERENCES: {}, normalizeDesktopLyricsPreferences: value => value,
    readFileSync: () => JSON.stringify(stored),
    writeFile: (_file, value) => { writes.push(JSON.parse(value)); return Promise.resolve(); } });
  vm.runInContext(ts.transpileModule(functions.map(node => node.getText(ast)).join('\n'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { context, writes, stored };
}

test('startup failure before reading settings cannot overwrite existing desktop lyrics', () => {
  const { context, writes } = settingsHarness();
  context.saveDesktopLyricsConfig();
  assert.deepEqual(writes, []);
});

test('normal initialization preserves preferences and bounds during quit', () => {
  const { context, writes, stored } = settingsHarness();
  context.readDesktopLyricsConfig();
  context.saveDesktopLyricsConfig();
  assert.equal(context.desktopLyricsConfigInitialized, true);
  assert.deepEqual(writes, [stored]);
});
