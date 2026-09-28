const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "src/renderer/src/components/SidebarNav.vue"), "utf8");

assert.match(app, /\.app-shell\s*\{[^}]*overflow:\s*hidden/, "应用壳应裁剪横向溢出");
assert.match(app, /\.workspace\s*\{[^}]*width:\s*100%/, "工作区应限制在视口宽度内");
assert.match(app, /\.workspace\s*\{[^}]*position:\s*relative[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)/, "工作区不应为顶部导航永久预留空白行");
assert.doesNotMatch(app, /\.workspace\s*\{[^}]*grid-template-rows:\s*76px/, "工作区顶部不应保留 76px 白色占位区域");
assert.doesNotMatch(app, /\.topbar(?:\.|\s*\{)/, "主内容布局不应保留已废弃悬浮顶栏样式");
assert.match(app, /\.main-scroll\s*\{[^}]*overflow-x:\s*hidden/, "主内容区不应显示底部横向滚动条");
assert.match(app, /\.main-scroll::-webkit-scrollbar\s*\{[^}]*width:\s*7px/, "主内容区滚动条应使用纤细尺寸");
assert.match(app, /\.main-scroll::-webkit-scrollbar-thumb\s*\{[^}]*background:/, "主内容区滚动条滑块应使用淡色样式");
assert.match(app, /\.main-scroll::-webkit-scrollbar-button\s*\{[^}]*display:\s*none/, "主内容区滚动条不应显示上下箭头按钮");
assert.match(app, /\.local-home-header\s*>\s*div\s*\{[^}]*min-width:\s*0/, "主页左侧内容应允许收缩");
assert.match(app, /\.local-home-random\s*\{[^}]*width:\s*218px[^}]*max-width:\s*218px/, "主页右侧面板应保持固定宽度");
assert.match(app, /\.local-home-page\s*\{[^}]*width:\s*min\(1180px,\s*calc\(100vw\s*-\s*224px\s*-\s*36px\)\)/, "本地主页面应复用播放器的缩短限宽规则");
assert.match(app, /\.app-shell\.is-sidebar-collapsed \.local-home-page\s*\{[^}]*width:\s*min\(1180px,\s*calc\(100vw\s*-\s*36px\)\)/, "侧栏收起后本地主页面应按窗口宽度居中");
assert.match(app, /\.local-home-page\s*\{[^}]*transition:\s*width\s+280ms\s+ease,\s*margin-left\s+280ms\s+ease/, "本地主页面宽度和位置应平滑过渡");
assert.match(app, /\.local-home-page\s*\{[^}]*margin-left:\s*calc\(\(100%\s*-\s*min\(1180px,\s*calc\(100vw\s*-\s*224px\s*-\s*36px\)\)\)\s*\/\s*2\)/, "本地主页面应在工作区内居中");
assert.match(app, /@media\s*\(max-width:\s*980px\)[\s\S]*?\.shell-controls\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*32px\)/, "窄侧栏中的窗口工具应改为两列，避免覆盖主标题");
assert.match(sidebar, /@media\s*\(max-width:\s*980px\)[^}]*\.sidebar\s*\{[^}]*padding:\s*112px\s+10px\s+18px/, "窄侧栏导航应为两行窗口工具预留高度");
assert.match(sidebar, /@media\s*\(max-width:\s*980px\)[\s\S]*?\.mode-option-label\s*\{[^}]*display:\s*none/, "窄侧栏应隐藏模式文字，仅保留模式图标");
assert.match(sidebar, /\.mode-option\.active \.mode-option-icon\s*\{[^}]*color:\s*#43dda0/, "当前模式应通过对应图标亮起表示");
assert.match(app, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.app-shell\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*72px\s+minmax\(0,\s*1fr\)/, "手机宽度下应用壳仍应保持侧栏与内容区网格，不能把内容挤到侧栏下方");
assert.match(app, /\.main-scroll\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/, "主内容滚动区应允许收缩到窄窗口宽度");

console.log("页面横向布局契约通过");
