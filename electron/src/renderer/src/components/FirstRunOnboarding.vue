<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { AppWindow, ArrowLeft, ArrowRight, AudioLines, Check, Cloud, Compass, Database, Folder, FolderPlus, Headphones, Image as ImageIcon, Keyboard, Library, Link2, Mic2, Monitor, Moon, Music2, PanelBottom, Power, QrCode, Rows2, SlidersHorizontal, Speaker, Sun, X } from "lucide-vue-next";
import { selectPlaylistCoverImage } from "../services/api";
import { readableAccentText } from "../services/colorContrast";
import {
  normalizeAppearancePreferences,
  type AppearancePreferences,
  type InterfaceDensity,
  type PlayerBarPresentation,
  type PlayerBarVisibility,
  type ThemeMode
} from "../services/appearanceSettings";
import type { StartupHome } from "../services/startupHome";
import type { NeteasePlaybackQuality } from "../services/playbackQuality";
import type { OnlineAudioCachePolicy } from "../services/onlineAudioCache";
import type { AudioOutputDevice, AudioOutputPreferences } from "../services/audioOutput";
import type { CloseBehavior } from "../../../shared/desktopIntegration";

type LoginPreference = "after-guide" | "later";

const props = defineProps<{
  modelValue: AppearancePreferences;
  startupPreference: StartupHome;
  loginPreference: LoginPreference;
  neteaseQuality: NeteasePlaybackQuality;
  audioCachePolicy: OnlineAudioCachePolicy;
  audioOutputPreferences: AudioOutputPreferences;
  audioOutputDevices: AudioOutputDevice[];
  audioOutputSupported: boolean;
  audioOutputError: string;
  localLibraryRoots: string[];
  localLibraryPending: boolean;
  localLibraryNotice: string;
  localLibraryError: string;
  autoScanLocalLibrary: boolean;
  useFilenameMetadata: boolean;
  localLyricsOnlineMatch: boolean;
  closeBehavior: CloseBehavior;
  taskbarThumbnailButtons: boolean;
  systemMediaControls: boolean;
  globalShortcuts: boolean;
  globalShortcutsPending: boolean;
  launchAtStartup: boolean;
  launchAtStartupPending: boolean;
  rememberPlaybackPosition: boolean;
  desktopIntegrationError: string;
  libraryTrackCount: number;
  desktopLyricsVisible: boolean;
  sleepTimerRemainingSeconds: number;
}>();
const emit = defineEmits<{
  "update:modelValue": [preferences: AppearancePreferences];
  "update:startupPreference": [preference: StartupHome];
  "update:loginPreference": [preference: LoginPreference];
  "update:neteaseQuality": [quality: NeteasePlaybackQuality];
  "update:audioCachePolicy": [policy: OnlineAudioCachePolicy];
  "update:audioOutputPreferences": [preferences: AudioOutputPreferences];
  "update:autoScanLocalLibrary": [enabled: boolean];
  "update:useFilenameMetadata": [enabled: boolean];
  "update:localLyricsOnlineMatch": [enabled: boolean];
  "update:closeBehavior": [behavior: CloseBehavior];
  "update:taskbarThumbnailButtons": [enabled: boolean];
  "update:systemMediaControls": [enabled: boolean];
  "update:globalShortcuts": [enabled: boolean];
  "update:launchAtStartup": [enabled: boolean];
  "update:rememberPlaybackPosition": [enabled: boolean];
  toggleDesktopLyrics: [];
  toggleSleepTimer: [];
  addMusicFolder: [];
  removeMusicFolder: [directory: string];
  complete: [];
  skip: [];
}>();

const root = ref<HTMLElement | null>(null);
const currentPage = ref<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);
const navigationDirection = ref<"forward" | "backward">("forward");
const backgroundImporting = ref(false);
const backgroundError = ref("");
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const accentColors = ["#8357f6", "#2868ed", "#16b88a", "#e91e4d", "#f59b0b", "#344156"];
const backgroundPresets = [
  { light: "#f4f4f7", dark: "#17181a" },
  { light: "#ffffff", dark: "#15181d" },
  { light: "#f4f6fa", dark: "#1a2029" },
  { light: "#eef5ff", dark: "#17212e" },
  { light: "#f1f2ff", dark: "#1d1c2d" },
  { light: "#f7f1ff", dark: "#241c2d" }
];
const sourceOptions: Array<{
  value: StartupHome;
  title: string;
  description: string;
  icon: typeof Database;
}> = [
  { value: "local", title: "本地音乐", description: "播放电脑上的无损收藏，HiFi 引擎按位精确输出", icon: Database },
  { value: "streaming", title: "流媒体", description: "登录网易云音乐，随时探索云端曲库与每日推荐", icon: Cloud },
  { value: "last-used", title: "两者都要", description: "本地曲库与流媒体统一管理，跨来源无缝衔接", icon: Link2 }
];
const qualityOptions: Array<{ value: NeteasePlaybackQuality; label: string }> = [
  { value: "auto", label: "自动" },
  { value: "standard", label: "标准" },
  { value: "exhigh", label: "极高" },
  { value: "lossless", label: "无损" },
  { value: "hires", label: "Hi-Res" }
];
const playerPresentationOptions: Array<{
  value: PlayerBarPresentation;
  title: string;
  description: string;
  icon: typeof SlidersHorizontal;
}> = [
  { value: "full", title: "完整播放栏", description: "封面、进度与全部控制都在主窗口底部", icon: SlidersHorizontal },
  { value: "capsule", title: "迷你胶囊", description: "轻量控制占据更少空间，适合日常使用", icon: PanelBottom },
  { value: "compact", title: "紧凑模式", description: "贴边布局，把更多屏幕空间留给音乐内容", icon: Rows2 }
];
const visibilityOptions: Array<{ value: PlayerBarVisibility; label: string }> = [
  { value: "always", label: "常显" },
  { value: "hover", label: "指针靠近时浮现" },
  { value: "hidden", label: "隐藏播放栏" }
];

const darkMode = computed(() => props.modelValue.themeMode === "dark"
  || (props.modelValue.themeMode === "system" && systemPrefersDark));
const activeAccent = computed(() => darkMode.value ? props.modelValue.darkAccent : props.modelValue.lightAccent);
const pageTransitionName = computed(() => `onboarding-${navigationDirection.value}`);
const selectedPlayerPresentation = computed(() => props.modelValue.playerControls.presentation);
const selectedBackgroundIndex = computed(() => {
  if (props.modelValue.background.unified.mode !== "solid") return -1;
  return backgroundPresets.findIndex((preset) => (
    preset.light === props.modelValue.background.unified.lightColor
    && preset.dark === props.modelValue.background.unified.darkColor
  ));
});
const onboardingStyle = computed(() => {
  const background = props.modelValue.background.unified;
  const backgroundColor = darkMode.value ? background.darkColor : background.lightColor;
  const rawImage = background.mode === "image" ? background.imagePath : "";
  const safeImage = rawImage.replace(/["\r\n]/g, (character) => encodeURIComponent(character));
  return {
    "--onboarding-accent": activeAccent.value,
    "--onboarding-accent-text": readableAccentText(activeAccent.value),
    "--onboarding-background": backgroundColor,
    backgroundImage: safeImage
      ? `linear-gradient(${darkMode.value ? "rgba(8,12,16,.54)" : "rgba(244,250,249,.7)"}, ${darkMode.value ? "rgba(8,12,16,.54)" : "rgba(244,250,249,.7)"}), url("${safeImage}")`
      : "none"
  };
});

function updatePreferences(mutator: (draft: AppearancePreferences) => void) {
  const draft = JSON.parse(JSON.stringify(props.modelValue)) as AppearancePreferences;
  mutator(draft);
  emit("update:modelValue", normalizeAppearancePreferences(draft));
}

function setThemeMode(mode: ThemeMode) {
  updatePreferences((draft) => { draft.themeMode = mode; });
}

function setAccent(color: string) {
  updatePreferences((draft) => {
    draft.lightAccent = color;
    draft.darkAccent = color;
  });
}

function isAccentSelected(color: string) {
  return props.modelValue.lightAccent === color || props.modelValue.darkAccent === color;
}

function setDensity(density: InterfaceDensity) {
  updatePreferences((draft) => { draft.density = density; });
}

function setStartupPreference(preference: StartupHome) {
  emit("update:startupPreference", preference);
}

function setLoginPreference(preference: LoginPreference) {
  emit("update:loginPreference", preference);
}

function setNeteaseQuality(quality: NeteasePlaybackQuality) {
  emit("update:neteaseQuality", quality);
}

function setAudioCachePolicy(policy: OnlineAudioCachePolicy) {
  emit("update:audioCachePolicy", policy);
}

function setPlayerPresentation(presentation: PlayerBarPresentation) {
  updatePreferences((draft) => {
    draft.playerControls.presentation = presentation;
    if (presentation !== "full") {
      draft.miniPlayer.layout.mode = presentation === "compact" ? "compact" : "standard";
    }
  });
}

function setPlayerBarVisibility(visibility: PlayerBarVisibility) {
  updatePreferences((draft) => { draft.playerControls.visibility = visibility; });
}

function toggleMiniPlayerOption(option: "miniShowInTaskbar" | "miniAlwaysOnTop" | "openMiniAfterGuide") {
  updatePreferences((draft) => { draft.playerControls[option] = !draft.playerControls[option]; });
}

function setAudioOutputDevice(deviceId: string) {
  emit("update:audioOutputPreferences", { ...props.audioOutputPreferences, deviceId });
}

function toggleLoudnessMatching() {
  emit("update:audioOutputPreferences", {
    ...props.audioOutputPreferences,
    loudnessMatching: !props.audioOutputPreferences.loudnessMatching
  });
}

function setCloseBehavior(behavior: CloseBehavior) {
  emit("update:closeBehavior", behavior);
}

function toggleDesktopOption(option: "taskbar" | "media" | "shortcuts" | "startup" | "progress") {
  if (option === "taskbar") emit("update:taskbarThumbnailButtons", !props.taskbarThumbnailButtons);
  if (option === "media") emit("update:systemMediaControls", !props.systemMediaControls);
  if (option === "shortcuts") emit("update:globalShortcuts", !props.globalShortcuts);
  if (option === "startup") emit("update:launchAtStartup", !props.launchAtStartup);
  if (option === "progress") emit("update:rememberPlaybackPosition", !props.rememberPlaybackPosition);
}

function formatSleepTimer(seconds: number) {
  return seconds > 0 ? `${Math.ceil(seconds / 60)} 分钟后暂停` : "设置 30 分钟";
}

function folderName(directory: string) {
  const segments = directory.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? directory;
}

function toggleLocalLibrarySetting(setting: "autoScan" | "filenameMetadata" | "lyricsMatch") {
  if (setting === "autoScan") {
    emit("update:autoScanLocalLibrary", !props.autoScanLocalLibrary);
  } else if (setting === "filenameMetadata") {
    emit("update:useFilenameMetadata", !props.useFilenameMetadata);
  } else {
    emit("update:localLyricsOnlineMatch", !props.localLyricsOnlineMatch);
  }
}

function goToPage(page: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) {
  if (page === currentPage.value) return;
  navigationDirection.value = page > currentPage.value ? "forward" : "backward";
  currentPage.value = page;
  void nextTick(() => root.value?.focus({ preventScroll: true }));
}

function continueOnboarding() {
  if (currentPage.value === 1) {
    goToPage(2);
    return;
  }
  if (currentPage.value === 2) {
    goToPage(3);
    return;
  }
  if (currentPage.value === 3) {
    goToPage(4);
    return;
  }
  if (currentPage.value === 4) {
    goToPage(5);
    return;
  }
  if (currentPage.value === 5) {
    goToPage(6);
    return;
  }
  if (currentPage.value === 6) {
    goToPage(7);
    return;
  }
  if (currentPage.value === 7) {
    goToPage(8);
    return;
  }
  emit("complete");
}

function returnToPreviousPage() {
  if (currentPage.value > 1) goToPage((currentPage.value - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7);
}

function setBackgroundPreset(index: number) {
  const preset = backgroundPresets[index];
  if (!preset) return;
  updatePreferences((draft) => {
    draft.background.unified.mode = "solid";
    draft.background.unified.lightColor = preset.light;
    draft.background.unified.darkColor = preset.dark;
    draft.background.unified.imagePath = "";
  });
}

async function chooseBackgroundImage() {
  if (backgroundImporting.value) return;
  backgroundImporting.value = true;
  backgroundError.value = "";
  try {
    const selected = await selectPlaylistCoverImage();
    if (!selected) return;
    if (window.listenMusic && !window.listenMusic.readAppearanceBackground) {
      throw new Error("背景导入服务尚未更新，请完全退出并重新启动软件。");
    }
    const imagePath = window.listenMusic && !selected.startsWith("data:")
      ? await window.listenMusic.readAppearanceBackground(selected)
      : selected;
    const image = new Image();
    image.src = imagePath;
    await image.decode();
    updatePreferences((draft) => {
      draft.background.unified.mode = "image";
      draft.background.unified.imagePath = imagePath;
    });
  } catch (error) {
    backgroundError.value = error instanceof Error && error.name !== "EncodingError"
      ? error.message
      : "图片无法解码，请重新选择。";
  } finally {
    backgroundImporting.value = false;
  }
}

function focusRelativeControl(direction: -1 | 1) {
  const controls = Array.from(root.value?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
  if (!controls.length) return;
  const currentIndex = controls.indexOf(document.activeElement as HTMLButtonElement);
  const nextIndex = currentIndex < 0
    ? (direction > 0 ? 0 : controls.length - 1)
    : (currentIndex + direction + controls.length) % controls.length;
  controls[nextIndex]?.focus();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    if (currentPage.value > 1) returnToPreviousPage();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    continueOnboarding();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    focusRelativeControl(-1);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    focusRelativeControl(1);
  } else if (event.key === "Enter" && document.activeElement === root.value) {
    event.preventDefault();
    continueOnboarding();
  }
}

onMounted(() => {
  void nextTick(() => root.value?.focus({ preventScroll: true }));
});
</script>

<template>
  <section
    ref="root"
    class="first-run-onboarding"
    :class="[{ dark: darkMode }, `density-${modelValue.density}`]"
    :style="onboardingStyle"
    role="dialog"
    aria-modal="true"
    aria-labelledby="onboarding-title"
    tabindex="-1"
    @keydown="handleKeydown"
  >
    <div class="onboarding-rings" aria-hidden="true"><i></i><i></i><i></i></div>

    <nav class="onboarding-progress" aria-label="引导进度">
      <span v-for="step in 8" :key="step" :class="{ active: step === currentPage, complete: step < currentPage }"></span>
    </nav>

    <div class="onboarding-stage">
      <Transition :name="pageTransitionName">
        <main v-if="currentPage === 1" key="appearance" class="onboarding-content onboarding-appearance-page">
          <p class="onboarding-eyebrow onboarding-enter" style="--enter-order: 0">TWILIGHT ECHO</p>
          <h1 id="onboarding-title" class="onboarding-enter" style="--enter-order: 1">欢迎来到<span>你的声音空间</span></h1>
          <p class="onboarding-intro onboarding-enter" style="--enter-order: 2">先把界面调成你喜欢的样子，所有选择之后都可以在设置中随时更改。</p>

          <div class="onboarding-theme-options onboarding-enter" style="--enter-order: 3" role="radiogroup" aria-label="外观模式">
            <button data-onboarding-choice type="button" :class="{ active: modelValue.themeMode === 'system' }" :aria-checked="modelValue.themeMode === 'system'" role="radio" @click="setThemeMode('system')"><Monitor :size="22" /><span>跟随系统</span></button>
            <button data-onboarding-choice type="button" :class="{ active: modelValue.themeMode === 'light' }" :aria-checked="modelValue.themeMode === 'light'" role="radio" @click="setThemeMode('light')"><Sun :size="23" /><span>浅色</span></button>
            <button data-onboarding-choice type="button" :class="{ active: modelValue.themeMode === 'dark' }" :aria-checked="modelValue.themeMode === 'dark'" role="radio" @click="setThemeMode('dark')"><Moon :size="22" /><span>深色</span></button>
          </div>

          <div class="onboarding-accents onboarding-enter" style="--enter-order: 4" role="radiogroup" aria-label="主题色">
            <button v-for="color in accentColors" :key="color" data-onboarding-choice type="button" :style="{ '--swatch': color, '--swatch-text': readableAccentText(color) }" :class="{ active: isAccentSelected(color) }" :aria-label="`主题色 ${color}`" :aria-checked="isAccentSelected(color)" role="radio" @click="setAccent(color)"><Check v-if="isAccentSelected(color)" :size="22" /></button>
          </div>

          <div class="onboarding-density onboarding-enter" style="--enter-order: 5" role="radiogroup" aria-label="界面排版密度">
            <button data-onboarding-choice type="button" :class="{ active: modelValue.density === 'compact' }" role="radio" :aria-checked="modelValue.density === 'compact'" @click="setDensity('compact')">紧凑</button>
            <button data-onboarding-choice type="button" :class="{ active: modelValue.density === 'standard' }" role="radio" :aria-checked="modelValue.density === 'standard'" @click="setDensity('standard')">标准</button>
            <button data-onboarding-choice type="button" :class="{ active: modelValue.density === 'comfortable' }" role="radio" :aria-checked="modelValue.density === 'comfortable'" @click="setDensity('comfortable')">舒展</button>
          </div>

          <div class="onboarding-backgrounds onboarding-enter" style="--enter-order: 6" role="radiogroup" aria-label="应用背景">
            <button v-for="(preset, index) in backgroundPresets" :key="preset.light" data-onboarding-choice type="button" :style="{ '--swatch': darkMode ? preset.dark : preset.light }" :class="{ active: selectedBackgroundIndex === index }" :aria-label="`背景 ${index + 1}`" :aria-checked="selectedBackgroundIndex === index" role="radio" @click="setBackgroundPreset(index)"><Check v-if="selectedBackgroundIndex === index" :size="17" /></button>
            <button class="image-choice" data-onboarding-choice type="button" :class="{ active: modelValue.background.unified.mode === 'image' }" :disabled="backgroundImporting" :aria-label="backgroundImporting ? '正在选择背景图片' : '选择背景图片'" @click="chooseBackgroundImage"><ImageIcon :size="18" /></button>
          </div>

          <p class="onboarding-hint onboarding-enter" style="--enter-order: 7">从上到下：外观模式、主题色、界面密度与应用背景。背景可选纯色，也可以用自己的图片。</p>
          <p v-if="backgroundError" class="onboarding-error" role="alert">{{ backgroundError }}</p>
        </main>

        <main v-else-if="currentPage === 2" key="listening-source" class="onboarding-content onboarding-source-page">
          <p class="onboarding-eyebrow onboarding-enter" style="--enter-order: 0">听歌习惯</p>
          <h1 id="onboarding-title" class="onboarding-enter" style="--enter-order: 1">你平时更常听<span>哪里的音乐</span>？</h1>
          <p class="onboarding-intro onboarding-enter" style="--enter-order: 2">这决定了启动时你首先看到的页面，之后可在设置中更改。</p>

          <div class="onboarding-source-options" role="radiogroup" aria-label="启动时显示的音乐来源">
            <button
              v-for="(option, index) in sourceOptions"
              :key="option.value"
              class="onboarding-source-card onboarding-enter"
              data-onboarding-choice
              type="button"
              role="radio"
              :class="{ active: startupPreference === option.value }"
              :aria-checked="startupPreference === option.value"
              :style="{ '--enter-order': index + 3 }"
              @click="setStartupPreference(option.value)"
            >
              <span v-if="startupPreference === option.value" class="onboarding-source-check" aria-hidden="true"><Check :size="16" /></span>
              <component :is="option.icon" :size="42" :stroke-width="1.7" aria-hidden="true" />
              <strong>{{ option.title }}</strong>
              <span>{{ option.description }}</span>
            </button>
          </div>
        </main>

        <main v-else-if="currentPage === 3" key="local-library" class="onboarding-content onboarding-library-page">
          <p class="onboarding-eyebrow onboarding-enter" style="--enter-order: 0">本地曲库</p>
          <h1 id="onboarding-title" class="onboarding-enter" style="--enter-order: 1">你的音乐<span>放在哪里</span>？</h1>
          <p class="onboarding-intro onboarding-library-intro onboarding-enter" style="--enter-order: 2">选择存放音乐的文件夹，Twilight Echo 会扫描并整理曲目、封面与元数据。</p>

          <section class="onboarding-library-folders onboarding-enter" style="--enter-order: 3" aria-label="本地音乐文件夹">
            <button class="onboarding-add-folder" type="button" :disabled="localLibraryPending" @click="emit('addMusicFolder')">
              <FolderPlus :size="18" aria-hidden="true" />
              {{ localLibraryPending ? '正在扫描音乐文件夹' : '添加音乐文件夹' }}
            </button>
            <div v-if="localLibraryRoots.length" class="onboarding-folder-list">
              <div v-for="directory in localLibraryRoots" :key="directory" class="onboarding-folder-row">
                <Folder :size="16" aria-hidden="true" />
                <span><strong>{{ folderName(directory) }}</strong><small>{{ directory }}</small></span>
                <button type="button" :disabled="localLibraryPending" :aria-label="`移除音乐文件夹 ${folderName(directory)}`" :title="`移除 ${directory}`" @click="emit('removeMusicFolder', directory)"><X :size="17" /></button>
              </div>
            </div>
            <p v-else>可以暂时跳过，之后在“设置 → 常规”中添加。</p>
          </section>

          <section class="onboarding-library-settings onboarding-enter" style="--enter-order: 4" aria-label="本地曲库设置">
            <button type="button" role="switch" :aria-checked="autoScanLocalLibrary" @click="toggleLocalLibrarySetting('autoScan')">
              <span><strong>启动时自动扫描</strong><small>每次启动时对全部已添加文件夹执行增量扫描。</small></span>
              <i :class="{ active: autoScanLocalLibrary }" aria-hidden="true"><b></b></i>
            </button>
            <button type="button" role="switch" :aria-checked="useFilenameMetadata" @click="toggleLocalLibrarySetting('filenameMetadata')">
              <span><strong>使用文件名补全歌曲信息</strong><small>歌曲标签为空时，按文件名补全歌手和标题，不修改原文件。</small></span>
              <i :class="{ active: useFilenameMetadata }" aria-hidden="true"><b></b></i>
            </button>
            <button type="button" role="switch" :aria-checked="localLyricsOnlineMatch" @click="toggleLocalLibrarySetting('lyricsMatch')">
              <span><strong>本地歌曲联网匹配歌词</strong><small>本地没有歌词时，按歌名和歌手从在线音乐源匹配。</small></span>
              <i :class="{ active: localLyricsOnlineMatch }" aria-hidden="true"><b></b></i>
            </button>
          </section>

          <p v-if="localLibraryError" class="onboarding-error onboarding-library-message onboarding-enter" style="--enter-order: 5" role="alert">{{ localLibraryError }}</p>
          <p v-else-if="localLibraryNotice" class="onboarding-hint onboarding-library-message onboarding-enter" style="--enter-order: 5">{{ localLibraryNotice }}</p>
          <p v-else class="onboarding-hint onboarding-library-message onboarding-enter" style="--enter-order: 5">这些选项与常规设置同步，稍后仍可随时修改。</p>
        </main>

        <main v-else-if="currentPage === 4" key="streaming-setup" class="onboarding-content onboarding-streaming-page">
          <p class="onboarding-eyebrow onboarding-enter" style="--enter-order: 0">流媒体</p>
          <h1 id="onboarding-title" class="onboarding-enter" style="--enter-order: 1">连接<span>网易云音乐</span></h1>
          <p class="onboarding-intro onboarding-streaming-intro onboarding-enter" style="--enter-order: 2">内置的网易云音乐源已经启用。登录后即可同步歌单、收藏与每日推荐；不登录也可以浏览流媒体页面。</p>

          <div class="onboarding-login-options" role="radiogroup" aria-label="网易云登录时机">
            <button
              class="onboarding-login-card onboarding-enter"
              style="--enter-order: 3"
              type="button"
              role="radio"
              :class="{ active: loginPreference === 'after-guide' }"
              :aria-checked="loginPreference === 'after-guide'"
              @click="setLoginPreference('after-guide')"
            >
              <span v-if="loginPreference === 'after-guide'" class="onboarding-source-check" aria-hidden="true"><Check :size="16" /></span>
              <QrCode :size="39" :stroke-width="1.7" aria-hidden="true" />
              <strong>完成后立即登录</strong>
              <span>向导结束后打开扫码登录页，一步接入你的曲库</span>
            </button>
            <button
              class="onboarding-login-card onboarding-enter"
              style="--enter-order: 4"
              type="button"
              role="radio"
              :class="{ active: loginPreference === 'later' }"
              :aria-checked="loginPreference === 'later'"
              @click="setLoginPreference('later')"
            >
              <span v-if="loginPreference === 'later'" class="onboarding-source-check" aria-hidden="true"><Check :size="16" /></span>
              <Compass :size="39" :stroke-width="1.7" aria-hidden="true" />
              <strong>稍后再说</strong>
              <span>先随便逛逛，需要时再从标题栏登录</span>
            </button>
          </div>

          <div class="onboarding-quality-options onboarding-enter" style="--enter-order: 5" role="radiogroup" aria-label="网易云播放音质">
            <button
              v-for="option in qualityOptions"
              :key="option.value"
              type="button"
              role="radio"
              :class="{ active: neteaseQuality === option.value }"
              :aria-checked="neteaseQuality === option.value"
              @click="setNeteaseQuality(option.value)"
            >{{ option.label }}</button>
          </div>

          <div class="onboarding-cache-options onboarding-enter" style="--enter-order: 6" role="radiogroup" aria-label="在线音频缓存策略">
            <button type="button" role="radio" :class="{ active: audioCachePolicy === 'provider' }" :aria-checked="audioCachePolicy === 'provider'" @click="setAudioCachePolicy('provider')">跟随来源规则</button>
            <button type="button" role="radio" :class="{ active: audioCachePolicy === 'none' }" :aria-checked="audioCachePolicy === 'none'" @click="setAudioCachePolicy('none')">不缓存音频</button>
          </div>

          <p class="onboarding-hint onboarding-enter" style="--enter-order: 7">在线音质可在设置中随时修改；无损与 Hi-Res 需要对应的账号权益。</p>
        </main>

        <main v-else-if="currentPage === 5" key="player-controls" class="onboarding-content onboarding-player-page">
          <p class="onboarding-eyebrow onboarding-enter" style="--enter-order: 0">播放器形态</p>
          <h1 id="onboarding-title" class="onboarding-enter" style="--enter-order: 1">选择<span>播放控制</span>的位置</h1>
          <p class="onboarding-intro onboarding-player-intro onboarding-enter" style="--enter-order: 2">主播放栏的形态与可见性会立即进入首启配置；<br />迷你播放器保持轻量，也不会抢走主窗口。</p>

          <div class="onboarding-player-options" role="radiogroup" aria-label="播放栏形态">
            <button
              v-for="(option, index) in playerPresentationOptions"
              :key="option.value"
              class="onboarding-player-card onboarding-enter"
              type="button"
              role="radio"
              :class="{ active: selectedPlayerPresentation === option.value }"
              :aria-checked="selectedPlayerPresentation === option.value"
              :style="{ '--enter-order': index + 3 }"
              @click="setPlayerPresentation(option.value)"
            >
              <span v-if="selectedPlayerPresentation === option.value" class="onboarding-source-check" aria-hidden="true"><Check :size="16" /></span>
              <component :is="option.icon" :size="31" :stroke-width="1.8" aria-hidden="true" />
              <strong>{{ option.title }}</strong>
              <span>{{ option.description }}</span>
            </button>
          </div>

          <div class="onboarding-mini-options onboarding-enter" style="--enter-order: 6" aria-label="迷你播放器窗口设置">
            <button type="button" role="switch" :aria-checked="modelValue.playerControls.miniShowInTaskbar" @click="toggleMiniPlayerOption('miniShowInTaskbar')">
              <span><strong>迷你播放器显示在任务栏</strong><small>开启时像独立小应用一样可从任务栏切换；关闭后仅作为悬浮窗口存在。</small></span>
              <i :class="{ active: modelValue.playerControls.miniShowInTaskbar }" aria-hidden="true"><b></b></i>
            </button>
            <button type="button" role="switch" :aria-checked="modelValue.playerControls.miniAlwaysOnTop" @click="toggleMiniPlayerOption('miniAlwaysOnTop')">
              <span><strong>迷你播放器置顶</strong><small>让控制按钮浮在其他窗口之上，切工作时也能快速暂停。</small></span>
              <i :class="{ active: modelValue.playerControls.miniAlwaysOnTop }" aria-hidden="true"><b></b></i>
            </button>
            <button type="button" role="switch" :aria-checked="modelValue.playerControls.openMiniAfterGuide" @click="toggleMiniPlayerOption('openMiniAfterGuide')">
              <span><strong>完成后打开迷你播放器</strong><small>向导结束后直接进入轻量控制模式，主窗口暂时收起。</small></span>
              <i :class="{ active: modelValue.playerControls.openMiniAfterGuide }" aria-hidden="true"><b></b></i>
            </button>
          </div>

          <div class="onboarding-visibility onboarding-enter" style="--enter-order: 7">
            <strong>播放栏可见性</strong>
            <span>选择播放控件什么时候出现。</span>
            <div role="radiogroup" aria-label="播放栏可见性">
              <button v-for="option in visibilityOptions" :key="option.value" type="button" role="radio" :class="{ active: modelValue.playerControls.visibility === option.value }" :aria-checked="modelValue.playerControls.visibility === option.value" @click="setPlayerBarVisibility(option.value)">{{ option.label }}</button>
            </div>
          </div>

          <p class="onboarding-hint onboarding-player-hint onboarding-enter" style="--enter-order: 8">这些选择会保存到外观偏好中，之后重新打开欢迎向导也可以修改。</p>
        </main>

        <main v-else-if="currentPage === 6" key="audio-output" class="onboarding-content onboarding-audio-page">
          <p class="onboarding-eyebrow onboarding-enter" style="--enter-order: 0">声音输出</p>
          <h1 id="onboarding-title" class="onboarding-enter" style="--enter-order: 1">让声音去<span>对的地方</span></h1>
          <p class="onboarding-intro onboarding-audio-intro onboarding-enter" style="--enter-order: 2">选择实际播放声音的系统设备。设备拔插后列表会自动更新，<br />所有选择也可以在播放设置中修改。</p>

          <div class="onboarding-device-list onboarding-enter" style="--enter-order: 3" role="radiogroup" aria-label="音频输出设备">
            <button
              v-for="device in audioOutputDevices"
              :key="device.deviceId"
              type="button"
              role="radio"
              :class="{ active: audioOutputPreferences.deviceId === device.deviceId }"
              :aria-checked="audioOutputPreferences.deviceId === device.deviceId"
              :disabled="!audioOutputSupported && !device.isDefault"
              @click="setAudioOutputDevice(device.deviceId)"
            >
              <Headphones v-if="device.isDefault" :size="23" :stroke-width="1.8" aria-hidden="true" />
              <Speaker v-else :size="23" :stroke-width="1.8" aria-hidden="true" />
              <span>
                <strong>{{ device.label }}</strong>
                <small>{{ device.isDefault ? '跟随系统默认输出' : device.isSystemDefaultEndpoint ? '系统默认设备' : '原生输出设备' }}</small>
              </span>
              <em>共享</em>
              <span v-if="audioOutputPreferences.deviceId === device.deviceId" class="onboarding-device-check" aria-hidden="true"><Check :size="15" /></span>
            </button>
          </div>

          <section class="onboarding-audio-mode onboarding-enter" style="--enter-order: 4" aria-label="当前输出模式">
            <AudioLines :size="29" :stroke-width="1.8" aria-hidden="true" />
            <span><strong>兼容模式</strong><small>使用系统共享音频输出，与其他应用同时播放</small></span>
            <Check :size="17" aria-hidden="true" />
          </section>

          <button class="onboarding-loudness onboarding-enter" style="--enter-order: 5" type="button" role="switch" :aria-checked="audioOutputPreferences.loudnessMatching" @click="toggleLoudnessMatching">
            <span><strong>响度匹配</strong><small>动态调整不同歌曲的播放增益，减轻切歌时的音量突变。</small></span>
            <i :class="{ active: audioOutputPreferences.loudnessMatching }" aria-hidden="true"><b></b></i>
          </button>

          <p v-if="audioOutputError" class="onboarding-error onboarding-audio-error onboarding-enter" style="--enter-order: 6">{{ audioOutputError }}</p>
          <p v-else class="onboarding-hint onboarding-audio-hint onboarding-enter" style="--enter-order: 6">兼容模式不会改变原音质设置；响度匹配默认关闭，仅在开启后处理声音。</p>
        </main>

        <main v-else-if="currentPage === 7" key="desktop-integration" class="onboarding-content onboarding-desktop-page">
          <p class="onboarding-eyebrow onboarding-enter" style="--enter-order: 0">任务栏与后台</p>
          <h1 id="onboarding-title" class="onboarding-enter" style="--enter-order: 1">让它<span>融入你的桌面</span></h1>
          <p class="onboarding-intro onboarding-desktop-intro onboarding-enter" style="--enter-order: 2">选择关闭窗口后的去向，以及任务栏、系统媒体控制与快捷键的分工。</p>

          <div class="onboarding-close-options" role="radiogroup" aria-label="关闭窗口后的去向">
            <button class="onboarding-desktop-card onboarding-enter" data-onboarding-choice type="button" role="radio" :class="{ active: closeBehavior === 'exit' }" :aria-checked="closeBehavior === 'exit'" style="--enter-order: 3" @click="setCloseBehavior('exit')">
              <span v-if="closeBehavior === 'exit'" class="onboarding-source-check" aria-hidden="true"><Check :size="16" /></span>
              <Power :size="33" :stroke-width="1.8" aria-hidden="true" />
              <strong>直接退出</strong>
              <span>关闭窗口就是结束应用</span>
            </button>
            <button class="onboarding-desktop-card onboarding-enter" data-onboarding-choice type="button" role="radio" :class="{ active: closeBehavior === 'tray' }" :aria-checked="closeBehavior === 'tray'" style="--enter-order: 4" @click="setCloseBehavior('tray')">
              <span v-if="closeBehavior === 'tray'" class="onboarding-source-check" aria-hidden="true"><Check :size="16" /></span>
              <PanelBottom :size="33" :stroke-width="1.8" aria-hidden="true" />
              <strong>进入托盘</strong>
              <span>音乐继续播放，从系统托盘唤回</span>
            </button>
            <button class="onboarding-desktop-card onboarding-enter" data-onboarding-choice type="button" role="radio" :class="{ active: closeBehavior === 'mini' }" :aria-checked="closeBehavior === 'mini'" style="--enter-order: 5" @click="setCloseBehavior('mini')">
              <span v-if="closeBehavior === 'mini'" class="onboarding-source-check" aria-hidden="true"><Check :size="16" /></span>
              <AppWindow :size="33" :stroke-width="1.8" aria-hidden="true" />
              <strong>切换迷你播放器</strong>
              <span>主窗口收起，桌面保留轻量控制</span>
            </button>
          </div>

          <section class="onboarding-desktop-switches onboarding-enter" style="--enter-order: 6" aria-label="桌面媒体功能">
            <button type="button" role="switch" :aria-checked="taskbarThumbnailButtons" @click="toggleDesktopOption('taskbar')">
              <span><strong>任务栏缩略图按钮</strong><small>在 Windows 任务栏窗口预览中放置上一首、播放/暂停与下一首。</small></span>
              <i :class="{ active: taskbarThumbnailButtons }" aria-hidden="true"><b></b></i>
            </button>
            <button type="button" role="switch" :aria-checked="systemMediaControls" @click="toggleDesktopOption('media')">
              <span><strong>系统媒体控制</strong><small>在系统音量条、媒体叠层与锁屏界面显示并控制当前歌曲。</small></span>
              <i :class="{ active: systemMediaControls }" aria-hidden="true"><b></b></i>
            </button>
            <button type="button" role="switch" :aria-checked="globalShortcuts" :disabled="globalShortcutsPending" @click="toggleDesktopOption('shortcuts')">
              <span><strong>全局快捷键</strong><small>在任何应用里使用已配置的快捷键切歌、暂停与调整音量。</small></span>
              <i :class="{ active: globalShortcuts }" aria-hidden="true"><b></b></i>
            </button>
          </section>

          <section class="onboarding-desktop-switches onboarding-desktop-secondary onboarding-enter" style="--enter-order: 7" aria-label="启动与播放恢复">
            <button type="button" role="switch" :aria-checked="launchAtStartup" :disabled="launchAtStartupPending" @click="toggleDesktopOption('startup')">
              <span><strong>开机自动启动</strong><small>登录 Windows 后自动启动调律音乐。</small></span>
              <i :class="{ active: launchAtStartup }" aria-hidden="true"><b></b></i>
            </button>
            <button type="button" role="switch" :aria-checked="rememberPlaybackPosition" @click="toggleDesktopOption('progress')">
              <span><strong>记住播放进度</strong><small>下次启动时从上次停下的位置继续。</small></span>
              <i :class="{ active: rememberPlaybackPosition }" aria-hidden="true"><b></b></i>
            </button>
          </section>

          <p v-if="desktopIntegrationError" class="onboarding-error onboarding-desktop-error" role="alert">{{ desktopIntegrationError }}</p>
        </main>

        <main v-else-if="currentPage === 8" key="ready" class="onboarding-content onboarding-ready-page">
          <span class="onboarding-floating-note note-one" aria-hidden="true"><Music2 :size="18" /></span>
          <span class="onboarding-floating-note note-two" aria-hidden="true"><Music2 :size="22" /></span>
          <span class="onboarding-floating-note note-three" aria-hidden="true"><Music2 :size="16" /></span>

          <div class="onboarding-ready-bars onboarding-enter" style="--enter-order: 0" aria-hidden="true">
            <i></i><i></i><i></i><i></i><i></i>
          </div>
          <h1 id="onboarding-title" class="onboarding-ready-title onboarding-enter" style="--enter-order: 1">一切就绪</h1>
          <p class="onboarding-intro onboarding-ready-intro onboarding-enter" style="--enter-order: 2">这些功能已经在设置中等你探索，现在，让音乐开始吧。</p>

          <div class="onboarding-library-ready onboarding-enter" style="--enter-order: 3">
            <span class="onboarding-ready-icon"><Library :size="16" :stroke-width="1.8" aria-hidden="true" /></span>
            曲库已就绪，共 {{ libraryTrackCount }} 首
          </div>

          <div class="onboarding-ready-features onboarding-enter" style="--enter-order: 4" aria-label="已启用的音乐功能">
            <button type="button" :class="{ active: desktopLyricsVisible }" :aria-pressed="desktopLyricsVisible" @click="emit('toggleDesktopLyrics')">
              <span class="onboarding-feature-icon lyric"><Mic2 :size="17" :stroke-width="1.8" aria-hidden="true" /></span>
              <strong>桌面歌词</strong>
              <em>{{ desktopLyricsVisible ? '已开启' : '点击开启' }}</em>
            </button>
            <button type="button" :class="{ active: modelValue.playerControls.openMiniAfterGuide }" :aria-pressed="modelValue.playerControls.openMiniAfterGuide" @click="toggleMiniPlayerOption('openMiniAfterGuide')">
              <span class="onboarding-feature-icon mini"><AppWindow :size="17" :stroke-width="1.8" aria-hidden="true" /></span>
              <strong>迷你播放器</strong>
              <em>{{ modelValue.playerControls.openMiniAfterGuide ? '完成后打开' : '点击选择' }}</em>
            </button>
            <button type="button" :class="{ active: sleepTimerRemainingSeconds > 0 }" :aria-pressed="sleepTimerRemainingSeconds > 0" @click="emit('toggleSleepTimer')">
              <span class="onboarding-feature-icon sleep"><Moon :size="17" :stroke-width="1.8" aria-hidden="true" /></span>
              <strong>睡眠定时器</strong>
              <em>{{ formatSleepTimer(sleepTimerRemainingSeconds) }}</em>
            </button>
            <button type="button" :class="{ active: globalShortcuts }" :aria-pressed="globalShortcuts" :disabled="globalShortcutsPending" @click="toggleDesktopOption('shortcuts')">
              <span class="onboarding-feature-icon shortcut"><Keyboard :size="17" :stroke-width="1.8" aria-hidden="true" /></span>
              <strong>全局快捷键</strong>
              <em>{{ globalShortcuts ? '已开启' : '已关闭' }}</em>
            </button>
          </div>
        </main>
      </Transition>
    </div>

    <div class="onboarding-chapter" aria-hidden="true"><strong>0{{ currentPage }}</strong><span>/ 08</span></div>

    <footer class="onboarding-footer">
      <button v-if="currentPage < 8" :key="`skip-${currentPage}`" class="onboarding-skip onboarding-enter" style="--enter-order: 8" type="button" @click="emit('skip')">跳过引导</button>
      <span v-else aria-hidden="true"></span>
      <span :key="`hint-${currentPage}`" class="onboarding-enter" style="--enter-order: 8">回车继续 · 方向键切换</span>
      <div :key="`actions-${currentPage}`" class="onboarding-footer-actions onboarding-enter" style="--enter-order: 8">
        <button v-if="currentPage > 1" class="onboarding-back" type="button" @click="returnToPreviousPage"><ArrowLeft :size="17" /> 返回</button>
        <button class="onboarding-continue" type="button" @click="continueOnboarding">{{ currentPage === 8 ? '开始聆听' : '继续' }} <ArrowRight :size="18" /></button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.first-run-onboarding {
  --onboarding-accent: #16b88a;
  --onboarding-background: #f4f4f7;
  --swatch: #16b88a;
  --density-theme-height: 78px;
  --density-theme-gap: 14px;
  --density-section-gap: 16px;
  --density-density-height: 36px;
  --density-intro-bottom: 20px;
  --density-hint-gap: 16px;
  --page-transition-duration: 580ms;
  --element-enter-duration: 560ms;
  --element-enter-stagger: 95ms;
  --element-enter-distance: 12px;
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  min-width: 320px;
  min-height: 540px;
  overflow: hidden;
  place-items: center;
  background-color: var(--onboarding-background);
  background-position: center;
  background-size: cover;
  color: #111a2c;
  outline: none;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  transition: background-color 280ms ease, color 280ms ease;
  user-select: none;
}
.first-run-onboarding.density-compact { --density-theme-height: 66px; --density-section-gap: 10px; --density-theme-gap: 10px; --density-density-height: 30px; --density-intro-bottom: 13px; --density-hint-gap: 10px; }
.first-run-onboarding.density-comfortable { --density-theme-height: 90px; --density-section-gap: 22px; --density-theme-gap: 18px; --density-density-height: 42px; --density-intro-bottom: 28px; --density-hint-gap: 22px; }
.first-run-onboarding::before {
  position: absolute;
  inset: -18% 58% -20% -20%;
  border-radius: 50%;
  background: rgba(31, 208, 158, .13);
  box-shadow: 0 0 120px 90px rgba(31, 208, 158, .11);
  content: "";
  filter: blur(48px);
  pointer-events: none;
}
.first-run-onboarding.dark { color: #eef5f5; }
.onboarding-rings { position: absolute; inset: 0; pointer-events: none; }
.onboarding-rings i { position: absolute; top: 50%; left: 50%; border: 1px solid color-mix(in srgb, var(--onboarding-accent) 15%, transparent); border-radius: 50%; transform: translate(-50%, -50%); }
.onboarding-rings i:nth-child(1) { width: 630px; height: 630px; }
.onboarding-rings i:nth-child(2) { width: 820px; height: 820px; }
.onboarding-rings i:nth-child(3) { width: 1040px; height: 1040px; }
.onboarding-progress { position: absolute; top: 45px; left: 50%; z-index: 2; display: flex; align-items: center; gap: 11px; transform: translateX(-50%); }
.onboarding-progress span { width: 8px; height: 8px; border-radius: 50%; background: color-mix(in srgb, var(--onboarding-accent) 18%, transparent); transition: width 280ms ease, background 280ms ease; }
.onboarding-progress span.active { width: 30px; border-radius: 99px; background: color-mix(in srgb, var(--onboarding-accent) 58%, #fff); }
.onboarding-progress span.complete { background: color-mix(in srgb, var(--onboarding-accent) 82%, #fff); }
.onboarding-stage { position: relative; z-index: 2; width: min(760px, calc(100vw - 48px)); height: min(560px, calc(100vh - 170px)); min-height: 430px; }
.onboarding-content { position: absolute; inset: 0; display: grid; align-content: center; justify-items: center; text-align: center; }
.onboarding-eyebrow { display: flex; align-items: center; gap: 15px; margin: 0 0 20px; color: var(--onboarding-accent); font-size: 12px; font-weight: 850; letter-spacing: 5px; }
.onboarding-eyebrow::before,.onboarding-eyebrow::after { width: 25px; height: 1px; background: color-mix(in srgb, var(--onboarding-accent) 55%, transparent); content: ""; }
.onboarding-content h1 { margin: 0; color: inherit; font-size: 46px; font-weight: 950; letter-spacing: 0; line-height: 1.15; }
.onboarding-content h1 span { color: var(--onboarding-accent); }
.onboarding-intro { margin: 18px 0 var(--density-intro-bottom); color: #637083; font-size: 16px; font-weight: 500; transition: margin 280ms ease; }
.dark .onboarding-intro,.dark .onboarding-hint { color: #aeb8c6; }
.onboarding-theme-options { display: flex; align-items: stretch; gap: var(--density-theme-gap); transition: gap 280ms ease; }
.onboarding-theme-options button { display: grid; width: 82px; height: var(--density-theme-height); place-items: center; align-content: center; gap: 8px; border: 1px solid rgba(148,158,170,.24); border-radius: 14px; background: rgba(255,255,255,.8); color: #344154; cursor: pointer; box-shadow: 0 9px 24px rgba(41,58,72,.09); transition: height 280ms ease, transform 280ms ease, border-color 280ms ease, background 280ms ease, color 280ms ease; }
.dark .onboarding-theme-options button { border-color: rgba(255,255,255,.1); background: rgba(28,33,40,.78); color: #d6dde8; }
.onboarding-theme-options button:hover { transform: translateY(-2px); }
.onboarding-theme-options button.active { border: 2px solid var(--onboarding-accent); background: color-mix(in srgb, var(--onboarding-accent) 9%, rgba(255,255,255,.9)); color: #172132; }
.dark .onboarding-theme-options button.active { color: #f7ffff; }
.onboarding-theme-options span { font-size: 14px; font-weight: 750; }
.onboarding-accents { display: flex; gap: 12px; margin-top: var(--density-section-gap); transition: margin 280ms ease; }
.onboarding-accents button { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 50%; background: var(--swatch); color: var(--swatch-text); cursor: pointer; box-shadow: 0 7px 15px rgba(37,48,64,.13); outline: 0 solid transparent; transition: transform 280ms ease, outline 280ms ease; }
.onboarding-accents button:hover { transform: translateY(-2px) scale(1.04); }
.onboarding-accents button.active { outline: 3px solid color-mix(in srgb, var(--swatch) 75%, #fff); outline-offset: 3px; }
.onboarding-density { display: grid; width: 216px; grid-template-columns: repeat(3, 1fr); margin-top: var(--density-section-gap); border-radius: 999px; padding: 5px; background: rgba(255,255,255,.84); box-shadow: 0 9px 24px rgba(41,58,72,.09); transition: margin 280ms ease; }
.dark .onboarding-density { background: rgba(28,33,40,.82); }
.onboarding-density button { height: var(--density-density-height); border: 0; border-radius: 999px; background: transparent; color: #4f5c6f; cursor: pointer; font-size: 13px; font-weight: 700; transition: height 280ms ease, background 280ms ease, color 280ms ease, box-shadow 280ms ease; }
.dark .onboarding-density button { color: #b8c1ce; }
.onboarding-density button.active { background: var(--onboarding-accent); color: var(--onboarding-accent-text); box-shadow: 0 7px 16px color-mix(in srgb, var(--onboarding-accent) 28%, transparent); }
.dark .onboarding-density button.active { color: var(--onboarding-accent-text); }
.onboarding-backgrounds { display: flex; gap: 13px; margin-top: var(--density-section-gap); transition: margin 280ms ease; }
.onboarding-backgrounds button { display: grid; width: 44px; height: 30px; place-items: center; border: 1px solid rgba(148,158,170,.24); border-radius: 9px; background: var(--swatch); color: var(--onboarding-accent); cursor: pointer; box-shadow: 0 5px 13px rgba(45,58,72,.1); transition: border-color 280ms ease, transform 280ms ease, box-shadow 280ms ease; }
.onboarding-backgrounds button:hover { transform: translateY(-2px); }
.onboarding-backgrounds button.active { border: 2px solid var(--onboarding-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--onboarding-accent) 10%, transparent); }
.onboarding-backgrounds button.image-choice { border: 2px dashed color-mix(in srgb, var(--onboarding-accent) 55%, transparent); background: color-mix(in srgb, var(--onboarding-accent) 5%, rgba(255,255,255,.82)); }
.onboarding-hint { margin: var(--density-hint-gap) 0 0; color: #687588; font-size: 13px; font-weight: 500; transition: margin 280ms ease; }
.onboarding-error { margin: 8px 0 0; color: #b42318; font-size: 13px; font-weight: 600; }
.onboarding-source-page { align-content: center; }
.onboarding-source-page .onboarding-eyebrow { margin-bottom: 18px; }
.onboarding-source-page .onboarding-intro { margin-bottom: 24px; }
.onboarding-source-options { display: grid; width: 100%; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.onboarding-source-card { position: relative; display: grid; height: 176px; place-items: center; align-content: center; gap: 13px; border: 1px solid rgba(148,158,170,.2); border-radius: 18px; padding: 20px 18px; background: rgba(255,255,255,.82); color: #667184; cursor: pointer; box-shadow: 0 14px 32px rgba(41,58,72,.1); transition: transform 280ms ease, border-color 280ms ease, background 280ms ease, color 280ms ease, box-shadow 280ms ease; }
.onboarding-source-card:hover { transform: translateY(-3px); color: color-mix(in srgb, var(--onboarding-accent) 78%, #4f5b6f); }
.onboarding-source-card.active { border: 2px solid var(--onboarding-accent); background: color-mix(in srgb, var(--onboarding-accent) 12%, rgba(255,255,255,.88)); color: var(--onboarding-accent); box-shadow: 0 15px 34px color-mix(in srgb, var(--onboarding-accent) 24%, transparent), inset 0 0 0 3px color-mix(in srgb, var(--onboarding-accent) 7%, transparent); }
.onboarding-source-card strong { color: #172033; font-size: 17px; font-weight: 850; }
.onboarding-source-card > span:last-child { max-width: 185px; color: #5f6b7c; font-size: 13px; font-weight: 500; line-height: 1.65; }
.onboarding-source-check { position: absolute; top: 11px; right: 11px; display: grid; width: 24px; height: 24px; place-items: center; border-radius: 50%; background: var(--onboarding-accent); color: var(--onboarding-accent-text); box-shadow: 0 7px 16px color-mix(in srgb, var(--onboarding-accent) 28%, transparent); }
.dark .onboarding-source-card { border-color: rgba(255,255,255,.1); background: rgba(28,33,40,.82); color: #b7c0cd; }
.dark .onboarding-source-card.active { background: color-mix(in srgb, var(--onboarding-accent) 17%, rgba(28,33,40,.88)); }
.dark .onboarding-source-card strong { color: #eef4f7; }
.dark .onboarding-source-card > span:last-child { color: #aeb8c6; }
.onboarding-library-page { align-content: center; }
.onboarding-library-page .onboarding-eyebrow { margin-bottom: 12px; }
.onboarding-library-page h1 { font-size: 42px; }
.onboarding-library-intro { max-width: 570px; margin: 13px 0 16px; font-size: 14px; line-height: 1.65; }
.onboarding-library-folders { display: grid; width: min(560px,100%); gap: 8px; border-radius: 18px; padding: 12px; background: rgba(255,255,255,.86); box-shadow: 0 13px 30px rgba(41,58,72,.09); }
.onboarding-add-folder { display: flex; min-height: 54px; align-items: center; justify-content: center; gap: 9px; border: 2px dashed color-mix(in srgb,var(--onboarding-accent) 55%,rgba(148,158,170,.25)); border-radius: 13px; background: color-mix(in srgb,var(--onboarding-accent) 5%,transparent); color: var(--onboarding-accent); cursor: pointer; font-size: 14px; font-weight: 800; transition: background 280ms ease,border-color 280ms ease,transform 280ms ease; }
.onboarding-add-folder:hover:not(:disabled) { border-color: var(--onboarding-accent); background: color-mix(in srgb,var(--onboarding-accent) 10%,transparent); transform: translateY(-1px); }
.onboarding-add-folder:disabled,.onboarding-folder-row button:disabled { cursor: wait; opacity: .55; }
.onboarding-folder-list { display: grid; max-height: 94px; overflow-x: hidden; overflow-y: auto; scrollbar-width: thin; }
.onboarding-folder-row { display: grid; min-height: 48px; grid-template-columns: 22px minmax(0,1fr) 34px; align-items: center; gap: 9px; border-top: 1px solid rgba(148,158,170,.14); color: var(--onboarding-accent); text-align: left; }
.onboarding-folder-row > span { display: grid; min-width: 0; gap: 2px; }
.onboarding-folder-row strong,.onboarding-folder-row small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.onboarding-folder-row strong { color: #172033; font-size: 13px; font-weight: 800; }
.onboarding-folder-row small { color: #5f6b7c; font-size: 12px; font-weight: 500; }
.onboarding-folder-row button { display: grid; width: 30px; height: 30px; place-items: center; border: 0; border-radius: 8px; background: transparent; color: #8190a2; cursor: pointer; transition: background 280ms ease,color 280ms ease; }
.onboarding-folder-row button:hover:not(:disabled) { background: color-mix(in srgb,var(--onboarding-accent) 10%,transparent); color: var(--onboarding-accent); }
.onboarding-library-folders > p { margin: 0; padding: 4px 0 1px; color: #687588; font-size: 12px; font-weight: 500; }
.onboarding-library-settings { display: grid; width: min(560px,100%); margin-top: 14px; border-radius: 18px; padding: 6px 20px; background: rgba(255,255,255,.88); box-shadow: 0 11px 26px rgba(41,58,72,.08); }
.onboarding-library-settings button { display: flex; min-height: 51px; align-items: center; justify-content: space-between; gap: 18px; border: 0; border-bottom: 1px solid rgba(148,158,170,.14); padding: 6px 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.onboarding-library-settings button:last-child { border-bottom: 0; }
.onboarding-library-settings button > span { display: grid; gap: 3px; }
.onboarding-library-settings strong { color: #172033; font-size: 14px; font-weight: 850; }
.onboarding-library-settings small { color: #5f6b7c; font-size: 12px; font-weight: 500; line-height: 1.45; }
.onboarding-library-settings i { position: relative; width: 41px; height: 22px; flex: 0 0 auto; border-radius: 999px; background: #cbd2dc; transition: background 280ms ease; }
.onboarding-library-settings i b { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(30,41,59,.18); transition: transform 280ms ease; }
.onboarding-library-settings i.active { background: var(--onboarding-accent); }
.onboarding-library-settings i.active b { transform: translateX(19px); }
.onboarding-library-message { min-height: 17px; margin-top: 10px; font-size: 12px; }
.dark .onboarding-library-folders,.dark .onboarding-library-settings { background: rgba(28,33,40,.84); }
.dark .onboarding-folder-row { border-color: rgba(255,255,255,.1); }
.dark .onboarding-folder-row strong,.dark .onboarding-library-settings strong { color: #eef4f7; }
.dark .onboarding-folder-row small,.dark .onboarding-library-settings small,.dark .onboarding-library-folders > p { color: #aeb8c6; }
.onboarding-streaming-page { align-content: center; }
.onboarding-streaming-page .onboarding-eyebrow { margin-bottom: 16px; }
.onboarding-streaming-intro { max-width: 590px; margin-bottom: 20px; line-height: 1.75; }
.onboarding-login-options { display: grid; width: min(466px, 100%); grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.onboarding-login-card { position: relative; display: grid; min-height: 164px; place-items: center; align-content: center; gap: 11px; border: 1px solid rgba(148,158,170,.2); border-radius: 18px; padding: 19px 18px; background: rgba(255,255,255,.82); color: color-mix(in srgb, var(--onboarding-accent) 70%, #7c8795); cursor: pointer; box-shadow: 0 14px 32px rgba(41,58,72,.1); transition: transform 280ms ease, border-color 280ms ease, background 280ms ease, box-shadow 280ms ease; }
.onboarding-login-card:hover { transform: translateY(-3px); }
.onboarding-login-card.active { border: 2px solid var(--onboarding-accent); background: color-mix(in srgb, var(--onboarding-accent) 12%, rgba(255,255,255,.88)); box-shadow: 0 15px 34px color-mix(in srgb, var(--onboarding-accent) 24%, transparent), inset 0 0 0 3px color-mix(in srgb, var(--onboarding-accent) 7%, transparent); }
.onboarding-login-card strong { color: #172033; font-size: 17px; font-weight: 850; }
.onboarding-login-card > span:last-child { max-width: 185px; color: #5f6b7c; font-size: 13px; font-weight: 500; line-height: 1.55; }
.onboarding-quality-options { display: grid; width: min(370px, 100%); grid-template-columns: repeat(5, minmax(0, 1fr)); margin-top: 14px; border: 1px solid rgba(148,158,170,.18); border-radius: 999px; padding: 5px; background: rgba(255,255,255,.84); box-shadow: 0 9px 24px rgba(41,58,72,.09); }
.onboarding-quality-options button,.onboarding-cache-options button { min-width: 0; border: 0; border-radius: 999px; background: transparent; color: #4f5c6f; cursor: pointer; font-size: 13px; font-weight: 700; transition: background 280ms ease, color 280ms ease, box-shadow 280ms ease; }
.onboarding-quality-options button { height: 36px; }
.onboarding-quality-options button.active,.onboarding-cache-options button.active { background: var(--onboarding-accent); color: var(--onboarding-accent-text); box-shadow: 0 7px 16px color-mix(in srgb, var(--onboarding-accent) 28%, transparent); }
.onboarding-cache-options { display: grid; width: min(205px, 100%); grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 12px; border-radius: 999px; padding: 5px; background: rgba(255,255,255,.84); box-shadow: 0 9px 24px rgba(41,58,72,.09); }
.onboarding-cache-options button { height: 34px; padding-inline: 11px; white-space: nowrap; }
.dark .onboarding-login-card { border-color: rgba(255,255,255,.1); background: rgba(28,33,40,.82); }
.dark .onboarding-login-card.active { background: color-mix(in srgb, var(--onboarding-accent) 17%, rgba(28,33,40,.88)); }
.dark .onboarding-login-card strong { color: #eef4f7; }
.dark .onboarding-login-card > span:last-child { color: #aeb8c6; }
.dark .onboarding-quality-options,.dark .onboarding-cache-options { background: rgba(28,33,40,.82); }
.dark .onboarding-quality-options button,.dark .onboarding-cache-options button { color: #b8c1ce; }
.dark .onboarding-quality-options button.active,.dark .onboarding-cache-options button.active { color: var(--onboarding-accent-text); }
.onboarding-player-page { align-content: center; }
.onboarding-player-page .onboarding-eyebrow { margin-bottom: 13px; }
.onboarding-player-page h1 { font-size: 42px; }
.onboarding-player-intro { margin: 13px 0 15px; font-size: 14px; line-height: 1.65; }
.onboarding-player-options { display: grid; width: min(610px,100%); grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; }
.onboarding-player-card { position: relative; display: grid; min-height: 142px; place-items: center; align-content: center; gap: 9px; border: 1px solid rgba(148,158,170,.2); border-radius: 18px; padding: 17px 15px; background: rgba(255,255,255,.82); color: color-mix(in srgb,var(--onboarding-accent) 66%,#7c8795); cursor: pointer; box-shadow: 0 13px 28px rgba(41,58,72,.09); transition: transform 280ms ease,border-color 280ms ease,background 280ms ease,box-shadow 280ms ease; }
.onboarding-player-card:hover { transform: translateY(-3px); }
.onboarding-player-card.active { border: 2px solid var(--onboarding-accent); background: color-mix(in srgb,var(--onboarding-accent) 13%,rgba(255,255,255,.9)); box-shadow: 0 15px 34px color-mix(in srgb,var(--onboarding-accent) 23%,transparent),inset 0 0 0 3px color-mix(in srgb,var(--onboarding-accent) 7%,transparent); }
.onboarding-player-card strong { color: #172033; font-size: 16px; font-weight: 850; }
.onboarding-player-card > span:last-child { max-width: 165px; color: #5f6b7c; font-size: 13px; font-weight: 500; line-height: 1.55; }
.onboarding-mini-options { display: grid; width: min(560px,100%); margin-top: 14px; border: 1px solid rgba(148,158,170,.15); border-radius: 18px; padding: 8px 20px; background: rgba(255,255,255,.86); box-shadow: 0 13px 30px rgba(41,58,72,.09); }
.onboarding-mini-options button { display: flex; min-height: 54px; align-items: center; justify-content: space-between; gap: 20px; border: 0; border-bottom: 1px solid rgba(148,158,170,.15); padding: 6px 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.onboarding-mini-options button:last-child { border-bottom: 0; }
.onboarding-mini-options button > span { display: grid; gap: 3px; }
.onboarding-mini-options strong { color: #172033; font-size: 14px; font-weight: 850; }
.onboarding-mini-options small { color: #5f6b7c; font-size: 12px; font-weight: 500; line-height: 1.45; }
.onboarding-mini-options i { position: relative; width: 41px; height: 22px; flex: 0 0 auto; border-radius: 999px; background: #cbd2dc; transition: background 280ms ease; }
.onboarding-mini-options i b { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(30,41,59,.18); transition: transform 280ms ease; }
.onboarding-mini-options i.active { background: var(--onboarding-accent); }
.onboarding-mini-options i.active b { transform: translateX(19px); }
.onboarding-visibility { display: grid; width: min(560px,100%); justify-items: center; gap: 4px; margin-top: 12px; border-radius: 18px; padding: 10px 16px 12px; background: rgba(255,255,255,.86); box-shadow: 0 11px 26px rgba(41,58,72,.08); }
.onboarding-visibility > strong { color: #172033; font-size: 14px; font-weight: 850; }
.onboarding-visibility > span { color: #5f6b7c; font-size: 12px; font-weight: 500; }
.onboarding-visibility > div { display: grid; width: min(300px,100%); grid-template-columns: .72fr 1.5fr 1fr; margin-top: 4px; border: 1px solid rgba(148,158,170,.17); border-radius: 999px; padding: 4px; background: rgba(248,250,252,.9); }
.onboarding-visibility button { height: 32px; border: 0; border-radius: 999px; background: transparent; color: #4f5c6f; cursor: pointer; font-size: 12px; font-weight: 700; transition: background 280ms ease,color 280ms ease,box-shadow 280ms ease; }
.onboarding-visibility button.active { background: var(--onboarding-accent); color: var(--onboarding-accent-text); box-shadow: 0 6px 14px color-mix(in srgb,var(--onboarding-accent) 27%,transparent); }
.onboarding-player-hint { margin-top: 10px; font-size: 12px; }
.dark .onboarding-player-card,.dark .onboarding-mini-options,.dark .onboarding-visibility { border-color: rgba(255,255,255,.1); background: rgba(28,33,40,.84); }
.dark .onboarding-player-card.active { background: color-mix(in srgb,var(--onboarding-accent) 17%,rgba(28,33,40,.9)); }
.dark .onboarding-player-card strong,.dark .onboarding-mini-options strong,.dark .onboarding-visibility > strong { color: #eef4f7; }
.dark .onboarding-player-card > span:last-child,.dark .onboarding-mini-options small,.dark .onboarding-visibility > span { color: #aeb8c6; }
.dark .onboarding-visibility > div { background: rgba(15,20,26,.72); }
.onboarding-audio-page { align-content: center; }
.onboarding-audio-page .onboarding-eyebrow { margin-bottom: 13px; }
.onboarding-audio-page h1 { font-size: 42px; }
.onboarding-audio-intro { margin: 13px 0 15px; font-size: 14px; line-height: 1.65; }
.onboarding-device-list { display: grid; width: min(560px,100%); max-height: 184px; overflow-x: hidden; overflow-y: auto; border: 1px solid rgba(148,158,170,.18); border-radius: 18px; padding: 8px 12px; background: rgba(255,255,255,.86); box-shadow: 0 13px 30px rgba(41,58,72,.09); scrollbar-width: thin; }
.onboarding-device-list button { position: relative; display: grid; min-height: 66px; grid-template-columns: 30px minmax(0,1fr) auto 24px; align-items: center; gap: 10px; border: 1px solid transparent; border-bottom-color: rgba(148,158,170,.13); border-radius: 10px; padding: 9px 10px; background: transparent; color: var(--onboarding-accent); cursor: pointer; text-align: left; transition: border-color 280ms ease,background 280ms ease,box-shadow 280ms ease; }
.onboarding-device-list button:last-child { border-bottom-color: transparent; }
.onboarding-device-list button:hover { background: color-mix(in srgb,var(--onboarding-accent) 5%,transparent); }
.onboarding-device-list button.active { border-color: var(--onboarding-accent); background: color-mix(in srgb,var(--onboarding-accent) 9%,rgba(255,255,255,.76)); box-shadow: inset 0 0 0 1px color-mix(in srgb,var(--onboarding-accent) 28%,transparent); }
.onboarding-device-list button:disabled { cursor: not-allowed; opacity: .48; }
.onboarding-device-list button > span { display: grid; min-width: 0; gap: 3px; }
.onboarding-device-list strong { overflow: hidden; color: #172033; font-size: 14px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.onboarding-device-list small { overflow: hidden; color: #5f6b7c; font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.onboarding-device-list em { border-radius: 999px; padding: 4px 9px; background: color-mix(in srgb,var(--onboarding-accent) 10%,transparent); color: var(--onboarding-accent); font-size: 12px; font-style: normal; font-weight: 850; }
.onboarding-device-check { display: grid !important; width: 22px; height: 22px; place-items: center; border-radius: 50%; background: var(--onboarding-accent); color: var(--onboarding-accent-text); }
.onboarding-audio-mode { display: grid; width: min(510px,100%); min-height: 70px; grid-template-columns: 38px minmax(0,1fr) 24px; align-items: center; gap: 12px; margin-top: 14px; border: 1px solid color-mix(in srgb,var(--onboarding-accent) 38%,rgba(148,158,170,.18)); border-radius: 16px; padding: 10px 16px; background: color-mix(in srgb,var(--onboarding-accent) 9%,rgba(255,255,255,.86)); color: var(--onboarding-accent); box-shadow: 0 11px 26px rgba(41,58,72,.08); text-align: left; }
.onboarding-audio-mode > span { display: grid; gap: 4px; }
.onboarding-audio-mode strong { color: #172033; font-size: 14px; font-weight: 850; }
.onboarding-audio-mode small { color: #5f6b7c; font-size: 12px; font-weight: 500; }
.onboarding-loudness { display: flex; width: min(560px,100%); min-height: 66px; align-items: center; justify-content: space-between; gap: 18px; margin-top: 14px; border: 0; border-radius: 16px; padding: 10px 20px; background: rgba(255,255,255,.88); color: inherit; cursor: pointer; box-shadow: 0 11px 26px rgba(41,58,72,.08); text-align: left; }
.onboarding-loudness > span { display: grid; gap: 4px; }
.onboarding-loudness strong { color: #172033; font-size: 14px; font-weight: 850; }
.onboarding-loudness small { color: #5f6b7c; font-size: 12px; font-weight: 500; }
.onboarding-loudness i { position: relative; width: 41px; height: 22px; flex: 0 0 auto; border-radius: 999px; background: #cbd2dc; transition: background 280ms ease; }
.onboarding-loudness i b { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(30,41,59,.18); transition: transform 280ms ease; }
.onboarding-loudness i.active { background: var(--onboarding-accent); }
.onboarding-loudness i.active b { transform: translateX(19px); }
.onboarding-audio-hint,.onboarding-audio-error { margin-top: 10px; font-size: 12px; }
.dark .onboarding-device-list,.dark .onboarding-loudness { border-color: rgba(255,255,255,.1); background: rgba(28,33,40,.84); }
.dark .onboarding-device-list button.active,.dark .onboarding-audio-mode { background: color-mix(in srgb,var(--onboarding-accent) 15%,rgba(28,33,40,.88)); }
.dark .onboarding-device-list strong,.dark .onboarding-audio-mode strong,.dark .onboarding-loudness strong { color: #eef4f7; }
.dark .onboarding-device-list small,.dark .onboarding-audio-mode small,.dark .onboarding-loudness small { color: #aeb8c6; }
.onboarding-desktop-page { align-content: center; }
.onboarding-desktop-page .onboarding-eyebrow { margin-bottom: 10px; }
.onboarding-desktop-page h1 { font-size: 40px; }
.onboarding-desktop-intro { margin: 11px 0 13px; font-size: 13px; }
.onboarding-close-options { display: grid; width: min(640px,100%); grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; }
.onboarding-desktop-card { position: relative; display: grid; min-height: 126px; place-items: center; align-content: center; gap: 8px; border: 1px solid rgba(148,158,170,.2); border-radius: 16px; padding: 14px 12px; background: rgba(255,255,255,.83); color: color-mix(in srgb,var(--onboarding-accent) 68%,#657286); cursor: pointer; box-shadow: 0 12px 28px rgba(41,58,72,.09); transition: transform 280ms ease,border-color 280ms ease,background 280ms ease,box-shadow 280ms ease; }
.onboarding-desktop-card:hover { transform: translateY(-2px); }
.onboarding-desktop-card.active { border: 2px solid var(--onboarding-accent); background: color-mix(in srgb,var(--onboarding-accent) 12%,rgba(255,255,255,.9)); box-shadow: 0 14px 30px color-mix(in srgb,var(--onboarding-accent) 22%,transparent),inset 0 0 0 3px color-mix(in srgb,var(--onboarding-accent) 7%,transparent); }
.onboarding-desktop-card strong { color: #172033; font-size: 15px; font-weight: 850; }
.onboarding-desktop-card > span:last-child { color: #5f6b7c; font-size: 12px; font-weight: 500; line-height: 1.45; }
.onboarding-desktop-switches { display: grid; width: min(560px,100%); margin-top: 12px; border-radius: 16px; padding: 4px 18px; background: rgba(255,255,255,.88); box-shadow: 0 11px 26px rgba(41,58,72,.08); }
.onboarding-desktop-switches button { display: flex; min-height: 54px; align-items: center; justify-content: space-between; gap: 18px; border: 0; border-bottom: 1px solid rgba(148,158,170,.14); padding: 7px 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.onboarding-desktop-switches button:last-child { border-bottom: 0; }
.onboarding-desktop-switches button:disabled { cursor: wait; opacity: .58; }
.onboarding-desktop-switches button > span { display: grid; min-width: 0; gap: 2px; }
.onboarding-desktop-switches strong { color: #172033; font-size: 14px; font-weight: 850; }
.onboarding-desktop-switches small { color: #5f6b7c; font-size: 12px; font-weight: 500; line-height: 1.45; }
.onboarding-desktop-switches i { position: relative; width: 41px; height: 22px; flex: 0 0 auto; border-radius: 999px; background: #cbd2dc; transition: background 280ms ease; }
.onboarding-desktop-switches i b { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(30,41,59,.18); transition: transform 280ms ease; }
.onboarding-desktop-switches i.active { background: var(--onboarding-accent); }
.onboarding-desktop-switches i.active b { transform: translateX(19px); }
.onboarding-desktop-secondary { margin-top: 10px; }
.onboarding-desktop-error { margin-top: 7px; }
.dark .onboarding-desktop-card,.dark .onboarding-desktop-switches { border-color: rgba(255,255,255,.1); background: rgba(28,33,40,.84); }
.dark .onboarding-desktop-card.active { background: color-mix(in srgb,var(--onboarding-accent) 17%,rgba(28,33,40,.9)); }
.dark .onboarding-desktop-card strong,.dark .onboarding-desktop-switches strong { color: #eef4f7; }
.dark .onboarding-desktop-card > span:last-child,.dark .onboarding-desktop-switches small { color: #aeb8c6; }
.onboarding-ready-page { align-content: center; }
.onboarding-ready-bars { display: flex; height: 48px; align-items: flex-end; justify-content: center; gap: 7px; margin-bottom: 12px; color: var(--onboarding-accent); filter: drop-shadow(0 7px 8px color-mix(in srgb,var(--onboarding-accent) 24%,transparent)); }
.onboarding-ready-bars i { width: 8px; height: 42px; border-radius: 999px; background: currentColor; transform-origin: center bottom; animation: onboarding-ready-bar 1.35s ease-in-out infinite; }
.onboarding-ready-bars i:nth-child(1),.onboarding-ready-bars i:nth-child(5) { height: 25px; animation-delay: -.54s; }
.onboarding-ready-bars i:nth-child(2),.onboarding-ready-bars i:nth-child(4) { height: 36px; animation-delay: -.27s; }
.onboarding-ready-bars i:nth-child(3) { animation-delay: 0s; }
.onboarding-ready-title { color: var(--onboarding-accent) !important; font-size: 48px !important; }
.onboarding-ready-intro { margin: 14px 0 18px; }
.onboarding-library-ready { display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 8px; border: 1px solid rgba(148,158,170,.17); border-radius: 999px; padding: 7px 18px; background: rgba(255,255,255,.82); color: #4f5c6f; font-size: 13px; font-weight: 700; box-shadow: 0 9px 24px rgba(41,58,72,.08); }
.onboarding-ready-icon { display: grid; place-items: center; color: var(--onboarding-accent); animation: onboarding-ready-pulse 2.4s ease-in-out infinite; }
.onboarding-ready-features { display: flex; width: min(700px,100%); flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 16px; }
.onboarding-ready-features button { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; border: 1px solid rgba(148,158,170,.16); border-radius: 999px; padding: 8px 15px; background: rgba(255,255,255,.84); color: #596578; cursor: pointer; box-shadow: 0 9px 22px rgba(41,58,72,.08); transition: transform 280ms ease,border-color 280ms ease,background 280ms ease,color 280ms ease,box-shadow 280ms ease; }
.onboarding-ready-features button:hover:not(:disabled) { transform: translateY(-2px); border-color: color-mix(in srgb,var(--onboarding-accent) 38%,transparent); }
.onboarding-ready-features button.active { border-color: color-mix(in srgb,var(--onboarding-accent) 45%,transparent); background: color-mix(in srgb,var(--onboarding-accent) 8%,rgba(255,255,255,.88)); color: var(--onboarding-accent); }
.onboarding-ready-features button:disabled { cursor: wait; opacity: .58; }
.onboarding-ready-features strong { font-size: 14px; font-weight: 750; }
.onboarding-ready-features em { color: var(--onboarding-accent); font-size: 12px; font-style: normal; font-weight: 800; }
.onboarding-feature-icon { display: grid; width: 21px; height: 21px; place-items: center; color: var(--onboarding-accent); }
.onboarding-feature-icon.lyric { animation: onboarding-feature-listen 2.1s ease-in-out infinite; }
.onboarding-feature-icon.mini { animation: onboarding-feature-window 2.6s ease-in-out infinite; }
.onboarding-feature-icon.sleep { animation: onboarding-feature-sleep 3s ease-in-out infinite; }
.onboarding-feature-icon.shortcut { animation: onboarding-feature-key 2.4s ease-in-out infinite; }
.onboarding-floating-note { position: absolute; z-index: -1; color: color-mix(in srgb,var(--onboarding-accent) 32%,transparent); animation: onboarding-floating-note 5.2s ease-in-out infinite; }
.onboarding-floating-note.note-one { top: 4%; left: -15%; animation-delay: -1.4s; }
.onboarding-floating-note.note-two { top: 34%; right: -12%; animation-delay: -3.2s; }
.onboarding-floating-note.note-three { right: 1%; bottom: 5%; animation-delay: -.5s; }
.dark .onboarding-library-ready,.dark .onboarding-ready-features button { border-color: rgba(255,255,255,.1); background: rgba(28,33,40,.84); color: #c3ccd8; }
.dark .onboarding-ready-features button.active { background: color-mix(in srgb,var(--onboarding-accent) 14%,rgba(28,33,40,.9)); color: var(--onboarding-accent); }
.onboarding-chapter { position: absolute; right: 6vw; bottom: 12vh; display: flex; align-items: flex-end; color: color-mix(in srgb, var(--onboarding-accent) 12%, transparent); line-height: .8; user-select: none; }
.onboarding-chapter strong { font-size: 116px; font-weight: 900; letter-spacing: 0; }
.onboarding-chapter span { margin: 0 0 5px 8px; color: color-mix(in srgb, var(--onboarding-accent) 48%, transparent); font-size: 25px; font-weight: 800; }
.onboarding-footer { position: absolute; right: 5vw; bottom: 18px; left: 5vw; z-index: 3; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
.onboarding-footer > span { color: #748195; font-size: 12px; font-weight: 500; }
.onboarding-footer button { border: 0; cursor: pointer; }
.onboarding-footer-actions { display: flex; align-items: center; justify-content: flex-end; justify-self: end; gap: 10px; }
.onboarding-skip { justify-self: start; border-radius: 999px; padding: 10px 16px; background: transparent; color: #748195; font-size: 14px; font-weight: 600; transition: background 280ms ease, color 280ms ease, box-shadow 280ms ease; }
.onboarding-skip:hover,.onboarding-skip:active,.onboarding-skip:focus-visible { background: color-mix(in srgb, var(--onboarding-accent) 15%, transparent); color: color-mix(in srgb, var(--onboarding-accent) 68%, #334155); box-shadow: 0 8px 20px color-mix(in srgb, var(--onboarding-accent) 12%, transparent); }
.onboarding-back,.onboarding-continue { display: inline-flex; height: 48px; align-items: center; justify-content: center; gap: 7px; border-radius: 999px; font-size: 14px; font-weight: 800; transition: transform 280ms ease, background 280ms ease, box-shadow 280ms ease; }
.onboarding-back { min-width: 64px; padding: 0 16px; background: rgba(255,255,255,.86); color: color-mix(in srgb, var(--onboarding-accent) 72%, #334155); box-shadow: 0 9px 22px rgba(41,58,72,.09); }
.dark .onboarding-back { background: rgba(28,33,40,.82); color: #dfe9ea; }
.onboarding-back:hover { transform: translateY(-2px); background: color-mix(in srgb, var(--onboarding-accent) 10%, #fff); }
.onboarding-continue { min-width: 112px; background: var(--onboarding-accent); color: var(--onboarding-accent-text); box-shadow: 0 14px 28px color-mix(in srgb, var(--onboarding-accent) 30%, transparent); }
.onboarding-continue:hover { transform: translateY(-2px); box-shadow: 0 18px 34px color-mix(in srgb, var(--onboarding-accent) 38%, transparent); }
.first-run-onboarding button:focus-visible { outline: 3px solid color-mix(in srgb, var(--onboarding-accent) 55%, #fff); outline-offset: 3px; }
.onboarding-enter { opacity: 0; animation: onboarding-element-enter var(--element-enter-duration) cubic-bezier(.22,.72,.28,1) forwards; animation-delay: var(--enter-delay, 0ms); }
.onboarding-enter[style*="--enter-order: 1"] { --enter-delay: var(--element-enter-stagger); }
.onboarding-enter[style*="--enter-order: 2"] { --enter-delay: calc(var(--element-enter-stagger) + var(--element-enter-stagger)); }
.onboarding-enter[style*="--enter-order: 3"] { --enter-delay: calc(var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger)); }
.onboarding-enter[style*="--enter-order: 4"] { --enter-delay: calc(var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger)); }
.onboarding-enter[style*="--enter-order: 5"] { --enter-delay: calc(var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger)); }
.onboarding-enter[style*="--enter-order: 6"] { --enter-delay: calc(var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger)); }
.onboarding-enter[style*="--enter-order: 7"] { --enter-delay: calc(var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger)); }
.onboarding-enter[style*="--enter-order: 8"] { --enter-delay: calc(var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger) + var(--element-enter-stagger)); }
.onboarding-forward-enter-active,.onboarding-forward-leave-active,.onboarding-backward-enter-active,.onboarding-backward-leave-active { transition: opacity var(--page-transition-duration) cubic-bezier(.22,.72,.28,1), transform var(--page-transition-duration) cubic-bezier(.22,.72,.28,1); }
.onboarding-forward-enter-from,.onboarding-backward-leave-to { opacity: 0; transform: translateX(46px); }
.onboarding-forward-leave-to,.onboarding-backward-enter-from { opacity: 0; transform: translateX(-46px); }
@keyframes onboarding-element-enter { from { opacity: 0; transform: translateY(var(--element-enter-distance)); } to { opacity: 1; transform: translateY(0); } }
@keyframes onboarding-ready-bar { 0%,100% { transform: scaleY(.48); opacity: .58; } 50% { transform: scaleY(1); opacity: 1; } }
@keyframes onboarding-ready-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.14); } }
@keyframes onboarding-feature-listen { 0%,100% { transform: rotate(0); } 40% { transform: rotate(-8deg); } 65% { transform: rotate(7deg); } }
@keyframes onboarding-feature-window { 0%,70%,100% { transform: translateY(0); } 82% { transform: translateY(-3px); } }
@keyframes onboarding-feature-sleep { 0%,100% { opacity: .7; filter: drop-shadow(0 0 0 transparent); } 50% { opacity: 1; filter: drop-shadow(0 0 5px color-mix(in srgb,var(--onboarding-accent) 50%,transparent)); } }
@keyframes onboarding-feature-key { 0%,75%,100% { transform: scale(1); } 84% { transform: scale(.88); } }
@keyframes onboarding-floating-note { 0%,100% { opacity: .2; transform: translateY(8px) rotate(-7deg); } 50% { opacity: .55; transform: translateY(-10px) rotate(7deg); } }
@media (max-height: 720px) {
  .onboarding-stage { height: calc(100vh - 136px); min-height: 420px; }
  .onboarding-eyebrow { margin-bottom: 12px; }
  .onboarding-content h1 { font-size: 38px; }
  .onboarding-intro { margin-block: 12px 14px; }
  .onboarding-theme-options button { height: 66px; }
  .onboarding-density,.onboarding-backgrounds { margin-top: 11px; }
  .onboarding-hint { margin-top: 10px; }
  .onboarding-player-page h1 { font-size: 34px; }
  .onboarding-player-intro { margin-block: 8px 10px; font-size: 12px; }
  .onboarding-player-card { min-height: 110px; padding-block: 10px; }
  .onboarding-mini-options { margin-top: 9px; padding-block: 4px; }
  .onboarding-mini-options button { min-height: 44px; }
  .onboarding-desktop-page h1 { font-size: 33px; }
  .onboarding-desktop-intro { margin-block: 7px 9px; font-size: 11px; }
  .onboarding-desktop-card { min-height: 105px; padding-block: 9px; }
  .onboarding-desktop-switches { margin-top: 8px; }
  .onboarding-desktop-switches button { min-height: 39px; }
  .onboarding-desktop-secondary { margin-top: 7px; }
  .onboarding-ready-bars { height: 38px; margin-bottom: 7px; }
  .onboarding-ready-title { font-size: 40px !important; }
  .onboarding-ready-intro { margin-block: 9px 12px; }
  .onboarding-ready-features { margin-top: 11px; }
  .onboarding-visibility { margin-top: 8px; padding-block: 7px 8px; }
  .onboarding-player-hint { display: none; }
  .onboarding-library-page h1 { font-size: 34px; }
  .onboarding-library-intro { margin-block: 8px 10px; font-size: 12px; }
  .onboarding-library-folders { padding: 9px 10px; }
  .onboarding-add-folder { min-height: 44px; }
  .onboarding-folder-list { max-height: 54px; }
  .onboarding-library-settings { margin-top: 9px; padding-block: 3px; }
  .onboarding-library-settings button { min-height: 43px; }
  .onboarding-chapter { bottom: 11vh; }
}
@media (max-width: 760px) {
  .onboarding-stage { width: min(520px, calc(100vw - 32px)); height: calc(100vh - 150px); }
  .onboarding-content h1 { font-size: 34px; }
  .onboarding-intro { max-width: 450px; font-size: 14px; line-height: 1.7; }
  .onboarding-source-options { grid-template-columns: 1fr; gap: 10px; }
  .onboarding-source-card { height: auto; min-height: 104px; grid-template-columns: 52px 1fr; justify-items: start; gap: 4px 14px; padding: 15px 46px 15px 18px; text-align: left; }
  .onboarding-source-card > svg { grid-row: 1 / span 2; }
  .onboarding-source-card > span:last-child { max-width: none; }
  .onboarding-login-options { gap: 10px; }
  .onboarding-login-card { min-height: 148px; padding-inline: 12px; }
  .onboarding-streaming-intro { max-width: 500px; }
  .onboarding-library-folders,.onboarding-library-settings { width: min(500px,100%); }
  .onboarding-player-options { gap: 10px; }
  .onboarding-player-card { min-height: 132px; padding-inline: 10px; }
  .onboarding-chapter { display: none; }
  .onboarding-footer { right: 20px; left: 20px; grid-template-columns: 1fr 1fr; }
  .onboarding-footer > span { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .onboarding-ready-bars i,.onboarding-floating-note,.onboarding-ready-icon,.onboarding-feature-icon { animation: none !important; }
  .first-run-onboarding,.first-run-onboarding * { animation-delay: 0ms !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
</style>
