const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.ts"), "utf8");
const windows = fs.readFileSync(path.join(root, "src/main/miniPlayerWindows.ts"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/preload/preload.ts"), "utf8");
const env = fs.readFileSync(path.join(root, "src/renderer/src/env.d.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const mini = fs.readFileSync(path.join(root, "src/renderer/src/components/MiniPlayer.vue"), "utf8");

assert.match(main, /ipcMain\.handle\("enter-mini-mode"/, "主进程应提供进入迷你窗口的 IPC");
assert.match(main, /ipcMain\.handle\("exit-mini-mode"/, "主进程应提供退出迷你窗口的 IPC");
assert.match(main, /loadFile\(path\.join\(__dirname, "\.\.\/renderer\/index\.html"\)\)/, "打包后应从 out/renderer 加载渲染页面");
assert.match(main, /LOCALAPPDATA[\s\S]*ChromiumCache/, "Chromium 缓存应写入本地应用数据目录，避免漫游目录权限错误");
assert.match(main, /appendSwitch\("disk-cache-dir"/, "主进程应显式配置可写磁盘缓存目录");
assert.match(main, /requestSingleInstanceLock\(\)/, "应用应阻止多个实例争用同一缓存目录");
assert.match(main, /app\.on\("second-instance"[\s\S]*focus\(\)/, "重复启动时应聚焦已有窗口");
assert.match(windows, /frame:\s*false, thickFrame:\s*false, transparent:\s*true/, "迷你窗口应透明无原生厚边框");
assert.match(windows, /win\.setShape\(getMiniWindowShape\(/, "原生窗口区域应与卡片圆角同步");
assert.match(windows, /skipTaskbar:\s*!options\.showInTaskbar/, "迷你模式应按引导选项决定是否显示在任务栏");
assert.match(windows, /alwaysOnTop:\s*options\.alwaysOnTop/, "迷你模式应按引导选项决定是否置顶");
assert.match(main, /alwaysOnTop:\s*options\?\.alwaysOnTop\s*!==\s*false/, "未设置新选项时应保留原迷你播放器默认置顶行为");
assert.doesNotMatch(windows, /main\.(setBounds|setMinimumSize|unmaximize|setFullScreen)\(/, "迷你模式不应修改主窗口的位置、尺寸、最大化或全屏状态");
assert.match(windows, /setBackgroundThrottling\(false\)/, "隐藏主窗口时应保持播放时钟运行");
assert.match(windows, /mini-resize-start/, "无边框迷你窗口应提供自定义缩放接口");
assert.doesNotMatch(main, /\.on\("minimize"/, "迷你模式不应劫持系统最小化事件");
assert.match(main, /win\.on\("close"[\s\S]{0,900}closeBehavior === "mini"|win\.on\("close"[\s\S]{0,900}webContents\.send\("window-close-behavior", closeBehavior\)/, "仅在用户明确选择时，关闭窗口才应切换迷你播放器");

assert.match(preload, /enterMiniMode:\s*\(options[^)]*\)\s*=>\s*ipcRenderer\.invoke\("enter-mini-mode",\s*options\)/, "preload 应把迷你窗口选项传给主进程");
assert.match(preload, /exitMiniMode:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("exit-mini-mode"\)/, "preload 应暴露退出迷你模式方法");
assert.match(env, /enterMiniMode\(options:[\s\S]*showInTaskbar:[\s\S]*alwaysOnTop:[\s\S]*\): Promise<boolean>/, "渲染层应声明迷你窗口选项桥接类型");
assert.match(env, /exitMiniMode\(\): Promise<boolean>/, "渲染层应声明退出迷你模式桥接类型");

assert.match(app, /const nativeMiniMode = ref\(false\)/, "渲染层应区分原生迷你窗口与网页悬浮模式");
assert.match(app, /window\.listenMusic\?\.enterMiniMode/, "打开迷你播放器时应尝试进入原生窗口模式");
assert.match(app, /window\.listenMusic\?\.exitMiniMode/, "关闭迷你播放器时应恢复主窗口");
assert.match(app, /v-show="!nativeMiniMode"[\s\S]*class="app-shell"/, "原生迷你模式应隐藏主应用界面");
assert.match(app, /:native-window="nativeMiniMode"/, "迷你播放器应获知是否运行在原生迷你窗口中");
assert.match(app, /<\/Transition>\s*<\/div>\s*<MiniPlayer[\s\S]*<\/template>/, "迷你播放器必须渲染在可隐藏的主界面容器之外");

assert.match(mini, /nativeWindow:\s*boolean/, "迷你播放器应支持原生窗口样式");
assert.match(mini, /'is-native-window': props\.nativeWindow/, "原生模式应添加独立样式类");
assert.match(mini, /-webkit-app-region:\s*drag/, "原生迷你卡片应可拖动整个窗口");
assert.match(mini, /button[^}]*-webkit-app-region:\s*no-drag/, "迷你播放器按钮应保持可点击");
assert.match(mini, /\.mini-window-toolbar\s*\{[^}]*position:\s*absolute[^}]*top:[^}]*right:/, "窗口工具条应独立放在右上角");
assert.match(mini, /\.mini-controls\s*\{[^}]*justify-content:\s*center/, "底部控制按钮应整体居中");

console.log("原生迷你窗口契约通过");
