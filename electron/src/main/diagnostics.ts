import { appendFileSync, lstatSync, mkdirSync, writeFileSync } from "node:fs";
import { appendFile, lstat, mkdir, open, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { zip } from "fflate";
import { DIAGNOSTIC_CHANNELS, normalizeDiagnosticAppearance, sanitizeDiagnosticPath, type DiagnosticChannel } from "../shared/diagnostics";

interface RedactionOptions { secrets?: string[]; privatePaths?: string[] }
interface DiagnosticOptions extends RedactionOptions {
  directory: string;
  maxFileBytes?: number;
  maxPending?: number;
}
const PRIVATE_KEY = /cookie|authorization|password|secret|token|skey|credential|ticket|openid|account.?id|user.?id|\buin\b|request.?body|response.?body|headers|environment/i;
const MAX_INPUT = 128 * 1024;

export { sanitizeDiagnosticPath };

export function redactDiagnosticText(value: string, options: RedactionOptions = {}): string {
  if (value.length > MAX_INPUT) return "[oversized diagnostic omitted]";
  let text = value;
  for (const secret of options.secrets ?? []) if (secret) text = text.split(secret).join("[redacted]");
  for (const root of [...(options.privatePaths ?? [])].sort((a, b) => b.length - a.length)) {
    if (root) for (const spelling of [root, root.replace(/\\/g, "/")]) text = text.split(spelling).join("[private-path]");
  }
  return text
    .replace(/\b(?:set-cookie|cookie|authorization)\s*["']?\s*[:=][^\r\n]*/gi, "[private-header]")
    .replace(/(["']?\b(?:[a-z_]*token|[a-z_]*skey|password|passwd|secret|credential|ticket|openid|uin|accountId|userId|qqmusic_key)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}&]+)/gi, "$1[redacted]")
    .replace(/\bBearer\s+[a-z0-9._~+\/-]+=*/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, raw => {
      try { const url = new URL(raw); return `${url.protocol}//${url.host}${sanitizeDiagnosticPath(url.pathname)}`; }
      catch { return "[url]"; }
    })
    .replace(/file:\/\/[^\r\n"'<>]+/gi, "[file-path]")
    .replace(/\b[a-z]:[\\/][^\r\n"'<>]+/gi, "[file-path]")
    .replace(/\/(?:home|Users)\/[^\s/\\]+/g, "/[user]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\b\d{8,}\b/g, "[id]")
    .replace(/\b[a-z0-9_+\/=.-]{40,}\b/gi, "[long-value]");
}

function sanitizeValue(value: unknown, options: RedactionOptions, depth = 0): unknown {
  if (value instanceof Error) return redactDiagnosticText(`${value.stack ?? value.message}${"code" in value ? `\ncode=${String(value.code)}` : ""}`, options).slice(0, 12_000);
  if (typeof value === "string") return redactDiagnosticText(value, options).slice(0, 12_000);
  if (typeof value === "boolean" || value === null) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (depth >= 4) return "[nested detail omitted]";
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeValue(item, options, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) =>
    [key.slice(0, 64), PRIVATE_KEY.test(key) ? "[redacted]" : sanitizeValue(item, options, depth + 1)]));
  return undefined;
}

function pick(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(keys.filter(key => ["string", "number", "boolean"].includes(typeof record[key])).map(key => [key, record[key]]));
}

function summaryFields(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const backend = input.backend as Record<string, unknown> | undefined;
  return {
    system: pick(input.system, ["appVersion", "electronVersion", "chromeVersion", "nodeVersion", "osName", "osVersion", "osArch"]),
    backend: { ...pick(backend, ["ok", "backendVersion", "springBootVersion", "javaVersion"]), database: pick(backend?.database, ["product", "version"]) },
    display: pick(input.display, ["width", "height", "scaleFactor", "displayCount", "zoomFactor"]),
    appearance: normalizeDiagnosticAppearance(input.appearance),
    update: pick(input.update, ["status", "currentVersion", "latestVersion"]),
    runtime: Array.isArray(input.runtime) ? input.runtime.slice(0, 3).map(item => pick(item, ["id", "status", "port", "exitCode", "signal"])) : [],
    packaged: input.packaged === true,
    timezone: typeof input.timezone === "string" ? input.timezone.slice(0, 64) : undefined
  };
}

export function createDiagnostics(options: DiagnosticOptions) {
  const directory = path.resolve(options.directory);
  const maxFileBytes = Math.max(256, Math.min(1024 * 1024, options.maxFileBytes ?? 1024 * 1024));
  const maxPending = Math.max(1, Math.min(256, options.maxPending ?? 256));
  let tail = Promise.resolve();
  let pending = 0;
  let dropped = 0;
  let writeFailures = 0;
  const redaction = { secrets: options.secrets ?? [], privatePaths: options.privatePaths ?? [] };
  const files = DIAGNOSTIC_CHANNELS.flatMap(channel => [`${channel}.log`, `${channel}.1.log`, `${channel}.2.log`]);

  async function ensureDirectory() {
    // Reject linked ancestors before recursive mkdir can follow a junction.
    for (let current = directory; ; current = path.dirname(current)) {
      const info = await lstat(current).catch(error => { if (error.code === "ENOENT") return null; throw error; });
      if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new Error("Diagnostic directory must not be a link.");
      if (current === path.dirname(current)) break;
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Diagnostic directory must not be a link.");
  }

  async function fileInfo(file: string) {
    if (path.dirname(file) !== directory) throw new Error("Invalid diagnostic file.");
    const info = await lstat(file).catch(error => { if (error.code === "ENOENT") return null; throw error; });
    if (info && (!info.isFile() || info.isSymbolicLink())) throw new Error("Diagnostic log must not be a link.");
    return info;
  }

  function entry(channel: DiagnosticChannel, event: string, detail: unknown) {
    let text = JSON.stringify({ time: new Date().toISOString(), channel, event, detail: sanitizeValue(detail, redaction) }) + "\n";
    if (Buffer.byteLength(text) > Math.min(24_000, maxFileBytes)) text = JSON.stringify({ time: new Date().toISOString(), channel, event, detail: "[oversized detail omitted]" }) + "\n";
    return text;
  }

  function write(channel: DiagnosticChannel, event: string, detail?: unknown): Promise<void> {
    if (!DIAGNOSTIC_CHANNELS.includes(channel) || !/^[a-z0-9._-]{1,64}$/i.test(event)) return Promise.resolve();
    if (pending >= maxPending) { dropped++; return Promise.resolve(); }
    let text: string;
    try { text = entry(channel, event, detail); } catch { dropped++; return Promise.resolve(); }
    pending++;
    const task = tail.then(async () => {
      await ensureDirectory();
      const current = path.join(directory, `${channel}.log`);
      const previous = path.join(directory, `${channel}.1.log`);
      const oldest = path.join(directory, `${channel}.2.log`);
      const info = await fileInfo(current);
      if (info && info.size + Buffer.byteLength(text) > maxFileBytes) {
        if (await fileInfo(oldest)) await unlink(oldest);
        if (await fileInfo(previous)) await rename(previous, oldest);
        await rename(current, previous);
      }
      await appendFile(current, text, { mode: 0o600 });
    }).catch(() => { writeFailures++; }).finally(() => { pending--; });
    tail = task;
    return task;
  }

  function writeCrash(error: unknown) {
    try {
      for (let current = directory; ; current = path.dirname(current)) {
        try { const info = lstatSync(current); if (!info.isDirectory() || info.isSymbolicLink()) return; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") return; }
        if (current === path.dirname(current)) break;
      }
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const dir = lstatSync(directory);
      if (!dir.isDirectory() || dir.isSymbolicLink()) return;
      const file = path.join(directory, "main.log");
      const text = entry("main", "uncaught-exception", error);
      let info;
      try { info = lstatSync(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") return; }
      if (info && (!info.isFile() || info.isSymbolicLink())) return;
      if (info && info.size + Buffer.byteLength(text) > maxFileBytes) writeFileSync(file, "", { mode: 0o600 });
      appendFileSync(file, text, { mode: 0o600 });
    } catch { /* A crash logger must not change exception handling. */ }
  }

  async function exportBundle(file: string, summary: unknown) {
    const target = path.resolve(file);
    if (path.extname(target).toLowerCase() !== ".zip") throw new Error("Diagnostic output must be a ZIP file.");
    const collected: Record<string, Uint8Array> = {};
    const collect = tail.then(async () => {
      await ensureDirectory();
      const report = { schemaVersion: 1, generatedAt: new Date().toISOString(),
        ...summaryFields(summary), logging: { maxFileBytes, filesPerChannel: 3, dropped, writeFailures } };
      collected["diagnostics.json"] = Buffer.from(JSON.stringify(sanitizeValue(report, redaction), null, 2));
      for (const name of files) {
        const source = path.join(directory, name);
        const info = await fileInfo(source).catch(() => null);
        if (!info || info.size > maxFileBytes) continue;
        const handle = await open(source, "r");
        try {
          const buffer = Buffer.alloc(Math.min(info.size, maxFileBytes));
          const read = await handle.read(buffer, 0, buffer.length, 0);
          const content = buffer.subarray(0, read.bytesRead).toString("utf8");
          collected[`logs/${name}`] = Buffer.from(content.split("\n").map(line => {
            try { return JSON.stringify(sanitizeValue(JSON.parse(line), redaction)); }
            catch { return redactDiagnosticText(line, redaction); }
          }).join("\n"));
        } finally { await handle.close(); }
      }
    });
    tail = collect.catch(() => undefined);
    await collect;
    const archive = await new Promise<Uint8Array>((resolve, reject) => zip(collected, { level: 1 }, (error, data) => error ? reject(error) : resolve(data)));
    const existing = await lstat(target).catch(error => { if (error.code === "ENOENT") return null; throw error; });
    if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error("Diagnostic output must not be a link.");
    const temporary = `${target}.partial-${randomUUID()}`;
    try {
      await writeFile(temporary, archive, { flag: "wx", mode: 0o600 });
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  return { write, writeCrash, flush: () => tail, exportBundle,
    addSecret: (value: string) => { if (value && !redaction.secrets.includes(value)) redaction.secrets.push(value); },
    statistics: () => ({ dropped, writeFailures }) };
}
