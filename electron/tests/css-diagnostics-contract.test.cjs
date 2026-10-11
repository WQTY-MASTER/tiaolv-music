const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const playerBar = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerBar.vue"), "utf8");
const playerControl = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerControlButton.vue"), "utf8");

assert.match(app, /<!--suppress CssUnusedSymbol -->\s*<style>/, "App 全局样式应抑制 Vue 动态类与子组件类造成的未使用选择器误报");
assert.doesNotMatch(app, /-webkit-line-clamp:\s*2;(?!\s*line-clamp:\s*2;)/, "WebKit 多行截断应同时声明标准 line-clamp");
assert.match(app, /font-family:\s*var\(--appearance-font-family,\s*[^)]+sans-serif\)/, "动态界面字体变量应提供通用字体回退");
assert.match(app, /font-family:\s*var\(--lyric-font-family,\s*[^)]+sans-serif\)/, "动态歌词字体变量应提供通用字体回退");
assert.match(app, /\.app-shell\s*\{[^}]*--appearance-accent:/s, "应用外壳应声明动态外观变量的默认值");
assert.match(app, /\.app-shell\s*\{[^}]*--app-accent:\s*var\(--appearance-accent\)/s, "设置页强调色应复用外观强调色");
assert.match(app, /\.local-artist-index button\s*\{[^}]*--artist-letter-index:\s*0/s, "歌手索引动画变量应有默认值");
assert.match(app, /\.song-detail\s*\{[^}]*--detail-ambient-start:/s, "歌曲详情背景起始色应有默认值");
assert.match(app, /\.song-detail\s*\{[^}]*--detail-ambient-end:/s, "歌曲详情背景结束色应有默认值");
assert.match(app, /\.song-detail-lyrics\s*\{[^}]*--lyric-anchor-offset:/s, "歌词定位锚点应有默认值");
assert.match(app, /\.local-home-last-played\s*\{[^}]*--home-accent-primary:/s, "本地主页强调色应有默认值");
assert.match(app, /\.local-home-last-played\s*\{[^}]*--home-accent-secondary:/s, "本地主页次强调色应有默认值");
assert.match(app, /\.local-home-last-played\s*\{[^}]*--home-cover-image:/s, "本地主页封面背景应有默认值");
assert.doesNotMatch(app, /-webkit-mask-image:\s*linear-gradient\(/, "WebKit 遮罩应使用 IDE 与 Chromium 都能识别的前缀渐变函数");
assert.match(app, /-webkit-mask-image:\s*-webkit-linear-gradient\(top,/, "歌词淡出遮罩应使用 WebKit 前缀渐变的起始边参数");

for (const [name, source] of [["App.vue", app], ["PlayerBar.vue", playerBar], ["PlayerControlButton.vue", playerControl]]) {
  assert.doesNotMatch(source, /(?:-webkit-)?mask:\s*center\s*\/\s*contain\s+no-repeat/, `${name} 不应使用缺少图像层的 mask 简写`);
}

console.log("CSS 动态变量与遮罩语法契约通过");
