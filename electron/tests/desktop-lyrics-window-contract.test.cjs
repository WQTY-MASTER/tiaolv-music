const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entry = fs.readFileSync(path.join(root, "src/renderer/src/main.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const componentPath = path.join(root, "src/renderer/src/components/DesktopLyricsWindow.vue");

assert.ok(fs.existsSync(componentPath), "应提供独立的桌面歌词窗口组件");
const component = fs.readFileSync(componentPath, "utf8");

assert.match(entry, /URLSearchParams\(window\.location\.search\)\.get\("window"\)/, "渲染入口应读取独立窗口模式");
assert.match(entry, /windowMode === "desktop-lyrics"/, "渲染入口应识别桌面歌词窗口");
assert.match(entry, /DesktopLyricsWindow/, "桌面歌词窗口应挂载独立组件");
assert.match(component, /@pointerenter|@mouseenter/, "鼠标进入歌词窗时应显示工具栏");
assert.match(component, /@pointerleave|@mouseleave/, "鼠标离开歌词窗时应隐藏工具栏");
assert.match(component, /toolbarVisible/, "工具栏显隐应有独立状态");
assert.match(component, /preferences\.locked/, "锁定状态应阻止工具栏唤起");
assert.match(component, /desktop-lyrics-shell\.interactive[\s\S]{0,220}background:/, "未悬停时背景应透明，仅交互时显示面板底色");

const controls = [
  "previous",
  "toggle",
  "next",
  "decrease-font",
  "increase-font",
  "cycle-mode",
  "translation",
  "lock",
  "close"
];
let previousIndex = -1;
for (const control of controls) {
  const index = component.indexOf(`data-control="${control}"`);
  assert.ok(index > previousIndex, `工具栏控件 ${control} 缺失或顺序不正确`);
  previousIndex = index;
}

assert.match(component, /title="上一首"/, "按钮应提供 hover 提示");
assert.match(component, /title="显示翻译"|:title=.*翻译/, "翻译按钮应提供动态提示");
assert.match(component, /parseLyricContent/, "桌面歌词应复用现有歌词解析器");
assert.match(component, /findActiveLyricIndex/, "桌面歌词应按播放时间同步当前行");
assert.match(component, /getLyricCharacterProgress/, "桌面歌词应保留逐字进度");
assert.match(component, /getDesktopLyricCharacterFill/, "桌面歌词应渲染逐字填充比例");
assert.match(component, /scrollIntoView/, "切歌和播放时应自动滚动到当前歌词");
assert.match(component, /updateDesktopLyricsPreferences/, "字号、翻译和锁定设置应持久化");
assert.match(component, /closeDesktopLyricsWindow/, "关闭按钮应销毁独立窗口");
assert.match(app, /currentTime:\s*currentPlaybackPosition\(\)/, "初始桌面歌词状态应读取项目现有播放位置函数");
assert.doesNotMatch(app, /getCurrentPlaybackTime\(\)/, "桌面歌词同步不应调用不存在的播放位置函数");

console.log("桌面歌词窗口界面契约通过");
