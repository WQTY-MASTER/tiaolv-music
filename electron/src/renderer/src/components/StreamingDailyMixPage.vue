<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpAZ,
  Bookmark,
  Heart,
  LocateFixed,
  Pause,
  Play,
  RefreshCw,
  Search
} from "lucide-vue-next";
import {
  filterAndSortDailyTracks,
  summarizeDailyDuration,
  type DailySortDirection,
  type DailySortField
} from "../services/streamingDailyMix";
import { resolveBackendUrl } from "../services/api";

interface DailyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  primary: string;
  secondary: string;
  mark: string;
  liked: boolean;
  history: boolean;
  coverUrl?: string;
  source?: string;
  filePath?: string;
  audioUrl?: string;
}

const props = defineProps<{
  tracks: DailyTrack[];
  providerName: string;
  currentTrackId: string;
  isPlaying: boolean;
  title?: string;
  label?: string;
  coverUrl?: string;
  coverMark?: string;
  refreshing?: boolean;
  reorderable?: boolean;
  sourceOptions?: ReadonlyArray<{ value: string; label: string }>;
  sourceValue?: string;
  collectable?: boolean;
  collected?: boolean;
  collectionPending?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  play: [trackId: string];
  "play-all": [trackIds: string[]];
  "play-random": [trackIds: string[]];
  "toggle-favorite": [trackId: string];
  "toggle-collection": [];
  reorder: [draggedTrackId: string, targetTrackId: string];
  refresh: [];
  "search-global": [keyword: string];
  "source-change": [source: string];
  "context-menu": [payload: { track: DailyTrack; event: MouseEvent }];
}>();

const globalKeyword = ref("");
const playlistKeyword = ref("");
const sortField = ref<DailySortField>("default");
const sortDirection = ref<DailySortDirection>("asc");
const listElement = ref<HTMLElement | null>(null);
const locatedTrackId = ref("");
const draggedTrackId = ref("");
let locateTimer: number | undefined;

const visibleTracks = computed(() => filterAndSortDailyTracks(
  props.tracks,
  playlistKeyword.value,
  sortField.value,
  sortDirection.value
));
const durationSummary = computed(() => summarizeDailyDuration(props.tracks));
const heroCoverUrl = computed(() => props.coverUrl || props.tracks.find((track) => track.coverUrl)?.coverUrl || "");
const sortDirectionTitle = computed(() => sortDirection.value === "asc"
  ? "升序，点击切换降序"
  : "降序，点击切换升序");

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function toggleSortDirection() {
  if (sortField.value === "default") return;
  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
}

function locateCurrentTrack() {
  if (!props.currentTrackId) return;
  const safeId = props.currentTrackId.replace(/["\\]/g, "\\$&");
  const row = listElement.value?.querySelector<HTMLElement>(`[data-track-id="${safeId}"]`);
  if (!row) return;
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  locatedTrackId.value = props.currentTrackId;
  if (locateTimer !== undefined) window.clearTimeout(locateTimer);
  locateTimer = window.setTimeout(() => {
    locatedTrackId.value = "";
  }, 1600);
}

function submitGlobalSearch() {
  const query = globalKeyword.value.trim();
  if (query) emit("search-global", query);
}

function emitSourceChange(event: Event) {
  emit("source-change", (event.target as HTMLSelectElement).value);
}

function startTrackDrag(trackId: string) {
  if (props.reorderable === false) return;
  draggedTrackId.value = trackId;
}

function dropTrack(targetTrackId: string) {
  if (props.reorderable === false) return;
  if (draggedTrackId.value && draggedTrackId.value !== targetTrackId) {
    emit("reorder", draggedTrackId.value, targetTrackId);
  }
  draggedTrackId.value = "";
}

onBeforeUnmount(() => {
  if (locateTimer !== undefined) window.clearTimeout(locateTimer);
});
</script>

<template>
  <section class="daily-detail-page" :aria-label="`${title || '每日推荐'}歌单详情`">
    <header class="daily-detail-topbar">
      <button type="button" class="daily-detail-back" @click="emit('back')">
        <ArrowLeft :size="16" :stroke-width="1.8" aria-hidden="true" />
        返回
      </button>
      <form class="daily-detail-global-search" role="search" @submit.prevent="submitGlobalSearch">
        <Search :size="16" :stroke-width="1.7" aria-hidden="true" />
        <input v-model="globalKeyword" type="search" aria-label="全局搜索" placeholder="搜索歌曲、歌手、专辑或文件夹" />
      </form>
    </header>

    <div class="daily-detail-hero">
      <div class="daily-detail-cover">
        <span class="daily-detail-cover-chrome" aria-hidden="true">
          <i></i><i></i><i></i>
        </span>
        <span class="daily-detail-cover-media" :style="{ background: `linear-gradient(135deg, ${tracks[0]?.primary || '#dbe5ef'}, ${tracks[0]?.secondary || '#8294aa'})` }">
          <img v-if="heroCoverUrl" :src="resolveBackendUrl(heroCoverUrl)" :alt="`${title || '每日推荐'}封面`" />
          <span v-else aria-hidden="true">{{ coverMark || "日" }}</span>
        </span>
      </div>
      <div class="daily-detail-copy">
        <span class="daily-detail-label">
          <strong class="daily-detail-label-title">{{ label || "推荐" }}</strong>
          <span class="daily-detail-label-count">・ {{ tracks.length }} 首</span>
        </span>
        <h1>{{ title || "每日推荐" }}</h1>
        <p>共 {{ tracks.length }} 首歌曲</p>
        <div class="daily-detail-stats">
          <span>{{ durationSummary }}</span>
          <span>{{ tracks.length }} 首在列</span>
        </div>
        <div class="daily-detail-actions">
          <button class="primary" type="button" :disabled="!visibleTracks.length" @click="emit('play-all', visibleTracks.map((track) => track.id))">
            <Play :size="15" :stroke-width="1.9" fill="currentColor" aria-hidden="true" />
            播放全部
          </button>
          <button type="button" :disabled="!visibleTracks.length" @click="emit('play-random', visibleTracks.map((track) => track.id))">
            <ArrowLeftRight :size="16" :stroke-width="1.8" aria-hidden="true" />
            随机
          </button>
          <button
            v-if="collectable"
            type="button"
            class="playlist-collection-button"
            :class="{ 'collection-active': collected }"
            :disabled="collectionPending"
            :title="collected ? '取消收藏歌单' : '收藏歌单'"
            :aria-label="collected ? '取消收藏歌单' : '收藏歌单'"
            @click="emit('toggle-collection')"
          >
            <Bookmark :size="16" :stroke-width="1.8" :fill="collected ? 'currentColor' : 'none'" aria-hidden="true" />
            {{ collectionPending ? "处理中" : collected ? "已收藏" : "收藏" }}
          </button>
        </div>
      </div>
    </div>

    <div class="daily-detail-toolbar" :class="{ 'has-source-select': sourceOptions?.length }">
      <label class="daily-detail-filter-search">
        <Search :size="16" :stroke-width="1.7" aria-hidden="true" />
        <input v-model="playlistKeyword" type="search" placeholder="在歌单中搜索" />
      </label>
      <label v-if="sourceOptions?.length" class="daily-detail-source-select">
        <span class="sr-only">选择音源</span>
        <select :value="sourceValue" aria-label="选择音源" @change="emitSourceChange">
          <option v-for="source in sourceOptions" :key="source.value" :value="source.value">{{ source.label }}</option>
        </select>
      </label>
      <span class="daily-detail-count">{{ visibleTracks.length }} 首</span>
      <label class="daily-detail-sort-select">
        <span class="sr-only">排序字段</span>
        <select v-model="sortField">
          <option value="default">默认顺序</option>
          <option value="title">歌曲名称</option>
          <option value="artist">歌手</option>
          <option value="album">专辑</option>
          <option value="duration">时长</option>
        </select>
      </label>
      <button
        class="daily-detail-icon-button"
        type="button"
        :disabled="sortField === 'default'"
        :title="sortField === 'default' ? '选择排序字段后可切换顺序' : sortDirectionTitle"
        :aria-label="sortField === 'default' ? '升降序不可用' : sortDirectionTitle"
        @click="toggleSortDirection"
      >
        <ArrowUpAZ v-if="sortDirection === 'asc'" :size="17" :stroke-width="1.7" aria-hidden="true" />
        <ArrowDownAZ v-else :size="17" :stroke-width="1.7" aria-hidden="true" />
      </button>
      <button class="daily-detail-icon-button" type="button" title="定位到当前播放歌曲" aria-label="定位到当前播放歌曲" @click="locateCurrentTrack">
        <LocateFixed :size="17" :stroke-width="1.7" aria-hidden="true" />
      </button>
      <button class="daily-detail-icon-button" type="button" title="刷新歌单" aria-label="刷新歌单" :disabled="refreshing" @click="emit('refresh')">
        <RefreshCw :size="17" :stroke-width="1.7" :class="{ spinning: refreshing }" aria-hidden="true" />
      </button>
    </div>

    <div class="daily-detail-table">
      <div class="daily-detail-table-head" aria-hidden="true">
        <span>#</span><span>曲目</span><span>专辑</span><span>时长</span>
      </div>
      <div ref="listElement" class="daily-detail-list">
        <div
          v-for="(track, index) in visibleTracks"
          :key="`${track.id}-${index}`"
          class="daily-detail-row"
          :class="{ active: track.id === currentTrackId, located: track.id === locatedTrackId }"
          :data-track-id="track.id"
          role="row"
          tabindex="0"
          :draggable="reorderable !== false"
          @dragstart="startTrackDrag(track.id)"
          @dragend="draggedTrackId = ''"
          @dragover.prevent
          @drop.prevent="dropTrack(track.id)"
          @click="emit('play', track.id)"
          @contextmenu.prevent="emit('context-menu', { track, event: $event })"
          @keydown.enter.prevent="emit('play', track.id)"
          @keydown.space.prevent="emit('play', track.id)"
        >
          <span class="daily-detail-index">
            <span
              v-if="track.id === currentTrackId"
              class="daily-detail-playing-indicator"
              :aria-label="isPlaying ? '正在播放' : '已暂停'"
            >
              <span v-if="isPlaying" class="daily-detail-playing-bars" aria-hidden="true"><i></i><i></i><i></i></span>
              <Pause v-else :size="14" :stroke-width="2.2" fill="currentColor" aria-hidden="true" />
            </span>
            <template v-else>{{ String(index + 1).padStart(2, "0") }}</template>
          </span>
          <span class="daily-detail-track">
            <span class="daily-detail-track-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
              <img v-if="track.coverUrl" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" />
              <span v-else aria-hidden="true">{{ track.mark }}</span>
            </span>
            <span><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span>
          </span>
          <span class="daily-detail-album">
            <button type="button" :class="{ liked: track.liked }" :title="track.liked ? '取消喜欢' : '喜欢歌曲'" :aria-label="track.liked ? `取消喜欢${track.title}` : `喜欢${track.title}`" @click.stop="emit('toggle-favorite', track.id)">
              <Heart :size="16" :stroke-width="1.7" :fill="track.liked ? 'currentColor' : 'none'" aria-hidden="true" />
            </button>
            <span>{{ track.album || "未知专辑" }}</span>
          </span>
          <span class="daily-detail-duration">{{ formatDuration(track.duration) }}</span>
        </div>
        <div v-if="!visibleTracks.length" class="daily-detail-empty">{{ tracks.length ? "没有找到匹配的歌曲" : `当前${providerName}暂未返回${title || "每日推荐"}` }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.daily-detail-page { width: min(1364px, 100%); margin: 0 auto; padding: 64px 10px 0; color: #171b25; }
.daily-detail-topbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 1px solid #dedfe2; padding-bottom: 20px; }
.daily-detail-back { display: inline-flex; height: 38px; align-items: center; gap: 7px; border: 1px solid #dfe2e6; border-radius: 19px; padding: 0 14px; background: rgba(255,255,255,.9); color: #176ce1; box-shadow: 0 8px 20px rgba(32,44,60,.08); cursor: pointer; font-size: 12px; transition: border-color 160ms ease, background 160ms ease, transform 160ms ease; }
.daily-detail-back:hover { border-color: #cbd3dc; background: #fff; transform: translateY(-1px); }
.daily-detail-global-search { display: flex; width: min(360px, 48vw); height: 38px; align-items: center; gap: 9px; border: 1px solid #dfe2e6; border-radius: 19px; padding: 0 14px; background: rgba(255,255,255,.88); color: #9099a5; box-shadow: 0 7px 20px rgba(34,42,55,.035); }
.daily-detail-global-search input,.daily-detail-filter-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #20293a; font: inherit; font-size: 12px; }
.daily-detail-hero { display: grid; grid-template-columns: 178px minmax(0, 1fr); align-items: center; gap: 28px; padding: 18px 0 44px; }
.daily-detail-cover { display: grid; box-sizing: border-box; width: 178px; grid-template-rows: 10px auto; gap: 4px; overflow: hidden; border: 1px solid rgba(215,217,221,.92); border-radius: 18px; padding: 6px; background: rgba(255,255,255,.94); box-shadow: 0 22px 44px rgba(33,39,48,.14), 0 6px 16px rgba(33,39,48,.07); }
.daily-detail-cover-chrome { display: flex; height: 10px; box-sizing: border-box; align-items: center; gap: 3px; border-bottom: 1px solid #ececef; padding: 0 3px 4px; }
.daily-detail-cover-chrome i { display: block; width: 3px; height: 3px; border-radius: 50%; background: #d8dadd; }
.daily-detail-cover-media { display: grid; width: 100%; aspect-ratio: 1; place-items: center; overflow: hidden; border-radius: 12px; color: #fff; font-size: 38px; font-weight: 900; }
.daily-detail-cover-media img,.daily-detail-track-cover img { width: 100%; height: 100%; object-fit: cover; }
.daily-detail-copy { min-width: 0; }
.daily-detail-label { display: inline-flex; align-items: center; gap: 5px; color: #a6a7aa; font-size: 11px; font-weight: 850; }
.daily-detail-label::before { width: 18px; height: 2px; margin-right: 4px; border-radius: 999px; background: #d64c33; content: ""; }
.daily-detail-label-title { color: #d64c33; font: inherit; }
.daily-detail-label-count { color: #a6a7aa; }
.daily-detail-copy h1 { margin: 10px 0 9px; color: #151820; font-size: clamp(36px, 4vw, 48px); font-weight: 900; line-height: 1.05; letter-spacing: 0; }
.daily-detail-copy > p { margin: 0; color: #626a76; font-size: 13px; }
.daily-detail-stats { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 15px; }
.daily-detail-stats span { border: 1px solid transparent; border-radius: 999px; padding: 5px 11px; font-size: 10px; font-weight: 700; }
.daily-detail-stats span:first-child { border-color: #e5ded0; background: #faf8f2; color: #292d33; }
.daily-detail-stats span:last-child { border-color: #e2e2e4; background: #f1f1f2; color: #a1a3a7; }
.daily-detail-actions { display: flex; gap: 10px; margin-top: 18px; }
.daily-detail-actions button { display: inline-flex; height: 42px; min-width: 100px; align-items: center; justify-content: center; gap: 7px; border: 1px solid #d5d8dc; border-radius: 21px; padding: 0 17px; background: #fff; color: #191d25; cursor: pointer; font-size: 12px; font-weight: 800; transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
.daily-detail-actions button:not(:disabled):hover { border-color: #bfc4ca; box-shadow: 0 9px 20px rgba(29,34,43,.08); transform: translateY(-1px); }
.daily-detail-actions button.primary { border-color: #171a20; background: #171a20; color: #fff; box-shadow: 0 12px 25px rgba(20,23,29,.19); }
.daily-detail-actions button.collection-active { border-color: #d7d9dd; background: #eff0f2; color: #4f5661; box-shadow: inset 0 0 0 1px rgba(30,36,45,.02); }
.daily-detail-actions button.collection-active:not(:disabled):hover { border-color: #c9ccd1; background: #e8e9ec; }
.daily-detail-actions button:disabled { opacity: .45; cursor: default; }
.daily-detail-toolbar { display: grid; min-height: 60px; grid-template-columns: minmax(220px, 1fr) auto auto 38px 38px 38px; align-items: center; gap: 9px; border: 1px solid #e3e4e6; border-radius: 16px; padding: 9px 15px; background: rgba(255,255,255,.94); box-shadow: 0 12px 30px rgba(31,37,47,.045); }
.daily-detail-toolbar.has-source-select { grid-template-columns: minmax(220px, 1fr) auto auto auto 38px 38px 38px; }
.daily-detail-filter-search { display: flex; min-width: 0; align-items: center; gap: 9px; color: #84909f; }
.daily-detail-count { color: #687588; font-size: 11px; white-space: nowrap; }
.daily-detail-sort-select select { height: 36px; border: 0; border-radius: 9px; padding: 0 28px 0 11px; outline: 0; background: #f7f6f3; color: #202631; cursor: pointer; font-size: 13px; font-weight: 700; }
.daily-detail-source-select select { height: 36px; border: 0; border-radius: 9px; padding: 0 28px 0 11px; outline: 0; background: #f7f6f3; color: #202631; cursor: pointer; font-size: 13px; font-weight: 700; }
.daily-detail-sort-select option { background: #fff; color: #202631; font-size: 13px; font-weight: 600; }
.daily-detail-source-select option { background: #fff; color: #202631; font-size: 13px; font-weight: 600; }
.daily-detail-icon-button { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 50%; background: transparent; color: #6f7988; cursor: pointer; transition: background 160ms ease, color 160ms ease; }
.daily-detail-icon-button:not(:disabled):hover { background: #f0f3f5; color: #1d6cdd; }
.daily-detail-icon-button:disabled { color: #c7cdd3; cursor: default; }
.spinning { animation: daily-refresh-spin 700ms linear infinite; }
@keyframes daily-refresh-spin { to { transform: rotate(360deg); } }
.daily-detail-table { margin-top: 22px; overflow: hidden; border: 1px solid #e5e3df; border-radius: 16px; background: var(--app-card-background); box-shadow: var(--app-card-shadow); }
.daily-detail-table-head,.daily-detail-row { display: grid; grid-template-columns: 56px minmax(240px, 1.45fr) minmax(190px, .9fr) 74px; align-items: center; gap: 14px; }
.daily-detail-table-head { min-height: 42px; border-bottom: 1px solid #ebe8e2; padding: 0 18px; background: #fbfaf7; color: #8e8d88; font-size: 10px; font-weight: 800; }
.daily-detail-table-head span:first-child { text-align: center; }
.daily-detail-table-head span:nth-child(3) { padding-left: 37px; }
.daily-detail-table-head span:last-child { text-align: right; }
.daily-detail-list { position: relative; }
.daily-detail-row { min-height: 64px; border-bottom: 1px solid #f0efec; border-radius: 12px; padding: 6px 18px; outline: 0; background: #fff; cursor: pointer; transition: background 160ms ease, box-shadow 160ms ease, color 160ms ease; }
.daily-detail-row:last-child { border-bottom: 0; }
.daily-detail-row:hover { background: #f7f8f6; }
.daily-detail-row.active { background: var(--app-playing-background); box-shadow: inset 0 0 0 1px rgba(153,126,76,.08); }
.daily-detail-row.located { box-shadow: inset 3px 0 #21a47c, inset 0 0 0 1px rgba(33,164,124,.28); }
.daily-detail-index { display: grid; width: 34px; height: 34px; place-items: center; color: #9ba4af; font-size: 11px; font-weight: 750; }
.daily-detail-playing-indicator { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 50%; background: #137f76; color: #fff; box-shadow: 0 7px 16px rgba(19,127,118,.2); }
.daily-detail-playing-bars { display: flex; height: 14px; align-items: center; justify-content: center; gap: 2px; }
.daily-detail-playing-bars i { display: block; width: 2px; height: 12px; border-radius: 999px; background: #fff; transform-origin: center; animation: daily-playing-bar 720ms ease-in-out infinite alternate; }
.daily-detail-playing-bars i:nth-child(2) { animation-delay: -480ms; }
.daily-detail-playing-bars i:nth-child(3) { animation-delay: -240ms; }
@keyframes daily-playing-bar { 0% { transform: scaleY(.28); } 45% { transform: scaleY(1); } 100% { transform: scaleY(.48); } }
.daily-detail-track { display: grid; min-width: 0; grid-template-columns: 42px minmax(0, 1fr); align-items: center; gap: 12px; }
.daily-detail-track-cover { display: grid; width: 42px; height: 42px; place-items: center; overflow: hidden; border-radius: 8px; color: #fff; font-size: 12px; }
.daily-detail-track > span:last-child { display: grid; min-width: 0; gap: 4px; }
.daily-detail-track strong,.daily-detail-track small,.daily-detail-album > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.daily-detail-track strong { color: #171b24; font-size: 12px; }
.daily-detail-row.active .daily-detail-track strong { color: #11776f; }
.daily-detail-track small { color: #84909f; font-size: 10px; }
.daily-detail-album { display: grid; min-width: 0; grid-template-columns: 30px minmax(0, 1fr); align-items: center; gap: 7px; color: #586476; font-size: 11px; }
.daily-detail-album button { display: grid; width: 30px; height: 30px; place-items: center; border: 0; border-radius: 50%; background: transparent; color: #9ba4af; cursor: pointer; }
.daily-detail-album button:hover { background: #f1f3f5; color: #e55562; }
.daily-detail-album button.liked { color: #ef5a66; }
.daily-detail-duration { color: #7d8795; font-size: 11px; text-align: right; }
.daily-detail-empty { padding: 70px 20px; color: #8994a3; font-size: 12px; text-align: center; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 820px) {
  .daily-detail-page { padding-inline: 4px; }
  .daily-detail-hero { grid-template-columns: 132px minmax(0, 1fr); gap: 20px; }
  .daily-detail-cover { width: 132px; }
  .daily-detail-toolbar { grid-template-columns: minmax(170px, 1fr) auto auto repeat(3, 36px); }
  .daily-detail-toolbar.has-source-select { grid-template-columns: minmax(170px, 1fr) auto auto auto repeat(3, 36px); }
  .daily-detail-table-head,.daily-detail-row { grid-template-columns: 42px minmax(180px, 1.3fr) minmax(130px, .8fr) 58px; gap: 9px; padding-inline: 12px; }
}
@media (max-width: 620px) {
  .daily-detail-topbar { align-items: stretch; flex-direction: column; gap: 12px; }
  .daily-detail-global-search { width: 100%; }
  .daily-detail-hero { grid-template-columns: 102px minmax(0, 1fr); padding-bottom: 28px; }
  .daily-detail-cover { width: 102px; border-radius: 12px; }
  .daily-detail-copy h1 { font-size: 30px; }
  .daily-detail-stats { display: none; }
  .daily-detail-actions { margin-top: 14px; }
  .daily-detail-toolbar { grid-template-columns: minmax(0, 1fr) auto repeat(3, 34px); }
  .daily-detail-toolbar.has-source-select { grid-template-columns: minmax(0, 1fr) auto repeat(3, 34px); }
  .daily-detail-sort-select { grid-column: 1 / 3; grid-row: 2; }
  .daily-detail-toolbar.has-source-select .daily-detail-source-select { grid-column: 1 / 2; grid-row: 2; }
  .daily-detail-toolbar.has-source-select .daily-detail-sort-select { grid-column: 2 / 3; grid-row: 2; }
  .daily-detail-source-select select { width: 100%; }
  .daily-detail-sort-select select { width: 100%; }
  .daily-detail-count { justify-self: end; }
  .daily-detail-table-head,.daily-detail-row { grid-template-columns: 34px minmax(170px, 1fr) 58px; }
  .daily-detail-table-head span:nth-child(3),.daily-detail-album { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .daily-detail-row,.daily-detail-icon-button { transition-duration: .01ms; }
  .spinning { animation: none; }
  .daily-detail-playing-bars i { animation: none; }
}
</style>
