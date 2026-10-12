import type { AppUpdater, UpdateInfo } from "electron-updater";
import { compareReleaseVersions, normalizeReleaseVersion, type UpdateCheckResult } from "../shared/about";

const RELEASES_URL = "https://github.com/WQTY-MASTER/tiaolv-music/releases/latest";
const SERVER_UPDATE_URL = "https://wqty.online/updates/windows/";
type UpdateEngine = Pick<AppUpdater, "autoDownload" | "autoInstallOnAppQuit" | "allowPrerelease" | "allowDowngrade" | "setFeedURL" | "on" | "checkForUpdates" | "downloadUpdate" | "quitAndInstall">;

interface UpdateServiceOptions {
  updater: UpdateEngine;
  currentVersion: string;
  isPackaged: boolean;
  platform: string;
  onChange: (result: UpdateCheckResult) => void;
  prepareInstall: () => Promise<void>;
  onDiagnostic?: (event: string, detail: unknown) => void;
}

export function createAppUpdateService(options: UpdateServiceOptions) {
  const { updater } = options;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.setFeedURL({ provider: "github", owner: "WQTY-MASTER", repo: "tiaolv-music", private: false });

  let state: UpdateCheckResult = { status: "idle", currentVersion: options.currentVersion, releaseUrl: RELEASES_URL };
  let phase: "check" | "download" | "install" | null = null;
  let checkTask: Promise<UpdateCheckResult> | undefined;
  let downloadTask: Promise<UpdateCheckResult> | undefined;
  let hasUpdate = false;
  let readyToInstall = false;
  let source: "server" | "github" = "github";

  function log(event: string, detail: unknown = {}) {
    try { options.onDiagnostic?.(event, { source, phase, ...detail as object }); } catch { /* Logging must not interrupt updating. */ }
  }

  function getSnapshot(): UpdateCheckResult {
    return { ...state, progress: state.progress ? { ...state.progress } : undefined };
  }

  function publish(patch: Partial<UpdateCheckResult>, reset = false) {
    state = { ...(reset ? { currentVersion: options.currentVersion, releaseUrl: RELEASES_URL } : state), ...patch } as UpdateCheckResult;
    options.onChange(getSnapshot());
  }

  function fail(error: unknown, message?: string) {
    log("request-failed", { error });
    readyToInstall = false;
    const detail = error instanceof Error ? error.message : String(error);
    publish({ status: "error", progress: undefined, message: message ?? (
      /checksum|sha512|sha256|signature/i.test(detail)
        ? "更新包校验失败，未安装。请重新下载或前往 Release 页面。"
        : "更新请求失败，请检查网络后重试，或打开 GitHub Release 页面手动下载。"
    ) });
  }

  function supported() {
    if (options.isPackaged && options.platform === "win32") return true;
    fail("unsupported", options.isPackaged ? "自动更新目前仅支持 Windows 安装版。" : "请在安装版中检查更新，开发模式不会下载或安装更新。" );
    return false;
  }

  function acceptRelease(info: UpdateInfo, available: boolean) {
    const version = normalizeReleaseVersion(info.version);
    const comparison = compareReleaseVersions(info.version, options.currentVersion);
    if (!version || comparison === null) {
      hasUpdate = false;
      fail("invalid-version", "GitHub 更新版本号格式不正确，未下载或安装。" );
      return;
    }
    hasUpdate = available && comparison > 0;
    if (hasUpdate) {
      const files = info.files;
      const validHash = (hash: unknown) => typeof hash === "string"
        && Buffer.from(hash, "base64").length === 64 && Buffer.from(hash, "base64").toString("base64") === hash;
      if (!Array.isArray(files) || !files.length || !files.every(file => typeof file.url === "string" && validHash(file.sha512))
        || !files.some(file => new URL(file.url, RELEASES_URL).pathname.toLowerCase().endsWith(".exe"))) {
        hasUpdate = false;
        fail("sha512-metadata", "更新清单缺少有效的安装包 SHA512 校验信息，未下载或安装。请前往 Release 页面手动下载。" );
        return;
      }
    }
    const notes = typeof info.releaseNotes === "string" ? info.releaseNotes
      : info.releaseNotes?.map(note => note.note ?? "").join("\n") ?? "";
    log("check-complete", { version, available: hasUpdate });
    publish({
      status: hasUpdate ? "available" : "latest", latestVersion: version,
      releaseName: info.releaseName ?? `调律音乐 v${version}`, releaseNotes: notes.slice(0, 6000),
      publishedAt: info.releaseDate, releaseUrl: `https://github.com/WQTY-MASTER/tiaolv-music/releases/tag/v${version}`,
      progress: undefined, message: hasUpdate ? "发现新版本。" : "当前已是最新版本。"
    });
  }

  updater.on("update-available", info => { if (phase === "check") acceptRelease(info, true); });
  updater.on("update-not-available", info => { if (phase === "check") acceptRelease(info, false); });
  updater.on("download-progress", progress => {
    if (phase !== "download" || state.status !== "downloading") return;
    const number = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
    publish({ progress: {
      percent: Math.min(100, number(progress.percent)), transferred: number(progress.transferred),
      total: number(progress.total), bytesPerSecond: number(progress.bytesPerSecond)
    } });
  });
  updater.on("update-downloaded", info => {
    // This event is emitted only after electron-updater verifies the downloaded file.
    if (phase !== "download" || normalizeReleaseVersion(info.version) !== state.latestVersion || state.status !== "downloading") return;
    readyToInstall = true;
    log("download-verified", { version: info.version });
    publish({ status: "downloaded", progress: undefined, message: "更新已下载并通过校验。" });
  });
  updater.on("error", error => {
    if (phase === "install") {
      phase = null;
      fail(error, "更新安装失败，请退出软件后前往 Release 页面手动安装。" );
    } else if (phase === "download") fail(error);
  });

  function check(): Promise<UpdateCheckResult> {
    if (checkTask) return checkTask;
    if (phase || readyToInstall || !supported()) return Promise.resolve(getSnapshot());
    phase = "check";
    hasUpdate = false;
    source = "server";
    log("check-start");
    updater.setFeedURL({ provider: "generic", url: SERVER_UPDATE_URL });
    publish({ status: "checking", message: "正在检查更新。", progress: undefined }, true);
    const checkSource = async () => {
      const result = await updater.checkForUpdates();
      if (state.status === "checking") {
        if (result) acceptRelease(result.updateInfo, true);
        else fail("missing-release");
      }
      return getSnapshot();
    };
    checkTask = checkSource().then(result => {
      if (result.status === "error") throw new Error("invalid-primary-release");
      return result;
    }).catch(error => {
      log("check-source-failed", { error });
      hasUpdate = false;
      source = "github";
      log("check-start");
      updater.setFeedURL({ provider: "github", owner: "WQTY-MASTER", repo: "tiaolv-music", private: false });
      publish({ status: "checking", message: "服务器更新暂不可用，正在检查 GitHub 备用源。" }, true);
      return checkSource();
    }).catch(error => { hasUpdate = false; fail(error); return getSnapshot(); }).finally(() => { phase = null; checkTask = undefined; });
    return checkTask;
  }

  function download(): Promise<UpdateCheckResult> {
    if (downloadTask) return downloadTask;
    if (phase || readyToInstall || !supported() || !hasUpdate) return Promise.resolve(getSnapshot());
    phase = "download";
    log("download-start", { version: state.latestVersion });
    readyToInstall = false;
    publish({ status: "downloading", message: "正在下载更新。", progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 } });
    downloadTask = updater.downloadUpdate().then(() => {
      if (!readyToInstall && state.status !== "error") fail("incomplete-download");
      return getSnapshot();
    }).catch(error => { fail(error); return getSnapshot(); }).finally(() => { phase = null; downloadTask = undefined; });
    return downloadTask;
  }

  async function install(): Promise<boolean> {
    if (phase || !supported() || !readyToInstall || state.status !== "downloaded") return false;
    phase = "install";
    log("install-start", { version: state.latestVersion });
    publish({ status: "installing", message: "正在关闭本地服务并准备安装更新。" });
    try {
      await options.prepareInstall();
    } catch (error) {
      phase = null;
      fail(error, "本地服务未能完全退出，未启动安装。请退出软件后手动安装。" );
      return false;
    }
    try {
      updater.quitAndInstall(false, true);
      return getSnapshot().status === "installing";
    } catch (error) {
      phase = null;
      fail(error, "更新安装失败，请退出软件后前往 Release 页面手动安装。" );
      return false;
    }
  }

  return { check, download, install, getSnapshot };
}
