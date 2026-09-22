const { defineConfig } = require("electron-vite");
const vue = require("@vitejs/plugin-vue");

module.exports = defineConfig({
  main: {
    build: {
      lib: {
        entry: "src/main/main.ts"
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: "src/preload/preload.ts"
      }
    }
  },
  renderer: {
    cacheDir: ".vite-cache",
    plugins: [vue()]
  }
});
