<script setup lang="ts">
import { Check, ChevronDown, ChevronLeft, ChevronRight, Cloud, Heart, LoaderCircle, Music2, UserRound } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import PlaylistCard from "./PlaylistCard.vue";

type SearchTab = "song" | "playlist" | "artist";
type SearchProvider = "netease" | "qq";

interface SearchTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl?: string;
  primary: string;
  secondary: string;
  mark: string;
  liked: boolean;
  history: boolean;
  source?: string;
}

interface SearchPlaylist {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  imageUrl?: string;
  primary: string;
  secondary: string;
  mark: string;
}

interface SearchArtist {
  id: string;
  name: string;
  imageUrl?: string;
  albumCount: number;
  trackCount: number;
  source: string;
}

const props = defineProps<{
  keyword: string;
  tab: SearchTab;
  provider: SearchProvider;
  tracks: SearchTrack[];
  playlists: SearchPlaylist[];
  artists: SearchArtist[];
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: string;
  currentTrackId: string;
  playing: boolean;
}>();

const emit = defineEmits<{
  changeTab: [tab: SearchTab];
  changeProvider: [provider: SearchProvider];
  changePage: [page: number];
  playTrack: [track: SearchTrack];
  toggleFavorite: [track: SearchTrack];
  "context-menu": [payload: { track: SearchTrack; event: MouseEvent }];
  selectPlaylist: [playlist: SearchPlaylist];
  playPlaylist: [playlist: SearchPlaylist];
  selectArtist: [artist: SearchArtist];
}>();

const tabs: Array<{ id: SearchTab; label: string }> = [
  { id: "song", label: "单曲" },
  { id: "playlist", label: "歌单" },
  { id: "artist", label: "歌手" }
];
const providers: Array<{ id: SearchProvider; label: string }> = [
  { id: "netease", label: "网易云音乐" },
  { id: "qq", label: "QQ 音乐" }
];
const providerMenuOpen = ref(false);
const providerMenuRoot = ref<HTMLElement | null>(null);
const providerLabel = computed(() => providers.find((item) => item.id === props.provider)?.label ?? "网易云音乐");

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const resultCount = computed(() => {
  if (props.tab === "song") return props.tracks.length;
  if (props.tab === "playlist") return props.playlists.length;
  return props.artists.length;
});

function formatDuration(duration: number) {
  const seconds = Math.max(0, Math.round(duration || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function toggleProviderMenu() {
  if (!props.loading) providerMenuOpen.value = !providerMenuOpen.value;
}

function selectProvider(provider: SearchProvider) {
  providerMenuOpen.value = false;
  if (provider !== props.provider) emit("changeProvider", provider);
}

function closeProviderMenu(event: PointerEvent) {
  if (!providerMenuRoot.value?.contains(event.target as Node)) providerMenuOpen.value = false;
}

onMounted(() => document.addEventListener("pointerdown", closeProviderMenu));
onBeforeUnmount(() => document.removeEventListener("pointerdown", closeProviderMenu));
</script>

<template>
  <section class="streaming-search-page" aria-label="在线搜索">
    <header class="streaming-search-toolbar">
      <div class="streaming-search-tabs" role="tablist" aria-label="搜索类型">
        <button
          v-for="item in tabs"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="tab === item.id"
          :class="{ active: tab === item.id }"
          :disabled="loading"
          @click="emit('changeTab', item.id)"
        >{{ item.label }}</button>
      </div>
      <div ref="providerMenuRoot" class="streaming-search-provider">
        <button
          class="streaming-search-provider-trigger"
          type="button"
          :disabled="loading"
          :aria-expanded="providerMenuOpen"
          aria-haspopup="menu"
          aria-label="切换搜索音源"
          @click="toggleProviderMenu"
        >
          <Cloud :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ providerLabel }}</span>
          <ChevronDown class="streaming-search-provider-chevron" :class="{ open: providerMenuOpen }" :size="14" aria-hidden="true" />
        </button>
        <Transition name="search-provider-menu">
          <div v-if="providerMenuOpen" class="streaming-search-provider-menu" role="menu" aria-label="搜索音源">
            <button
              v-for="item in providers"
              :key="item.id"
              type="button"
              role="menuitemradio"
              :aria-checked="provider === item.id"
              :class="{ active: provider === item.id }"
              @click="selectProvider(item.id)"
            >
              <Cloud v-if="item.id === 'netease'" :size="16" :stroke-width="1.8" aria-hidden="true" />
              <Music2 v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ item.label }}</span>
              <Check v-if="provider === item.id" :size="16" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
        </Transition>
      </div>
    </header>

    <div v-if="loading" class="streaming-search-state" role="status">
      <LoaderCircle :size="22" class="spin" aria-hidden="true" />
      <span>正在搜索“{{ keyword }}”</span>
    </div>
    <div v-else-if="error" class="streaming-search-state is-error">
      <strong>搜索暂时不可用</strong>
      <span>{{ error }}</span>
    </div>
    <div v-else-if="resultCount === 0" class="streaming-search-state is-empty">
      <Music2 :size="25" aria-hidden="true" />
      <strong>没有找到相关{{ tab === 'song' ? '单曲' : tab === 'playlist' ? '歌单' : '歌手' }}</strong>
      <span>换一个关键词试试</span>
    </div>

    <div v-else-if="tab === 'song'" class="streaming-search-tracks">
      <div
        v-for="(track, index) in tracks"
        :key="track.id"
        class="streaming-search-track"
        :class="{ active: track.id === currentTrackId }"
        role="button"
        tabindex="0"
        @click="emit('playTrack', track)"
        @keydown.enter.prevent="emit('playTrack', track)"
        @keydown.space.prevent="emit('playTrack', track)"
        @contextmenu.prevent="emit('context-menu', { track, event: $event })"
      >
        <span class="streaming-search-index">{{ String((page - 1) * pageSize + index + 1).padStart(2, '0') }}</span>
        <span class="streaming-search-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
          <img v-if="track.coverUrl" :src="track.coverUrl" :alt="`${track.title}封面`" />
          <span v-else>{{ track.mark }}</span>
        </span>
        <span class="streaming-search-track-copy"><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span>
        <span class="streaming-search-album">{{ track.album }}</span>
        <button
          type="button"
          class="streaming-search-favorite"
          :class="{ liked: track.liked }"
          :title="track.liked ? '取消喜欢' : '喜欢'"
          :aria-label="track.liked ? `取消喜欢${track.title}` : `喜欢${track.title}`"
          @click.stop="emit('toggleFavorite', track)"
        >
          <Heart :size="17" :stroke-width="1.8" :fill="track.liked ? 'currentColor' : 'none'" aria-hidden="true" />
        </button>
        <span class="streaming-search-duration">{{ formatDuration(track.duration) }}</span>
        <span v-if="track.id === currentTrackId" class="streaming-search-playing" aria-label="当前歌曲">
          <template v-if="playing"><i></i><i></i><i></i></template>
          <span v-else class="streaming-search-pause-bars" aria-hidden="true"><b></b><b></b></span>
        </span>
      </div>
    </div>

    <div v-else-if="tab === 'playlist'" class="streaming-search-playlists">
      <PlaylistCard
        v-for="playlist in playlists"
        :key="playlist.id"
        :playlist="playlist"
        @select="emit('selectPlaylist', playlist)"
        @play="emit('playPlaylist', playlist)"
      />
    </div>

    <div v-else class="streaming-search-artists">
      <button v-for="artist in artists" :key="artist.id" class="streaming-search-artist" type="button" @click="emit('selectArtist', artist)">
        <span class="streaming-search-artist-cover">
          <img
            v-if="artist.imageUrl"
            :src="artist.imageUrl"
            :alt="`${artist.name}头像`"
            loading="lazy"
            decoding="async"
          />
          <UserRound v-else :size="34" aria-hidden="true" />
        </span>
        <strong>{{ artist.name }}</strong>
        <small>{{ artist.trackCount }} 首歌曲 · {{ artist.albumCount }} 张专辑</small>
      </button>
    </div>

    <nav v-if="!loading && !error && resultCount > 0" class="streaming-search-pagination" aria-label="搜索结果分页">
      <button type="button" :disabled="page <= 1 || loading" @click="emit('changePage', page - 1)">
        <ChevronLeft :size="16" aria-hidden="true" />上一页
      </button>
      <span><b>{{ page }}</b> / {{ totalPages }}</span>
      <button type="button" :disabled="page >= totalPages || loading" @click="emit('changePage', page + 1)">
        下一页<ChevronRight :size="16" aria-hidden="true" />
      </button>
    </nav>
  </section>
</template>

<style scoped>
.streaming-search-page{width:min(1420px,100%);margin:0 auto;padding:0 0 118px;color:#121a2d}.streaming-search-toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid #e3e6ea}.streaming-search-tabs{display:flex;align-items:center;gap:8px}.streaming-search-tabs button{min-width:58px;height:34px;border:1px solid #e0e4e9;border-radius:17px;background:#fff;color:#4d596b;cursor:pointer;font-weight:800}.streaming-search-tabs button.active{border-color:#111827;background:#111827;color:#fff}.streaming-search-tabs button:disabled{cursor:wait}.streaming-search-provider{position:relative;z-index:18;flex:0 0 auto}.streaming-search-provider-trigger{display:flex;height:36px;align-items:center;gap:7px;border:1px solid #dcd8fb;border-radius:18px;padding:0 11px;background:#eeecff;color:#2864e8;cursor:pointer;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 5px 14px rgba(64,76,160,.06);transition:background 160ms ease,border-color 160ms ease,box-shadow 160ms ease}.streaming-search-provider-trigger:hover,.streaming-search-provider-trigger[aria-expanded="true"]{border-color:#c9c2fb;background:#e7e4ff;box-shadow:0 7px 17px rgba(64,76,160,.11)}.streaming-search-provider-trigger:disabled{cursor:wait;opacity:.66}.streaming-search-provider-chevron{transition:transform 160ms ease}.streaming-search-provider-chevron.open{transform:rotate(180deg)}.streaming-search-provider-menu{position:absolute;top:calc(100% + 8px);right:0;display:grid;width:218px;gap:3px;border:1px solid #e7e9ef;border-radius:12px;padding:7px;background:#fff;box-shadow:0 18px 42px rgba(28,37,54,.16)}.streaming-search-provider-menu button{display:grid;width:100%;height:40px;grid-template-columns:20px minmax(0,1fr) 18px;align-items:center;gap:8px;border:0;border-radius:8px;padding:0 9px;background:transparent;color:#455064;cursor:pointer;font-size:12px;font-weight:750;text-align:left}.streaming-search-provider-menu button:hover{background:#f5f6fa}.streaming-search-provider-menu button.active{background:#eeecff;color:#2864e8}.search-provider-menu-enter-active,.search-provider-menu-leave-active{transition:opacity 160ms ease,transform 160ms ease}.search-provider-menu-enter-from,.search-provider-menu-leave-to{opacity:0;transform:translateY(-5px)}.streaming-search-state{display:grid;min-height:300px;place-items:center;align-content:center;gap:10px;color:#8792a2}.streaming-search-state strong{color:#344054;font-size:15px}.streaming-search-state span{font-size:12px}.streaming-search-state.is-error strong{color:#a64e50}.streaming-search-tracks{display:grid;gap:7px}.streaming-search-track{display:grid;grid-template-columns:42px 48px minmax(180px,1.15fr) minmax(140px,.8fr) 34px 54px 34px;min-height:64px;align-items:center;gap:12px;border:1px solid transparent;border-radius:8px;padding:7px 12px;background:transparent;color:#263247;cursor:pointer;text-align:left;transition:background 180ms ease,border-color 180ms ease}.streaming-search-track:hover{border-color:#e2e6eb;background:rgba(255,255,255,.75)}.streaming-search-track.active{border-color:#dce8e5;background:#edf6f4}.streaming-search-index{color:#adb6c3;font-size:12px;font-weight:800}.streaming-search-cover{display:grid;width:48px;height:48px;overflow:hidden;place-items:center;border-radius:7px;color:#fff;font-weight:800}.streaming-search-cover img{width:100%;height:100%;object-fit:cover}.streaming-search-track-copy{display:grid;min-width:0;gap:4px}.streaming-search-track-copy strong,.streaming-search-track-copy small,.streaming-search-album{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.streaming-search-track-copy strong{font-size:13px}.streaming-search-track-copy small,.streaming-search-album,.streaming-search-duration{color:#738098;font-size:11px}.streaming-search-favorite{display:grid;width:30px;height:30px;place-items:center;border:0;border-radius:50%;background:transparent;color:#aab4c3;cursor:pointer}.streaming-search-favorite:hover{background:#fff;color:#ef5b69}.streaming-search-favorite.liked{color:#ef5b69}.streaming-search-favorite:focus-visible{outline:2px solid #ef5b69;outline-offset:2px}.streaming-search-playing{display:flex;width:30px;height:30px;align-items:center;justify-content:center;gap:2px;border-radius:50%;background:#0f7569;color:#fff}.streaming-search-playing i{width:2px;height:10px;border-radius:2px;background:#fff;animation:search-wave .7s ease-in-out infinite alternate}.streaming-search-playing i:nth-child(2){height:16px;animation-delay:-.2s}.streaming-search-playing i:nth-child(3){height:7px;animation-delay:-.4s}.streaming-search-playing span{font-size:11px;font-weight:900}.streaming-search-playlists{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px 18px}.streaming-search-artists{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px 18px;contain:layout style}.streaming-search-artist{display:grid;min-width:0;gap:8px;contain:layout style}.streaming-search-artist-cover{display:grid;aspect-ratio:1;overflow:hidden;place-items:center;border-radius:8px;background:#e8ebef;color:#9ba6b5;box-shadow:0 10px 24px rgba(25,35,50,.08);transition:transform 180ms ease,box-shadow 180ms ease;transform:translateZ(0);will-change:transform;backface-visibility:hidden}.streaming-search-artist:hover .streaming-search-artist-cover{transform:translate3d(0,-4px,0);box-shadow:0 15px 28px rgba(25,35,50,.14)}.streaming-search-artist-cover img{display:block;width:100%;height:100%;object-fit:cover;content-visibility:auto;backface-visibility:hidden}.streaming-search-artist strong,.streaming-search-artist small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.streaming-search-artist strong{font-size:13px}.streaming-search-artist small{color:#7f8a9c;font-size:11px}.streaming-search-pagination{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:38px}.streaming-search-pagination button{display:flex;min-width:92px;height:38px;align-items:center;justify-content:center;gap:5px;border:1px solid #dfe4ea;border-radius:8px;background:#fff;color:#354154;cursor:pointer;font-weight:800}.streaming-search-pagination button:hover:not(:disabled){background:#f5f7f9}.streaming-search-pagination button:disabled{cursor:not-allowed;opacity:.42}.streaming-search-pagination span{min-width:70px;color:#98a2b1;font-size:12px;text-align:center}.streaming-search-pagination b{color:#273347}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@keyframes search-wave{to{height:4px}}
.streaming-search-pause-bars{display:flex;align-items:center;justify-content:center;gap:3px}.streaming-search-pause-bars b{display:block;width:3px;height:11px;border-radius:1px;background:#fff}
@media(max-width:900px){.streaming-search-playlists,.streaming-search-artists{grid-template-columns:repeat(2,minmax(0,1fr))}.streaming-search-track{grid-template-columns:34px 44px minmax(0,1fr) 32px 48px 32px}.streaming-search-album{display:none}.streaming-search-cover{width:44px;height:44px}}@media(max-width:620px){.streaming-search-toolbar{align-items:flex-start;flex-direction:column}.streaming-search-provider{align-self:flex-end}.streaming-search-track{grid-template-columns:30px 42px minmax(0,1fr) 30px 30px;padding-inline:7px}.streaming-search-duration{display:none}.streaming-search-cover{width:42px;height:42px}.streaming-search-pagination{gap:8px}.streaming-search-pagination button{min-width:82px}}
.streaming-search-artist{border:0;padding:0;background:transparent;color:inherit;cursor:pointer;text-align:left}
.streaming-search-artist:focus-visible{outline:2px solid #e86b3f;outline-offset:4px}
.streaming-search-tracks{gap:0;overflow:hidden;border:1px solid rgba(218,223,230,.78);border-radius:8px;padding:7px 9px;background:rgba(255,255,255,.94);box-shadow:0 10px 28px rgba(31,40,56,.035)}
.streaming-search-track:hover{background:#f8f9fb}
.streaming-search-artists{grid-template-columns:repeat(6,minmax(0,1fr))}
.streaming-search-playlists{grid-template-columns:repeat(6,minmax(0,1fr))}
@media(max-width:900px){.streaming-search-artists{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:900px){.streaming-search-playlists{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:620px){.streaming-search-artists,.streaming-search-playlists{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
