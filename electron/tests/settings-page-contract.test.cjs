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
assert.match(app, /settingsSearchKeyword/, "设置页缺少搜索关键字状态");
assert.match(app, /placeholder="搜索设置"/, "设置页侧边栏缺少搜索栏");
for (const item of ["常规", "播放", "外观", "桌面歌词", "快捷键", "关于"]) {
  assert.match(app, new RegExp(item), `设置页侧边栏缺少 ${item}`);
}
assert.match(app, /本地音乐库设置/, "设置页缺少本地音乐库分组");
assert.match(app, /选择本地音乐库/, "设置页缺少选择本地音乐库入口");
assert.match(app, /重置音乐库/, "设置页缺少重置音乐库入口");
assert.match(app, /handleResetLocalLibrary/, "设置页缺少重置音乐库逻辑");
assert.match(app, /window\.confirm\([\s\S]*重置音乐库/, "重置音乐库需要二次确认");
assert.match(app, /resetLocalLibrary\(\)/, "重置音乐库没有调用后端清库接口");
assert.doesNotMatch(app, /class="topbar"|floatingTopbarVisible|handleMainScroll/, "设置页不应依赖已废弃的全局悬浮顶栏");
assert.match(app, /shouldHidePlayerBar[\s\S]*activeView\.value === "settings"/, "设置页需要隐藏底部播放栏");
assert.match(api, /export function resetLocalLibrary/, "前端 API 缺少 resetLocalLibrary");
assert.match(api, /\/library\/select-directory/, "浏览器开发模式缺少后端目录选择接口");

console.log("设置页契约通过");
