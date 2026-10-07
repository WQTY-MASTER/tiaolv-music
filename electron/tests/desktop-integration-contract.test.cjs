const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const onboarding = fs.readFileSync(path.join(root, "src/renderer/src/components/FirstRunOnboarding.vue"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main/main.ts"), "utf8");
const preload = fs.readFileSync(path.join(root, "src/preload/preload.ts"), "utf8");
const env = fs.readFileSync(path.join(root, "src/renderer/src/env.d.ts"), "utf8");

assert.match(onboarding, /currentPage = ref<1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8>/, "引导应包含第七页并继续到完成页");
assert.match(onboarding, /currentPage\.value === 6[\s\S]{0,160}goToPage\(7\)/, "第六页继续后应进入第七页");
assert.match(onboarding, /让它<span>融入你的桌面<\/span>/, "第七页缺少任务栏与后台标题");
for (const label of [
  "直接退出", "进入托盘", "切换迷你播放器", "任务栏缩略图按钮", "系统媒体控制", "全局快捷键", "开机自动启动", "记住播放进度"
]) {
  assert.match(onboarding, new RegExp(label), `第七页缺少 ${label}`);
}
assert.doesNotMatch(onboarding, /Discord 状态显示/, "第七页不应显示未实现的 Discord 状态功能");
assert.match(onboarding, /update:closeBehavior/, "关闭窗口去向应由应用状态驱动");
assert.match(onboarding, /update:taskbarThumbnailButtons/, "任务栏缩略图开关应与设置联动");
assert.match(onboarding, /update:systemMediaControls/, "系统媒体控制开关应与设置联动");
assert.match(onboarding, /update:globalShortcuts/, "全局快捷键开关应与设置联动");
assert.match(onboarding, /update:launchAtStartup/, "开机启动开关应与系统设置联动");
assert.match(onboarding, /update:rememberPlaybackPosition/, "播放进度开关应与设置联动");

assert.match(app, /v-model:close-behavior="desktopIntegrationPreferences\.closeBehavior"/, "应用应向引导页传入关闭行为");
assert.match(app, /v-model:taskbar-thumbnail-buttons="taskbarThumbnailButtonsEnabled"/, "应用应复用任务栏缩略图设置");
assert.match(app, /v-model:system-media-controls="desktopIntegrationPreferences\.systemMediaControls"/, "应用应复用系统媒体控制设置");
assert.match(app, /v-model:global-shortcuts="globalShortcutsEnabled"/, "应用应复用全局快捷键设置");
assert.match(app, /:launch-at-startup="launchAtStartup"[\s\S]{0,900}@update:launch-at-startup="setLaunchAtStartupPreference"/, "引导应调用真实开机启动接口");
assert.match(app, /v-model:remember-playback-position="desktopIntegrationPreferences\.rememberPlaybackPosition"/, "应用应复用播放进度设置");
assert.match(app, /navigator\.mediaSession\.setActionHandler/, "系统媒体控制必须接入 Media Session 动作");
assert.match(app, /rememberPlaybackPosition[\s\S]{0,300}positionSeconds/, "播放状态保存应遵守记住进度开关");
assert.match(app, /关闭窗口后[\s\S]{0,700}closeBehavior/, "常规设置应提供关闭窗口去向");
assert.match(app, /开机自动启动/, "常规设置应提供开机启动开关");
assert.match(app, /记住播放进度/, "常规设置应提供播放进度开关");

assert.match(main, /set-launch-at-startup/, "主进程缺少开机启动 IPC");
assert.match(main, /app\.setLoginItemSettings/, "开机启动必须调用 Electron 系统接口");
assert.match(main, /set-close-behavior/, "主进程缺少关闭行为 IPC");
assert.match(main, /win\.on\("close"[\s\S]{0,900}closeBehavior/, "主窗口关闭应执行所选去向");
assert.match(preload, /setLaunchAtStartup/, "preload 缺少开机启动桥接");
assert.match(preload, /setCloseBehavior/, "preload 缺少关闭行为桥接");
assert.match(env, /setLaunchAtStartup/, "渲染层缺少开机启动类型");
assert.match(env, /setCloseBehavior/, "渲染层缺少关闭行为类型");

console.log("桌面集成与第七章引导契约通过");
