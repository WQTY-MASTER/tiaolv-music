<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, Play, RefreshCw } from "lucide-vue-next";

interface CuratedPlaylist {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  imageUrl?: string;
  primary: string;
  secondary: string;
  mark: string;
  recommendationSource?: string;
  recommendationReason?: string;
}

const props = defineProps<{ playlists: CuratedPlaylist[]; refreshing?: boolean; error?: string }>();
const hasPersonalRecommendations = computed(() => props.playlists.some(playlist => (
  playlist.recommendationSource === "qq-personal" || playlist.recommendationSource === "local-listening"
)));

const emit = defineEmits<{
  (event: "select", playlist: CuratedPlaylist): void;
  (event: "discover"): void;
  (event: "refresh"): void;
}>();
</script>

<template>
  <section class="qq-curated" aria-label="QQ 音乐精选歌单">
    <header class="qq-curated-header">
      <div>
        <h3>{{ hasPersonalRecommendations ? '把喜欢，听成一张歌单' : '热门精选歌单' }} <span>/ CURATED PLAYLISTS</span></h3>
      </div>
      <div class="qq-curated-actions">
        <button type="button" class="qq-curated-refresh" :disabled="refreshing"
          title="刷新推荐歌单" aria-label="刷新推荐歌单" @click="emit('refresh')">
          <RefreshCw :size="16" :stroke-width="1.8" :class="{ 'is-refreshing': refreshing }" aria-hidden="true" />
        </button>
      <button type="button" @click="emit('discover')">
        发现更多 <ArrowRight :size="16" :stroke-width="1.8" aria-hidden="true" />
      </button>
      </div>
    </header>
    <p v-if="error" class="qq-curated-message" role="alert">{{ error }}</p>
    <p v-else-if="!playlists.length" class="qq-curated-message" role="status">暂时没有可推荐的歌单</p>

    <div class="qq-curated-grid">
      <button
        v-for="playlist in playlists.slice(0, 12)"
        :key="playlist.id"
        class="qq-curated-item"
        type="button"
        @click="emit('select', playlist)"
      >
        <span class="qq-curated-cover" :style="{ background: `linear-gradient(135deg, ${playlist.primary}, ${playlist.secondary})` }">
          <img v-if="playlist.imageUrl" :src="playlist.imageUrl" :alt="`${playlist.title}封面`" />
          <b v-else aria-hidden="true">{{ playlist.mark }}</b>
          <span class="qq-curated-play"><Play :size="18" :stroke-width="1.8" fill="currentColor" aria-hidden="true" /></span>
        </span>
        <strong>{{ playlist.title }}</strong>
      </button>
    </div>
  </section>
</template>

<style scoped>
.qq-curated { display: grid; gap: 22px; }
.qq-curated-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.qq-curated-header h3 { margin: 0; color: #172238; font-size: 20px; letter-spacing: 0; }
.qq-curated-header h3 span { margin-left: 8px; color: #8795a9; font-size: 9px; font-weight: 800; letter-spacing: 1.5px; }
.qq-curated-header button { display: inline-flex; align-items: center; gap: 8px; border: 0; padding: 7px 0; background: transparent; color: #66778d; cursor: pointer; font-size: 12px; }
.qq-curated-header button:hover,
.qq-curated-header button:focus-visible { color: #172238; outline: none; }
.qq-curated-actions { display: flex; flex-shrink: 0; align-items: center; gap: 16px; }
.qq-curated-header .qq-curated-refresh { display: grid; width: 32px; height: 32px; padding: 0; place-items: center; }
.qq-curated-header button:disabled { opacity: .5; cursor: wait; }
.qq-curated-message { margin: 0; color: #7b899d; font-size: 12px; }
.is-refreshing { animation: qq-curated-spin 1s linear infinite; }
@keyframes qq-curated-spin { to { transform: rotate(360deg); } }
.qq-curated-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 28px 18px; }
.qq-curated-item { display: grid; min-width: 0; gap: 0; border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.qq-curated-cover { position: relative; display: grid; width: 100%; aspect-ratio: 1; overflow: hidden; place-items: center; border-radius: 8px; color: #fff; box-shadow: 0 8px 22px rgba(26, 39, 59, .08); transition: box-shadow .18s ease, transform .18s ease; }
.qq-curated-cover img { width: 100%; height: 100%; object-fit: cover; }
.qq-curated-cover b { font-size: 36px; }
.qq-curated-play { position: absolute; right: 12px; bottom: 12px; display: grid; width: 34px; height: 34px; place-items: center; border-radius: 50%; background: rgba(255, 255, 255, .94); color: #172238; opacity: 0; transform: translateY(5px); transition: opacity .16s ease, transform .16s ease; }
.qq-curated-item:hover .qq-curated-cover,
.qq-curated-item:focus-visible .qq-curated-cover { box-shadow: 0 14px 28px rgba(26, 39, 59, .14); transform: translateY(-3px); }
.qq-curated-item:hover .qq-curated-play,
.qq-curated-item:focus-visible .qq-curated-play { opacity: 1; transform: none; }
.qq-curated-item:focus-visible { outline: none; }
.qq-curated-item strong { display: -webkit-box; min-height: 38px; overflow: hidden; margin-top: 10px; color: #172238; font-size: 12px; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
@media (max-width: 1200px) { .qq-curated-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 720px) {
  .qq-curated-header { align-items: flex-start; }
  .qq-curated-header h3 span { display: block; margin: 5px 0 0; }
  .qq-curated-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 12px; }
}
</style>
