<script setup lang="ts">
import { ArrowUpRight, ChartNoAxesCombined, Play, Zap } from "lucide-vue-next";

interface RankingTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  primary: string;
  secondary: string;
  mark: string;
}

interface QqHomeRanking {
  key: string;
  title: string;
  eyebrow: string;
  description: string;
  count: number;
  tracks: RankingTrack[];
  state: "idle" | "loading" | "success" | "error";
  error: string;
}

defineProps<{ rankings: QqHomeRanking[] }>();

const emit = defineEmits<{
  (event: "play", rankingKey: string, trackId: string): void;
  (event: "context-menu", payload: { rankingKey: string; trackId: string; event: MouseEvent }): void;
  (event: "open", rankingKey: string): void;
  (event: "retry"): void;
}>();
</script>

<template>
  <section class="qq-ranking-grid" aria-label="QQ 音乐排行榜">
    <article
      v-for="(ranking, cardIndex) in rankings"
      :key="ranking.key"
      class="qq-ranking-card"
      :class="cardIndex === 0 ? 'is-rising' : 'is-hot'"
    >
      <header class="qq-ranking-header">
        <div>
          <span>{{ ranking.eyebrow }}</span>
          <h3>{{ ranking.title }}</h3>
          <p>{{ ranking.description }}</p>
        </div>
        <button type="button" :title="`查看${ranking.title}`" :aria-label="`查看${ranking.title}`" @click="emit('open', ranking.key)">
          <ChartNoAxesCombined v-if="cardIndex === 0" :size="18" :stroke-width="1.8" aria-hidden="true" />
          <Zap v-else :size="18" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </header>

      <div v-if="ranking.state === 'loading'" class="qq-ranking-state">正在加载榜单...</div>
      <div v-else-if="ranking.state === 'error'" class="qq-ranking-state is-error">
        <span>{{ ranking.error || "榜单暂时无法加载" }}</span>
        <button type="button" @click="emit('retry')">重试</button>
      </div>
      <div v-else class="qq-ranking-list">
        <button
          v-for="(track, index) in ranking.tracks.slice(0, 3)"
          :key="track.id"
          class="qq-ranking-track"
          type="button"
          @click="emit('play', ranking.key, track.id)"
          @contextmenu.prevent="emit('context-menu', { rankingKey: ranking.key, trackId: track.id, event: $event })"
        >
          <span class="qq-ranking-index">{{ String(index + 1).padStart(2, "0") }}</span>
          <span class="qq-ranking-cover" :style="{ background: `linear-gradient(135deg, ${track.primary}, ${track.secondary})` }">
            <img v-if="track.coverUrl" :src="track.coverUrl" :alt="`${track.title}封面`" />
            <span v-else aria-hidden="true">{{ track.mark }}</span>
          </span>
          <span class="qq-ranking-copy">
            <strong>{{ track.title }}</strong>
            <small>{{ track.artist }}</small>
          </span>
          <Play class="qq-ranking-play" :size="14" :stroke-width="1.8" fill="currentColor" aria-hidden="true" />
        </button>
      </div>

      <button class="qq-ranking-all" type="button" :disabled="!ranking.tracks.length" @click="emit('open', ranking.key)">
        <span>查看全部 {{ ranking.count }} 首</span>
        <ArrowUpRight :size="16" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </article>
  </section>
</template>

<style scoped>
.qq-ranking-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.qq-ranking-card {
  min-width: 0;
  padding: 26px 28px 20px;
  border: 1px solid #dfe6e8;
  border-radius: 8px;
  background: linear-gradient(105deg, #eef6fa 0%, #f7fafc 56%, #ffffff 100%);
}

.qq-ranking-card.is-rising {
  background: linear-gradient(105deg, #edf9f3 0%, #f7fbf9 56%, #ffffff 100%);
}

.qq-ranking-header {
  display: flex;
  min-height: 92px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.qq-ranking-header span {
  color: #76879c;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.6px;
}

.qq-ranking-header h3 {
  margin: 12px 0 14px;
  color: #142238;
  font-size: 22px;
}

.qq-ranking-header p {
  margin: 0;
  color: #6b7f97;
  font-size: 13px;
  line-height: 1.55;
}

.qq-ranking-header > button {
  display: inline-grid;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid #dce4e7;
  border-radius: 50%;
  background: rgba(255, 255, 255, .66);
  color: #24364d;
  cursor: pointer;
  transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease, color .16s ease, transform .12s ease;
}

.qq-ranking-header > button:hover,
.qq-ranking-header > button:focus-visible {
  border-color: #c8d2d8;
  background: #eef1f3;
  color: #142238;
  box-shadow: 0 5px 14px rgba(32, 49, 70, .09);
  outline: none;
}

.qq-ranking-header > button:active {
  border-color: #bdc9d0;
  background: #e2e7ea;
  box-shadow: 0 2px 6px rgba(32, 49, 70, .08);
  transform: scale(.95);
}

.qq-ranking-list {
  display: grid;
  min-height: 188px;
  align-content: start;
  gap: 5px;
  margin-top: 12px;
}

.qq-ranking-track {
  display: grid;
  grid-template-columns: 30px 42px minmax(0, 1fr) 24px;
  min-width: 0;
  min-height: 56px;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 6px 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #17253a;
  cursor: pointer;
  text-align: left;
  transition: background-color .16s ease, box-shadow .16s ease, transform .12s ease;
}

.qq-ranking-track:hover,
.qq-ranking-track:focus-visible {
  background: #eef1f3;
  box-shadow: inset 0 0 0 1px rgba(200, 210, 216, .45);
  outline: none;
}

.qq-ranking-track:active {
  background: #e2e7ea;
  box-shadow: inset 0 0 0 1px rgba(189, 201, 208, .55);
  transform: scale(.995);
}

.qq-ranking-index { color: #7890a4; font-size: 12px; }

.qq-ranking-cover {
  display: grid;
  width: 42px;
  height: 42px;
  overflow: hidden;
  place-items: center;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
}

.qq-ranking-cover img { width: 100%; height: 100%; object-fit: cover; }
.qq-ranking-copy { min-width: 0; }
.qq-ranking-copy strong,
.qq-ranking-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qq-ranking-copy strong { font-size: 13px; }
.qq-ranking-copy small { margin-top: 5px; color: #718398; font-size: 11px; }
.qq-ranking-play { justify-self: end; color: #7a8fa5; opacity: .72; }

.qq-ranking-state {
  display: grid;
  min-height: 205px;
  place-items: center;
  color: #718398;
  font-size: 13px;
}

.qq-ranking-state.is-error { align-content: center; gap: 10px; }
.qq-ranking-state button { border: 0; background: transparent; color: #286fd2; }

.qq-ranking-all {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding: 16px 0 0;
  border: 0;
  border-top: 1px solid #dde5e7;
  background: transparent;
  color: #52677e;
  font-size: 12px;
  text-align: left;
}

.qq-ranking-all:not(:disabled):hover { color: #17253a; }

@media (max-width: 900px) {
  .qq-ranking-grid { grid-template-columns: 1fr; }
}
</style>
