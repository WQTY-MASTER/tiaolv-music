<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  Languages,
  LockKeyhole,
  Pause,
  Play,
  Repeat2,
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
  type DesktopLyricsAction,
  type DesktopLyricsPlaybackState,
  type DesktopLyricsPreferences
} from "../../../shared/desktopLyrics";
import { parseLyricContent, splitLyricCharacters } from "../services/lyricParser";
import { findActiveLyricIndex, getLyricCharacterProgress } from "../services/lyricSync";

const playback = ref<DesktopLyricsPlaybackState>({
  ...DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE
});
const preferences = ref<DesktopLyricsPreferences>({
  ...DEFAULT_DESKTOP_LYRICS_PREFERENCES
});
const pointerInside = ref(false);
const lyricViewport = ref<HTMLElement | null>(null);
const disposers: Array<() => void> = [];

const toolbarVisible = computed(() => pointerInside.value && !preferences.value.locked);
const lines = computed(() => parseLyricContent(
  playback.value.lyrics,
  playback.value.lyricsTranslation,
  playback.value.lyricsFormat
));
const activeIndex = computed(() => findActiveLyricIndex(playback.value.currentTime, lines.value));
const characterProgress = computed(() => getLyricCharacterProgress(playback.value.currentTime, lines.value));
const displayLines = computed(() => lines.value.length > 0
  ? lines.value
  : [{ time: 0, text: playback.value.title || "暂无歌词" }]);

const playModeTitle = computed(() => ({
  sequence: "顺序播放",
  loop: "列表循环",
  single: "单曲循环",
  shuffle: "随机播放"
})[playback.value.playMode]);

function emitAction(action: DesktopLyricsAction) {
  window.listenMusic?.sendDesktopLyricsAction(action);
}

function closeDesktopLyrics() {
  void window.listenMusic?.closeDesktopLyricsWindow();
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

function characterStyle(index: number) {
  const fill = getDesktopLyricCharacterFill(characterProgress.value, index) * 100;
  return { "--character-fill": `${fill}%` };
}

function lineCharacters(text: string) {
  return splitLyricCharacters(text);
}

async function scrollToActiveLine() {
  await nextTick();
  const index = activeIndex.value >= 0 ? activeIndex.value : 0;
  lyricViewport.value
    ?.querySelector<HTMLElement>(`[data-lyric-index="${index}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

watch([activeIndex, () => playback.value.title], scrollToActiveLine);

onMounted(() => {
  const bridge = window.listenMusic;
  if (!bridge) return;
  disposers.push(
    bridge.onDesktopLyricsPlaybackState((state) => {
      playback.value = { ...DEFAULT_DESKTOP_LYRICS_PLAYBACK_STATE, ...state };
    }),
    bridge.onDesktopLyricsTime((currentTime) => {
      playback.value.currentTime = currentTime;
    }),
    bridge.onDesktopLyricsPreferences((next) => {
      preferences.value = next;
      if (next.locked) pointerInside.value = false;
    })
  );
  void bridge.getDesktopLyricsSnapshot().then((snapshot) => {
    if (!snapshot) return;
    playback.value = snapshot.playback;
    preferences.value = snapshot.preferences;
  });
});

onBeforeUnmount(() => {
  disposers.splice(0).forEach((dispose) => dispose());
});
</script>

<template>
  <main
    class="desktop-lyrics-shell"
    :class="{ interactive: toolbarVisible, locked: preferences.locked }"
    @pointerenter="pointerInside = true"
    @pointerleave="pointerInside = false"
  >
    <nav class="desktop-lyrics-toolbar" :class="{ visible: toolbarVisible }" aria-label="桌面歌词控制栏">
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
      <button
        data-control="cycle-mode"
        type="button"
        :title="playModeTitle"
        :aria-label="playModeTitle"
        @click="emitAction('cycle-mode')"
      >
        <Repeat2 :size="17" />
      </button>
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

    <section ref="lyricViewport" class="desktop-lyrics-viewport" aria-live="off">
      <div
        v-for="(line, index) in displayLines"
        :key="`${line.time}-${index}-${line.text}`"
        class="desktop-lyric-line"
        :class="{ active: index === activeIndex || (lines.length === 0 && index === 0) }"
        :data-lyric-index="index"
        :style="{ fontSize: `${preferences.fontSize}px` }"
      >
        <p class="desktop-lyric-original">
          <template v-if="index === activeIndex && line.characters?.length">
            <span
              v-for="(character, characterIndex) in lineCharacters(line.text)"
              :key="`${characterIndex}-${character}`"
              class="desktop-lyric-character"
              :style="characterStyle(characterIndex)"
            >{{ character }}</span>
          </template>
          <template v-else>{{ line.text }}</template>
        </p>
        <p v-if="preferences.translationEnabled && line.translation" class="desktop-lyric-translation">
          {{ line.translation }}
        </p>
      </div>
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
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #fff;
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 18px;
  box-shadow: none;
  transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  -webkit-app-region: no-drag;
}

.desktop-lyrics-shell.interactive {
  background: rgb(19 21 25 / 72%);
  border-color: rgb(255 255 255 / 14%);
  box-shadow: 0 16px 38px rgb(0 0 0 / 24%);
  backdrop-filter: blur(20px) saturate(125%);
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
  -webkit-app-region: drag;
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
  font: 600 13px/1 inherit;
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

.desktop-lyrics-viewport {
  height: 100%;
  overflow: hidden;
  padding: 55px 42px 34px;
  scroll-behavior: smooth;
}

.desktop-lyric-line {
  display: flex;
  min-height: 68%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgb(255 255 255 / 34%);
  opacity: 0.58;
  transform: scale(0.88);
  transition: color 180ms ease, opacity 180ms ease, transform 180ms ease;
}

.desktop-lyric-line.active {
  color: rgb(255 255 255 / 76%);
  opacity: 1;
  transform: scale(1);
}

.desktop-lyric-original,
.desktop-lyric-translation {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
  text-shadow: 0 2px 8px rgb(0 0 0 / 52%);
}

.desktop-lyric-original {
  font-weight: 650;
  line-height: 1.35;
}

.desktop-lyric-translation {
  margin-top: 7px;
  color: rgb(255 255 255 / 62%);
  font-size: 0.52em;
  font-weight: 500;
  line-height: 1.4;
}

.desktop-lyric-character {
  color: transparent;
  background: linear-gradient(
    90deg,
    #ff8f98 0,
    #ffd0d4 var(--character-fill),
    rgb(255 255 255 / 78%) var(--character-fill),
    rgb(255 255 255 / 78%) 100%
  );
  background-clip: text;
  -webkit-background-clip: text;
}
</style>
