import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { localBackendProxy } from "../scripts/local-backend-proxy.cjs";

const electronRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(electronRoot, "src", "renderer"),
  cacheDir: path.join(electronRoot, ".vite-cache"),
  plugins: [vue(), localBackendProxy()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/backend": {
        target: "http://127.0.0.1:17890",
        changeOrigin: true,
        rewrite: url => url.replace(/^\/backend(?=\/|$)/, "")
      }
    }
  }
});
