const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.ts"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/preload/preload.ts"), "utf8");
const env = fs.readFileSync(path.join(root, "src/renderer/src/env.d.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(main, /\bTray\b/, "主进程缺少 Electron Tray");
assert.match(main, /\bMenu\b/, "主进程缺少托盘上下文菜单");
assert.match(main, /new Tray\(/, "主进程没有创建系统托盘图标");
assert.match(main, /Menu\.buildFromTemplate\(/, "托盘缺少右键菜单");
assert.match(main, /label:\s*trayTrackLabel\(state\)[\s\S]{0,80}showMainWindow\(\)/, "托盘歌曲信息应可唤醒主窗口");
assert.match(main, /systemTray\.on\("click"[\s\S]{0,160}showMainWindow\(\)/, "左键托盘图标应显示并聚焦主窗口");
assert.match(main, /ipcMain\.handle\("set-system-tray-enabled"/, "主进程缺少托盘开关 IPC");
assert.match(main, /ipcMain\.handle\("update-system-tray-state"/, "主进程缺少托盘状态同步 IPC");
assert.match(main, /systemTray\?\.destroy\(\)/, "关闭托盘设置时应销毁图标");
for (const label of ["上一首", "播放", "下一首", "喜欢", "播放模式", "桌面歌词", "迷你播放器", "设置", "退出"]) {
  assert.match(main, new RegExp(label), `托盘菜单缺少 ${label}`);
}
for (const action of ["previous", "toggle", "next", "favorite", "mini-player", "settings"]) {
  assert.match(main, new RegExp(`tray-media-action[\\s\\S]{0,240}"${action}"`), `托盘菜单缺少 ${action} 动作`);
}
assert.match(main, /label:\s*"桌面歌词"[\s\S]{0,180}toggleDesktopLyricsWindow\(\)/, "托盘桌面歌词应直接控制独立窗口");
assert.match(main, /Ctrl\+Alt\+L 解锁/, "托盘应提示桌面歌词全局解锁快捷键");
for (const mode of ["sequence", "loop", "single", "shuffle"]) {
  assert.match(main, new RegExp(`play-mode:${mode}`), `托盘菜单缺少 ${mode} 播放模式`);
}

assert.match(preload, /setSystemTrayEnabled/, "preload 缺少托盘开关桥接");
assert.match(preload, /updateSystemTrayState/, "preload 缺少托盘状态桥接");
assert.match(preload, /onTrayMediaAction/, "preload 缺少托盘动作监听");
assert.match(preload, /removeListener\("tray-media-action"/, "托盘动作监听必须支持清理");

assert.match(env, /interface SystemTrayState/, "渲染层缺少托盘状态类型");
assert.match(env, /setSystemTrayEnabled\(enabled: boolean, state: SystemTrayState\): Promise<boolean>/, "渲染层缺少托盘开关类型");
assert.match(env, /updateSystemTrayState\(state: SystemTrayState\): Promise<boolean>/, "渲染层缺少托盘状态同步类型");
assert.match(env, /onTrayMediaAction\(listener:[\s\S]{0,160}\): \(\) => void/, "渲染层缺少托盘动作监听类型");

assert.match(app, /SYSTEM_TRAY_ENABLED_STORAGE_KEY/, "系统托盘设置需要持久化");
assert.match(app, /readSystemTrayEnabled[\s\S]{0,180}!==\s*"false"/, "系统托盘图标应默认开启");
assert.match(app, /系统托盘图标/, "播放设置缺少系统托盘开关");
assert.match(app, /const systemTrayState = computed/, "播放器应集中生成托盘状态");
assert.match(app, /window\.listenMusic\?\.onTrayMediaAction/, "播放器应订阅托盘菜单动作");
assert.match(app, /watch\(systemTrayState[\s\S]{0,300}updateSystemTrayState/, "播放器状态变化后应更新托盘菜单");
assert.match(app, /case "favorite"[\s\S]{0,100}toggleLiked\(\)/, "托盘喜欢动作没有复用播放器逻辑");
assert.match(app, /case "desktop-lyrics"[\s\S]{0,120}toggleDesktopLyrics\(\)/, "托盘桌面歌词动作没有复用播放器逻辑");
assert.match(app, /case "mini-player"[\s\S]{0,180}(openMiniPlayer|closeMiniPlayer)\(/, "托盘迷你播放器动作没有复用播放器逻辑");
assert.match(app, /case "settings"[\s\S]{0,100}openSettingsPage\(\)/, "托盘设置动作没有复用设置页逻辑");
assert.match(app, /onBeforeUnmount\([\s\S]*removeTrayMediaActionListener\?\.\(\)/, "卸载时应清理托盘动作监听");
assert.match(packageJson, /system-tray-contract\.test\.cjs/, "完整测试脚本应包含系统托盘契约");

console.log("Windows 系统托盘契约通过");
