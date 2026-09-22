<script setup lang="ts">
import { computed, type Component } from "vue";
import { Cloud, Heart, History, LayoutGrid, Sparkles } from "lucide-vue-next";
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
      <span class="footer-dot" aria-hidden="true"></span>
      <span>{{ props.mode === "local" ? "本地模式" : "流媒体模式" }}</span>
      <button
        class="mode-switch-button"
        type="button"
        :title="props.mode === 'local' ? '切换到流媒体模式' : '切换到本地模式'"
        :aria-label="props.mode === 'local' ? '切换到流媒体模式' : '切换到本地模式'"
        @click="emit('toggleMode')"
      >
        {{ props.mode === "local" ? "切换到流媒体模式" : "切换到本地模式" }}
      </button>
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
.sidebar-footer { display: flex; align-items: center; gap: 7px; margin-top: auto; padding: 0 10px; color: #a3a8aa; font-size: 10px; }.footer-dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 50%; background: #20d57a; box-shadow: 0 0 0 4px rgba(32,213,122,.12); }.mode-switch-button { min-width: 0; margin-left: auto; overflow: hidden; border: 0; background: transparent; color: #8c9797; cursor: pointer; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.mode-switch-button:hover { color: #168ec6; }
@media (max-width: 980px) { .sidebar { width: 72px; min-width: 72px; align-items: center; padding: 112px 10px 18px; }.streaming-nav-title,.nav-item>span:last-child,.sidebar-footer > span:not(.footer-dot),.mode-switch-button { display: none; }.nav-section { width: 100%; }.nav-item,.streaming-sidebar .nav-item { justify-content: center; padding: 12px 0; } }
</style>
