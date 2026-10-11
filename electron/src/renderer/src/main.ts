import { createApp } from "vue";
import App from "./App.vue";
import DesktopLyricsWindow from "./components/DesktopLyricsWindow.vue";
import MiniPlayerWindow from "./components/MiniPlayerWindow.vue";
import MiniPlayerEditorWindow from "./components/MiniPlayerEditorWindow.vue";

const windowMode = new URLSearchParams(window.location.search).get("window");
document.documentElement.dataset.windowMode = windowMode ?? "main";
createApp(windowMode === "desktop-lyrics" ? DesktopLyricsWindow
  : windowMode === "mini-player" ? MiniPlayerWindow
  : windowMode === "mini-editor" ? MiniPlayerEditorWindow : App).mount("#app");
