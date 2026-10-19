<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { resolveBackendUrl } from "../services/api";

const props = defineProps<{ imageUrl?: string; mark?: string }>();
const source = computed(() => resolveBackendUrl(props.imageUrl));
const displayUrl = ref("");
const failed = ref(false);
let revision = 0;

watch(source, async url => {
  const request = ++revision;
  failed.value = false;
  displayUrl.value = url;
  if (url.startsWith("file:") && window.listenMusic?.resolvePlaylistCoverImage) {
    displayUrl.value = "";
    try {
      const imported = await window.listenMusic.resolvePlaylistCoverImage(url);
      if (request === revision) displayUrl.value = imported || "";
    } catch {
      if (request === revision) failed.value = true;
    }
  }
}, { immediate: true });
</script>

<template>
  <span class="track-playlist-target-art" aria-hidden="true">
    <img v-if="displayUrl && !failed" :src="displayUrl" alt="" @error="failed = true" />
    <slot v-else>{{ mark }}</slot>
  </span>
</template>

<style scoped>
.track-playlist-target-art { overflow: hidden; }
img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
