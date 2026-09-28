const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const authPanel = fs.readFileSync(path.join(root, "src/renderer/src/components/AuthPanel.vue"), "utf8");
const accountMenuPath = path.join(root, "src/renderer/src/components/AccountMenu.vue");

assert.ok(fs.existsSync(accountMenuPath), "应提供独立的账号管理下拉组件");
const accountMenu = fs.readFileSync(accountMenuPath, "utf8");

assert.match(app, /UserRound/);
assert.match(app, /aria-label="账号管理"/);
assert.match(app, /<AccountMenu/);
assert.match(app, /accountMenuVisible/);
assert.match(app, /@login="openProviderAuthPanel"/);
assert.match(app, /@logout="handleProviderLogout"/);
assert.match(app, /loadCurrentAccounts/);
assert.match(app, /event\.key\s*===\s*"Escape"[\s\S]*?closeFloatingMenus\(\)/);

assert.match(accountMenu, /网易云音乐/);
assert.match(accountMenu, /QQ 音乐/);
assert.match(accountMenu, /props\.accounts/);
assert.match(accountMenu, /avatarUrl/);
assert.match(accountMenu, /退出登录/);
assert.match(accountMenu, /登录/);
assert.match(accountMenu, /account-menu-backdrop/);

assert.match(api, /export function loadCurrentAccounts/);
assert.match(api, /\/auth\/accounts/);
assert.match(api, /export function startQrLogin/);
assert.match(api, /export function pollQrLogin/);
assert.match(authPanel, /provider: "netease" \| "qq"/);
assert.match(authPanel, /请使用手机 QQ 扫码/);
assert.match(authPanel, /startQrLogin/);
assert.match(authPanel, /pollQrLogin/);
assert.doesNotMatch(authPanel, /QQ 音乐 Cookie/);
assert.doesNotMatch(authPanel, /localStorage/);

assert.match(app, /\.shell-control-button:hover/);
assert.match(app, /account-menu-anchor/);

console.log("多平台账号菜单契约通过");
