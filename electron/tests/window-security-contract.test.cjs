const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const main = fs.readFileSync(path.join(__dirname, "../src/main/main.ts"), "utf8");
for (const name of ["createWindow", "createDesktopLyricsWindow"]) {
  const start = main.indexOf(`function ${name}()`);
  const end = main.indexOf("\nfunction ", start + 1);
  const body = main.slice(start, end < 0 ? undefined : end);
  assert.match(body, /win\.webContents\.setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/, `${name} must deny renderer-created popup windows`);
  assert.ok(body.indexOf("setWindowOpenHandler(") < body.indexOf("win.load"), `${name} must install popup restrictions before loading content`);
}
assert.match(main, /await shell\.openExternal\(url\)/, "External links must continue to use the system browser");
console.log("Window popup security contract passed");
