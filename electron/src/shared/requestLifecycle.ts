export const REQUEST_TIMEOUT_MS = 12_000;

export class ApiRequestError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

interface RequestFailure {
  status: number;
  elapsedMs: number;
  message: string;
}

interface RequestLifecycleOptions {
  timeoutMs?: number;
  emptyStatuses?: readonly number[];
  onFailure?: (failure: RequestFailure) => void;
}

export async function requestJson<T>(url: string, init?: RequestInit, options: RequestLifecycleOptions = {}): Promise<T> {
  if (init?.signal?.aborted) throw init.signal.reason;
  const started = performance.now();
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(init?.signal?.reason);
  init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
  let status = 0;
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  let abortRequest: () => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    abortRequest = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", abortRequest, { once: true });
  });
  try {
    // Race the entire body read as well as fetch, including transports that ignore abort.
    return await Promise.race([cancelled, (async () => {
      const response = await fetch(url, { ...init, signal: controller.signal });
      status = response.status;
      if (options.emptyStatuses?.includes(status)) return null as T;
      if (!response.ok) {
        let message = "";
        try {
          const detail = await response.json() as { message?: unknown; code?: unknown } | null;
          message = typeof detail?.message === "string" ? detail.message
            : typeof detail?.code === "string" ? detail.code : "";
        } catch {
          // A non-JSON error body must not replace the HTTP status.
        }
        throw new ApiRequestError(message || `Request failed: ${status}`, status);
      }
      return await response.json() as T;
    })()]);
  } catch (error) {
    if (timedOut || !init?.signal?.aborted) options.onFailure?.({ status, elapsedMs: performance.now() - started,
      message: timedOut ? "Request timed out" : error instanceof Error ? error.message : "Network request failed" });
    if (timedOut) throw new Error("请求超时，请稍后重试。");
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    init?.signal?.removeEventListener("abort", abortFromCaller);
    controller.signal.removeEventListener("abort", abortRequest);
  }
}
