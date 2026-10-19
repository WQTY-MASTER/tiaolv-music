<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  visible: boolean;
  playlistName: string;
  count: number;
  aggregate?: boolean;
  busy?: boolean;
  notice?: string;
}>(), { notice: "原始音频文件不会被删除。" });
const emit = defineEmits<{ cancel: []; remove: [] }>();
const cancelButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);
let previousFocus: HTMLElement | null = null;

function restoreFocus() {
  if (previousFocus?.isConnected) previousFocus.focus();
  previousFocus = null;
}
watch(() => props.visible, async visible => {
  if (visible) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    if (props.visible) cancelButton.value?.focus();
  } else restoreFocus();
}, { immediate: true });
onBeforeUnmount(restoreFocus);

function keepDialogFocus(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  if (props.busy || !props.count || (!event.shiftKey && document.activeElement === confirmButton.value)) {
    event.preventDefault();
    cancelButton.value?.focus();
  } else if (event.shiftKey && document.activeElement === cancelButton.value) {
    event.preventDefault();
    confirmButton.value?.focus();
  }
}
</script>

<template>
  <div v-if="visible" class="playlist-batch-confirm" role="dialog" aria-modal="true" aria-label="移出歌单" @click.self="emit('cancel')" @keydown="keepDialogFocus" @keydown.esc.prevent.stop="emit('cancel')">
    <section class="playlist-batch-confirm-panel">
      <h2>移出歌单</h2>
      <p>从「{{ playlistName }}」移出选中的 {{ count }} 首歌曲{{ aggregate ? "及其全部音源" : "" }}？{{ notice }}</p>
      <div><button ref="cancelButton" type="button" @click="emit('cancel')">取消</button><button ref="confirmButton" class="danger" type="button" :disabled="busy || !count" @click="emit('remove')">移出</button></div>
    </section>
  </div>
</template>

<style scoped>
.playlist-batch-confirm { position: fixed; inset: 0; z-index: 180; display: grid; place-items: center; padding: 24px; background: rgba(22,28,38,.46); }
.playlist-batch-confirm-panel { width: min(400px,100%); box-sizing: border-box; border: 1px solid #e1e6ec; border-radius: 8px; padding: 24px; background: #fff; color: #182235; box-shadow: 0 24px 70px rgba(20,29,43,.22); }
h2 { margin: 0; font-size: 18px; }
p { margin: 14px 0 22px; color: #61718a; font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; }
.playlist-batch-confirm-panel > div { display: flex; justify-content: flex-end; gap: 10px; }
button { display: inline-flex; min-height: 34px; align-items: center; justify-content: center; border: 1px solid #dce3ed; border-radius: 7px; padding: 0 12px; background: #fff; color: #315fbd; cursor: pointer; font: inherit; font-size: 12px; }
button:hover:not(:disabled) { background: #f3f6fb; border-color: #b7c9e6; }
button:disabled { opacity: .5; cursor: default; }
button.danger { color: #b8404d; }
:global(.app-shell.theme-dark) .playlist-batch-confirm-panel { border-color: #424b59; background: #242a34; color: #edf1f7; }
:global(.app-shell.theme-dark) p { color: #b3becd; }
:global(.app-shell.theme-dark) button { border-color: #424b59; background: #242a34; color: #b8ceff; }
:global(.app-shell.theme-dark) button.danger { color: #ffb1b9; }
</style>
