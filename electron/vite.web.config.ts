import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const electronRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(electronRoot, "src", "renderer"),
  cacheDir: path.join(electronRoot, ".vite-cache"),
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});
