<script setup lang="ts">
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  LayoutPanelTop,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Undo2
} from "lucide-vue-next";
import { ref } from "vue";
import { selectPlaylistCoverImage } from "../services/api";
import {
  createDefaultMiniPlayerPreferences,
  createMiniPlayerThemePreferences,
  normalizeMiniPlayerPreferences,
  type MiniPlayerBackgroundMode,
  type MiniPlayerLayoutMode,
  type MiniPlayerPreferences,
  type MiniPlayerTheme
} from "../services/appearanceSettings";

type EditorTab = "theme" | "background" | "appearance" | "layout";

const props = defineProps<{ modelValue: MiniPlayerPreferences }>();
const emit = defineEmits<{ "update:modelValue": [preferences: MiniPlayerPreferences] }>();

const open = ref(false);
const activeTab = ref<EditorTab>("theme");
const importing = ref(false);
const importError = ref("");
const undoStack = ref<MiniPlayerPreferences[]>([]);

const tabs: Array<{ key: EditorTab; label: string; icon: typeof Palette }> = [
  { key: "theme", label: "主题", icon: Palette },
  { key: "background", label: "背景", icon: ImageIcon },
  { key: "appearance", label: "外观", icon: SlidersHorizontal },
  { key: "layout", label: "布局", icon: LayoutPanelTop }
];

function clonePreferences(value = props.modelValue) {
  return JSON.parse(JSON.stringify(value)) as MiniPlayerPreferences;
}

function commit(mutator: (draft: MiniPlayerPreferences) => void) {
  undoStack.value.push(clonePreferences());
  if (undoStack.value.length > 40) undoStack.value.shift();
  const draft = clonePreferences();
  mutator(draft);
  emit("update:modelValue", normalizeMiniPlayerPreferences(draft));
}

function selectTheme(theme: MiniPlayerTheme) {
  if (props.modelValue.theme === theme) return;
  commit((draft) => Object.assign(draft, createMiniPlayerThemePreferences(theme)));
}

function setBackgroundMode(mode: MiniPlayerBackgroundMode) {
  commit((draft) => { draft.background.mode = mode; });
}

function setBackground<K extends keyof MiniPlayerPreferences["background"]>(
  key: K,
  value: MiniPlayerPreferences["background"][K]
) {
  commit((draft) => { draft.background[key] = value; });
}

function setAppearance<K extends keyof MiniPlayerPreferences["appearance"]>(
  key: K,
  value: MiniPlayerPreferences["appearance"][K]
) {
  commit((draft) => { draft.appearance[key] = value; });
}

function setLayout<K extends keyof MiniPlayerPreferences["layout"]>(
  key: K,
  value: MiniPlayerPreferences["layout"][K]
) {
  commit((draft) => { draft.layout[key] = value; });
}

function colorFromEvent(event: Event) {
  return (event.target as HTMLInputElement).value;
}

function numberFromEvent(event: Event) {
  return Number((event.target as HTMLInputElement).value);
}

function booleanFromEvent(event: Event) {
  return (event.target as HTMLInputElement).checked;
}

function undoCurrent() {
  const previous = undoStack.value.pop();
  if (previous) emit("update:modelValue", previous);
}

function restoreDefaults() {
  const defaults = createDefaultMiniPlayerPreferences();
  commit((draft) => {
    if (activeTab.value === "theme") Object.assign(draft, defaults);
    if (activeTab.value === "background") draft.background = defaults.background;
    if (activeTab.value === "appearance") draft.appearance = defaults.appearance;
    if (activeTab.value === "layout") draft.layout = defaults.layout;
  });
}

async function chooseImage() {
  if (importing.value) return;
  importing.value = true;
  importError.value = "";
  try {
    const selected = await selectPlaylistCoverImage();
    if (!selected) return;
    if (window.listenMusic && !window.listenMusic.readAppearanceBackground) {
      throw new Error("背景导入服务尚未更新，请完全退出并重新启动软件。");
    }
    const imagePath = window.listenMusic && !selected.startsWith("data:")
      ? await window.listenMusic.readAppearanceBackground(selected)
      : selected;
    const image = new Image();
    image.src = imagePath;
    await image.decode();
    commit((draft) => {
      draft.background.mode = "image";
      draft.background.imagePath = imagePath;
    });
  } catch (error) {
    importError.value = error instanceof Error && error.name !== "EncodingError"
      ? error.message
      : "图片无法解码，请检查文件是否完整。";
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <section class="mini-settings" :class="{ expanded: open }">
    <div class="mini-settings-heading">
      <div><strong>迷你播放器</strong><span>自定义迷你播放器窗口的主题、背景与布局。</span></div>
      <button type="button" class="mini-settings-expand" :aria-expanded="open" aria-label="展开迷你播放器设置" @click="open = !open">
        <ChevronDown :size="17" />
      </button>
    </div>

    <div v-if="open" class="mini-settings-editor">
      <nav class="mini-settings-tabs" aria-label="迷你播放器设置分类">
        <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          <component :is="tab.icon" :size="14" />{{ tab.label }}
        </button>
      </nav>

      <div v-if="activeTab === 'theme'" class="mini-settings-pane theme-pane">
        <button type="button" class="theme-option twilight" :class="{ active: modelValue.theme === 'twilight-glass' }" @click="selectTheme('twilight-glass')">
          <i aria-hidden="true"></i><span>暮光玻璃</span><Check v-if="modelValue.theme === 'twilight-glass'" :size="17" />
        </button>
        <button type="button" class="theme-option moon" :class="{ active: modelValue.theme === 'moon-white' }" @click="selectTheme('moon-white')">
          <i aria-hidden="true"></i><span>月白</span><Check v-if="modelValue.theme === 'moon-white'" :size="17" />
        </button>
      </div>

      <div v-else-if="activeTab === 'background'" class="mini-settings-pane">
        <div class="mini-mode-segments" role="radiogroup" aria-label="迷你播放器背景类型">
          <button v-for="item in ([['solid','纯色'],['gradient','渐变'],['cover','封面'],['image','图片']] as const)" :key="item[0]" type="button" :class="{ active: modelValue.background.mode === item[0] }" @click="setBackgroundMode(item[0])">{{ item[1] }}</button>
        </div>

        <div v-if="modelValue.background.mode === 'cover'" class="mini-mode-segments cover-fit" role="radiogroup" aria-label="封面填充方式">
          <button type="button" :class="{ active: modelValue.background.coverFit === 'cover' }" @click="setBackground('coverFit', 'cover')">填满</button>
          <button type="button" :class="{ active: modelValue.background.coverFit === 'contain' }" @click="setBackground('coverFit', 'contain')">完整</button>
        </div>

        <div v-if="modelValue.background.mode === 'image'" class="mini-image-actions">
          <button type="button" :disabled="importing" @click="chooseImage"><ImageIcon :size="15" />{{ importing ? '正在导入' : '选择图片' }}</button>
          <button type="button" :disabled="!modelValue.background.imagePath" @click="setBackground('imagePath', '')">移除图片</button>
          <span>{{ modelValue.background.imagePath ? '已设置图片' : '支持 JPG / PNG / WebP' }}</span>
        </div>
        <p v-if="importError" class="mini-import-error" role="alert">{{ importError }}</p>

        <div class="mini-control-list">
          <label v-if="modelValue.background.mode === 'solid'" class="mini-color-row"><span>背景颜色</span><input type="color" :value="modelValue.background.solidColor" @input="setBackground('solidColor', colorFromEvent($event))" /><code>{{ modelValue.background.solidColor }}</code></label>
          <label v-if="modelValue.background.mode === 'gradient'" class="mini-color-row"><span>起始颜色</span><input type="color" :value="modelValue.background.gradientStart" @input="setBackground('gradientStart', colorFromEvent($event))" /><code>{{ modelValue.background.gradientStart }}</code></label>
          <label v-if="modelValue.background.mode === 'gradient'" class="mini-color-row"><span>结束颜色</span><input type="color" :value="modelValue.background.gradientEnd" @input="setBackground('gradientEnd', colorFromEvent($event))" /><code>{{ modelValue.background.gradientEnd }}</code></label>
          <label v-if="modelValue.background.mode !== 'solid'" class="mini-color-row"><span>回退颜色</span><input type="color" :value="modelValue.background.fallbackColor" @input="setBackground('fallbackColor', colorFromEvent($event))" /><code>{{ modelValue.background.fallbackColor }}</code></label>
          <label class="mini-color-row"><span>遮罩颜色</span><input type="color" :value="modelValue.background.maskColor" @input="setBackground('maskColor', colorFromEvent($event))" /><code>{{ modelValue.background.maskColor }}</code></label>
          <label class="mini-range-row"><span>背景模糊</span><input type="range" min="0" max="48" step="1" :value="modelValue.background.blur" @input="setBackground('blur', numberFromEvent($event))" /><output>{{ modelValue.background.blur }}px</output></label>
          <label class="mini-range-row"><span>背景亮度</span><input type="range" min="50" max="150" step="1" :value="modelValue.background.brightness" @input="setBackground('brightness', numberFromEvent($event))" /><output>{{ modelValue.background.brightness }}%</output></label>
          <label class="mini-range-row"><span>背景饱和度</span><input type="range" min="50" max="180" step="1" :value="modelValue.background.saturation" @input="setBackground('saturation', numberFromEvent($event))" /><output>{{ modelValue.background.saturation }}%</output></label>
          <label class="mini-range-row"><span>背景不透明度</span><input type="range" min="0" max="100" step="1" :value="modelValue.background.opacity" @input="setBackground('opacity', numberFromEvent($event))" /><output>{{ modelValue.background.opacity }}%</output></label>
          <label class="mini-range-row"><span>遮罩强度</span><input type="range" min="0" max="100" step="1" :value="modelValue.background.maskStrength" @input="setBackground('maskStrength', numberFromEvent($event))" /><output>{{ modelValue.background.maskStrength }}%</output></label>
        </div>
      </div>

      <div v-else-if="activeTab === 'appearance'" class="mini-settings-pane">
        <div class="mini-control-list">
          <div class="mini-choice-row"><span>强调色</span><div class="mini-mode-segments"><button type="button" :class="{ active: modelValue.appearance.accentMode === 'cover' }" @click="setAppearance('accentMode', 'cover')">跟随封面</button><button type="button" :class="{ active: modelValue.appearance.accentMode === 'custom' }" @click="setAppearance('accentMode', 'custom')">自定义</button></div></div>
          <label v-if="modelValue.appearance.accentMode === 'custom'" class="mini-color-row"><span>强调颜色</span><input type="color" :value="modelValue.appearance.accentColor" @input="setAppearance('accentColor', colorFromEvent($event))" /><code>{{ modelValue.appearance.accentColor }}</code></label>
          <div class="mini-choice-row"><span>文字颜色</span><div class="mini-mode-segments"><button type="button" :class="{ active: modelValue.appearance.textMode === 'auto' }" @click="setAppearance('textMode', 'auto')">自动</button><button type="button" :class="{ active: modelValue.appearance.textMode === 'custom' }" @click="setAppearance('textMode', 'custom')">自定义</button></div></div>
          <label v-if="modelValue.appearance.textMode === 'custom'" class="mini-color-row"><span>文字颜色</span><input type="color" :value="modelValue.appearance.textColor" @input="setAppearance('textColor', colorFromEvent($event))" /><code>{{ modelValue.appearance.textColor }}</code></label>
          <label class="mini-color-row"><span>边框颜色</span><input type="color" :value="modelValue.appearance.borderColor" @input="setAppearance('borderColor', colorFromEvent($event))" /><code>{{ modelValue.appearance.borderColor }}</code></label>
          <label class="mini-range-row"><span>表面不透明度</span><input type="range" min="0" max="100" step="1" :value="modelValue.appearance.surfaceOpacity" @input="setAppearance('surfaceOpacity', numberFromEvent($event))" /><output>{{ modelValue.appearance.surfaceOpacity }}%</output></label>
          <label class="mini-range-row"><span>毛玻璃</span><input type="range" min="0" max="48" step="1" :value="modelValue.appearance.blur" @input="setAppearance('blur', numberFromEvent($event))" /><output>{{ modelValue.appearance.blur }}px</output></label>
          <label class="mini-range-row"><span>窗口圆角</span><input type="range" min="8" max="32" step="1" :value="modelValue.appearance.cornerRadius" @input="setAppearance('cornerRadius', numberFromEvent($event))" /><output>{{ modelValue.appearance.cornerRadius }}px</output></label>
          <label class="mini-range-row"><span>边框粗细</span><input type="range" min="0" max="4" step="1" :value="modelValue.appearance.borderWidth" @input="setAppearance('borderWidth', numberFromEvent($event))" /><output>{{ modelValue.appearance.borderWidth }}px</output></label>
          <label class="mini-range-row"><span>阴影强度</span><input type="range" min="0" max="60" step="1" :value="modelValue.appearance.shadowStrength" @input="setAppearance('shadowStrength', numberFromEvent($event))" /><output>{{ modelValue.appearance.shadowStrength }}%</output></label>
        </div>
      </div>

      <div v-else class="mini-settings-pane">
        <div class="mini-mode-segments layout-modes" role="radiogroup" aria-label="迷你播放器布局">
          <button v-for="item in ([['auto','自动'],['compact','紧凑'],['standard','标准'],['wide','宽屏']] as const)" :key="item[0]" type="button" :class="{ active: modelValue.layout.mode === item[0] }" @click="setLayout('mode', item[0] as MiniPlayerLayoutMode)">{{ item[1] }}</button>
        </div>
        <div class="mini-toggle-list">
          <label><span>专辑封面</span><input type="checkbox" :checked="modelValue.layout.showCover" @change="setLayout('showCover', booleanFromEvent($event))" /></label>
          <label><span>专辑名称</span><input type="checkbox" :checked="modelValue.layout.showAlbum" @change="setLayout('showAlbum', booleanFromEvent($event))" /></label>
          <label><span>均衡器动画</span><input type="checkbox" :checked="modelValue.layout.showEqualizer" @change="setLayout('showEqualizer', booleanFromEvent($event))" /></label>
          <label><span>时间信息</span><input type="checkbox" :checked="modelValue.layout.showTime" @change="setLayout('showTime', booleanFromEvent($event))" /></label>
          <label><span>音量控制</span><input type="checkbox" :checked="modelValue.layout.showVolume" @change="setLayout('showVolume', booleanFromEvent($event))" /></label>
          <label><span>播放模式</span><input type="checkbox" :checked="modelValue.layout.showPlayMode" @change="setLayout('showPlayMode', booleanFromEvent($event))" /></label>
          <label><span>队列位置</span><input type="checkbox" :checked="modelValue.layout.showQueue" @change="setLayout('showQueue', booleanFromEvent($event))" /></label>
        </div>
      </div>

      <footer class="mini-settings-actions">
        <button type="button" :disabled="!undoStack.length" @click="undoCurrent"><Undo2 :size="14" />撤销本次</button>
        <button type="button" @click="restoreDefaults"><RotateCcw :size="14" />恢复默认</button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.mini-settings { margin: 0 28px; border-top: 1px solid #eaedf2; color: #11192b; }
.mini-settings-heading { display: grid; min-height: 72px; grid-template-columns: minmax(260px,1fr) auto; align-items: center; gap: 24px; padding: 14px 0; }
.mini-settings-heading>div { display: grid; gap: 5px; }.mini-settings-heading strong { font-size: 14px; font-weight: 800; }.mini-settings-heading span { color: #7b8799; font-size: 11px; line-height: 1.5; }
.mini-settings-expand { display: grid; width: 30px; height: 30px; place-items: center; border: 1px solid #dfe5ed; border-radius: 7px; background: #f8f9fb; color: #8b97a8; cursor: pointer; }.mini-settings.expanded .mini-settings-expand svg { transform: rotate(180deg); }
.mini-settings-editor { display: grid; gap: 12px; padding: 0 8px 14px; }
.mini-settings-tabs,.mini-mode-segments { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 2px; border: 1px solid #dfe4e9; border-radius: 8px; padding: 3px; background: #f1f3f5; }
.mini-settings-tabs button,.mini-mode-segments button { display: inline-flex; min-width: 0; height: 34px; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 6px; background: transparent; color: #68758a; cursor: pointer; font-size: 12px; font-weight: 750; }
.mini-settings-tabs button.active,.mini-mode-segments button.active { background: color-mix(in srgb,var(--appearance-accent) 12%,#fff); color: var(--appearance-accent); box-shadow: 0 1px 5px rgba(22,34,52,.06); }
.mini-settings-pane { display: grid; gap: 10px; min-width: 0; }.theme-pane { gap: 10px; }
.theme-option { display: grid; min-height: 46px; grid-template-columns: 30px minmax(0,1fr) 24px; align-items: center; gap: 12px; border: 1px solid #e0e5eb; border-radius: 8px; padding: 6px 10px; background: #f2f3f5; color: #222b3b; cursor: pointer; font-size: 13px; font-weight: 750; text-align: left; }.theme-option i { width: 28px; height: 28px; border: 1px solid #d7dde7; border-radius: 7px; }.theme-option.twilight i { background: #121625; }.theme-option.moon i { background: #f4f6ff; }.theme-option.active { border-color: color-mix(in srgb,var(--appearance-accent) 60%,#dfe5eb); color: var(--appearance-accent); }
.mini-control-list { display: grid; gap: 0; }.mini-color-row,.mini-range-row,.mini-choice-row { display: grid; min-height: 42px; align-items: center; border-bottom: 1px solid #eef0f3; font-size: 11px; }.mini-color-row { grid-template-columns: minmax(120px,1fr) 34px 78px; gap: 8px; }.mini-color-row input { width: 30px; height: 28px; border: 1px solid #dce2e9; border-radius: 6px; padding: 3px; background: #fff; }.mini-color-row code { color: #718095; font-family: inherit; font-size: 10px; }.mini-range-row { grid-template-columns: minmax(120px,1fr) minmax(180px,1.2fr) 48px; gap: 12px; }.mini-range-row input { width: 100%; accent-color: var(--appearance-accent); }.mini-range-row output { color: #718095; font-size: 10px; text-align: right; }.mini-choice-row { grid-template-columns: minmax(120px,1fr) minmax(220px,1.2fr); gap: 12px; }
.cover-fit { margin-top: -2px; }.mini-image-actions { display: flex; align-items: center; gap: 8px; }.mini-image-actions button,.mini-settings-actions button { display: inline-flex; height: 32px; align-items: center; gap: 6px; border: 1px solid #dfe5ec; border-radius: 7px; padding: 0 10px; background: #f5f6f8; color: #4e5a6c; cursor: pointer; font-size: 11px; font-weight: 700; }.mini-image-actions button:first-child { border-color: color-mix(in srgb,var(--appearance-accent) 40%,#dfe5ec); color: var(--appearance-accent); }.mini-image-actions button:disabled,.mini-settings-actions button:disabled { cursor: default; opacity: .4; }.mini-image-actions span { color: #8a95a5; font-size: 10px; }.mini-import-error { margin: 0; color: #b42318; font-size: 11px; }
.layout-modes { margin-bottom: 3px; }.mini-toggle-list { display: grid; }.mini-toggle-list label { display: flex; min-height: 40px; align-items: center; justify-content: space-between; border-bottom: 1px solid #eef0f3; cursor: pointer; font-size: 11px; }.mini-toggle-list input { width: 18px; height: 18px; accent-color: var(--appearance-accent); }
.mini-settings-actions { display: flex; justify-content: flex-end; gap: 7px; border-top: 1px solid #e5e9ee; padding-top: 10px; }
@media (max-width: 760px) { .mini-settings { margin-inline: 16px; }.mini-range-row,.mini-choice-row { grid-template-columns: 110px minmax(0,1fr); }.mini-range-row output { display: none; }.mini-settings-tabs button { padding-inline: 4px; }.mini-settings-tabs button svg { display: none; } }
</style>
