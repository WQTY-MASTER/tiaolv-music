const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const onboarding = fs.readFileSync(path.join(root, "src/renderer/src/components/FirstRunOnboarding.vue"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");

assert.match(onboarding, /currentPage = ref<1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8>/, "引导应包含最后一页");
assert.match(onboarding, /currentPage\.value === 7[\s\S]{0,160}goToPage\(8\)/, "第七页继续后应进入最后一页");
assert.match(onboarding, /一切就绪/, "最后一页缺少完成标题");
for (const label of ["曲库已就绪", "桌面歌词", "迷你播放器", "睡眠定时器", "全局快捷键", "开始聆听"]) {
  assert.match(onboarding, new RegExp(label), `最后一页缺少 ${label}`);
}
assert.doesNotMatch(onboarding, /插件市场|均衡器/, "最后一页不应显示未实现的插件市场或均衡器");
assert.match(onboarding, /libraryTrackCount/, "曲库完成状态应显示真实歌曲数量");
assert.match(onboarding, /desktopLyricsVisible[\s\S]{0,500}toggleDesktopLyrics/, "桌面歌词入口应接入真实窗口状态");
assert.match(onboarding, /sleepTimerRemainingSeconds[\s\S]{0,700}toggleSleepTimer/, "睡眠定时器入口应接入真实倒计时状态");
assert.match(onboarding, /openMiniAfterGuide/, "迷你播放器入口应复用完成后打开设置");
assert.match(onboarding, /onboarding-ready-bars[\s\S]*onboarding-floating-note/, "最后一页应包含动态声波和漂浮音符");
assert.match(onboarding, /@keyframes onboarding-ready-bar/, "完成页声波应有循环动画");
assert.match(onboarding, /prefers-reduced-motion:\s*reduce[\s\S]*onboarding-ready-bars/, "动态装饰应尊重减少动态效果设置");

assert.match(app, /:library-track-count="currentLibrary\.length"/, "应用应向最后一页传入真实曲库数量");
assert.match(app, /:desktop-lyrics-visible="desktopLyricsVisible"[\s\S]{0,500}@toggle-desktop-lyrics="toggleDesktopLyrics"/, "最后一页应复用桌面歌词动作");
assert.match(app, /:sleep-timer-remaining-seconds="sleepTimerRemainingSeconds"[\s\S]{0,500}@toggle-sleep-timer="toggleOnboardingSleepTimer"/, "最后一页应复用真实睡眠定时器");
assert.match(app, /function setSleepTimer[\s\S]{0,1200}window\.setTimeout[\s\S]{0,700}togglePlayback\(\)/, "睡眠定时器到期后应真实暂停播放");
assert.match(app, /睡眠定时器[\s\S]{0,1400}15 分钟[\s\S]{0,500}30 分钟[\s\S]{0,500}45 分钟[\s\S]{0,500}60 分钟/, "播放设置应提供睡眠定时器预设");

console.log("第八章完成页与睡眠定时器契约通过");
