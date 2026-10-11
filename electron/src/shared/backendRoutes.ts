export const LOCAL_BACKEND_ORIGIN = "http://127.0.0.1:17890";

export type BackendRouteOwner = "device" | "online";

const standaloneOrigins: Record<BackendRouteOwner, string> = {
  device: LOCAL_BACKEND_ORIGIN,
  online: LOCAL_BACKEND_ORIGIN
};

export function isLocalBackendUrl(value: string | URL): boolean {
  try {
    return new URL(value).origin === LOCAL_BACKEND_ORIGIN;
  } catch {
    return false;
  }
}

export function backendRouteOwner(path: string): BackendRouteOwner | null {
  let url: URL;
  try {
    url = new URL(path, LOCAL_BACKEND_ORIGIN);
  } catch {
    return null;
  }
  if (!isLocalBackendUrl(url) || url.username || url.password) return null;
  if (url.pathname === "/health") return "device";
  for (const root of ["library", "playback", "cache"]) {
    if (url.pathname === `/${root}` || url.pathname.startsWith(`/${root}/`)) return "device";
  }
  for (const root of ["auth", "account", "catalog"]) {
    if (url.pathname === `/${root}` || url.pathname.startsWith(`/${root}/`)) return "online";
  }
  return null;
}

export function standaloneBackendRequestUrl(path: string, previewOrigin?: string): string {
  const owner = backendRouteOwner(path) ?? "device";
  const origin = previewOrigin ? `${previewOrigin}/backend` : standaloneOrigins[owner];
  return `${origin}${path}`;
}

export function resolveStandaloneBackendResourceUrl(path: string, previewOrigin?: string): string {
  if (/^https?:/i.test(path)) {
    const url = new URL(path);
    return isLocalBackendUrl(url)
      ? standaloneBackendRequestUrl(`${url.pathname}${url.search}${url.hash}`, previewOrigin)
      : path;
  }
  return /^(?:file:|data:|blob:)/i.test(path) ? path : standaloneBackendRequestUrl(path, previewOrigin);
}
