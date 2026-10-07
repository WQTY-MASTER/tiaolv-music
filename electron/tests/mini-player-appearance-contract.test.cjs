const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const settings = fs.readFileSync(path.join(root, "src/renderer/src/components/MiniPlayerAppearanceSettings.vue"), "utf8");
const appearance = fs.readFileSync(path.join(root, "src/renderer/src/components/AppearanceSettings.vue"), "utf8");
const mini = fs.readFileSync(path.join(root, "src/renderer/src/components/MiniPlayer.vue"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");

for (const label of [
  "主题", "背景", "外观", "布局", "暮光玻璃", "月白", "纯色", "渐变", "封面", "图片",
  "背景颜色", "回退颜色", "遮罩颜色", "背景模糊", "背景亮度", "背景饱和度", "背景不透明度",
  "遮罩强度", "强调色", "文字颜色", "边框颜色", "表面不透明度", "毛玻璃", "窗口圆角",
  "边框粗细", "阴影强度", "紧凑", "标准", "宽屏", "专辑封面", "专辑名称", "均衡器动画",
  "时间信息", "音量控制", "播放模式", "队列位置", "撤销本次", "恢复默认"
]) {
  assert.match(settings, new RegExp(label), `迷你播放器设置缺少 ${label}`);
}

assert.match(appearance, /<MiniPlayerAppearanceSettings[^>]*v-model="miniPlayerModel"/, "外观页应挂载迷你播放器编辑器");
assert.match(app, /:preferences="appearancePreferences\.miniPlayer"/, "应用应把迷你播放器外观设置传入原组件");
assert.match(app, /miniPlayer\.background\.imagePath\s*=\s*""/, "清理背景缓存时应同步移除迷你播放器图片引用");
assert.match(mini, /preferences:\s*MiniPlayerPreferences/, "原迷你播放器应读取持久化外观设置");
assert.match(mini, /mini-background-layer/, "迷你播放器应绘制独立背景层以支持纯色、渐变、封面和图片");
assert.match(mini, /showVolume/, "布局设置应控制音量入口");
assert.match(mini, /emit\("volume"/, "音量入口应接入真实音量控制");
assert.match(mini, /showPlayMode/, "布局设置应控制播放模式入口");
assert.match(mini, /emit\('mode'\)/, "播放模式入口应接入真实模式切换");
assert.match(mini, /showEqualizer[\s\S]*mini-equalizer/, "布局设置应控制均衡器动画");
assert.match(mini, /showTime[\s\S]*mini-time/, "布局设置应控制时间信息");
assert.match(mini, /showQueue[\s\S]*kind="queue"/, "布局设置应控制队列入口");

console.log("迷你播放器外观设置契约通过");
