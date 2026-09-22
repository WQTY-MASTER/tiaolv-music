const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const backendHealthUrl = "http://127.0.0.1:17890/health";
const musicApiDirectory = path.join(root, "music-api", "api-enhanced");
const musicApiUrl = "http://127.0.0.1:3000/";
const children = [];

function command(name, args, cwd = root) {
  const child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", name, ...args], {
    cwd,
    stdio: "inherit",
    shell: false
  });
  children.push(child);
  return child;
}

function healthCheck() {
  return new Promise((resolve) => {
    const request = http.get(backendHealthUrl, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function musicApiCheck() {
  return new Promise((resolve) => {
    const request = http.get(musicApiUrl, (response) => {
      response.resume();
      resolve(true);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForMusicApi() {
  for (let i = 0; i < 30; i += 1) {
    if (await musicApiCheck()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function waitForBackend() {
  for (let i = 0; i < 60; i += 1) {
    if (await healthCheck()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Java backend did not become ready at http://127.0.0.1:17890/health");
}

function stopChild(child) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      shell: false
    });
    return;
  }

  child.kill("SIGTERM");
}

async function main() {
  if (!(await musicApiCheck())) {
    const musicApi = spawn(process.execPath, ["app.js"], {
      cwd: musicApiDirectory,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "3000"
      },
      stdio: "inherit",
      shell: false
    });
    children.push(musicApi);
    if (!(await waitForMusicApi())) {
      console.warn("网易云 API 尚未就绪，在线搜索暂不可用；本地音乐仍可继续使用。");
    }
  }

  if (!(await healthCheck())) {
    command("mvn", ["-f", "backend\\pom.xml", "spring-boot:run"]);
    await waitForBackend();
  }

  const electron = command("npm", ["--prefix", "electron", "run", "dev"]);
  electron.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function shutdown() {
  for (const child of children) {
    stopChild(child);
  }
}

process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

main().catch((error) => {
  console.error(error);
  shutdown();
  process.exit(1);
});
