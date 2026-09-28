const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const api = fs.readFileSync(path.join(root, "src/renderer/src/services/api.ts"), "utf8");

assert.match(app, /\|\s*"settings"/, "视图类型缺少 settings");
assert.match(app, /function openSettingsPage/, "设置按钮缺少打开设置页的方法");
assert.match(app, /aria-label="设置"[\s\S]*@click="openSettingsPage"/, "左上角设置按钮没有进入设置页");
assert.match(app, /function handleShellMenuButton/, "左上角菜单按钮需要在设置页切换为返回逻辑");
assert.match(app, /activeView\.value === "settings"[\s\S]{0,220}navigateBack\(\)/, "设置页点击菜单按钮应返回上一页而不是收起侧栏");
assert.match(app, /@click="handleShellMenuButton"/, "左上角菜单按钮应走统一判断逻辑");
assert.match(app, /v-if="activeView === 'settings'"[\s\S]{0,120}settings-back-icon/, "设置页左上角需要显示返回箭头图标");
assert.doesNotMatch(app, /aria-label="菜单"[\s\S]{0,220}@click="toggleSidebar"/, "设置页菜单按钮不应直接绑定侧栏收起逻辑");
assert.match(app, /settings-page/, "缺少设置页容器");
assert.match(app, /settings-sidebar/, "设置页缺少专用侧边栏");
assert.match(
  app,
  /'is-sidebar-collapsed':\s*sidebarCollapsed\s*&&\s*activeView\s*!==\s*'settings'/,
  "设置页侧边栏不应继承主侧栏的收起状态"
);
assert.match(app, /settingsSearchKeyword/, "设置页缺少搜索关键字状态");
assert.match(app, /placeholder="搜索设置"/, "设置页侧边栏缺少搜索栏");
for (const item of ["常规", "播放", "外观", "桌面歌词", "快捷键", "关于"]) {
  assert.match(app, new RegExp(item), `设置页侧边栏缺少 ${item}`);
}
assert.match(app, /本地音乐库设置/, "设置页缺少本地音乐库分组");
assert.match(app, /选择本地音乐库/, "设置页缺少选择本地音乐库入口");
assert.match(app, />\s*扫描音乐库\s*</, "设置页缺少手动扫描音乐库按钮");
assert.match(app, /重置音乐库/, "设置页缺少重置音乐库入口");
assert.match(
  app,
  /class="settings-field settings-library-field"[\s\S]{0,900}class="settings-actions"/,
  "音乐库操作按钮应位于当前音乐库路径行的右侧"
);
assert.match(app, /handleResetLocalLibrary/, "设置页缺少重置音乐库逻辑");
assert.match(app, /window\.confirm\([\s\S]*重置音乐库/, "重置音乐库需要二次确认");
assert.match(app, /resetLocalLibrary\(\)/, "重置音乐库没有调用后端清库接口");
assert.doesNotMatch(app, /class="topbar"|floatingTopbarVisible/, "设置页不应依赖已废弃的全局悬浮顶栏");
assert.match(app, /shouldHidePlayerBar[\s\S]*activeView\.value === "settings"/, "设置页需要隐藏底部播放栏");
assert.match(api, /export function resetLocalLibrary/, "前端 API 缺少 resetLocalLibrary");
assert.match(api, /\/library\/select-directory/, "浏览器开发模式缺少后端目录选择接口");
assert.match(api, /\/library\/scan\/incremental/, "前端缺少增量扫描接口");
assert.match(app, /localLibraryScanPending/, "设置页缺少扫描中状态");
assert.match(app, /扫描完成，共找到.*新增.*移除失效/, "扫描完成提示缺少总数、新增数和移除数");
assert.ok(
  app.indexOf('class="settings-scan-toast"') < app.indexOf(`<template v-if="activeView === 'settings'">`),
  "扫描提示应为全局浮层，确保启动自动扫描时也能显示"
);
assert.doesNotMatch(app, /class="settings-message/, "设置卡片底部不应重复显示扫描结果");
assert.match(app, /自动扫描音乐库/, "设置页缺少启动自动扫描开关");
assert.match(app, /AUTO_SCAN_LOCAL_LIBRARY_STORAGE_KEY/, "自动扫描设置需要持久化");
assert.match(app, /LOCAL_LIBRARY_DIRECTORY_STORAGE_KEY/, "本地音乐库路径需要持久化");
assert.match(app, /onMounted\([\s\S]*autoScanLocalLibraryEnabled[\s\S]*scanMusicFolder/, "软件启动后应按开关自动扫描一次");
assert.match(app, /启动后进入/, "常规设置缺少启动主页选项");
assert.match(app, /选择每次打开应用时默认显示的主页/, "启动主页选项缺少说明");
assert.match(app, /本地音乐主页/, "启动主页选项缺少本地音乐主页");
assert.match(app, /流媒体主页/, "启动主页选项缺少流媒体主页");
assert.match(app, /STARTUP_HOME_STORAGE_KEY/, "启动主页设置需要持久化");
assert.match(app, /function readStartupHome[\s\S]{0,220}return\s+"local"/, "启动主页应默认选择本地音乐主页");
assert.match(app, /const startupHome = ref<AppMode>\(readStartupHome\(\)\)/, "启动主页设置缺少独立状态");
assert.match(app, /const appMode = ref<AppMode>\(startupHome\.value\)/, "应用启动模式应读取启动主页设置");
assert.doesNotMatch(app, /watch\(startupHome[\s\S]{0,260}appMode\.value\s*=/, "修改启动主页设置时不应立即切换当前页面");
assert.match(app, /使用文件名补全歌曲信息/, "设置页缺少文件名元信息补全开关");
assert.match(app, /USE_FILENAME_METADATA_STORAGE_KEY/, "文件名元信息补全开关需要持久化");
assert.match(
  app,
  /readUseFilenameMetadataEnabled[\s\S]{0,180}!==\s*"false"/,
  "文件名元信息补全开关应默认开启"
);
assert.match(api, /useFilenameMetadata/, "扫描接口需要携带文件名元信息补全设置");
assert.match(api, /\/library\/metadata\/reparse/, "前端缺少全库元信息重解析接口");
assert.match(api, /metaSource\?:\s*"embedded"\s*\|\s*"filename"/, "前端歌曲模型缺少 metaSource");
assert.match(app, /重复歌曲识别模式/, "设置页缺少重复歌曲识别模式");
assert.match(app, /DUPLICATE_RECOGNITION_MODE_STORAGE_KEY/, "重复歌曲识别模式需要持久化");
assert.match(
  app,
  /function readDuplicateRecognitionMode[\s\S]{0,260}return\s+"path"/,
  "重复歌曲识别模式应默认仅路径去重"
);
assert.match(app, /<select v-model="duplicateRecognitionMode"/, "重复歌曲识别模式应使用下拉选择");
assert.match(app, /仅路径去重（推荐）/, "重复歌曲识别模式缺少默认安全选项");
assert.match(app, /标记疑似重复歌曲/, "重复歌曲识别模式缺少元信息标记选项");
assert.match(
  app,
  /duplicateRecognitionMode === 'path'[\s\S]{0,260}仅拦截相同文件路径；不同路径的文件会分别保留/,
  "仅路径去重模式应说明不同路径文件会分别保留"
);
assert.match(
  app,
  /按歌名 \+ 歌手识别，仅标记疑似重复曲目；存在误识别可能，不会自动移除歌曲/,
  "疑似重复模式应说明识别依据、误识别风险和安全边界"
);
assert.match(api, /export function loadLocalLibraryRoots/, "前端 API 缺少本地音乐库目录列表接口");
assert.match(api, /export function scanAllLibrariesIncrementally/, "前端 API 缺少全部音乐库增量扫描接口");
assert.match(app, /全部已添加音乐库文件夹执行一次增量扫描/, "自动扫描说明应覆盖全部已添加文件夹");
assert.match(app, /localLyricsOnlineMatchEnabled/, "设置页缺少本地歌曲联网匹配歌词开关");
assert.match(app, /本地歌曲联网匹配歌词/, "设置页应说明联网匹配歌词功能");
assert.match(app, /LOCAL_LYRICS_MATCH_STORAGE_KEY/, "联网匹配歌词开关应持久化且默认关闭");
assert.match(app, /将联网下载的歌词保存到音乐同目录/, "设置页缺少歌词同目录保存开关");
assert.match(app, /SAVE_MATCHED_LYRICS_BESIDE_AUDIO_STORAGE_KEY/, "歌词同目录保存开关应持久化且默认关闭");
assert.match(app, /saveMatchedLyricsBesideAudio/, "设置页缺少歌词同目录保存状态");
assert.match(api, /export function matchLocalTrackLyrics/, "前端 API 缺少本地歌词匹配接口");
assert.match(api, /saveBesideAudio/, "歌词匹配请求需要携带同目录保存选项");
assert.match(
  app,
  /matchLocalTrackLyrics\(track\.id,\s*saveMatchedLyricsBesideAudio\.value\)/,
  "手动和自动歌词匹配都应传递同目录保存选项"
);
assert.match(app, /重新匹配歌词/, "本地歌曲歌词页缺少手动重新匹配入口");
assert.match(app, /matchLocalLyrics\(currentTrack\)/, "手动匹配应作用于当前本地歌曲");
assert.match(app, /已加载本地逐字歌词/, "本地 QRC 或 YRC 应显示明确的加载状态");
assert.match(app, /未找到逐字歌词，加载普通整行歌词/, "普通 LRC 降级应显示明确状态");

console.log("设置页契约通过");
