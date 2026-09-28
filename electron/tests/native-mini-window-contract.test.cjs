const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.ts"), "utf8");
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
assert.match(main, /interface MiniWindowState[\s\S]*bounds:[\s\S]*wasMaximized:[\s\S]*wasFullScreen:[\s\S]*wasAlwaysOnTop:[\s\S]*wasMenuBarVisible:[\s\S]*minimumSize:/, "进入前应保存窗口尺寸、位置、最大化、全屏、置顶、菜单栏和最小尺寸状态");
assert.match(main, /getNormalBounds\(\)/, "最大化窗口应保存可恢复的普通窗口边界");
assert.match(main, /setAlwaysOnTop\(true\)/, "迷你模式窗口应置顶");
assert.match(main, /setMenuBarVisibility\(false\)/, "迷你模式应隐藏占用空间的应用菜单栏");
assert.match(main, /animateWindowBounds/, "窗口尺寸切换应使用平滑边界动画");
assert.match(main, /if \(win\.isMinimized\(\)\) win\.restore\(\)/, "切换迷你模式时应恢复 Windows 意外最小化的窗口");
assert.match(main, /await stabilizeRestoredWindow\(win\)[\s\S]*await animateWindowBounds\(win, target\)[\s\S]*win\.setResizable\(false\)/, "应等待窗口还原稳定并完成缩放后再锁定尺寸");
assert.match(main, /setMinimumSize\(MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT\)/, "进入迷你模式前应解除主窗口最小尺寸限制");
assert.match(main, /setAlwaysOnTop\(state\.wasAlwaysOnTop\)/, "退出时应恢复原置顶状态");
assert.match(main, /setMenuBarVisibility\(state\.wasMenuBarVisible\)/, "退出时应恢复原菜单栏状态");
assert.match(main, /state\.wasMaximized[\s\S]*maximize\(\)/, "退出时应恢复最大化状态");
assert.doesNotMatch(main, /\.on\("(?:close|minimize)"/, "迷你模式不应劫持系统关闭或最小化事件");

assert.match(preload, /enterMiniMode:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("enter-mini-mode"\)/, "preload 应暴露进入迷你模式方法");
assert.match(preload, /exitMiniMode:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("exit-mini-mode"\)/, "preload 应暴露退出迷你模式方法");
assert.match(env, /enterMiniMode\(\): Promise<boolean>/, "渲染层应声明进入迷你模式桥接类型");
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
assert.match(mini, /\.mini-close-button\s*\{[^}]*position:\s*absolute[^}]*top:[^}]*right:/, "关闭按钮应独立放在右上角");
assert.match(mini, /\.mini-controls\s*\{[^}]*justify-content:\s*center/, "底部控制按钮应整体居中");

console.log("原生迷你窗口契约通过");
