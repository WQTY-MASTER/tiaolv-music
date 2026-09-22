const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sidebar = fs.readFileSync(path.join(root, "src/renderer/src/components/SidebarNav.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(sidebar, /from "lucide-vue-next"/, "流媒体侧边栏应使用项目统一的 Lucide 线性图标");
for (const icon of ["Sparkles", "LayoutGrid", "Heart", "Cloud", "History"]) {
  assert.match(sidebar, new RegExp(`\\b${icon}\\b`), `流媒体侧边栏缺少 ${icon} 图标`);
}
assert.match(sidebar, /class="sidebar"[\s\S]*'streaming-sidebar': props\.mode === 'streaming'/, "侧边栏需要区分流媒体样式");
assert.match(sidebar, /v-if="props\.mode === 'streaming'" class="streaming-nav-title">流媒体<\/p>/, "流媒体导航缺少分组标题");
for (const label of ["主页", "发现歌单", "音乐库", "音乐云盘", "最近播放"]) {
  assert.match(sidebar, new RegExp(`label:\\s*"${label}"`), `流媒体侧边栏缺少 ${label}`);
}
assert.match(sidebar, /<component[\s\S]*:is="item\.icon"[\s\S]*class="streaming-nav-icon"/, "流媒体入口应渲染真实图标组件");
assert.doesNotMatch(sidebar, /class="brand"|class="account-card"|class="playlist-section"/, "新版流媒体侧边栏不应保留品牌、登录卡或我的歌单区");
assert.match(sidebar, /\.streaming-sidebar \.nav-item\.active\s*\{[^}]*background:\s*#dfe7fb[^}]*color:\s*#111827/, "流媒体选中项应使用浅蓝背景和深色文字");
assert.match(sidebar, /\.streaming-sidebar \.nav-item\s*\{[^}]*min-height:\s*44px[^}]*font-size:\s*14px/, "流媒体导航项尺寸应匹配参考图");
assert.match(sidebar, /\.streaming-nav-title\s*\{[^}]*color:\s*#687386[^}]*font-size:\s*12px/, "流媒体分组标题需要使用弱化层级");
assert.match(packageJson, /streaming-sidebar-contract\.test\.cjs/, "测试脚本需要包含流媒体侧边栏契约");

console.log("流媒体侧边栏契约通过");
