<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  Languages,
  LockKeyhole,
  LockOpen,
  Palette,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X
} from "lucide-vue-next";
import {
  DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE,
  DEFAULT_DESKTOP_LYRICS_PREFERENCES,
  MAX_DESKTOP_LYRICS_FONT_SIZE,
  MIN_DESKTOP_LYRICS_FONT_SIZE,
  getDesktopLyricCharacterFill,
  getDesktopLyricHighlightMode,
  resolveDesktopLyricColors,
  type DesktopLyricsAction,
  type DesktopLyricsColorTheme,
  type DesktopLyricsPlaybackState,
  type DesktopLyricsPreferences
} from "../../../shared/desktopLyrics";
import {
  desktopLyricsTrackChanged,
  projectDesktopLyricsTime,
  reconcileDesktopLyricsTime
} from "../services/desktopLyricsClock";
import {
  getDesktopLyricPlaybackProgress,
  getDesktopLyricScrollProgress
} from "../services/desktopLyricsOverflow";
import { parseLyricContent, splitLyricCharacters } from "../services/lyricParser";
import { findActiveLyricIndex, getLyricCharacterProgress } from "../services/lyricSync";

const playback = ref<DesktopLyricsPlaybackState>({
  ...DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE
});
const renderedCurrentTime = ref(0);
const preferences = ref<DesktopLyricsPreferences>({
  ...DEFAULT_DESKTOP_LYRICS_PREFERENCES
});
const pointerInside = ref(false);
const lockedHotspotVisible = ref(false);
const colorMenuOpen = ref(false);
const colorControl = ref<HTMLElement | null>(null);
const customColorInput = ref<HTMLInputElement | null>(null);
const disposers: Array<() => void> = [];
let clockAnchorTime = 0;
let clockAnchorTimestamp = 0;
let clockFrameId: number | undefined;

const toolbarVisible = computed(() => pointerInside.value && !preferences.value.locked);
const controlsVisible = computed(() => toolbarVisible.value || colorMenuOpen.value || lockedHotspotVisible.value);
const lines = computed(() => parseLyricContent(
  playback.value.lyrics,
  playback.value.lyricsTranslation,
  playback.value.lyricsFormat
));
const phoneticLines = computed(() => parseLyricContent(playback.value.lyricsPhonetic, undefined, "LRC"));
const phoneticByTime = computed(() => new Map(
  phoneticLines.value.map((line) => [line.time.toFixed(3), line.text])
));
const activeIndex = computed(() => findActiveLyricIndex(renderedCurrentTime.value, lines.value));
const characterProgress = computed(() => getLyricCharacterProgress(renderedCurrentTime.value, lines.value));
const lineCharacterCounts = computed(() => lines.value.map((line) => splitLyricCharacters(line.text).length));
const highlightMode = computed(() => getDesktopLyricHighlightMode(playback.value));
const lyricColors = computed(() => resolveDesktopLyricColors(
  preferences.value.lyricColorTheme,
  playback.value.coverAccentColor,
  preferences.value.customPlayedColor,
  preferences.value.customUnplayedColor
));
const displayLines = computed(() => lines.value.length > 0
  ? lines.value
  : [{ time: 0, text: playback.value.title || "暂无歌词" }]);
const visibleLines = computed(() => {
  const currentIndex = activeIndex.value >= 0 ? activeIndex.value : 0;
  const count = preferences.value.lineMode === "single" ? 1 : 2;
  return displayLines.value.slice(currentIndex, currentIndex + count).map((line, offset) => ({
    line,
    index: currentIndex + offset,
    offset
  }));
});
const lyricLineStep = computed(() => {
  const hasTranslation = preferences.value.translationEnabled
    && visibleLines.value.some(({ line }) => Boolean(line.translation));
  const hasPhonetic = preferences.value.phoneticEnabled
    && visibleLines.value.some(({ line }) => Boolean(phoneticByTime.value.get(line.time.toFixed(3))));
  const lineHeightFactor = 1.55 + (hasTranslation ? 0.82 : 0) + (hasPhonetic ? 0.58 : 0);
  return Math.round(preferences.value.fontSize * lineHeightFactor + 12);
});
const shellStyle = computed<Record<string, string>>(() => ({
  "--lyric-played": lyricColors.value.played,
  "--lyric-unplayed": lyricColors.value.unplayed,
  "--lyrics-font-family": `"${preferences.value.fontFamily.replaceAll('"', '')}", sans-serif`,
  "--lyrics-font-weight": preferences.value.fontWeight === "bold" ? "800" : "400",
  "--lyrics-corner-radius": `${preferences.value.cornerRadius}px`,
  "--lyrics-panel-background": `rgb(19 21 25 / ${Math.round(preferences.value.panelOpacity * 100)}%)`
}));

const lyricColorThemes: Array<{ id: DesktopLyricsColorTheme; label: string }> = [
  { id: "cover", label: "封面强调色" },
  { id: "sunset", label: "落日晖" },
  { id: "twilight", label: "Twilight" },
  { id: "warm", label: "暖白" },
  { id: "custom", label: "自定义" }
];

function emitAction(action: DesktopLyricsAction) {
  window.listenMusic?.sendDesktopLyricsAction(action);
}

function syncRenderedCurrentTime(currentTime: number, allowRewind = false) {
  const nextTime = reconcileDesktopLyricsTime(
    renderedCurrentTime.value,
    currentTime,
    playback.value.isPlaying,
    allowRewind
  );
  clockAnchorTime = nextTime;
  clockAnchorTimestamp = performance.now();
  renderedCurrentTime.value = nextTime;
}

function stopLyricsClock() {
  if (clockFrameId === undefined) return;
  window.cancelAnimationFrame(clockFrameId);
  clockFrameId = undefined;
}

function tickLyricsClock(timestamp: number) {
  clockFrameId = undefined;
  renderedCurrentTime.value = projectDesktopLyricsTime(
    clockAnchorTime,
    clockAnchorTimestamp,
    timestamp,
    playback.value.isPlaying
  );
  if (playback.value.isPlaying) {
    clockFrameId = window.requestAnimationFrame(tickLyricsClock);
  }
}

function startLyricsClock() {
  if (clockFrameId === undefined && playback.value.isPlaying) {
    clockFrameId = window.requestAnimationFrame(tickLyricsClock);
  }
}

function applyPlaybackState(state: DesktopLyricsPlaybackState) {
  const trackChanged = desktopLyricsTrackChanged(playback.value, state);
  playback.value = { ...DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE, ...state };
  if (!trackChanged && playback.value.currentTime < renderedCurrentTime.value) {
    playback.value.currentTime = renderedCurrentTime.value;
  }
  syncRenderedCurrentTime(playback.value.currentTime, trackChanged);
  if (playback.value.isPlaying) {
    startLyricsClock();
  } else {
    stopLyricsClock();
  }
}

function closeDesktopLyrics() {
  void window.listenMusic?.closeDesktopLyricsWindow();
}

function unlockDesktopLyrics() {
  lockedHotspotVisible.value = false;
  void patchPreferences({ locked: false });
}

async function patchPreferences(patch: Partial<DesktopLyricsPreferences>) {
  const updated = await window.listenMusic?.updateDesktopLyricsPreferences(patch);
  if (updated) preferences.value = updated;
}

function changeFontSize(step: number) {
  const next = Math.max(
    MIN_DESKTOP_LYRICS_FONT_SIZE,
    Math.min(MAX_DESKTOP_LYRICS_FONT_SIZE, preferences.value.fontSize + step)
  );
  void patchPreferences({ fontSize: next });
}

function toggleColorMenu() {
  colorMenuOpen.value = !colorMenuOpen.value;
}

function selectColorTheme(theme: DesktopLyricsColorTheme) {
  if (theme === "custom") {
    customColorInput.value?.click();
    return;
  }
  colorMenuOpen.value = false;
  void patchPreferences({ lyricColorTheme: theme });
}

function applyCustomColor(event: Event) {
  const color = (event.target as HTMLInputElement).value;
  colorMenuOpen.value = false;
  void patchPreferences({ lyricColorTheme: "custom", customPlayedColor: color });
}

function themeSwatch(theme: DesktopLyricsColorTheme) {
  return resolveDesktopLyricColors(
    theme,
    playback.value.coverAccentColor,
    preferences.value.customPlayedColor,
    preferences.value.customUnplayedColor
  ).played;
}

function closeColorMenuOutside(event: PointerEvent) {
  if (!colorControl.value?.contains(event.target as Node)) {
    colorMenuOpen.value = false;
  }
}

function characterStyle(index: number, lineIndex: number) {
  const progress = lineIndex === activeIndex.value ? characterProgress.value : 0;
  const fill = getDesktopLyricCharacterFill(progress, index) * 100;
  return { "--character-fill": `${fill}%` };
}

function lineCharacters(text: string) {
  return splitLyricCharacters(text);
}

function phoneticFor(time: number) {
  return phoneticByTime.value.get(time.toFixed(3)) ?? "";
}

const activeLyricFlowStyle = computed<Record<string, string>>(() => {
  const lineIndex = activeIndex.value;
  const line = lines.value[lineIndex];
  if (!line) return {} as Record<string, string>;
  const characterCount = lineCharacterCounts.value[lineIndex] ?? 0;
  const estimatedEnd = line.time + Math.max(4, Math.min(12, characterCount * 0.32));
  const endTime = line.duration && line.duration > 0
    ? line.time + line.duration
    : Math.min(lines.value[lineIndex + 1]?.time ?? estimatedEnd, estimatedEnd);
  const useCharacterProgress = highlightMode.value === "word" && Boolean(line.characters?.length || line.characterTimes?.length);
  const playbackProgress = getDesktopLyricPlaybackProgress(
    renderedCurrentTime.value,
    line.time,
    endTime,
    useCharacterProgress ? characterProgress.value : undefined,
    useCharacterProgress ? characterCount : undefined
  );
  const scrollProgress = getDesktopLyricScrollProgress(playbackProgress, preferences.value.animationEnabled) * 100;
  return {
    "--lyric-scroll-viewport-offset": `${scrollProgress}cqw`,
    "--lyric-scroll-content-offset": `${scrollProgress}%`
  };
});

function lyricFlowStyle(lineIndex: number) {
  if (lineIndex !== activeIndex.value) {
    return {
      "--lyric-scroll-viewport-offset": "0cqw",
      "--lyric-scroll-content-offset": "0%"
    };
  }
  return activeLyricFlowStyle.value;
}

function lyricSlotStyle(offset: number) {
  const centeredOffset = preferences.value.lineMode === "double" && visibleLines.value.length > 1
    ? offset - 0.5
    : 0;
  return {
    "--lyric-slot-y": `${centeredOffset * lyricLineStep.value}px`,
    "--lyric-line-step": `${lyricLineStep.value}px`
  };
}

watch(pointerInside, (inside) => {
  if (!inside) colorMenuOpen.value = false;
});

onMounted(() => {
  document.addEventListener("pointerdown", closeColorMenuOutside);
  const bridge = window.listenMusic;
  if (!bridge) return;
  disposers.push(
    bridge.onDesktopLyricsPlaybackState((state) => {
      applyPlaybackState(state);
    }),
    bridge.onDesktopLyricsTime((currentTime, allowRewind) => {
      playback.value.currentTime = currentTime;
      syncRenderedCurrentTime(currentTime, allowRewind);
      startLyricsClock();
    }),
    bridge.onDesktopLyricsPreferences((next) => {
      preferences.value = next;
      lockedHotspotVisible.value = false;
    }),
    bridge.onDesktopLyricsHoverState((inside) => {
      pointerInside.value = inside;
    }),
    bridge.onDesktopLyricsUnlockHotspot((active) => {
      lockedHotspotVisible.value = preferences.value.locked && active;
    })
  );
  void bridge.getDesktopLyricsSnapshot().then((snapshot) => {
    if (!snapshot) return;
    applyPlaybackState(snapshot.playback);
    preferences.value = snapshot.preferences;
  });
});

onBeforeUnmount(() => {
  stopLyricsClock();
  document.removeEventListener("pointerdown", closeColorMenuOutside);
  disposers.splice(0).forEach((dispose) => dispose());
});
</script>

<template>
  <main
    class="desktop-lyrics-shell"
    :class="{
      interactive: controlsVisible,
      locked: preferences.locked,
      stroked: preferences.strokeEnabled,
      'align-left': preferences.textAlign === 'left',
      'align-right': preferences.textAlign === 'right',
      'shadow-disabled': !preferences.shadowEnabled,
      'animation-disabled': !preferences.animationEnabled,
      'word-highlight': highlightMode === 'word',
      'line-highlight': highlightMode === 'line'
    }"
    :style="shellStyle"
  >
    <nav
      v-if="!preferences.locked"
      class="desktop-lyrics-toolbar"
      :class="{ visible: toolbarVisible }"
      aria-label="桌面歌词控制栏"
    >
      <button data-control="previous" type="button" title="上一首" aria-label="上一首" @click="emitAction('previous')">
        <SkipBack :size="17" />
      </button>
      <button
        data-control="toggle"
        type="button"
        :title="playback.isPlaying ? '暂停' : '播放'"
        :aria-label="playback.isPlaying ? '暂停' : '播放'"
        @click="emitAction('toggle')"
      >
        <Pause v-if="playback.isPlaying" :size="17" />
        <Play v-else :size="17" />
      </button>
      <button data-control="next" type="button" title="下一首" aria-label="下一首" @click="emitAction('next')">
        <SkipForward :size="17" />
      </button>
      <button
        data-control="decrease-font"
        type="button"
        title="减小字号"
        aria-label="减小字号"
        :disabled="preferences.fontSize <= MIN_DESKTOP_LYRICS_FONT_SIZE"
        @click="changeFontSize(-2)"
      >A−</button>
      <button
        data-control="increase-font"
        type="button"
        title="增大字号"
        aria-label="增大字号"
        :disabled="preferences.fontSize >= MAX_DESKTOP_LYRICS_FONT_SIZE"
        @click="changeFontSize(2)"
      >A+</button>
      <div ref="colorControl" class="desktop-lyrics-color-control">
        <button
          data-control="lyric-color"
          type="button"
          title="歌词配色"
          aria-label="歌词配色"
          :aria-expanded="colorMenuOpen"
          :class="{ active: colorMenuOpen }"
          @click.stop="toggleColorMenu"
        >
          <Palette :size="17" />
        </button>
        <div v-if="colorMenuOpen" class="desktop-lyrics-color-menu" role="menu" aria-label="歌词配色">
          <button
            v-for="theme in lyricColorThemes"
            :key="theme.id"
            type="button"
            role="menuitemradio"
            :aria-checked="preferences.lyricColorTheme === theme.id"
            :class="{ selected: preferences.lyricColorTheme === theme.id }"
            @click.stop="selectColorTheme(theme.id)"
          >
            <span class="desktop-lyrics-color-swatch" :style="{ background: themeSwatch(theme.id) }" />
            <span>{{ theme.label }}</span>
          </button>
          <input
            ref="customColorInput"
            class="desktop-lyrics-color-input"
            type="color"
            :value="preferences.customPlayedColor"
            aria-label="选择自定义歌词颜色"
            @input="applyCustomColor"
          >
        </div>
      </div>
      <button
        data-control="translation"
        type="button"
        :class="{ active: preferences.translationEnabled }"
        :title="preferences.translationEnabled ? '隐藏翻译' : '显示翻译'"
        :aria-label="preferences.translationEnabled ? '隐藏翻译' : '显示翻译'"
        @click="patchPreferences({ translationEnabled: !preferences.translationEnabled })"
      >
        <Languages :size="17" />
      </button>
      <button
        data-control="lock"
        type="button"
        title="锁定桌面歌词"
        aria-label="锁定桌面歌词"
        @click="patchPreferences({ locked: true })"
      >
        <LockKeyhole :size="17" />
      </button>
      <button
        data-control="close"
        type="button"
        title="关闭桌面歌词"
        aria-label="关闭桌面歌词"
        @click="closeDesktopLyrics"
      >
        <X :size="17" />
      </button>
    </nav>

    <nav
      v-else
      class="desktop-lyrics-unlock"
      :class="{ visible: lockedHotspotVisible }"
      aria-label="桌面歌词解锁栏"
    >
      <button
        data-control="unlock"
        type="button"
        title="解锁桌面歌词"
        aria-label="解锁桌面歌词"
        @click="unlockDesktopLyrics"
      >
        <LockOpen :size="16" />
        <span>解锁</span>
      </button>
    </nav>

    <section class="desktop-lyrics-viewport" aria-live="off">
      <TransitionGroup
        name="desktop-lyric-slide"
        move-class="desktop-lyric-slide-no-flip"
        tag="div"
        class="desktop-lyrics-track"
      >
        <div
          v-for="item in visibleLines"
          :key="`${item.line.time}-${item.index}-${item.line.text}`"
          class="desktop-lyric-slot"
          :style="lyricSlotStyle(item.offset)"
        >
          <div
            class="desktop-lyric-line"
            :class="{ active: item.index === activeIndex || (lines.length === 0 && item.index === 0) }"
            :data-lyric-index="item.index"
            :style="{ fontSize: `${preferences.fontSize}px` }"
          >
            <p class="desktop-lyric-original desktop-lyric-flow-viewport">
              <span class="desktop-lyric-flow" :style="lyricFlowStyle(item.index)">
                <template v-if="highlightMode === 'word' && item.line.characters?.length">
                  <span
                    v-for="(character, characterIndex) in lineCharacters(item.line.text)"
                    :key="`${characterIndex}-${character}`"
                    class="desktop-lyric-character"
                    :style="characterStyle(characterIndex, item.index)"
                  >{{ character }}</span>
                </template>
                <template v-else>{{ item.line.text }}</template>
              </span>
            </p>
            <p
              v-if="preferences.phoneticEnabled && phoneticFor(item.line.time)"
              class="desktop-lyric-phonetic desktop-lyric-flow-viewport"
            >
              <span class="desktop-lyric-flow" :style="lyricFlowStyle(item.index)">{{ phoneticFor(item.line.time) }}</span>
            </p>
            <p v-if="preferences.translationEnabled && item.line.translation" class="desktop-lyric-translation desktop-lyric-flow-viewport">
              <span class="desktop-lyric-flow" :style="lyricFlowStyle(item.index)">{{ item.line.translation }}</span>
            </p>
          </div>
        </div>
      </TransitionGroup>
    </section>
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}

:global(*) {
  box-sizing: border-box;
}

.desktop-lyrics-shell {
  --lyrics-font-family: "Microsoft YaHei UI", sans-serif;
  --lyrics-font-weight: 400;
  --lyrics-corner-radius: 18px;
  --lyrics-panel-background: rgb(19 21 25 / 72%);
  --lyric-played: #5b8cff;
  --lyric-unplayed: #fff;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #fff;
  font-family: var(--lyrics-font-family, "Microsoft YaHei UI", sans-serif);
  font-synthesis: weight;
  background: rgb(0 0 0 / 1%);
  border: 1px solid transparent;
  border-radius: var(--lyrics-corner-radius);
  box-shadow: none;
  transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  -webkit-app-region: no-drag;
}

.desktop-lyrics-shell.interactive {
  background: var(--lyrics-panel-background);
  border-color: rgb(255 255 255 / 14%);
  box-shadow: 0 16px 38px rgb(0 0 0 / 24%);
  backdrop-filter: blur(20px) saturate(125%);
}

.desktop-lyrics-shell.interactive.shadow-disabled {
  box-shadow: none;
}

.desktop-lyrics-toolbar {
  position: absolute;
  z-index: 3;
  top: 8px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  background: rgb(13 15 19 / 92%);
  box-shadow: 0 8px 22px rgb(0 0 0 / 24%);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -8px);
  transition: opacity 160ms ease, transform 160ms ease;
  -webkit-app-region: no-drag;
}

.desktop-lyrics-toolbar * {
  -webkit-app-region: no-drag;
}

.desktop-lyrics-unlock {
  position: absolute;
  z-index: 4;
  top: 3px;
  left: 50%;
  padding: 3px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 7px;
  background: rgb(13 15 19 / 92%);
  box-shadow: 0 6px 18px rgb(0 0 0 / 24%);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -5px);
  transition: opacity 140ms ease, transform 140ms ease;
  -webkit-app-region: no-drag;
}

.desktop-lyrics-unlock.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.desktop-lyrics-unlock button {
  display: flex;
  height: 26px;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  color: rgb(255 255 255 / 82%);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}

.desktop-lyrics-unlock button:hover {
  color: #fff;
  background: rgb(255 255 255 / 12%);
}

.desktop-lyrics-toolbar.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.desktop-lyrics-toolbar button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  padding: 0;
  color: rgb(255 255 255 / 78%);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  -webkit-app-region: no-drag;
}

.desktop-lyrics-toolbar button:hover,
.desktop-lyrics-toolbar button.active {
  color: #fff;
  background: rgb(255 255 255 / 12%);
}

.desktop-lyrics-toolbar button:disabled {
  opacity: 0.35;
  cursor: default;
}

.desktop-lyrics-color-control {
  position: relative;
  display: grid;
  place-items: center;
  -webkit-app-region: no-drag;
}

.desktop-lyrics-color-menu {
  position: absolute;
  z-index: 5;
  top: 36px;
  left: 50%;
  display: grid;
  width: 144px;
  gap: 2px;
  padding: 5px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 7px;
  background: rgb(22 24 29 / 97%);
  box-shadow: 0 12px 28px rgb(0 0 0 / 32%);
  transform: translateX(-50%);
  -webkit-app-region: no-drag;
}

.desktop-lyrics-toolbar .desktop-lyrics-color-menu button {
  display: grid;
  width: 100%;
  height: 27px;
  grid-template-columns: 14px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  color: rgb(255 255 255 / 76%);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}

.desktop-lyrics-toolbar .desktop-lyrics-color-menu button:hover,
.desktop-lyrics-toolbar .desktop-lyrics-color-menu button.selected {
  color: #fff;
  background: rgb(255 255 255 / 11%);
}

.desktop-lyrics-color-swatch {
  width: 11px;
  height: 11px;
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 14%);
}

.desktop-lyrics-color-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.desktop-lyrics-viewport {
  height: 100%;
  overflow: hidden;
  padding: 55px 42px 34px;
}

.desktop-lyrics-track {
  position: relative;
  height: 100%;
}

.desktop-lyric-slot {
  --lyric-slot-y: 0px;
  --lyric-line-step: 60px;
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  width: 100%;
  transform: translate3d(0, calc(-50% + var(--lyric-slot-y)), 0);
  backface-visibility: hidden;
  transition:
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 360ms ease;
  will-change: transform, opacity;
}

.desktop-lyric-slide-enter-active,
.desktop-lyric-slide-leave-active {
  transition:
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 360ms ease;
}

.desktop-lyric-slide-no-flip {
  transition: none !important;
}

.desktop-lyric-slide-enter-from {
  opacity: 0;
  transform: translate3d(0, calc(-50% + var(--lyric-slot-y) + var(--lyric-line-step)), 0);
}

.desktop-lyric-slide-leave-to {
  opacity: 0;
  transform: translate3d(0, calc(-50% + var(--lyric-slot-y) - var(--lyric-line-step)), 0);
}

.desktop-lyrics-shell:not(.locked) {
  -webkit-app-region: drag;
}

.desktop-lyrics-shell.locked {
  -webkit-app-region: no-drag;
}

.desktop-lyric-line {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--lyric-unplayed);
  opacity: 0.54;
  transform: scale(0.92);
  transition: color 180ms ease, opacity 180ms ease, transform 180ms ease;
}

.desktop-lyric-line.active {
  color: var(--lyric-unplayed);
  opacity: 1;
  transform: scale(1);
}

.desktop-lyrics-shell.line-highlight .desktop-lyric-line.active .desktop-lyric-original {
  color: var(--lyric-played);
}

.desktop-lyrics-shell.align-left .desktop-lyric-line {
  align-items: flex-start;
  text-align: left;
}

.desktop-lyrics-shell.align-right .desktop-lyric-line {
  align-items: flex-end;
  text-align: right;
}

.desktop-lyric-original,
.desktop-lyric-phonetic,
.desktop-lyric-translation {
  width: 100%;
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  letter-spacing: 0;
  font-weight: var(--lyrics-font-weight);
  text-shadow: 0 2px 8px rgb(0 0 0 / 52%);
}

.desktop-lyric-flow-viewport {
  container-type: inline-size;
  overflow: hidden;
}

.desktop-lyric-flow {
  --lyric-viewport-width: 100cqw;
  --lyric-content-width: 100%;
  --lyric-scroll-viewport-offset: 0cqw;
  --lyric-scroll-content-offset: 0%;
  display: block;
  width: max-content;
  min-width: max-content;
  transform: translate3d(
    calc(
      max(0px, calc(50cqw - 50%))
      + min(0px, calc(var(--lyric-scroll-viewport-offset) - var(--lyric-scroll-content-offset)))
    ),
    0,
    0
  );
  will-change: transform;
}

.desktop-lyrics-shell.align-left .desktop-lyric-flow {
  transform: translate3d(
    min(0px, calc(var(--lyric-scroll-viewport-offset) - var(--lyric-scroll-content-offset))),
    0,
    0
  );
}

.desktop-lyrics-shell.align-right .desktop-lyric-flow {
  transform: translate3d(
    calc(
      max(0px, calc(100cqw - 100%))
      + min(0px, calc(var(--lyric-scroll-viewport-offset) - var(--lyric-scroll-content-offset)))
    ),
    0,
    0
  );
}

.desktop-lyric-line:not(.active) .desktop-lyric-flow {
  width: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: none;
}

.desktop-lyric-original {
  line-height: 1.35;
}

.desktop-lyrics-shell.stroked .desktop-lyric-original {
  -webkit-text-stroke: 0.55px rgb(0 0 0 / 56%);
  paint-order: stroke fill;
}

.desktop-lyric-phonetic,
.desktop-lyric-translation {
  margin-top: 5px;
  color: var(--lyric-unplayed);
  font-size: 0.62em;
  line-height: 1.4;
  opacity: 0.76;
}

.desktop-lyric-phonetic {
  font-size: 0.46em;
  opacity: 0.64;
}

.desktop-lyric-character {
  --character-fill: 0%;
  color: transparent;
  background: linear-gradient(
    90deg,
    var(--lyric-played) 0,
    color-mix(in srgb, var(--lyric-played) 72%, white) var(--character-fill),
    var(--lyric-unplayed) var(--character-fill),
    var(--lyric-unplayed) 100%
  );
  background-clip: text;
  -webkit-background-clip: text;
}

.desktop-lyrics-shell.animation-disabled,
.desktop-lyrics-shell.animation-disabled * {
  scroll-behavior: auto !important;
  transition: none !important;
}

@media (max-height: 180px) {
  .desktop-lyrics-color-menu {
    top: 32px;
    width: 236px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 4px;
  }

  .desktop-lyrics-toolbar .desktop-lyrics-color-menu button {
    height: 24px;
  }
}
</style>
