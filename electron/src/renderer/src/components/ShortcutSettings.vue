<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Command, RotateCcw } from "lucide-vue-next";
import {
  SHORTCUT_DEFINITIONS, acceleratorFromInput, defaultShortcutConfig, formatAccelerator,
  type ShortcutAction, type ShortcutPatch, type ShortcutSnapshot
} from "../../../shared/shortcuts";

const snapshot = ref<ShortcutSnapshot>({ config: defaultShortcutConfig(), conflicts: {}, recording: false });
const loaded = ref(false);
const busy = ref(false);
const recording = ref<ShortcutAction | null>(null);
const candidate = ref("");
const recordReady = ref(false);
const error = ref("");
const errorAction = ref<ShortcutAction | null>(null);
const groups = ["播放控制", "窗口", "桌面歌词"];
let dispose: (() => void) | undefined;
let disposed = false;

function acceptSnapshot(next: ShortcutSnapshot) {
  snapshot.value = next;
  if (!next.recording) {
    recording.value = null;
    candidate.value = "";
    recordReady.value = false;
  }
}

function errorText(reason: unknown) {
  return String(reason instanceof Error ? reason.message : reason).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
}

async function update(patch: ShortcutPatch, reset = false, action: ShortcutAction | null = null) {
  const bridge = window.listenMusic;
  if (!bridge || busy.value) return;
  busy.value = true;
  error.value = "";
  errorAction.value = action;
  try {
    acceptSnapshot(await bridge.updateShortcuts(patch, reset));
  } catch (reason) {
    error.value = errorText(reason);
  } finally {
    busy.value = false;
  }
}

async function startRecording(action: ShortcutAction) {
  const bridge = window.listenMusic;
  if (!bridge || busy.value || recording.value) return;
  error.value = "";
  errorAction.value = action;
  recording.value = action;
  candidate.value = "";
  recordReady.value = false;
  try {
    const next = await bridge.setShortcutRecording(true);
    if (disposed) {
      await bridge.setShortcutRecording(false);
      return;
    }
    acceptSnapshot(next);
    if (next.recording) {
      recording.value = action;
      recordReady.value = true;
    }
  } catch (reason) {
    recording.value = null;
    error.value = errorText(reason);
  }
}

async function cancelRecording() {
  recording.value = null;
  candidate.value = "";
  recordReady.value = false;
  try {
    const next = await window.listenMusic?.setShortcutRecording(false);
    if (next) acceptSnapshot(next);
  } catch (reason) { error.value = errorText(reason); }
}

function recordKey(event: KeyboardEvent) {
  if (!recording.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!recordReady.value || event.repeat || event.isComposing) return;
  if (event.key === "Escape") { void cancelRecording(); return; }
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;
  candidate.value = acceleratorFromInput({
    key: event.key, code: event.code, control: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey
  }) ?? "";
  error.value = candidate.value ? "" : "请使用 Ctrl、Alt 或 Win 加其他按键，或 F1–F24。";
}

function finishKey(event: KeyboardEvent) {
  if (!recording.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!candidate.value || ["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;
  const action = recording.value;
  const accelerator = candidate.value;
  recording.value = null;
  candidate.value = "";
  void update({ bindings: { [action]: accelerator } }, false, action);
}

function handleBlur() { if (recording.value) void cancelRecording(); }

onMounted(async () => {
  window.addEventListener("keydown", recordKey, true);
  window.addEventListener("keyup", finishKey, true);
  window.addEventListener("blur", handleBlur);
  const bridge = window.listenMusic;
  if (!bridge) { error.value = "快捷键配置仅在桌面客户端可用。"; return; }
  dispose = bridge.onShortcutsChanged(acceptSnapshot);
  try { acceptSnapshot(await bridge.getShortcuts()); loaded.value = true; }
  catch (reason) { error.value = errorText(reason); }
});

onBeforeUnmount(() => {
  disposed = true;
  dispose?.();
  window.removeEventListener("keydown", recordKey, true);
  window.removeEventListener("keyup", finishKey, true);
  window.removeEventListener("blur", handleBlur);
  if (recording.value) void cancelRecording();
});
</script>

<template>
  <article class="settings-card shortcut-settings-card" aria-labelledby="shortcut-title">
    <header class="shortcut-heading">
      <span class="shortcut-icon"><Command :size="22" aria-hidden="true" /></span>
      <h2 id="shortcut-title">快捷键</h2>
      <button class="shortcut-reset" :disabled="!loaded || busy || Boolean(recording)" @click="update(defaultShortcutConfig(), true)">
        <RotateCcw :size="15" aria-hidden="true" />恢复默认
      </button>
    </header>
    <div class="shortcut-master">
      <div><strong>启用全局快捷键</strong><p>关闭后仅应用内生效，后台无法使用。</p></div>
      <input
        class="shortcut-switch" type="checkbox" role="switch" aria-label="启用全局快捷键"
        :checked="snapshot.config.enabled" :disabled="!loaded || busy || Boolean(recording)"
        @change="update({ enabled: ($event.target as HTMLInputElement).checked })"
      />
    </div>
    <p v-if="error && !errorAction" class="shortcut-error" role="alert">{{ error }}</p>
    <section v-for="group in groups" :key="group" class="shortcut-group" :aria-label="group">
      <h3>{{ group }}</h3>
      <div v-for="item in SHORTCUT_DEFINITIONS.filter((entry) => entry.group === group)" :key="item.id" class="shortcut-row">
        <div class="shortcut-label">
          <span>{{ item.label }}</span>
          <p v-if="(errorAction === item.id && error) || snapshot.conflicts[item.id]" class="shortcut-error" role="alert">
            {{ (errorAction === item.id && error) || snapshot.conflicts[item.id] }}
          </p>
        </div>
        <button
          class="shortcut-binding" :class="{ recording: recording === item.id, conflict: snapshot.conflicts[item.id] || (errorAction === item.id && error) }"
          :disabled="!loaded || busy || (Boolean(recording) && recording !== item.id)"
          :aria-label="`${item.label}：${formatAccelerator(snapshot.config.bindings[item.id])}`"
          :title="recording === item.id ? '按下组合键，Esc 取消' : '修改快捷键'"
          @click="startRecording(item.id)"
          @blur="recording === item.id && cancelRecording()"
        >
          <span v-if="recording === item.id">{{ candidate ? formatAccelerator(candidate) : '请按下组合键…' }}</span>
          <template v-else>
            <kbd v-for="(key, index) in formatAccelerator(snapshot.config.bindings[item.id]).split(' + ')" :key="index">{{ key || '未设置' }}</kbd>
          </template>
        </button>
      </div>
    </section>
  </article>
</template>

<style scoped>
.shortcut-heading { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.shortcut-icon { display: grid; place-items: center; width: 46px; height: 46px; flex-shrink: 0; border-radius: 8px; color: #246bff; background: #edf3ff; }
.shortcut-heading h2 { margin: 0; font-size: 20px; color: #11192b; }
.shortcut-reset { margin-left: auto; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 12px; border: 1px solid #dce3ed; border-radius: 6px; color: #55647b; background: white; cursor: pointer; }
.shortcut-master { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; border-top: 1px solid #e8edf5; border-bottom: 1px solid #e8edf5; }
.shortcut-master strong { font-size: 14px; color: #11192b; }
.shortcut-master p { margin: 6px 0 0; font-size: 12px; color: #718098; }
.shortcut-switch { appearance: none; position: relative; width: 36px; height: 20px; flex-shrink: 0; border: none; border-radius: 10px; background: #bbc4d3; cursor: pointer; }
.shortcut-switch:checked { background: #246bff; }
.shortcut-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: white; transition: transform 120ms ease; }
.shortcut-switch:checked::after { transform: translateX(16px); }
.shortcut-group { margin-top: 22px; }
.shortcut-group h3 { margin: 0; padding-bottom: 8px; font-size: 12px; font-weight: 600; color: #7b8799; }
.shortcut-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 54px; padding: 6px 0; border-bottom: 1px solid #eef1f6; }
.shortcut-row:last-child { border-bottom: none; }
.shortcut-label { min-width: 0; font-size: 14px; color: #26334b; }
.shortcut-binding { display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-height: 36px; min-width: 210px; max-width: 100%; padding: 5px 8px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #384b6e; cursor: pointer; }
.shortcut-binding:hover, .shortcut-binding.recording { background: #f0f5ff; border-color: #bdd0ff; }
.shortcut-binding kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 26px; padding: 0 7px; border: 1px solid #d5dfec; border-radius: 4px; background: white; box-shadow: 0 2px 3px rgb(27 49 81 / 5%); font-family: inherit; font-size: 12px; }
.shortcut-binding span { font-size: 12px; }
.shortcut-error { margin: 6px 0; font-size: 12px; line-height: 1.5; color: #c53e48; overflow-wrap: anywhere; }
.shortcut-binding.conflict { border-color: #e49ba2; }
button:disabled, input:disabled { cursor: default; opacity: 0.5; }
button:focus-visible, input:focus-visible { outline: 2px solid #246bff; outline-offset: 3px; }
@media (max-width: 600px) {
  .shortcut-heading { flex-wrap: wrap; gap: 10px; }
  .shortcut-row { flex-wrap: wrap; gap: 6px; padding: 10px 0; }
  .shortcut-binding { min-width: 0; justify-content: flex-start; flex-wrap: wrap; }
  .shortcut-label { flex-basis: 100%; }
}
</style>
