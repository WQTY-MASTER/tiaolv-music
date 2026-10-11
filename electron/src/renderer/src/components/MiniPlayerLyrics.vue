<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getLeadingLyricQuote, splitLyricCharacters, type LyricLine } from "../services/lyricParser";
import { projectMiniLyricTime, getMiniLyricCharacterFill, getMiniLyricLineCount, getMiniLyricMetrics, getMiniLyricOffset, getMiniLyricProgress, getMiniLyricSlots, shouldAnimateMiniLyricStep } from "../services/miniPlayerLyrics";

const props = defineProps<{ lines: LyricLine[]; currentTime: number; isPlaying?: boolean; duration: number; fallback: string; trackKey?: string; source?: string; lyricsFormat?: string; lyricsSource?: string }>();
const viewport = ref<HTMLElement | null>(null);
const availableHeight = ref(0);
const viewportWidth = ref(0);
const contentWidth = ref(0);
const animate = ref(false);
let observer: ResizeObserver | undefined;
const renderTime = ref(props.currentTime);
let clockFrame: number | undefined;
let anchorTime = props.currentTime;
let anchorTimestamp = 0;
let synchronizedTime = props.currentTime;
const state = computed(() => getMiniLyricProgress(props.lines, renderTime.value, props.duration, props.source, props.lyricsFormat, props.lyricsSource));
const activeIndex = computed(() => state.value.activeIndex);
const translated = computed(() => props.lines.some(line => Boolean(line.translation?.trim())));
const metrics = computed(() => getMiniLyricMetrics(availableHeight.value, translated.value));
const count = computed(() => getMiniLyricLineCount(availableHeight.value, metrics.value.rowHeight, translated.value));
const center = computed(() => Math.max(0, activeIndex.value));
const slots = computed(() => {
  if (!props.lines.length) return [{ index: 0, line: { time: 0, text: props.fallback, translation: undefined }, active: false }];
  const visible = getMiniLyricSlots(props.lines, activeIndex.value, count.value);
  const first = visible[0].index - 1, last = visible[visible.length - 1].index + 1;
  return [{ index: first, line: props.lines[first] ?? null, active: false }, ...visible,
    { index: last, line: props.lines[last] ?? null, active: false }];
});
const characters = computed(() => splitLyricCharacters(props.lines[activeIndex.value]?.text ?? ""));
const lyricIdentity = computed(() => JSON.stringify(props.lines));
const stageStyle = computed(() => ({
  height: `${count.value * metrics.value.rowHeight}px`,
  "--mini-lyric-size": `${metrics.value.fontSize}px`,
  "--mini-lyric-active-size": `${metrics.value.activeFontSize}px`,
  "--mini-quote-gutter": `${metrics.value.activeFontSize + 2}px`,
  "--mini-lyric-row": `${metrics.value.rowHeight}px`,
  "--mini-lyric-line-height": `${metrics.value.lineHeight}px`,
  "--mini-translation-size": `${metrics.value.translationSize}px`,
  "--mini-translation-line-height": `${metrics.value.translationLineHeight}px`
}));
const offset = computed(() => getMiniLyricOffset(contentWidth.value, viewportWidth.value, state.value.progress));

function measure() {
  const root = viewport.value;
  if (!root) return;
  availableHeight.value = root.clientHeight;
  const active = root.querySelector<HTMLElement>(".is-current .mini-lyric-flow");
  viewportWidth.value = Math.max(0, root.clientWidth - metrics.value.activeFontSize - 2);
  contentWidth.value = active?.scrollWidth ?? 0;
}
function characterStyle(index: number) {
  return { "--mini-character-fill": `${getMiniLyricCharacterFill(state.value.characterProgress, index) * 100}%` };
}
function stopClock() {
  if (clockFrame !== undefined) cancelAnimationFrame(clockFrame);
  clockFrame = undefined;
}
function syncClock(reset = false) {
  stopClock();
  const time = Number.isFinite(props.currentTime) ? Math.max(0, props.currentTime) : renderTime.value;
  const seek = reset || time < synchronizedTime || time - synchronizedTime > 0.6;
  if (seek || !props.isPlaying) animate.value = false;
  renderTime.value = seek || !props.isPlaying ? time : Math.max(time, renderTime.value);
  anchorTime = time;
  anchorTimestamp = performance.now();
  synchronizedTime = time;
  if (!props.isPlaying) return;
  // Smooth only the local lyric clock; stale IPC cannot advance it indefinitely.
  const tick = (timestamp: number) => {
    clockFrame = undefined;
    renderTime.value = Math.max(renderTime.value, projectMiniLyricTime(anchorTime, anchorTimestamp, timestamp, true, props.duration));
    if (timestamp - anchorTimestamp < 150) clockFrame = requestAnimationFrame(tick);
  };
  clockFrame = requestAnimationFrame(tick);
}
watch(renderTime, (time, previous) => {
  const previousIndex = getMiniLyricProgress(props.lines, previous, props.duration).activeIndex;
  if (time < previous || time - previous > 0.6 || previousIndex !== activeIndex.value) {
    animate.value = shouldAnimateMiniLyricStep(previous, time, previousIndex, activeIndex.value);
  }
});
watch([() => props.currentTime, () => props.isPlaying], () => syncClock());
watch(() => props.trackKey, () => syncClock(true));
watch([() => props.trackKey, lyricIdentity, count, metrics], () => { animate.value = false; });
watch([activeIndex, lyricIdentity, metrics, () => props.fallback, () => props.source, () => props.lyricsFormat, () => props.lyricsSource], async () => { await nextTick(); measure(); });
onMounted(() => {
  syncClock(true);
  observer = new ResizeObserver(measure);
  if (viewport.value) observer.observe(viewport.value);
  measure();
  void document.fonts.ready.then(() => { if (viewport.value) measure(); });
});
onBeforeUnmount(() => { stopClock(); observer?.disconnect(); });
</script>

<template>
  <div ref="viewport" class="mini-lyrics" :data-line-count="count" :data-highlight-mode="state.wordTimed ? 'word' : 'line'" :data-motion="animate ? 'smooth' : 'snap'">
    <div class="mini-lyric-stage" :style="stageStyle">
    <div v-for="slot in slots" :key="`${props.trackKey ?? ''}:${slot.index}`" class="mini-lyric-slot" :class="{ 'is-current': slot.active, 'is-empty': !slot.line }" :data-index="slot.index" :data-visible="Math.abs(slot.index - center) <= Math.floor(count / 2)" :aria-hidden="!slot.line || Math.abs(slot.index - center) > Math.floor(count / 2)" :style="{ transform: `translateY(${(slot.index - center - 0.5) * metrics.rowHeight}px)` }">
      <div class="mini-lyric">
        <span class="mini-lyric-flow" :style="{ transform: `translateX(${slot.active ? offset : 0}px)` }">
          <template v-if="slot.active && state.wordTimed && slot.line">
            <span v-for="(character, index) in characters" :key="index" class="mini-lyric-character" :class="{ 'is-leading-quote': index === 0 && Boolean(getLeadingLyricQuote(slot.line.text)) }" :style="characterStyle(index)">{{ character }}</span>
          </template>
          <template v-else><span v-if="getLeadingLyricQuote(slot.line?.text ?? '')" class="is-leading-quote">{{ getLeadingLyricQuote(slot.line?.text ?? '') }}</span>{{ getLeadingLyricQuote(slot.line?.text ?? '') ? slot.line?.text.slice(1) : slot.line?.text }}</template>
        </span>
      </div>
      <div v-if="slot.line?.translation?.trim()" class="mini-lyric-translation"><span v-if="getLeadingLyricQuote(slot.line.translation)" class="is-leading-quote">{{ getLeadingLyricQuote(slot.line.translation) }}</span><span class="mini-translation-content">{{ getLeadingLyricQuote(slot.line.translation) ? slot.line.translation.slice(1) : slot.line.translation }}</span></div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.mini-lyrics { display: flex; width: 100%; height: 100%; min-height: 26px; min-width: 0; flex-direction: column; justify-content: center; overflow: hidden; }
.mini-lyric-stage { position: relative; width: 100%; flex: 0 0 auto; overflow: hidden; }
.mini-lyric-slot { position: absolute; top: 50%; left: var(--mini-quote-gutter,24px); right: 0; height: var(--mini-lyric-row,30px); display: flex; flex-direction: column; justify-content: center; min-width: 0; color: var(--mini-muted,#85909b); }
.mini-lyrics[data-motion="smooth"] .mini-lyric-slot { transition: transform 280ms cubic-bezier(.22,.61,.36,1); }
.mini-lyric { width: 100%; flex-shrink: 0; font-size: var(--mini-lyric-size,14px); font-weight: 500; line-height: var(--mini-lyric-line-height,24px); }
.mini-lyric-translation { position: relative; width: 100%; flex-shrink: 0; margin-top: 2px; font-size: var(--mini-translation-size,12px); line-height: var(--mini-translation-line-height,14px); font-weight: 400; }
.mini-translation-content { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
.is-current .mini-lyric-translation { color: var(--mini-text,#26343d); }
.is-current .mini-lyric { color: var(--mini-accent,#20c98b); font-size: var(--mini-lyric-active-size,17px); font-weight: 800; }
.mini-lyric-flow { position: relative; display: inline-block; white-space: pre; vertical-align: top; }
.is-leading-quote { position: absolute; left: 0; top: 0; transform: translateX(-100%); }
.mini-lyric-character { background: linear-gradient(to right,var(--mini-accent,#20c98b) 0%,var(--mini-accent,#20c98b) var(--mini-character-fill,0%),var(--mini-text,#26343d) var(--mini-character-fill,0%),var(--mini-text,#26343d) 100%); background-clip: text; -webkit-background-clip: text; color: transparent; }
@media (prefers-reduced-motion: reduce) { .mini-lyrics[data-motion="smooth"] .mini-lyric-slot { transition: none; } }
</style>
