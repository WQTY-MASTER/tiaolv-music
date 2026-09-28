const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "src/renderer/src/components/SidebarNav.vue"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");

assert.match(sidebar, /id:\s*"library"[\s\S]{0,90}label:\s*"所有歌曲"/, "本地模式侧栏入口应改为所有歌曲");
assert.match(sidebar, /id:\s*"library"[\s\S]{0,90}icon:\s*"♫"/, "所有歌曲入口应使用乐符图标");

assert.match(app, /localLibrarySearchKeyword = ref\(""\)/, "本地歌曲页需要实时搜索关键词状态");
assert.match(app, /localLibraryNetworkSearchEnabled = computed/, "本地歌曲页网络搜索需要与全局歌词匹配设置联动");
assert.match(
  app,
  /localLibraryNetworkSearchEnabled = computed\([\s\S]{0,240}localLyricsOnlineMatchEnabled\.value/,
  "网络搜索开关应读写本地歌曲联网匹配歌词状态"
);
assert.match(app, /filteredLocalLibraryTracks/, "本地歌曲页需要基于曲库生成过滤后的歌曲列表");
assert.match(app, /localTrackAudioInfo/, "本地歌曲页需要展示格式、采样率、位深等音频信息");
assert.match(app, /playAllLocalTracks/, "本地歌曲页缺少播放全部逻辑");
assert.match(app, /playRandomAllLocalTracks/, "本地歌曲页缺少随机播放列表逻辑");
assert.match(app, /openLocalTrackContextMenu/, "本地歌曲页缺少右键菜单入口");
assert.match(app, /local-track-context-menu/, "本地歌曲页右键菜单需要可见的菜单面板");
assert.match(app, /toggleLocalTrackSelection/, "本地歌曲页缺少多选状态逻辑");

assert.match(app, /local-library-page/, "本地歌曲页缺少独立页面容器");
assert.match(app, /<h1>本地音乐<\/h1>/, "本地歌曲页大标题应为本地音乐");
assert.match(app, /播放全部/, "本地歌曲页缺少播放全部按钮");
assert.match(app, /随机播放/, "本地歌曲页缺少随机播放按钮");
assert.match(app, /库管理/, "本地歌曲页缺少库管理下拉按钮");
assert.match(app, /添加文件夹/, "库管理菜单缺少添加文件夹入口");
assert.match(app, /扫描本地音乐库/, "库管理菜单缺少扫描本地音乐库入口");
assert.match(app, /重新解析全部歌曲文件名元信息/, "库管理菜单缺少全库文件名元信息重解析入口");
assert.match(app, /reparseAllLocalMetadata/, "全库文件名元信息重解析入口缺少执行逻辑");
assert.match(app, /查找重复歌曲/, "库管理菜单缺少查找重复歌曲入口");
assert.match(
  app,
  /<button[^>]*@click="openDuplicateFinder"[^>]*>查找重复歌曲<\/button>/,
  "查找重复歌曲在仅路径去重模式下也应保持可用"
);
assert.match(app, /恢复已忽略歌曲/, "库管理菜单缺少恢复已忽略歌曲入口");
assert.match(app, /localDuplicateGroups/, "本地音乐页缺少疑似重复歌曲分组逻辑");
assert.match(app, /duplicateTrackIds/, "本地音乐页缺少疑似重复歌曲标记集合");
assert.match(app, />\s*疑似重复\s*</, "元信息标记模式下歌曲列表应显示疑似重复标签");
assert.match(app, /duplicate-finder-dialog/, "查找重复歌曲需要独立管理弹窗");
assert.match(app, /track\.filePath/, "重复歌曲管理应展示每条歌曲的文件路径");
assert.match(app, />\s*保留本条\s*</, "重复歌曲管理缺少保留本条操作");
assert.match(app, />\s*从音乐库移除所选\s*</, "重复歌曲管理缺少移除所选库记录操作");
assert.match(app, />\s*全部保留\s*</, "重复歌曲管理缺少全部保留操作");
assert.match(app, /ignoreLocalLibraryTracks/, "移除重复歌曲应调用忽略库记录接口");
assert.match(app, /清理失效文件/, "库管理菜单缺少清理失效文件入口");
assert.match(app, /筛选器/, "本地歌曲页缺少筛选器下拉按钮");
assert.match(app, /按歌手/, "筛选器菜单缺少按歌手选项");
assert.match(app, /按专辑/, "筛选器菜单缺少按专辑选项");
assert.match(app, /按格式/, "筛选器菜单缺少按格式选项");
assert.match(app, /const localToolMenuOpen = ref<"library" \| "filter" \| null>\(null\)/, "库管理与筛选器应共享互斥展开状态");
assert.match(app, /v-if="localToolMenuOpen === 'library'"/, "库管理菜单应由互斥状态控制");
assert.match(app, /v-if="localToolMenuOpen === 'filter'"/, "筛选器菜单应由互斥状态控制");
assert.match(app, /document\.addEventListener\("pointerdown", handleLocalToolMenuPointerDown\)/, "点击工具区外部应关闭菜单");
assert.match(app, /\.local-tool-menu-library \.local-tool-popover\s*\{[^}]*width:\s*230px/, "库管理菜单应为长操作文案预留稳定宽度");
assert.match(app, /\.local-tool-menu-filter \.local-tool-popover\s*\{[^}]*right:\s*auto[^}]*left:\s*0[^}]*width:\s*230px/, "筛选器菜单应与库管理使用相同宽度并和触发按钮左对齐");
assert.match(app, /\.local-tool-popover button\s*\{[^}]*white-space:\s*nowrap/, "工具菜单文案不应意外换行");
assert.match(app, /网络搜索/, "本地歌曲页缺少网络搜索开关");
assert.match(
  app,
  /function matchLocalLyrics[\s\S]{0,500}!localLyricsOnlineMatchEnabled\.value[\s\S]{0,240}return/,
  "网络搜索关闭后，手动和自动歌词匹配都不得发起联网请求"
);
assert.match(
  app,
  /:disabled="localLyricsMatchPending \|\| !localLyricsOnlineMatchEnabled"/,
  "网络搜索关闭时应禁用重新匹配歌词按钮"
);
assert.match(app, /placeholder="搜索歌曲、歌手、专辑或文件夹"/, "本地歌曲页搜索框占位文案不正确");
assert.match(app, /local-library-table-header/, "本地歌曲页缺少表头");
for (const column of ["#", "标题", "专辑", "时长"]) {
  assert.match(app, new RegExp(column), `本地歌曲页表头缺少 ${column}`);
}
assert.match(app, /\.local-library-table-header span:nth-child\(1\)\s*\{[^}]*text-align:\s*center/, "序号表头应与歌曲序号居中对齐");
assert.match(app, /\.local-library-table-header span:nth-child\(2\)\s*\{[^}]*padding-left:\s*58px/, "标题表头应与封面右侧的歌曲文字对齐");
assert.match(app, /\.local-library-table-header span:nth-child\(3\),\.local-library-table-header span:nth-child\(4\)\s*\{[^}]*text-align:\s*left/, "专辑和时长表头应与对应数据左对齐");
assert.match(app, /\.local-library-album\s*\{[^}]*text-align:\s*left/, "专辑数据应从专辑列左侧开始显示");
assert.match(app, /\.local-library-duration\s*\{[^}]*justify-items:\s*start/, "时长数据应向中间移动并从时长列左侧开始显示");
assert.match(app, /\.local-library-table-header\s*\{[^}]*padding:\s*10px 40px 14px 14px/, "列表表头上方和右侧应保留舒适边距");
assert.match(app, /\.local-library-row\s*\{[^}]*padding:\s*9px 40px 9px 14px/, "歌曲时长不应贴近列表右侧边界");
assert.match(app, /@contextmenu\.prevent="openLocalTrackContextMenu\(track, \$event\)"/, "歌曲行需要支持右键菜单");
assert.match(app, /@click="playLocalLibraryRow\(track\)"/, "点击歌曲行需要播放歌曲");
assert.match(app, /@click\.stop="toggleLocalTrackSelection\(track\)"/, "歌曲行需要支持多选");
assert.match(app, /filteredLocalLibraryTracks\.length/, "本地歌曲页应显示过滤后的真实歌曲数量");
assert.match(app, /currentLibrary\.value/, "本地歌曲页数据应来自本地曲库");

assert.match(packageJson, /local-library-page-contract\.test\.cjs/, "测试脚本需要包含本地歌曲页契约");

console.log("本地歌曲页契约通过");
