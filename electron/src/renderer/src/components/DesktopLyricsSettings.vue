<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Captions, ChevronDown } from "lucide-vue-next";
import { defaultShortcutConfig, formatAccelerator, type ShortcutSnapshot } from "../../../shared/shortcuts";
import {
  DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE,
  DEFAULT_DESKTOP_LYRICS_PREFERENCES,
  MAX_DESKTOP_LYRICS_FONT_SIZE,
  MAX_DESKTOP_LYRICS_HEIGHT,
  MAX_DESKTOP_LYRICS_WIDTH,
  MIN_DESKTOP_LYRICS_FONT_SIZE,
  MIN_DESKTOP_LYRICS_HEIGHT,
  MIN_DESKTOP_LYRICS_WIDTH,
  resolveDesktopLyricColors,
  type DesktopLyricsBounds,
  type DesktopLyricsColorTheme,
  type DesktopLyricsPlaybackState,
  type DesktopLyricsPreferences
} from "../../../shared/desktopLyrics";

const preferences = ref<DesktopLyricsPreferences>({ ...DEFAULT_DESKTOP_LYRICS_PREFERENCES });
const bounds = ref<DesktopLyricsBounds>({ x: 0, y: 0, width: 960, height: 220 });
const playback = ref<DesktopLyricsPlaybackState>({ ...DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE });
const loaded = ref(false);
const errorMessage = ref("");
const disposers: Array<() => void> = [];
const shortcuts = ref<ShortcutSnapshot>({ config: defaultShortcutConfig(), conflicts: {}, recording: false });
const unlockHint = computed(() => {
  const state = shortcuts.value;
  const binding = state.config.bindings["unlock-lyrics"];
  return state.config.enabled && binding && !state.conflicts["unlock-lyrics"]
    ? `使用 ${formatAccelerator(binding)}、托盘菜单或本页取消锁定。`
    : "可通过托盘菜单或本页取消锁定。";
});

const fontOptions = [
  "Microsoft YaHei UI",
  "MiSans Light",
  "MiSans",
  "HarmonyOS Sans SC",
  "Noto Sans CJK SC",
  "SimHei",
  "SimSun"
];
const colorThemes: Array<{ value: DesktopLyricsColorTheme; label: string }> = [
  { value: "cover", label: "封面强调色" },
  { value: "sunset", label: "落日晖" },
  { value: "twilight", label: "Twilight" },
  { value: "warm", label: "暖白" },
  { value: "custom", label: "自定义" }
];

const controlsDisabled = computed(() => !loaded.value || !preferences.value.enabled);
const lyricColors = computed(() => resolveDesktopLyricColors(
  preferences.value.lyricColorTheme,
  playback.value.coverAccentColor,
  preferences.value.customPlayedColor,
  preferences.value.customUnplayedColor
));
const previewStyle = computed<Record<string, string>>(() => ({
  "--preview-played": lyricColors.value.played,
  "--preview-unplayed": lyricColors.value.unplayed,
  "--preview-font": `"${preferences.value.fontFamily.replaceAll('"', '')}", sans-serif`,
  "--preview-font-size": `${Math.max(24, Math.min(42, preferences.value.fontSize))}px`,
  "--preview-weight": preferences.value.fontWeight === "bold" ? "800" : "400",
  "--preview-radius": `${preferences.value.cornerRadius}px`,
  "--preview-background": `rgb(19 21 25 / ${Math.round(preferences.value.panelOpacity * 100)}%)`,
  "--preview-align": preferences.value.textAlign
}));

function eventValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement).value;
}

function eventChecked(event: Event) {
  return (event.target as HTMLInputElement).checked;
}

async function patchPreferences(patch: Partial<DesktopLyricsPreferences>) {
  preferences.value = { ...preferences.value, ...patch };
  errorMessage.value = "";
  try {
    const updated = await window.listenMusic?.updateDesktopLyricsPreferences(patch);
    if (updated) preferences.value = updated;
  } catch {
    errorMessage.value = "桌面歌词设置暂时无法应用，请重新启动应用后再试。";
  }
}

function patchNumericPreference(
  key: "fontSize" | "panelOpacity" | "cornerRadius",
  value: string
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  void patchPreferences({ [key]: parsed });
}

async function patchBounds(key: "width" | "height", value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  bounds.value = { ...bounds.value, [key]: parsed };
  errorMessage.value = "";
  try {
    const updated = await window.listenMusic?.updateDesktopLyricsBounds({
      width: bounds.value.width,
      height: bounds.value.height
    });
    if (updated) bounds.value = updated;
  } catch {
    errorMessage.value = "窗口尺寸暂时无法更新。";
  }
}

function patchCustomColor(key: "customPlayedColor" | "customUnplayedColor", event: Event) {
  void patchPreferences({
    lyricColorTheme: "custom",
    [key]: eventValue(event)
  });
}

onMounted(async () => {
  const bridge = window.listenMusic;
  if (!bridge) {
    loaded.value = true;
    return;
  }
  disposers.push(
    bridge.onShortcutsChanged((next) => { shortcuts.value = next; }),
    bridge.onDesktopLyricsPreferences((next) => {
      preferences.value = next;
    }),
    bridge.onDesktopLyricsBoundsChanged((next) => {
      bounds.value = next;
    }),
    bridge.onDesktopLyricsPlaybackState((next) => {
      playback.value = next;
    })
  );
  try {
    shortcuts.value = await bridge.getShortcuts();
    const snapshot = await bridge.getDesktopLyricsSnapshot();
    if (snapshot) {
      preferences.value = snapshot.preferences;
      bounds.value = snapshot.bounds;
      playback.value = snapshot.playback;
    }
  } catch {
    errorMessage.value = "无法读取桌面歌词设置。";
  } finally {
    loaded.value = true;
  }
});

onBeforeUnmount(() => {
  disposers.splice(0).forEach((dispose) => dispose());
});
</script>

<template>
  <article class="settings-card desktop-lyrics-settings-card" aria-labelledby="desktop-lyrics-settings-title">
    <div class="settings-card-heading desktop-lyrics-heading">
      <span class="settings-icon" aria-hidden="true"><Captions :size="22" :stroke-width="1.8" /></span>
      <div>
        <h2 id="desktop-lyrics-settings-title">桌面歌词</h2>
        <p>统一调整桌面悬浮歌词的显示、样式和窗口行为，修改后实时生效。</p>
      </div>
    </div>

    <section class="desktop-lyrics-switches" aria-label="桌面歌词开关">
      <label class="desktop-lyrics-check">
        <input
          type="checkbox"
          :checked="preferences.enabled"
          :disabled="!loaded"
          @change="patchPreferences({ enabled: eventChecked($event) })"
        />
        <span aria-hidden="true"></span>
        启用桌面歌词
      </label>
      <label class="desktop-lyrics-check">
        <input
          type="checkbox"
          :checked="preferences.alwaysOnTop"
          :disabled="controlsDisabled"
          @change="patchPreferences({ alwaysOnTop: eventChecked($event) })"
        />
        <span aria-hidden="true"></span>
        启用歌词总在最前
      </label>
      <label class="desktop-lyrics-check">
        <input
          type="checkbox"
          :checked="preferences.translationEnabled"
          :disabled="controlsDisabled"
          @change="patchPreferences({ translationEnabled: eventChecked($event) })"
        />
        <span aria-hidden="true"></span>
        外文歌词显示翻译
      </label>
      <label class="desktop-lyrics-check">
        <input
          type="checkbox"
          :checked="preferences.phoneticEnabled"
          :disabled="controlsDisabled"
          @change="patchPreferences({ phoneticEnabled: eventChecked($event) })"
        />
        <span aria-hidden="true"></span>
        外文歌词显示音标
      </label>
    </section>

    <fieldset class="desktop-lyrics-fields" :disabled="controlsDisabled">
      <label class="desktop-lyrics-field desktop-lyrics-position">
        <span>显示位置</span>
        <select aria-label="桌面歌词显示位置" disabled>
          <option>桌面悬浮</option>
        </select>
      </label>

      <section class="desktop-lyrics-grid desktop-lyrics-font-grid" aria-label="字体样式">
        <label class="desktop-lyrics-field">
          <span>字体</span>
          <select
            :value="preferences.fontFamily"
            aria-label="桌面歌词字体"
            @change="patchPreferences({ fontFamily: eventValue($event) })"
          >
            <option v-for="font in fontOptions" :key="font" :value="font">{{ font }}</option>
          </select>
        </label>
        <label class="desktop-lyrics-field">
          <span>字号</span>
          <input
            type="number"
            :min="MIN_DESKTOP_LYRICS_FONT_SIZE"
            :max="MAX_DESKTOP_LYRICS_FONT_SIZE"
            :value="preferences.fontSize"
            aria-label="桌面歌词字号"
            @change="patchNumericPreference('fontSize', eventValue($event))"
          />
        </label>
        <label class="desktop-lyrics-field">
          <span>字粗</span>
          <select
            :value="preferences.fontWeight"
            aria-label="桌面歌词字粗"
            @change="patchPreferences({ fontWeight: eventValue($event) as DesktopLyricsPreferences['fontWeight'] })"
          >
            <option value="standard">标准</option>
            <option value="bold">粗体</option>
          </select>
        </label>
        <label class="desktop-lyrics-field">
          <span>描边</span>
          <select
            :value="preferences.strokeEnabled ? 'enabled' : 'disabled'"
            aria-label="桌面歌词描边"
            @change="patchPreferences({ strokeEnabled: eventValue($event) === 'enabled' })"
          >
            <option value="enabled">有描边</option>
            <option value="disabled">无描边</option>
          </select>
        </label>
      </section>

      <section class="desktop-lyrics-layout" aria-labelledby="desktop-lyrics-layout-title">
        <h3 id="desktop-lyrics-layout-title">调整排版样式</h3>
        <div class="desktop-lyrics-grid desktop-lyrics-layout-grid">
          <label class="desktop-lyrics-field">
            <span>显示行数</span>
            <select
              :value="preferences.lineMode"
              @change="patchPreferences({ lineMode: eventValue($event) as DesktopLyricsPreferences['lineMode'] })"
            >
              <option value="double">双行显示</option>
              <option value="single">单行显示</option>
            </select>
          </label>
          <label class="desktop-lyrics-field">
            <span>排列方向</span>
            <select :value="preferences.orientation" disabled>
              <option value="horizontal">横排显示</option>
            </select>
          </label>
          <label class="desktop-lyrics-field">
            <span>对齐方式</span>
            <select
              :value="preferences.textAlign"
              @change="patchPreferences({ textAlign: eventValue($event) as DesktopLyricsPreferences['textAlign'] })"
            >
              <option value="left">居左</option>
              <option value="center">居中</option>
              <option value="right">居右</option>
            </select>
          </label>
        </div>
      </section>

      <section class="desktop-lyrics-colors" aria-labelledby="desktop-lyrics-colors-title">
        <h3 id="desktop-lyrics-colors-title">更改配色方案</h3>
        <div class="desktop-lyrics-grid desktop-lyrics-color-grid">
          <label class="desktop-lyrics-field">
            <span>配色方案</span>
            <select
              :value="preferences.lyricColorTheme"
              @change="patchPreferences({ lyricColorTheme: eventValue($event) as DesktopLyricsColorTheme })"
            >
              <option v-for="theme in colorThemes" :key="theme.value" :value="theme.value">
                {{ theme.label }}
              </option>
            </select>
          </label>
          <label class="desktop-lyrics-color-field">
            <span>已播放文字颜色</span>
            <input
              type="color"
              :value="lyricColors.played"
              aria-label="已播放文字颜色"
              @input="patchCustomColor('customPlayedColor', $event)"
            />
            <code>{{ lyricColors.played }}</code>
          </label>
          <label class="desktop-lyrics-color-field">
            <span>未播放文字颜色</span>
            <input
              type="color"
              :value="lyricColors.unplayed"
              aria-label="未播放文字颜色"
              @input="patchCustomColor('customUnplayedColor', $event)"
            />
            <code>{{ lyricColors.unplayed }}</code>
          </label>
        </div>
      </section>

      <section class="desktop-lyrics-preview-section" aria-labelledby="desktop-lyrics-preview-title">
        <h3 id="desktop-lyrics-preview-title">实时预览</h3>
        <div
          class="desktop-lyrics-preview"
          :class="{
            stroked: preferences.strokeEnabled,
            'without-shadow': !preferences.shadowEnabled,
            'without-animation': !preferences.animationEnabled
          }"
          :style="previewStyle"
        >
          <p class="played">晚风拂过回响</p>
          <p v-if="preferences.phoneticEnabled" class="phonetic">wǎn fēng fú guò huí xiǎng</p>
          <p v-if="preferences.lineMode === 'double'" class="unplayed">下一句落在星光里</p>
          <p v-if="preferences.translationEnabled" class="translation">The next line settles among the stars</p>
        </div>
      </section>

      <section class="desktop-lyrics-window-section" aria-labelledby="desktop-lyrics-window-title">
        <h3 id="desktop-lyrics-window-title">窗口</h3>
        <div class="desktop-lyrics-window-grid">
          <label class="desktop-lyrics-range">
            <span>宽度 <output>{{ bounds.width }} px</output></span>
            <input
              type="range"
              :min="MIN_DESKTOP_LYRICS_WIDTH"
              :max="MAX_DESKTOP_LYRICS_WIDTH"
              step="10"
              :value="bounds.width"
              @input="patchBounds('width', eventValue($event))"
            />
          </label>
          <label class="desktop-lyrics-range">
            <span>高度 <output>{{ bounds.height }} px</output></span>
            <input
              type="range"
              :min="MIN_DESKTOP_LYRICS_HEIGHT"
              :max="MAX_DESKTOP_LYRICS_HEIGHT"
              step="10"
              :value="bounds.height"
              @input="patchBounds('height', eventValue($event))"
            />
          </label>
        </div>
        <label class="desktop-lyrics-lock-row">
          <span class="desktop-lyrics-lock-copy">
            <strong>锁定并穿透点击</strong>
            <small>锁定后不可拖动，鼠标点击会穿透到下层窗口。{{ unlockHint }}</small>
          </span>
          <span class="settings-switch">
            <input
              type="checkbox"
              :checked="preferences.locked"
              @change="patchPreferences({ locked: eventChecked($event) })"
            />
            <i aria-hidden="true"></i>
            <span>{{ preferences.locked ? "已锁定" : "未锁定" }}</span>
          </span>
        </label>
      </section>

      <details class="desktop-lyrics-advanced">
        <summary><ChevronDown :size="16" aria-hidden="true" />高级设置</summary>
        <div class="desktop-lyrics-advanced-grid">
          <label class="desktop-lyrics-range">
            <span>背景透明度 <output>{{ Math.round(preferences.panelOpacity * 100) }}%</output></span>
            <input
              type="range"
              min="0.25"
              max="1"
              step="0.01"
              :value="preferences.panelOpacity"
              @input="patchNumericPreference('panelOpacity', eventValue($event))"
            />
          </label>
          <label class="desktop-lyrics-range">
            <span>圆角 <output>{{ preferences.cornerRadius }} px</output></span>
            <input
              type="range"
              min="0"
              max="32"
              step="1"
              :value="preferences.cornerRadius"
              @input="patchNumericPreference('cornerRadius', eventValue($event))"
            />
          </label>
          <label class="desktop-lyrics-check">
            <input
              type="checkbox"
              :checked="preferences.shadowEnabled"
              @change="patchPreferences({ shadowEnabled: eventChecked($event) })"
            />
            <span aria-hidden="true"></span>
            窗口阴影
          </label>
          <label class="desktop-lyrics-check">
            <input
              type="checkbox"
              :checked="preferences.animationEnabled"
              @change="patchPreferences({ animationEnabled: eventChecked($event) })"
            />
            <span aria-hidden="true"></span>
            切换动画
          </label>
        </div>
      </details>
    </fieldset>

    <p v-if="errorMessage" class="desktop-lyrics-error" role="status">{{ errorMessage }}</p>
    <p v-else-if="!loaded" class="desktop-lyrics-loading" role="status">正在读取桌面歌词设置…</p>
  </article>
</template>

<style scoped>
.desktop-lyrics-settings-card {
  gap: 26px;
}

.desktop-lyrics-heading {
  padding-bottom: 2px;
}

.desktop-lyrics-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  border-top: 1px solid #edf0f5;
  padding-top: 20px;
}

.desktop-lyrics-check {
  position: relative;
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  gap: 8px;
  color: #2d374a;
  cursor: pointer;
  font-size: 12px;
  font-weight: 750;
}

.desktop-lyrics-check input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.desktop-lyrics-check > span {
  display: grid;
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #c8d0dc;
  border-radius: 4px;
  background: #fff;
}

.desktop-lyrics-check input:checked + span {
  border-color: #1769ff;
  background: #1769ff;
}

.desktop-lyrics-check input:checked + span::after {
  color: #fff;
  content: "✓";
  font-size: 11px;
  font-weight: 900;
}

.desktop-lyrics-check input:focus-visible + span {
  outline: 3px solid rgb(23 105 255 / 14%);
  outline-offset: 2px;
}

.desktop-lyrics-check:has(input:disabled) {
  cursor: default;
  opacity: .46;
}

.desktop-lyrics-fields {
  display: grid;
  min-width: 0;
  gap: 28px;
  margin: 0;
  border: 0;
  padding: 0;
}

.desktop-lyrics-fields:disabled {
  opacity: .48;
}

.desktop-lyrics-grid {
  display: grid;
  gap: 18px;
}

.desktop-lyrics-font-grid {
  grid-template-columns: 1.45fr .65fr .8fr .85fr;
}

.desktop-lyrics-layout-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.desktop-lyrics-color-grid {
  grid-template-columns: 1.1fr repeat(2, minmax(0, .9fr));
  align-items: end;
}

.desktop-lyrics-field {
  display: grid;
  min-width: 0;
  gap: 8px;
  color: #4f5a6c;
  font-size: 11px;
  font-weight: 800;
}

.desktop-lyrics-position {
  width: min(220px, 100%);
}

.desktop-lyrics-field select,
.desktop-lyrics-field input[type="number"] {
  width: 100%;
  height: 40px;
  min-width: 0;
  border: 1px solid #dce2ea;
  border-radius: 8px;
  padding: 0 34px 0 12px;
  outline: 0;
  background: #fff;
  color: #263247;
  font: 700 12px/1 inherit;
}

.desktop-lyrics-field input[type="number"] {
  padding-right: 10px;
}

.desktop-lyrics-field select:focus-visible,
.desktop-lyrics-field input:focus-visible {
  border-color: #8fb1f5;
  box-shadow: 0 0 0 3px rgb(31 108 255 / 10%);
}

.desktop-lyrics-layout,
.desktop-lyrics-colors,
.desktop-lyrics-preview-section,
.desktop-lyrics-window-section {
  display: grid;
  gap: 16px;
}

.desktop-lyrics-layout h3,
.desktop-lyrics-colors h3,
.desktop-lyrics-preview-section h3,
.desktop-lyrics-window-section h3 {
  margin: 0;
  color: #172033;
  font-size: 13px;
  font-weight: 850;
}

.desktop-lyrics-color-field {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: center;
  gap: 7px 10px;
  color: #4f5a6c;
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
}

.desktop-lyrics-color-field > span {
  grid-column: 1 / -1;
}

.desktop-lyrics-color-field input {
  width: 26px;
  height: 26px;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.desktop-lyrics-color-field code {
  color: #7d8798;
  font: 700 11px/1.2 ui-monospace, monospace;
  text-transform: uppercase;
}

.desktop-lyrics-preview {
  display: grid;
  min-height: 154px;
  align-content: center;
  justify-items: stretch;
  gap: 5px;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: var(--preview-radius);
  padding: 24px 34px;
  background: var(--preview-background);
  box-shadow: 0 16px 32px rgb(28 35 48 / 16%);
  color: var(--preview-unplayed);
  font-family: var(--preview-font);
  font-synthesis: weight;
  text-align: var(--preview-align);
  transition: border-radius 160ms ease, background 160ms ease, box-shadow 160ms ease;
}

.desktop-lyrics-preview.without-shadow {
  box-shadow: none;
}

.desktop-lyrics-preview.without-animation,
.desktop-lyrics-preview.without-animation * {
  transition: none;
}

.desktop-lyrics-preview p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
  text-shadow: 0 2px 8px rgb(0 0 0 / 48%);
}

.desktop-lyrics-preview .played {
  color: var(--preview-played);
  font-size: var(--preview-font-size);
  font-weight: var(--preview-weight);
  line-height: 1.3;
}

.desktop-lyrics-preview.stroked .played {
  -webkit-text-stroke: .55px rgb(0 0 0 / 54%);
  paint-order: stroke fill;
}

.desktop-lyrics-preview .unplayed {
  color: var(--preview-unplayed);
  font-size: calc(var(--preview-font-size) * .76);
  font-weight: var(--preview-weight);
  opacity: .62;
}

.desktop-lyrics-preview .phonetic,
.desktop-lyrics-preview .translation {
  color: var(--preview-unplayed);
  font-size: 12px;
  opacity: .7;
}

.desktop-lyrics-window-grid,
.desktop-lyrics-advanced-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 24px;
}

.desktop-lyrics-range {
  display: grid;
  gap: 9px;
}

.desktop-lyrics-range > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #4f5a6c;
  font-size: 11px;
  font-weight: 800;
}

.desktop-lyrics-range output {
  color: #172033;
  font-variant-numeric: tabular-nums;
}

.desktop-lyrics-range input {
  width: 100%;
  accent-color: #1769ff;
  cursor: pointer;
}

.desktop-lyrics-lock-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-top: 1px solid #edf0f5;
  padding-top: 18px;
}

.desktop-lyrics-lock-copy {
  display: grid;
  gap: 5px;
}

.desktop-lyrics-lock-copy strong {
  color: #182237;
  font-size: 13px;
}

.desktop-lyrics-lock-copy small {
  color: #7c8798;
  font-size: 11px;
  line-height: 1.55;
}

.desktop-lyrics-advanced {
  border-top: 1px solid #edf0f5;
  padding-top: 18px;
}

.desktop-lyrics-advanced summary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #172033;
  cursor: pointer;
  font-size: 13px;
  font-weight: 850;
  list-style: none;
}

.desktop-lyrics-advanced summary::-webkit-details-marker {
  display: none;
}

.desktop-lyrics-advanced summary svg {
  transition: transform 160ms ease;
}

.desktop-lyrics-advanced[open] summary svg {
  transform: rotate(180deg);
}

.desktop-lyrics-advanced-grid {
  margin-top: 20px;
}

.desktop-lyrics-error,
.desktop-lyrics-loading {
  margin: 0;
  color: #7b8799;
  font-size: 11px;
}

.desktop-lyrics-error {
  color: #a13f45;
}

@media (max-width: 780px) {
  .desktop-lyrics-font-grid,
  .desktop-lyrics-color-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .desktop-lyrics-layout-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .desktop-lyrics-font-grid,
  .desktop-lyrics-color-grid,
  .desktop-lyrics-window-grid,
  .desktop-lyrics-advanced-grid {
    grid-template-columns: 1fr;
  }

  .desktop-lyrics-lock-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
