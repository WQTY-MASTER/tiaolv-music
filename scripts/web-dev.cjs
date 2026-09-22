const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const viteEntry = path.join(root, "electron", "node_modules", "vite", "bin", "vite.js");
const config = path.join(root, "electron", "vite.web.config.ts");

const server = spawn(process.execPath, [
  viteEntry,
  "--config",
  config
], {
  cwd: root,
  stdio: "inherit",
  shell: false
});

server.on("exit", (code) => {
  process.exit(code ?? 0);
});

function stop() {
  if (server.exitCode === null) {
    server.kill();
  }
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
