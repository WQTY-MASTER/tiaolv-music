const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main/main.ts"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/preload/preload.ts"), "utf8");
const env = fs.readFileSync(path.join(root, "src/renderer/src/env.d.ts"), "utf8");
const componentPath = path.join(root, "src/renderer/src/components/AboutSettings.vue");

assert.ok(fs.existsSync(componentPath), "应提供独立的关于设置组件");
const component = fs.readFileSync(componentPath, "utf8");
const updaterService = fs.readFileSync(path.join(root, "src/main/appUpdates.ts"), "utf8");

assert.match(app, /activeSettingsSection === 'about'/, "关于组件必须挂载在设置的关于页");
assert.match(app, /<AboutSettings/, "设置页应挂载关于组件");
for (const text of [
  "调律音乐", "Tiaolv Music", "检查更新", "启动时自动检查更新", "项目仓库",
  "MIT License", "第三方内容声明", "复制诊断信息", "Electron", "后端 API", "数据库"
]) {
  assert.match(component, new RegExp(text), `关于页缺少 ${text}`);
}
assert.match(component, /app-icon\.png/, "关于页应显示正式应用图标");
assert.match(component, /checkForUpdates/, "检查更新按钮应调用主进程更新服务");
assert.match(component, /releaseNotes/, "发现新版本后应显示更新日志");
assert.match(component, /下载更新/, "发现新版本后应提供下载入口");
assert.match(component, /formatDiagnosticReport/, "诊断信息应由统一格式化函数生成");
assert.match(component, /copyText/, "复制诊断信息应写入系统剪贴板");
assert.match(updaterService, /owner: "WQTY-MASTER", repo: "tiaolv-music"/, "更新检查应请求项目的 GitHub Releases");
assert.match(main, /createAppUpdateService/, "主进程必须接入真实更新服务");
assert.match(component, /downloadUpdate\(/, "下载更新应调用主进程而非仅打开浏览器");
assert.match(component, /installUpdate\(/, "更新必须提供用户主动重启安装入口");
assert.match(component, /<progress/, "下载过程必须展示进度");
assert.match(component, /浏览器手动下载/, "网络失败时必须有浏览器下载兜底");
assert.match(main, /app\.getVersion\(\)/, "系统信息应读取应用实际版本");
assert.match(main, /process\.versions\.electron/, "系统信息应读取 Electron 实际版本");
assert.match(main, /shell\.openExternal/, "仓库和更新下载应使用系统浏览器打开");
for (const channel of ["get-about-snapshot", "check-for-updates", "download-update", "install-update", "set-auto-update-check", "open-external-link"]) {
  assert.match(main, new RegExp(channel), `主进程缺少 ${channel} IPC`);
  assert.match(preload, new RegExp(channel), `预加载桥缺少 ${channel} IPC`);
}
for (const api of ["getAboutSnapshot", "checkForUpdates", "downloadUpdate", "installUpdate", "setAutoUpdateCheck", "openExternalLink"]) {
  assert.match(preload, new RegExp(api), `预加载桥未暴露 ${api}`);
  assert.match(env, new RegExp(api), `渲染器类型未声明 ${api}`);
}

console.log("关于设置页契约通过");
