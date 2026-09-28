const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function resolveElectronPath() {
  let electronPath;

  try {
    electronPath = require("electron");
  } catch {
    throw new Error(
      "Electron 运行文件尚未安装。请在项目根目录运行 `pnpm install`，然后重新执行 `npm run dev`。"
    );
  }

  if (typeof electronPath !== "string" || !existsSync(electronPath)) {
    throw new Error(
      "Electron 运行文件尚未安装。请在项目根目录运行 `pnpm install`，然后重新执行 `npm run dev`。"
    );
  }

  return electronPath;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: false
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${path.basename(command)} exited with code ${code}`));
    });
  });
}

async function main() {
  await run(process.execPath, [
    path.join(root, "node_modules", "electron-vite", "bin", "electron-vite.js"),
    "build"
  ]);

  const { createServer } = await import("vite");
  const vue = (await import("@vitejs/plugin-vue")).default;
  const rendererUrl = "http://127.0.0.1:5173";

  const server = await createServer({
    root: path.join(root, "src", "renderer"),
    cacheDir: path.join(root, ".vite-cache"),
    plugins: [vue()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true
    }
  });

  await server.listen();
  server.printUrls();

  const electronPath = resolveElectronPath();
  const electron = spawn(electronPath, ["."], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl,
      NODE_ENV_ELECTRON_VITE: "development"
    }
  });

  let shuttingDown = false;
  async function shutdown(code = 0) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    electron.kill();
    await server.close();
    process.exit(code);
  }

  electron.on("exit", (code) => {
    shutdown(code ?? 0);
  });
  process.on("SIGINT", () => {
    shutdown(0);
  });
  process.on("SIGTERM", () => {
    shutdown(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
