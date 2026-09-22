const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const apiDirectory = path.join(root, "music-api", "api-enhanced");

const api = spawn(process.execPath, ["app.js"], {
  cwd: apiDirectory,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: "3000"
  },
  stdio: "inherit",
  shell: false
});

function stop() {
  if (api.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(api.pid), "/t", "/f"], {
      stdio: "ignore",
      shell: false
    });
    return;
  }

  api.kill("SIGTERM");
}

api.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("exit", stop);
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
