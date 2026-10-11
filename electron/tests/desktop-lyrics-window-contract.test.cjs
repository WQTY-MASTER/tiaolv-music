const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const entry = fs.readFileSync(path.join(root, "src/renderer/src/main.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "src/renderer/src/App.vue"), "utf8");
const componentPath = path.join(root, "src/renderer/src/components/DesktopLyricsWindow.vue");

assert.ok(fs.existsSync(componentPath), "应提供独立的桌面歌词窗口组件");
const component = fs.readFileSync(componentPath, "utf8");

assert.match(entry, /URLSearchParams\(window\.location\.search\)\.get\("window"\)/, "渲染入口应读取独立窗口模式");
assert.match(entry, /windowMode === "desktop-lyrics"/, "渲染入口应识别桌面歌词窗口");
assert.match(entry, /DesktopLyricsWindow/, "桌面歌词窗口应挂载独立组件");
assert.match(component, /onDesktopLyricsHoverState/, "歌词窗悬浮状态应由主进程系统鼠标监测驱动");
assert.match(component, /toolbarVisible/, "工具栏显隐应有独立状态");
assert.match(component, /preferences\.locked/, "锁定状态应阻止工具栏唤起");
assert.match(component, /desktop-lyrics-shell\.interactive[\s\S]{0,220}background:/, "未悬停时背景应透明，仅交互时显示面板底色");
assert.match(component, /\.desktop-lyrics-shell\s*\{[^}]*background:\s*rgb\(0 0 0 \/ 1%\)/, "透明空白区域应保留 Windows 原生命中能力");
assert.match(component, /desktop-lyrics-toolbar[\s\S]{0,520}-webkit-app-region:\s*no-drag/, "工具栏容器必须排除出原生拖拽区域");
assert.match(component, /desktop-lyrics-toolbar \*[\s\S]{0,100}-webkit-app-region:\s*no-drag/, "工具栏图标等子元素必须保持可点击");
assert.match(component, /data-control="unlock"/, "锁定状态应提供窗口内解锁入口");
assert.match(component, /解锁桌面歌词/, "解锁入口应有明确的辅助说明");
assert.match(component, /onDesktopLyricsUnlockHotspot/, "解锁入口应由主进程的系统鼠标热区驱动");
assert.match(
  component,
  /desktop-lyrics-shell:not\(\.locked\)\s*\{[\s\S]{0,100}-webkit-app-region:\s*drag/,
  "未锁定时应由窗口外层统一提供拖拽区域"
);
assert.doesNotMatch(
  component,
  /desktop-lyrics-shell:not\(\.locked\) \.desktop-(?:lyrics-viewport|lyric-line|lyric-original|lyric-character)[\s\S]{0,100}-webkit-app-region:\s*drag/,
  "歌词子元素不得创建覆盖工具栏的独立拖拽层"
);
assert.match(
  component,
  /desktop-lyrics-shell\.locked\s*\{[\s\S]{0,100}-webkit-app-region:\s*no-drag/,
  "锁定后歌词主体应禁用窗口拖拽"
);

const controls = [
  "previous",
  "toggle",
  "next",
  "decrease-font",
  "increase-font",
  "lyric-color",
  "translation",
  "lock",
  "close"
];
let previousIndex = -1;
for (const control of controls) {
  const index = component.indexOf(`data-control="${control}"`);
  assert.ok(index > previousIndex, `工具栏控件 ${control} 缺失或顺序不正确`);
  previousIndex = index;
}

assert.match(component, /title="上一首"/, "按钮应提供 hover 提示");
assert.match(component, /title="歌词配色"/, "配色按钮应提供 hover 提示");
assert.doesNotMatch(component, /data-control="cycle-mode"/, "桌面歌词工具栏不应继续显示播放模式按钮");
for (const colorName of ["封面强调色", "落日晖", "Twilight", "暖白", "自定义"]) {
  assert.match(component, new RegExp(colorName), `歌词配色菜单缺少 ${colorName}`);
}
assert.match(component, /type="color"/, "自定义歌词配色应使用原生颜色选择器");
assert.match(component, /lyricColorTheme/, "歌词配色选择应写入持久化设置");
assert.match(component, /title="显示翻译"|:title=.*翻译/, "翻译按钮应提供动态提示");
assert.match(component, /parseLyricContent/, "桌面歌词应复用现有歌词解析器");
assert.match(component, /findActiveLyricIndex/, "桌面歌词应按播放时间同步当前行");
assert.match(component, /getDesktopLyricHighlightMode/, "桌面歌词应按音源选择逐字或整行高亮");
assert.match(component, /getLyricCharacterProgress/, "桌面歌词应保留逐字进度");
assert.match(component, /getDesktopLyricPlaybackProgress/, "超长桌面歌词应复用播放进度计算器");
assert.match(component, /getDesktopLyricScrollProgress/, "超长桌面歌词应在开头和结尾保留稳定阅读时间");
assert.match(component, /lyricFlowStyle\(item\.index\)/, "当前歌词应把播放进度传给横向滚动样式");
assert.match(component, /getDesktopLyricCharacterFill/, "桌面歌词应渲染逐字填充比例");
assert.match(component, /characterStyle\(characterIndex,\s*item\.index\)/, "逐字歌词行切换时应复用相同字符节点，仅更新当前行进度");
assert.doesNotMatch(component, /v-if="[^"]*item\.index === activeIndex[^"]*item\.line\.characters/, "下一行成为当前行时不得从纯文本重建为逐字节点");
assert.match(component, /projectDesktopLyricsTime/, "桌面歌词应在主窗口时间同步之间平滑补帧");
assert.match(component, /reconcileDesktopLyricsTime/, "桌面歌词正常校时时不应因 IPC 延迟向后跳动");
assert.match(component, /desktopLyricsTrackChanged/, "完整状态刷新应先判断是否真的切歌");
assert.match(component, /syncRenderedCurrentTime\(playback\.value\.currentTime,\s*trackChanged\)/, "同一首歌的状态刷新不得允许时间回退");
assert.match(component, /requestAnimationFrame/, "桌面歌词逐字高亮应按显示帧刷新");
assert.match(component, /cancelAnimationFrame/, "桌面歌词窗口销毁时应停止独立时钟");
assert.match(component, /renderedCurrentTime\.value/, "歌词行与逐字进度应使用平滑后的播放时间");
assert.match(component, /resolveDesktopLyricColors/, "桌面歌词应解析已播放与未播放双色主题");
assert.match(component, /customPlayedColor/, "桌面歌词应使用自定义已播放颜色");
assert.match(component, /customUnplayedColor/, "桌面歌词应使用自定义未播放颜色");
assert.match(component, /preferences\.value\.fontFamily/, "桌面歌词应实时应用设置页字体");
assert.match(component, /preferences\.value\.fontWeight/, "桌面歌词应实时应用字重");
assert.match(component, /fontWeight === "bold" \? "800" : "400"/, "标准与粗体应映射到视觉差异清晰的字重");
assert.match(component, /font-synthesis:\s*weight/, "缺少粗体字形的字体应允许浏览器合成粗体");
assert.match(component, /strokeEnabled/, "桌面歌词应支持描边开关");
assert.match(component, /preferences\.textAlign|preferences\.value\.textAlign/, "桌面歌词应支持左中右对齐");
assert.match(component, /preferences\.lineMode|preferences\.value\.lineMode/, "桌面歌词应支持单行与双行模式");
assert.match(component, /visibleLines/, "桌面歌词应只渲染当前排版需要的歌词行");
assert.match(component, /lyricsPhonetic/, "桌面歌词应消费音源实际返回的音标或罗马音");
assert.match(component, /phoneticEnabled/, "音标缺失或开关关闭时不得占用额外行");
assert.match(component, /panelOpacity/, "桌面歌词应实时应用背景透明度");
assert.match(component, /cornerRadius/, "桌面歌词应实时应用圆角");
assert.match(component, /shadowEnabled/, "桌面歌词应支持阴影开关");
assert.match(component, /animationEnabled/, "桌面歌词应支持动画开关");
assert.match(component, /<TransitionGroup[\s\S]{0,180}name="desktop-lyric-slide"/, "桌面歌词换行应使用可保持元素位置连续的过渡组");
assert.match(component, /move-class="desktop-lyric-slide-no-flip"/, "固定轨道动画应关闭 TransitionGroup 额外的 FLIP 位移");
assert.match(component, /desktop-lyric-slide-no-flip\s*\{[^}]*transition:\s*none\s*!important/s, "歌词移动只能由固定轨道的 transform 负责");
assert.match(component, /desktop-lyric-slide-enter-from[\s\S]{0,220}var\(--lyric-line-step\)/, "新歌词应从下一条固定轨道淡入");
assert.match(component, /desktop-lyric-slide-leave-to[\s\S]{0,220}var\(--lyric-line-step\)/, "旧歌词应沿上一条固定轨道淡出");
assert.match(component, /:style="lyricSlotStyle\(item\.offset\)"/, "每行歌词应使用稳定的轨道位置");
assert.match(component, /desktop-lyric-slot\s*\{[^}]*position:\s*absolute[^}]*top:\s*50%[^}]*--lyric-slot-y/s, "歌词行应脱离动态居中布局并固定在独立轨道");
assert.match(component, /desktop-lyric-slide-leave-to[\s\S]{0,220}var\(--lyric-line-step\)/, "离场歌词应沿固定轨道继续向上移动");
assert.doesNotMatch(component, /desktop-lyrics-track\s*\{[^}]*justify-content:\s*center/s, "歌词轨道不得在离场时重新计算居中位置");
assert.doesNotMatch(component, /scrollIntoView/, "桌面歌词换行不应再依赖浏览器滚动跳转");
assert.match(component, /desktop-lyric-flow-viewport[^}]*container-type:\s*inline-size[^}]*overflow:\s*hidden/s, "每行桌面歌词应在独立容器内裁剪横向溢出");
assert.match(component, /desktop-lyric-flow[^}]*100cqw[^}]*100%[^}]*--lyric-scroll-viewport-offset[^}]*--lyric-scroll-content-offset/s, "长句位移应由容器和文本宽度差决定");
assert.match(component, /desktop-lyric-translation[\s\S]{0,300}font-size:\s*0\.62em/, "桌面歌词中文翻译应比现有字号更清晰");
assert.match(component, /updateDesktopLyricsPreferences/, "字号、翻译和锁定设置应持久化");
assert.match(component, /closeDesktopLyricsWindow/, "关闭按钮应销毁独立窗口");
assert.match(app, /source:\s*currentTrack\.value\.source/, "主播放器应把当前音源同步给桌面歌词");
assert.match(app, /coverAccentColor:\s*songDetailPalette\.value\.accentPrimary/, "主播放器应把封面强调色同步给桌面歌词");
assert.match(app, /currentTime:\s*currentPlaybackPosition\(\)/, "初始桌面歌词状态应读取项目现有播放位置函数");
assert.doesNotMatch(app, /getCurrentPlaybackTime\(\)/, "桌面歌词同步不应调用不存在的播放位置函数");
assert.match(app, /watch\(desktopLyricsPlaybackMetadata,\s*syncDesktopLyricsPlaybackState/, "完整桌面歌词状态只应监听歌曲和播放元数据");
assert.doesNotMatch(app, /watch\(desktopLyricsPlaybackState,\s*syncDesktopLyricsPlaybackState/, "播放时间不得触发整段歌词状态逐帧重发");

console.log("桌面歌词窗口界面契约通过");
