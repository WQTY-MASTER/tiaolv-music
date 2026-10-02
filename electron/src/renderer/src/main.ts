import { createApp } from "vue";
import App from "./App.vue";
import DesktopLyricsWindow from "./components/DesktopLyricsWindow.vue";

const windowMode = new URLSearchParams(window.location.search).get("window");
createApp(windowMode === "desktop-lyrics" ? DesktopLyricsWindow : App).mount("#app");
