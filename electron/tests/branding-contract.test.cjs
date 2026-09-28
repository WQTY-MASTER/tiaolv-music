const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const electronRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(electronRoot, "..");
const main = fs.readFileSync(path.join(electronRoot, "src/main/main.ts"), "utf8");
const app = fs.readFileSync(path.join(electronRoot, "src/renderer/src/App.vue"), "utf8");
const auth = fs.readFileSync(path.join(electronRoot, "src/renderer/src/components/AuthPanel.vue"), "utf8");
const html = fs.readFileSync(path.join(electronRoot, "src/renderer/index.html"), "utf8");
const electronPackage = JSON.parse(fs.readFileSync(path.join(electronRoot, "package.json"), "utf8"));
const workspacePackage = JSON.parse(fs.readFileSync(path.join(workspaceRoot, "package.json"), "utf8"));

assert.equal(workspacePackage.name, "tiaolv-music-workspace", "工作区包名应使用调律音乐标识");
assert.equal(electronPackage.name, "tiaolv-music-electron", "Electron 包名应使用调律音乐标识");
assert.equal(electronPackage.productName, "调律音乐", "安装包产品名应为调律音乐");
assert.equal(electronPackage.build.appId, "com.tiaolvmusic.desktop", "Windows App ID 应使用新品牌");
assert.equal(electronPackage.build.win.icon, "resources/app-icon.ico", "Windows 安装包应使用正式图标");
assert.equal(electronPackage.scripts["test:branding"], "node tests/branding-contract.test.cjs");

assert.match(html, /<title>调律音乐<\/title>/, "窗口标题应为调律音乐");
assert.match(main, /title:\s*"调律音乐"/, "托盘默认标题应为调律音乐");
assert.match(main, /setAppUserModelId\("com\.tiaolvmusic\.desktop"\)/, "运行时 App ID 应与安装包一致");
assert.match(main, /app-icon\.png/, "主进程应加载正式应用图标");
assert.match(main, /nativeImage\.createFromPath/, "托盘应从图标文件加载图片");
assert.doesNotMatch(main, /SYSTEM_TRAY_ICON_DATA/, "不应继续使用临时内嵌托盘图标");
assert.match(app, /调律音乐/, "应用界面应显示调律音乐品牌");
assert.match(app, /LEGACY_STORAGE_PREFIX\s*=\s*"listen-music-"/, "改名后应保留旧设置迁移入口");
assert.match(app, /STORAGE_PREFIX\s*=\s*"tiaolv-music-"/, "新设置应使用调律音乐前缀");
assert.match(app, /migrateLegacyStorage\(\)/, "启动时应迁移旧版设置");
assert.doesNotMatch(`${app}\n${auth}\n${html}`, /倾听音乐/, "可见界面不应残留旧品牌名");

for (const icon of ["app-icon.png", "app-icon.ico"]) {
  assert.ok(fs.existsSync(path.join(electronRoot, "resources", icon)), `缺少 ${icon}`);
}

console.log("调律音乐品牌契约通过");
