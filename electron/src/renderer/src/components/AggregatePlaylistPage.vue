<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { resolveBackendUrl } from "../services/api";
import {
  mergeAggregateTracks,
  type AggregatePlaylist,
  type AggregateTrackGroup,
  type AggregateTrackSource
} from "../services/aggregatePlaylists";
import { reorderVisibleKeys } from "../services/playlistOrder";

const props = withDefaults(defineProps<{
  playlists: AggregatePlaylist[];
  availableSources?: string[];
}>(), {
  availableSources: () => ["local"]
});

const emit = defineEmits<{
  create: [name: string];
  play: [source: AggregateTrackSource];
  playList: [sources: AggregateTrackSource[], shuffle: boolean];
  removeGroup: [playlist: AggregatePlaylist, groupId: string, title: string];
  reorder: [playlist: AggregatePlaylist, orderedGroupIds: string[]];
  setCover: [playlist: AggregatePlaylist];
}>();

const selectedPlaylistId = ref("");
const dialogVisible = ref(false);
const playlistName = ref("");
const playlistNameError = ref("");
const nameInput = ref<HTMLInputElement | null>(null);
const selectedSources = ref<Record<string, string>>({});
const failedCoverUrls = ref(new Set<string>());
const aggregateFolderFilter = ref("全部");
const aggregateSourceFilter = ref("全部");
const draggedGroupId = ref<string | null>(null);

const selectedPlaylist = computed(() => (
  props.playlists.find((playlist) => playlist.id === selectedPlaylistId.value) ?? null
));
const groupedTracks = computed(() => mergeAggregateTracks(selectedPlaylist.value?.tracks ?? []));
const aggregateFolderOptions = computed(() => {
  const folders = new Set<string>();
  groupedTracks.value.forEach((group) => group.sources.forEach((source) => {
    if (source.filePath) {
      folders.add(sourceFolder(source));
    }
  }));
  return ["全部", ...folders];
});
const aggregateSourceOptions = computed(() => {
  const sources = new Set<string>();
  groupedTracks.value.forEach((group) => group.sources.forEach((source) => {
    sources.add(normalizedSource(source.source));
  }));
  return ["全部", ...sources];
});
const filteredGroupedTracks = computed(() => groupedTracks.value.filter((group) => (
  group.sources.some((source) => (
    (aggregateFolderFilter.value === "全部" || sourceFolder(source) === aggregateFolderFilter.value)
    && (aggregateSourceFilter.value === "全部" || normalizedSource(source.source) === aggregateSourceFilter.value)
  ))
)));

watch(() => props.playlists, (playlists) => {
  if (selectedPlaylistId.value && !playlists.some((playlist) => playlist.id === selectedPlaylistId.value)) {
    selectedPlaylistId.value = "";
  }
}, { deep: true });

function openCreateDialog() {
  playlistName.value = "";
  playlistNameError.value = "";
  dialogVisible.value = true;
  void nextTick(() => nameInput.value?.focus());
}

function closeCreateDialog() {
  dialogVisible.value = false;
  playlistNameError.value = "";
}

function createPlaylist() {
  const name = playlistName.value.trim();
  if (!name) {
    playlistNameError.value = "歌单名称不能为空";
    return;
  }
  emit("create", name);
  closeCreateDialog();
}

function openPlaylist(playlist: AggregatePlaylist) {
  selectedPlaylistId.value = playlist.id;
  selectedSources.value = {};
  aggregateFolderFilter.value = "全部";
  aggregateSourceFilter.value = "全部";
}

function closePlaylist() {
  selectedPlaylistId.value = "";
  selectedSources.value = {};
  draggedGroupId.value = null;
}

function sourceFolder(source: AggregateTrackSource) {
  if (!source.filePath) {
    return "未知文件夹";
  }
  const parts = source.filePath.split(/[\\/]/);
  return parts.slice(0, -1).join("\\") || "未知文件夹";
}

function sourceFilterLabel(source: string) {
  if (source === "local") {
    return "本地";
  }
  if (source === "netease") {
    return "网易云";
  }
  if (source === "qq") {
    return "QQ 音乐";
  }
  return source;
}

function sourceKey(source: AggregateTrackSource) {
  return `${source.source}::${source.id}`;
}

function selectedSourceKey(group: AggregateTrackGroup) {
  return selectedSources.value[group.id] ?? (group.sources[0] ? sourceKey(group.sources[0]) : "");
}

function selectSource(groupId: string, key: string) {
  selectedSources.value = { ...selectedSources.value, [groupId]: key };
}

function selectedSource(group: AggregateTrackGroup) {
  const selectedKey = selectedSourceKey(group);
  return group.sources.find((candidate) => sourceKey(candidate) === selectedKey) ?? group.sources[0];
}

function playGroup(group: AggregateTrackGroup) {
  const source = selectedSource(group);
  if (source) {
    emit("play", source);
  }
}

function playAll(shuffle: boolean) {
  const sources = filteredGroupedTracks.value
    .map((group) => selectedSource(group))
    .filter((source): source is AggregateTrackSource => Boolean(source));
  emit("playList", sources, shuffle);
}

function startGroupDrag(groupId: string) {
  draggedGroupId.value = groupId;
}

function finishGroupDrag() {
  draggedGroupId.value = null;
}

function dropGroup(targetGroupId: string) {
  const playlist = selectedPlaylist.value;
  const draggedId = draggedGroupId.value;
  if (!playlist || !draggedId) {
    finishGroupDrag();
    return;
  }
  const nextOrder = reorderVisibleKeys(
    groupedTracks.value.map((group) => group.id),
    filteredGroupedTracks.value.map((group) => group.id),
    draggedId,
    targetGroupId
  );
  emit("reorder", playlist, nextOrder);
  finishGroupDrag();
}

function removeGroup(group: AggregateTrackGroup) {
  const playlist = selectedPlaylist.value;
  if (!playlist) {
    return;
  }
  emit("removeGroup", playlist, group.id, group.title);
  const nextSelections = { ...selectedSources.value };
  delete nextSelections[group.id];
  selectedSources.value = nextSelections;
}

function normalizedSource(source: string) {
  if (source === "ncm") {
    return "netease";
  }
  if (source === "qqmusic") {
    return "qq";
  }
  return source;
}

function isSourceAvailable(source: AggregateTrackSource) {
  return normalizedSource(source.source) === "local"
    || props.availableSources.some((item) => normalizedSource(item) === normalizedSource(source.source));
}

function sourceDisplayLabel(source: AggregateTrackSource) {
  const kind = normalizedSource(source.source);
  const label = kind === "local"
    ? "本地"
    : kind === "netease"
      ? "网易云"
      : kind === "qq"
        ? "QQ 音乐"
        : source.sourceLabel;
  return isSourceAvailable(source) ? label : `${label}（未登录）`;
}

function resolvedCoverUrl(url: string | undefined) {
  const resolved = url && /^(https?:|file:|data:|blob:)/i.test(url) ? url : resolveBackendUrl(url);
  return resolved && !failedCoverUrls.value.has(resolved) ? resolved : undefined;
}

function aggregatePlaylistCover(playlist: AggregatePlaylist) {
  const firstTrackCover = mergeAggregateTracks(playlist.tracks)[0]?.coverUrl;
  return resolvedCoverUrl(playlist.coverUrl || firstTrackCover);
}

function groupCover(group: AggregateTrackGroup) {
  return resolvedCoverUrl(group.coverUrl);
}

function handleCoverError(url: string | undefined) {
  if (!url) {
    return;
  }
  failedCoverUrls.value = new Set(failedCoverUrls.value).add(url);
}

function formatDuration(duration: number) {
  const safeDuration = Math.max(0, Math.round(duration || 0));
  const minutes = Math.floor(safeDuration / 60);
  const seconds = safeDuration % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
</script>

<template>
  <section v-if="!selectedPlaylist" class="aggregate-page" aria-label="聚合歌单">
    <header class="aggregate-header">
      <div>
        <h1>聚合歌单</h1>
        <p>本地维护的跨平台虚拟歌单，可混合本地、网易云与 QQ 音乐；同名同歌手自动合并。</p>
      </div>
      <button class="aggregate-new-button" type="button" @click="openCreateDialog">
        <span aria-hidden="true">＋</span>
        新建聚合歌单
      </button>
    </header>

    <div class="aggregate-grid">
      <button class="aggregate-create-card" type="button" @click="openCreateDialog">
        <span class="aggregate-create-visual" aria-hidden="true">＋</span>
        <strong>新建聚合歌单</strong>
        <small>跨音源收歌</small>
      </button>

      <button
        v-for="(playlist, index) in props.playlists"
        :key="playlist.id"
        class="aggregate-playlist-card"
        type="button"
        @click="openPlaylist(playlist)"
      >
        <span class="aggregate-card-visual">
          <img
            v-if="aggregatePlaylistCover(playlist)"
            :src="aggregatePlaylistCover(playlist)"
            :alt="`${playlist.name}封面`"
            @error="handleCoverError(aggregatePlaylistCover(playlist))"
          />
          <span class="aggregate-card-index">{{ String(index + 1).padStart(2, "0") }}</span>
          <span v-if="!aggregatePlaylistCover(playlist)" class="aggregate-group-icon" aria-hidden="true">
            <i></i><i></i><i></i><i></i>
          </span>
        </span>
        <strong>{{ playlist.name }}</strong>
        <span>{{ mergeAggregateTracks(playlist.tracks).length }} 首</span>
        <small>{{ playlist.identifier }}</small>
      </button>
    </div>
  </section>

  <section v-else class="aggregate-detail" aria-label="聚合歌单详情">
    <header class="aggregate-detail-header">
      <div>
        <button class="aggregate-back-button" type="button" @click="closePlaylist">
          <span aria-hidden="true">←</span>
          返回
        </button>
        <div class="aggregate-detail-title-row">
          <h1>{{ selectedPlaylist.name }}</h1>
          <span>{{ groupedTracks.length }} 首 · {{ selectedPlaylist.identifier }}</span>
        </div>
        <p>同一首歌的多个音源已合并显示，可在歌曲行右侧切换播放来源。</p>
      </div>
      <div class="aggregate-detail-actions">
        <button type="button" :disabled="!filteredGroupedTracks.length" @click="playAll(false)"><span aria-hidden="true">▷</span>播放全部</button>
        <button type="button" :disabled="!filteredGroupedTracks.length" @click="playAll(true)"><span aria-hidden="true">⤨</span>随机播放</button>
        <button class="icon-only" type="button" title="设置聚合歌单封面" aria-label="设置聚合歌单封面" @click="emit('setCover', selectedPlaylist)"><span aria-hidden="true">▧</span></button>
      </div>
    </header>

    <div v-if="groupedTracks.length" class="aggregate-filter-bar" aria-label="筛选聚合歌单歌曲">
      <label>
        <span>文件夹</span>
        <select v-model="aggregateFolderFilter">
          <option v-for="folder in aggregateFolderOptions" :key="folder" :value="folder">{{ folder }}</option>
        </select>
      </label>
      <label>
        <span>来源</span>
        <select v-model="aggregateSourceFilter">
          <option v-for="source in aggregateSourceOptions" :key="source" :value="source">{{ source === '全部' ? source : sourceFilterLabel(source) }}</option>
        </select>
      </label>
    </div>

    <div v-if="filteredGroupedTracks.length" class="aggregate-track-list">
      <div class="aggregate-track-head" aria-hidden="true">
        <span>#</span>
        <span>标题</span>
        <span>音源</span>
        <span>时长</span>
        <span>操作</span>
      </div>
      <article
        v-for="(group, index) in filteredGroupedTracks"
        :key="group.id"
        class="aggregate-track-row"
        :class="{ 'is-dragging': draggedGroupId === group.id }"
        role="button"
        tabindex="0"
        draggable="true"
        @click="playGroup(group)"
        @keydown.enter="playGroup(group)"
        @keydown.space.prevent="playGroup(group)"
        @dragstart="startGroupDrag(group.id)"
        @dragover.prevent
        @drop.prevent.stop="dropGroup(group.id)"
        @dragend="finishGroupDrag"
      >
        <span class="aggregate-track-index">{{ String(index + 1).padStart(2, "0") }}</span>
        <div class="aggregate-track-copy">
          <img v-if="groupCover(group)" :src="groupCover(group)" :alt="`${group.title}封面`" @error="handleCoverError(groupCover(group))" />
          <span v-else class="aggregate-track-fallback" aria-hidden="true">{{ group.title.slice(0, 1) }}</span>
          <span>
            <strong>{{ group.title }}</strong>
            <small>{{ group.artist }} · {{ group.album }}</small>
          </span>
        </div>
        <div class="aggregate-source-cell" @click.stop @keydown.stop>
          <span
            v-if="group.sources.length === 1"
            class="aggregate-source-label"
            :class="{ unavailable: !isSourceAvailable(group.sources[0]) }"
          >{{ sourceDisplayLabel(group.sources[0]) }}</span>
          <label v-else class="aggregate-source-switch">
            <span class="sr-only">切换 {{ group.title }} 的播放音源</span>
            <select
              :value="selectedSourceKey(group)"
              @change="selectSource(group.id, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="source in group.sources" :key="sourceKey(source)" :value="sourceKey(source)">
                {{ sourceDisplayLabel(source) }}
              </option>
            </select>
          </label>
        </div>
        <span class="aggregate-track-duration">{{ formatDuration(group.duration) }}</span>
        <button
          class="aggregate-remove-group"
          type="button"
          title="从聚合歌单移除（含这首歌的全部音源）"
          :aria-label="`从聚合歌单移除 ${group.title}，含这首歌的全部音源`"
          @click.stop="removeGroup(group)"
        >×</button>
      </article>
    </div>

    <div v-else-if="groupedTracks.length" class="aggregate-empty-state compact">
      <strong>没有符合筛选条件的歌曲</strong>
      <p>调整文件夹或来源筛选后即可恢复显示。</p>
    </div>

    <div v-else class="aggregate-empty-state">
      <span class="aggregate-empty-icon" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
      </span>
      <strong>暂无歌曲</strong>
      <p>从本地音乐或流媒体歌曲菜单中加入这个聚合歌单。</p>
    </div>
  </section>

  <div v-if="dialogVisible" class="aggregate-dialog" role="dialog" aria-modal="true" aria-label="新建聚合歌单" @click.self="closeCreateDialog">
    <form class="aggregate-dialog-panel" @submit.prevent="createPlaylist">
      <h2>新建聚合歌单</h2>
      <label>
        <span>歌单名称</span>
        <input ref="nameInput" v-model="playlistName" type="text" maxlength="40" placeholder="请输入歌单名称" @input="playlistNameError = ''" />
      </label>
      <p v-if="playlistNameError" class="aggregate-dialog-error">{{ playlistNameError }}</p>
      <div class="aggregate-dialog-actions">
        <button type="button" @click="closeCreateDialog">取消</button>
        <button class="primary" type="submit">创建</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.aggregate-page,
.aggregate-detail {
  width: min(1288px, 100%);
  margin: 8px auto 0;
  color: #182235;
}

.aggregate-header,
.aggregate-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 28px;
}

.aggregate-header h1,
.aggregate-detail h1 {
  margin: 0;
  color: #0c1426;
  font-size: clamp(28px, 3vw, 36px);
  font-weight: 900;
  letter-spacing: 0;
}

.aggregate-header p,
.aggregate-detail-header p {
  max-width: 680px;
  margin: 10px 0 0;
  color: #718096;
  font-size: 13px;
  line-height: 1.7;
}

.aggregate-new-button,
.aggregate-back-button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #e1e6ec;
  border-radius: 9px;
  background: #fff;
  color: #192337;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.aggregate-new-button { padding: 0 16px; }
.aggregate-new-button span { font-size: 19px; font-weight: 400; }
.aggregate-new-button:hover,
.aggregate-back-button:hover { border-color: #cbd6e4; background: #f5f8fb; transform: translateY(-1px); }

.aggregate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(188px, 188px));
  align-items: start;
  gap: 18px;
  margin-top: 26px;
}

.aggregate-create-card,
.aggregate-playlist-card {
  display: grid;
  width: 188px;
  height: 252px;
  min-width: 0;
  padding: 12px;
  border-radius: 12px;
  color: #172136;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.aggregate-create-card {
  border: 1px dashed #cbd5e4;
  background: rgba(255, 255, 255, .6);
}

.aggregate-playlist-card {
  border: 1px solid #e3e7ec;
  background: #fff;
  box-shadow: 0 10px 26px rgba(52, 67, 88, .06);
}

.aggregate-create-card:hover,
.aggregate-playlist-card:hover {
  border-color: #9fbaf0;
  box-shadow: 0 14px 30px rgba(52, 67, 88, .1);
  transform: translateY(-2px);
}

.aggregate-create-visual,
.aggregate-card-visual {
  position: relative;
  display: grid;
  width: 162px;
  aspect-ratio: 1;
  margin-bottom: 12px;
  place-items: center;
  overflow: hidden;
  border-radius: 9px;
}

.aggregate-create-visual {
  border: 1px dashed #9db8ef;
  background: #f8faff;
  color: #6b7890;
  font-size: 34px;
  font-weight: 300;
}

.aggregate-card-visual {
  background: #dfe8f8;
  color: #5b6982;
}
.aggregate-card-visual img { width: 100%; height: 100%; object-fit: cover; }

.aggregate-card-index {
  position: absolute;
  z-index: 1;
  top: 11px;
  left: 12px;
  color: rgba(75, 91, 120, .7);
  font-size: 10px;
  font-weight: 800;
}
.aggregate-card-visual:has(img) .aggregate-card-index { padding: 3px 6px; border-radius: 5px; background: rgba(255,255,255,.82); color: #53617a; }

.aggregate-group-icon,
.aggregate-empty-icon {
  position: relative;
  display: block;
  width: 40px;
  height: 34px;
}

.aggregate-group-icon::before,
.aggregate-group-icon::after,
.aggregate-empty-icon::before,
.aggregate-empty-icon::after {
  position: absolute;
  background: currentColor;
  content: "";
}

.aggregate-group-icon::before,
.aggregate-empty-icon::before { top: 11px; left: 7px; width: 26px; height: 2px; }
.aggregate-group-icon::after,
.aggregate-empty-icon::after { top: 11px; left: 19px; width: 2px; height: 13px; }
.aggregate-group-icon i,
.aggregate-empty-icon i { position: absolute; width: 8px; height: 8px; border: 2px solid currentColor; border-radius: 2px; }
.aggregate-group-icon i:nth-child(1),
.aggregate-empty-icon i:nth-child(1) { top: 0; left: 16px; }
.aggregate-group-icon i:nth-child(2),
.aggregate-empty-icon i:nth-child(2) { bottom: 0; left: 2px; }
.aggregate-group-icon i:nth-child(3),
.aggregate-empty-icon i:nth-child(3) { bottom: 0; left: 16px; }
.aggregate-group-icon i:nth-child(4),
.aggregate-empty-icon i:nth-child(4) { right: 2px; bottom: 0; }

.aggregate-create-card strong,
.aggregate-playlist-card strong { overflow: hidden; font-size: 13px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.aggregate-create-card small,
.aggregate-playlist-card small,
.aggregate-playlist-card > span:not(.aggregate-card-visual) { margin-top: 5px; color: #7c899c; font-size: 11px; }

.aggregate-detail-title-row { display: flex; align-items: baseline; gap: 14px; margin-top: 18px; }
.aggregate-detail-title-row > span { color: #748198; font-size: 12px; font-weight: 700; }
.aggregate-back-button { padding: 0 14px; color: #3973d5; }
.aggregate-detail-actions { display: flex; align-items: center; gap: 9px; padding-top: 18px; }
.aggregate-detail-actions button { display: inline-flex; height: 36px; align-items: center; justify-content: center; gap: 7px; border: 1px solid #dce3eb; border-radius: 8px; padding: 0 13px; background: #fff; color: #526078; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; }
.aggregate-detail-actions button:hover:not(:disabled) { border-color: #aec1dc; background: #f4f7fb; color: #315fbd; }
.aggregate-detail-actions button:disabled { cursor: default; opacity: .45; }
.aggregate-detail-actions .icon-only { width: 36px; padding: 0; font-size: 16px; }

.aggregate-filter-bar { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
.aggregate-filter-bar label { display: flex; height: 36px; align-items: center; gap: 8px; border: 1px solid #dce3eb; border-radius: 8px; padding: 0 10px; background: #fff; color: #748198; font-size: 11px; font-weight: 700; }
.aggregate-filter-bar select { max-width: 180px; border: 0; background: transparent; color: #344157; font: inherit; outline: none; }

.aggregate-track-list { margin-top: 14px; }
.aggregate-track-head,
.aggregate-track-row { display: grid; grid-template-columns: 50px minmax(260px, 1fr) 260px 70px 46px; align-items: center; gap: 14px; }
.aggregate-track-head { min-height: 38px; padding: 0 14px; border-bottom: 1px solid #e3e7ec; color: #8692a5; font-size: 10px; font-weight: 700; }
.aggregate-track-head span:first-child { text-align: center; }
.aggregate-track-head span:last-child { text-align: center; }
.aggregate-track-row { min-height: 66px; padding: 8px 14px; border-bottom: 1px solid #edf0f3; cursor: pointer; outline: none; transition: background 150ms ease, opacity 150ms ease; }
.aggregate-track-row:hover,.aggregate-track-row:focus-visible { background: rgba(233, 239, 247, .62); }
.aggregate-track-row.is-dragging { opacity: .45; }
.aggregate-track-index,.aggregate-track-duration { color: #7b899e; font-size: 11px; }
.aggregate-track-index { text-align: center; }
.aggregate-track-copy { display: flex; min-width: 0; align-items: center; gap: 12px; }
.aggregate-track-copy img,.aggregate-track-fallback { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 7px; object-fit: cover; }
.aggregate-track-fallback { display: grid; place-items: center; background: #e3eaf4; color: #64728a; font-size: 15px; font-weight: 800; }
.aggregate-track-copy > span:last-child { display: grid; min-width: 0; gap: 4px; }
.aggregate-track-copy strong,.aggregate-track-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aggregate-track-copy strong { color: #172136; font-size: 13px; }
.aggregate-track-copy small { color: #7c899c; font-size: 11px; }
.aggregate-source-cell { display: grid; min-width: 0; grid-template-columns: minmax(0,1fr); align-items: center; }
.aggregate-source-label { overflow: hidden; color: #526078; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.aggregate-source-label.unavailable { color: #a1767a; }
.aggregate-source-switch select { width: 100%; height: 34px; border: 1px solid #dce3eb; border-radius: 8px; padding: 0 30px 0 11px; background: #fff; color: #526078; font: inherit; font-size: 11px; outline: none; }
.aggregate-source-switch select:hover,.aggregate-source-switch select:focus { border-color: #9eb6dd; background: #f8faff; }
.aggregate-remove-group { display: grid; width: 28px; height: 28px; place-items: center; justify-self: center; border: 0; border-radius: 50%; background: #eef1f4; color: #7f8998; cursor: pointer; font-size: 16px; line-height: 1; opacity: 0; transform: scale(.92); pointer-events: none; transition: background 150ms ease, color 150ms ease, opacity 150ms ease, transform 150ms ease; }
.aggregate-track-row:hover .aggregate-remove-group,
.aggregate-track-row:focus-within .aggregate-remove-group,
.aggregate-remove-group:focus-visible { opacity: 1; transform: scale(1); pointer-events: auto; }
.aggregate-remove-group:hover { background: #f4e5e6; color: #b44850; }

.aggregate-empty-state { display: grid; min-height: 360px; place-items: center; align-content: center; color: #8290a4; text-align: center; }
.aggregate-empty-state.compact { min-height: 240px; }
.aggregate-empty-icon { margin-bottom: 20px; color: #8493aa; transform: scale(1.15); }
.aggregate-empty-state strong { color: #344157; font-size: 15px; }
.aggregate-empty-state p { margin: 8px 0 0; font-size: 12px; }

.aggregate-dialog { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px; background: rgba(22, 28, 38, .46); }
.aggregate-dialog-panel { display: grid; width: min(380px, 100%); gap: 18px; padding: 28px; border: 1px solid rgba(255, 255, 255, .72); border-radius: 14px; background: #fff; box-shadow: 0 24px 70px rgba(20, 29, 43, .22); }
.aggregate-dialog-panel h2 { margin: 0; color: #172136; font-size: 18px; }
.aggregate-dialog-panel label { display: grid; gap: 8px; color: #637087; font-size: 11px; font-weight: 700; }
.aggregate-dialog-panel input { height: 42px; border: 1px solid #dce2e9; border-radius: 8px; padding: 0 13px; background: #f8f9fa; color: #172136; font: inherit; outline: none; }
.aggregate-dialog-panel input:focus { border-color: #82a7e8; background: #fff; }
.aggregate-dialog-error { margin: -10px 0 0; color: #c15159; font-size: 11px; }
.aggregate-dialog-actions { display: flex; justify-content: flex-end; gap: 10px; }
.aggregate-dialog-actions button { min-width: 70px; height: 38px; border: 0; border-radius: 8px; background: #f0f2f4; color: #4e596c; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; }
.aggregate-dialog-actions button:hover { background: #e7eaee; }
.aggregate-dialog-actions .primary { background: #315fbd; color: #fff; }
.aggregate-dialog-actions .primary:hover { background: #2854ae; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }

@media (max-width: 760px) {
  .aggregate-header { align-items: stretch; flex-direction: column; }
  .aggregate-new-button { align-self: flex-start; }
  .aggregate-detail-header { flex-direction: column; }
  .aggregate-detail-actions { padding-top: 0; }
  .aggregate-filter-bar { justify-content: flex-start; flex-wrap: wrap; }
  .aggregate-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .aggregate-create-card,.aggregate-playlist-card { width: 100%; }
  .aggregate-create-visual,.aggregate-card-visual { width: 100%; }
  .aggregate-track-head { display: none; }
  .aggregate-track-row { grid-template-columns: 34px minmax(0, 1fr) 130px 34px; }
  .aggregate-track-duration { display: none; }
}
</style>
