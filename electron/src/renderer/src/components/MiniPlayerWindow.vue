<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { MINI_RESIZE_EDGES, type MiniPlayerAction, type MiniPlayerTrack, type MiniResizeEdge, type MiniWindowSnapshot } from "../../../shared/miniPlayer";
import MiniPlayer from "./MiniPlayer.vue";

const bridge = window.listenMusic;
const snapshot = ref<MiniWindowSnapshot | null>(null);
const queueOpen = ref(false);
const queueShellOpen = ref(false);
let removeSnapshot: (() => void) | undefined;
let removeTime: (() => void) | undefined;
let queueRequest = 0;
let queueLeaveTimer: ReturnType<typeof setTimeout> | undefined;
let resizePointer: number | null = null;
let resizePending = false;
let readinessSent = false;
let disposed = false;

watch(() => Boolean(snapshot.value?.playback), async ready => {
  if (!ready || readinessSent) return;
  readinessSent = true;
  await nextTick();
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (!disposed) await bridge?.miniWindowCommand({ type: "ready" });
}, { flush: "post" });

function action(value: MiniPlayerAction) { bridge?.sendMiniPlayerAction(value); }
function queueKey(track: MiniPlayerTrack) { return track.queueKey ?? track.id; }

async function setQueue(open: boolean) {
  const request = ++queueRequest;
  if (queueLeaveTimer) clearTimeout(queueLeaveTimer);
  queueShellOpen.value = true;
  queueOpen.value = open;
  try {
    if (await bridge?.setMiniQueueExpanded(open) === false) { queueOpen.value = false; queueShellOpen.value = false; return; }
    if (!open) queueLeaveTimer = setTimeout(() => { if (request === queueRequest) queueShellOpen.value = false; }, 220);
  } catch { queueOpen.value = false; queueShellOpen.value = false; }
}

async function startResize(event: PointerEvent, edge: MiniResizeEdge) {
  if (event.button !== 0 || snapshot.value?.window.locked) return;
  event.preventDefault();
  const element = event.currentTarget as HTMLElement;
  element.setPointerCapture(event.pointerId);
  resizePointer = event.pointerId;
  try {
    if (!await bridge?.startMiniResize(edge) && resizePointer === event.pointerId) endResize(event);
  } catch { endResize(event); }
}

async function moveResize(event: PointerEvent) {
  if (resizePointer !== event.pointerId || resizePending) return;
  resizePending = true;
  try { await bridge?.moveMiniResize(); } finally { resizePending = false; }
}

function endResize(event: PointerEvent) {
  if (resizePointer !== event.pointerId) return;
  const element = event.currentTarget as HTMLElement;
  if (element?.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  resizePointer = null;
  void bridge?.endMiniResize();
}

onMounted(async () => {
  let received = false;
  removeSnapshot = bridge?.onMiniPlayerSnapshot(value => { received = true; snapshot.value = value; });
  removeTime = bridge?.onMiniPlayerTime(time => { if (snapshot.value?.playback) Object.assign(snapshot.value.playback, time); });
  const initial = await bridge?.getMiniPlayerSnapshot();
  if (!received && initial) snapshot.value = initial;
});
onBeforeUnmount(() => {
  disposed = true;
  removeSnapshot?.();
  removeTime?.();
  if (queueLeaveTimer) clearTimeout(queueLeaveTimer);
});
</script>

<template>
  <MiniPlayer
    v-if="snapshot?.playback"
    v-bind="snapshot.playback"
    :native-window="true"
    :locked="snapshot.window.locked"
    :always-on-top="snapshot.window.alwaysOnTop"
    :queue-open="queueOpen"
    :queue-shell-open="queueShellOpen"
    @toggle="action({ type: 'toggle' })"
    @previous="action({ type: 'previous' })"
    @next="action({ type: 'next' })"
    @like="action({ type: 'like' })"
    @volume="value => action({ type: 'volume', value })"
    @mode="action({ type: 'mode' })"
    @queue="setQueue(!queueOpen)"
    @queue-dismiss="setQueue(false)"
    @queue-track-play="track => action({ type: 'queue-play', key: queueKey(track) })"
    @queue-track-like="track => action({ type: 'queue-like', key: queueKey(track) })"
    @queue-track-remove="key => action({ type: 'queue-remove', key })"
    @queue-track-add-playlist="(track, playlistId) => action({ type: 'queue-add', key: queueKey(track), playlistId })"
    @queue-track-create-playlist="(track, name) => action({ type: 'queue-create', key: queueKey(track), name })"
    @queue-track-copy="track => action({ type: 'queue-copy', key: queueKey(track) })"
    @customize="bridge?.miniWindowCommand({ type: 'customize' })"
    @lock="bridge?.miniWindowCommand({ type: 'lock', value: !snapshot.window.locked })"
    @pin="bridge?.miniWindowCommand({ type: 'pin', value: !snapshot.window.alwaysOnTop })"
    @minimize="bridge?.miniWindowCommand({ type: 'minimize' })"
    @close="bridge?.miniWindowCommand({ type: 'return' })"
  />
  <template v-if="snapshot && !snapshot.window.locked">
    <div v-for="edge in MINI_RESIZE_EDGES" :key="edge" class="mini-resize-grip" :class="`edge-${edge}`" aria-hidden="true"
      @pointerdown="startResize($event, edge)" @pointermove="moveResize" @pointerup="endResize" @pointercancel="endResize" @lostpointercapture="endResize"></div>
  </template>
</template>

<style scoped>
:global(html[data-window-mode="mini-player"]),
:global(html[data-window-mode="mini-player"] body),
:global(html[data-window-mode="mini-player"] #app) { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent !important; }
.mini-resize-grip { position: fixed; z-index: 110; -webkit-app-region: no-drag; touch-action: none; }
.edge-n,.edge-s { left: 16px; right: 16px; height: 8px; cursor: ns-resize; }
.edge-n { top: 0; }.edge-s { bottom: 0; }
.edge-e,.edge-w { top: 16px; bottom: 16px; width: 8px; cursor: ew-resize; }
.edge-e { right: 0; }.edge-w { left: 0; }
.edge-ne,.edge-nw,.edge-se,.edge-sw { width: 16px; height: 16px; }
.edge-ne { top: 0; right: 0; cursor: nesw-resize; }.edge-nw { top: 0; left: 0; cursor: nwse-resize; }
.edge-se { bottom: 0; right: 0; cursor: nwse-resize; }.edge-sw { bottom: 0; left: 0; cursor: nesw-resize; }
</style>
