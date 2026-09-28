<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  History,
  LoaderCircle,
  Music2,
  Play,
  Plus,
  UserRound
} from "lucide-vue-next";
import type { AccountProfileView, AccountView } from "../services/api";

interface LibraryTrack {
  id: string;
  coverUrl?: string;
}

interface LibraryPlaylist {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  imageUrl?: string;
  createdByAccount?: boolean;
}

type PlaylistTab = "all" | "created" | "collected";

const props = defineProps<{
  account: AccountView | null;
  accounts: AccountView[];
  profile: AccountProfileView | null;
  followingCount: number;
  favoriteTracks: LibraryTrack[];
  recentTracks: LibraryTrack[];
  rankingTracks: LibraryTrack[];
  playlists: LibraryPlaylist[];
  provider: "netease" | "qq";
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  (event: "change-provider", provider: "netease" | "qq"): void;
  (event: "open-following"): void;
  (event: "open-followers"): void;
  (event: "open-favorites"): void;
  (event: "play-favorites"): void;
  (event: "open-recent"): void;
  (event: "open-ranking"): void;
  (event: "open-playlist", playlist: LibraryPlaylist): void;
  (event: "create-playlist"): void;
  (event: "login"): void;
}>();

const sourceMenuOpen = ref(false);
const playlistTab = ref<PlaylistTab>("all");
const playlistOrder = ref<string[]>([]);
const draggedPlaylistId = ref<string | null>(null);
const providerName = computed(() => props.provider === "qq" ? "QQ 音乐" : "网易云音乐");
const displayName = computed(() => props.profile?.nickname || props.account?.nickname || "未登录用户");
const avatarUrl = computed(() => props.profile?.avatarUrl || props.account?.avatarUrl || "");
const signature = computed(() => props.profile?.signature?.trim() || "暂无个人简介");
const favoriteCover = computed(() => props.favoriteTracks.find((track) => track.coverUrl)?.coverUrl || "");
const playlistOrderStorageKey = computed(() => (
  `listenmusic:account-playlist-order:${props.provider}:${props.account?.userId || "anonymous"}`
));
const createdPlaylistCount = computed(() => props.playlists.filter((playlist) => playlist.createdByAccount).length);
const collectedPlaylistCount = computed(() => props.playlists.length - createdPlaylistCount.value);
const orderedPlaylists = computed(() => {
  const positions = new Map(playlistOrder.value.map((id, index) => [id, index]));
  return [...props.playlists].sort((left, right) => (
    (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  ));
});
const visiblePlaylists = computed(() => orderedPlaylists.value.filter((playlist) => {
  if (playlistTab.value === "created") return playlist.createdByAccount;
  if (playlistTab.value === "collected") return !playlist.createdByAccount;
  return true;
}));

watch(
  [playlistOrderStorageKey, () => props.playlists.map((playlist) => playlist.id).join("|")],
  () => {
    let storedOrder: string[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(playlistOrderStorageKey.value) || "[]");
      storedOrder = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      storedOrder = [];
    }
    const availableIds = new Set(props.playlists.map((playlist) => playlist.id));
    playlistOrder.value = [
      ...storedOrder.filter((id) => availableIds.has(id)),
      ...props.playlists.map((playlist) => playlist.id).filter((id) => !storedOrder.includes(id))
    ];
  },
  { immediate: true }
);

function openOrLogin(action: "favorites" | "recent" | "ranking") {
  if (!props.account) {
    emit("login");
    return;
  }
  if (action === "favorites") emit("open-favorites");
  if (action === "recent") emit("open-recent");
  if (action === "ranking") emit("open-ranking");
}

function chooseProvider(provider: "netease" | "qq") {
  sourceMenuOpen.value = false;
  emit("change-provider", provider);
}

function providerAvailable(provider: "netease" | "qq") {
  return props.accounts.some((account) => account.provider === provider);
}

function persistPlaylistOrder() {
  localStorage.setItem(playlistOrderStorageKey.value, JSON.stringify(playlistOrder.value));
}

function reorderPlaylist(sourceId: string, targetId: string, placeAfter = false) {
  if (sourceId === targetId) return;
  const nextOrder = [...playlistOrder.value];
  const sourceIndex = nextOrder.indexOf(sourceId);
  if (sourceIndex < 0) return;
  nextOrder.splice(sourceIndex, 1);
  const targetIndex = nextOrder.indexOf(targetId);
  if (targetIndex < 0) return;
  nextOrder.splice(targetIndex + (placeAfter ? 1 : 0), 0, sourceId);
  playlistOrder.value = nextOrder;
  persistPlaylistOrder();
}

function handlePlaylistKeydown(event: KeyboardEvent, playlist: LibraryPlaylist) {
  if (!event.altKey) return;
  const direction = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
  if (!direction) return;
  const visibleIndex = visiblePlaylists.value.findIndex((item) => item.id === playlist.id);
  const target = visiblePlaylists.value[visibleIndex + direction];
  if (!target) return;
  event.preventDefault();
  reorderPlaylist(playlist.id, target.id, direction > 0);
}

function finishPlaylistDrop(targetId: string) {
  if (draggedPlaylistId.value) reorderPlaylist(draggedPlaylistId.value, targetId);
  draggedPlaylistId.value = null;
}

function openPlaylist(playlist: LibraryPlaylist) {
  emit('open-playlist', playlist);
}

function requestCreatePlaylist() {
  if (props.provider === "netease") emit('create-playlist');
}
</script>

<template>
  <section class="streaming-library-page" aria-label="音乐库概览">
    <div v-if="!account" class="streaming-library-login" role="status">
      <UserRound :size="54" :stroke-width="1.5" aria-hidden="true" />
      <h2>请先登录 {{ providerName }}</h2>
      <p>登录后即可加载全部音乐库</p>
      <small v-if="error">{{ error }}</small>
      <button type="button" @click="emit('login')">
        <UserRound :size="16" :stroke-width="2" aria-hidden="true" />
        {{ provider === 'netease' ? '扫码登录' : '账号登录' }}
      </button>
    </div>

    <div v-else class="streaming-library-grid">
      <article
        class="streaming-library-card profile-card"
      >
        <div class="profile-identity">
          <span class="profile-avatar">
            <img v-if="avatarUrl" :src="avatarUrl" :alt="`${displayName}头像`" />
            <UserRound v-else :size="34" :stroke-width="1.6" aria-hidden="true" />
            <LoaderCircle v-if="loading" class="profile-loading" :size="18" aria-hidden="true" />
          </span>
          <div class="profile-copy">
            <span>{{ providerName }}个人音乐库</span>
            <h2>{{ displayName }}</h2>
            <p>{{ signature }}</p>
            <div class="profile-stats" aria-label="账户统计">
              <button type="button" @click.stop="emit('open-following')">
                <strong>{{ followingCount }}</strong> 关注
              </button>
              <button type="button" @click.stop="emit('open-followers')">
                <strong>{{ profile?.followers ?? 0 }}</strong> 粉丝
              </button>
            </div>
          </div>
        </div>

        <div class="library-source-picker" @click.stop>
          <button
            class="library-source-trigger"
            :class="{ active: sourceMenuOpen }"
            type="button"
            :aria-expanded="sourceMenuOpen"
            @click="sourceMenuOpen = !sourceMenuOpen"
          >
            <Cloud :size="15" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ providerName }}</span>
            <ChevronUp v-if="sourceMenuOpen" :size="13" :stroke-width="2" aria-hidden="true" />
            <ChevronDown v-else :size="13" :stroke-width="2" aria-hidden="true" />
          </button>
          <Transition name="library-source-menu">
            <div v-if="sourceMenuOpen" class="library-source-menu" role="menu">
              <button type="button" :class="{ selected: provider === 'netease' }" @click="chooseProvider('netease')">
                <Cloud :size="15" aria-hidden="true" />
                <span class="source-option-copy">
                  <strong>网易云音乐</strong>
                  <small>{{ providerAvailable('netease') ? '音源可用' : '未登录' }}</small>
                </span>
                <Check v-if="provider === 'netease'" :size="15" aria-hidden="true" />
              </button>
              <button type="button" :class="{ selected: provider === 'qq' }" @click="chooseProvider('qq')">
                <Music2 :size="15" aria-hidden="true" />
                <span class="source-option-copy">
                  <strong>QQ 音乐</strong>
                  <small>{{ providerAvailable('qq') ? '音源可用' : '未登录' }}</small>
                </span>
                <Check v-if="provider === 'qq'" :size="15" aria-hidden="true" />
              </button>
            </div>
          </Transition>
        </div>
      </article>

      <article
        class="streaming-library-card favorites-card"
        role="button"
        tabindex="0"
        @click="openOrLogin('favorites')"
        @keydown.enter="openOrLogin('favorites')"
      >
        <div class="favorites-copy">
          <span class="favorites-badge">我的喜欢</span>
          <h2>我喜欢的歌曲</h2>
          <p>{{ favoriteTracks.length }} 首歌曲</p>
          <button
            class="favorites-play"
            type="button"
            :disabled="favoriteTracks.length === 0"
            @click.stop="emit('play-favorites')"
          >
            <Play :size="16" fill="currentColor" aria-hidden="true" />
            播放全部
          </button>
        </div>
        <div class="favorites-art" aria-hidden="true">
          <img v-if="favoriteCover" :src="favoriteCover" alt="" />
          <span v-else></span>
        </div>
      </article>

      <article
        class="streaming-library-card shortcut-card recent-card"
        role="button"
        tabindex="0"
        @click="openOrLogin('recent')"
        @keydown.enter="openOrLogin('recent')"
      >
        <div>
          <span class="shortcut-icon"><History :size="20" :stroke-width="1.8" aria-hidden="true" /></span>
          <h2>最近播放</h2>
          <p>回顾您最近的音乐足迹<span v-if="recentTracks.length"> · {{ recentTracks.length }} 首</span></p>
        </div>
        <span class="shortcut-arrow" aria-hidden="true"><ArrowRight :size="24" :stroke-width="1.8" /></span>
      </article>

      <article
        class="streaming-library-card shortcut-card ranking-card"
        role="button"
        tabindex="0"
        @click="openOrLogin('ranking')"
        @keydown.enter="openOrLogin('ranking')"
      >
        <div>
          <span class="shortcut-icon"><BarChart3 :size="20" :stroke-width="1.8" aria-hidden="true" /></span>
          <h2>听歌排行</h2>
          <p>探索您的本周常听榜单<span v-if="rankingTracks.length"> · {{ rankingTracks.length }} 首</span></p>
        </div>
        <span class="shortcut-arrow" aria-hidden="true"><ArrowRight :size="24" :stroke-width="1.8" /></span>
      </article>

      <section class="account-playlists-section" aria-labelledby="account-playlists-title">
        <header class="account-playlists-header">
          <div>
            <h2 id="account-playlists-title">我的歌单</h2>
            <p>{{ playlists.length }} 个在线列表</p>
          </div>
          <button
            class="create-playlist-button"
            type="button"
            :disabled="provider !== 'netease'"
            :title="provider === 'netease' ? '创建歌单' : '当前音源暂不支持创建歌单'"
            @click="requestCreatePlaylist"
          >
            <Plus :size="17" :stroke-width="2" aria-hidden="true" />
            创建歌单
          </button>
        </header>

        <div class="playlist-tabs" role="tablist" aria-label="歌单分类">
          <button type="button" role="tab" :aria-selected="playlistTab === 'all'" :class="{ active: playlistTab === 'all' }" @click="playlistTab = 'all'">
            全部 <span>{{ playlists.length }}</span>
          </button>
          <button type="button" role="tab" :aria-selected="playlistTab === 'created'" :class="{ active: playlistTab === 'created' }" @click="playlistTab = 'created'">
            我创建的 <span>{{ createdPlaylistCount }}</span>
          </button>
          <button type="button" role="tab" :aria-selected="playlistTab === 'collected'" :class="{ active: playlistTab === 'collected' }" @click="playlistTab = 'collected'">
            我收藏的 <span>{{ collectedPlaylistCount }}</span>
          </button>
        </div>

        <p class="playlist-sort-hint">长按歌单拖动排序；置顶优先。键盘可用 Alt + ↑ / ↓ 调整。</p>

        <div v-if="visiblePlaylists.length" class="account-playlist-list">
          <button
            v-for="playlist in visiblePlaylists"
            :key="playlist.id"
            class="account-playlist-item"
            type="button"
            draggable="true"
            @click="openPlaylist(playlist)"
            @keydown="handlePlaylistKeydown($event, playlist)"
            @dragstart="draggedPlaylistId = playlist.id"
            @dragend="draggedPlaylistId = null"
            @dragover.prevent
            @drop.prevent="finishPlaylistDrop(playlist.id)"
          >
            <span class="account-playlist-cover">
              <img v-if="playlist.imageUrl" :src="playlist.imageUrl" alt="" />
              <Music2 v-else :size="24" :stroke-width="1.6" aria-hidden="true" />
            </span>
            <span class="account-playlist-copy">
              <strong>{{ playlist.title }}</strong>
              <small>{{ playlist.count }} 首 · {{ playlist.createdByAccount ? '创建' : '收藏' }}</small>
            </span>
            <ArrowRight class="account-playlist-arrow" :size="21" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </div>
        <p v-else class="account-playlists-empty">当前分类暂无歌单</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.streaming-library-page {
  width: calc(100% - 112px);
  margin-inline: auto;
  padding: 0 0 112px;
}

.streaming-library-login {
  display: flex;
  min-height: 258px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px;
  border: 1px solid rgba(255, 255, 255, .82);
  border-radius: 8px;
  color: #c8c9ce;
  background: linear-gradient(145deg, #fffefd 0%, #f8f9fc 100%);
  box-shadow: 0 12px 34px rgba(45, 51, 65, 0.045);
}

.streaming-library-login h2 {
  margin: 12px 0 0;
  color: #24283a;
  font-size: 18px;
  letter-spacing: 0;
}

.streaming-library-login p {
  margin: 10px 0 0;
  color: #9ba4b5;
  font-size: 12px;
}

.streaming-library-login small {
  margin-top: 7px;
  color: #bc6a62;
}

.streaming-library-login button {
  display: inline-flex;
  align-items: center;
  height: 36px;
  gap: 7px;
  margin-top: 16px;
  padding: 0 18px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  background: linear-gradient(115deg, #6d48ff, #8547ff);
  box-shadow: 0 9px 20px rgba(111, 67, 249, 0.25);
  font-weight: 700;
  cursor: pointer;
}

.streaming-library-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: minmax(236px, 1.35fr) minmax(152px, 0.85fr) auto;
  gap: 30px;
  width: 100%;
}

.streaming-library-card {
  position: relative;
  min-width: 0;
  overflow: visible;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  box-shadow: 0 12px 32px rgba(39, 48, 65, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.68);
  transition: transform 300ms ease, box-shadow 300ms ease, border-color 300ms ease;
  cursor: pointer;
}

.streaming-library-card:hover,
.streaming-library-card:focus-visible {
  z-index: 2;
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 1);
  box-shadow: 0 17px 38px rgba(39, 48, 65, 0.075), inset 0 1px 0 rgba(255, 255, 255, .82);
  outline: none;
}

.profile-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 36px;
  background: linear-gradient(138deg, #fffefd 0%, #fefbf9 55%, #fbf5f2 100%);
  cursor: default;
}

.profile-card:hover {
  transform: none;
  border-color: rgba(255, 255, 255, .78);
  box-shadow: 0 12px 32px rgba(39, 48, 65, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

.profile-identity {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 28px;
}

.profile-avatar {
  position: relative;
  display: grid;
  flex: 0 0 102px;
  width: 102px;
  height: 102px;
  place-items: center;
  overflow: hidden;
  border: 4px solid #fff;
  border-radius: 50%;
  color: #9a8076;
  background: #f3e7e1;
  box-shadow: 0 0 0 3px rgba(255, 168, 116, .72), 0 10px 24px rgba(98, 65, 50, 0.09);
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-loading {
  position: absolute;
  right: 5px;
  bottom: 5px;
  padding: 3px;
  border-radius: 50%;
  color: #e46c3d;
  background: #fff;
  animation: library-spin 900ms linear infinite;
}

.profile-copy {
  min-width: 0;
}

.profile-copy > span {
  color: #66758d;
  font-size: 14px;
  font-weight: 700;
}

.profile-copy h2,
.favorites-copy h2,
.shortcut-card h2 {
  margin: 8px 0 0;
  color: #20242d;
  font-weight: 700;
  letter-spacing: 0;
}

.profile-copy h2 {
  overflow: hidden;
  color: #2d2721;
  font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
  font-size: 26px;
  font-weight: 900;
  line-height: 1.18;
  text-overflow: ellipsis;
  text-shadow: none;
  white-space: nowrap;
  -webkit-text-stroke: 0 transparent;
  filter: none;
}

.profile-copy p,
.favorites-copy p,
.shortcut-card p {
  margin: 7px 0 0;
  color: rgba(91, 103, 123, .72);
  font-size: 13px;
}

.profile-copy p {
  color: #c18a3d;
  font-weight: 650;
}

.profile-stats {
  display: flex;
  gap: 12px;
  margin-top: 22px;
}

.profile-stats button {
  min-width: 74px;
  padding: 9px 13px;
  border: 1px solid rgba(225, 199, 186, .82);
  border-radius: 8px;
  color: #72584d;
  background: rgba(255, 246, 241, .9);
  text-align: center;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: transform 180ms ease-out, border-color 180ms ease-out, background 180ms ease-out;
}

.profile-stats button:hover,
.profile-stats button:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(225, 184, 163, .85);
  background: rgba(255, 245, 240, .96);
  outline: none;
}

.profile-stats strong {
  margin-right: 4px;
  color: #2f2926;
  font-size: 14px;
  font-weight: 800;
}

.library-source-picker {
  position: absolute;
  top: 24px;
  right: 24px;
}

.library-source-trigger {
  display: flex;
  align-items: center;
  height: 34px;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid rgba(213, 219, 227, .8);
  border-radius: 17px;
  color: rgba(50, 65, 86, .88);
  background: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 180ms ease, color 180ms ease, background 180ms ease;
}

.library-source-trigger.active {
  border-color: rgba(79, 125, 255, .4);
  color: #2d67f4;
  background: rgba(234, 240, 255, .9);
}

.library-source-menu {
  position: absolute;
  z-index: 5;
  top: 42px;
  right: 0;
  width: 178px;
  padding: 7px;
  border: 1px solid #e6e8ee;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 40px rgba(27, 34, 48, 0.16);
}

.library-source-menu button {
  display: grid;
  grid-template-columns: 20px 1fr 16px;
  align-items: center;
  width: 100%;
  min-height: 55px;
  gap: 8px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  color: #334057;
  background: transparent;
  text-align: left;
  font-weight: 700;
  cursor: pointer;
}

.library-source-menu button:hover {
  color: #2f66ff;
  background: #f1f4ff;
}

.library-source-menu button.selected {
  color: #2f67f3;
  background: #edf2ff;
}

.source-option-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.source-option-copy strong,
.source-option-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-option-copy strong {
  font-size: 12px;
}

.source-option-copy small {
  color: #8993a4;
  font-size: 10px;
  font-weight: 600;
}

.library-source-menu button.selected .source-option-copy small {
  color: #66748f;
}

.favorites-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 36px;
  background: linear-gradient(132deg, #fefeff 0%, #f8fbff 50%, #edf4ff 100%);
}

.favorites-copy {
  position: relative;
  z-index: 1;
}

.favorites-badge {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  color: #3267dd;
  background: rgba(226, 235, 255, .76);
  font-size: 12px;
  font-weight: 800;
}

.favorites-copy h2 {
  font-size: 24px;
}

.favorites-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  gap: 8px;
  margin-top: 24px;
  padding: 0 24px;
  border: 0;
  border-radius: 23px;
  color: #fff;
  background: linear-gradient(115deg, #2f72f4, #727af1);
  box-shadow: 0 9px 20px rgba(68, 108, 239, 0.18);
  font-weight: 700;
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.favorites-play:hover:not(:disabled) {
  transform: scale(1.04);
  box-shadow: 0 12px 24px rgba(68, 108, 239, 0.24);
}

.favorites-play:disabled {
  opacity: 0.5;
  cursor: default;
}

.favorites-art {
  position: relative;
  display: grid;
  flex: 0 0 140px;
  width: 140px;
  height: 140px;
  place-items: center;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, .94);
  border-radius: 12px;
  background: linear-gradient(145deg, #69737f, #202833);
  box-shadow: 0 14px 30px rgba(63, 82, 112, .2), 0 2px 8px rgba(63, 82, 112, .1);
}

.favorites-art img,
.favorites-art > span {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shortcut-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 34px;
}

.recent-card {
  background: linear-gradient(135deg, #fbfdff 0%, #f2f6ff 100%);
}

.ranking-card {
  background: linear-gradient(135deg, #fffdfd 0%, #fff3f4 100%);
}

.shortcut-icon,
.shortcut-arrow {
  display: grid;
  place-items: center;
  border-radius: 50%;
}

.shortcut-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 11px;
  border-radius: 8px;
}

.recent-card .shortcut-icon {
  color: #4b78de;
  background: rgba(223, 233, 255, .78);
}

.ranking-card .shortcut-icon {
  color: #ef6675;
  background: rgba(255, 226, 231, .76);
}

.shortcut-card h2 {
  font-size: 18px;
}

.shortcut-arrow {
  width: 48px;
  height: 48px;
  color: rgba(87, 106, 132, .78);
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 7px 18px rgba(56, 69, 92, 0.035);
  transition: transform 200ms ease, color 200ms ease;
}

.shortcut-card:hover .shortcut-arrow {
  color: #2d63d8;
  transform: translateX(3px);
}

.account-playlists-section {
  grid-column: 1 / -1;
  min-width: 0;
  margin-top: 12px;
  padding: 4px 2px 8px;
}

.account-playlists-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.account-playlists-header h2 {
  margin: 0;
  color: #202634;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 0;
}

.account-playlists-header p {
  margin: 7px 0 0;
  color: #78869d;
  font-size: 13px;
}

.create-playlist-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 42px;
  gap: 7px;
  padding: 0 16px;
  border: 1px solid #b9ccff;
  border-radius: 8px;
  color: #4069df;
  background: #edf2ff;
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
  transition: color 180ms ease, border-color 180ms ease, background 180ms ease;
}

.create-playlist-button:hover:not(:disabled),
.create-playlist-button:focus-visible {
  border-color: #8eacff;
  color: #2859e2;
  background: #e5edff;
  outline: none;
}

.create-playlist-button:disabled {
  opacity: .5;
  cursor: default;
}

.playlist-tabs {
  display: inline-flex;
  margin-top: 24px;
  padding: 5px;
  border: 1px solid rgba(224, 228, 236, .9);
  border-radius: 8px;
  background: rgba(255, 255, 255, .8);
}

.playlist-tabs button {
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  color: #69768d;
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.playlist-tabs button.active {
  color: #3566e6;
  background: #e7edff;
  font-weight: 750;
}

.playlist-tabs span {
  margin-left: 4px;
  font-size: 11px;
}

.playlist-sort-hint {
  margin: 20px 0 14px;
  color: #718096;
  font-size: 12px;
}

.account-playlist-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.account-playlist-item {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) 24px;
  align-items: center;
  min-height: 104px;
  gap: 16px;
  padding: 13px 16px;
  border: 1px solid rgba(235, 237, 242, .9);
  border-radius: 8px;
  color: inherit;
  background: rgba(255, 255, 255, .88);
  box-shadow: 0 10px 26px rgba(40, 49, 67, .045);
  text-align: left;
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.account-playlist-item:hover,
.account-playlist-item:focus-visible {
  transform: translateY(-2px);
  border-color: #dce4f5;
  box-shadow: 0 13px 30px rgba(40, 49, 67, .075);
  outline: none;
}

.account-playlist-cover {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .95);
  border-radius: 8px;
  color: #8493aa;
  background: #edf1f7;
  box-shadow: 0 5px 14px rgba(67, 82, 107, .12);
}

.account-playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-playlist-copy {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.account-playlist-copy strong,
.account-playlist-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-playlist-copy strong {
  color: #242b3a;
  font-size: 15px;
  font-weight: 800;
}

.account-playlist-copy small {
  color: #78859a;
  font-size: 12px;
}

.account-playlist-arrow {
  color: #a6b1c2;
  transition: color 180ms ease, transform 180ms ease;
}

.account-playlist-item:hover .account-playlist-arrow {
  color: #4d70d5;
  transform: translateX(2px);
}

.account-playlists-empty {
  display: grid;
  min-height: 112px;
  margin: 0;
  place-items: center;
  border-top: 1px solid #e7eaf0;
  color: #919cac;
  font-size: 13px;
}

.library-source-menu-enter-active,
.library-source-menu-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.library-source-menu-enter-from,
.library-source-menu-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

@keyframes library-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 980px) {
  .streaming-library-page {
    width: calc(100% - 40px);
  }

  .streaming-library-grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    gap: 18px;
  }

  .streaming-library-card {
    min-height: 160px;
  }

  .account-playlists-section {
    grid-column: auto;
  }

  .account-playlist-list {
    grid-template-columns: 1fr;
  }

  .profile-card,
  .favorites-card {
    min-height: 220px;
  }
}

@media (max-width: 620px) {
  .streaming-library-page {
    width: 100%;
  }

  .profile-card,
  .favorites-card,
  .shortcut-card {
    padding: 22px;
  }

  .profile-identity {
    gap: 16px;
  }

  .profile-avatar {
    flex-basis: 78px;
    width: 78px;
    height: 78px;
  }

  .profile-copy h2,
  .favorites-copy h2 {
    font-size: 21px;
  }

  .library-source-picker {
    top: 16px;
    right: 16px;
  }

  .library-source-trigger span {
    display: none;
  }

  .favorites-art {
    flex-basis: 104px;
    width: 104px;
    height: 104px;
  }

  .account-playlists-header {
    align-items: flex-start;
  }

  .account-playlists-header h2 {
    font-size: 21px;
  }

  .playlist-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }

  .playlist-tabs button {
    padding: 0 6px;
  }

  .account-playlist-item {
    grid-template-columns: 64px minmax(0, 1fr) 20px;
  }

  .account-playlist-cover {
    width: 64px;
    height: 64px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .streaming-library-card,
  .favorites-play,
  .shortcut-arrow {
    transition: none;
  }
}
</style>
