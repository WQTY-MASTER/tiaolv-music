<script setup lang="ts">
import { Disc3, Heart, ListMusic, LoaderCircle, Play, Shuffle, UserRound } from "lucide-vue-next";

type ArtistTab = "songs" | "albums" | "playlists";

interface ArtistSummary {
  id: string;
  name: string;
  imageUrl?: string;
  albumCount: number;
  trackCount: number;
  source: string;
}

interface ArtistDetail {
  id: string;
  name: string;
  avatarUrl?: string;
  signature?: string;
  albumCount: number;
  trackCount: number;
}

interface ArtistTrack {
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
  filePath?: string;
  audioUrl?: string;
}

interface ArtistAlbum {
  id: string;
  title: string;
  imageUrl?: string;
  trackCount: number;
  releaseDate?: string;
}

const props = defineProps<{
  artist: ArtistSummary;
  detail: ArtistDetail | null;
  tracks: ArtistTrack[];
  albums: ArtistAlbum[];
  playlists: Array<{ id: string; title: string; imageUrl?: string; count: number }>;
  activeTab: ArtistTab;
  loading: boolean;
  error: string;
  followed: boolean;
  followPending: boolean;
  currentTrackId: string;
  playing: boolean;
  tracksTotal: number;
  tracksHasMore: boolean;
  tracksLoadingMore: boolean;
  albumsTotal: number;
  albumsHasMore: boolean;
  albumsLoadingMore: boolean;
}>();

const emit = defineEmits<{
  back: [];
  tabChange: [tab: ArtistTab];
  playAll: [];
  playRandom: [];
  playTrack: [track: ArtistTrack];
  toggleFollow: [];
  toggleFavorite: [track: ArtistTrack];
  "context-menu": [payload: { track: ArtistTrack; event: MouseEvent }];
}>();

const tabs: Array<{ id: ArtistTab; label: string; icon: typeof Disc3 }> = [
  { id: "songs", label: "全部歌曲", icon: ListMusic },
  { id: "albums", label: "专辑", icon: Disc3 },
  { id: "playlists", label: "创建的歌单", icon: ListMusic }
];

function tabCount(tab: ArtistTab) {
  if (tab === "songs") return Math.max(props.tracksTotal, props.detail?.trackCount ?? 0, props.artist.trackCount);
  if (tab === "albums") return Math.max(props.albumsTotal, props.detail?.albumCount ?? 0, props.artist.albumCount);
  return props.playlists.length;
}

function formatDuration(duration: number) {
  const seconds = Math.max(0, Math.round(duration || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function artistName() {
  return props.detail?.name || props.artist.name;
}

function artistImage() {
  return props.detail?.avatarUrl || props.artist.imageUrl || "";
}

function activateTrack(event: KeyboardEvent, track: ArtistTrack) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("playTrack", track);
  }
}
</script>

<template>
  <section class="streaming-artist-detail" aria-label="歌手详情">
    <button class="playlist-detail-back" type="button" @click="emit('back')">
      ← 返回
    </button>

    <header class="artist-detail-hero">
      <div class="artist-detail-avatar">
        <img v-if="artistImage()" :src="artistImage()" :alt="`${artistName()}头像`" />
        <UserRound v-else :size="48" aria-hidden="true" />
      </div>
      <div class="artist-detail-copy">
        <p class="artist-detail-eyebrow">— 艺人 · {{ detail?.trackCount || artist.trackCount }} 首歌曲</p>
        <h1>{{ artistName() }}</h1>
        <p class="artist-detail-signature">{{ detail?.signature || "暂无歌手简介" }}</p>
        <div class="artist-detail-actions">
          <button class="artist-follow-button" type="button" :disabled="followPending" @click="emit('toggleFollow')">
            <span>{{ followed ? "已关注" : "关注" }}</span>
          </button>
          <button type="button" :disabled="tracks.length === 0" @click="emit('playAll')">
            <Play :size="15" fill="currentColor" aria-hidden="true" /> 播放全部
          </button>
          <button type="button" :disabled="tracks.length === 0" @click="emit('playRandom')">
            <Shuffle :size="15" aria-hidden="true" /> 随机播放
          </button>
        </div>
      </div>
    </header>

    <nav class="artist-detail-tabs" role="tablist" aria-label="歌手内容分类">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :class="{ active: activeTab === tab.id }"
        @click="emit('tabChange', tab.id)"
      >
        <component :is="tab.icon" :size="15" aria-hidden="true" />
        {{ tab.label }} <span class="artist-tab-count">{{ tabCount(tab.id) }}</span>
      </button>
    </nav>

    <div v-if="loading" class="artist-detail-state" role="status">
      <LoaderCircle :size="22" class="artist-detail-spin" aria-hidden="true" />
      <span>正在加载 {{ artistName() }} 的音乐...</span>
    </div>
    <div v-else-if="error" class="artist-detail-state is-error">
      <strong>歌手内容加载失败</strong>
      <span>{{ error }}</span>
    </div>

    <section v-else-if="activeTab === 'songs'" class="artist-song-panel" aria-label="歌手歌曲">
      <div class="artist-song-heading" aria-hidden="true">
        <span>#</span><span>歌曲</span><span>专辑</span><span>时长</span>
      </div>
      <div v-if="tracks.length > 0" class="artist-song-list">
        <div
          v-for="(track, index) in tracks"
          :key="track.id"
          class="artist-song-row"
          :class="{ active: track.id === currentTrackId }"
          role="button"
          tabindex="0"
          @click="emit('playTrack', track)"
          @contextmenu.prevent="emit('context-menu', { track, event: $event })"
          @keydown="activateTrack($event, track)"
        >
          <span class="artist-song-index">{{ String(index + 1).padStart(2, "0") }}</span>
          <span class="artist-song-main">
            <span class="artist-song-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
              <img v-if="track.coverUrl" :src="track.coverUrl" :alt="`${track.title}封面`" />
              <span v-else>{{ track.mark }}</span>
            </span>
            <span class="artist-song-copy"><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span>
          </span>
          <span class="artist-song-album">{{ track.album }}</span>
          <span class="artist-song-end">
            <button class="artist-song-like" type="button" :class="{ active: track.liked }" :aria-label="track.liked ? '取消喜欢' : '喜欢歌曲'" @click.stop="emit('toggleFavorite', track)">
              <Heart :size="16" :fill="track.liked ? 'currentColor' : 'none'" aria-hidden="true" />
            </button>
            <time>{{ formatDuration(track.duration) }}</time>
          </span>
        </div>
        <div v-if="tracksLoadingMore" class="artist-list-loading" role="status">
          <LoaderCircle :size="16" class="artist-detail-spin" aria-hidden="true" /> 正在加载更多歌曲...
        </div>
        <div v-else-if="!tracksHasMore" class="artist-list-end">已显示全部 {{ tracksTotal || tracks.length }} 首歌曲</div>
      </div>
      <div v-else class="artist-detail-empty"><ListMusic :size="22" aria-hidden="true" />暂无歌曲</div>
    </section>

    <section v-else-if="activeTab === 'albums'" class="artist-album-grid" aria-label="歌手专辑">
      <article v-for="album in albums" :key="album.id" class="artist-album-card">
        <div class="artist-album-cover"><img v-if="album.imageUrl" :src="album.imageUrl" :alt="`${album.title}封面`" /><Disc3 v-else :size="30" aria-hidden="true" /></div>
        <strong>{{ album.title }}</strong>
        <small>{{ album.trackCount }} 首歌曲<span v-if="album.releaseDate"> · {{ album.releaseDate }}</span></small>
      </article>
      <div v-if="albumsLoadingMore" class="artist-list-loading artist-album-loading" role="status">
        <LoaderCircle :size="16" class="artist-detail-spin" aria-hidden="true" /> 正在加载更多专辑...
      </div>
      <div v-else-if="albums.length > 0 && !albumsHasMore" class="artist-list-end artist-album-end">已显示全部 {{ albumsTotal || albums.length }} 张专辑</div>
      <div v-if="albums.length === 0" class="artist-detail-empty"><Disc3 :size="22" aria-hidden="true" />暂无专辑</div>
    </section>

    <section v-else class="artist-detail-empty artist-playlist-empty" aria-label="创建的歌单">
      <ListMusic :size="22" aria-hidden="true" />
      <strong>暂无创建的歌单</strong>
      <span>这个歌手还没有公开创建的歌单</span>
    </section>
  </section>
</template>

<style scoped>
.streaming-artist-detail{width:min(1420px,100%);margin:0 auto;padding:88px 0 128px;color:#10182b}
.artist-detail-hero{display:flex;align-items:center;gap:28px;margin-bottom:30px;padding:4px 0}
.artist-detail-avatar{display:grid;width:164px;height:164px;flex:0 0 auto;place-items:center;overflow:hidden;border:7px solid rgba(255,255,255,.9);border-radius:50%;background:#e8ecee;color:#9aa5af;box-shadow:0 18px 38px rgba(25,35,50,.1)}
.artist-detail-avatar img{width:100%;height:100%;object-fit:cover}
.artist-detail-copy{display:grid;gap:9px;min-width:0}
.artist-detail-eyebrow{margin:0;color:#c2573b;font-size:12px;font-weight:900}
.artist-detail-copy h1{margin:0;color:#111827;font-size:42px;font-weight:900;letter-spacing:0}
.artist-detail-signature{max-width:680px;margin:0;color:#7f8997;font-size:13px;line-height:1.7}
.artist-detail-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:6px}
.artist-detail-actions button{display:inline-flex;height:36px;align-items:center;gap:7px;border:1px solid #dfe3e7;border-radius:999px;padding:0 15px;background:rgba(255,255,255,.8);color:#344154;cursor:pointer;font-size:12px;font-weight:850;transition:transform 180ms ease,background 180ms ease,border-color 180ms ease,box-shadow 180ms ease}
.artist-detail-actions button:hover:not(:disabled){border-color:#d5aaa0;background:#fff;box-shadow:0 8px 18px rgba(25,35,50,.08);transform:translateY(-1px)}
.artist-detail-actions button:disabled{cursor:not-allowed;opacity:.42}
.artist-detail-actions .artist-follow-button{border-color:#e0d0ca;color:#b24d36}
.artist-detail-tabs{display:flex;align-items:center;gap:8px;margin-bottom:15px;padding-bottom:13px;border-bottom:1px solid #e4e7e9}
.artist-detail-tabs button{display:inline-flex;height:34px;align-items:center;gap:7px;border:1px solid transparent;border-radius:999px;padding:0 14px;background:transparent;color:#88919c;cursor:pointer;font-size:12px;font-weight:850;transition:background 180ms ease,color 180ms ease}
.artist-detail-tabs button:hover{color:#b24d36;background:rgba(255,255,255,.62)}
.artist-detail-tabs button.active{background:#111827;color:#fff;box-shadow:0 8px 18px rgba(17,24,39,.12)}
.artist-detail-state{display:grid;min-height:280px;place-items:center;align-content:center;gap:10px;color:#8a95a2;font-size:12px}
.artist-detail-state strong{color:#384557;font-size:15px}.artist-detail-state.is-error strong{color:#ad5b5d}
.artist-detail-spin{animation:artist-spin .8s linear infinite}@keyframes artist-spin{to{transform:rotate(360deg)}}
.artist-song-panel{overflow:hidden;border:1px solid #e7e9e9;border-radius:15px;background:rgba(255,255,255,.48)}
.artist-song-heading,.artist-song-row{display:grid;grid-template-columns:42px minmax(260px,1.4fr) minmax(180px,.8fr) 116px;align-items:center;gap:14px}
.artist-song-heading{min-height:40px;border-bottom:1px solid #eceeee;padding:0 17px;color:#a0a7ad;font-size:11px;font-weight:850}
.artist-song-list{display:grid;padding:5px 8px}
.artist-song-row{min-height:65px;border:1px solid transparent;border-radius:10px;padding:7px 9px;color:#263247;cursor:pointer;transition:background 160ms ease,border-color 160ms ease,transform 160ms ease}
.artist-song-row:hover,.artist-song-row:focus-visible{border-color:#e9d9d4;background:rgba(255,255,255,.78);outline:0;transform:translateY(-1px)}
.artist-song-row.active{border-color:#d9e9e5;background:#eef7f4}
.artist-song-index{color:#a4adb6;font-size:12px;font-weight:850}
.artist-song-main{display:flex;min-width:0;align-items:center;gap:12px}
.artist-song-cover{display:grid;width:46px;height:46px;flex:0 0 auto;place-items:center;overflow:hidden;border-radius:7px;color:#fff;font-size:12px;font-weight:850}
.artist-song-cover img{width:100%;height:100%;object-fit:cover}
.artist-song-copy{display:grid;min-width:0;gap:4px}
.artist-song-copy strong,.artist-song-copy small,.artist-song-album{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.artist-song-copy strong{font-size:13px}.artist-song-copy small,.artist-song-album{color:#7d8794;font-size:11px}
.artist-song-end{display:flex;align-items:center;justify-content:flex-end;gap:14px;color:#9aa3ad;font-size:11px;font-weight:750}
.artist-song-like{display:grid;width:28px;height:28px;place-items:center;border:0;border-radius:50%;background:transparent;color:#a6afb7;cursor:pointer;transition:background 160ms ease,color 160ms ease,transform 160ms ease}
.artist-song-like:hover{background:#f7eae6;color:#b24d36;transform:scale(1.08)}.artist-song-like.active{color:#b24d36}
.artist-detail-empty{display:grid;min-height:220px;place-items:center;align-content:center;gap:10px;color:#a0a8b0;font-size:12px}
.artist-detail-empty strong{color:#596576;font-size:14px}.artist-playlist-empty{border:1px solid #e7e9e9;border-radius:15px;background:rgba(255,255,255,.48)}.artist-playlist-empty span{font-size:11px}
.artist-album-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:16px}
.artist-album-card{display:grid;gap:8px;min-width:0;padding:9px;border:1px solid #e8ebeb;border-radius:12px;background:rgba(255,255,255,.58);box-shadow:0 8px 18px rgba(25,35,50,.045)}
.artist-album-cover{display:grid;aspect-ratio:1;place-items:center;overflow:hidden;border-radius:9px;background:#e8edef;color:#a3adb6}
.artist-album-cover img{width:100%;height:100%;object-fit:cover}.artist-album-card strong,.artist-album-card small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.artist-album-card strong{font-size:12px}.artist-album-card small{color:#7f8996;font-size:10px}
.artist-tab-count{display:inline-grid;min-width:22px;height:19px;align-items:center;justify-content:center;border-radius:999px;padding:0 6px;background:#f7e9e4;color:#bd5b42;font-size:10px;font-weight:900}
.artist-detail-tabs button.active .artist-tab-count{background:#f2e7e1;color:#b24d36}
.artist-list-loading,.artist-list-end{display:flex;min-height:42px;align-items:center;justify-content:center;gap:8px;color:#a0a8b0;font-size:11px}
.artist-list-end{color:#b0b6ba}
.artist-album-loading,.artist-album-end{grid-column:1/-1}
@media(max-width:800px){.artist-detail-hero{align-items:flex-start}.artist-detail-avatar{width:124px;height:124px}.artist-detail-copy h1{font-size:34px}.artist-song-heading,.artist-song-row{grid-template-columns:32px minmax(0,1fr) 82px}.artist-song-album{display:none}.artist-album-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:560px){.streaming-artist-detail{padding-top:40px}.artist-detail-hero{display:grid;grid-template-columns:84px minmax(0,1fr);gap:16px}.artist-detail-avatar{width:84px;height:84px;border-width:4px}.artist-detail-avatar svg{width:32px}.artist-detail-copy h1{font-size:28px}.artist-detail-signature{font-size:12px}.artist-detail-actions{grid-column:1/-1}.artist-detail-tabs{overflow:auto}.artist-detail-tabs button{flex:0 0 auto}.artist-song-heading{display:none}.artist-song-row{grid-template-columns:28px minmax(0,1fr) 76px;gap:8px}.artist-song-cover{width:40px;height:40px}.artist-song-end{gap:5px}.artist-song-like{width:24px;height:24px}.artist-album-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
