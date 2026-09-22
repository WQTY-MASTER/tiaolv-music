<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import PlayerControlButton from "./PlayerControlButton.vue";

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  primary: string;
  secondary: string;
  mark: string;
  liked?: boolean;
}

const props = defineProps<{
  track: Track;
  coverUrl?: string;
  duration: number;
  previewProgressLimit: number;
  isPlaying: boolean;
  progress: number;
  volume: number;
  backendConnected: boolean;
  sidebarCollapsed: boolean;
  ambient?: boolean;
  playMode: "shuffle" | "sequence" | "single" | "loop";
}>();

const emit = defineEmits<{
  toggle: [];
  previous: [];
  next: [];
  mode: [];
  seek: [value: number];
  seekStart: [];
  seekEnd: [value: number];
  volume: [value: number];
  like: [];
  queue: [];
  mini: [];
  hifi: [];
  expand: [];
  desktopLyrics: [];
}>();

const volumePanelVisible = ref(false);
const ambientThemeReady = ref(false);
let ambientThemeFrame: number | undefined;

function scheduleAmbientThemeTransition() {
  if (ambientThemeFrame !== undefined) {
    window.cancelAnimationFrame(ambientThemeFrame);
    ambientThemeFrame = undefined;
  }
  ambientThemeReady.value = false;
  if (!props.ambient) {
    return;
  }
  ambientThemeFrame = window.requestAnimationFrame(() => {
    ambientThemeFrame = undefined;
    ambientThemeReady.value = true;
  });
}

onMounted(scheduleAmbientThemeTransition);
watch(() => props.ambient, scheduleAmbientThemeTransition);
onBeforeUnmount(() => {
  if (ambientThemeFrame !== undefined) {
    window.cancelAnimationFrame(ambientThemeFrame);
  }
});

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function emitSeek(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Math.min(Number(input.value), props.previewProgressLimit);
  input.value = String(value);
  emit("seek", value);
}

function emitSeekStart() {
  emit("seek-start");
}

function emitSeekEnd(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Math.min(Number(input.value), props.previewProgressLimit);
  input.value = String(value);
  emit("seek-end", value);
}

function emitVolume(event: Event) {
  emit("volume", Number((event.target as HTMLInputElement).value));
}

function toggleVolumePanel() {
  volumePanelVisible.value = !volumePanelVisible.value;
}

function playModeLabel(mode: "shuffle" | "sequence" | "single" | "loop") {
  return ({
    shuffle: "随机播放",
    sequence: "顺序播放",
    single: "单曲循环",
    loop: "列表循环"
  })[mode];
}
</script>

<template>
  <footer class="player-bar" :class="{ 'is-sidebar-collapsed': props.sidebarCollapsed, 'is-ambient': props.ambient, 'is-theme-ready': ambientThemeReady }">
    <div class="now-playing">
      <button class="cover-expand" type="button" title="展开歌曲详情" aria-label="展开歌曲详情" @click="emit('expand')">
        <span class="mini-cover" :style="{ background: `linear-gradient(135deg, ${props.track.primary}, ${props.track.secondary})` }">
          <img v-if="props.coverUrl" :src="props.coverUrl" :alt="`${props.track.title}封面`" />
          <span v-else aria-hidden="true">{{ props.track.mark }}</span>
        </span>
        <span class="cover-expand-hint" aria-hidden="true"><span>展开歌曲详情</span><b>⤢</b></span>
      </button>
      <div class="track-copy">
        <strong :title="props.track.title">{{ props.track.title }}</strong>
        <span :title="`${props.track.artist} · ${props.track.album}`">{{ props.track.artist }} · {{ props.track.album }}</span>
      </div>
    </div>

    <div class="transport">
      <div class="transport-controls">
        <PlayerControlButton kind="previous" compact @activate="emit('previous')" />
        <PlayerControlButton kind="toggle" :is-playing="props.isPlaying" compact @activate="emit('toggle')" />
        <PlayerControlButton kind="next" compact @activate="emit('next')" />
      </div>
      <div class="progress-row">
        <span
          class="progress-slider-wrap"
          :class="{ 'is-preview': props.previewProgressLimit < 100 }"
          :style="{ '--preview-progress-limit': `${props.previewProgressLimit}%`, '--progress': `${Math.min(props.progress, props.previewProgressLimit)}%` }"
        >
          <input
            class="progress-input"
            :class="{ 'is-preview': props.previewProgressLimit < 100 }"
            type="range"
            min="0"
            max="100"
            step="0.1"
            :value="props.progress"
            aria-label="播放进度"
            @pointerdown="emitSeekStart"
            @keydown="emitSeekStart"
            @input="emitSeek"
            @pointerup="emitSeekEnd"
            @pointercancel="emitSeekEnd"
            @change="emitSeekEnd"
          />
        </span>
        <span class="progress-times"><b>{{ formatTime((props.duration * props.progress) / 100) }}</b><b>{{ formatTime(props.duration) }}</b></span>
      </div>
    </div>

    <div class="player-tools">
      <PlayerControlButton kind="like" :liked="props.track.liked" class="player-tool-button" compact @activate="emit('like')" />
      <button class="player-mode-button player-tool-button tool-button" type="button" :title="playModeLabel(props.playMode)" :aria-label="playModeLabel(props.playMode)" @click="emit('mode')">
        <span class="player-mode-icon" :class="`player-mode-icon-${props.playMode}`" aria-hidden="true"></span>
      </button>
      <div class="player-volume-wrap">
        <button class="player-volume-button player-tool-button" type="button" title="音量" aria-label="音量" :aria-expanded="volumePanelVisible" @click="toggleVolumePanel">
          <span class="player-volume-icon" aria-hidden="true"></span>
        </button>
        <div v-if="volumePanelVisible" class="player-volume-panel" role="dialog" aria-label="音量调节">
          <span class="volume-percent">{{ props.volume }}%</span>
          <span class="volume-slider-rail">
            <input class="player-volume-slider" type="range" min="0" max="100" step="1" :value="props.volume" aria-label="音量" @input="emitVolume" />
          </span>
          <span class="volume-panel-icon" aria-hidden="true"></span>
        </div>
      </div>
      <PlayerControlButton kind="queue" compact class="player-tool-button" @activate="emit('queue')" />
      <button class="player-mini-button player-tool-button tool-button" type="button" title="迷你播放器" aria-label="迷你播放器" @click="emit('mini')">
        <span class="player-mini-icon" aria-hidden="true"></span>
      </button>
      <button class="lyrics-button player-tool-button tool-button" type="button" title="显示歌词" aria-label="显示歌词" @click="emit('desktopLyrics')"><span class="lyrics-icon">词</span></button>
      <button class="player-hifi-button player-tool-button tool-button" type="button" title="HiFi 控制台" aria-label="HiFi 控制台" @click="emit('hifi')">
        <span class="player-hifi-icon" aria-hidden="true"></span>
      </button>
    </div>
  </footer>
</template>

<style scoped>
@property --detail-player-start {
  syntax: "<color>";
  inherits: true;
  initial-value: #f7f9fa;
}

@property --detail-player-end {
  syntax: "<color>";
  inherits: true;
  initial-value: #f3f6f8;
}

.player-bar { --player-bar-height: 68px; position: fixed; right: auto; bottom: 12px; left: calc(224px + (100vw - 224px) / 2); z-index: 20; display: grid; box-sizing: border-box; width: min(1180px, calc(100vw - 224px - 48px)); height: var(--player-bar-height); min-height: var(--player-bar-height); grid-template-columns: minmax(150px,.85fr) minmax(320px,1.5fr) minmax(230px,.85fr); align-items: center; gap: 12px; padding: 5px 15px; border: 0; border-top: 1px solid #edf0f2; border-radius: 20px; background: rgba(255,255,255,.98); box-shadow: 0 -8px 24px rgba(36,43,54,.08); transition: left 280ms ease, width 280ms ease; transform: translateX(-50%); backdrop-filter: blur(14px); }
.player-bar.is-sidebar-collapsed { left: 50%; width: min(1180px, calc(100vw - 48px)); }
.player-bar.is-ambient { background: rgba(255,255,255,.97); }
.now-playing { display: flex; min-width: 0; align-items: center; gap: 12px; }.cover-expand { position: relative; display: grid; width: 46px; height: 46px; flex: 0 0 auto; place-items: center; overflow: hidden; border: 0; border-radius: 7px; padding: 0; background: transparent; cursor: pointer; }.mini-cover { display: grid; width: 46px; height: 46px; place-items: center; overflow: hidden; border-radius: 7px; color: rgba(255,255,255,.92); font-family: Georgia,"Times New Roman",serif; font-size: 18px; font-weight: 700; box-shadow: 0 3px 9px rgba(40,50,52,.12); }.mini-cover img { width: 100%; height: 100%; object-fit: cover; }.cover-expand-hint { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; padding: 4px; background: rgba(21,38,39,.72); color: #fff; font-size: 6px; font-weight: 700; line-height: 1.1; opacity: 0; transition: opacity 160ms ease; }.cover-expand-hint span { align-self: flex-start; max-width: 32px; text-align: left; }.cover-expand-hint b { font-size: 14px; font-weight: 400; line-height: .8; }.cover-expand:hover .cover-expand-hint,.cover-expand:focus-visible .cover-expand-hint { opacity: 1; }.track-copy { display: grid; min-width: 0; gap: 4px; }.track-copy strong,.track-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.track-copy strong { color: #30394d; font-size: 13px; line-height: 1.2; }.track-copy span { color: #8d949f; font-size: 10px; line-height: 1.2; }
.transport { display: grid; min-width: 0; grid-template-rows: 44px 14px; align-items: center; gap: 0; }.transport-controls { display: flex; align-items: center; justify-content: center; gap: 12px; }.transport-controls button { display: grid; width: 30px; height: 30px; flex: 0 0 30px; place-items: center; border: 0; border-radius: 50%; padding: 0; background: transparent; color: #777b82; cursor: pointer; font-size: 12px; transition: color 160ms ease,background-color 160ms ease,transform 160ms ease; }.transport-controls button:hover { background: #f3f1f8; color: #68369a; transform: translateY(-1px); }.transport-controls .player-control-button.play-button.compact { display: grid; width: 44px; height: 44px; flex-basis: 44px; place-items: center; border: 0; border-radius: 50%; background: #68369a; color: #fff; box-shadow: 0 6px 15px rgba(104,54,154,.22); }.transport-controls .play-button:hover { background: #572985; color: #fff; box-shadow: 0 7px 17px rgba(87,41,133,.26); }.play-icon { width: 0; height: 0; margin-left: 3px; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 9px solid currentColor; }.pause-icon { width: 8px; height: 12px; border-right: 2px solid currentColor; border-left: 2px solid currentColor; }.transport-icon { display: block; width: 15px; height: 15px; background: currentColor; -webkit-mask: center / contain no-repeat; mask: center / contain no-repeat; }.transport-icon-previous { -webkit-mask-image: url("../assets/icons/previous.svg"); mask-image: url("../assets/icons/previous.svg"); }.transport-icon-next { -webkit-mask-image: url("../assets/icons/next.svg"); mask-image: url("../assets/icons/next.svg"); }
.progress-row { display: grid; width: min(100%,540px); min-width: 0; grid-template-columns: 34px minmax(0,1fr) 34px; align-items: center; gap: 8px; margin: 0 auto; color: #9297a0; font-size: 9px; text-align: center; }.progress-times { display: contents; }.progress-times b { color: #9297a0; font-size: 9px; font-weight: 500; line-height: 1; }.progress-times b:first-child { grid-column: 1; grid-row: 1; text-align: right; }.progress-times b:last-child { grid-column: 3; grid-row: 1; text-align: left; }.progress-slider-wrap { position: relative; display: block; min-width: 0; grid-column: 2; grid-row: 1; }.progress-input { display: block; width: 100%; height: 10px; margin: 0; appearance: none; background: transparent; accent-color: #14a88d; cursor: pointer; }.progress-input::-webkit-slider-runnable-track { height: 4px; border-radius: 999px; background: linear-gradient(90deg, #2f6df6 0%, #14a88d var(--progress), #dfe6ef var(--progress) 100%); }.progress-input::-webkit-slider-thumb { width: 8px; height: 8px; margin-top: -2px; appearance: none; border: 0; border-radius: 50%; background: transparent; box-shadow: none; }.progress-input::-moz-range-track { height: 4px; border-radius: 999px; background: linear-gradient(90deg, #2f6df6 0%, #14a88d var(--progress), #dfe6ef var(--progress) 100%); }.progress-input::-moz-range-thumb { width: 8px; height: 8px; border: 0; border-radius: 50%; background: transparent; box-shadow: none; }
.progress-input.is-preview::-webkit-slider-runnable-track { background: linear-gradient(90deg, #2f6df6 0%, #14a88d var(--progress), #dfe6ef var(--progress) var(--preview-progress-limit), #d7e5e7 var(--preview-progress-limit) 100%); }
.progress-input.is-preview::-moz-range-track { background: linear-gradient(90deg, #2f6df6 0%, #14a88d var(--progress), #dfe6ef var(--progress) var(--preview-progress-limit), #d7e5e7 var(--preview-progress-limit) 100%); }
.player-tools { --player-tool-button-size: 36px; --player-tool-icon-size: 18px; display: flex; min-width: 0; align-items: center; justify-content: flex-end; gap: 4px; }
.player-tools :deep(.player-tool-button) { display: grid; width: var(--player-tool-button-size); height: var(--player-tool-button-size); flex: 0 0 var(--player-tool-button-size); place-items: center; box-sizing: border-box; border: 0; border-radius: 50%; padding: 0; background: transparent; color: #777b82; cursor: pointer; font: inherit; line-height: 1; text-align: center; transition: color 160ms ease,background-color 160ms ease,transform 160ms ease; }
.player-tools :deep(.player-tool-button:hover) { background: #f3f1f8; color: #68369a; transform: translateY(-1px); }
.player-tools :deep(.player-tool-button:active) { background: #e9e4f1; transform: translateY(0) scale(.96); }
.player-tools :deep(.player-tool-button:focus-visible) { outline: 2px solid rgba(104,54,154,.35); outline-offset: 1px; }
.player-tools :deep(.player-like-icon),.player-tools :deep(.player-queue-icon),.player-mode-icon,.player-volume-icon,.player-mini-icon,.lyrics-icon,.player-hifi-icon { box-sizing: border-box; width: var(--player-tool-icon-size); height: var(--player-tool-icon-size); flex: 0 0 var(--player-tool-icon-size); }
.tool-button { color: #777b82; }.lyrics-icon { display: grid; place-items: center; border: 1px solid currentColor; border-radius: 3px; font-size: 10px; font-weight: 700; line-height: 1; }.player-tools :deep(.player-like-icon) { font-size: 18px; }.player-like-button.liked { color: #ff6570; }.player-mode-icon,.player-tools :deep(.player-queue-icon) { display: block; background: currentColor; -webkit-mask: center / contain no-repeat; mask: center / contain no-repeat; }.player-mode-icon-shuffle { -webkit-mask-image: url("../assets/icons/shuffle-line.svg"); mask-image: url("../assets/icons/shuffle-line.svg"); }.player-mode-icon-sequence { -webkit-mask-image: url("../assets/icons/list-order.svg"); mask-image: url("../assets/icons/list-order.svg"); }.player-mode-icon-single { -webkit-mask-image: url("../assets/icons/repeat-one-line.svg"); mask-image: url("../assets/icons/repeat-one-line.svg"); }.player-mode-icon-loop { -webkit-mask-image: url("../assets/icons/repeat.svg"); mask-image: url("../assets/icons/repeat.svg"); }.player-tools :deep(.player-queue-icon) { -webkit-mask-image: url("../assets/icons/play-list-2-fill.svg"); mask-image: url("../assets/icons/play-list-2-fill.svg"); }.player-mini-icon { position: relative; display: block; border: 1.4px solid currentColor; border-radius: 3px; }.player-mini-icon::after { position: absolute; right: 2px; bottom: 2px; width: 6px; height: 1.5px; border-radius: 999px; background: currentColor; content: ""; }.player-hifi-icon { position: relative; display: block; }.player-hifi-icon::before,.player-hifi-icon::after { position: absolute; inset: 2px auto 2px 3px; width: 1.5px; border-radius: 999px; background: currentColor; box-shadow: 5px 4px 0 currentColor, 10px -2px 0 currentColor; content: ""; }.player-hifi-icon::after { inset: 9px auto auto 1px; width: 5px; height: 1.5px; box-shadow: 5px -4px 0 currentColor, 10px 2px 0 currentColor; }.player-volume-wrap { position: relative; display: grid; width: var(--player-tool-button-size); height: var(--player-tool-button-size); flex: 0 0 var(--player-tool-button-size); place-items: center; }.player-volume-icon { display: block; background: currentColor; -webkit-mask: url("../assets/icons/volume-down-line.svg") center / contain no-repeat; mask: url("../assets/icons/volume-down-line.svg") center / contain no-repeat; }.player-volume-panel { position: absolute; right: -12px; bottom: calc(100% + 12px); z-index: 25; display: grid; min-width: 68px; justify-items: center; gap: 9px; padding: 12px 11px 10px; border: 1px solid #e6ece9; border-radius: 10px; background: rgba(255,255,255,.98); box-shadow: 0 11px 24px rgba(34,48,43,.18); }.player-volume-panel::after { position: absolute; right: 22px; bottom: -7px; width: 12px; height: 12px; border-right: 1px solid #e6ece9; border-bottom: 1px solid #e6ece9; background: #fff; content: ""; transform: rotate(45deg); }.volume-percent { color: #52605b; font-size: 10px; }.volume-slider-rail { display: grid; width: 22px; height: 112px; place-items: center; }.player-volume-slider { width: 112px; height: 22px; accent-color: #68369a; cursor: pointer; transform: rotate(-90deg); }.volume-panel-icon { display: block; width: 18px; height: 18px; background: #697174; -webkit-mask: url("../assets/icons/volume-down-line.svg") center / contain no-repeat; mask: url("../assets/icons/volume-down-line.svg") center / contain no-repeat; }

.player-bar {
  overflow: hidden;
  isolation: isolate;
  transition:
    left 280ms ease,
    width 280ms ease,
    border-color 400ms ease,
    box-shadow 400ms ease,
    --detail-player-start 400ms ease,
    --detail-player-end 400ms ease;
}

.player-bar::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: transparent;
  content: "";
  opacity: 0;
  pointer-events: none;
  transition: opacity 400ms ease;
}

.player-bar > * {
  position: relative;
  z-index: 1;
}

.player-bar.is-ambient.is-theme-ready {
  border-color: rgba(255,255,255,.62);
  box-shadow: 0 16px 38px rgba(46,58,66,.13),0 2px 9px rgba(46,58,66,.07);
}

.player-bar.is-ambient.is-theme-ready::before {
  background: linear-gradient(115deg,var(--detail-player-start,#f7f9fa),var(--detail-player-end,#f3f6f8));
  opacity: 1;
}

.player-bar.is-ambient.is-theme-ready .track-copy strong {
  color: color-mix(in srgb,#252d2f 84%,var(--detail-player-start) 16%);
  transition: color 400ms ease;
}

.player-bar.is-ambient.is-theme-ready .track-copy span,
.player-bar.is-ambient.is-theme-ready .progress-times,
.player-bar.is-ambient.is-theme-ready .transport-controls button:not(.play-button),
.player-bar.is-ambient.is-theme-ready .player-tools > button {
  color: color-mix(in srgb,#697174 82%,var(--detail-player-end) 18%);
  transition: color 400ms ease, background-color 400ms ease;
}

.player-bar.is-ambient.is-theme-ready .transport-controls .play-button {
  background: color-mix(in srgb,#68369a 86%,var(--detail-player-end) 14%);
  transition: color 400ms ease, background-color 400ms ease, box-shadow 400ms ease;
}

.player-bar.is-ambient.is-theme-ready .transport-controls .play-button:hover {
  background: color-mix(in srgb,#572985 86%,var(--detail-player-end) 14%);
}

@media (max-width: 980px) { .player-bar { left: calc(72px + (100vw - 72px) / 2); width: min(1180px, calc(100vw - 72px - 44px)); grid-template-columns: minmax(150px,.75fr) minmax(300px,1.5fr) minmax(222px,.85fr); gap: 8px; padding-inline: 12px; }.player-bar.is-sidebar-collapsed { left: 50%; width: min(1180px, calc(100vw - 48px)); } }
@media (max-width: 720px) { .player-bar { right: 12px; bottom: 12px; left: 84px; width: auto; height: auto; min-height: 88px; grid-template-columns: minmax(0,1fr) auto; gap: 2px 8px; padding: 5px 10px 6px; border-radius: 14px; transform: none; }.player-bar.is-sidebar-collapsed { left: 12px; width: auto; }.cover-expand,.mini-cover { width: 38px; height: 38px; }.transport { grid-column: 1/-1; grid-row: 2; grid-template-rows: 32px 14px; }.transport-controls .player-control-button.play-button.compact { width: 34px; height: 34px; flex-basis: 34px; }.player-tools>button:not(.lyrics-button),.player-volume-wrap { display: none; } }

@media (prefers-reduced-motion: reduce) {
  .player-bar,
  .player-bar::before,
  .player-bar .track-copy strong,
  .player-bar .track-copy span,
  .player-bar .progress-times,
  .player-bar .transport-controls button,
  .player-bar .player-tools > button {
    transition-duration: 0.01ms!important;
  }
}

.player-volume-wrap .volume-slider-rail {
  position: relative;
  display: block;
  width: 22px;
  height: 112px;
  margin-inline: auto;
}

.player-volume-wrap .player-volume-slider {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 112px!important;
  height: 22px!important;
  margin: 0;
  transform: translate(-50%,-50%) rotate(-90deg);
  transform-origin: center;
}

.progress-slider-wrap .progress-input {
  position: relative;
  z-index: 1;
}
</style>
