const { spawn } = require("node:child_process");
const path = require("node:path");
const { assertNodeVersion, createServiceOptions, ensureServices } = require("./start-services.cjs");

const root = path.resolve(__dirname, "..");

function command(name, args) {
  return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", name, ...args], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    shell: false
  });
}

async function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolve, reject) => {
      const terminator = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore", windowsHide: true, shell: false
      });
      terminator.once("error", () => reject(new Error("Owned Electron launcher could not be stopped.")));
      terminator.once("exit", code => code === 0 || child.exitCode !== null || child.signalCode !== null
        ? resolve() : reject(new Error("Owned Electron launcher could not be stopped.")));
    });
    return;
  }
  await new Promise(resolve => { child.once("exit", resolve); child.kill("SIGTERM"); });
}

async function runDevelopment(dependencies = {}) {
  const signals = dependencies.signals || process;
  const launch = dependencies.command || command;
  const terminate = dependencies.stopChild || stopChild;
  let services;
  let electron;
  let shutdownTask;
  let stopped = false;
  let shutdownCode = 0;
  let finishWaiting;
  let rejectWaiting;
  async function shutdown() {
    if (!shutdownTask) shutdownTask = (async () => {
      try { if (electron) await terminate(electron); }
      finally { await services?.stop(); }
    })();
    return shutdownTask;
  }
  function requestShutdown(code = 0) {
    stopped = true;
    shutdownCode = code;
    void shutdown().then(() => finishWaiting?.(code), error => rejectWaiting?.(error));
  }
  const interrupt = () => requestShutdown();
  signals.once("SIGINT", interrupt);
  signals.once("SIGTERM", interrupt);
  try {
    // Protected music-api/ launchers and Java share the same ownership boundary.
    const options = dependencies.ensureServices ? {} : createServiceOptions();
    options.onFatalError = () => requestShutdown(1);
    services = await (dependencies.ensureServices || ensureServices)(options, {
      onRuntimeCreated: runtime => {
        services = { stop: () => runtime.stop() };
        if (stopped) void runtime.stop();
      }
    });
    if (stopped) { await services.stop(); return shutdownCode; }
    electron = launch("npm", ["--prefix", "electron", "run", "dev"]);
    const code = await new Promise((resolve, reject) => {
      finishWaiting = resolve;
      rejectWaiting = reject;
      electron.once("exit", code => { electron = null; resolve(stopped ? shutdownCode : code ?? 0); });
      electron.once("error", () => reject(new Error("Electron development launcher failed to start.")));
    });
    await shutdown();
    return code;
  } catch (error) {
    await shutdown();
    if (stopped && shutdownCode === 0) return 0;
    throw error;
  } finally {
    signals.removeListener("SIGINT", interrupt);
    signals.removeListener("SIGTERM", interrupt);
  }
}

module.exports = { runDevelopment };
if (require.main === module) {
  try { assertNodeVersion(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  if (!process.exitCode) runDevelopment().then(code => { process.exitCode = code; }, error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
