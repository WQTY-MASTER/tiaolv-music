const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.ts"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/preload/preload.ts"), "utf8");
const env = fs.readFileSync(path.join(root, "src/renderer/src/env.d.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(main, /process\.platform\s*!==\s*"win32"/, "缩略图工具栏只能在 Windows 初始化");
assert.match(main, /setThumbarButtons\(/, "主进程缺少 Windows 缩略图工具栏");
assert.match(main, /setThumbarButtons\(\[\]\)/, "关闭设置时应清除缩略图按钮");
assert.match(main, /ipcMain\.handle\("set-taskbar-thumbnail-buttons"/, "主进程缺少缩略图开关 IPC");
assert.match(main, /ipcMain\.handle\("update-taskbar-playback-state"/, "主进程缺少播放状态同步 IPC");
for (const action of ["previous", "toggle", "next"]) {
  assert.match(main, new RegExp(`taskbar-media-action[\\s\\S]{0,180}"${action}"`), `缩略图工具栏缺少 ${action} 动作`);
}

assert.match(preload, /isWindows:\s*process\.platform\s*===\s*"win32"/, "preload 应暴露 Windows 平台能力");
assert.match(preload, /setTaskbarThumbnailButtons/, "preload 缺少缩略图开关桥接");
assert.match(preload, /updateTaskbarPlaybackState/, "preload 缺少播放状态桥接");
assert.match(preload, /onTaskbarMediaAction/, "preload 缺少任务栏媒体动作监听");
assert.match(preload, /removeListener\("taskbar-media-action"/, "任务栏媒体动作监听必须支持清理");

assert.match(env, /isWindows:\s*boolean/, "渲染层缺少 Windows 能力类型");
assert.match(env, /setTaskbarThumbnailButtons\(enabled: boolean, isPlaying: boolean\): Promise<boolean>/, "渲染层缺少缩略图开关类型");
assert.match(env, /updateTaskbarPlaybackState\(isPlaying: boolean\): Promise<boolean>/, "渲染层缺少播放状态同步类型");
assert.match(env, /onTaskbarMediaAction\(listener:[\s\S]{0,140}\): \(\) => void/, "渲染层缺少任务栏动作监听清理类型");

assert.match(app, /TASKBAR_THUMBNAIL_BUTTONS_STORAGE_KEY/, "任务栏缩略图设置需要持久化");
assert.match(app, /readTaskbarThumbnailButtonsEnabled[\s\S]{0,180}!==\s*"false"/, "任务栏缩略图按钮应默认开启");
assert.match(app, /任务栏缩略图按钮/, "播放设置缺少任务栏缩略图开关");
assert.match(app, /activeSettingsSection === 'playback'/, "任务栏缩略图开关应位于播放设置");
assert.match(app, /window\.listenMusic\?\.onTaskbarMediaAction/, "播放器应订阅任务栏媒体动作");
assert.match(app, /case "previous"[\s\S]{0,100}previousTrack\(\)/, "上一首动作没有复用播放器逻辑");
assert.match(app, /case "toggle"[\s\S]{0,100}togglePlayback\(\)/, "播放暂停动作没有复用播放器逻辑");
assert.match(app, /case "next"[\s\S]{0,100}nextTrack\(\)/, "下一首动作没有复用播放器逻辑");
assert.match(app, /watch\(isPlaying[\s\S]{0,260}updateTaskbarPlaybackState/, "播放状态变化后应更新任务栏按钮图标");
assert.match(app, /onBeforeUnmount\([\s\S]*removeTaskbarMediaActionListener\?\.\(\)/, "卸载时应清理任务栏动作监听");

assert.match(packageJson, /taskbar-thumbnail-contract\.test\.cjs/, "完整测试脚本应包含任务栏缩略图契约");

console.log("Windows 任务栏缩略图按钮契约通过");
