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

function createdWindow(platform) {
  const node = ast.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === 'createWindow');
  let options;
  let window;
  class Window {
    constructor(value) { options = value; window = this; }
    events = new Map();
    messages = [];
    maximized = false;
    webContents = { setWindowOpenHandler() {}, send: (...args) => this.messages.push(args) };
    on(name, handler) { this.events.set(name, handler); }
    isMaximized() { return this.maximized; }
    loadFile() { return Promise.resolve(); }
  }
  run(`let mainWindow; ${node.getText(ast)}; createWindow();`, {
    BrowserWindow: Window, process: { platform }, applicationIconPath: () => 'icon.ico',
    path, __dirname: '.', rendererUrl: undefined,
    restrictWindowNavigation() {}, attachWindowShortcuts() {}
  });
  return { options, window };
}

test('Windows uses custom captions without the native red close overlay', () => {
  const { options } = createdWindow('win32');
  assert.equal(options.titleBarStyle, 'hidden');
  assert.equal(options.titleBarOverlay, undefined);
  assert.notEqual(options.frame, false, 'Keep native frame and resizing behavior');
});

test('other platforms retain their existing window chrome', () => {
  for (const platform of ['darwin', 'linux']) {
    const { options } = createdWindow(platform);
    assert.equal(options.titleBarStyle, undefined);
    assert.equal(options.titleBarOverlay, undefined);
  }
});

function captionHandler(channel, platform = 'win32') {
  const node = calls.find(item => item.expression.getText(ast) === 'ipcMain.handle'
    && item.arguments[0]?.text === channel);
  assert.ok(node, `${channel} IPC handler must exist`);
  const helper = ast.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === 'mainCaptionWindow');
  assert.ok(helper, 'Caption IPC must share the main-window identity guard');
  let handler;
  const actions = [];
  const sender = { mainFrame: {} };
  const window = {
    destroyed: false, maximized: false, webContents: sender,
    isDestroyed() { return this.destroyed; },
    isMaximized() { return this.maximized; },
    minimize() { actions.push('minimize'); },
    maximize() { actions.push('maximize'); this.maximized = true; },
    unmaximize() { actions.push('unmaximize'); this.maximized = false; },
    close() { actions.push('close'); }
  };
  const context = {
    ipcMain: { handle: (_name, value) => { handler = value; } },
    process: { platform }, mainWindow: window,
    BrowserWindow: { fromWebContents: value => value === sender ? window : null }
  };
  run(`${helper.getText(ast)}; ${node.getText(ast)}`, context);
  return { handler, actions, window, context, event: { sender, senderFrame: sender.mainFrame } };
}

test('caption commands execute minimize, maximize, restore and the existing close path', () => {
  const { handler, actions, event } = captionHandler('main-window-command');
  for (const command of ['minimize', 'toggle-maximize', 'toggle-maximize', 'close']) {
    assert.equal(handler(event, command), true);
  }
  assert.deepEqual(actions, ['minimize', 'maximize', 'unmaximize', 'close']);
});

test('caption commands reject invalid payloads without changing the window', () => {
  const { handler, actions, event } = captionHandler('main-window-command');
  for (const value of [undefined, 'exit', 'maximize', 1, null, {}, { type: 'close' }]) {
    assert.equal(handler(event, value), false);
  }
  assert.deepEqual(actions, []);
});

test('caption IPC rejects other windows, subframes and destroyed or absent windows', () => {
  for (const [channel, rejected] of [['main-window-command', false], ['main-window-get-maximized', null]]) {
    const { handler, actions, window, context, event } = captionHandler(channel);
    for (const untrusted of [
      { ...event, sender: {} }, { ...event, senderFrame: {} },
      { ...event, senderFrame: null }, { sender: event.sender }
    ]) assert.equal(handler(untrusted, 'close'), rejected);
    window.destroyed = true;
    assert.equal(handler(event, 'close'), rejected);
    context.mainWindow = null;
    assert.equal(handler(event, 'close'), rejected);
    assert.deepEqual(actions, []);
  }
});

test('caption IPC leaves non-Windows chrome unchanged', () => {
  for (const platform of ['darwin', 'linux']) {
    const command = captionHandler('main-window-command', platform);
    assert.equal(command.handler(command.event, 'close'), false);
    assert.deepEqual(command.actions, []);
    const state = captionHandler('main-window-get-maximized', platform);
    assert.equal(state.handler(state.event), null);
  }
});

test('caption state reads and native maximize events keep the restore icon in sync', () => {
  const { handler, window, event } = captionHandler('main-window-get-maximized');
  assert.equal(handler(event), false);
  window.maximized = true;
  assert.equal(handler(event), true);
  const created = createdWindow('win32').window;
  assert.ok(created.events.has('maximize'));
  assert.ok(created.events.has('unmaximize'));
  created.maximized = true;
  created.events.get('maximize')();
  created.maximized = false;
  created.events.get('unmaximize')();
  assert.deepEqual(created.messages, [['main-window-maximized', true], ['main-window-maximized', false]]);
});

function preloadBridge(mode = '') {
  const listeners = new Map();
  const invocations = [];
  let bridge;
  run(fs.readFileSync(path.join(root, 'src/preload/preload.ts'), 'utf8'), {
    exports: {}, process: { platform: 'win32' }, URLSearchParams,
    window: { location: { search: mode ? `?window=${mode}` : '' } },
    require: name => {
      if (name === 'electron') return {
        contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } },
        ipcRenderer: {
          invoke: (...args) => { invocations.push(args); return Promise.resolve(true); },
          on: (name, handler) => listeners.set(name, handler),
          removeListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); }
        }
      };
      if (name === '../shared/backendRoutes') return { standaloneBackendRequestUrl: value => value };
      throw new Error(`Unexpected preload dependency: ${name}`);
    }
  });
  return { bridge, listeners, invocations };
}

test('preload exposes narrow caption APIs only to the main window and disposes listeners', async () => {
  const { bridge, listeners, invocations } = preloadBridge();
  assert.equal(typeof bridge.mainWindowCommand, 'function');
  assert.equal(typeof bridge.getMainWindowMaximized, 'function');
  assert.equal(typeof bridge.onMainWindowMaximized, 'function');
  await bridge.mainWindowCommand('minimize');
  await bridge.getMainWindowMaximized();
  assert.deepEqual(invocations, [['main-window-command', 'minimize'], ['main-window-get-maximized']]);
  const updates = [];
  const dispose = bridge.onMainWindowMaximized(value => updates.push(value));
  listeners.get('main-window-maximized')({}, true);
  assert.deepEqual(updates, [true]);
  dispose();
  assert.equal(listeners.has('main-window-maximized'), false);
  for (const mode of ['mini-player', 'mini-editor']) {
    const isolated = preloadBridge(mode).bridge;
    for (const name of ['mainWindowCommand', 'getMainWindowMaximized', 'onMainWindowMaximized']) {
      assert.equal(isolated[name], undefined, `${mode} must not receive ${name}`);
    }
  }
});

function captionComponent(initialState, supported = true) {
  const { parse } = createRequire(path.join(root, 'package.json'))('vue/compiler-sfc');
  const descriptor = parse(fs.readFileSync(path.join(root, 'src/renderer/src/components/WindowTitlebar.vue'), 'utf8')).descriptor;
  assert.match(descriptor.scriptSetup.content, /getMainWindowMaximized/, 'Custom buttons must read native maximize state');
  const script = ts.createSourceFile('WindowTitlebar.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
  const statements = script.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(script));
  let mount;
  let unmount;
  let listener;
  let disposed = false;
  const commands = [];
  const warnings = [];
  const context = {
    defineProps: () => ({ dark: false }), ref: value => ({ value }),
    onMounted: fn => { mount = fn; }, onBeforeUnmount: fn => { unmount = fn; },
    console: { warn: value => warnings.push(value) },
    window: { listenMusic: {
      isWindows: supported,
      getMainWindowMaximized: () => initialState,
      onMainWindowMaximized: fn => { listener = fn; return () => { disposed = true; }; },
      mainWindowCommand: async command => { commands.push(command); return true; }
    } }
  };
  run(`${statements.join('\n')}\nexposed = { maximized, commandWindow };`, context);
  return { state: context.exposed.maximized, command: context.exposed.commandWindow,
    mount: () => mount(), unmount: () => unmount(), update: value => listener(value),
    isDisposed: () => disposed, commands, warnings, context };
}

test('renderer applies initial native maximize state and sends caption commands', async () => {
  const component = captionComponent(Promise.resolve(true));
  component.mount();
  await Promise.resolve();
  assert.equal(component.state.value, true);
  component.update(false);
  assert.equal(component.state.value, false);
  await component.command('minimize');
  await component.command('toggle-maximize');
  await component.command('close');
  assert.deepEqual(component.commands, ['minimize', 'toggle-maximize', 'close']);
  component.unmount();
  assert.equal(component.isDisposed(), true);
});

test('renderer ignores stale initial state after a newer native event or unmount', async () => {
  for (const unmount of [false, true]) {
    let resolve;
    const component = captionComponent(new Promise(done => { resolve = done; }));
    component.mount();
    if (unmount) component.unmount();
    else component.update(true);
    resolve(unmount);
    await Promise.resolve();
    assert.equal(component.state.value, !unmount);
  }
});

test('renderer reports rejected commands without optimistic state changes', async () => {
  const component = captionComponent(Promise.resolve(false));
  component.mount();
  component.context.window.listenMusic.mainWindowCommand = async () => false;
  await component.command('toggle-maximize');
  assert.equal(component.state.value, false);
  assert.equal(component.warnings.length, 1);
  component.context.window.listenMusic.mainWindowCommand = async () => { throw new Error('unavailable'); };
  await component.command('close');
  assert.equal(component.warnings.length, 2);
  component.unmount();
});

test('renderer does not register custom window controls on non-Windows', () => {
  const component = captionComponent(Promise.resolve(true), false);
  component.mount();
  component.unmount();
  assert.equal(component.isDisposed(), false);
  assert.equal(component.state.value, false);
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
