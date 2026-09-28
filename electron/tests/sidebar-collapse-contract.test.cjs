const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const playerBar = fs.readFileSync(path.join(root, "src/renderer/src/components/PlayerBar.vue"), "utf8");

assert.match(app, /sidebarCollapsed/, "缺少侧栏收起状态");
assert.match(app, /toggleSidebar/, "缺少菜单按钮切换逻辑");
assert.match(app, /is-sidebar-collapsed/, "缺少收起后的根布局状态");
assert.match(
  app,
  /class="sidebar-slot"[\s\S]*:class="\{ 'is-collapsed': sidebarCollapsed && activeView !== 'settings' \}"/,
  "侧栏应通过稳定槽位控制收起状态，并在设置页保持展开"
);
assert.match(app, /:aria-label="activeView === 'settings' \? '返回' : '菜单'"/, "菜单按钮应在设置页切换为返回语义");
assert.match(app, /收起侧栏|展开侧栏/, "菜单按钮没有状态提示");
assert.match(app, /title="设置"/, "设置入口缺失");
assert.match(app, /class="shell-controls"/, "菜单和设置应由固定的左上角控制区承载");
assert.match(app, /shell-controls[\s\S]*handleShellMenuButton/, "固定控制区中的菜单按钮应走统一点击逻辑");
assert.match(app, /function handleShellMenuButton\(\)[\s\S]*toggleSidebar\(\)/, "普通页面菜单按钮应保留侧栏切换能力");
assert.match(app, /shell-controls[\s\S]*title="设置"/, "固定控制区应包含设置入口");
assert.match(app, /class="sidebar-slot"[\s\S]*SidebarNav/, "侧栏应放在稳定的布局槽位中");
assert.doesNotMatch(app, /SidebarNav[\s\S]{0,160}v-if="!sidebarCollapsed"/, "侧栏收起不应销毁主内容布局中的侧栏组件");
assert.doesNotMatch(app, /history-controls|class="search-box"/, "侧栏布局不应残留已废弃悬浮顶栏的控件");
assert.match(app, /\.app-shell\s*\{[^}]*transition:\s*grid-template-columns\s+250ms\s+ease-out/, "主区域宽度应按全局 250ms ease-out 节奏平滑过渡");
assert.match(playerBar, /left:\s*calc\(224px\s*\+\s*\(100vw\s*-\s*224px\)\s*\/\s*2\)/, "侧栏展开时播放器应避开 224px 侧栏");
assert.match(playerBar, /\.player-bar\.is-sidebar-collapsed\s*\{[^}]*left:\s*50%/, "侧栏收起时播放器应回到全窗口中央");
assert.match(playerBar, /left\s+250ms\s+ease-out[^}]*width\s+250ms\s+ease-out/, "播放器位移应与侧栏 250ms ease-out 动画同步");
assert.match(app, /\.sidebar-slot\s*\{[^}]*overflow:\s*hidden/, "侧栏槽位应裁剪收起过程中的内容，避免选中条变形");
assert.match(app, /\.sidebar-slot\s*\{[^}]*transition:\s*opacity\s+250ms\s+ease-out/, "侧栏槽位应有平滑显示过渡");
assert.match(app, /\.workspace\s*\{[^}]*overflow:\s*hidden/, "主工作区应裁剪布局过渡中的瞬时溢出");
assert.match(app, /\.main-scroll\s*\{[^}]*--surface-gutter:\s*42px/, "主内容需要统一的横向间距变量");
assert.match(app, /\.local-home-page\s*\{[^}]*width:\s*min\(1180px,\s*calc\(100vw\s*-\s*224px\s*-\s*36px\)\)/, "本地主页面应与播放器使用相同的缩短限宽规则");
assert.doesNotMatch(app, /\.local-home-last-played\s*\{[\s\S]{0,500}transition:\s*width/, "主页大卡片不应叠加独立宽度动画");
assert.doesNotMatch(app, /\.app-shell\.is-sidebar-collapsed \.local-home-last-played\s*\{/, "不应为收起状态单独设置主页大卡片宽度");
assert.match(playerBar, /\.player-bar\s*\{[^}]*transition:\s*left\s+250ms\s+ease-out,\s*width\s+250ms\s+ease-out/, "底部播放器位置和宽度应平滑过渡");
assert.match(app, /\.main-scroll\s*\{[^}]*overflow-x:\s*hidden/, "主内容不应出现底部横向滚动条");
assert.match(app, /\.app-shell\.is-sidebar-collapsed \.local-home-page\s*\{[^}]*margin-left:\s*calc\(\(100%\s*-\s*min\(1180px,\s*calc\(100vw\s*-\s*36px\)\)\)\s*\/\s*2\)/, "侧栏收起后本地主页面应与播放器一起居中");
assert.match(app, /\.local-home-random\s*\{[^}]*flex:\s*0\s+0\s+218px/, "主页右侧面板应保持固定宽度");

const sidebar = fs.readFileSync(path.join(root, "src/renderer/src/components/SidebarNav.vue"), "utf8");
assert.doesNotMatch(sidebar, /label:\s*"首页"/, "侧栏入口不应再显示为首页");
assert.match(sidebar, /id:\s*"home",\s*label:\s*"主页"/, "侧栏 home 入口应显示为主页");
assert.doesNotMatch(sidebar, /id:\s*"genres"|label:\s*"流派"/, "侧栏不应再提供流派页面入口");
assert.doesNotMatch(app, /\|\s*"genres"/, "应用视图类型中不应再保留流派页面");
assert.doesNotMatch(app, /^\s*genres:\s*"流派",?$/m, "页面标题映射中不应再保留流派页");
assert.doesNotMatch(app, /^\s*genres:\s*"按流派整理你的音乐",?$/m, "页面说明映射中不应再保留流派页");
assert.doesNotMatch(app, /const localOnlyViews[\s\S]{0,180}"genres"/, "本地模式路由白名单中不应再保留流派页");
assert.doesNotMatch(sidebar, /class="brand"|class="account-card"|class="playlist-section"/, "新版流媒体侧边栏不应保留旧品牌、登录卡和我的歌单区");
assert.match(sidebar, /props\.activeView === 'playlist' && item\.id === 'playlists'/, "歌单详情页时侧栏歌单项仍应保持选中");
assert.doesNotMatch(sidebar, /<p class="nav-caption">音乐<\/p>/, "侧栏左上角不应显示多余的音乐分组小字");
assert.match(sidebar, /\.sidebar\s*\{[^}]*width:\s*224px/, "桌面侧栏应保持固定宽度，避免选中条跟随网格变形");
assert.match(sidebar, /\.nav-item\.active\s*\{[^}]*background:\s*#202628/, "选中项应使用黑色背景标记");

console.log("侧栏收起契约通过");
