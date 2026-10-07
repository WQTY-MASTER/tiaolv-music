const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main/main.ts"), "utf8");
const componentPath = path.join(root, "src/renderer/src/components/AppearanceSettings.vue");

assert.ok(fs.existsSync(componentPath), "外观设置组件应存在");
const component = fs.readFileSync(componentPath, "utf8");
const miniPlayerSettings = fs.readFileSync(path.join(root, "src/renderer/src/components/MiniPlayerAppearanceSettings.vue"), "utf8");

assert.match(app, /activeSettingsSection === 'appearance'/, "外观组件必须挂载在设置的外观分组");
assert.match(app, /<AppearanceSettings/, "外观分组应挂载完整组件");
for (const label of [
  "主题模式", "界面动画", "浅色强调色", "深色强调色", "自定义背景", "封面主题色",
  "全局字体", "界面排版密度", "歌词显示样式", "歌词字体", "歌词字号",
  "歌词字重", "歌词行距", "未播放暗度", "聚焦行数", "逐字高亮", "歌词颜色"
]) {
  assert.match(component, new RegExp(label), `外观页应提供${label}`);
}
assert.doesNotMatch(component, /歌词对齐/, "歌曲播放页恢复固定左对齐后不应保留无效的对齐设置");
assert.match(component, /selectPlaylistCoverImage/, "背景图片应复用安全的图片选择入口");
assert.match(main, /extensions:\s*\[[^\]]*"webp"/, "Electron 图片选择器应支持 WebP 背景");
assert.match(component, /本地主页[\s\S]*设置与插件[\s\S]*流媒体页[\s\S]*播放页/, "应支持统一及分页面背景");
assert.match(miniPlayerSettings, /迷你播放器/, "迷你播放器高级入口应保留在外观页");
assert.match(component, /const backgroundOpen = ref\(false\)/, "自定义背景默认应为收起状态");
assert.match(component, /const lyricStyleOpen = ref\(false\)/, "歌词显示样式默认应为收起状态");
assert.match(component, /const expandedPage = ref<AppearancePage \| null>\(null\)/, "分页面背景默认不应展开任一页面");
assert.match(miniPlayerSettings, /const open = ref\(false\)/, "迷你播放器设置默认应为收起状态");
assert.doesNotMatch(component, /播放条形态与可见性|播放条按钮编排|液态玻璃材质|卡片与背景自定义/, "外观页不应显示未开放的高级占位入口");
assert.doesNotMatch(component, />\s*保存\s*</, "外观设置应实时生效，不应需要保存按钮");
assert.match(app, /writeAppearancePreferences/, "外观参数应持久化");
assert.match(app, /resolvePageBackground/, "应用应解析当前页面背景");
assert.match(app, /is-outside-focus/, "歌词聚焦行数应影响歌曲页渲染");
assert.match(component, /自定义歌词配色[\s\S]*正文[\s\S]*当前行[\s\S]*扫光/, "自定义歌词配色应独立提供正文、当前行和扫光颜色");
assert.match(app, /--lyric-sweep-color[\s\S]*--lyric-active-color[\s\S]*--lyric-inactive-color/, "三种歌词颜色应分别接入播放页变量");
assert.match(app, /density-compact[\s\S]*local-library-row[\s\S]*recent-history-row[\s\S]*streaming-search-track/, "紧凑密度应覆盖本地与流媒体歌曲列表");
assert.match(app, /density-comfortable[\s\S]*local-library-row[\s\S]*recent-history-row[\s\S]*streaming-search-track/, "舒展密度应覆盖本地与流媒体歌曲列表");
assert.match(app, /has-custom-background-image\s+\.sidebar-slot\s*>\s*:is\(\.sidebar,\s*\.settings-sidebar\)\s*\{[^}]*backdrop-filter:\s*blur\(/, "自定义背景下普通侧栏和设置侧栏应共用磨砂材质");
assert.match(app, /const hasConfiguredBackgroundImage = computed\([\s\S]*mode === "image"[\s\S]*imagePath/, "侧栏磨砂状态应由已保存的图片配置立即决定");
assert.match(app, /"has-custom-background-image": hasConfiguredBackgroundImage\.value/, "侧栏不应等待图片解码后才切换磨砂背景");
assert.doesNotMatch(app, /"has-custom-background-image": appearanceBackgroundImage\.value !== "none"/, "侧栏磨砂状态不能依赖异步解码结果");
assert.match(app, /\.settings-page\s*\{[^}]*width:\s*min\(1180px,\s*calc\(100%\s*-\s*64px\)\)[^}]*margin-inline:\s*auto/, "设置内容区应居中加宽并保持对称留白");

console.log("外观设置页契约通过");
