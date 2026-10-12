import type { App as VueApp } from "vue";
import { normalizeDiagnosticAppearance, sanitizeDiagnosticPath, type DiagnosticAppearance, type RendererDiagnostic } from "../../../shared/diagnostics";

let appearance: DiagnosticAppearance = {};

export function setDiagnosticContext(value: DiagnosticAppearance) {
  appearance = normalizeDiagnosticAppearance(value);
}

export function getDiagnosticContext(): DiagnosticAppearance {
  return { ...appearance, devicePixelRatio: window.devicePixelRatio };
}

function report(value: RendererDiagnostic) {
  try { window.listenMusic?.reportDiagnostic?.(value); } catch { /* Diagnostics cannot fail the application. */ }
}

export function reportRendererError(error: unknown, context: string) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Non-Error rejection";
  const stack = error instanceof Error ? error.stack : undefined;
  report({ kind: "error", context, message: message.length > 8192 ? "Oversized error detail omitted" : message,
    stack: stack && stack.length <= 32768 ? stack : undefined });
}

export function reportRequestFailure(path: string, method: string, status: number, elapsedMs: number, message: string) {
  report({ kind: "request", path: sanitizeDiagnosticPath(path), method, status, elapsedMs,
    message: message.length > 8192 ? "Oversized request error omitted" : message });
}

export function installRendererDiagnostics(application: VueApp) {
  application.config.errorHandler = (error, _instance, info) => {
    reportRendererError(error, `vue:${info}`);
    console.error(error);
  };
  window.addEventListener("error", event => {
    if (event instanceof ErrorEvent) reportRendererError(event.error ?? event.message, "window-error");
  });
  window.addEventListener("unhandledrejection", event => reportRendererError(event.reason, "unhandled-rejection"));
}
