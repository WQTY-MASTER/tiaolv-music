<script setup lang="ts">
import { computed, type Component } from "vue";
import { Cloud, Globe2, Heart, History, LayoutGrid, Monitor, Sparkles } from "lucide-vue-next";
import type { AppMode } from "../services/appMode";
import type { AccountView } from "../services/api";

type ViewKey =
  | "home"
  | "discover"
  | "playlist"
  | "library"
  | "liked"
  | "history"
  | "daily"
  | "artists"
  | "albums"
  | "playlists"
  | "aggregate"
  | "folders"
  | "streaming-library"
  | "cloud";

interface SidebarPlaylist {
  id: string;
  title: string;
  count: number;
  primary: string;
  secondary: string;
  mark: string;
}

const props = defineProps<{
  activeView: ViewKey;
  mode: AppMode;
  account?: AccountView | null;
  playlists: SidebarPlaylist[];
}>();

const emit = defineEmits<{
  navigate: [view: ViewKey];
  selectPlaylist: [playlist: SidebarPlaylist];
  toggleMode: [];
  login: [];
}>();

const localNavigation: Array<{ id: ViewKey; label: string; icon: string }> = [
  { id: "home", label: "主页", icon: "⌂" },
  { id: "library", label: "所有歌曲", icon: "♫" },
  { id: "artists", label: "艺术家", icon: "🎙" },
  { id: "albums", label: "专辑", icon: "▣" },
  { id: "playlists", label: "歌单", icon: "≡" },
  { id: "aggregate", label: "聚合歌单", icon: "♡" },
  { id: "folders", label: "文件夹", icon: "□" },
  { id: "history", label: "最近播放", icon: "◷" }
];

const streamingNavigation: Array<{ id: ViewKey; label: string; icon: Component }> = [
  { id: "home", label: "主页", icon: Sparkles },
  { id: "discover", label: "发现歌单", icon: LayoutGrid },
  { id: "streaming-library", label: "音乐库", icon: Heart },
  { id: "cloud", label: "音乐云盘", icon: Cloud },
  { id: "history", label: "最近播放", icon: History }
];

const navigation = computed(() => props.mode === "local" ? localNavigation : streamingNavigation);

function selectMode(mode: AppMode) {
  if (mode !== props.mode) {
    emit("toggleMode");
  }
}
</script>

<template>
  <aside class="sidebar" :class="{ 'streaming-sidebar': props.mode === 'streaming' }">
    <p v-if="props.mode === 'streaming'" class="streaming-nav-title">流媒体</p>

    <nav class="nav-section" aria-label="主导航">
      <button
        v-for="item in navigation"
        :key="item.id"
        class="nav-item"
        :class="{ active: props.activeView === item.id || (props.activeView === 'playlist' && item.id === 'playlists') }"
        type="button"
        @click="emit('navigate', item.id)"
      >
        <component
          v-if="props.mode === 'streaming'"
          :is="item.icon"
          class="streaming-nav-icon"
          :size="20"
          :stroke-width="1.8"
          aria-hidden="true"
        />
        <span v-else class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <div class="mode-segmented-control" role="radiogroup" aria-label="应用模式">
        <button
          class="mode-option"
          :class="{ active: props.mode === 'local' }"
          type="button"
          role="radio"
          :aria-checked="props.mode === 'local'"
          title="切换到本地模式"
          aria-label="切换到本地模式"
          @click="selectMode('local')"
        >
          <Monitor class="mode-option-icon" :size="17" :stroke-width="1.8" aria-hidden="true" />
          <span class="mode-option-label">本地模式</span>
        </button>
        <button
          class="mode-option"
          :class="{ active: props.mode === 'streaming' }"
          type="button"
          role="radio"
          :aria-checked="props.mode === 'streaming'"
          title="切换到流媒体模式"
          aria-label="切换到流媒体模式"
          @click="selectMode('streaming')"
        >
          <Globe2 class="mode-option-icon" :size="17" :stroke-width="1.8" aria-hidden="true" />
          <span class="mode-option-label">流媒体模式</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar { display: flex; width: 224px; min-width: 224px; min-height: 100vh; flex-direction: column; gap: 24px; padding: 74px 16px 18px; background: #f1f3f4; border-right: 1px solid #e4e7e8; color: #242729; }
.nav-section { display: grid; gap: 7px; }
.nav-item { display: flex; width: 100%; align-items: center; gap: 13px; border: 0; border-radius: 10px; padding: 11px 12px; background: transparent; color: #777e81; cursor: pointer; font-size: 12px; font-weight: 600; text-align: left; transition: background 160ms ease,color 160ms ease; }
.nav-item:hover { background: #e8ebeb; color: #2d3335; }
.nav-item.active { background: #202628; color: #fff; box-shadow: 0 8px 16px rgba(27,36,38,.1); }
.nav-icon { display: grid; width: 18px; height: 18px; place-items: center; font-size: 17px; line-height: 1; }
.streaming-sidebar { gap: 0; padding: 74px 10px 18px 0; border-right-color: #e4e7ee; background: #f6f6fb; }
.streaming-nav-title { margin: 0 16px 13px; color: #687386; font-size: 12px; font-weight: 800; }
.streaming-sidebar .nav-section { gap: 4px; }
.streaming-sidebar .nav-item { min-height: 44px; gap: 12px; padding: 0 14px; color: #4f5b6c; font-size: 14px; font-weight: 750; }
.streaming-sidebar .nav-item:hover { background: #eceff7; color: #111827; }
.streaming-sidebar .nav-item.active { background: #dfe7fb; color: #111827; box-shadow: none; }
.streaming-nav-icon { width: 20px; height: 20px; flex: 0 0 auto; }
.sidebar-footer { width: 100%; margin-top: auto; }
.mode-segmented-control { display: grid; width: 100%; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px; border-radius: 24px; background: transparent; }
.mode-option { display: flex; min-width: 0; height: 40px; align-items: center; justify-content: center; gap: 4px; overflow: hidden; border: 1px solid #e5e8ec; border-radius: 20px; background: #eceef2; color: #a3a8b0; cursor: pointer; font-size: 13px; font-weight: 700; line-height: 1; white-space: nowrap; transition: background 160ms ease,color 160ms ease,box-shadow 160ms ease,border-color 160ms ease; }
.mode-option:hover:not(.active) { background: rgba(255,255,255,.56); color: #56616d; }
.mode-option.active { border-color: #20292e; background: #20292e; color: #fff; box-shadow: 0 4px 9px rgba(31,40,45,.16); }
.mode-option-icon { flex: 0 0 auto; color: currentColor; transition: color 160ms ease,filter 160ms ease; }
.mode-option.active .mode-option-icon { color: #43dda0; filter: drop-shadow(0 0 4px rgba(67,221,160,.34)); }
@media (max-width: 980px) { .sidebar { width: 72px; min-width: 72px; align-items: center; padding: 112px 10px 18px; }.streaming-nav-title,.nav-item>span:last-child,.mode-option-label { display: none; }.nav-section { width: 100%; }.nav-item,.streaming-sidebar .nav-item { justify-content: center; padding: 12px 0; }.sidebar-footer { width: 52px; }.mode-segmented-control { grid-template-columns: 1fr; border-radius: 24px; }.mode-option { width: 44px; height: 40px; border-radius: 20px; } }
</style>
