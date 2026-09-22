<script setup lang="ts">
import { CircleEllipsis, Heart, Pause, Play } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import PlayerControlButton from "./PlayerControlButton.vue";

interface MiniTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  primary: string;
  secondary: string;
  mark: string;
  liked?: boolean;
  queueKey?: string;
}

interface MiniQueueTrack extends MiniTrack {}

interface MiniPlaylist {
  id: string;
  title: string;
  count: number;
}

const props = defineProps<{
  track: MiniTrack;
  queue: MiniQueueTrack[];
  queueOpen: boolean;
  queueShellOpen: boolean;
  playlists: MiniPlaylist[];
  coverUrl?: string;
  isPlaying: boolean;
  progress: number;
  lyric: string;
  themeStyle: Record<string, string>;
  nativeWindow: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  previous: [];
  next: [];
  like: [];
  queue: [];
  queueDismiss: [];
  queueTransitionEnd: [];
  queueTrackPlay: [track: MiniQueueTrack];
  queueTrackLike: [track: MiniQueueTrack];
  queueTrackRemove: [queueKey: string];
  queueTrackAddPlaylist: [track: MiniQueueTrack, playlistId: string];
  queueTrackCreatePlaylist: [track: MiniQueueTrack, name: string];
  queueTrackCopy: [track: MiniQueueTrack];
  close: [];
}>();

const CARD_WIDTH = 380;
const CARD_HEIGHT = 132;
const CARD_EXPANDED_HEIGHT = 341;
const EDGE_GAP = 12;
const miniPlayerElement = ref<HTMLElement | null>(null);
const position = ref({ x: EDGE_GAP, y: EDGE_GAP });
const activeMenuKey = ref<string | null>(null);
const playlistPickerKey = ref<string | null>(null);
const newPlaylistName = ref("");
const actionNotice = ref("");
const queueScrolling = ref(false);
let actionNoticeTimer: ReturnType<typeof window.setTimeout> | undefined;
let queueScrollTimer: ReturnType<typeof window.setTimeout> | undefined;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragging = false;

const cardStyle = computed(() => ({
  ...props.themeStyle,
  ...(props.nativeWindow ? {} : {
    left: `${position.value.x}px`,
    top: `${position.value.y}px`
  }),
  "--mini-progress": `${Math.min(100, Math.max(0, props.progress)) * 3.6}deg`
}));

function currentCardHeight() {
  if (!props.queueShellOpen) return CARD_HEIGHT;
  return Math.min(CARD_EXPANDED_HEIGHT, Math.max(CARD_HEIGHT, window.innerHeight - EDGE_GAP * 2));
}

function clampPosition(x: number, y: number) {
  return {
    x: Math.max(EDGE_GAP, Math.min(x, window.innerWidth - CARD_WIDTH - EDGE_GAP)),
    y: Math.max(EDGE_GAP, Math.min(y, window.innerHeight - currentCardHeight() - EDGE_GAP))
  };
}

function queueTrackKey(track: MiniQueueTrack, index: number) {
  return track.queueKey ?? `${track.id}::mini-${index}`;
}

function isCurrentTrack(track: MiniQueueTrack) {
  if (track.queueKey && props.track.queueKey) return track.queueKey === props.track.queueKey;
  return track.id === props.track.id;
}

function toggleQueueTrackPlayback(track: MiniQueueTrack) {
  if (isCurrentTrack(track)) {
    emit("toggle");
    return;
  }
  emit("queueTrackPlay", track);
}

function showNotice(message: string) {
  actionNotice.value = message;
  if (actionNoticeTimer !== undefined) window.clearTimeout(actionNoticeTimer);
  actionNoticeTimer = window.setTimeout(() => {
    actionNotice.value = "";
    actionNoticeTimer = undefined;
  }, 1800);
}

function closeMenus() {
  activeMenuKey.value = null;
  playlistPickerKey.value = null;
  newPlaylistName.value = "";
}

function toggleMoreMenu(track: MiniQueueTrack, index: number) {
  const key = queueTrackKey(track, index);
  activeMenuKey.value = activeMenuKey.value === key ? null : key;
  playlistPickerKey.value = null;
  newPlaylistName.value = "";
}

function openPlaylistPicker(track: MiniQueueTrack, index: number) {
  playlistPickerKey.value = queueTrackKey(track, index);
}

function addToPlaylist(track: MiniQueueTrack, playlistId: string) {
  emit("queueTrackAddPlaylist", track, playlistId);
  showNotice("已加入歌单");
  closeMenus();
}

function createPlaylist(track: MiniQueueTrack) {
  const name = newPlaylistName.value.trim();
  if (!name) return;
  emit("queueTrackCreatePlaylist", track, name);
  showNotice(`已新建「${name}」并加入歌曲`);
  closeMenus();
}

function removeTrack(track: MiniQueueTrack, index: number) {
  emit("queueTrackRemove", queueTrackKey(track, index));
  closeMenus();
}

function copyTrackInfo(track: MiniQueueTrack) {
  emit("queueTrackCopy", track);
  showNotice("歌曲信息已复制");
  closeMenus();
}

function handleQueueScroll() {
  queueScrolling.value = true;
  if (queueScrollTimer !== undefined) window.clearTimeout(queueScrollTimer);
  queueScrollTimer = window.setTimeout(() => {
    queueScrolling.value = false;
    queueScrollTimer = undefined;
  }, 550);
}

function dismissQueue() {
  if (!props.queueOpen) return;
  closeMenus();
  emit("queueDismiss");
}

function finishQueueLeave() {
  emit("queueTransitionEnd");
}

function handleOutsidePointerDown(event: PointerEvent) {
  if (!props.queueOpen) return;
  const target = event.target;
  if (target instanceof Node && miniPlayerElement.value?.contains(target)) return;
  dismissQueue();
}

function moveDrag(event: PointerEvent) {
  if (!dragging) return;
  position.value = clampPosition(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
}

function stopDrag() {
  dragging = false;
  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", stopDrag);
  window.removeEventListener("pointercancel", stopDrag);
}

function startDrag(event: PointerEvent) {
  if (props.nativeWindow || props.queueShellOpen || event.button !== 0 || (event.target as HTMLElement).closest("button,input")) return;
  dragging = true;
  dragOffsetX = event.clientX - position.value.x;
  dragOffsetY = event.clientY - position.value.y;
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", stopDrag);
  window.addEventListener("pointercancel", stopDrag);
  event.preventDefault();
}

function clampToWindow() {
  position.value = clampPosition(position.value.x, position.value.y);
}

watch(() => props.queueOpen, async (open) => {
  if (!open) closeMenus();
  await nextTick();
  if (!props.nativeWindow) clampToWindow();
});

onMounted(() => {
  position.value = clampPosition(window.innerWidth - CARD_WIDTH - 28, 88);
  window.addEventListener("resize", clampToWindow);
  window.addEventListener("blur", dismissQueue);
  document.addEventListener("pointerdown", handleOutsidePointerDown, true);
});

onBeforeUnmount(() => {
  stopDrag();
  if (actionNoticeTimer !== undefined) window.clearTimeout(actionNoticeTimer);
  if (queueScrollTimer !== undefined) window.clearTimeout(queueScrollTimer);
  window.removeEventListener("resize", clampToWindow);
  window.removeEventListener("blur", dismissQueue);
  document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
});
</script>

<template>
  <aside
    ref="miniPlayerElement"
    class="mini-player"
    :class="{ 'is-playing': props.isPlaying, 'is-native-window': props.nativeWindow, 'is-queue-open': props.queueShellOpen }"
    :style="cardStyle"
    aria-label="迷你播放器"
    @pointerdown="startDrag"
  >
    <section class="mini-header">
      <div class="mini-main">
        <button class="mini-cover-button" type="button" :title="props.isPlaying ? '暂停' : '播放'" :aria-label="props.isPlaying ? '暂停' : '播放'" @click.stop="emit('toggle')">
          <span class="mini-cover-ring">
            <span class="mini-cover" :style="{ background: `linear-gradient(135deg, ${props.track.primary}, ${props.track.secondary})` }">
              <img v-if="props.coverUrl" :src="props.coverUrl" :alt="`${props.track.title}封面`" />
              <span v-else aria-hidden="true">{{ props.track.mark }}</span>
            </span>
          </span>
        </button>

        <div class="mini-copy">
          <div v-if="props.isPlaying" class="mini-lyric" aria-live="polite">
            <span :key="props.lyric">{{ props.lyric || "纯音乐，请欣赏" }}</span>
          </div>
          <div v-else class="mini-track-info">
            <strong>{{ props.track.title }}</strong>
            <span>{{ props.track.artist }}<template v-if="props.track.album"> · {{ props.track.album }}</template></span>
          </div>
        </div>
      </div>

      <button class="mini-close-button" type="button" title="关闭迷你播放器" aria-label="关闭迷你播放器" @click="emit('close')">×</button>

      <div class="mini-controls" aria-label="迷你播放器控制" @pointerdown.stop>
        <PlayerControlButton kind="like" compact :liked="props.track.liked" @activate="emit('like')" />
        <PlayerControlButton kind="previous" compact @activate="emit('previous')" />
        <PlayerControlButton kind="toggle" compact :is-playing="props.isPlaying" @activate="emit('toggle')" />
        <PlayerControlButton kind="next" compact @activate="emit('next')" />
        <PlayerControlButton kind="queue" compact @activate="emit('queue')" />
      </div>
    </section>

    <Transition name="mini-queue" @after-leave="finishQueueLeave">
      <section v-if="props.queueOpen" class="mini-queue-panel" aria-label="迷你播放器播放列表" @pointerdown.stop @click="closeMenus">
        <div
          v-if="props.queue.length"
          class="mini-queue-list"
          :class="{ 'is-scrolling': queueScrolling }"
          @scroll.passive="handleQueueScroll"
        >
          <article
            v-for="(track, index) in props.queue"
            :key="queueTrackKey(track, index)"
            class="mini-queue-track"
            :class="{ active: isCurrentTrack(track) }"
            @click="closeMenus"
          >
            <button class="mini-queue-copy" type="button" @click.stop="toggleQueueTrackPlayback(track)">
              <span class="mini-queue-title-line"><strong>{{ track.title }}</strong><span> - {{ track.artist }}</span></span>
            </button>
            <div class="mini-queue-actions">
              <button
                class="mini-queue-play"
                type="button"
                :title="isCurrentTrack(track) && props.isPlaying ? '暂停' : `播放 ${track.title}`"
                :aria-label="isCurrentTrack(track) && props.isPlaying ? '暂停' : `播放 ${track.title}`"
                @click.stop="toggleQueueTrackPlayback(track)"
              >
                <Pause v-if="isCurrentTrack(track) && props.isPlaying" :size="16" :stroke-width="1.6" aria-hidden="true" />
                <Play v-else :size="16" :stroke-width="1.6" aria-hidden="true" />
              </button>
              <button class="mini-queue-like" type="button" :class="{ liked: track.liked }" :title="track.liked ? '取消收藏' : '收藏'" :aria-label="track.liked ? '取消收藏' : '收藏'" @click.stop="emit('queueTrackLike', track)">
                <Heart :size="16" :stroke-width="1.6" :fill="track.liked ? 'currentColor' : 'none'" aria-hidden="true" />
              </button>
              <button class="mini-queue-more" type="button" title="更多" aria-label="更多" @click.stop="toggleMoreMenu(track, index)">
                <CircleEllipsis :size="16" :stroke-width="1.6" aria-hidden="true" />
              </button>
            </div>

            <div v-if="activeMenuKey === queueTrackKey(track, index)" class="mini-queue-more-menu" @click.stop>
              <template v-if="playlistPickerKey !== queueTrackKey(track, index)">
                <button type="button" @click="removeTrack(track, index)">从播放列表移除</button>
                <button type="button" @click="openPlaylistPicker(track, index)">添加到歌单</button>
                <button type="button" @click="copyTrackInfo(track)">复制歌曲信息</button>
              </template>
              <template v-else>
                <div class="mini-playlist-picker-title">
                  <button type="button" aria-label="返回更多操作" @click="playlistPickerKey = null">‹</button>
                  <strong>添加到歌单</strong>
                </div>
                <div class="mini-playlist-targets">
                  <button v-for="playlist in props.playlists" :key="playlist.id" type="button" @click="addToPlaylist(track, playlist.id)">
                    <span>{{ playlist.title }}</span><small>{{ playlist.count }} 首</small>
                  </button>
                </div>
                <form class="mini-playlist-create" @submit.prevent="createPlaylist(track)">
                  <input v-model="newPlaylistName" type="text" maxlength="40" placeholder="新歌单名称" aria-label="新歌单名称" />
                  <button type="submit" :disabled="!newPlaylistName.trim()">新建歌单</button>
                </form>
              </template>
            </div>
          </article>
        </div>
        <div v-else class="mini-queue-empty">播放列表是空的</div>
        <p v-if="actionNotice" class="mini-action-notice" role="status">{{ actionNotice }}</p>
      </section>
    </Transition>
  </aside>
</template>

<style scoped>
@property --detail-player-start { syntax: "<color>"; inherits: true; initial-value: #f7f9fa; }
@property --detail-player-end { syntax: "<color>"; inherits: true; initial-value: #f3f6f8; }

.mini-player {
  position: fixed;
  z-index: 90;
  display: grid;
  width: 380px;
  height: 132px;
  grid-template-rows: 132px minmax(0,1fr);
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.74);
  border-radius: 24px;
  background: linear-gradient(135deg,var(--detail-player-start,#f7f9fa),rgba(255,255,255,.9) 48%,var(--detail-player-end,#f3f6f8));
  box-shadow: 0 18px 45px rgba(35,47,55,.2),0 3px 12px rgba(35,47,55,.08);
  color: #263338;
  cursor: grab;
  user-select: none;
  transition: height 220ms ease,border-radius 220ms ease,--detail-player-start 400ms ease,--detail-player-end 400ms ease,box-shadow 300ms ease;
  backdrop-filter: blur(18px);
}
.mini-player.is-queue-open { height: min(341px,calc(100vh - 24px)); border-radius: 20px; cursor: default; }
.mini-player:active { cursor: grabbing; }
.mini-player.is-queue-open:active { cursor: default; }
.mini-player:hover { box-shadow: 0 21px 52px rgba(35,47,55,.23),0 4px 14px rgba(35,47,55,.1); }
.mini-player.is-native-window { inset: 8px; width: auto; height: auto; grid-template-rows: 129px minmax(0,1fr); -webkit-app-region: drag; }
.mini-player.is-native-window button,.mini-player.is-native-window input,.mini-player.is-native-window .mini-queue-panel { -webkit-app-region: no-drag; }
.mini-header { position: relative; min-height: 0; }
.mini-main { display: grid; height: 100%; grid-template-columns: 82px minmax(0,1fr); align-items: center; gap: 14px; padding: 14px 20px 40px 14px; }
.mini-cover-button { display: grid; width: 72px; height: 72px; place-items: center; border: 0; border-radius: 50%; padding: 0; background: transparent; cursor: pointer; }
.mini-cover-ring { display: grid; width: 72px; height: 72px; place-items: center; border-radius: 50%; background: conic-gradient(#20c98b var(--mini-progress),rgba(148,163,184,.25) 0); box-shadow: 0 8px 20px rgba(42,81,75,.18); transition: background 220ms linear; }
.mini-cover { display: grid; width: 64px; height: 64px; place-items: center; overflow: hidden; border: 3px solid rgba(255,255,255,.94); border-radius: 50%; color: #fff; font-size: 19px; font-weight: 850; }
.mini-cover img { width: 100%; height: 100%; object-fit: cover; }
.mini-copy { min-width: 0; overflow: hidden; padding-right: 24px; }
.mini-lyric { width: 100%; overflow: hidden; color: #26343d; font-size: 17px; font-weight: 800; line-height: 1.45; white-space: nowrap; }
.mini-lyric span { display: inline-block; min-width: 100%; padding-right: 36px; animation: mini-lyric-drift 8s linear infinite alternate; }
.mini-track-info { display: grid; min-width: 0; gap: 7px; }
.mini-track-info strong,.mini-track-info span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini-track-info strong { color: #202b35; font-size: 17px; font-weight: 850; }
.mini-track-info span { color: #85909b; font-size: 11px; }
.mini-controls { position: absolute; right: 40px; bottom: 8px; left: 104px; display: flex; height: 34px; align-items: center; justify-content: center; gap: 5px; border: 1px solid rgba(255,255,255,.7); border-radius: 17px; padding: 0 4px; background: rgba(255,255,255,.66); box-shadow: 0 8px 20px rgba(43,55,64,.1); opacity: 0; transform: translateY(7px); pointer-events: none; transition: opacity 300ms ease,transform 300ms ease; backdrop-filter: blur(12px); }
.mini-player:hover .mini-controls,.mini-player:focus-within .mini-controls { opacity: 1; transform: translateY(0); pointer-events: auto; }
.mini-close-button { position: absolute; top: 8px; right: 8px; z-index: 2; display: grid; width: 29px; height: 29px; place-items: center; border: 0; border-radius: 50%; background: rgba(255,255,255,.72); color: #697174; cursor: pointer; font-size: 18px; line-height: 1; opacity: 0; pointer-events: none; transform: translateY(-5px); transition: opacity 280ms ease,color 150ms ease,background-color 150ms ease,transform 280ms ease; }
.mini-player:hover .mini-close-button,.mini-close-button:focus-visible { opacity: 1; pointer-events: auto; transform: translateY(0); }
.mini-close-button:hover { background: #f5e9eb; color: #b34450; }

.mini-queue-panel { position: relative; display: grid; min-height: 0; grid-template-rows: minmax(0,1fr); border-top: 1px solid rgba(223,228,229,.9); background: rgba(255,255,255,.96); cursor: default; }
.mini-queue-list { height: 208px; min-height: 0; overflow-x: hidden; overflow-y: auto; scrollbar-color: transparent transparent; scrollbar-width: thin; }
.mini-queue-list.is-scrolling { scrollbar-color: #cbd4d1 transparent; }
.mini-queue-list::-webkit-scrollbar { width: 5px; }
.mini-queue-list::-webkit-scrollbar-track { background: transparent; }
.mini-queue-list::-webkit-scrollbar-thumb { border-radius: 999px; background: #cbd4d1; }
.mini-queue-list:not(.is-scrolling)::-webkit-scrollbar-thumb { background: transparent; }
.mini-queue-track { position: relative; display: grid; height: 52px; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 7px; border-radius: 8px; padding: 4px 8px 4px 12px; color: #20282b; transition: background-color 150ms ease; }
.mini-queue-track:hover,.mini-queue-track:focus-within { background: #f2f6f4; }
.mini-queue-track.active .mini-queue-copy strong,.mini-queue-track.active .mini-queue-copy span { color: #16a36a; }
.mini-queue-play,.mini-queue-like,.mini-queue-more { display: grid; width: 28px; height: 28px; place-items: center; border: 0; border-radius: 50%; padding: 0; background: transparent; color: #252b2d; cursor: pointer; transition: background-color 150ms ease,color 150ms ease,transform 150ms ease; }
.mini-queue-play svg,.mini-queue-like svg,.mini-queue-more svg { display: block; flex: 0 0 auto; }
.mini-queue-play:hover,.mini-queue-like:hover,.mini-queue-more:hover { background: #e7eeeb; transform: translateY(-1px); }
.mini-queue-play:hover,.mini-queue-more:hover { color: #16a36a; }
.mini-queue-copy { display: block; min-width: 0; overflow: hidden; border: 0; padding: 0; background: transparent; cursor: pointer; text-align: left; }
.mini-queue-title-line { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini-queue-copy strong,.mini-queue-copy span { overflow: hidden; color: #20282b; text-overflow: ellipsis; white-space: nowrap; }
.mini-queue-copy strong { font-size: 12px; font-weight: 750; }
.mini-queue-copy span { color: #7d878b; font-size: 10px; }
.mini-queue-actions { display: flex; align-items: center; gap: 3px; opacity: 0; pointer-events: none; transition: opacity 150ms ease; }
.mini-queue-track:hover .mini-queue-actions,.mini-queue-track:focus-within .mini-queue-actions { opacity: 1; pointer-events: auto; }
.mini-queue-like { color: #252b2d; }
.mini-queue-like.liked { color: #ff6674; }
.mini-queue-like:hover { color: #ff6674; }
.mini-queue-more-menu { position: absolute; top: 40px; right: 7px; z-index: 8; display: grid; width: 168px; overflow: hidden; border: 1px solid #e1e6e4; border-radius: 10px; padding: 5px; background: #fff; box-shadow: 0 13px 30px rgba(35,47,50,.18); }
.mini-queue-more-menu>button { border: 0; border-radius: 7px; padding: 8px 9px; background: transparent; color: #30393d; cursor: pointer; font-size: 11px; text-align: left; }
.mini-queue-more-menu>button:hover { background: #f0f5f2; color: #16895d; }
.mini-playlist-picker-title { display: grid; grid-template-columns: 25px 1fr 25px; align-items: center; padding: 2px 2px 5px; }
.mini-playlist-picker-title button { display: grid; width: 25px; height: 25px; place-items: center; border: 0; border-radius: 6px; background: transparent; color: #697478; cursor: pointer; font-size: 20px; }
.mini-playlist-picker-title strong { font-size: 11px; text-align: center; }
.mini-playlist-targets { display: grid; max-height: 122px; gap: 2px; overflow-y: auto; }
.mini-playlist-targets button { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 0; border-radius: 7px; padding: 7px 8px; background: transparent; color: #30393d; cursor: pointer; text-align: left; }
.mini-playlist-targets button:hover { background: #f0f5f2; color: #16895d; }
.mini-playlist-targets span { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.mini-playlist-targets small { flex: 0 0 auto; color: #98a19f; font-size: 9px; }
.mini-playlist-create { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 5px; margin-top: 5px; border-top: 1px solid #edf0ef; padding-top: 6px; }
.mini-playlist-create input { width: 100%; min-width: 0; height: 28px; border: 1px solid #dce3e1; border-radius: 7px; padding: 0 7px; color: #263033; font-size: 10px; outline: none; }
.mini-playlist-create input:focus { border-color: #54b68c; }
.mini-playlist-create button { border: 0; border-radius: 7px; padding: 0 8px; background: #1b9b6a; color: #fff; cursor: pointer; font-size: 10px; }
.mini-playlist-create button:disabled { background: #d7dedb; cursor: default; }
.mini-queue-empty { display: grid; place-items: center; color: #9ba3a5; font-size: 11px; }
.mini-action-notice { position: absolute; right: 12px; bottom: 10px; z-index: 10; margin: 0; border-radius: 999px; padding: 6px 10px; background: rgba(26,37,40,.88); color: #fff; font-size: 10px; box-shadow: 0 5px 14px rgba(35,47,50,.2); }
.mini-queue-enter-active,.mini-queue-leave-active { transform-origin: top center; will-change: opacity,transform; transition: opacity 220ms ease,transform 220ms cubic-bezier(.22,1,.36,1); }
.mini-queue-enter-from,.mini-queue-leave-to { opacity: 0; transform: translateY(-10px) scaleY(.96); }

@keyframes mini-lyric-drift { from { transform: translateX(0); } to { transform: translateX(-24%); } }

@media (max-width: 520px) {
  .mini-player { width: calc(100vw - 24px); }
}

@media (prefers-reduced-motion: reduce) {
  .mini-player,.mini-controls,.mini-close-button,.mini-cover-ring,.mini-queue-enter-active,.mini-queue-leave-active { transition-duration: .01ms!important; }
  .mini-lyric span { animation: none; }
}
</style>
