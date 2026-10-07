const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const component = fs.readFileSync(
  path.resolve(__dirname, "../src/renderer/src/components/FirstRunOnboarding.vue"),
  "utf8"
);

assert.match(component, /\.onboarding-content h1[^}]*font-size:\s*46px/, "引导主标题尺寸不应改动");
assert.match(component, /\.onboarding-intro[^}]*font-size:\s*16px/, "引导标题说明尺寸不应改动");
assert.match(component, /\.onboarding-folder-row strong[^}]*font-size:\s*13px/, "本地文件夹标题应清晰可读");
assert.match(component, /\.onboarding-folder-row small[^}]*font-size:\s*12px/, "本地文件夹说明应清晰可读");
assert.match(component, /\.onboarding-mini-options strong[^}]*font-size:\s*14px/, "迷你播放器设置标题应清晰可读");
assert.match(component, /\.onboarding-mini-options small[^}]*font-size:\s*12px/, "迷你播放器设置说明应清晰可读");
assert.match(component, /\.onboarding-device-list strong[^}]*font-size:\s*14px/, "输出设备标题应清晰可读");
assert.match(component, /\.onboarding-device-list small[^}]*font-size:\s*12px/, "输出设备说明应清晰可读");
assert.match(component, /\.onboarding-desktop-switches strong[^}]*font-size:\s*14px/, "桌面设置标题应清晰可读");
assert.match(component, /\.onboarding-desktop-switches small[^}]*font-size:\s*12px/, "桌面设置说明应清晰可读");
assert.match(component, /\.first-run-onboarding[^}]*-webkit-font-smoothing:\s*antialiased/, "引导界面应启用清晰的字体渲染");

console.log("引导页面统一字体可读性契约通过");
