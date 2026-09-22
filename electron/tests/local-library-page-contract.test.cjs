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
assert.match(app, /localLibraryNetworkSearchEnabled = ref\(false\)/, "本地歌曲页需要联网元信息匹配开关状态");
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
assert.match(app, /清理失效文件/, "库管理菜单缺少清理失效文件入口");
assert.match(app, /筛选器/, "本地歌曲页缺少筛选器下拉按钮");
assert.match(app, /按歌手/, "筛选器菜单缺少按歌手选项");
assert.match(app, /按专辑/, "筛选器菜单缺少按专辑选项");
assert.match(app, /按格式/, "筛选器菜单缺少按格式选项");
assert.match(app, /网络搜索/, "本地歌曲页缺少网络搜索开关");
assert.match(app, /placeholder="搜索歌曲、歌手、专辑或文件夹"/, "本地歌曲页搜索框占位文案不正确");
assert.match(app, /local-library-table-header/, "本地歌曲页缺少表头");
for (const column of ["#", "标题", "专辑", "时长"]) {
  assert.match(app, new RegExp(column), `本地歌曲页表头缺少 ${column}`);
}
assert.match(app, /@contextmenu\.prevent="openLocalTrackContextMenu\(track, \$event\)"/, "歌曲行需要支持右键菜单");
assert.match(app, /@click="playLocalLibraryRow\(track\)"/, "点击歌曲行需要播放歌曲");
assert.match(app, /@click\.stop="toggleLocalTrackSelection\(track\)"/, "歌曲行需要支持多选");
assert.match(app, /filteredLocalLibraryTracks\.length/, "本地歌曲页应显示过滤后的真实歌曲数量");
assert.match(app, /currentLibrary\.value/, "本地歌曲页数据应来自本地曲库");

assert.match(packageJson, /local-library-page-contract\.test\.cjs/, "测试脚本需要包含本地歌曲页契约");

console.log("本地歌曲页契约通过");
