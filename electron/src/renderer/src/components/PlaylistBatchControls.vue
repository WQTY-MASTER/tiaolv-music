<script setup lang="ts">
import { ref, watch } from "vue";
import { ListChecks, Trash2, X } from "lucide-vue-next";
import PlaylistRemovalDialog from "./PlaylistRemovalDialog.vue";

const props = defineProps<{
  enabled: boolean;
  count: number;
  total: number;
  allSelected: boolean;
  busy: boolean;
  message: string;
  playlistName: string;
  aggregate?: boolean;
}>();
const emit = defineEmits<{ toggle: []; selectAll: [checked: boolean]; remove: [] }>();
const confirming = ref(false);
watch(() => [props.enabled, props.count, props.playlistName], () => { confirming.value = false; });
function confirmRemoval() {
  if (props.busy || !props.count) return;
  confirming.value = false;
  emit("remove");
}
</script>

<template>
  <div class="playlist-batch-controls">
    <button type="button" :aria-pressed="enabled" :disabled="busy || (!enabled && !total)" @click="emit('toggle')">
      <X v-if="enabled" :size="15" aria-hidden="true" /><ListChecks v-else :size="15" aria-hidden="true" />
      {{ enabled ? "退出批量" : "批量操作" }}
    </button>
    <template v-if="enabled">
      <label><input type="checkbox" :checked="allSelected" :indeterminate="count > 0 && !allSelected" :disabled="busy || !total" @change="emit('selectAll', ($event.target as HTMLInputElement).checked)" />全选当前列表</label>
      <span>已选 {{ count }} 首</span>
      <button class="danger" type="button" :disabled="busy || !count" @click="confirming = true"><Trash2 :size="15" aria-hidden="true" />{{ busy ? "移出中..." : "移出歌单" }}</button>
    </template>
    <span class="playlist-batch-message" role="status" aria-live="polite">{{ message }}</span>
  </div>
  <PlaylistRemovalDialog :visible="confirming" :playlist-name="playlistName" :count="count" :aggregate="aggregate" :busy="busy" @cancel="confirming = false" @remove="confirmRemoval" />
</template>

<style scoped>
.playlist-batch-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 16px 0; color: #61718a; font-size: 12px; }
button { display: inline-flex; min-height: 34px; align-items: center; justify-content: center; gap: 7px; border: 1px solid #dce3ed; border-radius: 7px; padding: 0 12px; background: #fff; color: #315fbd; cursor: pointer; font: inherit; font-size: 12px; }
button:hover:not(:disabled) { background: #f3f6fb; border-color: #b7c9e6; }
button:disabled { opacity: .5; cursor: default; }
button.danger { color: #b8404d; }
label { display: inline-flex; align-items: center; gap: 7px; }
input { width: 14px; height: 14px; accent-color: #315fbd; }
.playlist-batch-message { flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; line-height: 1.6; }
:global(.app-shell.theme-dark) .playlist-batch-controls { color: #b3becd; }
:global(.app-shell.theme-dark) button { border-color: #424b59; background: #242a34; color: #b8ceff; }
:global(.app-shell.theme-dark) button.danger { color: #ffb1b9; }
</style>
