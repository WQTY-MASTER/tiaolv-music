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
assert.match(
  app,
  /function ensureStreamingHomeForModeSwitch\(\)[\s\S]*streamingHomeState\.value === "success"[\s\S]*streamingHomeState\.value === "loading"[\s\S]*loadStreamingHomeData\(\)/,
  "返回流媒体模式时应复用已加载内容，避免每次切换都等待网络请求",
);
assert.match(
  app,
  /function toggleAppMode\(\)[\s\S]*if \(appMode\.value === "streaming"\) \{[\s\S]*ensureStreamingHomeForModeSwitch\(\)/,
  "模式切换应通过缓存感知入口恢复流媒体首页",
);
assert.match(sidebar, /本地模式/);
assert.match(sidebar, /流媒体模式/);
assert.match(sidebar, /mode/);
assert.match(sidebar, /切换到流媒体模式/);
assert.match(sidebar, /切换到本地模式/);
assert.match(sidebar, /class="mode-segmented-control"[^>]*role="radiogroup"/, "底部模式切换应为双选分段控件");
assert.match(sidebar, /class="mode-option"[\s\S]*props\.mode === 'local'[\s\S]*本地模式/, "分段控件应提供本地模式选项和选中态");
assert.match(sidebar, /class="mode-option"[\s\S]*props\.mode === 'streaming'[\s\S]*流媒体模式/, "分段控件应提供流媒体模式选项和选中态");
assert.match(sidebar, /\bMonitor\b[\s\S]*\bGlobe2\b/, "两种模式应使用侧边栏风格的线性图标");
assert.doesNotMatch(sidebar, /mode-active-dot/, "选中模式不应继续显示通用绿点");
assert.match(sidebar, /<Monitor[^>]*class="mode-option-icon"[\s\S]*<Globe2[^>]*class="mode-option-icon"/, "两个模式应始终显示各自图标");
assert.match(sidebar, /\.mode-option\.active \.mode-option-icon\s*\{[^}]*color:\s*#43dda0/, "当前模式的对应图标应亮起");
assert.match(sidebar, /\.mode-segmented-control\s*\{[^}]*gap:\s*6px[^}]*background:\s*transparent/, "两个模式按钮应保留独立间距，避免图标和选中态重叠");
assert.match(sidebar, /\.mode-option\s*\{[^}]*background:\s*#eceef2[^}]*font-size:\s*13px[^}]*font-weight:\s*700/, "模式文字应使用侧边栏菜单风格并保持按钮独立");
assert.match(app, /local-home-page/);
assert.match(app, /streaming-home-page/);
assert.match(app, /appMode\s*===\s*['"]local['"]/);
assert.match(app, /appMode\s*===\s*['"]streaming['"]/);
assert.match(app, /选择文件夹/);
assert.match(app, /扫描音乐/);

console.log("应用模式契约通过");
