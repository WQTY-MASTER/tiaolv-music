const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "src/renderer/src/components/SidebarNav.vue"), "utf8");
const mode = fs.readFileSync(path.join(root, "src/renderer/src/services/appMode.ts"), "utf8");

assert.match(mode, /export type AppMode\s*=\s*"local"\s*\|\s*"streaming"/);
assert.match(mode, /readAppMode/);
assert.match(mode, /writeAppMode/);
assert.match(app, /appMode/);
assert.match(app, /toggleAppMode/);
assert.match(sidebar, /本地模式/);
assert.match(sidebar, /流媒体模式/);
assert.match(sidebar, /mode/);
assert.match(sidebar, /切换到流媒体模式/);
assert.match(sidebar, /切换到本地模式/);
assert.match(app, /local-home-page/);
assert.match(app, /streaming-home-page/);
assert.match(app, /appMode\s*===\s*['"]local['"]/);
assert.match(app, /appMode\s*===\s*['"]streaming['"]/);
assert.match(app, /选择文件夹/);
assert.match(app, /扫描音乐/);

console.log("应用模式契约通过");
