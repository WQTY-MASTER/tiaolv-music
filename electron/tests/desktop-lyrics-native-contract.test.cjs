const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.ts"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/preload/preload.ts"), "utf8");
const env = fs.readFileSync(path.join(root, "src/renderer/src/env.d.ts"), "utf8");

assert.match(main, /globalShortcut/, "主进程应使用 Electron 全局快捷键");
assert.match(main, /let desktopLyricsWindow: BrowserWindow \| null/, "主进程缺少独立桌面歌词窗口引用");
assert.match(main, /function createDesktopLyricsWindow/, "缺少桌面歌词窗口创建函数");
assert.match(main, /frame:\s*false/, "桌面歌词窗口应隐藏系统边框");
assert.match(main, /transparent:\s*true/, "桌面歌词窗口应支持透明背景");
assert.match(main, /alwaysOnTop:\s*true/, "桌面歌词窗口应始终置顶");
assert.match(main, /skipTaskbar:\s*true/, "桌面歌词窗口不应显示任务栏图标");
assert.match(main, /window=desktop-lyrics|searchParams\.set\("window",\s*"desktop-lyrics"\)/, "桌面歌词窗口应加载独立渲染模式");

assert.match(main, /desktop-lyrics\.json/, "桌面歌词配置应保存到独立用户数据文件");
assert.match(main, /app\.getPath\("userData"\)/, "配置应保存在 Electron 用户数据目录");
assert.match(main, /normalizeDesktopLyricsPreferences/, "读取配置时应校验锁定、翻译和字号");
assert.match(main, /desktopLyricsWindow\.on\("move"/, "窗口移动后应持久化位置");
assert.match(main, /desktopLyricsWindow\.on\("resize"/, "窗口缩放后应持久化尺寸");
assert.match(main, /setIgnoreMouseEvents\(locked,\s*\{\s*forward:\s*true\s*\}\)/, "锁定后应启用鼠标穿透");
assert.match(main, /globalShortcut\.register\(DESKTOP_LYRICS_UNLOCK_SHORTCUT/, "锁定时应注册全局解锁快捷键");
assert.match(main, /if \(!registered\)[\s\S]{0,220}locked:\s*false/, "快捷键注册失败时不得进入无法解锁的状态");

for (const channel of [
  "toggle-desktop-lyrics-window",
  "close-desktop-lyrics-window",
  "update-desktop-lyrics-playback-state",
  "update-desktop-lyrics-time",
  "update-desktop-lyrics-preferences",
  "desktop-lyrics-action"
]) {
  assert.match(main, new RegExp(channel), `主进程缺少 ${channel} IPC`);
  assert.match(preload, new RegExp(channel), `预加载桥缺少 ${channel} IPC`);
}

for (const api of [
  "toggleDesktopLyricsWindow",
  "closeDesktopLyricsWindow",
  "updateDesktopLyricsPlaybackState",
  "updateDesktopLyricsTime",
  "updateDesktopLyricsPreferences",
  "sendDesktopLyricsAction",
  "onDesktopLyricsPlaybackState",
  "onDesktopLyricsPreferences",
  "onDesktopLyricsVisibilityChanged",
  "onDesktopLyricsAction"
]) {
  assert.match(preload, new RegExp(api), `预加载桥没有暴露 ${api}`);
  assert.match(env, new RegExp(api), `渲染器类型没有声明 ${api}`);
}

assert.match(main, /mainWindow\?\.webContents\.send\("desktop-lyrics-action"/, "桌面歌词按钮动作应转发给主播放器");
assert.match(main, /webContents\.send\([\s\S]{0,80}"desktop-lyrics-playback-state"/, "主进程应把播放器状态转发给歌词窗口");
assert.match(main, /webContents\.send\([\s\S]{0,80}"desktop-lyrics-preferences"/, "主进程应同步桌面歌词设置");
assert.match(main, /webContents\.send\("desktop-lyrics-visibility-changed"/, "桌面歌词关闭后应同步可见状态");

console.log("原生桌面歌词窗口契约通过");
