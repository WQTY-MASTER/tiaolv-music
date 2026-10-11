<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Copy, Minus, Square, X } from "lucide-vue-next";
import type { MainWindowCommand } from "../../../shared/desktopIntegration";

const props = defineProps<{ dark: boolean }>();
const bridge = window.listenMusic;
const supported = bridge?.isWindows === true;
const maximized = ref(false);
let disposeMaximized: (() => void) | undefined;
let stateRevision = 0;
let disposed = false;

onMounted(() => {
  if (!supported || !bridge) return;
  disposeMaximized = bridge.onMainWindowMaximized((value) => {
    stateRevision += 1;
    maximized.value = value;
  });
  const initialRevision = stateRevision;
  void bridge.getMainWindowMaximized().then((value) => {
    if (!disposed && stateRevision === initialRevision && value !== null) maximized.value = value;
  }).catch(() => {
    console.warn("Unable to read window caption state");
  });
});

onBeforeUnmount(() => {
  disposed = true;
  disposeMaximized?.();
});

async function commandWindow(command: MainWindowCommand) {
  if (!supported || !bridge) return;
  try {
    if (!await bridge.mainWindowCommand(command)) console.warn("Window caption command was rejected");
  } catch {
    console.warn("Unable to execute window caption command");
  }
}
</script>

<template>
  <div v-if="supported" class="desktop-titlebar-drag-region" aria-hidden="true"></div>
  <div v-if="supported" class="desktop-window-controls" :class="{ dark: props.dark }" role="group" aria-label="窗口控制">
    <button type="button" class="desktop-window-button" title="最小化" aria-label="最小化" @click="commandWindow('minimize')">
      <Minus :size="14" :stroke-width="1.5" aria-hidden="true" />
    </button>
    <button type="button" class="desktop-window-button" :title="maximized ? '还原' : '最大化'" :aria-label="maximized ? '还原' : '最大化'" @click="commandWindow('toggle-maximize')">
      <Copy v-if="maximized" :size="12" :stroke-width="1.5" aria-hidden="true" />
      <Square v-else :size="12" :stroke-width="1.5" aria-hidden="true" />
    </button>
    <button type="button" class="desktop-window-button" title="关闭" aria-label="关闭" @click="commandWindow('close')">
      <X :size="16" :stroke-width="1.5" aria-hidden="true" />
    </button>
  </div>
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

.desktop-window-controls {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 500;
  display: flex;
  width: 138px;
  height: 32px;
  color: #4b5568;
  -webkit-app-region: no-drag;
}

.desktop-window-button {
  display: grid;
  place-items: center;
  flex: 0 0 46px;
  width: 46px;
  height: 32px;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  color: inherit;
  background: transparent;
  cursor: default;
  -webkit-app-region: no-drag;
  transition: background-color 120ms ease;
}

.desktop-window-button:hover {
  background: #e5eaf4;
}

.desktop-window-button:active {
  background: #d8dfed;
}

.desktop-window-button:focus-visible {
  outline: 2px solid #8a99b5;
  outline-offset: -3px;
}

.desktop-window-controls.dark {
  color: #edf1f7;
}

.desktop-window-controls.dark .desktop-window-button:hover {
  background: rgba(226, 234, 248, 0.14);
}

.desktop-window-controls.dark .desktop-window-button:active {
  background: rgba(226, 234, 248, 0.22);
}

@media (prefers-reduced-motion: reduce) {
  .desktop-window-button {
    transition: none;
  }
}
</style>
