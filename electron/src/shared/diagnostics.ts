export const DIAGNOSTIC_CHANNELS = ["main", "renderer", "updater", "backend", "qq", "netease"] as const;
export type DiagnosticChannel = typeof DIAGNOSTIC_CHANNELS[number];

export interface RendererDiagnostic {
  kind: "error" | "request";
  message: string;
  stack?: string;
  context?: string;
  path?: string;
  method?: string;
  status?: number;
  elapsedMs?: number;
}

export interface DiagnosticAppearance {
  themeMode?: string;
  effectiveTheme?: string;
  lightAccent?: string;
  darkAccent?: string;
  density?: string;
  fontFamily?: string;
  backgroundMode?: string;
  activeView?: string;
  devicePixelRatio?: number;
}

export interface DiagnosticExportResult {
  status: "saved" | "cancelled" | "error";
  message?: string;
}

export function sanitizeDiagnosticPath(value: string): string {
  try {
    const url = new URL(value, "http://127.0.0.1");
    return url.pathname.split("/").map(part => {
      const decoded = decodeURIComponent(part);
      return /^\d{6,}$/.test(decoded) || /^[a-f0-9-]{20,}$/i.test(decoded)
        || decoded.length > 40 || /[^a-z0-9._-]/i.test(decoded) ? "[id]" : part;
    }).join("/");
  } catch {
    return "[invalid-path]";
  }
}

export function normalizeRendererDiagnostic(value: unknown): RendererDiagnostic | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!["error", "request"].includes(String(input.kind)) || typeof input.message !== "string"
    || input.message.length > 8192 || (input.stack !== undefined && (typeof input.stack !== "string" || input.stack.length > 32768))) return null;
  const result: RendererDiagnostic = { kind: input.kind as RendererDiagnostic["kind"], message: input.message };
  if (typeof input.stack === "string") result.stack = input.stack;
  if (typeof input.context === "string") result.context = input.context.slice(0, 128);
  if (input.kind === "request") {
    if (typeof input.path !== "string" || input.path.length > 2048 || !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(String(input.method))) return null;
    result.path = sanitizeDiagnosticPath(input.path);
    result.method = String(input.method);
    if (typeof input.status === "number" && Number.isInteger(input.status) && input.status >= 0 && input.status <= 599) result.status = input.status;
    if (typeof input.elapsedMs === "number" && Number.isFinite(input.elapsedMs)) result.elapsedMs = Math.round(Math.max(0, Math.min(3_600_000, input.elapsedMs)));
  }
  return result;
}

export function normalizeDiagnosticAppearance(value: unknown): DiagnosticAppearance {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const result: DiagnosticAppearance = {};
  const choices = { themeMode: ["system", "light", "dark"], effectiveTheme: ["light", "dark"],
    density: ["compact", "standard", "comfortable"], fontFamily: ["system", "segoe", "yahei", "simsun", "arial"], backgroundMode: ["solid", "image"] };
  for (const [key, values] of Object.entries(choices)) {
    if (typeof input[key] === "string" && values.includes(input[key])) Object.assign(result, { [key]: input[key] });
  }
  for (const key of ["lightAccent", "darkAccent"] as const) {
    if (typeof input[key] === "string" && /^#[a-f0-9]{6}$/i.test(input[key])) result[key] = input[key];
  }
  if (typeof input.activeView === "string" && /^[a-z][a-z-]{0,40}$/.test(input.activeView)) result.activeView = input.activeView;
  if (typeof input.devicePixelRatio === "number" && Number.isFinite(input.devicePixelRatio)
    && input.devicePixelRatio >= 0.5 && input.devicePixelRatio <= 8) result.devicePixelRatio = input.devicePixelRatio;
  return result;
}
