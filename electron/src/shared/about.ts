export interface AboutSystemInfo {
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  osName: string;
  osVersion: string;
  osArch: string;
}

export interface BackendHealth {
  ok: boolean;
  backendVersion: string;
  springBootVersion: string;
  javaVersion: string;
  database: {
    product: string;
    version: string;
  };
}

export type UpdateCheckStatus = "idle" | "checking" | "latest" | "available" | "downloading" | "downloaded" | "installing" | "error";

export interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  currentVersion: string;
  latestVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  releaseUrl?: string;
  downloadUrl?: string;
  progress?: UpdateDownloadProgress;
  message?: string;
}

export interface AboutSnapshot {
  system: AboutSystemInfo;
  autoCheckUpdates: boolean;
  update: UpdateCheckResult;
}

export function normalizeReleaseVersion(value: string): string | null {
  const normalized = value.trim().replace(/^v/i, "");
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized) ? normalized : null;
}

export function compareReleaseVersions(leftValue: string, rightValue: string): number | null {
  const left = normalizeReleaseVersion(leftValue);
  const right = normalizeReleaseVersion(rightValue);
  if (!left || !right) return null;
  const [leftCore, leftPre] = left.split("-", 2);
  const [rightCore, rightPre] = right.split("-", 2);
  const leftNumbers = leftCore.split(".").map(Number);
  const rightNumbers = rightCore.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftNumbers[index] !== rightNumbers[index]) return leftNumbers[index] > rightNumbers[index] ? 1 : -1;
  }
  if (!leftPre && !rightPre) return 0;
  if (!leftPre) return 1;
  if (!rightPre) return -1;
  const leftParts = leftPre.split(".");
  const rightParts = rightPre.split(".");
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) > Number(rightPart) ? 1 : -1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart.localeCompare(rightPart) > 0 ? 1 : -1;
  }
  return 0;
}

export function formatDiagnosticReport(system: AboutSystemInfo, backend: BackendHealth | null): string {
  const backendAvailable = Boolean(backend?.ok);
  const database = backendAvailable
    ? `${backend!.database.product} ${backend!.database.version}`
    : "未连接";
  return [
    `调律音乐 v${system.appVersion}`,
    `操作系统 ${system.osName} ${system.osVersion} (${system.osArch})`,
    `Electron ${system.electronVersion}`,
    `Chromium ${system.chromeVersion}`,
    `Node.js ${system.nodeVersion}`,
    `后端 API ${backendAvailable ? backend!.backendVersion : "未连接"}`,
    `Spring Boot ${backendAvailable ? backend!.springBootVersion : "未连接"}`,
    `Java ${backendAvailable ? backend!.javaVersion : "未连接"}`,
    `数据库 ${database}`
  ].join("\n");
}
