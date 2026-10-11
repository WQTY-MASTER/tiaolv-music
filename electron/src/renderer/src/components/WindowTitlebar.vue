<script setup lang="ts">
import { watch } from "vue";

const props = defineProps<{ dark: boolean }>();
const bridge = window.listenMusic;
const supported = bridge?.isWindows === true;

watch(() => props.dark, (dark) => {
  if (!supported) return;
  void bridge?.setWindowTitlebarTheme?.(dark).catch(() => {
    console.warn("Unable to update window caption contrast");
  });
}, { immediate: true });
</script>

<template>
  <div v-if="supported" class="desktop-titlebar-drag-region" aria-hidden="true"></div>
</template>

<style scoped>
.desktop-titlebar-drag-region {
  position: fixed;
  top: 0;
  right: 140px;
  left: 144px;
  z-index: 400;
  height: 32px;
  background: transparent;
  -webkit-app-region: drag;
}
</style>
