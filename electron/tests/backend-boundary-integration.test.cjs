const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("../node_modules/typescript");

const sourceRoot = path.resolve(__dirname, "../src");
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
  } }).outputText;
}

function sharedBoundary() {
  const exports = {};
  vm.runInNewContext(compile(fs.readFileSync(path.join(sourceRoot, "shared/backendRoutes.ts"), "utf8")),
    { exports, URL });
  return exports;
}

test("renderer, preload and main use the shared backend boundary", () => {
  for (const file of ["renderer/src/services/api.ts", "preload/preload.ts", "main/main.ts", "main/backendAccess.ts"]) {
    const source = fs.readFileSync(path.join(sourceRoot, file), "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    assert.ok(ast.statements.some(node => ts.isImportDeclaration(node)
      && node.moduleSpecifier.text.endsWith("/backendRoutes")), `${file} must consume the shared boundary`);
    assert.ok(!source.includes('"http://127.0.0.1:17890"'), `${file} must not duplicate the backend origin`);
  }
});

test("actual preload keeps device playback and online search on standalone transport", async () => {
  let api;
  const requests = [];
  vm.runInNewContext(compile(fs.readFileSync(path.join(sourceRoot, "preload/preload.ts"), "utf8")), {
    exports: {}, process: { platform: "win32" }, URLSearchParams, window: { location: { search: "" } },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return new Response("[]", { status: 200 });
    },
    require(specifier) {
      if (specifier.endsWith("/backendRoutes")) return sharedBoundary();
      assert.equal(specifier, "electron");
      return { contextBridge: { exposeInMainWorld(_name, value) { api = value; } }, ipcRenderer: {} };
    }
  });
  await api.getLibrary();
  await api.search("鸣潮 / test");
  await api.play("local:one");
  await api.ping();
  assert.deepEqual(requests.map(request => request.url), [
    "http://127.0.0.1:17890/library/tracks",
    `http://127.0.0.1:17890/catalog/search?q=${encodeURIComponent("鸣潮 / test")}`,
    "http://127.0.0.1:17890/playback/play", "http://127.0.0.1:17890/health"
  ]);
  assert.equal(requests[2].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[2].options.body), { trackId: "local:one" });
  assert.ok(!JSON.stringify(requests).includes("X-Tiaolv-Token"));
});

test("auxiliary mini preloads expose only their narrowly scoped controls", () => {
  for (const mode of ["mini-player", "mini-editor"]) {
    let api;
    vm.runInNewContext(compile(fs.readFileSync(path.join(sourceRoot, "preload/preload.ts"), "utf8")), {
      exports: {}, process: { platform: "win32" }, URLSearchParams, window: { location: { search: `?window=${mode}` } },
      require(specifier) {
        if (specifier.endsWith("/backendRoutes")) return sharedBoundary();
        return { contextBridge: { exposeInMainWorld(_name, value) { api = value; } }, ipcRenderer: {} };
      }
    });
    assert.equal(typeof api.getMiniPlayerSnapshot, "function");
    for (const key of ["getLibrary", "getPlaylists", "search", "play", "getShortcuts", "uploadCloudAudio", "downloadCloudTrack", "selectDirectory", "openExternalLink"]) {
      assert.equal(api[key], undefined, `${mode} must not expose ${key}`);
    }
    assert.equal(typeof api.selectCoverImage, mode === "mini-editor" ? "function" : "undefined");
  }
});

function mainHandlers() {
  const source = fs.readFileSync(path.join(sourceRoot, "main/main.ts"), "utf8");
  const ast = ts.createSourceFile("main.ts", source, ts.ScriptTarget.Latest, true);
  const names = ["read-cover-data-url", "upload-cloud-audio", "download-cloud-track"];
  const statements = ast.statements.filter(node => ts.isExpressionStatement(node)
    && ts.isCallExpression(node.expression)
    && node.expression.expression.getText(ast) === "ipcMain.handle"
    && names.includes(node.expression.arguments[0]?.text));
  assert.equal(statements.length, names.length);
  const handlers = new Map();
  const requests = [];
  const writes = [];
  const boundary = sharedBoundary();
  const token = "a".repeat(64);
  const mainWindow = {};
  const response = url => new Response(String(url).includes("/cloud/tracks") ? "{}" : "synthetic", {
    status: 200, headers: { "Content-Type": "image/png" }
  });
  vm.runInNewContext(compile(statements.map(node => node.getText(ast)).join("\n")), {
    ...boundary,
    BACKEND_BASE_URL: boundary.LOCAL_BACKEND_ORIGIN, BACKEND_TOKEN_HEADER: "X-Tiaolv-Token",
    localAccessToken: token, mainWindow, URL, Buffer, FormData, path,
    ipcMain: { handle(name, handler) { handlers.set(name, handler); } },
    BrowserWindow: { fromWebContents() { return mainWindow; } },
    dialog: {
      async showOpenDialog() { return { canceled: false, filePaths: ["C:/synthetic/one.mp3"] }; },
      async showSaveDialog() { return { canceled: false, filePath: "C:/synthetic/download.mp3" }; }
    },
    openAsBlob: async () => new Blob(["synthetic"]),
    writeFile: async (file, bytes) => writes.push({ file, bytes: bytes.byteLength }),
    fetch: async (url, options) => {
      requests.push({ channel: "fetch", url: String(url), options });
      return response(url);
    },
    net: { async fetch(url) {
      requests.push({ channel: "net", url: String(url) });
      return response(url);
    } }
  });
  return { handlers, requests, writes, token, event: { sender: {} } };
}

test("actual upload handler keeps file selection local and authorizes only the standalone API", async () => {
  const { handlers, requests, token, event } = mainHandlers();
  const result = await handlers.get("upload-cloud-audio")(event);
  assert.equal(result.length, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://127.0.0.1:17890/account/netease/cloud/tracks");
  assert.equal(requests[0].options.headers["X-Tiaolv-Token"], token);
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[0].options.body.get("file").name, "one.mp3");
});

test("actual cover handler preserves local authorization and external token isolation", async () => {
  const { handlers, requests, token, event } = mainHandlers();
  const readCover = handlers.get("read-cover-data-url");
  assert.match(await readCover(event, "http://127.0.0.1:17890/library/tracks/a/cover"), /^data:image\/png;base64,/);
  assert.match(await readCover(event, "https://y.gtimg.cn/cover.jpg"), /^data:image\/png;base64,/);
  assert.equal(requests[0].options.headers["X-Tiaolv-Token"], token);
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[1].channel, "net");
  assert.equal(requests[1].options, undefined);
});

test("actual download handler preserves redirect policy without sending tokens to CDN", async () => {
  const { handlers, requests, writes, token, event } = mainHandlers();
  const download = handlers.get("download-cloud-track");
  assert.equal(await download(event, "http://127.0.0.1:17890/catalog/tracks/a/audio", "one.mp3"), true);
  assert.equal(await download(event, "https://cdn.example/one.mp3", "one.mp3"), true);
  assert.equal(requests[0].options.headers["X-Tiaolv-Token"], token);
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[1].options.headers, undefined);
  assert.equal(requests[1].options.redirect, "follow");
  assert.equal(writes.length, 2);
  assert.ok(writes.every(write => write.bytes > 0));
});
