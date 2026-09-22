<script setup lang="ts">
interface Playlist {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  primary: string;
  secondary: string;
  mark: string;
  imageUrl?: string;
}

const props = defineProps<{ playlist: Playlist; showPlay?: boolean }>();
const emit = defineEmits<{ select: [playlist: Playlist]; play: [playlist: Playlist] }>();
</script>

<template>
  <article class="playlist-card" @click="emit('select', props.playlist)">
    <div class="cover-art" :style="{ background: `linear-gradient(135deg, ${props.playlist.primary}, ${props.playlist.secondary})` }">
      <img v-if="props.playlist.imageUrl" :src="props.playlist.imageUrl" :alt="`${props.playlist.title}封面`" />
      <span v-else class="cover-sheen" aria-hidden="true"></span>
      <span v-if="!props.playlist.imageUrl" class="cover-symbol">{{ props.playlist.mark }}</span>
      <span v-if="props.playlist.count > 0" class="cover-count">{{ props.playlist.count }} 首</span>
      <button v-if="props.showPlay !== false" class="cover-play" type="button" title="播放歌单" aria-label="播放歌单" @click.stop="emit('play', props.playlist)">▶</button>
    </div>
    <div class="card-copy"><strong>{{ props.playlist.title }}</strong><span>{{ props.playlist.subtitle }}</span></div>
  </article>
</template>

<style scoped>
.playlist-card { min-width: 0; cursor: pointer; }.cover-art { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 10px; background: #dbe7e5; box-shadow: 0 10px 22px rgba(36,45,48,.1); transition: transform 180ms ease,box-shadow 180ms ease; }.cover-art img { width: 100%; height: 100%; object-fit: cover; }.playlist-card:hover .cover-art { transform: translateY(-4px); box-shadow: 0 15px 25px rgba(36,45,48,.17); }.cover-sheen { position: absolute; inset: -30% 25% 30% -20%; border-radius: 50%; background: rgba(255,255,255,.23); transform: rotate(-24deg); }.cover-symbol { position: absolute; top: 24%; left: 15%; color: rgba(255,255,255,.91); font-family: Georgia,"Times New Roman",serif; font-size: clamp(22px,3vw,42px); font-weight: 700; line-height: 1; }.cover-count { position: absolute; right: 12px; bottom: 10px; color: rgba(255,255,255,.86); font-size: 10px; font-weight: 700; }.cover-play { position: absolute; right: 10px; bottom: 10px; display: grid; width: 31px; height: 31px; place-items: center; border: 0; border-radius: 50%; background: #fff; color: #1e2728; cursor: pointer; font-size: 12px; opacity: 0; transform: translateY(5px); transition: opacity 180ms ease,transform 180ms ease; }.playlist-card:hover .cover-play { opacity: 1; transform: translateY(0); }.card-copy { display: grid; gap: 5px; padding: 10px 2px 0; }.card-copy strong,.card-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.card-copy strong { color: #373e40; font-size: 12px; font-weight: 700; }.card-copy span { color: #a2a8aa; font-size: 10px; }
</style>
