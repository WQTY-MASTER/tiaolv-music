import { lstatSync, readFileSync } from "node:fs";
import { isLocalBackendUrl, LOCAL_BACKEND_ORIGIN } from "../shared/backendRoutes";

export const BACKEND_ORIGIN = LOCAL_BACKEND_ORIGIN;
export const BACKEND_TOKEN_HEADER = "X-Tiaolv-Token";

export function stripBackendTokenHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== BACKEND_TOKEN_HEADER.toLowerCase()));
}

export function readLocalAccessToken(file: string): string {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 66) throw new Error("Invalid local API access file");
  const token = readFileSync(file, "ascii").trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid local API access file");
  return token;
}

export function isTrustedRendererUrl(value: string, rendererFileUrl: string, rendererUrl?: string): boolean {
  try {
    const current = new URL(value);
    const expected = new URL(rendererUrl || rendererFileUrl);
    return current.origin === expected.origin && current.protocol === expected.protocol
      && current.host === expected.host && current.pathname === expected.pathname;
  } catch { return false; }
}

interface BackendRequest {
  url: string;
  owned: boolean;
  ownerUrl: string;
  frameUrl?: string;
  rendererFileUrl: string;
  rendererUrl?: string;
  headers: Record<string, string>;
}

export function authorizeBackendHeaders(request: BackendRequest, token: string): Record<string, string> | null {
  try {
    if (!isLocalBackendUrl(request.url) || !request.owned || !/^[a-f0-9]{64}$/.test(token)
      || !isTrustedRendererUrl(request.ownerUrl, request.rendererFileUrl, request.rendererUrl)
      || (request.frameUrl && !isTrustedRendererUrl(request.frameUrl, request.rendererFileUrl, request.rendererUrl))) return null;
    const headers = stripBackendTokenHeaders(request.headers);
    headers[BACKEND_TOKEN_HEADER] = token;
    return headers;
  } catch { return null; }
}
