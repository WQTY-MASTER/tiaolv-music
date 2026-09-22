const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const component = fs.readFileSync(
  path.join(root, "src/renderer/src/components/StreamingLibraryPage.vue"),
  "utf8",
);
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const socialPagePath = path.join(root, "src/renderer/src/components/StreamingSocialPage.vue");
const socialPage = fs.existsSync(socialPagePath) ? fs.readFileSync(socialPagePath, "utf8") : "";
const oldProfilePagePath = path.join(root, "src/renderer/src/components/StreamingAccountProfilePage.vue");
const backendRoot = path.resolve(root, "../backend/src/main/java/com/listenmusic");
const accountController = fs.readFileSync(path.join(backendRoot, "api/AccountController.java"), "utf8");
const neteaseProvider = fs.readFileSync(path.join(backendRoot, "provider/NetEaseProvider.java"), "utf8");

for (const apiName of ["loadAccountProfile", "loadAccountRecentTracks", "loadAccountListeningRank"]) {
  assert.match(api, new RegExp(`export function ${apiName}\\b`), `缺少音乐库接口：${apiName}`);
}

assert.match(component, /class="streaming-library-grid"/, "音乐库应使用 2x2 卡片网格");
assert.match(component, /providerName }}个人音乐库/);
assert.match(component, /v-if="!account" class="streaming-library-login"/, "未登录时应展示登录空状态");
assert.match(component, /请先登录 \{\{ providerName \}\}/, "登录提示应跟随当前音源");
assert.match(component, /:class="\{ selected: provider === 'netease' \}"/, "音源菜单应高亮当前网易云音源");
assert.match(component, /音源可用/, "已登录音源应展示可用状态");
assert.match(component, /未登录/, "未绑定音源应展示未登录状态");
assert.match(component, /ChevronUp/, "音源菜单展开时应显示向上箭头");
assert.match(component, /我收藏的歌曲/);
assert.match(component, /最近播放/);
assert.match(component, /听歌排行/);
assert.match(component, /@click\.stop="emit\('play-favorites'\)"/, "收藏卡应支持播放全部");
assert.doesNotMatch(component, /@click="openOrLogin\('profile'\)"/, "个人资料卡本身不应再触发跳转");
assert.match(component, /@click\.stop="emit\('open-following'\)"/, "关注统计应可进入关注列表");
assert.match(component, /@click\.stop="emit\('open-followers'\)"/, "粉丝统计应可进入粉丝列表");
assert.match(component, /transition:\s*transform 300ms ease/, "卡片 hover 动画应为 300ms");
assert.match(app, /<StreamingLibraryPage/);
assert.match(app, /activeView === 'streaming-library'/);
assert.match(app, /'is-library-heading': appMode === 'streaming' && activeView === 'streaming-library'/, "音乐库标题应使用独立的主页高度样式");
assert.match(app, /\.page-heading\.is-library-heading\s*\{[^}]*margin:[^;]*88px/s, "音乐库整体应下移到主页高度");
assert.match(app, /loadStreamingLibraryData/);
assert.doesNotMatch(app, /account-profile/, "旧个人主页路由应被移除");
assert.match(app, /account-following/, "应提供关注列表路由");
assert.match(app, /account-followers/, "应提供粉丝列表路由");
assert.match(app, /<StreamingSocialPage/, "关注与粉丝应复用社交列表组件");
assert.match(app, /activeView === 'listening-ranking'/);
assert.match(component, /rgba\(39, 48, 65, 0\.0[34]\)/, "音乐库卡片应使用轻薄弥散阴影");
assert.match(component, /\.streaming-library-card\s*\{[^}]*border-radius:\s*24px/s, "四张音乐库卡片应使用大圆角");
assert.match(app, /'is-library-subpage-heading': appMode === 'streaming'/, "音乐库子页面应使用统一顶部间距");
assert.match(app, /is-library-detail-page/, "音乐库收藏详情应使用统一顶部间距");
assert.equal(fs.existsSync(oldProfilePagePath), false, "旧个人主页组件应删除");
assert.match(socialPage, /emit\(["']back["']\)/, "社交列表应支持返回音乐库");
assert.match(socialPage, /搜索歌曲、歌手、专辑或文件夹/, "社交页应复用全局搜索提示");
assert.match(socialPage, /update:searchKeyword/, "社交页搜索框应绑定全局搜索状态");
assert.doesNotMatch(socialPage, /filteredUsers/, "社交页不应把全局搜索框用于本地用户过滤");
assert.match(socialPage, /emit\(["']change-page["']/, "社交列表应支持分页切换");
assert.match(socialPage, /emit\(["']open-user["']/, "社交用户卡片应可进入用户主页");
assert.match(api, /export function loadAccountFollowing\b/, "前端应提供关注列表接口");
assert.match(api, /export function loadAccountFollowers\b/, "前端应提供粉丝列表接口");
assert.match(api, /export function loadAccountUserProfile\b/, "前端应提供公开用户资料接口");
assert.match(accountController, /@GetMapping\("\/\{provider\}\/following"\)/, "后端应暴露关注列表接口");
assert.match(accountController, /@GetMapping\("\/\{provider\}\/followers"\)/, "后端应暴露粉丝列表接口");
assert.match(accountController, /@GetMapping\("\/\{provider\}\/users\/\{userId\}"\)/, "后端应暴露公开用户资料接口");
assert.match(neteaseProvider, /loadAccountSocialUsers\("\/user\/follows"/, "网易云关注列表应调用 user/follows");
assert.match(neteaseProvider, /loadAccountSocialUsers\("\/user\/followeds"/, "网易云粉丝列表应调用 user/followeds");
assert.match(app, /account-user-profile/, "应提供公开用户主页路由");
assert.match(app, /<StreamingUserProfilePage/, "应渲染公开用户主页组件");

console.log("流媒体音乐库页面契约通过");
