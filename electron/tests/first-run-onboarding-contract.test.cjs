const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const component = fs.readFileSync(path.resolve(__dirname, "../src/renderer/src/components/FirstRunOnboarding.vue"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "../src/renderer/src/App.vue"), "utf8");
const api = fs.readFileSync(path.resolve(__dirname, "../src/renderer/src/services/api.ts"), "utf8");

assert.match(component, /欢迎来到[\s\S]*你的声音空间/, "第一章应展示欢迎标题");
assert.match(component, /v-for="step in 8"/, "引导页应展示八章进度");
for (const label of ["跟随系统", "浅色", "深色", "紧凑", "标准", "舒展", "跳过引导", "继续"]) {
  assert.match(component, new RegExp(label), `第一章缺少 ${label}`);
}
assert.match(component, /setThemeMode[\s\S]*setAccent[\s\S]*setDensity[\s\S]*setBackgroundPreset/, "第一章应实时修改现有外观选项");
assert.match(component, /`density-\$\{modelValue\.density\}`/, "引导页应立即应用所选界面密度");
assert.match(component, /\.first-run-onboarding\.density-compact\s*\{[^}]*--density-theme-height:\s*66px;[^}]*--density-section-gap:\s*10px;/, "紧凑模式应缩小控件与分组间距");
assert.match(component, /\.first-run-onboarding\.density-comfortable\s*\{[^}]*--density-theme-height:\s*90px;[^}]*--density-section-gap:\s*22px;/, "舒展模式应放大控件与分组间距");
assert.match(component, /selectPlaylistCoverImage/, "第一章背景图片应复用安全图片选择入口");
assert.match(component, /ArrowLeft[\s\S]*ArrowRight[\s\S]*focusRelativeControl/, "第一章应支持方向键切换控件");
assert.match(component, /querySelectorAll<HTMLButtonElement>\("button:not\(:disabled\)"\)/, "方向键应能移动到包括跳过引导在内的所有可用按钮");
assert.match(component, /\.onboarding-skip:hover,\.onboarding-skip:active,\.onboarding-skip:focus-visible\s*\{[^}]*background:/, "跳过引导应显示明确的鼠标悬停与按下状态");
assert.match(component, /\.first-run-onboarding\s*\{[^}]*user-select:\s*none;/, "引导页面文字不应被误选中");
assert.match(component, /transition:[^;}]*280ms/, "第一章交互应使用统一的 280ms 过渡");
assert.match(component, /听歌习惯[\s\S]*你平时更常听[\s\S]*哪里的音乐/, "第二章应展示听歌来源标题");
for (const label of ["本地音乐", "流媒体", "两者都要", "返回"]) {
  assert.match(component, new RegExp(label), `第二章缺少 ${label}`);
}
assert.match(component, /currentPage[\s\S]*goToPage\(2\)[\s\S]*function returnToPreviousPage[\s\S]*currentPage\.value - 1/, "引导章节应支持继续与返回导航");
assert.match(component, /pageTransitionName[\s\S]*<Transition[\s\S]*:name="pageTransitionName"/, "章节切换应使用有方向的过渡动画");
assert.match(component, /--page-transition-duration:\s*580ms/, "页面切换时长应预留为可调参数");
assert.match(component, /--element-enter-duration:\s*560ms/, "单元素入场时长应预留为可调参数");
assert.match(component, /--element-enter-stagger:\s*95ms/, "元素错峰间隔应预留为可调参数");
assert.match(component, /\.onboarding-enter\s*\{[^}]*animation:[^;}]*onboarding-element-enter[^;}]*var\(--element-enter-duration\)/s, "页面元素应使用统一的顺序入场动画");
assert.match(component, /animation-delay:\s*var\(--enter-delay,\s*0ms\)/, "页面元素应按序号错峰入场");
assert.match(component, /--enter-order:\s*8/, "底部操作区应排在页内元素之后入场");
assert.match(component, /ArrowLeft[\s\S]*returnToPreviousPage\(\)[\s\S]*ArrowRight[\s\S]*continueOnboarding\(\)/, "左右方向键应触发上一页和下一页导航");
assert.match(component, /class="onboarding-source-card[^"]*"[\s\S]*class="onboarding-source-check"/, "第二章选中卡片应显示右上角勾选");
assert.match(component, /update:startupPreference/, "第二章应把启动偏好同步给应用");
assert.match(component, /<strong>0\{\{ currentPage \}\}<\/strong><span>\/ 08<\/span>/, "章节编号应按最新八章设计显示");
assert.match(component, /本地曲库[\s\S]*你的音乐[\s\S]*放在哪里/, "第三章应展示本地曲库配置标题");
for (const label of ["添加音乐文件夹", "启动时自动扫描", "使用文件名补全歌曲信息", "本地歌曲联网匹配歌词"]) {
  assert.match(component, new RegExp(label), `第三章缺少 ${label}`);
}
assert.match(component, /localLibraryRoots[\s\S]*addMusicFolder[\s\S]*removeMusicFolder/, "第三章应展示目录并接入添加、移除操作");
assert.match(component, /update:autoScanLocalLibrary[\s\S]*update:useFilenameMetadata[\s\S]*update:localLyricsOnlineMatch/, "第三章选项应同步真实设置状态");
assert.doesNotMatch(component, /BPM|节奏与响度|后台分析/, "本地曲库页不应展示尚未实现的 BPM 分析功能");
assert.match(component, /流媒体[\s\S]*连接[\s\S]*网易云音乐/, "第四章应展示网易云连接标题");
for (const label of ["完成后立即登录", "稍后再说", "自动", "标准", "极高", "无损", "Hi-Res", "跟随来源规则", "不缓存音频"]) {
  assert.match(component, new RegExp(label), `第四章缺少 ${label}`);
}
assert.doesNotMatch(component, /插件市场|安装更多音乐源与主题插件/, "第四章不应展示尚未提供的插件功能");
assert.match(component, /update:loginPreference[\s\S]*update:neteaseQuality[\s\S]*update:audioCachePolicy/, "第四章选项应同步到真实应用状态");
assert.match(component, /currentPage\.value === 2[\s\S]*goToPage\(3\)/, "第二章继续后应进入第三章");
assert.match(component, /currentPage\.value === 3[\s\S]*goToPage\(4\)/, "第三章继续后应进入第四章");
assert.match(component, /播放器形态[\s\S]*选择[\s\S]*播放控制[\s\S]*的位置/, "第五章应展示播放器形态标题");
for (const label of [
  "完整播放栏", "迷你胶囊", "紧凑模式", "迷你播放器显示在任务栏", "迷你播放器置顶",
  "完成后打开迷你播放器", "播放栏可见性", "常显", "指针靠近时浮现", "隐藏播放栏"
]) {
  assert.match(component, new RegExp(label), `第五章缺少 ${label}`);
}
assert.match(component, /currentPage\.value === 4[\s\S]*goToPage\(5\)/, "第四章继续后应进入第五章");
assert.match(component, /setPlayerPresentation[\s\S]*setPlayerBarVisibility[\s\S]*toggleMiniPlayerOption/, "第五章控件应更新真实播放器偏好");
assert.match(component, /const selectedPlayerPresentation = computed\(\(\) => props\.modelValue\.playerControls\.presentation\)/, "第五章选中态应与播放设置使用同一个形态字段");
assert.match(component, /function setPlayerPresentation[\s\S]{0,500}draft\.miniPlayer\.layout\.mode\s*=\s*presentation === "compact" \? "compact" : "standard"/, "迷你胶囊与紧凑模式应复用原迷你播放器布局设置");
assert.match(component, /modelValue\.playerControls\.presentation[\s\S]*modelValue\.playerControls\.visibility/, "第五章应从持久化播放器偏好读取选中状态");
assert.match(component, /currentPage\.value === 5[\s\S]*goToPage\(6\)/, "第五章继续后应进入第六章");
assert.match(app, /<FirstRunOnboarding[\s\S]*v-model="appearancePreferences"[\s\S]*v-model:startup-preference="startupHome"[\s\S]*@complete="finishOnboarding"[\s\S]*@skip="skipOnboarding"/, "应用应接入首次启动引导的外观与启动偏好状态");
assert.match(app, /v-model:login-preference="onboardingLoginPreference"[\s\S]*v-model:netease-quality="neteasePlaybackQuality"[\s\S]*v-model:audio-cache-policy="onlineAudioCachePolicy"/, "应用应接入第三章的登录、音质和缓存状态");
assert.match(app, /v-model:auto-scan-local-library="autoScanLocalLibraryEnabled"[\s\S]*v-model:use-filename-metadata="useFilenameMetadataEnabled"[\s\S]*v-model:local-lyrics-online-match="localLyricsOnlineMatchEnabled"/, "应用应将第三章绑定到常规设置的同一份状态");
assert.match(app, /:local-library-roots="localLibraryRoots"[\s\S]*:local-library-pending="localLibraryScanPending"[\s\S]*@add-music-folder="chooseMusicFolderAndScan"[\s\S]*@remove-music-folder="removeMusicFolderFromLibrary"/, "应用应接入真实的曲库目录添加与移除操作");
assert.match(api, /function removeLocalLibraryRoot[\s\S]*\/library\/roots\?\$\{query\}[\s\S]*method:\s*"DELETE"/, "前端 API 应支持移除单个曲库目录");
assert.match(app, /async function finishOnboarding\(\)[\s\S]{0,700}onboardingLoginPreference\.value === "after-guide"[\s\S]{0,700}openProviderAuthPanel\("netease"\)/, "选择立即登录后应在完成引导时打开网易云登录");
assert.match(app, /async function finishOnboarding\(\)[\s\S]*openProviderAuthPanel\("netease"\)[\s\S]*await nextTick\(\)[\s\S]*showFirstRunOnboarding\.value = false/, "进入登录页时应先挂载登录层，再退出引导层，避免闪出主界面");
assert.match(app, /openMiniAfterGuide[\s\S]{0,500}openMiniPlayer\(\)/, "选择完成后打开迷你播放器时应执行真实窗口切换");
assert.match(app, /pendingMiniPlayerAfterAuth[\s\S]{0,900}function completePendingMiniPlayerOpen[\s\S]{0,500}openMiniPlayer\(\)/, "同时选择登录与迷你播放器时应在登录面板结束后继续打开迷你播放器");
assert.match(app, /function closeAuthPanel\(\)[\s\S]{0,300}completePendingMiniPlayerOpen\(\)[\s\S]*@close="closeAuthPanel"/, "取消登录也应完成待执行的迷你播放器切换");
assert.match(app, /playerControls\.visibility[\s\S]*playerBarPointerNearby/, "播放栏可见性应接入实际渲染条件");
assert.match(app, /:presentation="appearancePreferences\.playerControls\.presentation"/, "第五章选择的播放器形态应作用到真实播放栏");
assert.match(app, /hasCompletedOnboarding\(window\.localStorage\)/, "应用应只在首次启动显示引导");
assert.match(app, /markOnboardingCompleted\(window\.localStorage\)/, "完成或跳过引导后应持久化版本");
assert.match(app, /function skipOnboarding\(\)[\s\S]{0,500}applyOnboardingPreferences\(\)[\s\S]{0,500}showFirstRunOnboarding\.value = false/, "跳过引导必须先写入完成标记，再关闭引导页");
assert.match(app, /function openOnboarding\(\)[\s\S]{0,400}showFirstRunOnboarding\.value = true/, "设置页应允许用户主动重新体验引导");
const reopenOnboardingBody = app.match(/function openOnboarding\(\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
assert.doesNotMatch(reopenOnboardingBody, /markOnboardingCompleted|removeItem|clear\(/, "设置页重新体验不应重置首次使用标记");
assert.match(app, /function applyOnboardingPreferences\(\)[\s\S]{0,900}writeStartupHome\(startupHome\.value, window\.localStorage\)[\s\S]{0,900}writeAppMode\(selectedMode\)/, "完成或跳过引导后应保存并应用真实启动偏好");
assert.match(app, /function skipOnboarding\(\)[\s\S]{0,700}onboardingExitImmediately\.value = true[\s\S]{0,700}showFirstRunOnboarding\.value = false/, "跳过引导应使用立即退出路径");
assert.match(app, /:name="onboardingExitImmediately \? 'onboarding-shell-immediate' : 'onboarding-shell'"/, "引导外层应根据跳过状态关闭退出动画");
assert.match(app, /\.onboarding-shell-immediate-leave-active\s*\{[^}]*transition:\s*none/, "跳过引导时不应播放外层退出动画");
assert.match(app, /onboarding-shell-leave-active[\s\S]*440ms/, "引导退出主界面时应使用舒缓的交叉过渡");

console.log("首次启动引导契约通过");
