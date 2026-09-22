const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

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

  const electronPath = path.join(root, "node_modules", "electron", "dist", isWindows ? "electron.exe" : "electron");
  const electron = isWindows
    ? spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          [
            `$env:ELECTRON_RENDERER_URL=${JSON.stringify(rendererUrl)}`,
            `$env:NODE_ENV_ELECTRON_VITE="development"`,
            `$process = Start-Process -FilePath ${JSON.stringify(electronPath)} -ArgumentList "." -WorkingDirectory ${JSON.stringify(root)} -PassThru`,
            "Wait-Process -Id $process.Id",
            "exit $process.ExitCode"
          ].join("; ")
        ],
        {
          cwd: root,
          stdio: "inherit",
          shell: false,
          env: {
            ...process.env,
            ELECTRON_RENDERER_URL: rendererUrl,
            NODE_ENV_ELECTRON_VITE: "development"
          }
        }
      )
    : spawn(electronPath, ["."], {
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
