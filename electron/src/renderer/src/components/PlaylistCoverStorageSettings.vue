<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { RefreshCw, Trash2 } from "lucide-vue-next";
import type { PlaylistCoverStorageStatistics } from "../../../shared/playlistCoverStorage";

const props = defineProps<{
  statistics: PlaylistCoverStorageStatistics | null;
  busy: boolean;
  error: string;
  notice: string;
  confirmVisible: boolean;
}>();
const emit = defineEmits<{ refresh: []; requestCleanup: []; confirm: []; cancel: [] }>();
const cancelButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);
let previousFocus: HTMLElement | null = null;
function restoreFocus() { if (previousFocus?.isConnected) previousFocus.focus(); previousFocus = null; }
watch(() => props.confirmVisible, async visible => {
  if (visible) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    if (props.confirmVisible) cancelButton.value?.focus();
  } else restoreFocus();
}, { immediate: true });
watch(() => props.busy, async busy => {
  if (!busy || !props.confirmVisible) return;
  await nextTick();
  if (props.busy && props.confirmVisible) cancelButton.value?.focus();
}, { flush: "post" });
onBeforeUnmount(restoreFocus);
function keepFocus(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  if (props.busy || (!event.shiftKey && document.activeElement === confirmButton.value)) {
    event.preventDefault(); cancelButton.value?.focus();
  } else if (event.shiftKey && document.activeElement === cancelButton.value) {
    event.preventDefault(); confirmButton.value?.focus();
  }
}
function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <section class="original-cover-storage" aria-label="原始歌单封面">
    <div class="original-cover-heading">
      <strong>原始歌单封面</strong>
      <div class="original-cover-actions">
        <button type="button" title="刷新原始封面统计" aria-label="刷新原始封面统计" :disabled="busy" @click="emit('refresh')"><RefreshCw :size="16" aria-hidden="true" /></button>
        <button type="button" title="清理未使用原始封面" aria-label="清理未使用原始封面" :disabled="busy || Boolean(error) || !statistics?.reclaimableEntries" @click="emit('requestCleanup')"><Trash2 :size="16" aria-hidden="true" /></button>
      </div>
    </div>
    <dl>
      <div><dt>已保存</dt><dd>{{ statistics ? `${statistics.entries} 项 / ${size(statistics.bytes)}` : '未读取' }}</dd></div>
      <div><dt>可清理</dt><dd>{{ statistics ? `${statistics.reclaimableEntries} 项 / ${size(statistics.reclaimableBytes)}` : '未读取' }}</dd></div>
    </dl>
    <p v-if="error" class="original-cover-error" role="alert">{{ error }}</p>
    <p v-else-if="busy || notice" role="status">{{ busy ? '正在处理原始封面…' : notice }}</p>
    <Teleport to="body">
      <div v-if="confirmVisible" class="original-cover-confirm" role="dialog" aria-modal="true" aria-label="清理未使用原始封面" @click.self="!busy && emit('cancel')" @keydown="keepFocus" @keydown.esc.prevent.stop="!busy && emit('cancel')">
        <section class="original-cover-confirm-panel">
          <h2>清理未使用原始封面</h2>
          <p>清理未被歌单或歌曲引用、且保存已超过 24 小时的封面副本？原始图片不会被删除。</p>
          <p v-if="error" class="original-cover-error" role="alert">{{ error }}</p>
          <div><button ref="cancelButton" type="button" :aria-disabled="busy" @click="!busy && emit('cancel')">取消</button><button ref="confirmButton" type="button" :disabled="busy" @click="emit('confirm')">清理</button></div>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.original-cover-storage { margin-top: 20px; padding: 16px 0; border-top: 1px solid var(--settings-border,#e1e6ec); border-bottom: 1px solid var(--settings-border,#e1e6ec); }
.original-cover-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; }
.original-cover-actions { display: flex; gap: 8px; }
button { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; border: 1px solid #dce3ed; border-radius: 6px; padding: 0 12px; background: #fff; color: #315fbd; font: inherit; font-size: 12px; cursor: pointer; }
.original-cover-actions button { width: 34px; height: 34px; padding: 0; }
button:disabled { opacity: .5; cursor: default; }
button:hover:not(:disabled) { background: #f3f6fb; }
dl { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; margin: 12px 0 0; }
dl > div { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12px; }
dt { color: #61718a; } dd { margin: 0; overflow-wrap: anywhere; }
p { margin: 10px 0 0; font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
.original-cover-error { color: #b8404d; }
.original-cover-confirm { position: fixed; inset: 0; z-index: 180; display: grid; place-items: center; padding: 24px; background: rgba(22,28,38,.46); }
.original-cover-confirm-panel { width: min(400px,100%); box-sizing: border-box; border: 1px solid #e1e6ec; border-radius: 8px; padding: 24px; background: #fff; color: #182235; box-shadow: 0 24px 70px rgba(20,29,43,.22); }
h2 { margin: 0; font-size: 18px; }
.original-cover-confirm-panel > div { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
:global(.app-shell.theme-dark) .original-cover-storage { border-color: #424b59; }
:global(.app-shell.theme-dark) .original-cover-storage button { border-color: #424b59; background: #242a34; color: #b8ceff; }
@media (prefers-color-scheme: dark) { .original-cover-confirm-panel { border-color: #424b59; background: #242a34; color: #edf1f7; } }
@media (max-width: 420px) { dl { grid-template-columns: minmax(0,1fr); } }
</style>
