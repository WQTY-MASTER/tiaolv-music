<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  Monitor,
  Moon,
  Palette,
  Sun
} from "lucide-vue-next";
import { selectPlaylistCoverImage } from "../services/api";
import MiniPlayerAppearanceSettings from "./MiniPlayerAppearanceSettings.vue";
import {
  normalizeAppearancePreferences,
  type AnimationMode,
  type AppearancePage,
  type AppearancePreferences,
  type InterfaceDensity,
  type LyricColorMode,
  type LyricFocusRows,
  type ThemeMode
} from "../services/appearanceSettings";

const props = defineProps<{
  modelValue: AppearancePreferences;
  backgroundError?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [preferences: AppearancePreferences];
}>();

const accentColors = ["#8357f6", "#2868ed", "#16b88a", "#e91e4d", "#f59b0b", "#344156"];
const backgroundOpen = ref(false);
const lyricStyleOpen = ref(false);
const expandedPage = ref<AppearancePage | null>(null);
const backgroundImportError = ref("");
const backgroundImporting = ref(false);

const pageEntries: Array<{ key: AppearancePage; title: string; description: string }> = [
  { key: "local", title: "本地主页", description: "本地音乐首页和资料概览背景。" },
  { key: "settings", title: "设置与插件", description: "设置页和插件中心等管理界面背景。" },
  { key: "streaming", title: "流媒体页", description: "在线音乐浏览、搜索和详情页背景。" },
  { key: "player", title: "播放页", description: "沉浸式播放页和全屏播放背景。" }
];

const miniPlayerModel = computed({
  get: () => props.modelValue.miniPlayer,
  set: (miniPlayer) => updatePreferences((draft) => { draft.miniPlayer = miniPlayer; })
});

function updatePreferences(mutator: (draft: AppearancePreferences) => void) {
  const draft = JSON.parse(JSON.stringify(props.modelValue)) as AppearancePreferences;
  mutator(draft);
  emit("update:modelValue", normalizeAppearancePreferences(draft));
}

function setThemeMode(mode: ThemeMode) {
  updatePreferences((draft) => { draft.themeMode = mode; });
}

function setAnimationMode(mode: AnimationMode) {
  updatePreferences((draft) => { draft.animationMode = mode; });
}

function setAccent(kind: "lightAccent" | "darkAccent", color: string) {
  updatePreferences((draft) => { draft[kind] = color; });
}

function setDensity(density: InterfaceDensity) {
  updatePreferences((draft) => { draft.density = density; });
}

function setFontFamily(fontFamily: string) {
  updatePreferences((draft) => { draft.fontFamily = fontFamily; });
}

function setCoverTheme(enabled: boolean) {
  updatePreferences((draft) => { draft.coverThemeEnabled = enabled; });
}

function setUnifiedBackgroundMode(mode: "solid" | "image") {
  updatePreferences((draft) => { draft.background.unified.mode = mode; });
}

function setUnifiedColor(kind: "lightColor" | "darkColor", color: string) {
  updatePreferences((draft) => { draft.background.unified[kind] = color; });
}

function setPageInherited(page: AppearancePage, inherit: boolean) {
  updatePreferences((draft) => { draft.background.pages[page].inherit = inherit; });
}

function setPageMode(page: AppearancePage, mode: "solid" | "image") {
  updatePreferences((draft) => {
    draft.background.pages[page].inherit = false;
    draft.background.pages[page].mode = mode;
  });
}

function setPageColor(page: AppearancePage, kind: "lightColor" | "darkColor", color: string) {
  updatePreferences((draft) => {
    draft.background.pages[page].inherit = false;
    draft.background.pages[page][kind] = color;
  });
}

async function chooseBackground(page?: AppearancePage) {
  if (backgroundImporting.value) return;
  backgroundImportError.value = "";
  backgroundImporting.value = true;
  try {
    const selected = await selectPlaylistCoverImage();
    if (!selected) return;
    if (window.listenMusic && !window.listenMusic.readAppearanceBackground) {
      throw new Error("背景导入服务尚未更新，请完全退出并重新启动软件。");
    }
    const imagePath = window.listenMusic && !selected.startsWith("data:")
      ? await window.listenMusic.readAppearanceBackground(selected) : selected;
    const image = new Image();
    image.src = imagePath;
    await image.decode();
    updatePreferences((draft) => {
      const target = page ? draft.background.pages[page] : draft.background.unified;
      if (page) draft.background.pages[page].inherit = false;
      target.mode = "image";
      target.imagePath = imagePath;
    });
  } catch (error) {
    backgroundImportError.value = error instanceof Error && error.name !== "EncodingError"
      ? error.message : "图片无法解码，请检查文件是否完整或已损坏。";
  } finally {
    backgroundImporting.value = false;
  }
}

function removeBackground(page?: AppearancePage) {
  updatePreferences((draft) => {
    const target = page ? draft.background.pages[page] : draft.background.unified;
    target.imagePath = "";
    target.mode = "solid";
  });
}

function pageStatus(page: AppearancePage) {
  const background = props.modelValue.background.pages[page];
  if (background.inherit) return "继承";
  return background.mode === "image" && background.imagePath ? "图片" : "纯色";
}

function setLyricValue<K extends keyof AppearancePreferences["lyrics"]>(
  key: K,
  value: AppearancePreferences["lyrics"][K]
) {
  updatePreferences((draft) => { draft.lyrics[key] = value; });
}

function colorFromEvent(event: Event) {
  return (event.target as HTMLInputElement).value;
}

function numberFromEvent(event: Event) {
  return Number((event.target as HTMLInputElement).value);
}
</script>

<template>
  <article class="appearance-card">
    <header class="appearance-heading">
      <span class="appearance-heading-icon" aria-hidden="true"><Palette :size="21" /></span>
      <div>
        <h2>外观</h2>
        <p>统一管理主题、背景、字体与歌词视觉。</p>
      </div>
    </header>

    <section class="appearance-row">
      <div class="appearance-copy"><strong>主题模式</strong><span>按系统偏好或固定使用浅色、深色界面。</span></div>
      <div class="appearance-segments theme-segments" role="radiogroup" aria-label="主题模式">
        <button type="button" :class="{ active: modelValue.themeMode === 'system' }" @click="setThemeMode('system')"><Monitor :size="15" />系统</button>
        <button type="button" :class="{ active: modelValue.themeMode === 'light' }" @click="setThemeMode('light')"><Sun :size="15" />浅色</button>
        <button type="button" :class="{ active: modelValue.themeMode === 'dark' }" @click="setThemeMode('dark')"><Moon :size="15" />深色</button>
      </div>
    </section>

    <section class="appearance-row">
      <div class="appearance-copy"><strong>界面动画</strong><span>控制页面切换和界面反馈的动态效果。</span></div>
      <select class="appearance-select" :value="modelValue.animationMode" aria-label="界面动画" @change="setAnimationMode(($event.target as HTMLSelectElement).value as AnimationMode)">
        <option value="system">跟随系统</option>
        <option value="full">完整动画</option>
        <option value="reduced">减少动画</option>
      </select>
    </section>

    <section class="appearance-row">
      <div class="appearance-copy"><strong>插件主题</strong><span>当前使用应用内置主题。</span></div>
      <button class="appearance-static-value" type="button" disabled>不使用插件主题</button>
    </section>

    <section class="appearance-row">
      <div class="appearance-copy"><strong>浅色强调色</strong><span>浅色模式下设置、按钮与选中状态使用的主题色。</span></div>
      <div class="accent-swatches" role="radiogroup" aria-label="浅色强调色">
        <button v-for="color in accentColors" :key="`light-${color}`" type="button" :style="{ backgroundColor: color }" :aria-label="color" :aria-checked="modelValue.lightAccent === color" :class="{ active: modelValue.lightAccent === color }" @click="setAccent('lightAccent', color)"><Check v-if="modelValue.lightAccent === color" :size="17" /></button>
      </div>
    </section>

    <section class="appearance-row">
      <div class="appearance-copy"><strong>深色强调色</strong><span>深色模式可使用独立强调色。</span></div>
      <div class="accent-swatches" role="radiogroup" aria-label="深色强调色">
        <button v-for="color in accentColors" :key="`dark-${color}`" type="button" :style="{ backgroundColor: color }" :aria-label="color" :aria-checked="modelValue.darkAccent === color" :class="{ active: modelValue.darkAccent === color }" @click="setAccent('darkAccent', color)"><Check v-if="modelValue.darkAccent === color" :size="17" /></button>
      </div>
    </section>

    <section class="appearance-row background-row" :class="{ expanded: backgroundOpen }">
      <div class="appearance-copy"><strong>自定义背景</strong><span>设置统一背景，也可为不同页面单独覆盖。</span></div>
      <button class="appearance-expand" type="button" :aria-expanded="backgroundOpen" aria-label="展开自定义背景" @click="backgroundOpen = !backgroundOpen"><ChevronDown :size="17" /></button>

      <div v-if="backgroundOpen" class="background-editor">
        <p v-if="backgroundImportError || backgroundError" role="alert" class="background-error">{{ backgroundImportError || backgroundError }}</p>
        <section class="background-panel unified-background">
          <header><div><strong>统一背景</strong><span>页面默认继承这组背景。</span></div><span class="background-status">{{ modelValue.background.unified.mode === 'image' && modelValue.background.unified.imagePath ? '图片' : '纯色' }}</span></header>
          <div class="background-mode" role="radiogroup" aria-label="统一背景类型">
            <button type="button" :class="{ active: modelValue.background.unified.mode === 'solid' }" @click="setUnifiedBackgroundMode('solid')">纯色</button>
            <button type="button" :class="{ active: modelValue.background.unified.mode === 'image' }" @click="setUnifiedBackgroundMode('image')">图片</button>
          </div>
          <div class="background-colors">
            <label><span>浅色</span><input type="color" :value="modelValue.background.unified.lightColor" @input="setUnifiedColor('lightColor', colorFromEvent($event))" /><code>{{ modelValue.background.unified.lightColor }}</code></label>
            <label><span>深色</span><input type="color" :value="modelValue.background.unified.darkColor" @input="setUnifiedColor('darkColor', colorFromEvent($event))" /><code>{{ modelValue.background.unified.darkColor }}</code></label>
          </div>
          <div class="background-actions">
            <button type="button" :disabled="backgroundImporting" @click="chooseBackground()"><ImageIcon :size="15" />{{ backgroundImporting ? '正在导入' : '选择图片' }}</button>
            <button type="button" :disabled="!modelValue.background.unified.imagePath" @click="removeBackground()">移除图片</button>
            <span>{{ modelValue.background.unified.imagePath ? '已设置图片' : '支持 JPG / PNG / WebP' }}</span>
          </div>
        </section>

        <section class="background-panel page-backgrounds">
          <header><div><strong>页面背景覆盖</strong><span>默认继承统一背景，展开后可独立设置。</span></div></header>
          <article v-for="page in pageEntries" :key="page.key" class="page-background-item" :class="{ expanded: expandedPage === page.key }">
            <button class="page-background-heading" type="button" :aria-expanded="expandedPage === page.key" @click="expandedPage = expandedPage === page.key ? null : page.key">
              <span><strong>{{ page.title }}</strong><small>{{ page.description }}</small></span>
              <i>{{ pageStatus(page.key) }}</i>
              <ChevronDown :size="16" />
            </button>
            <div v-if="expandedPage === page.key" class="page-background-body">
              <button class="inherit-button" type="button" :class="{ active: modelValue.background.pages[page.key].inherit }" @click="setPageInherited(page.key, !modelValue.background.pages[page.key].inherit)">
                {{ modelValue.background.pages[page.key].inherit ? '当前继承统一背景' : '改为继承统一背景' }}
              </button>
              <div class="background-mode" :class="{ disabled: modelValue.background.pages[page.key].inherit }">
                <button type="button" :disabled="modelValue.background.pages[page.key].inherit" :class="{ active: modelValue.background.pages[page.key].mode === 'solid' }" @click="setPageMode(page.key, 'solid')">纯色</button>
                <button type="button" :disabled="modelValue.background.pages[page.key].inherit" :class="{ active: modelValue.background.pages[page.key].mode === 'image' }" @click="setPageMode(page.key, 'image')">图片</button>
              </div>
              <div class="background-colors" :class="{ disabled: modelValue.background.pages[page.key].inherit }">
                <label><span>浅色</span><input type="color" :disabled="modelValue.background.pages[page.key].inherit" :value="modelValue.background.pages[page.key].lightColor" @input="setPageColor(page.key, 'lightColor', colorFromEvent($event))" /><code>{{ modelValue.background.pages[page.key].lightColor }}</code></label>
                <label><span>深色</span><input type="color" :disabled="modelValue.background.pages[page.key].inherit" :value="modelValue.background.pages[page.key].darkColor" @input="setPageColor(page.key, 'darkColor', colorFromEvent($event))" /><code>{{ modelValue.background.pages[page.key].darkColor }}</code></label>
              </div>
              <div class="background-actions" :class="{ disabled: modelValue.background.pages[page.key].inherit }">
                <button type="button" :disabled="backgroundImporting || modelValue.background.pages[page.key].inherit" @click="chooseBackground(page.key)"><ImageIcon :size="15" />选择图片</button>
                <button type="button" :disabled="modelValue.background.pages[page.key].inherit || !modelValue.background.pages[page.key].imagePath" @click="removeBackground(page.key)">移除图片</button>
                <span>{{ modelValue.background.pages[page.key].imagePath ? '已设置图片' : '未设置图片' }}</span>
              </div>
            </div>
          </article>
        </section>
      </div>
    </section>

    <section class="appearance-row">
      <div class="appearance-copy"><strong>封面主题色</strong><span>播放页和底栏使用当前专辑封面提取的主题色。</span></div>
      <label class="appearance-switch"><input type="checkbox" :checked="modelValue.coverThemeEnabled" @change="setCoverTheme(($event.target as HTMLInputElement).checked)" /><i></i><span>{{ modelValue.coverThemeEnabled ? '已开启' : '已关闭' }}</span></label>
    </section>

    <section class="appearance-row">
      <div class="appearance-copy"><strong>全局字体</strong><span>更换界面正文、标题和卡片字体。</span></div>
      <select class="appearance-select" :value="modelValue.fontFamily" aria-label="全局字体" @change="setFontFamily(($event.target as HTMLSelectElement).value)">
        <option value="system">默认（跟随主题）</option><option value="segoe">Segoe UI</option><option value="yahei">微软雅黑</option><option value="simsun">宋体</option><option value="arial">Arial</option>
      </select>
    </section>

    <section class="appearance-row">
      <div class="appearance-copy"><strong>界面排版密度</strong><span>控制列表项的间距与信息密度。</span></div>
      <div class="appearance-segments" role="radiogroup" aria-label="界面排版密度">
        <button type="button" :class="{ active: modelValue.density === 'compact' }" @click="setDensity('compact')">紧凑</button>
        <button type="button" :class="{ active: modelValue.density === 'standard' }" @click="setDensity('standard')">标准</button>
        <button type="button" :class="{ active: modelValue.density === 'comfortable' }" @click="setDensity('comfortable')">舒展</button>
      </div>
    </section>

    <section class="appearance-row lyric-style-row" :class="{ expanded: lyricStyleOpen }">
      <div class="appearance-copy"><strong>歌词显示样式</strong><span>控制歌曲页排版、聚焦范围和高亮效果。</span></div>
      <button class="appearance-expand" type="button" :aria-expanded="lyricStyleOpen" aria-label="展开歌词显示样式" @click="lyricStyleOpen = !lyricStyleOpen"><ChevronDown :size="17" /></button>
      <div v-if="lyricStyleOpen" class="lyric-editor">
        <div class="lyric-setting"><span><strong>歌词字体</strong><small>默认跟随界面字体。</small></span><select :value="modelValue.lyrics.fontFamily" @change="setLyricValue('fontFamily', ($event.target as HTMLSelectElement).value)"><option value="inherit">跟随界面字体</option><option value="yahei">微软雅黑</option><option value="simsun">宋体</option><option value="arial">Arial</option></select></div>
        <label class="lyric-setting"><span><strong>歌词字号</strong><small>普通行的基准字号。</small></span><span class="range-control"><b>字号</b><input type="range" min="12" max="32" step="1" :value="modelValue.lyrics.fontSize" @input="setLyricValue('fontSize', numberFromEvent($event))" /><output>{{ modelValue.lyrics.fontSize }} px</output></span></label>
        <label class="lyric-setting"><span><strong>歌词字重</strong><small>数值越大越粗。</small></span><span class="range-control"><b>字重</b><input type="range" min="300" max="900" step="100" :value="modelValue.lyrics.fontWeight" @input="setLyricValue('fontWeight', numberFromEvent($event))" /><output>{{ modelValue.lyrics.fontWeight }}</output></span></label>
        <label class="lyric-setting"><span><strong>歌词行距</strong><small>相邻歌词行之间的行高倍数。</small></span><span class="range-control"><b>行距</b><input type="range" min="1.1" max="2.5" step="0.05" :value="modelValue.lyrics.lineHeight" @input="setLyricValue('lineHeight', numberFromEvent($event))" /><output>{{ modelValue.lyrics.lineHeight.toFixed(2) }}</output></span></label>
        <label class="lyric-setting"><span><strong>未播放暗度</strong><small>尚未唱到的歌词行保留多少亮度。</small></span><span class="range-control"><b>亮度</b><input type="range" min="0.15" max="1" step="0.05" :value="modelValue.lyrics.inactiveOpacity" @input="setLyricValue('inactiveOpacity', numberFromEvent($event))" /><output>{{ Math.round(modelValue.lyrics.inactiveOpacity * 100) }}%</output></span></label>
        <div class="lyric-setting"><span><strong>聚焦行数</strong><small>淡化当前行范围外的歌词。</small></span><div class="appearance-segments focus-segments"><button v-for="item in ([ [0,'全部'], [1,'1 行'], [3,'3 行'], [5,'5 行'] ] as const)" :key="item[0]" type="button" :class="{ active: modelValue.lyrics.focusRows === item[0] }" @click="setLyricValue('focusRows', item[0] as LyricFocusRows)">{{ item[1] }}</button></div></div>
        <div class="lyric-setting"><span><strong>逐字高亮</strong><small>有逐字时间轴时显示扫光效果。</small></span><label class="appearance-switch icon-only"><input type="checkbox" :checked="modelValue.lyrics.wordHighlight" @change="setLyricValue('wordHighlight', ($event.target as HTMLInputElement).checked)" /><i></i></label></div>
        <div class="lyric-setting lyric-color-setting">
          <span><strong>歌词颜色</strong></span>
          <div class="appearance-segments" role="group" aria-label="歌词颜色模式">
            <button type="button" :aria-pressed="modelValue.lyrics.colorMode === 'theme'" :class="{ active: modelValue.lyrics.colorMode === 'theme' }" @click="setLyricValue('colorMode', 'theme' as LyricColorMode)">默认蓝色</button>
            <button type="button" :aria-pressed="modelValue.lyrics.colorMode === 'custom'" :class="{ active: modelValue.lyrics.colorMode === 'custom' }" @click="setLyricValue('colorMode', 'custom' as LyricColorMode)">自定义</button>
          </div>
        </div>
        <div v-if="modelValue.lyrics.colorMode === 'custom'" class="lyric-setting lyric-custom-setting">
          <span><strong>自定义歌词配色</strong><small>正文、当前行与逐字扫光分别配色。</small></span>
          <div class="lyric-custom-colors">
            <label>正文<input type="color" aria-label="歌词正文颜色" :value="modelValue.lyrics.inactiveColor" @input="setLyricValue('inactiveColor', colorFromEvent($event))" /></label>
            <label>当前行<input type="color" aria-label="歌词当前行颜色" :value="modelValue.lyrics.activeColor" @input="setLyricValue('activeColor', colorFromEvent($event))" /></label>
            <label>扫光<input type="color" aria-label="歌词扫光颜色" :value="modelValue.lyrics.sweepColor" @input="setLyricValue('sweepColor', colorFromEvent($event))" /></label>
          </div>
        </div>
      </div>
    </section>

    <MiniPlayerAppearanceSettings v-model="miniPlayerModel" />
  </article>
</template>

<style scoped>
.background-error { margin: 0; color: #b42318; font-size: 13px; }
.appearance-card { width: min(100%, 980px); overflow: hidden; border: 1px solid #e1e6ed; border-radius: 8px; background: rgba(255,255,255,.96); box-shadow: 0 18px 46px rgba(24,35,54,.08); color: #11192b; }
.appearance-heading { display: flex; align-items: center; gap: 14px; padding: 25px 28px 21px; }
.appearance-heading-icon { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--appearance-accent) 11%, #fff); color: var(--appearance-accent); }
.appearance-heading h2,.appearance-heading p { margin: 0; }.appearance-heading h2 { font-size: 21px; }.appearance-heading p { margin-top: 4px; color: #7b8799; font-size: 12px; }
.appearance-row { position: relative; display: grid; min-height: 72px; grid-template-columns: minmax(260px,1fr) auto; align-items: center; gap: 24px; margin: 0 28px; border-top: 1px solid #eaedf2; padding: 14px 0; }
.appearance-copy { display: grid; gap: 5px; }.appearance-copy strong { font-size: 14px; font-weight: 800; }.appearance-copy span { color: #7b8799; font-size: 11px; line-height: 1.5; }
.appearance-segments { display: inline-flex; align-items: center; gap: 2px; border: 1px solid #e0e5ed; border-radius: 8px; padding: 4px; background: #f3f5f8; }
.appearance-segments button { display: inline-flex; min-width: 64px; height: 34px; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 6px; padding: 0 12px; background: transparent; color: #68758a; cursor: pointer; font-size: 12px; font-weight: 750; }
.appearance-segments button.active { background: #fff; color: #11192b; box-shadow: 0 2px 8px rgba(24,35,54,.1); }.appearance-segments button:hover:not(.active) { color: var(--appearance-accent); }
.appearance-select,.appearance-static-value,.lyric-setting select { width: 190px; height: 38px; border: 1px solid #dfe5ed; border-radius: 7px; padding: 0 12px; background: #f8f9fb; color: #4e5a6c; font-size: 12px; }
.appearance-static-value { text-align: left; }.appearance-static-value:disabled { opacity: .7; }
.accent-swatches { display: flex; align-items: center; gap: 11px; }.accent-swatches button { position: relative; display: grid; width: 30px; height: 30px; place-items: center; border: 2px solid #fff; border-radius: 50%; color: #fff; cursor: pointer; box-shadow: 0 0 0 1px transparent; }.accent-swatches button.active { box-shadow: 0 0 0 2px var(--appearance-accent); }.accent-swatches button:hover { transform: scale(1.06); }
.appearance-expand { display: grid; width: 30px; height: 30px; place-items: center; border: 1px solid #dfe5ed; border-radius: 7px; background: #f8f9fb; color: #8b97a8; cursor: pointer; }.appearance-row.expanded > .appearance-expand svg { transform: rotate(180deg); }.appearance-expand:disabled { cursor: default; opacity: .5; }
.background-row,.lyric-style-row { grid-template-columns: minmax(260px,1fr) auto; }.background-editor,.lyric-editor { display: grid; min-width: 0; grid-column: 1 / -1; gap: 12px; margin-top: 4px; padding: 14px; border: 1px solid #e5e9ef; border-radius: 8px; background: #f5f7f9; }
.background-panel { display: grid; gap: 12px; border: 1px solid #dfe5ed; border-radius: 8px; padding: 14px; background: #fff; }.background-panel > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }.background-panel header div { display: grid; gap: 4px; }.background-panel header strong { font-size: 12px; }.background-panel header span { color: #7d899b; font-size: 10px; }
.background-status,.page-background-heading i { border-radius: 999px; padding: 5px 10px; background: color-mix(in srgb, var(--appearance-accent) 10%, #fff); color: var(--appearance-accent)!important; font-style: normal; font-weight: 800; }
.background-mode { display: inline-flex; width: max-content; border: 1px solid #e3e7ed; border-radius: 7px; padding: 3px; background: #f7f8fa; }.background-mode button { min-width: 58px; height: 30px; border: 0; border-radius: 5px; background: transparent; color: #7a8799; cursor: pointer; font-size: 11px; font-weight: 750; }.background-mode button.active { background: #fff; color: var(--appearance-accent); box-shadow: 0 2px 6px rgba(21,34,53,.08); }
.background-colors { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }.background-colors label { display: grid; min-height: 44px; grid-template-columns: auto 30px minmax(70px,1fr); align-items: center; gap: 10px; border: 1px solid #e1e6ed; border-radius: 7px; padding: 0 11px; color: #7a8798; font-size: 11px; }.background-colors input { width: 28px; height: 28px; border: 0; padding: 0; background: transparent; cursor: pointer; }.background-colors code { color: #586579; font-family: inherit; font-size: 11px; }
.background-actions { display: flex; align-items: center; gap: 8px; }.background-actions button { display: inline-flex; height: 34px; align-items: center; gap: 6px; border: 1px solid #dfe5ed; border-radius: 7px; padding: 0 11px; background: #fff; color: #536174; cursor: pointer; font-size: 11px; font-weight: 750; }.background-actions button:first-child { border-color: color-mix(in srgb,var(--appearance-accent) 35%,#dfe5ed); color: var(--appearance-accent); }.background-actions button:disabled { cursor: default; opacity: .4; }.background-actions span { color: #8994a5; font-size: 10px; }.disabled { opacity: .5; pointer-events: none; }
.page-backgrounds { gap: 10px; }.page-background-item { overflow: hidden; border: 1px solid #e1e6ed; border-radius: 8px; }.page-background-heading { display: grid; width: 100%; min-height: 64px; grid-template-columns: minmax(0,1fr) auto 20px; align-items: center; gap: 11px; border: 0; padding: 10px 12px; background: #fff; color: #172033; cursor: pointer; text-align: left; }.page-background-heading > span { display: grid; gap: 4px; }.page-background-heading strong { font-size: 12px; }.page-background-heading small { color: #7f8a9c; font-size: 10px; }.page-background-item.expanded .page-background-heading svg { transform: rotate(180deg); }.page-background-body { display: grid; gap: 10px; border-top: 1px solid #e6eaf0; padding: 11px; background: #fbfcfd; }
.inherit-button { height: 36px; border: 1px solid #dce3eb; border-radius: 7px; background: #fff; color: #68768a; cursor: pointer; font-size: 11px; font-weight: 750; }.inherit-button.active { border-color: color-mix(in srgb,var(--appearance-accent) 55%,#dce3eb); background: color-mix(in srgb,var(--appearance-accent) 8%,#fff); color: var(--appearance-accent); }
.appearance-switch { display: inline-flex; align-items: center; gap: 8px; color: #6d798b; font-size: 11px; font-weight: 750; cursor: pointer; }.appearance-switch input { position: absolute; opacity: 0; pointer-events: none; }.appearance-switch i { position: relative; width: 38px; height: 22px; border-radius: 999px; background: #c7ced8; }.appearance-switch i::after { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 2px 5px rgba(20,30,45,.2); content: ""; transition: transform 160ms ease; }.appearance-switch input:checked + i { background: var(--appearance-accent); }.appearance-switch input:checked + i::after { transform: translateX(16px); }.appearance-switch.icon-only span { display: none; }
.lyric-editor { gap: 0; padding-block: 0; }.lyric-setting { display: grid; min-height: 72px; grid-template-columns: minmax(240px,1fr) auto; align-items: center; gap: 20px; border-bottom: 1px solid #e5e9ef; padding: 12px 0; }.lyric-setting:last-child { border-bottom: 0; }.lyric-setting > span:first-child { display: grid; gap: 5px; }.lyric-setting strong { font-size: 13px; }.lyric-setting small { color: #808b9d; font-size: 10px; line-height: 1.45; }
.range-control { display: grid; width: 240px; grid-template-columns: 38px minmax(80px,1fr) 50px; align-items: center; gap: 9px; border: 1px solid #dfe5ed; border-radius: 7px; padding: 8px 10px; background: #fff; }.range-control b,.range-control output { color: #657287; font-size: 10px; }.range-control output { text-align: right; }.range-control input { width: 100%; accent-color: var(--appearance-accent); }.focus-segments button { min-width: 54px; }.lyric-color-controls { display: grid; justify-items: end; gap: 9px; }.lyric-custom-colors { display: flex; gap: 8px; }.lyric-custom-colors label { display: flex; align-items: center; gap: 7px; color: #748196; font-size: 10px; }.lyric-custom-colors input { width: 28px; height: 28px; border: 0; padding: 0; background: transparent; }
.lyric-color-setting,.lyric-custom-setting { border-left: 2px solid color-mix(in srgb,var(--appearance-accent) 40%,transparent); padding-inline: 14px; }
.lyric-custom-setting { background: color-mix(in srgb,var(--appearance-accent) 4%,transparent); }
.lyric-custom-colors { flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
.lyric-custom-colors label { min-height: 34px; padding: 4px 10px; border: 1px solid #dfe5ed; border-radius: 7px; background: #f8f9fb; font-size: 11px; font-weight: 700; }
.lyric-custom-colors input { width: 34px; height: 24px; cursor: pointer; }
@media (max-width: 760px) { .lyric-custom-colors { justify-content: flex-start; } }
@media (max-width: 760px) { .appearance-row,.lyric-setting { grid-template-columns: 1fr; align-items: stretch; gap: 12px; }.appearance-row > :not(.appearance-copy),.lyric-setting > :last-child { justify-self: stretch; }.appearance-select,.appearance-static-value,.lyric-setting select,.range-control { width: 100%; }.appearance-expand { position: absolute; top: 18px; right: 0; width: 30px; }.background-editor,.lyric-editor { grid-column: 1; }.background-colors { grid-template-columns: 1fr; }.accent-swatches { flex-wrap: wrap; }.theme-segments,.appearance-segments { width: 100%; }.appearance-segments button { min-width: 0; flex: 1; }.background-actions { flex-wrap: wrap; } }
</style>
