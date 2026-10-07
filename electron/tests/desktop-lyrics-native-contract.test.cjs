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
assert.match(main, /alwaysOnTop:\s*desktopLyricsConfig\.preferences\.alwaysOnTop/, "桌面歌词窗口应按持久化设置决定是否置顶");
assert.match(main, /skipTaskbar:\s*true/, "桌面歌词窗口不应显示任务栏图标");
assert.match(main, /window=desktop-lyrics|searchParams\.set\("window",\s*"desktop-lyrics"\)/, "桌面歌词窗口应加载独立渲染模式");

assert.match(main, /desktop-lyrics\.json/, "桌面歌词配置应保存到独立用户数据文件");
assert.match(main, /app\.getPath\("userData"\)/, "配置应保存在 Electron 用户数据目录");
assert.match(main, /normalizeDesktopLyricsPreferences/, "读取配置时应校验锁定、翻译和字号");
assert.match(main, /desktopLyricsWindow\.on\("move"/, "窗口移动后应持久化位置");
assert.match(main, /desktopLyricsWindow\.on\("resize"/, "窗口缩放后应持久化尺寸");
assert.match(main, /startDesktopLyricsUnlockMonitor/, "锁定后应启动系统级顶部解锁热区监测");
assert.match(main, /new ShortcutManager\(globalShortcut/, "解锁快捷键应纳入统一全局快捷键管理");
assert.match(main, /case "unlock-lyrics":[\s\S]{0,100}locked: false/, "自定义解锁快捷键应解除歌词锁定");

for (const channel of [
  "get-legacy-aggregate-playlists",
  "toggle-desktop-lyrics-window",
  "close-desktop-lyrics-window",
  "update-desktop-lyrics-playback-state",
  "update-desktop-lyrics-time",
  "update-desktop-lyrics-preferences",
  "update-desktop-lyrics-bounds",
  "desktop-lyrics-bounds-changed",
  "desktop-lyrics-hover-state",
  "desktop-lyrics-unlock-hotspot",
  "desktop-lyrics-action"
]) {
  assert.match(main, new RegExp(channel), `主进程缺少 ${channel} IPC`);
  assert.match(preload, new RegExp(channel), `预加载桥缺少 ${channel} IPC`);
}

for (const api of [
  "getLegacyAggregatePlaylists",
  "toggleDesktopLyricsWindow",
  "closeDesktopLyricsWindow",
  "updateDesktopLyricsPlaybackState",
  "updateDesktopLyricsTime",
  "updateDesktopLyricsPreferences",
  "updateDesktopLyricsBounds",
  "onDesktopLyricsHoverState",
  "onDesktopLyricsUnlockHotspot",
  "sendDesktopLyricsAction",
  "onDesktopLyricsPlaybackState",
  "onDesktopLyricsPreferences",
  "onDesktopLyricsBoundsChanged",
  "onDesktopLyricsVisibilityChanged",
  "onDesktopLyricsAction"
]) {
  assert.match(preload, new RegExp(api), `预加载桥没有暴露 ${api}`);
  assert.match(env, new RegExp(api), `渲染器类型没有声明 ${api}`);
}

assert.match(main, /mainWindow\?\.webContents\.send\("desktop-lyrics-action"/, "桌面歌词按钮动作应转发给主播放器");
assert.match(main, /function isTrustedDesktopLyricsSender/, "桌面歌词设置 IPC 应统一校验主窗口和歌词窗口");
assert.match(main, /BrowserWindow\.fromWebContents\(event\.sender\)[\s\S]{0,180}mainWindow[\s\S]{0,120}desktopLyricsWindow/, "主播放器和歌词窗口都应能读取与更新配置");
assert.match(main, /webContents\.send\([\s\S]{0,80}"desktop-lyrics-playback-state"/, "主进程应把播放器状态转发给歌词窗口");
assert.match(main, /"desktop-lyrics-time",\s*desktopLyricsPlaybackState\.currentTime,\s*Boolean\(allowRewind\)/, "桌面歌词时间同步应转发是否允许回退");
assert.match(preload, /updateDesktopLyricsTime:\s*\(currentTime:\s*number,\s*allowRewind/, "预加载桥应把主动跳转标记发给主进程");
assert.match(main, /webContents\.send\([\s\S]{0,80}"desktop-lyrics-preferences"/, "主进程应同步桌面歌词设置");
assert.match(main, /mainWindow[\s\S]{0,180}webContents\.send\([\s\S]{0,80}"desktop-lyrics-preferences"/, "主进程应把配置变化广播回设置页");
assert.match(main, /setAlwaysOnTop\(next\.alwaysOnTop/, "置顶设置应实时应用到桌面歌词窗口");
assert.match(main, /setBounds\([\s\S]{0,220}clampDesktopLyricsBounds/, "窗口宽高设置应在主进程约束后应用");
assert.match(main, /"desktop-lyrics-bounds-changed"/, "窗口拖拽缩放后应同步真实尺寸");
assert.match(main, /visible:\s*Boolean\(desktopLyricsWindow/, "桌面歌词快照应包含当前窗口可见状态");
assert.match(main, /preferences:\s*desktopLyricsConfig\.preferences/, "桌面歌词快照应包含持久化设置");
assert.match(main, /webContents\.send\("desktop-lyrics-visibility-changed"/, "桌面歌词关闭后应同步可见状态");
assert.match(main, /screen\.getCursorScreenPoint\(\)/, "锁定时应由主进程读取系统鼠标位置");
assert.match(main, /desktopLyricsUnlockPollTimer = setInterval\(/, "锁定时应持续检测顶部解锁热区");
assert.match(main, /webContents\.send\("desktop-lyrics-hover-state", pointerInside\)/, "主进程应同步窗口悬浮状态");
assert.match(main, /webContents\.send\("desktop-lyrics-unlock-hotspot", hotspotActive\)/, "主进程应同步顶部热区状态");
assert.match(main, /setIgnoreMouseEvents\(!hotspotActive,\s*\{\s*forward:\s*true\s*\}\)/, "顶部热区应临时关闭窗口鼠标穿透");

console.log("原生桌面歌词窗口契约通过");
