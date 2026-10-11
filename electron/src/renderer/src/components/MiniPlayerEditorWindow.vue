<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { SlidersHorizontal, X } from "lucide-vue-next";
import { createDefaultMiniPlayerPreferences, type MiniPlayerPreferences } from "../services/appearanceSettings";
import MiniPlayerAppearanceSettings from "./MiniPlayerAppearanceSettings.vue";

const preferences = ref(createDefaultMiniPlayerPreferences());
const bridge = window.listenMusic;
const error = ref("");
let removeSnapshot: (() => void) | undefined;
const model = computed({
  get: () => preferences.value,
  set: (value: MiniPlayerPreferences) => {
    preferences.value = value;
    error.value = "";
    void window.listenMusic?.setMiniPlayerAppearance(JSON.parse(JSON.stringify(value))).then(ok => {
      if (!ok) error.value = "外观设置未保存，请重新选择图片或重试。";
    }).catch(() => { error.value = "外观设置未保存，请重试。"; });
  }
});
onMounted(async () => {
  let received = false;
  removeSnapshot = window.listenMusic?.onMiniPlayerSnapshot(value => {
    received = true;
    if (value.playback) preferences.value = value.playback.preferences;
  });
  const initial = await window.listenMusic?.getMiniPlayerSnapshot();
  if (!received && initial?.playback) preferences.value = initial.playback.preferences;
});
onBeforeUnmount(() => removeSnapshot?.());
</script>

<template>
  <main class="mini-editor-window">
    <header class="mini-editor-titlebar"><SlidersHorizontal :size="17" /><h1>迷你播放器外观</h1>
      <button type="button" title="关闭设置" aria-label="关闭设置" @click="bridge?.miniWindowCommand({ type: 'close-editor' })"><X :size="17" /></button>
    </header>
    <div class="mini-editor-content"><MiniPlayerAppearanceSettings v-model="model" standalone /><p v-if="error" role="alert">{{ error }}</p></div>
  </main>
</template>

<style scoped>
:global(html[data-window-mode="mini-editor"]),:global(html[data-window-mode="mini-editor"] body),:global(html[data-window-mode="mini-editor"] #app) { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #f4f4f6; }
.mini-editor-window { display: grid; height: 100%; grid-template-rows: 48px minmax(0,1fr); background: #f4f4f6; color: #27343c; font-family: "Microsoft YaHei UI",sans-serif; }
.mini-editor-titlebar { display: flex; align-items: center; gap: 10px; padding: 0 12px 0 18px; border-bottom: 1px solid #dfe3e7; -webkit-app-region: drag; }
.mini-editor-titlebar h1 { flex: 1; margin: 0; font-size: 14px; font-weight: 600; }
.mini-editor-titlebar button { display: grid; width: 30px; height: 30px; place-items: center; border: 0; border-radius: 6px; background: transparent; color: #63717d; cursor: pointer; -webkit-app-region: no-drag; }
.mini-editor-titlebar button:hover { background: #e4e7eb; }
.mini-editor-content { min-height: 0; overflow: auto; padding: 16px; }
.mini-editor-content p { color: #b34450; font-size: 12px; }
</style>
