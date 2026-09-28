<script setup lang="ts">
import { Play } from "lucide-vue-next";

interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl?: string;
  mark: string;
  primary: string;
  secondary: string;
  liked: boolean;
  history: boolean;
  source?: string;
  audioUrl?: string;
  coverFallbackUrl?: string;
}

defineProps<{
  tracks: LibraryTrack[];
  currentTrackId: string;
  playing: boolean;
  emptyText: string;
}>();

const emit = defineEmits<{
  (event: "play", track: LibraryTrack): void;
  (event: "play-all"): void;
  (event: "context-menu", payload: { track: LibraryTrack; event: MouseEvent }): void;
}>();

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}
</script>

<template>
  <section class="streaming-library-track-page">
    <div class="library-track-actions">
      <span>{{ tracks.length }} 首歌曲</span>
      <button type="button" :disabled="tracks.length === 0" @click="emit('play-all')">
        <Play :size="15" fill="currentColor" aria-hidden="true" />播放全部
      </button>
    </div>
    <div v-if="tracks.length" class="library-track-list">
      <button v-for="(track, index) in tracks" :key="track.id" type="button" :class="{ active: track.id === currentTrackId }" @click="emit('play', track)" @contextmenu.prevent="emit('context-menu', { track, event: $event })">
        <span class="library-track-index">{{ String(index + 1).padStart(2, "0") }}</span>
        <span class="library-track-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
          <img v-if="track.coverUrl" :src="track.coverUrl" :alt="`${track.title}封面`" />
          <span v-else>{{ track.mark }}</span>
        </span>
        <span class="library-track-name"><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span>
        <span class="library-track-album">{{ track.album }}</span>
        <span class="library-track-time">{{ formatDuration(track.duration) }}</span>
        <span v-if="track.id === currentTrackId" class="library-track-state" aria-hidden="true">
          <i v-if="playing"></i><i v-if="playing"></i><b v-else></b>
        </span>
      </button>
    </div>
    <p v-else class="library-track-empty">{{ emptyText }}</p>
  </section>
</template>

<style scoped>
.streaming-library-track-page { padding-bottom: 112px; }
.library-track-actions { display: flex; align-items: center; justify-content: space-between; min-height: 44px; margin-bottom: 12px; border-bottom: 1px solid #e3e6eb; color: #8a93a3; font-size: 12px; }
.library-track-actions button { display: inline-flex; align-items: center; height: 34px; gap: 7px; padding: 0 15px; border: 0; border-radius: 17px; color: #fff; background: #111a2b; font-weight: 700; cursor: pointer; }
.library-track-actions button:disabled { opacity: .45; cursor: default; }
.library-track-list { display: grid; gap: 3px; }
.library-track-list > button { display: grid; grid-template-columns: 48px 48px minmax(180px, 1.4fr) minmax(140px, 1fr) 60px 34px; align-items: center; min-height: 62px; padding: 7px 10px; border: 1px solid transparent; border-radius: 8px; color: #243047; background: transparent; text-align: left; cursor: pointer; transition: background 180ms ease, border-color 180ms ease; }
.library-track-list > button:hover { background: #fff; }
.library-track-list > button.active { border-color: #d8ebe8; background: #edf8f6; }
.library-track-index { color: #a2aec1; font-size: 11px; font-weight: 700; }
.library-track-cover { display: grid; width: 42px; height: 42px; place-items: center; overflow: hidden; border-radius: 6px; color: #fff; }
.library-track-cover img { width: 100%; height: 100%; object-fit: cover; }
.library-track-name { display: grid; min-width: 0; gap: 4px; padding: 0 14px; }
.library-track-name strong, .library-track-name small, .library-track-album { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.library-track-name strong { color: #172033; font-size: 13px; }
.library-track-name small, .library-track-album, .library-track-time { color: #78859b; font-size: 11px; }
.library-track-state { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; gap: 3px; border-radius: 50%; background: #158879; }
.library-track-state i { width: 3px; height: 11px; background: #fff; animation: track-pulse 700ms ease-in-out infinite alternate; }
.library-track-state i:nth-child(2) { animation-delay: 180ms; }
.library-track-state b { width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 8px solid #fff; }
.library-track-empty { padding: 70px 0; color: #8c95a5; text-align: center; }
@keyframes track-pulse { to { height: 5px; } }
@media (max-width: 820px) { .library-track-list > button { grid-template-columns: 36px 44px minmax(120px, 1fr) 52px 30px; } .library-track-album { display: none; } }
</style>
