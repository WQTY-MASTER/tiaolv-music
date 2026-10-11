import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { appendFile, mkdir, readFile, realpath, stat } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

type ServiceId = "backend" | "netease" | "qq";
interface RuntimeService {
  id: ServiceId;
  kind: "java" | "node";
  entry: string;
  cwd: string;
  port: number;
  healthPath: string;
}
interface RuntimeManifest {
  schemaVersion: 1;
  javaExecutable: string;
  services: RuntimeService[];
}
interface RuntimeDependencies {
  spawn: (executable: string, args: string[], options: SpawnOptions) => ChildProcess;
  isPortAvailable: (port: number) => Promise<boolean>;
  isHealthy: (url: string) => Promise<boolean>;
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  appendLog: (file: string, text: string) => Promise<unknown>;
}
export interface ServiceRuntimeOptions {
  resourcesDirectory: string;
  nodeExecutable: string;
  dataDirectory: string;
  logDirectory: string;
  tokenFile?: string;
  javaHomeDirectory?: string;
  javaTemporaryDirectory?: string;
  startupTimeoutMs?: number;
  pollIntervalMs?: number;
  stopTimeoutMs?: number;
  environment?: NodeJS.ProcessEnv;
  onFatalError?: (error: Error) => void;
  dependencies?: Partial<RuntimeDependencies>;
}

const expectedServices = {
  backend: { kind: "java", port: 17890, healthPath: "/health" },
  netease: { kind: "node", port: 3000, healthPath: "/" },
  qq: { kind: "node", port: 3300, healthPath: "/" }
} as const;

function resourcePath(root: string, value: unknown): string {
  if (typeof value !== "string" || !value || /[\\:\0]/.test(value)
    || path.posix.isAbsolute(value) || value.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Invalid runtime manifest resource path.");
  }
  return path.join(root, ...value.split("/"));
}

async function checkedResource(root: string, value: unknown, directory = false): Promise<string> {
  const resolved = resourcePath(root, value);
  const actual = await realpath(resolved).catch(() => { throw new Error("Required runtime resource is missing."); });
  const relative = path.relative(root, actual);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Runtime resource escapes its directory.");
  const information = await stat(actual);
  if (directory ? !information.isDirectory() : !information.isFile()) throw new Error("Invalid runtime resource type.");
  return actual;
}

async function loadManifest(root: string): Promise<RuntimeManifest> {
  let value: RuntimeManifest;
  try {
    value = JSON.parse(await readFile(await checkedResource(root, "manifest.json"), "utf8")) as RuntimeManifest;
  } catch {
    throw new Error("Runtime manifest cannot be read.");
  }
  if (value?.schemaVersion !== 1 || !Array.isArray(value.services) || value.services.length !== 3) {
    throw new Error("Invalid runtime manifest schema.");
  }
  const seen = new Set<string>();
  for (const service of value.services) {
    const expected = service && Object.hasOwn(expectedServices, service.id) ? expectedServices[service.id] : undefined;
    if (!expected || seen.has(service.id) || service.kind !== expected.kind
      || service.port !== expected.port || service.healthPath !== expected.healthPath) {
      throw new Error("Invalid runtime manifest service.");
    }
    seen.add(service.id);
    service.entry = await checkedResource(root, service.entry);
    await checkedResource(root, service.cwd, true);
  }
  value.javaExecutable = await checkedResource(root, value.javaExecutable);
  return value;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

function isHealthy(url: string): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (healthy: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      request.destroy();
      resolve(healthy);
    };
    const request = http.get(url, { agent: false }, response => {
      response.once("error", () => finish(false));
      response.resume();
      finish(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300));
    });
    const deadline = setTimeout(() => finish(false), 1000);
    request.once("error", () => finish(false));
  });
}

// Inherited provider credentials and runtime injection flags must not reach packaged children.
function childEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowed = new Set(["path", "systemroot", "windir", "comspec", "pathext", "userprofile", "home", "homedrive", "homepath", "localappdata", "appdata", "lang", "lc_all", "tz"]);
  return Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key.toLowerCase())));
}

interface OwnedService {
  id: ServiceId;
  child: ChildProcess;
  exited: boolean;
  failure?: Error;
  exit: Promise<void>;
}

export function createServiceRuntime(options: ServiceRuntimeOptions) {
  const injected = options.dependencies;
  const dependencies: RuntimeDependencies = {
    spawn: (...args) => (injected?.spawn ?? spawn)(...args),
    isPortAvailable: port => (injected?.isPortAvailable ?? isPortAvailable)(port),
    isHealthy: url => (injected?.isHealthy ?? isHealthy)(url),
    now: () => (injected?.now ?? Date.now)(),
    sleep: ms => injected?.sleep ? injected.sleep(ms) : new Promise(resolve => setTimeout(resolve, ms)),
    appendLog: (file, text) => (injected?.appendLog ?? appendFile)(file, text)
  };
  const startupTimeout = options.startupTimeoutMs ?? 60_000;
  const pollInterval = options.pollIntervalMs ?? 200;
  const stopTimeout = options.stopTimeoutMs ?? 5000;
  const owned: OwnedService[] = [];
  let state: "idle" | "starting" | "running" | "stopping" | "stopped" | "failed" = "idle";
  let startTask: Promise<void> | undefined;
  let stopTask: Promise<void> | undefined;
  let fatalReported = false;
  const logTasks = new Set<Promise<unknown>>();

  function log(id: ServiceId, event: string) {
    const task = dependencies.appendLog(path.join(options.logDirectory, `${id}.log`), `${new Date().toISOString()} ${id} ${event}\n`);
    logTasks.add(task);
    void task.catch(() => undefined).finally(() => logTasks.delete(task));
    return task;
  }

  function ensureStarting() {
    if (state !== "starting") throw new Error("Service startup was stopped.");
    const failure = owned.find(service => service.failure)?.failure;
    if (failure) throw failure;
  }

  async function waitForExit(service: OwnedService) {
    if (injected?.sleep) {
      await Promise.race([service.exit, dependencies.sleep(stopTimeout)]);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([service.exit, new Promise<void>(resolve => { timer = setTimeout(resolve, stopTimeout); })]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function cleanup() {
    let failure: Error | undefined;
    for (const service of [...owned].reverse()) {
      if (service.exited) continue;
      try { service.child.kill("SIGTERM"); } catch { /* Already exited. */ }
      if (!service.exited) await waitForExit(service);
      if (!service.exited) {
        try { service.child.kill("SIGKILL"); } catch { /* Already exited. */ }
        if (!service.exited) await waitForExit(service);
      }
      if (!service.exited) failure ??= new Error(`${service.id} service could not be stopped.`);
    }
    await Promise.allSettled([...logTasks]);
    if (failure) throw failure;
  }

  function stop(): Promise<void> {
    if (!stopTask) {
      state = "stopping";
      stopTask = cleanup().finally(() => { state = "stopped"; });
    }
    return stopTask;
  }

  function unexpectedFailure(service: OwnedService) {
    if (state !== "running" || fatalReported) return;
    fatalReported = true;
    const error = service.failure ?? new Error(`${service.id} service failed.`);
    void stop().then(() => options.onFatalError?.(error), () => options.onFatalError?.(error));
  }

  async function startService(service: RuntimeService, executable: string) {
    const cwd = path.join(options.dataDirectory, service.id);
    // JDK loopback pipes can fail with long Windows temporary socket paths.
    const temp = service.kind === "java"
      ? options.javaTemporaryDirectory ?? path.join(tmpdir(), "tl-"
        + createHash("sha256").update(path.resolve(options.dataDirectory)).digest("hex").slice(0, 8))
      : path.join(cwd, "tmp");
    await mkdir(cwd, { recursive: true });
    await mkdir(temp, { recursive: true, mode: 0o700 });
    if (service.id === "qq") await mkdir(path.join(cwd, "config"), { recursive: true });
    ensureStarting();
    const env: NodeJS.ProcessEnv = {
      ...childEnvironment(options.environment ?? process.env),
      HOST: "127.0.0.1", PORT: String(service.port),
      TEMP: temp, TMP: temp, TMPDIR: temp,
      QQ_MUSIC_API_CONFIG_DIR: path.join(options.dataDirectory, "qq", "config")
    };
    const args = service.kind === "java"
      ? [`-Djava.io.tmpdir=${temp}`, ...(options.javaHomeDirectory ? [`-Duser.home=${options.javaHomeDirectory}`] : []), "-jar", service.entry, "--server.address=127.0.0.1", `--server.port=${service.port}`]
      : [service.entry];
    if (service.kind === "node") env.ELECTRON_RUN_AS_NODE = "1";
    if (options.tokenFile) env.LISTENMUSIC_LOCAL_ACCESS_TOKEN_FILE = options.tokenFile;
    await log(service.id, "starting");
    ensureStarting();
    let child: ChildProcess;
    try {
      child = dependencies.spawn(executable, args, { cwd, env, windowsHide: true, shell: false, stdio: ["ignore", "ignore", "ignore"] });
    } catch {
      throw new Error(`${service.id} service failed to start.`);
    }
    let resolveExit!: () => void;
    const record: OwnedService = { id: service.id, child, exited: false, exit: new Promise(resolve => { resolveExit = resolve; }) };
    owned.push(record);
    child.on("error", () => {
      record.failure = new Error(`${service.id} service failed to start.`);
      if (!child.pid) { record.exited = true; resolveExit(); }
      void log(service.id, "failed").catch(() => undefined);
      unexpectedFailure(record);
    });
    child.once("exit", () => {
      record.exited = true;
      resolveExit();
      if (state === "starting" || state === "running") record.failure = new Error(`${service.id} service exited unexpectedly.`);
      void log(service.id, "exited").catch(() => undefined);
      unexpectedFailure(record);
    });
    const deadline = dependencies.now() + startupTimeout;
    while (true) {
      ensureStarting();
      const ready = await dependencies.isHealthy(`http://127.0.0.1:${service.port}${service.healthPath}`);
      ensureStarting();
      if (ready) { await log(service.id, "ready"); ensureStarting(); return; }
      if (dependencies.now() >= deadline) throw new Error(`${service.id} service readiness timed out.`);
      await dependencies.sleep(pollInterval);
    }
  }

  function start(): Promise<void> {
    if (startTask) return startTask;
    if (state !== "idle") return Promise.reject(new Error("Service runtime has been stopped."));
    state = "starting";
    startTask = (async () => {
      try {
        const root = await realpath(options.resourcesDirectory);
        const manifest = await loadManifest(root);
        ensureStarting();
        for (const service of manifest.services) {
          if (!await dependencies.isPortAvailable(service.port)) throw new Error(`Port ${service.port} is in use; close the existing service and try again.`);
          ensureStarting();
        }
        await mkdir(options.logDirectory, { recursive: true });
        for (const service of [...manifest.services].sort((a, b) => Number(a.kind === "java") - Number(b.kind === "java"))) {
          await startService(service, service.kind === "java" ? manifest.javaExecutable : options.nodeExecutable);
        }
        ensureStarting();
        state = "running";
      } catch (error) {
        if (state === "starting") state = "failed";
        await stop();
        throw error;
      }
    })();
    return startTask;
  }

  return { start, stop };
}
