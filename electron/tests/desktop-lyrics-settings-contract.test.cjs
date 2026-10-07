const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const componentPath = path.join(root, "src/renderer/src/components/DesktopLyricsSettings.vue");

assert.ok(fs.existsSync(componentPath), "桌面歌词设置组件应存在");
const component = fs.readFileSync(componentPath, "utf8");

assert.match(app, /activeSettingsSection === 'desktop-lyrics'/, "桌面歌词设置必须位于现有设置页分组");
assert.match(app, /<DesktopLyricsSettings/, "桌面歌词分组应挂载完整设置组件");
assert.match(component, /启用桌面歌词/, "设置页应提供桌面歌词总开关");
assert.match(component, /歌词总在最前/, "设置页应提供置顶开关");
assert.match(component, /外文歌词显示翻译/, "设置页应提供翻译开关");
assert.match(component, /外文歌词显示音标/, "设置页应提供音标开关");
assert.match(component, /字体/, "设置页应提供字体配置");
assert.match(component, /字号/, "设置页应提供字号配置");
assert.match(component, /字粗/, "设置页应提供字重配置");
assert.match(component, /描边/, "设置页应提供描边配置");
assert.match(component, /双行显示/, "设置页应提供单双行配置");
assert.match(component, /居左/, "设置页应提供对齐配置");
assert.match(component, /已播放文字颜色/, "设置页应提供已播放颜色");
assert.match(component, /未播放文字颜色/, "设置页应提供未播放颜色");
assert.match(component, /实时预览/, "设置页应提供实时预览");
assert.match(component, /updateDesktopLyricsPreferences/, "设置修改应实时写入桌面歌词配置");
assert.match(component, /updateDesktopLyricsBounds/, "尺寸修改应实时调整悬浮窗");
assert.match(component, /onDesktopLyricsPreferences/, "设置页应接收悬浮窗工具栏的反向同步");
assert.match(component, /onDesktopLyricsBoundsChanged/, "设置页应接收窗口拖拽缩放后的尺寸");
assert.match(component, /formatAccelerator\(binding\)/, "锁定设置应显示用户自定义的解锁快捷键");
assert.match(component, /unlockHint/, "全局快捷键关闭后应显示其他可用解锁入口");
assert.doesNotMatch(component, />\s*保存\s*</, "桌面歌词设置应实时生效，不应需要保存按钮");

console.log("桌面歌词设置页契约通过");
