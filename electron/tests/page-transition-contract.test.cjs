const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(app, /const pageTransitionKey = computed\(\(\) => \[/, "页面应使用统一的过渡 key");
for (const state of [
  "appMode.value",
  "activeView.value",
  "selectedPlaylist.value?.id",
  "selectedLocalAlbum.value?.id",
  "selectedLocalArtist.value?.id",
  "selectedLocalFolderPath.value",
  "activeSettingsSection.value",
  "streamingSource.value"
]) {
  assert.ok(app.includes(state), `页面过渡 key 应包含 ${state}`);
}
const transitionKeyBlock = app.match(/const pageTransitionKey = computed\(\(\) => \[([\s\S]*?)\]\.join\("::"\)\);/)?.[1] ?? "";
assert.doesNotMatch(transitionKeyBlock, /submittedKeyword\.value/, "实时搜索不应重建页面标题与输入框");
assert.match(
  app,
  /<Transition :name="pageTransitionName" mode="out-in">\s*<div :key="pageTransitionKey" class="page-transition-frame">/,
  "主内容应使用统一的页面过渡容器",
);
assert.match(
  app,
  /<\/div>\s*<\/Transition>\s*<\/main>[\s\S]*?<PlayerBar/,
  "底部播放器应位于页面过渡容器之外",
);
assert.match(app, /function handleGlobalNavigationShortcut\(event: KeyboardEvent\)/, "应用应提供全局导航快捷键处理器");
assert.match(app, /window\.addEventListener\("keydown",\s*handleGlobalNavigationShortcut\)/, "应用挂载时应注册全局导航快捷键");
assert.match(app, /window\.removeEventListener\("keydown",\s*handleGlobalNavigationShortcut\)/, "应用卸载时应移除全局导航快捷键");
assert.doesNotMatch(app, /@keydown(?:\.[^=\s]+)*\.window/, "模板不应使用无效的 window 键盘修饰符");
assert.match(app, /event\.altKey\s*&&\s*event\.key\s*===\s*"ArrowLeft"[\s\S]*?event\.key\s*===\s*"BrowserBack"[\s\S]*?navigateBack\(\)/, "Alt+左方向键和浏览器返回键应执行应用返回");
assert.match(app, /event\.altKey\s*&&\s*event\.key\s*===\s*"ArrowRight"[\s\S]*?event\.key\s*===\s*"BrowserForward"[\s\S]*?navigateForward\(\)/, "Alt+右方向键和浏览器前进键应执行应用前进");
assert.match(app, /--app-page-transition-duration:\s*250ms/, "全站页面动画时长应固定为 250ms");
assert.match(app, /\.app-page-enter-active,[\s\S]*?\.app-page-slide-backward-leave-active\s*\{[^}]*transition:[^}]*opacity[^}]*transform/, "页面进入和离开应共用淡入淡出与位移动画");
assert.match(app, /\.app-page-enter-from\s*\{[^}]*opacity:\s*0[^}]*translate3d\(0,\s*8px,\s*0\)/, "新页面应从下方轻微淡入");
assert.match(app, /\.app-page-leave-to\s*\{[^}]*opacity:\s*0[^}]*translate3d\(0,\s*-4px,\s*0\)/, "旧页面应向上轻微淡出");
assert.match(app, /\.app-page-slide-forward-enter-from\s*\{[^}]*translate3d\(30px,\s*0,\s*0\)/, "详情页应从右侧滑入");
assert.match(app, /\.app-page-slide-forward-leave-to\s*\{[^}]*translate3d\(-30px,\s*0,\s*0\)/, "列表页应向左滑出");
assert.match(app, /\.app-page-slide-backward-enter-from\s*\{[^}]*translate3d\(-30px,\s*0,\s*0\)/, "返回时旧页面应从左侧进入");
assert.match(app, /\.app-page-slide-backward-leave-to\s*\{[^}]*translate3d\(30px,\s*0,\s*0\)/, "返回时详情页应向右滑出");
assert.match(app, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.app-page-enter-active,[\s\S]*?\.app-page-leave-active/, "减少动态效果时应关闭页面过渡");
assert.doesNotMatch(app, /streaming-home-refresh/, "音源切换不应叠加旧版主页刷新动画");
assert.match(packageJson, /page-transition-contract\.test\.cjs/, "完整测试应包含页面过渡契约");

console.log("全局页面过渡契约通过");
