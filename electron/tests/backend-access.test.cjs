const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");
const { registerHooks } = require("node:module");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith("/backendRoutes")) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  }
});

test("backend credentials only attach to owned trusted application requests", async () => {
  const { authorizeBackendHeaders, stripBackendTokenHeaders } = await import(pathToFileURL(path.resolve(__dirname, "../src/main/backendAccess.ts")));
  const token = "a".repeat(64);
  const request = { url: "http://127.0.0.1:17890/library/tracks/123/audio", owned: true,
    ownerUrl: "file:///app/index.html", frameUrl: "file:///app/index.html?desktopLyrics=1",
    rendererFileUrl: "file:///app/index.html", headers: { Range: "bytes=0-100" } };
  assert.deepEqual(authorizeBackendHeaders(request, token), { Range: "bytes=0-100", "X-Tiaolv-Token": token });
  for (const changes of [
    { owned: false }, { ownerUrl: "https://attacker.example" },
    { frameUrl: "https://attacker.example" }, { url: "https://y.gtimg.cn/cover.jpg" },
    { url: "http://127.0.0.1:17890.attacker.example/private" },
    { url: "http://localhost:17890/private" }, { ownerUrl: "file:///other/index.html" }
  ]) assert.equal(authorizeBackendHeaders({ ...request, ...changes }, token), null);
  assert.equal(authorizeBackendHeaders(request, "invalid"), null);
  assert.deepEqual(stripBackendTokenHeaders({ "x-tiaolv-token": token, Range: "bytes=0-100" }), { Range: "bytes=0-100" });
  assert.equal(authorizeBackendHeaders({ ...request, ownerUrl: "http://127.0.0.1:5173/", frameUrl: "http://127.0.0.1:5173/", rendererUrl: "http://127.0.0.1:5173/" }, token)["X-Tiaolv-Token"], token);
});

test("private token file validates format and never accepts symlinks or missing files", async () => {
  const { readLocalAccessToken } = await import(pathToFileURL(path.resolve(__dirname, "../src/main/backendAccess.ts")));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tiaolv-access-test-"));
  try {
    const file = path.join(directory, "token");
    assert.throws(() => readLocalAccessToken(file));
    fs.writeFileSync(file, "b".repeat(64));
    assert.equal(readLocalAccessToken(file), "b".repeat(64));
    fs.writeFileSync(file, "corrupt");
    assert.throws(() => readLocalAccessToken(file));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
