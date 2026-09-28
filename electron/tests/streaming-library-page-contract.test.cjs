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
assert.match(component, /\.profile-copy > span\s*\{[^}]*color:\s*#66758d[^}]*font-size:\s*14px[^}]*font-weight:\s*700/s, "个人音乐库眉题应使用清晰的蓝灰色粗体");
assert.match(component, /\.profile-copy p\s*\{[^}]*color:\s*#c18a3d[^}]*font-weight:\s*650/s, "个人简介应使用暖黄色");
assert.match(component, /\.profile-copy h2\s*\{[^}]*color:\s*#2d2721[^}]*font-family:\s*"Microsoft YaHei UI"[^}]*font-weight:\s*900[^}]*text-shadow:\s*none[^}]*-webkit-text-stroke:\s*0 transparent/s, "个人昵称标题应使用暖黑粗体且无彩色重影");
assert.match(component, /\.favorites-art\s*\{[^}]*border-radius:\s*12px/s, "收藏歌曲封面应使用更柔和的圆角");
assert.match(component, /v-if="!account" class="streaming-library-login"/, "未登录时应展示登录空状态");
assert.match(component, /请先登录 \{\{ providerName \}\}/, "登录提示应跟随当前音源");
assert.match(component, /:class="\{ selected: provider === 'netease' \}"/, "音源菜单应高亮当前网易云音源");
assert.match(component, /音源可用/, "已登录音源应展示可用状态");
assert.match(component, /未登录/, "未绑定音源应展示未登录状态");
assert.match(component, /ChevronUp/, "音源菜单展开时应显示向上箭头");
assert.match(component, /我喜欢的歌曲/);
assert.doesNotMatch(component, /<Heart\b/, "收藏封面不应再叠加中央爱心");
assert.match(component, /\.favorites-art\s*\{[^}]*border:\s*2px solid rgba\(255,\s*255,\s*255,\s*\.94\)[^}]*box-shadow:\s*0 14px 30px rgba\(63,\s*82,\s*112,\s*\.2\)/s, "收藏封面应使用白色细边框和蓝灰阴影");
assert.match(component, /最近播放/);
assert.match(component, /听歌排行/);
assert.match(component, /class="account-playlists-section"/, "最近播放和听歌排行下方应展示我的歌单模块");
assert.match(component, /我的歌单[\s\S]*个在线列表/, "我的歌单标题应展示在线列表数量");
assert.match(component, /全部[\s\S]*我创建的[\s\S]*我收藏的/, "我的歌单应提供三类筛选标签");
assert.match(component, /长按歌单拖动排序[\s\S]*Alt \+ ↑ \/ ↓/, "我的歌单应说明拖动与键盘排序方式");
assert.match(component, /emit\('create-playlist'\)/, "创建歌单按钮应触发在线歌单创建流程");
assert.match(component, /emit\('open-playlist', playlist\)/, "点击歌单项应打开对应在线歌单");
assert.match(component, /event\.altKey[\s\S]*ArrowUp[\s\S]*ArrowDown/, "歌单项应支持 Alt 加方向键排序");
assert.match(component, /@click\.stop="emit\('play-favorites'\)"/, "收藏卡应支持播放全部");
assert.doesNotMatch(component, /@click="openOrLogin\('profile'\)"/, "个人资料卡本身不应再触发跳转");
assert.match(component, /@click\.stop="emit\('open-following'\)"/, "关注统计应可进入关注列表");
assert.match(component, /@click\.stop="emit\('open-followers'\)"/, "粉丝统计应可进入粉丝列表");
assert.match(component, /transition:\s*transform 300ms ease/, "卡片 hover 动画应为 300ms");
assert.match(app, /<StreamingLibraryPage/);
assert.match(app, /<StreamingLibraryPage[\s\S]*:playlists="accountPlaylists"[\s\S]*@open-playlist="openAccountPlaylistInUnifiedView"[\s\S]*@create-playlist="openStreamingPlaylistCreateDialog"/, "音乐库应向我的歌单模块传入账号歌单并连接操作");
assert.match(app, /function openAccountPlaylistInUnifiedView\(playlist: Playlist\)[\s\S]*accountScoped:\s*true[\s\S]*streamingTemplate:\s*true[\s\S]*selectPlaylist/, "我的歌单应复用最近播放和听歌排行使用的统一歌单详情页");
assert.match(app, /activeView === 'streaming-library'/);
assert.match(app, /'is-library-heading': appMode === 'streaming' && activeView === 'streaming-library'/, "音乐库标题应使用独立的主页高度样式");
assert.match(app, /\.page-heading\.is-library-heading,[\s\S]{0,100}\{[^}]*margin:[^;]*88px/s, "音乐库整体应下移到主页高度");
assert.match(app, /loadStreamingLibraryData/);
assert.match(
  app,
  /async function loadAccountContent\(\)[\s\S]*?accountFavoriteTracks\.value = \[\];[\s\S]*?accountPlaylists\.value = \[\];[\s\S]*?accountProfile\.value = null;[\s\S]*?accountRecentTracks\.value = \[\];[\s\S]*?accountListeningRank\.value = \[\];[\s\S]*?Promise\.allSettled/,
  "切换音源加载音乐库前应清空上一音源的账号数据",
);
assert.match(
  app,
  /profileResult\.status === "fulfilled"[\s\S]*accounts\.value = accounts\.value\.map\([\s\S]*nickname:[\s\S]*avatarUrl:/,
  "音乐库刷新账号资料后应同步顶部账号头像与昵称",
);
assert.doesNotMatch(app, /account-profile/, "旧个人主页路由应被移除");
assert.match(app, /account-following/, "应提供关注列表路由");
assert.match(app, /account-followers/, "应提供粉丝列表路由");
assert.match(app, /<StreamingSocialPage/, "关注与粉丝应复用社交列表组件");
assert.match(app, /activeView === 'listening-ranking'/);
assert.match(app, /<StreamingDailyMixPage[\s\S]*activeView === 'streaming-recent'/, "最近播放应复用歌单详情页面");
assert.match(app, /activeView === 'streaming-recent'[\s\S]{0,700}:reorderable="false"[\s\S]{0,200}title="最近播放"[\s\S]{0,100}label="最近"/, "最近播放详情应保持历史顺序只读并显示正确标题");
assert.match(app, /@play-all="playAccountRecentTrackList"[\s\S]*@play-random="playAccountRecentTrackListRandom"[\s\S]*@toggle-favorite="toggleAccountRecentFavorite"/, "最近播放详情应绑定真实播放与收藏交互");
assert.match(app, /<StreamingDailyMixPage[\s\S]*activeView === 'listening-ranking'/, "听歌排行应复用歌单详情页面");
assert.match(app, /activeView === 'listening-ranking'[\s\S]{0,700}:reorderable="false"[\s\S]{0,200}title="听歌排行"[\s\S]{0,100}label="排行"/, "听歌排行详情应保持排行顺序只读并显示正确标题");
assert.match(app, /v-if="[^"]*!\['streaming-recent', 'listening-ranking', 'account-following'[^"]*"\s*class="page-heading"/, "音乐库歌曲详情页不应叠加旧的全局页头");
assert.match(app, /@play-all="playAccountListeningRankTrackList"[\s\S]*@play-random="playAccountListeningRankTrackListRandom"[\s\S]*@toggle-favorite="toggleAccountListeningRankFavorite"/, "听歌排行详情应绑定真实播放与收藏交互");
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
assert.match(socialPage, /emit\(["']open-artist["']/, "统一关注列表中的歌手应可进入歌手详情");
assert.match(api, /export function loadAccountFollowing\b/, "前端应提供关注列表接口");
assert.match(api, /type\?:\s*"user"\s*\|\s*"artist"/, "关注条目应区分普通用户与歌手");
assert.match(api, /export function loadAccountFollowers\b/, "前端应提供粉丝列表接口");
assert.match(api, /export function loadAccountUserProfile\b/, "前端应提供公开用户资料接口");
assert.doesNotMatch(app, /loadAccountFollowing\(provider,\s*1000,\s*0\)/, "关注列表不应一次请求 1000 条数据");
assert.match(
  app,
  /loadAccountFollowing\(provider,\s*ACCOUNT_SOCIAL_PAGE_SIZE,\s*\(page - 1\) \* ACCOUNT_SOCIAL_PAGE_SIZE\)/,
  "关注列表应和粉丝列表一样按页请求",
);
assert.match(api, /const REQUEST_TIMEOUT_MS = 12_000;/, "前端请求应设置统一超时，避免页面无限加载");
assert.match(api, /controller\.abort\(\)/, "请求超时后应主动中止 fetch");
assert.match(accountController, /@GetMapping\("\/\{provider\}\/following"\)/, "后端应暴露关注列表接口");
assert.match(accountController, /@GetMapping\("\/\{provider\}\/followers"\)/, "后端应暴露粉丝列表接口");
assert.match(accountController, /@GetMapping\("\/\{provider\}\/users\/\{userId\}"\)/, "后端应暴露公开用户资料接口");
assert.match(neteaseProvider, /loadAccountFollowing[\s\S]*loadAccountFollowedArtists/, "网易云关注列表应读取 artist/sublist 中的关注歌手");
assert.match(neteaseProvider, /loadAccountSocialUsers\("\/user\/followeds"/, "网易云粉丝列表应调用 user/followeds");
assert.match(app, /account-user-profile/, "应提供公开用户主页路由");
assert.match(app, /<StreamingUserProfilePage/, "应渲染公开用户主页组件");
assert.match(
  app,
  /:following-count="Math\.max\(accountProfile\?\.follows \?\? 0, accountFollowing\.length\)"/,
  "音乐库关注数字应优先保留账号资料返回的真实总数"
);
assert.match(
  app,
  /toggleStreamingArtistFollow[\s\S]*selectedStreamingArtistProvider\.value === "qq"[\s\S]*accountProfile\.value[\s\S]*follows:/,
  "关注歌手成功后应立即同步音乐库资料计数"
);
assert.match(app, /@open-artist="openSocialArtist"/, "关注歌手卡片应连接现有歌手详情页");
assert.match(component, /followingCount:\s*number/, "音乐库应接收合并后的关注总数");
assert.match(component, /\{\{ followingCount \}\}[\s\S]*关注/, "关注按钮应展示合并后的真实数量");
assert.match(component, /\.profile-stats button\s*\{[^}]*color:\s*#72584d[^}]*background:\s*rgba\(255,\s*246,\s*241,\s*\.9\)/s, "关注与粉丝按钮应使用更清晰的暖色对比");

console.log("流媒体音乐库页面契约通过");
